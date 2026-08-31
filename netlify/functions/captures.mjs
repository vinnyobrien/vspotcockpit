import { getStore } from "@netlify/blobs";

export default async (req) => {
  const auth = req.headers.get("authorization") || "";
  if (!process.env.CAPTURE_TOKEN || auth !== `Bearer ${process.env.CAPTURE_TOKEN}`) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" }
    });
  }

  const params     = new URL(req.url).searchParams;
  const wantStatus = params.get("status");
  const wantThread = params.get("thread");
  const wantType   = params.get("type");
  const limit      = Math.min(parseInt(params.get("limit") || "100", 10), 500);

  const store = getStore({
    name: process.env.CAPTURE_STORE || "captures",
    consistency: "strong"
  });
  const { blobs } = await store.list();

  const records = await Promise.all(
    blobs.map(b => store.get(b.key, { type: "json" }).catch(() => null))
  );

  const filtered = records
    .filter(Boolean)
    .filter(r => !wantStatus || r.status === wantStatus)
    .filter(r => !wantType   || r.type === wantType)
    .filter(r => !wantThread || (r.threads || []).includes(wantThread))
    .sort((a, b) => (b.captured_at || "").localeCompare(a.captured_at || ""))
    .slice(0, limit);

  const threads = {};
  for (const r of filtered) for (const t of r.threads || []) threads[t] = (threads[t] || 0) + 1;

  return new Response(JSON.stringify({
    count: filtered.length,
    threads,
    captures: filtered
  }, null, 2), {
    headers: { "content-type": "application/json" }
  });
};

export const config = { path: "/api/captures" };
