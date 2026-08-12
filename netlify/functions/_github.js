/**
 * Writes into vinnyobrien/vspot-hub so the cockpit can publish to the site.
 *
 * The token lives only in the function environment. It is never returned to
 * the browser and never reaches a model: like the Opus publish path, a commit
 * is a deterministic action with known arguments, so a language model in the
 * middle adds ways to be wrong and none to be right.
 */

const OWNER = "vinnyobrien";
const REPO = "vspot-hub";
const API = `https://api.github.com/repos/${OWNER}/${REPO}`;

function gh() {
  // The two cockpit sites name this differently, so accept either rather than
  // failing silently on whichever one happens to be serving.
  const raw = process.env.GITHUB_TOKEN || process.env.VSPOT_GH_TOKEN || "";
  const token = raw.trim().replace(/^["']|["']$/g, "");
  if (!token) throw new Error("Neither GITHUB_TOKEN nor VSPOT_GH_TOKEN is set on this site.");
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "vspot-cockpit",
  };
}

async function call(path, { method = "GET", body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: gh(),
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text.slice(0, 300);
  }
  return { ok: res.ok, status: res.status, body: parsed };
}

const hint = (status) =>
  ({
    401: "Token rejected. Check it is a fine-grained personal access token, not expired.",
    403: "Token lacks permission. It needs Contents: Read and write on vspot-hub.",
    404: "Repo or path not found. A fine-grained token also 404s when the repo is not in its selected list.",
    409: "Branch is out of date, or the file changed since it was read.",
    422: "GitHub rejected the commit. Usually a stale file SHA.",
  }[status] || "");

/** Default branch, so we never assume main. */
export async function defaultBranch() {
  const r = await call("");
  if (!r.ok) throw new Error(`GitHub ${r.status}. ${hint(r.status)}`);
  return r.body.default_branch || "main";
}

/** The whole tree, so the layout can be read rather than guessed at. */
export async function tree() {
  const branch = await defaultBranch();
  const r = await call(`/git/trees/${encodeURIComponent(branch)}?recursive=1`);
  if (!r.ok) throw new Error(`GitHub ${r.status}. ${hint(r.status)}`);
  return {
    branch,
    truncated: r.body.truncated,
    paths: (r.body.tree || []).filter((n) => n.type === "blob").map((n) => n.path),
  };
}

export async function readFile(path) {
  const branch = await defaultBranch();
  const r = await call(`/contents/${path.split("/").map(encodeURIComponent).join("/")}?ref=${branch}`);
  if (!r.ok) return null;
  return {
    sha: r.body.sha,
    content: Buffer.from(r.body.content || "", "base64").toString("utf8"),
  };
}

/** Create or update one file. Returns the commit. */
export async function writeFile(path, content, message) {
  const branch = await defaultBranch();
  const existing = await readFile(path);
  const r = await call(`/contents/${path.split("/").map(encodeURIComponent).join("/")}`, {
    method: "PUT",
    body: {
      message,
      content: Buffer.from(content, "utf8").toString("base64"),
      branch,
      ...(existing ? { sha: existing.sha } : {}),
    },
  });
  if (!r.ok) throw new Error(`GitHub ${r.status} writing ${path}. ${hint(r.status)}`);
  return { path, commit: r.body.commit && r.body.commit.sha, updated: !!existing };
}
