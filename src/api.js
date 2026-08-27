/**
 * The browser talks only to our own functions. It never holds an API key,
 * never sees an OAuth token, and never sends prompt text.
 */

const storeFor = (key) => (key.startsWith("vault") ? "vault" : "cockpit");

let onUnauthorised = () => {};
export const setUnauthorisedHandler = (fn) => (onUnauthorised = fn);

async function req(path, init) {
  const res = await fetch(path, { credentials: "same-origin", ...init });
  if (res.status === 401) {
    onUnauthorised();
    throw new Error("Not authenticated");
  }
  return res;
}

export async function sGet(key, fallback) {
  try {
    const res = await req(`/api/store?store=${storeFor(key)}&key=${encodeURIComponent(key)}`);
    if (!res.ok) return fallback;
    const { value } = await res.json();
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

export async function sSet(key, value) {
  try {
    const res = await req("/api/store", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ store: storeFor(key), key, value }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Named operations only. The prompt lives on the server.
 *
 * The wire and the sweep run for a minute or more because of web search and
 * tool calls, far longer than a synchronous function may live. So the work is
 * handed to a background function and we poll for the answer.
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function callOp(payload, { onWait } = {}) {
  const jobId = crypto.randomUUID();
  const res = await req("/api/claude-background", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...payload, jobId }),
  });
  if (!res.ok && res.status !== 202) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Could not start (${res.status})`);
  }

  const deadline = Date.now() + 4 * 60 * 1000;
  let wait = 1500;
  while (Date.now() < deadline) {
    await sleep(wait);
    wait = Math.min(wait * 1.25, 5000);
    const r = await req(`/api/job?id=${jobId}`);
    if (!r.ok) continue;
    const job = await r.json().catch(() => ({}));
    if (job.status === "done") return job;
    if (job.status === "error") {
      const e = new Error(job.error || "The job failed.");
      // Carry the caught terms through, or the confidentiality guardrail
      // becomes a dead end rather than a question the UI can put back to you.
      if (job.blocked) e.blocked = job.blocked;
      throw e;
    }
    if (onWait) onWait(job.status || "pending");
  }
  throw new Error("Timed out after four minutes. The wire is slow today, try again.");
}

export async function login(password) {
  const res = await fetch("/api/login", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password }),
  });
  return res.ok;
}

export async function logout() {
  await fetch("/api/login", { method: "DELETE", credentials: "same-origin" });
}

/** Cheap probe: if the store answers, the session is good. */
export async function checkSession() {
  try {
    const res = await fetch("/api/store?store=cockpit&key=history", { credentials: "same-origin" });
    return res.ok;
  } catch {
    return false;
  }
}

/** User initiated only. Creates a new Google Doc from generated text. */
export async function saveToGoogleDoc(title, body) {
  const res = await req("/api/doc-create", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ title, body }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(errText(data.error, `Could not save (${res.status})`));
  return data;
}

/** Publish or schedule one clip. Deterministic, no model in the path. */
export async function publishClipDirect(payload) {
  const res = await req("/api/opus-publish", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(errText(data.error, `Publish failed (${res.status})`));
  return data;
}

/**
 * Commit one essay body to the hub. Deterministic, no model in the path.
 * The function refuses unknown slugs rather than writing an orphan body,
 * so a rejection here means the VINLAND index needs the entry first.
 */
export async function publishEssay(payload) {
  const res = await req("/api/publish-essay", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(errText(data.error, `Publish failed (${res.status})`));
  return data;
}
/* Server errors are not always strings. schedule.mjs relays Metricool's
   rejection verbatim because the field name is the useful part, and that
   arrives as an object — `new Error({...})` gives the user "[object Object]"
   and throws away the only sentence that explains the failure. */
function errText(e, fallback) {
  if (typeof e === "string" && e.trim()) return e;
  if (e && typeof e === "object") {
    const direct = e.message || e.detail || e.title || e.error;
    if (typeof direct === "string" && direct.trim()) return direct;
    try {
      const j = JSON.stringify(e);
      if (j && j !== "{}") return j.slice(0, 300);
    } catch { /* circular; fall through */ }
  }
  return fallback;
}

/* ---------------------------------------------------------------- queue --- */

const QUEUE = "/api/queue";

/* Called by every transport below. It was missing from this file entirely,
   so all six threw ReferenceError on first call — which is what made the
   upload button look dead while the code around it looked fine. */
async function queueFetch(path, { method = "GET", body, token } = {}, base = QUEUE) {
  const url = path ? `${base}/${path}` : base;
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers["content-type"] = "application/json";

  const res = await req(url, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(errText(data.error, `${method} ${url} failed (${res.status})`));
  return data;
}
/* The action queue speaks bearer, not session, because the Cowork skills call
   the same endpoints from outside the browser. Until it shares _auth with the
   rest of the Cockpit, the room passes a token held in React state only. */

export const queueGet = (path, token) => queueFetch(path, { token });

export const queuePost = (path, body, token) =>
  queueFetch(path, { method: "POST", body, token });

export const queuePatch = (id, body, token) =>
  queueFetch(`actions/${id}`, { method: "PATCH", body, token });

/* ---------------------------------------------------------------- media --- */

export const mediaPresign = (body, token) =>
  queueFetch("presign", { method: "POST", body, token }, "/api/media");

export const mediaRegister = (body, token) =>
  queueFetch("register", { method: "POST", body, token }, "/api/media");

export const mediaList = (token) => queueFetch("list", { token }, "/api/media");

export const mediaShare = (body, token) =>
  queueFetch("share", { method: "POST", body, token }, "/api/media");

export const mediaSchedule = (body, token) =>
  queueFetch("", { method: "POST", body, token }, "/api/schedule");

