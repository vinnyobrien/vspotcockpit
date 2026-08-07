# The Cockpit — API contract

Reverse-engineered from the deployed bundle at `vspot-cockpit-vco.netlify.app`
(`assets/index-CWLWXzEq.js`, production deploy `6a74f8f985cbbef379b6f092`).

**Purpose:** the new front end is written against this document. Every one of the
37 deployed functions stays exactly where it is, untouched. Nothing here is
invented — each entry was read out of the shipped bundle.

**Status key:** ✅ confirmed from a call site · ⚠️ endpoint exists, payload unverified

---

## 1. Transport layer

Three primitives wrap everything. Reproduce them exactly.

### `Dt(url, opts)` — authenticated fetch

```js
async function request(url, opts) {
  const res = await fetch(url, { credentials: "same-origin", ...opts });
  if (res.status === 401) { onAuthFail(); throw new Error("Not authenticated"); }
  return res;
}
```

Auth is a **same-origin session cookie**, set by `/api/login`. There is no bearer
token in the client. Any 401 anywhere must trigger the login screen — the
original registers a global handler for this.

### `Ve(key, fallback)` / `Ie(key, value)` — Blob read/write

```js
const storeFor = (key) => key.startsWith("vault") ? "vault" : "cockpit";

async function get(key, fallback) {
  try {
    const res = await request(`/api/store?store=${storeFor(key)}&key=${encodeURIComponent(key)}`);
    if (!res.ok) return fallback;
    const { value } = await res.json();
    return value ?? fallback;
  } catch { return fallback; }
}

async function set(key, value) {
  try {
    const res = await request("/api/store", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ store: storeFor(key), key, value }),
    });
    return res.ok;
  } catch { return false; }
}
```

Note both swallow errors and return a fallback / `false`. **This is almost
certainly why `clips-seen` is stuck at 79 bytes** — a failed read returns the
default silently, and the next write persists only that session's six IDs. When
rebuilding, keep the same signature but surface failures rather than swallowing
them.

Two Blob stores exist: `vault` (keys beginning `vault`) and `cockpit`
(everything else).

### `Mt(payload, { onWait })` — long-running job

Fire-and-poll. Used for every model call.

```js
async function job(payload, { onWait } = {}) {
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
  const deadline = Date.now() + 240_000;   // four minutes
  let wait = 1500;                          // backoff 1.5s → 5s, factor 1.25
  while (Date.now() < deadline) {
    await sleep(wait);
    wait = Math.min(wait * 1.25, 5000);
    const poll = await request(`/api/job?id=${jobId}`);
    if (!poll.ok) continue;
    const body = await poll.json().catch(() => ({}));
    if (body.status === "done") return body;          // → body.text
    if (body.status === "error") throw new Error(body.error || "The job failed.");
    onWait?.(body.status || "pending");
  }
  throw new Error("Timed out after four minutes.");
}
```

`jobId` is client-generated. The job returns `{ status, text, error? }`; results
come back on `.text` and are parsed downstream.

---

## 2. Endpoints

| Endpoint | Method | Payload | |
|---|---|---|---|
| `/api/login` | POST | `{ password }` | ✅ |
| `/api/store` | GET | `?store={cockpit\|vault}&key={key}` → `{ value }` | ✅ |
| `/api/store` | POST | `{ store, key, value }` | ✅ |
| `/api/claude-background` | POST | `{ op, jobId, ...opArgs }` → 200/202 | ✅ |
| `/api/job` | GET | `?id={jobId}` → `{ status, text, error }` | ✅ |
| `/api/agenda` | GET | — | ✅ |
| `/api/cast` | GET | — → `{ cast: [], series: [] }` | ✅ |
| `/api/feed` | GET | `?url={encoded}` | ✅ |
| `/api/gif-search` | GET | `?q={encoded}` | ✅ |
| `/api/doc-create` | POST | `{ title, body }` | ✅ |
| `/api/publish-wire` | POST | `{ stories }` → `{ committed }` | ✅ |
| `/api/publish-essay` | POST | essay object | ✅ |
| `/api/opus-publish` | POST | clip + platform object | ✅ |
| `/api/send-email` | POST | email object → `{ error? }` | ✅ |
| `/api/oauth-start` | GET | `?service=youtube` | ✅ |
| `/api/oauth-callback` | GET | OAuth redirect target | ⚠️ |
| `/api/diag` | — | diagnostics | ⚠️ |
| `/api/opus-test`, `/api/repo-*` | — | not called from the client | ⚠️ |

Underscore-prefixed functions (`_auth`, `_blobs`, `_opus`, `_google`, `_github`,
`_slack`, `_fireflies`, `_rss`, `_key`, `_prompts`, `_contracts`,
`_correspondents`, `_wire-page`, `_workspace`) are internal helpers imported by
the others, not HTTP routes. The front end never calls them.

---

## 3. `claude-background` operations

Ten `op` values, all via `Mt()`:

| `op` | Extra fields | Purpose |
|---|---|---|
| `sweep` | — | Morning news sweep |
| `wire` | — | Build the wire from the sweep |
| `clips` | `extra` (count, as **string**), `exclude` (array of clipIds) | Propose shorts |
| `desk` | `extra` (headline digest), `history`, `archive` | Editorial chat |
| `essay` | thread state | Essay workshop |
| `rewrite` | — | Rework a passage |
| `generate` | — | Generic generation |
| `reading` | — | Reading list |
| `commitments` | — | Commitments tracking |
| `correspondent` | — | Correspondent video scripting |

`clips` is the one being changed: `extra` is currently hardcoded `"6"`, and
`exclude` is passed to the model as a prompt hint rather than applied as a
filter. Both fixes live in `clip-selector.js`.

---

## 4. Blob keys

Read/written via `/api/store`. Verified against the live Blobs browser.

**Static keys**
`history` · `ledger` · `threads` · `vault:entries` · `signals` ·
`marketing-months` · `commitments` · `episodes` · `episode-packs` ·
`correspondent-videos` · `show-feeds` · `sources` · `reading-list` ·
`content-calendar` · `clips-seen` · `published-shorts` · `guests` ·
`sponsor-assets`

**Templated keys**
- `day:${YYYY-MM-DD}` — per-day state (dates zero-padded, local time)
- `shorts:${YYYY-MM-DD}` — that day's proposed clips
- `desk-chat:${YYYY-MM-DD}` — desk conversation
- `essay:${slug}` — defaults to `essay:untitled`

Also present live but not in the client key map: `commit-swept:${date}`,
written server-side.

**Retention:** `clips-seen` is capped client-side at the last 600 IDs.

---

## 5. Rebuild rules

1. **Never write to a Blob key that isn't in section 4.** The store holds live
   working data; an unrecognised key is a bug, not a feature.
2. **Match date formatting exactly** — `YYYY-MM-DD`, zero-padded, local time. A
   mismatch silently orphans a day's work rather than erroring.
3. **Every model call goes through the job poller.** No direct model calls from
   the client.
4. **Treat 401 as global.** Any request can return it; all must route to login.
5. **Read before write on every Blob key**, so a failed read can't blank
   existing data. This is the `clips-seen` failure mode.

---

## 6. Known gaps

- Payload shapes for `publish-essay`, `opus-publish` and `send-email` are passed
  as pre-built objects; the fields need confirming against a live call before
  those screens are rebuilt.
- `/api/agenda` and `/api/cast` response shapes are partly inferred. `cast`
  falls back to `{ cast: [], series: [] }` on failure, so that shape is solid.
- No scheduled functions exist (`function_schedules: []`). The tweet schedule
  needs new ones when we return to it.
