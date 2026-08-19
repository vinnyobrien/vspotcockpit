import { requireAuth, json } from "./_auth.js";
import { store, readJSON, writeJSON } from "./_blobs.js";

const STORE = "cockpit";
const PREFIX = "clip:";
const USES = ["digest", "substack", "ostrich", "nearly", "watson", "reference"];
const KEY_OK = /^[A-Za-z0-9:_-]{1,180}$/;

function newId(d = new Date()) {
  const ts = d.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  return ts + "-" + Math.random().toString(36).slice(2, 6);
}
function hostOf(u) {
  try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; }
}

export default async (req) => {
  const denied = requireAuth(req);
  if (denied) return denied;

  const url = new URL(req.url);

  if (req.method === "GET") {
    const p = url.searchParams;
    const { blobs } = await store(STORE).list({ prefix: PREFIX });
    const keys = blobs.map((b) => b.key).sort().reverse()
      .slice(0, Math.min(Number(p.get("limit")) || 200, 500));
    const wantThread = p.get("thread");
    const wantUse = p.get("use");
    const unusedOnly = p.get("unused") === "1";
    const clips = [];
    for (const k of keys) {
      const c = await readJSON(STORE, k, null);
      if (!c) continue;
      if (wantThread && c.thread !== wantThread) continue;
      if (wantUse && c.use !== wantUse) continue;
      if (unusedOnly && c.usedAt) continue;
      clips.push(c);
    }
    return json({ clips, total: blobs.length });
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }

  if (body.op === "spend") {
    const key = PREFIX + String(body.id || "");
    if (!KEY_OK.test(key)) return json({ error: "Bad request" }, 400);
    const c = await readJSON(STORE, key, null);
    if (!c) return json({ error: "No clip with that id" }, 404);
    c.usedAt = new Date().toISOString();
    c.usedIn = String(body.usedIn || "").slice(0, 200) || c.use;
    await writeJSON(STORE, key, c);
    return json({ clip: c });
  }

  const link = String(body.url || "").trim();
  const why = String(body.why || "").trim();
  if (!/^https?:\/\//i.test(link)) {
    return json({ error: "A clip needs a valid http or https address." }, 400);
  }
  if (why.length < 3) {
    return json({ error: "A clip needs a reason. One line on what it argues, or what it breaks." }, 400);
  }

  const rec = {
    id: newId(),
    url: link,
    host: hostOf(link),
    title: String(body.title || "").slice(0, 300),
    quote: String(body.quote || "").slice(0, 600),
    why: why.slice(0, 400),
    use: USES.includes(body.use) ? body.use : "reference",
    thread: String(body.thread || "").trim().slice(0, 80) || "unfiled",
    createdAt: new Date().toISOString(),
    usedAt: null,
    usedIn: null
  };

  const key = PREFIX + rec.id;
  if (!KEY_OK.test(key)) return json({ error: "Bad request" }, 400);
  await writeJSON(STORE, key, rec);
  return json({ clip: rec }, 201);
};
