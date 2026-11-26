import { requireAuth, json } from "./_auth.js";
import { store } from "./_blobs.js";
import { dateInDublin } from "../../src/lib/editorial-calendar.js";

const clean = (value, max) => String(value ?? "").trim().slice(0, max);

export default async (req) => {
  const denied = requireAuth(req);
  if (denied) return denied;
  const db = store("cockpit");

  if (req.method === "GET") {
    const day = new URL(req.url).searchParams.get("day") || dateInDublin();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return json({ error: "A Dublin date is required." }, 400);
    try {
      const { blobs } = await db.list({ prefix: `audit/${day}/` });
      const entries = await Promise.all(blobs.map(({ key }) => db.get(key, { type: "json" })));
      return json(entries.filter(Boolean).sort((a, b) => b.at.localeCompare(a.at)));
    } catch {
      return json({ error: "The daily audit log could not be read." }, 503);
    }
  }

  if (req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
    const action = clean(body.action, 120);
    const target = clean(body.target, 240);
    if (!action || !target) return json({ error: "Action and target are required." }, 400);
    const at = new Date().toISOString();
    const day = dateInDublin(new Date(at));
    const entry = {
      id: crypto.randomUUID(), at, date: day, action, target,
      detail: clean(body.detail, 1000), source: clean(body.source, 80), actor: "Vinny",
    };
    try {
      const key = `audit/${day}/${entry.id}`;
      await db.setJSON(key, entry, { onlyIfNew: true });
      return json(entry, 201);
    } catch {
      return json({ error: "The audit entry could not be saved." }, 503);
    }
  }

  return json({ error: "Method not allowed" }, 405);
};
