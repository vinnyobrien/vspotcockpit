import { json } from "./_auth.js";
import { readJSON, writeJSON } from "./_blobs.js";
import { record } from "./_ledger.js";

/**
 * POST /api/inbox  → drops a note into the Cockpit from outside it.
 *
 * Deliberately NOT behind the session cookie, because the whole point is that
 * a chat, a shortcut or a script can reach it. Instead it takes a token, and
 * the blast radius is kept small by what it is allowed to do:
 *
 *   · append only — it cannot read, edit or delete anything
 *   · one key — `inbox`, nothing else in the store is reachable
 *   · no side effects — no email, no publishing, no model calls
 *
 * Worst case with a leaked token is somebody putting rubbish in your inbox,
 * which you then delete. That is the correct trade for a single-user app.
 *
 * Env: COCKPIT_INBOX_KEY — a long random string. Not the site password, and
 * not SESSION_SECRET. Generate with: openssl rand -hex 24
 */

const KEY = "inbox";
const MAX = 200;
const WINDOW = 60_000;
const PER_WINDOW = 20;

const env = (k) => (process.env[k] || "").trim().replace(/^["']|["']$/g, "");

/** Constant time, so a wrong token leaks nothing through timing. */
function safeEqual(a = "", b = "") {
  const A = Buffer.from(String(a));
  const B = Buffer.from(String(b));
  if (A.length !== B.length) return false;
  let out = 0;
  for (let i = 0; i < A.length; i++) out |= A[i] ^ B[i];
  return out === 0;
}

export default async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const expected = env("COCKPIT_INBOX_KEY");
  if (!expected || expected.length < 24) {
    return json({ error: "COCKPIT_INBOX_KEY is not set, or is too short to be safe." }, 500);
  }

  const given = req.headers.get("x-cockpit-key") || "";
  if (!safeEqual(given, expected)) return json({ error: "No" }, 401);

  let b;
  try { b = await req.json(); } catch { return json({ error: "Bad request" }, 400); }

  const title = String(b.title || "").trim().slice(0, 200);
  const body = String(b.body || "").trim().slice(0, 20000);
  if (!title && !body) return json({ error: "Nothing to add." }, 400);

  // Cheap rate limit against the same blob, so a loose token cannot fill the store.
  const now = Date.now();
  const existing = (await readJSON("cockpit", KEY, [])) || [];
  const recent = existing.filter((x) => now - new Date(x.at).getTime() < WINDOW);
  if (recent.length >= PER_WINDOW) return json({ error: "Slow down." }, 429);

  const item = {
    id: Math.random().toString(36).slice(2),
    at: new Date().toISOString(),
    title: title || body.slice(0, 80),
    body: title ? body : "",
    // Where it belongs, if the sender knows. Today shows it either way.
    room: ["desk", "video", "essay", "guests", "growth", "shows", "build", "cast", "week", "sub"]
      .includes(b.room) ? b.room : null,
    from: String(b.from || "chat").slice(0, 40),
    tag: String(b.tag || "").slice(0, 40),
    seen: false,
  };

  await writeJSON("cockpit", KEY, [item, ...existing].slice(0, MAX));
  await record("inbox.received", { title: item.title, from: item.from, room: item.room });

  return json({ ok: true, id: item.id, note: "It will show on Today." });
};
