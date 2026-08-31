import { getStore } from "@netlify/blobs";
import { createHash, randomUUID } from "node:crypto";

const STRIP_PARAMS = [
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "fbclid", "gclid", "mc_cid", "mc_eid", "ref", "source", "_hsenc", "igshid"
];

function normaliseUrl(raw) {
  const u = new URL(raw);
  u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
  u.protocol = "https:";
  for (const p of STRIP_PARAMS) u.searchParams.delete(p);
  if (!u.hash.startsWith("#/")) u.hash = "";
  u.pathname = u.pathname.replace(/\/+$/, "") || "/";
  return u.toString();
}

const clipKey = (normalised) =>
  "clip_" + createHash("sha1").update(normalised).digest("hex").slice(0, 16);

function slugifyAll(threads) {
  if (!Array.isArray(threads)) return [];
  return [...new Set(threads
    .map(t => String(t).toLowerCase().trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-"))
    .filter(Boolean))];
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" }
  });
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const auth = req.headers.get("authorization") || "";
  if (!process.env.CAPTURE_TOKEN || auth !== `Bearer ${process.env.CAPTURE_TOKEN}`) {
    return json({ error: "unauthorized" }, 401);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const type = body.type === "note" ? "note" : "clip";
  if (type === "clip" && !body.url) {
    return json({ error: "url_required_for_clip" }, 400);
  }

  const store = getStore({
    name: process.env.CAPTURE_STORE || "captures",
    consistency: "strong"
  });
  const now = new Date().toISOString();

  // --- notes: always new, no dedupe ---
  if (type === "note") {
    const id = "note_" + randomUUID().replace(/-/g, "").slice(0, 16);
    await store.setJSON(id, {
      id,
      type: "note",
      title: (body.note || "").split("\n")[0].slice(0, 80) || "Untitled note",
      note: body.note || null,
      note_source: body.note_source || "typed",
      threads: slugifyAll(body.threads),
      status: "parked",
      source: body.source || "unknown",
      captured_at: body.captured_at || now,
      received_at: now
    });
    return json({ id, type: "note", status: "parked" }, 201);
  }

  // --- clips: dedupe on normalised url ---
  let normalised;
  try {
    normalised = normaliseUrl(body.url);
  } catch {
    return json({ error: "invalid_url" }, 400);
  }

  const id = clipKey(normalised);
  const existing = await store.get(id, { type: "json" });

  if (existing) {
    // upgrade a placeholder title if a real one arrives later
    if (body.title && (!existing.title || existing.title === existing.url_normalised)) {
      existing.title = body.title;
    }
    // backfill selection if the first capture didn't carry one
    if (body.selection && !existing.selection) {
      existing.selection = String(body.selection).slice(0, 2000);
    }
    // append the note, but don't repeat text already recorded
    if (body.note && !(existing.note || "").includes(body.note)) {
      existing.note = [existing.note, `[${now.slice(0, 10)}] ${body.note}`]
        .filter(Boolean).join("\n");
    }
    existing.threads = [...new Set([
      ...(existing.threads || []),
      ...slugifyAll(body.threads)
    ])];
    existing.seen_count = (existing.seen_count || 1) + 1;
    existing.last_seen = now;
    await store.setJSON(id, existing);
    return json({
      id, type: "clip", status: existing.status,
      duplicate: true, seen_count: existing.seen_count
    }, 200);
  }

  await store.setJSON(id, {
    id,
    type: "clip",
    url: body.url,
    url_normalised: normalised,
    title: body.title || normalised,
    selection: body.selection ? String(body.selection).slice(0, 2000) : null,
    note: body.note ? `[${now.slice(0, 10)}] ${body.note}` : null,
    note_source: body.note_source || "typed",
    threads: slugifyAll(body.threads),
    status: "parked",
    summary: null,
    source: body.source || "unknown",
    seen_count: 1,
    captured_at: body.captured_at || now,
    received_at: now,
    last_seen: now
  });

  return json({ id, type: "clip", status: "parked", duplicate: false }, 201);
};

export const config = { path: "/api/capture" };
