import { requireAuth, json } from "./_auth.js";
import { record } from "./_ledger.js";

/**
 * POST /api/publish-essay  → commits one essay body to the site repo.
 *
 * The hub keeps two files, deliberately apart:
 *
 *   src/data/vinland.js          the hand-maintained index. Regions, slugs,
 *                                titles, teasers. A machine never writes here.
 *   src/data/essay-bodies.json   the bodies, keyed by slug. This is ours.
 *
 * src/pages/vinland/[slug].astro joins them at build time, and getStaticPaths
 * only generates pages for slugs listed in vinland.js. So a body written
 * against an unknown slug produces no page at all: valid JSON, silently
 * unreachable. We refuse that rather than report a success nobody can visit.
 *
 * Env:
 *   VSPOT_GH_TOKEN     fine-grained PAT, Contents: read and write
 *   VSPOT_SITE_REPO    default vinnyobrien/vspot-hub
 *   VSPOT_ESSAY_PATH   default src/data/essay-bodies.json
 *   VSPOT_INDEX_PATH   default src/data/vinland.js
 */

const env = (k, d = "") => (process.env[k] || d).trim().replace(/^["']|["']$/g, "");
const API = "https://api.github.com";

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

const decode = (b64) => Buffer.from(b64, "base64").toString("utf8");

/**
 * Paragraphs, not markdown. [slug].astro renders each entry as its own <p>,
 * so the split has to happen here or the whole essay arrives as one block.
 * Blank line is the separator, which is what anyone typing prose already does.
 */
function toParagraphs(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
}

/** Slugs live in the index as `slug: 'name'`. Read, don't parse the module. */
function slugsIn(source) {
  return new Set([...String(source).matchAll(/slug:\s*'([^']+)'/g)].map((m) => m[1]));
}

const near = (want, have) => {
  const w = want.replace(/-/g, "");
  return [...have].filter((s) => s.replace(/-/g, "").includes(w) || w.includes(s.replace(/-/g, ""))).slice(0, 4);
};

export default async (req) => {
  const denied = requireAuth(req);
  if (denied) return denied;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let b;
  try { b = await req.json(); } catch { return json({ error: "Bad request" }, 400); }

  const token = env("VSPOT_GH_TOKEN") || env("GH_PAT") || env("VSPOT_GITHUB_TOKEN");
  if (!token) return json({ error: "VSPOT_GH_TOKEN is not set on this site." }, 500);

  const repo = env("VSPOT_SITE_REPO", "vinnyobrien/vspot-hub");
  const path = env("VSPOT_ESSAY_PATH", "src/data/essay-bodies.json");
  const indexPath = env("VSPOT_INDEX_PATH", "src/data/vinland.js");

  const slug = String(b.slug || "").trim().toLowerCase();
  if (!/^[a-z0-9-]{3,80}$/.test(slug)) {
    return json({ error: "A slug is required, lowercase letters, numbers and hyphens only." }, 400);
  }

  const paragraphs = toParagraphs(b.body);
  if (!paragraphs.length) return json({ error: "There is no body to publish." }, 400);

  // Does the destination page exist? Checked first, so a wrong slug costs
  // nothing rather than leaving an orphan body in the file.
  const index = await gh(`/repos/${repo}/contents/${encodeURI(indexPath)}`, token);
  if (index.ok && index.body?.content) {
    const known = slugsIn(decode(index.body.content));
    if (!known.has(slug)) {
      const suggestions = near(slug, known);
      return json({
        error: `There is no essay with the slug "${slug}" in ${indexPath}, so publishing it would create a body with no page. `
          + (suggestions.length ? `Did you mean: ${suggestions.join(", ")}?` : `Add it to the VINLAND index first, then publish.`),
      }, 400);
    }
  } else if (index.status !== 404) {
    return json({ error: `Could not read the VINLAND index (${index.status}). Nothing was published.` }, 502);
  }

  // Merge rather than replace. One essay publishing must never blank the rest.
  let sha, bodies = {};
  const existing = await gh(`/repos/${repo}/contents/${encodeURI(path)}`, token);
  if (existing.ok && existing.body?.content) {
    sha = existing.body.sha;
    try {
      const parsed = JSON.parse(decode(existing.body.content));
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) bodies = parsed;
    } catch {
      // An unreadable bodies file is a real problem and overwriting it would
      // destroy every other published essay. Stop and say so.
      return json({ error: `${path} is not valid JSON. Fix it by hand before publishing, or the other essays are lost.` }, 409);
    }
  } else if (existing.status !== 404) {
    const hint = existing.status === 401 ? "The token was rejected."
      : existing.status === 403 ? "The token cannot reach that repository."
      : `GitHub returned ${existing.status}.`;
    return json({ error: `${hint} ${existing.body?.message || ""}`.trim() }, 502);
  }

  const replacing = !!bodies[slug];
  bodies[slug] = {
    body: paragraphs,
    words: paragraphs.join(" ").split(/\s+/).length,
    published: new Date().toISOString(),
    ...(b.hero ? { hero: String(b.hero).slice(0, 400) } : {}),
    ...(b.heroAlt ? { heroAlt: String(b.heroAlt).slice(0, 300) } : {}),
  };

  const put = await gh(`/repos/${repo}/contents/${encodeURI(path)}`, token, {
    method: "PUT",
    body: JSON.stringify({
      message: `Essay: ${replacing ? "update" : "publish"} ${slug}`,
      content: Buffer.from(JSON.stringify(bodies, null, 2), "utf8").toString("base64"),
      ...(sha ? { sha } : {}),
    }),
  });

  if (!put.ok) {
    await record("essay.failed", { slug, error: String(put.body?.message || put.status) });
    return json({ error: `Could not commit: ${put.body?.message || put.status}` }, 502);
  }

  await record("essay.published", { slug, paragraphs: paragraphs.length, replacing, repo });

  return json({
    published: true,
    replacing,
    slug,
    paragraphs: paragraphs.length,
    words: bodies[slug].words,
    url: `https://thevspotnews.com/vinland/${slug}/`,
    commit: put.body?.commit?.html_url || null,
    note: "Netlify will rebuild the hub. Give it a minute before checking the URL.",
  });
};
