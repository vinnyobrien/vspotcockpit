/**
 * netlify/functions/_opus.js
 *
 * Single transport for OpusClip. Every function that touches Opus goes through
 * here so the base URL and the auth headers exist in exactly one place.
 *
 * OpusClip over its REST API rather than its MCP endpoint. The MCP route
 * returned "Authentication error" because Anthropic's MCP client sends only an
 * Authorization header, while Opus's MCP endpoint expects the OAuth session a
 * connector establishes, and some endpoints additionally want x-opus-org-id.
 * Calling REST directly from here means we control every header, we see the
 * real status code, and the model never touches the credential.
 *
 * MERGE NOTE, 18 August 2026.
 * The Cast rewrite of this file replaced it wholesale and dropped five exports
 * that opus-publish.js, opus-test.js and claude-background.js still import.
 * That is a build break, not a warning. This version restores them.
 *
 * It also resolves the "ONE THING TO CONFIRM" note the Cast version carried at
 * the top. The confirmation was never done, and the two versions disagreed:
 *
 *   base    /api          (this file)   vs  /api/v1        (Cast version)
 *   org     x-opus-org-id (this file)   vs  X-Org-Id       (Cast version)
 *
 * The values here are the ones with evidence behind them: they were arrived at
 * by debugging real 401s and 404s against the live API, and the comments below
 * record what each probe returned. The Cast values were written speculatively
 * and never verified against a live call. If a Cast function starts failing
 * with 401 or 404 after this change, that is the actual bug surfacing, not a
 * regression introduced here.
 *
 * Two call styles are exported deliberately:
 *   opusCall  returns { ok, status, body } and NEVER throws. Use when you want
 *             to report the real status to a human.
 *   opus      throws on non-2xx. Use in the Cast path, which is written around
 *             try/catch and wants a 502 with a message.
 */

const BASE = "https://api.opus.pro/api";

function headers() {
  const key = (process.env.OPUS_API_KEY || "").trim().replace(/^["']|["']$/g, "");
  if (!key) throw new Error("OPUS_API_KEY is not set on this site.");
  const h = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
  // Required by /exportable-clips and the social endpoints.
  const org = (process.env.OPUS_ORG_ID || "").trim();
  if (org) h["x-opus-org-id"] = org;
  return h;
}

// Opus allows 30 requests a minute. Everything here is paced at 250ms.
let lastCall = 0;
async function paced() {
  const gap = Date.now() - lastCall;
  if (gap < 250) await new Promise((r) => setTimeout(r, 250 - gap));
  lastCall = Date.now();
}

/** Returns { ok, status, body } and never throws on a non-2xx, so callers can
    report the real reason instead of a generic failure. */
export async function opusCall(path, { method = "GET", body } = {}) {
  await paced();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: headers(),
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text.slice(0, 400);
  }
  return { ok: res.ok, status: res.status, body: parsed };
}

const hint = (status) =>
  ({
    401: "Opus rejected the key. Regenerate it in the dashboard, lower left corner.",
    403: "Key is valid but this account does not have API access. Opus restricts the API to Pro (Beta), Max and Business plans.",
    404: "Either the path is wrong or the thing being referenced does not exist. Read the message: 'Clip not found' means the ID is wrong, not the URL.",
    429: "Rate limited. Opus allows 30 requests per minute per key.",
  }[status] || "");

/**
 * Throwing wrapper. The Cast functions were written against this signature and
 * their try/catch blocks turn the thrown message into a 502 the operator can
 * read. Do not "simplify" this into opusCall; the two error contracts are
 * different on purpose.
 */
export async function opus(path, { method = "GET", body } = {}) {
  const r = await opusCall(path, { method, body });
  if (!r.ok) {
    const detail =
      typeof r.body === "object" ? JSON.stringify(r.body).slice(0, 300) : String(r.body).slice(0, 300);
    throw new Error(`Opus ${r.status} on ${path}. ${hint(r.status)} ${detail}`.trim());
  }
  return r.body;
}

/** Opus wraps collections in `list`. Kept the other shapes as fallbacks in
    case a different endpoint answers differently. */
const collection = (b) =>
  (b && (b.list || b.clips || b.projects || b.data || b.items)) || (Array.isArray(b) ? b : []);

/* ---------- probing ---------- */

/** Probe several plausible list paths and report exactly what each returns.
    Used by /api/opus-test so we can see the truth rather than guess at it. */
export async function opusProbe() {
  const out = [];

  // Find a real project first so the clip probes are meaningful.
  let sampleId = null;
  try {
    const r = await opusCall("/clip-projects?page=0&pageSize=3");
    // The documented parameter is the P-prefixed projectId, not the internal id.
    const first = collection(r.body)[0];
    sampleId = first && (first.projectId || first.id);
    out.push({ path: "/clip-projects", status: r.status, ok: r.ok, sampleId: sampleId || null });
  } catch (e) {
    out.push({ path: "/clip-projects", error: String(e.message || e) });
  }

  const paths = [
    "/social-accounts?q=mine",
    sampleId ? `/exportable-clips?q=findByProjectId&projectId=${encodeURIComponent(sampleId)}` : null,
  ].filter(Boolean);

  for (const p of paths) {
    try {
      const r = await opusCall(p);
      out.push({
        path: p,
        status: r.status,
        ok: r.ok,
        count: r.ok ? collection(r.body.data || r.body).length : null,
        hint: r.ok ? "" : hint(r.status),
      });
    } catch (e) {
      out.push({ path: p, error: String(e.message || e) });
    }
  }

  return { base: BASE, orgHeaderSet: Boolean((process.env.OPUS_ORG_ID || "").trim()), probes: out };
}

/* ---------- listing ---------- */

/**
 * Paginated. The previous version fetched page 0 at pageSize 20 and stopped,
 * which is invisible at nine projects and silently truncates at twenty.
 */
export async function listProjects({ max = 200 } = {}) {
  const seen = [];
  const pageSize = 20;

  for (let page = 0; seen.length < max; page += 1) {
    const r = await opusCall(`/clip-projects?page=${page}&pageSize=${pageSize}`);
    if (!r.ok) throw new Error(`Opus ${r.status}. ${hint(r.status)}`);

    const batch = collection(r.body);
    if (!batch.length) break;

    seen.push(
      ...batch.map((p) => ({
        projectId: p.projectId || p.id,
        title: (p.sourceInfo && p.sourceInfo.title) || p.title || "Untitled",
        videoId: p.sourceInfo && p.sourceInfo.videoId,
        created: p.createdAt,
      }))
    );

    // A short page is the last page. Guard against an endpoint that ignores
    // `page` and returns the same batch forever.
    if (batch.length < pageSize) break;
    if (page > 40) break;
  }

  return seen.slice(0, max);
}

/** Clips do NOT live under /clip-projects. The documented endpoint is
    GET /api/exportable-clips?q=findByProjectId&projectId=... and it requires
    the x-opus-org-id header, which is why every path under /clip-projects
    returned 404 no matter how it was spelled. */
export async function listClips(projectId) {
  const r = await opusCall(
    `/exportable-clips?q=findByProjectId&projectId=${encodeURIComponent(projectId)}`
  );
  if (!r.ok) throw new Error(`Opus ${r.status} on clips. ${hint(r.status)}`);
  const b = r.body || {};
  return collection(b.data || b);
}

/* ---------- social posting ----------
   Documented endpoints:
     GET  /api/social-accounts?q=mine
     POST /api/post-tasks           publish now
     POST /api/publish-schedules    publish later
     DEL  /api/publish-schedules/{scheduleId}
   These are called directly, never through a model. A publish is a
   deterministic action with known arguments, so putting a language model in
   that path adds a way to get it wrong and no way to get it more right. */

export async function socialAccounts() {
  const r = await opusCall("/social-accounts?q=mine");
  if (!r.ok) throw new Error(`Opus ${r.status} on social accounts. ${hint(r.status)}`);
  const b = r.body || {};
  return collection(b.data || b);
}

/* Opus nests the copy under postDetail. The identifiers stay at the top level.
   Discovered from its own error: "postDetail.title is required".

   clipId here MUST be the curationId. `id` is the composite
   "projectId.curationId" and posting rejects it with "Clip not found". */
function postBody({ projectId, clipId, postAccountId, title, description, subAccountId, mediaType, privacy }) {
  const postDetail = { title };
  if (description) postDetail.description = description;
  if (mediaType) postDetail.mediaType = mediaType;
  if (privacy) postDetail.privacy = privacy;

  const body = { projectId, clipId, postAccountId, postDetail };
  if (subAccountId) body.subAccountId = subAccountId;
  return body;
}

export async function publishNow(args) {
  const r = await opusCall("/post-tasks", { method: "POST", body: postBody(args) });
  if (!r.ok) {
    const detail =
      typeof r.body === "object" ? JSON.stringify(r.body).slice(0, 300) : String(r.body).slice(0, 300);
    throw new Error(`Opus ${r.status} on publish. ${hint(r.status)} ${detail}`.trim());
  }
  return r.body;
}

export async function schedulePost(args) {
  const r = await opusCall("/publish-schedules", {
    method: "POST",
    body: { ...postBody(args), publishAt: args.publishAt },
  });
  if (!r.ok) {
    const detail =
      typeof r.body === "object" ? JSON.stringify(r.body).slice(0, 300) : String(r.body).slice(0, 300);
    throw new Error(`Opus ${r.status} on schedule. ${hint(r.status)} ${detail}`.trim());
  }
  return r.body;
}

/* ---------- Cast naming ----------
   Cast projects must be findable and excludable. The Video room's selector
   reads every project now, so without this prefix Murt shows up in the clip
   swipe deck as a proposed clip. */

export const CAST_PREFIX = "CAST/";

export function castTitle(correspondentName, slug) {
  return `${CAST_PREFIX}${correspondentName} ${slug}`.slice(0, 120);
}

export function isCastProject(title) {
  return typeof title === "string" && title.startsWith(CAST_PREFIX);
}
