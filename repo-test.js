import { requireAuth, json } from "./_auth.js";
import { tree } from "./_github.js";

/** Reports the repo layout so it can be read rather than guessed at.
    Paths only, no file contents, no token. */
export default async (req) => {
  const denied = requireAuth(req);
  if (denied) return denied;
  try {
    const t = await tree();
    const dirs = [...new Set(t.paths.map((p) => p.split("/").slice(0, 2).join("/")))].sort();
    return json({
      branch: t.branch,
      truncated: t.truncated,
      fileCount: t.paths.length,
      topLevel: dirs,
      pages: t.paths.filter((p) => /^src\/(pages|content|layouts|components)\//.test(p)).slice(0, 120),
      config: t.paths.filter((p) => /^(astro\.config|package\.json|netlify\.toml|src\/consts)/.test(p)),
    });
  } catch (e) {
    return json({ error: String(e.message || e) }, 502);
  }
};
