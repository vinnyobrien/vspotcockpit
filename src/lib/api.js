/**
 * src/lib/api.js — The Cockpit
 *
 * Transport layer, written against API-CONTRACT.md. Talks to the same 37
 * functions the current build talks to. No endpoint, payload or Blob key here
 * is new.
 *
 * One deliberate behavioural change from the original, marked THE FIX below.
 */

/* ---------------------------------------------------------------- auth --- */

let onAuthFail = () => {};
export const setAuthFailHandler = (fn) => { onAuthFail = fn; };

/** Every request goes through here. 401 is global — any call can return it. */
async function request(url, opts) {
  const res = await fetch(url, { credentials: "same-origin", ...opts });
  if (res.status === 401) {
    onAuthFail();
    throw new Error("Not authenticated");
  }
  return res;
}

export async function login(password) {
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password }),
  });
  return res.ok;
}

/* --------------------------------------------------------------- blobs --- */

const storeFor = (key) => (key.startsWith("vault") ? "vault" : "cockpit");

/**
 * THE FIX.
 *
 * The original swallowed every failure and returned the fallback:
 *
 *     try { ... } catch { return fallback }
 *
 * That makes a network error indistinguishable from an empty key. The app then
 * writes its in-memory state over whatever was really in the store. This is
 * why clips-seen sits at 79 bytes — six IDs, one session, overwritten daily,
 * when it should be accumulating toward 600.
 *
 * So: a MISSING key returns the fallback. A FAILED read throws. Callers that
 * genuinely don't care can opt out with { soft: true }, but no write path ever
 * should.
 */
export async function readKey(key, fallback = null, { soft = false } = {}) {
  let res;
  try {
    res = await request(`/api/store?store=${storeFor(key)}&key=${encodeURIComponent(key)}`);
  } catch (err) {
    if (soft) return fallback;
    throw new Error(`Could not read "${key}": ${err.message}`);
  }
  if (res.status === 404) return fallback;      // genuinely absent
  if (!res.ok) {
    if (soft) return fallback;
    throw new Error(`Could not read "${key}" (${res.status})`);
  }
  const { value } = await res.json();
  return value ?? fallback;
}

export async function writeKey(key, value) {
  const res = await request("/api/store", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ store: storeFor(key), key, value }),
  });
  if (!res.ok) throw new Error(`Could not save "${key}" (${res.status})`);
  return true;
}

/**
 * Read-modify-write for list keys. Re-reads immediately before writing so a
 * stale in-memory copy can never truncate the stored list. Use this for
 * clips-seen and published-shorts specifically.
 */
export async function appendUnique(key, items, cap = 600) {
  const current = await readKey(key, []);          // throws rather than blanking
  const list = Array.isArray(current) ? current : [];
  const merged = [...new Set([...list, ...items])].slice(-cap);
  await writeKey(key, merged);
  return merged;
}

/* ----------------------------------------------------------------- job --- */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Fire-and-poll. Every model call goes through this — nothing calls a model
 * directly from the client. Timings match the original exactly: four-minute
 * deadline, 1.5s initial wait, backoff factor 1.25, capped at 5s.
 */
export async function runJob(payload, { onWait, signal } = {}) {
  const jobId = crypto.randomUUID();

  const res = await request("/api/claude-background", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...payload, jobId }),
  });
  if (!res.ok && res.status !== 202) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || `Could not start (${res.status})`);
  }

  const deadline = Date.now() + 240_000;
  let wait = 1500;

  while (Date.now() < deadline) {
    if (signal?.aborted) throw new Error("Cancelled");
    await sleep(wait);
    wait = Math.min(wait * 1.25, 5000);

    const poll = await request(`/api/job?id=${jobId}`);
    if (!poll.ok) continue;                       // transient; keep polling

    const body = await poll.json().catch(() => ({}));
    if (body.status === "done") return body;      // → body.text
    if (body.status === "error") throw new Error(body.error || "The job failed.");
    onWait?.(body.status || "pending");
  }
  throw new Error("Timed out after four minutes. The wire is slow today, try again.");
}

/** The ten operations the background function accepts. */
export const OPS = [
  "sweep", "wire", "clips", "desk", "essay",
  "rewrite", "generate", "reading", "commitments", "correspondent",
];

/* ------------------------------------------------------------ endpoints --- */

const getJSON = async (url, fallback) => {
  const res = await request(url);
  if (!res.ok) return fallback;
  return res.json().catch(() => fallback);
};

const postJSON = async (url, body) => {
  const res = await request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
};

export const getAgenda   = () => getJSON("/api/agenda", null);
export const getCast     = () => getJSON("/api/cast", { cast: [], series: [] });
export const getFeed     = (url) => getJSON(`/api/feed?url=${encodeURIComponent(url)}`, null);
export const searchGifs  = (q) => getJSON(`/api/gif-search?q=${encodeURIComponent(q)}`, null);

export const createDoc     = (title, body) => postJSON("/api/doc-create", { title, body });
export const publishWire   = (stories) => postJSON("/api/publish-wire", { stories });
export const publishEssay  = (essay) => postJSON("/api/publish-essay", essay);
export const publishClip   = (payload) => postJSON("/api/opus-publish", payload);
export const sendEmail     = (payload) => postJSON("/api/send-email", payload);

export const startOAuth = (service) => { window.location.href = `/api/oauth-start?service=${service}`; };

/* ------------------------------------------------------------- keys ------ */

const pad = (n) => String(n).padStart(2, "0");
/** Local time, zero-padded. Must match the original exactly or days orphan. */
export const dayStamp = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const KEYS = {
  day: (d) => `day:${d}`,
  hist: "history",
  ledger: "ledger",
  threads: "threads",
  vault: "vault:entries",
  signals: "signals",
  marketing: "marketing-months",
  commitments: "commitments",
  episodes: "episodes",
  packs: "episode-packs",
  videos: "correspondent-videos",
  feeds: "show-feeds",
  sources: "sources",
  reading: "reading-list",
  calendar: "content-calendar",
  shorts: (d) => `shorts:${d}`,
  seenClips: "clips-seen",
  deskChat: (d) => `desk-chat:${d}`,
  published: "published-shorts",
  guests: "guests",
  assets: "sponsor-assets",
  essay: (slug) => `essay:${slug || "untitled"}`,
};
