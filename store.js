import { requireAuth, json } from "./_auth.js";
import { CLIENT_STORES, readJSON, writeJSON } from "./_blobs.js";

const KEY_OK = /^[A-Za-z0-9:_-]{1,180}$/;

export default async (req) => {
  const denied = requireAuth(req);
  if (denied) return denied;

  const url = new URL(req.url);

  if (req.method === "GET") {
    const s = url.searchParams.get("store");
    const key = url.searchParams.get("key");
    if (!CLIENT_STORES.includes(s) || !KEY_OK.test(key || "")) return json({ error: "Bad request" }, 400);
    return json({ value: await readJSON(s, key, null) });
  }

  if (req.method === "POST") {
    let body;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Bad request" }, 400);
    }
    const { store: s, key, value } = body;
    if (!CLIENT_STORES.includes(s) || !KEY_OK.test(key || "")) return json({ error: "Bad request" }, 400);
    if (JSON.stringify(value ?? null).length > 4000000) return json({ error: "Too large" }, 413);
    await writeJSON(s, key, value);
    return json({ ok: true });
  }

  return json({ error: "Method not allowed" }, 405);
};
