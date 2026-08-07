/**
 * OpusClip over its REST API rather than its MCP endpoint.
 *
 * The MCP route returned "Authentication error" because Anthropic's MCP client
 * sends only an Authorization header, while Opus's MCP endpoint expects the
 * OAuth session a connector establishes, and some endpoints additionally want
 * x-opus-org-id. Calling REST directly from here means we control every header,
 * we see the real status code, and the model never touches the credential.
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

/** Returns { ok, status, body } and never throws on a non-2xx, so callers can
    report the real reason instead of a generic failure. */
export async function opusCall(path, { method = "GET", body } = {}) {
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

/** Probe several plausible list paths and report exactly what each returns.
    Used by /api/opus-test so we can see the truth rather than guess at it. */
export async function opusProbe() {
  const out = [];

  // Find a real project first so the clip probes are meaningful.
  let sampleId = null;
  try {
    const r = await opusCall("/clip-projects?page=0&pageSize=3");
    const first = collection(r.body)[0];
    // The documented parameter is the P-prefixed projectId, not the internal id.
    sampleId = first && (first.projectId || first.id);
  } catch {
    /* reported below */
  }

  const paths = [
    "/clip-projects?page=0&pageSize=3",
    ...(sampleId
      ? [
          `/exportable-clips?q=findByProjectId&projectId=${sampleId}`,
          "/social-accounts",
          "/post-accounts",
        ]
      : []),
  ];
  for (const p of paths) {
    try {
      const r = await opusCall(p);
      const row = {
        path: p,
        status: r.status,
        ok: r.ok,
        hint: hint(r.status),
        sample: r.ok ? JSON.stringify(r.body).slice(0, 200) : JSON.stringify(r.body).slice(0, 200),
      };

      // For the clips call, dump the FIRST object in full. Guessing at which
      // field holds the identifier is what has cost us the last three attempts.
      if (r.ok && p.includes("exportable-clips")) {
        const first = collection(r.body.data || r.body)[0];
        if (first) {
          row.firstClipKeys = Object.keys(first);
          row.firstClip = JSON.parse(
            JSON.stringify(first, (k, v) =>
              typeof v === "string" && v.length > 90 ? v.slice(0, 90) + "..." : v
            )
          );
        } else {
          row.firstClip = "collection parsed but empty, so the wrapper key is wrong";
          row.bodyKeys = Object.keys(r.body || {});
        }
      }
      out.push(row);
    } catch (e) {
      out.push({ path: p, status: 0, ok: false, hint: String(e.message) });
    }
  }
  return out;
}

/** Opus wraps collections in `list`. Kept the other shapes as fallbacks in
    case a different endpoint answers differently. */
const collection = (b) =>
  (b && (b.list || b.clips || b.projects || b.data || b.items)) || (Array.isArray(b) ? b : []);

export async function listProjects() {
  const r = await opusCall("/clip-projects?page=0&pageSize=20");
  if (!r.ok) throw new Error(`Opus ${r.status}. ${hint(r.status)}`);
  return collection(r.body).map((p) => ({
    projectId: p.projectId || p.id,
    title: (p.sourceInfo && p.sourceInfo.title) || p.title || "Untitled",
    videoId: p.sourceInfo && p.sourceInfo.videoId,
    created: p.createdAt,
  }));
}

/** Clips do NOT live under /clip-projects. The documented endpoint is
    GET /api/exportable-clips?q=findByProjectId&projectId=... and it requires
    the x-opus-org-id header, which is why every path under /clip-projects
    returned 404 no matter how it was spelled. */
export async function listClips(projectId) {
  const r = await opusCall(`/exportable-clips?q=findByProjectId&projectId=${encodeURIComponent(projectId)}`);
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
   Discovered from its own error: "postDetail.title is required". */
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
    const detail = typeof r.body === "object" ? JSON.stringify(r.body).slice(0, 300) : String(r.body).slice(0, 300);
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
    const detail = typeof r.body === "object" ? JSON.stringify(r.body).slice(0, 300) : String(r.body).slice(0, 300);
    throw new Error(`Opus ${r.status} on schedule. ${hint(r.status)} ${detail}`.trim());
  }
  return r.body;
}
