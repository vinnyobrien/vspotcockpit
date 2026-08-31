import { getStore } from '@netlify/blobs';
import { requireAuth } from './_auth.js';

export const config = { path: ['/api/captures', '/api/captures/*'] };

/* ------------------------------------------------------------------ *
 * Clip Desk — read and edit side of the capture store.
 *
 * Writes come in via /api/capture (phone Shortcut, bookmarklet).
 * This file is what the room reads, and how a clip moves through
 * parked -> reading -> used | dropped.
 *
 * Two ways in, matching media.mjs: the browser is already logged in
 * with the session cookie, so the room needs no token pasted into it.
 * The bearer stays for the Shortcut and any Cowork skill calling from
 * outside a browser.
 * ------------------------------------------------------------------ */

const store = () => getStore({
  name: process.env.CAPTURE_STORE || 'captures',
  consistency: 'strong'
});

const json = (body, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
  });

const bad = (msg, status = 400) => json({ ok: false, error: msg }, status);

function authorised(req) {
  const token = process.env.CAPTURE_TOKEN;
  if (token && (req.headers.get('authorization') || '') === `Bearer ${token}`) return true;
  return requireAuth(req) === null;
}

const STATES = ['parked', 'reading', 'used', 'dropped'];

function slugifyAll(threads) {
  if (!Array.isArray(threads)) return [];
  return [...new Set(threads
    .map(t => String(t).toLowerCase().trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-'))
    .filter(Boolean))];
}

export default async (req) => {
  const url = new URL(req.url);
  const id = url.pathname.replace(/^\/api\/captures\/?/, '').split('/').filter(Boolean)[0] ?? '';

  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (!authorised(req)) return bad('unauthorised', 401);

  const s = store();

  try {
    /* GET /api/captures — the desk view.
       Filters: status, thread, type, q, limit. */
    if (!id && req.method === 'GET') {
      const p          = url.searchParams;
      const wantStatus = p.get('status');
      const wantThread = p.get('thread');
      const wantType   = p.get('type');
      const q          = (p.get('q') || '').toLowerCase().trim();
      const limit      = Math.min(parseInt(p.get('limit') || '100', 10), 500);

      const { blobs } = await s.list();
      const records = await Promise.all(
        blobs.map(b => s.get(b.key, { type: 'json' }).catch(() => null))
      );

      const all = records.filter(Boolean);

      const filtered = all
        .filter(r => !wantStatus || r.status === wantStatus)
        .filter(r => !wantType   || r.type === wantType)
        .filter(r => !wantThread || (r.threads || []).includes(wantThread))
        .filter(r => !q || `${r.title} ${r.note} ${r.url}`.toLowerCase().includes(q))
        .sort((a, b) => (b.captured_at || '').localeCompare(a.captured_at || ''))
        .slice(0, limit);

      /* Thread counts come from everything parked, not the filtered slice —
         otherwise selecting a thread makes every other thread vanish from
         the sidebar and you cannot navigate back out. */
      const threads = {};
      for (const r of all) {
        if (r.status !== 'parked') continue;
        for (const t of r.threads || []) threads[t] = (threads[t] || 0) + 1;
      }

      const counts = { parked: 0, reading: 0, used: 0, dropped: 0 };
      for (const r of all) if (counts[r.status] !== undefined) counts[r.status]++;

      return json({ ok: true, count: filtered.length, counts, threads, captures: filtered });
    }

    /* GET /api/captures/:id — one record */
    if (id && req.method === 'GET') {
      const rec = await s.get(id, { type: 'json' });
      if (!rec) return bad('not found', 404);
      return json({ ok: true, capture: rec });
    }

    /* PATCH /api/captures/:id — status, threads, note, used_in */
    if (id && req.method === 'PATCH') {
      const rec = await s.get(id, { type: 'json' });
      if (!rec) return bad('not found', 404);

      const body = await req.json();
      if (body.status && !STATES.includes(body.status)) {
        return bad(`status must be one of ${STATES.join(', ')}`);
      }

      const next = {
        ...rec,
        status:  body.status  ?? rec.status,
        note:    body.note    ?? rec.note,
        used_in: body.used_in ?? rec.used_in ?? null,
        threads: body.threads ? slugifyAll(body.threads) : rec.threads,
        updated_at: new Date().toISOString(),
        /* Stamp when it left the pile. This is the number that tells you
           whether the desk is working: captured vs actually used. */
        closed_at: body.status && body.status !== 'parked' && body.status !== 'reading'
          ? new Date().toISOString()
          : rec.closed_at ?? null
      };

      await s.setJSON(id, next);
      return json({ ok: true, capture: next });
    }

    /* DELETE /api/captures/:id — for test rows and genuine mistakes.
       Prefer status "dropped" for real decisions; a dropped clip is
       evidence about what you decline, a deleted one is nothing. */
    if (id && req.method === 'DELETE') {
      const rec = await s.get(id, { type: 'json' });
      if (!rec) return bad('not found', 404);
      await s.delete(id);
      return json({ ok: true, deleted: id });
    }

    return bad(`unsupported ${req.method} on ${url.pathname}`, 405);
  } catch (err) {
    return bad(`captures error: ${err.message}`, 500);
  }
};
