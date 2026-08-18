import { requireAuth, json } from "./_auth.js";
import { readJSON } from "./_blobs.js";

/**
 * /api/archive-linkedin
 *
 * The LinkedIn half of the corpus. Same shape and same contract as
 * /api/archive: read only by construction, no write path exists in this file,
 * and nothing here can reach the vault.
 *
 * modes
 *   map                     the small one. Timeline, threads, entities, voice
 *   index                   metadata for every piece, no body text
 *   thread&t=<slug>         the pieces on one thread, newest first
 *   post&id=<slug>          one piece with its body
 *   search&q=<terms>        substring search across bodies, capped
 *
 * Only 'post' and 'search' touch linkedin:full, which is the large key. Every
 * other mode reads the small ones, which is the whole point of the split.
 *
 * MERGE NOTE: this deliberately duplicates archive.js rather than editing it,
 * because archive.js is not in the pushed tree and could not be read when this
 * was written. Once both files are in front of you, fold this in as
 * ?source=substack|linkedin|all and delete this file. Two functions serving one
 * corpus is exactly the drift that cost a morning.
 */

const SLUG = /^[a-z0-9-]{1,90}$/;
const MAX_HITS = 40;

export default async (req) => {
  const denied = requireAuth(req);
  if (denied) return denied;
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const url = new URL(req.url);
  const mode = (url.searchParams.get("mode") || "map").trim();

  if (mode === "map") {
    return json({ map: await readJSON("cockpit", "linkedin:map", null) });
  }

  if (mode === "index") {
    return json({ index: await readJSON("cockpit", "linkedin:index", []) });
  }

  if (mode === "thread") {
    const t = (url.searchParams.get("t") || "").trim();
    if (!SLUG.test(t)) return json({ error: "Bad request" }, 400);
    const index = await readJSON("cockpit", "linkedin:index", []);
    const posts = index
      .filter((p) => (p.threads || []).includes(t))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)));
    return json({ thread: t, count: posts.length, posts });
  }

  if (mode === "post") {
    const id = (url.searchParams.get("id") || "").trim();
    if (!SLUG.test(id)) return json({ error: "Bad request" }, 400);
    const full = await readJSON("cockpit", "linkedin:full", []);
    const post = full.find((p) => p.id === id);
    return post ? json({ post }) : json({ error: "Not found" }, 404);
  }

  if (mode === "search") {
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();
    if (q.length < 3) return json({ error: "Query too short" }, 400);
    const full = await readJSON("cockpit", "linkedin:full", []);
    const hits = [];
    for (const p of full) {
      const body = String(p._body || "");
      const at = body.toLowerCase().indexOf(q);
      if (at === -1 && !String(p.title).toLowerCase().includes(q)) continue;
      hits.push({
        id: p.id,
        title: p.title,
        date: p.date,
        url: p.url,
        threads: p.threads,
        // a window around the hit, not the piece. Enough to recognise it.
        context: at === -1 ? p.excerpt : body.slice(Math.max(0, at - 120), at + 200).trim(),
      });
      if (hits.length >= MAX_HITS) break;
    }
    return json({ q, count: hits.length, hits });
  }

  return json({ error: "Unknown mode" }, 400);
};
