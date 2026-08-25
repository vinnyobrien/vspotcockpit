import { getStore } from '@netlify/blobs';

export const config = { path: '/api/metricool/*' };

/* ------------------------------------------------------------------ *
 * The V Spot Network - Metricool ingest
 *
 * Metricool authenticates with X-Mc-Auth as a custom header, NOT as a
 * bearer token. Bearer returns 401 and reads like a bad credential.
 * userId and blogId go on the query string, on every single call.
 *
 * Their analytics endpoints are not fully documented - Metricool's own
 * help pages tell you to find them by inspecting the browser. So this
 * ships with /verify and /discover first: confirm the credentials, find
 * the real paths, then wire /sync against paths we know exist rather
 * than paths I guessed at.
 * ------------------------------------------------------------------ */

const BASE = 'https://app.metricool.com/api';
const BLOG_ID = '6759442';
const TZ = 'Europe/Dublin';

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

/** Every Metricool call, in one place. Token never leaves the server. */
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
  try { body = JSON.parse(text); } catch { body = text.slice(0, 400); }
  return { status: res.status, ok: res.ok, body, path: url.pathname + url.search.replace(/userId=[^&]+/, 'userId=***') };
}

function isoDaysAgo(n) {
  const d = new Date(Date.now() - n * 864e5);
  return d.toISOString().slice(0, 19);
}

/* Candidates drawn from Metricool's own CLI surface and the metric code
   families the hosted tools expose (YTVV, TKPO, LIEV and so on). Anything
   that answers 200 is a real path; the rest get discarded, not guessed at. */
const CANDIDATES = [
  'v2/analytics/posts/youtube',
  'v2/analytics/posts/tiktok',
  'v2/analytics/posts/linkedin',
  'v2/analytics/posts/twitter',
  'v2/analytics/timelines/youtube',
  'v2/analytics/timelines/tiktok',
  'v2/analytics/timelines/linkedin',
  'analytics/posts/youtube',
  'analytics/timeline/youtube',
  'stats/youtube/posts',
  'stats/youtube/timeline'
];

export default async (req) => {
  const url = new URL(req.url);
  const seg = url.pathname.replace(/^\/api\/metricool\/?/, '').split('/').filter(Boolean);
  const route = seg[0] ?? '';

  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (!authorised(req)) return bad('unauthorised', 401);

  try {
    /* GET /verify - are the credentials real, and which brands can they see? */
    if (route === 'verify') {
      const r = await mc('admin/simpleProfiles');
      if (!r.ok) {
        return json({
          ok: false,
          status: r.status,
          hint: r.status === 401
            ? 'Token rejected. Check it is the userToken from Account Settings > API, and that the plan is Advanced or Custom.'
            : 'Metricool refused the call. The body below is theirs, not ours.',
          body: r.body
        }, 200);
      }
      const brands = Array.isArray(r.body)
        ? r.body.map((b) => ({ blogId: b.id ?? b.blogId, label: b.label ?? b.title, timezone: b.timezone }))
        : r.body;
      return json({ ok: true, credentials: 'valid', expecting: BLOG_ID, brands });
    }

    /* GET /discover - which analytics paths actually answer? */
    if (route === 'discover') {
      const from = url.searchParams.get('from') ?? isoDaysAgo(30);
      const to = url.searchParams.get('to') ?? isoDaysAgo(0);
      const found = [];
      for (const p of CANDIDATES) {
        const r = await mc(p, { start: from, end: to, from, to, timezone: TZ });
        found.push({
          path: p,
          status: r.status,
          live: r.ok,
          shape: r.ok ? (Array.isArray(r.body) ? `array[${r.body.length}]` : Object.keys(r.body || {}).slice(0, 8)) : undefined,
          sample: r.ok ? JSON.stringify(r.body).slice(0, 300) : undefined
        });
      }
      return json({
        ok: true,
        live: found.filter((f) => f.live).map((f) => f.path),
        results: found,
        next: 'Paste the live paths back and /sync gets wired against them.'
      });
    }

    /* GET /raw?path=... - authenticated passthrough, for anything discovery
       missed. Lets you test a path found in the browser network tab without
       ever holding the token yourself. */
    if (route === 'raw') {
      const path = url.searchParams.get('path');
      if (!path) return bad('pass ?path=, e.g. ?path=v2/analytics/posts/youtube&from=...&to=...');
      const params = Object.fromEntries(url.searchParams);
      delete params.path;
      const r = await mc(path, params);
      return json({ ok: r.ok, status: r.status, requested: r.path, body: r.body });
    }

    /* GET /cached - whatever the last sync stored, for the Cockpit to read. */
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

    return bad(`unknown route "${route}". Try verify, discover, raw, cached.`, 404);
  } catch (err) {
    return bad(err.message, 500);
  }
};
