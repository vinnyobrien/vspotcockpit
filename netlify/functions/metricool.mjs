import { getStore } from '@netlify/blobs';

export const config = { path: '/api/metricool/*' };

/* ------------------------------------------------------------------ *
 * The V Spot Network - Metricool ingest
 *
 * X-Mc-Auth as a custom header, NOT a bearer token. userId and blogId
 * on the query string, every call.
 *
 * Round one confirmed four live paths, all v2/analytics/posts/<network>.
 * Every timelines candidate 404'd, so follower and subscriber evolution
 * lives elsewhere - round two hunts for it. /shape returns whole records
 * so the sync can be written against real field names rather than
 * plausible ones.
 * ------------------------------------------------------------------ */

const BASE = 'https://app.metricool.com/api';
const BLOG_ID = '6759442';
const TZ = 'Europe/Dublin';

const LIVE = {
  youtube: 'v2/analytics/posts/youtube',
  tiktok: 'v2/analytics/posts/tiktok',
  linkedin: 'v2/analytics/posts/linkedin',
  twitter: 'v2/analytics/posts/twitter'
};

const metrics = () => getStore({ name: 'vspot-metrics', consistency: 'strong' });

const json = (body, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
  });

const bad = (msg, status = 400) => json({ ok: false, error: msg }, status);

function authorised(req) {
  const token = process.env.COCKPIT_TOKEN;
  if (!token) return true;
  return (req.headers.get('authorization') || '') === `Bearer ${token}`;
}

async function mc(path, params = {}) {
  const token = process.env.METRICOOL_TOKEN;
  const userId = process.env.METRICOOL_USER_ID;
  if (!token || !userId) throw new Error('METRICOOL_TOKEN or METRICOOL_USER_ID is not set on this site');

  const url = new URL(`${BASE}/${path.replace(/^\//, '')}`);
  url.searchParams.set('userId', userId);
  if (!('blogId' in params)) url.searchParams.set('blogId', BLOG_ID);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }

  const res = await fetch(url, { headers: { 'X-Mc-Auth': token, accept: 'application/json' } });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text.slice(0, 300); }
  return { status: res.status, ok: res.ok, body };
}

const isoDaysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 19);

const window90 = () => ({ from: isoDaysAgo(90), to: isoDaysAgo(-1) });

/* Round two. The CLI surface suggests metric is a query parameter rather
   than a path segment, so most of these carry the network as a param and
   leave the path generic. */
const TIMELINE_CANDIDATES = [
  ['v2/analytics/timelines', { network: 'youtube', metric: 'followers' }],
  ['v2/analytics/timelines', { provider: 'youtube', metric: 'followers' }],
  ['v2/analytics/timeline', { network: 'youtube', metric: 'followers' }],
  ['v2/analytics/timelines/followers', { network: 'youtube' }],
  ['v2/analytics/evolution', { network: 'youtube' }],
  ['v2/analytics/evolution/youtube', {}],
  ['v2/analytics/aggregations', { network: 'youtube', metric: 'followers' }],
  ['v2/analytics/distributions', { network: 'youtube', metric: 'followers' }],
  ['v2/analytics/metrics', { network: 'youtube' }],
  ['v2/stats/timelines', { network: 'youtube', metric: 'followers' }],
  ['v2/analytics/summary', { network: 'youtube' }],
  /* worth knowing about for later, and free to test now */
  ['v2/analytics/posts/instagram', {}],
  ['v2/analytics/reels/instagram', {}],
  ['v2/analytics/posts/facebook', {}],
  ['v2/analytics/competitors/youtube', {}]
];

export default async (req) => {
  const url = new URL(req.url);
  const seg = url.pathname.replace(/^\/api\/metricool\/?/, '').split('/').filter(Boolean);
  const route = seg[0] ?? '';

  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (!authorised(req)) return bad('unauthorised', 401);

  try {
    /* GET /verify */
    if (route === 'verify') {
      const r = await mc('admin/simpleProfiles');
      if (!r.ok) return json({ ok: false, status: r.status, body: r.body });
      const brands = Array.isArray(r.body)
        ? r.body.map((b) => ({ blogId: b.id ?? b.blogId, label: b.label ?? b.title, timezone: b.timezone }))
        : r.body;
      return json({ ok: true, credentials: 'valid', expecting: BLOG_ID, brands });
    }

    /* GET /shape - one WHOLE record per network, untruncated, so the sync
       can be written against real field names. This is the call that ends
       the guessing. */
    if (route === 'shape') {
      const { from, to } = window90();
      const out = {};
      for (const [network, path] of Object.entries(LIVE)) {
        const r = await mc(path, { start: from, end: to, from, to, timezone: TZ });
        const rows = r.body?.data ?? r.body;
        const first = Array.isArray(rows) ? rows[0] : null;
        out[network] = {
          status: r.status,
          count: Array.isArray(rows) ? rows.length : 0,
          fields: first ? Object.keys(first) : [],
          firstRecord: first ?? null
        };
      }
      return json({ ok: true, window: { from, to }, networks: out });
    }

    /* GET /discover2 - hunt for follower and subscriber evolution. */
    if (route === 'discover2') {
      const { from, to } = window90();
      const found = [];
      for (const [path, extra] of TIMELINE_CANDIDATES) {
        const r = await mc(path, { start: from, end: to, from, to, timezone: TZ, ...extra });
        found.push({
          path,
          params: extra,
          status: r.status,
          live: r.ok,
          shape: r.ok ? (Array.isArray(r.body) ? `array[${r.body.length}]` : Object.keys(r.body || {}).slice(0, 8)) : undefined,
          sample: r.ok ? JSON.stringify(r.body).slice(0, 400) : undefined
        });
      }
      return json({ ok: true, live: found.filter((f) => f.live), tried: found.length, results: found });
    }

    /* GET /raw?path=... - passthrough for anything discovery missed. */
    if (route === 'raw') {
      const path = url.searchParams.get('path');
      if (!path) return bad('pass ?path=');
      const params = Object.fromEntries(url.searchParams);
      delete params.path;
      const r = await mc(path, params);
      return json({ ok: r.ok, status: r.status, body: r.body });
    }

    /* GET /cached */
    if (route === 'cached') {
      const store = metrics();
      const { blobs } = await store.list({ prefix: 'sync/' });
      const out = [];
      for (const b of blobs) {
        const rec = await store.get(b.key, { type: 'json' });
        if (rec) out.push(rec);
      }
      out.sort((a, b) => (b.pulledAt || '').localeCompare(a.pulledAt || ''));
      return json({ ok: true, count: out.length, syncs: out.slice(0, 5) });
    }

    return bad(`unknown route "${route}". Try verify, shape, discover2, raw, cached.`, 404);
  } catch (err) {
    return bad(err.message, 500);
  }
};
