import { requireAuth, json } from "./_auth.js";
import { record } from "./_ledger.js";

/**
 * POST /api/publish-wire  → commits the day's stories to the site repo.
 *
 * Writes a single JSON file the Astro site reads for the ticker, rather than
 * one file per day, because a ticker wants the latest N stories and nothing
 * else. History is kept in the same file, capped, so the site can show a
 * "yesterday" view without a second fetch.
 *
 * Env:
 *   VSPOT_GH_TOKEN    fine-grained PAT, Contents: read and write
 *   VSPOT_SITE_REPO   default vinnyobrien/vspot-hub
 *   VSPOT_WIRE_PATH   default src/data/wire.json
 */

const env = (k, d = "") => (process.env[k] || d).trim().replace(/^["']|["']$/g, "");
const API = "https://api.github.com";
const KEEP = 60;          // stories retained in the file
const TICKER = 12;        // stories the ticker shows

async function gh(path, token, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "TheCockpit",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

const clean = (s, n) => String(s || "").replace(/\s+/g, " ").trim().slice(0, n);

export default async (req) => {
  const denied = requireAuth(req);
  if (denied) return denied;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let b;
  try { b = await req.json(); } catch { return json({ error: "Bad request" }, 400); }

  const token = env("VSPOT_GH_TOKEN") || env("GH_PAT") || env("VSPOT_GITHUB_TOKEN");
  if (!token) return json({ error: "VSPOT_GH_TOKEN is not set on this site." }, 500);

  const repo = env("VSPOT_SITE_REPO", "vinnyobrien/vspot-hub");
  const path = env("VSPOT_WIRE_PATH", "src/data/wire.json");

  const incoming = Array.isArray(b.stories) ? b.stories : [];
  if (!incoming.length) return json({ error: "No stories to publish." }, 400);

  const date = new Date().toISOString().slice(0, 10);

  const stories = incoming.slice(0, 30).map((s) => ({
    headline: clean(s.headline, 200),
    summary: clean(s.summary, 400),
    // The POV is the reason anyone reads a ticker rather than an aggregator.
    pov: clean(s.pov, 300),
    source: clean(s.source, 80),
    url: /^https?:\/\//.test(s.url || "") ? s.url : null,
    region: clean(s.region, 12),
    topic: clean(s.topic, 40),
    date,
  })).filter((s) => s.headline);

  if (!stories.length) return json({ error: "Every story was missing a headline." }, 400);

  // Read what is there so the file keeps a short history rather than
  // overwriting itself daily.
  let sha, previous = [];
  const existing = await gh(`/repos/${repo}/contents/${encodeURI(path)}`, token);
  if (existing.ok && existing.body?.content) {
    sha = existing.body.sha;
    try {
      const parsed = JSON.parse(Buffer.from(existing.body.content, "base64").toString("utf8"));
      previous = Array.isArray(parsed) ? parsed : (parsed.stories || []);
    } catch {
      previous = [];   // unreadable file is replaced, not merged into
    }
  } else if (existing.status !== 404) {
    const hint = existing.status === 401 ? "The token was rejected."
      : existing.status === 403 ? "The token cannot reach that repository."
      : `GitHub returned ${existing.status}.`;
    return json({ error: `${hint} ${existing.body?.message || ""}`.trim() }, 502);
  }

  // Same headline twice is the same story. Today's version wins.
  const seen = new Set(stories.map((s) => s.headline.toLowerCase()));
  const merged = [...stories, ...previous.filter((p) => !seen.has(String(p.headline || "").toLowerCase()))]
    .slice(0, KEEP);

  const payload = {
    updated: new Date().toISOString(),
    date,
    ticker: merged.slice(0, TICKER).map((s) => ({
      headline: s.headline, url: s.url, source: s.source, region: s.region,
    })),
    stories: merged,
  };

  const put = await gh(`/repos/${repo}/contents/${encodeURI(path)}`, token, {
    method: "PUT",
    body: JSON.stringify({
      message: `Wire: ${stories.length} stories, ${date}`,
      content: Buffer.from(JSON.stringify(payload, null, 2), "utf8").toString("base64"),
      ...(sha ? { sha } : {}),
    }),
  });

  if (!put.ok) {
    await record("wire.failed", { count: stories.length, error: String(put.body?.message || put.status) });
    return json({
      error: `Could not commit: ${put.body?.message || put.status}. Check VSPOT_WIRE_PATH matches the site's data directory.`,
    }, 502);
  }

  await record("wire.published", { count: stories.length, path, repo, total: merged.length });

  return json({
    published: true,
    committed: stories.length,
    total: merged.length,
    path,
    commit: put.body?.commit?.html_url || null,
    note: "Netlify will rebuild thevspotnews.com. Give it a minute.",
  });
};
