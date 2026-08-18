import { requireAuth, json } from "./_auth.js";
import { writeJSON } from "./_blobs.js";

import index from "./_seed/linkedin-index.json" with { type: "json" };
import full from "./_seed/linkedin-full.json" with { type: "json" };
import map from "./_seed/linkedin-map.json" with { type: "json" };

/**
 * ONE SHOT. DELETE THIS FILE AND ./_seed/ THE MOMENT IT HAS RUN.
 *
 * Same trap as seed-archive.js: while these imports exist, esbuild inlines the
 * JSON into the bundle for this function on every single build. That is 135 KB
 * of dead weight shipped forever to seed three keys once.
 *
 * Visit /api/seed-linkedin while logged in, confirm the counts in the response,
 * then delete netlify/functions/seed-linkedin.js and netlify/functions/_seed/,
 * commit, push.
 */
export default async (req) => {
  const denied = requireAuth(req);
  if (denied) return denied;

  await writeJSON("cockpit", "linkedin:index", index);
  await writeJSON("cockpit", "linkedin:full", full);
  await writeJSON("cockpit", "linkedin:map", map);

  return json({
    ok: true,
    seeded: { index: index.length, full: full.length, posts: map.posts },
    reminder: "Delete seed-linkedin.js and _seed/ now.",
  });
};
