import { requireAuth, json } from "./_auth.js";
import { CLIENT_STORES, readJSON, writeJSON } from "./_blobs.js";
import { enrichGuests } from './_guest-pass.js';

const KEY_OK = /^[A-Za-z0-9:_-]{1,180}$/;

export default async (req) => {
  const denied = requireAuth(req);
  if (denied) return denied;

  const url = new URL(req.url);

  if (req.method === "GET") {
    const s = url.searchParams.get("store");
    const key = url.searchParams.get("key");
    if (!CLIENT_STORES.includes(s) || !KEY_OK.test(key || "")) return json({ error: "Bad request" }, 400);
    const value=await readJSON(s,key,null);
    if(s==='cockpit'&&key==='guests') {
      try{return json({value:await enrichGuests(value || [])});}
      catch{return json({error:'Guest preparation status could not be read'},503);}
    }
    return json({value});
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
    // Guest passwords and capability links stay in the private backstage store.
    const cleanValue=s==='cockpit'&&key==='guests'&&Array.isArray(value)?value.map(({backstage,...g})=>g):value;
    await writeJSON(s, key, cleanValue);
    return json({ ok: true });
  }

  return json({ error: "Method not allowed" }, 405);
};
