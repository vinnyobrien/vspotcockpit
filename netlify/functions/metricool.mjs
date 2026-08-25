import { getStore } from '@netlify/blobs';

export const config = { path: '/api/metricool/*' };

/* ------------------------------------------------------------------ *
 * The V Spot Network - Metricool ingest
 *
 * X-Mc-Auth as a custom header, NOT a bearer. userId and blogId on the
 * query string, every call.
 *
 * Field names below are confirmed from a live /shape pull on 26 Aug,
 * not inferred. Two of them changed the design:
 *
 *   videoType        SHORT vs VIDEO, so format needs no manual tagging
 *   durationSeconds  makes RETENTION computable, which makes a 15s clip
 *                    and a 45m episode comparable for the first time
 *
 * Retention replaces raw hold seconds in the score. A clip holding 3s
 * of 15 is doing something a clip holding 3s of 60 is not, and the old
 * model could not tell them apart.
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

/* Per-network scoring. Networks do not expose the same things, so one
   model across all four would be a lie dressed as a number.

   youtube  retention 40 / reach 35 / engagement 25   - the full model
   tiktok   reach 50 / engagement 50                  - no hold data at all
   linkedin reach 40 / engagement 60                  - impressions and a rate
   twitter  not scored                                - nothing to score yet

   Cross-network comparison of these numbers is not meaningful and the
   Cockpit should never rank them against each other. */
const MODELS = {
  youtube: { retention: { weight: 40, target: 0.35 }, reach: { weight: 35, divisor: 55, cap: 4 }, engagement: { weight: 25, target: 1.5 } },
  tiktok: { reach: { weight: 50, divisor: 260, cap: 4 }, engagement: { weight: 50, target: 3 } },
  linkedin: { reach: { weight: 40, divisor: 400, cap: 4 }, engagement: { weight: 60, target: 3 } }
};

const metrics = () => getStore({ name: 'vspot-metrics', consistency: 'strong' });

const json = (b, s = 200) => new Response(JSON.stringify(b, null, 2), {
  status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
});
const bad = (m, s = 400) => json({ ok: false, error: m }, s);

function authorised(req) {
  const t = process.env.COCKPIT_TOKEN;
  if (!t) return true;
  return (req.headers.get('authorization') || '') === `Bearer ${t}`;
}

async function mc(path, params = {}) {
  const token = process.env.METRICOOL_TOKEN;
  const userId = process.env.METRICOOL_USER_ID;
  if (!token || !userId) throw new Error('METRICOOL_TOKEN or METRICOOL_USER_ID is not set');
  const url = new URL(`${BASE}/${path.replace(/^\//, '')}`);
  url.searchParams.set('userId', userId);
  if (!('blogId' in params)) url.searchParams.set('blogId', BLOG_ID);
  for (const [k, v] of Object.entries(params)) if (v != null) url.searchParams.set(k, String(v));
  const res = await fetch(url, { headers: { 'X-Mc-Auth': token, accept: 'application/json' } });
  const text = await res.text();
  let body; try { body = JSON.parse(text); } catch { body = text.slice(0, 300); }
  return { status: res.status, ok: res.ok, body };
}

const isoDaysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 19);
const win = (days = 90) => ({ from: isoDaysAgo(days), to: isoDaysAgo(-1) });
const at = (v) => (typeof v === 'object' && v?.dateTime ? v.dateTime : v) ?? null;

/* ---------------------------------------------------------- normalise --- */

function normalise(network, r) {
  if (network === 'youtube') {
    const dur = r.durationSeconds || 0;
    const hold = r.averageViewDuration || 0;
    return {
      id: r.videoId, network, title: r.title || '', url: r.watchUrl,
      publishedAt: at(r.publishedAt),
      format: r.videoType === 'SHORT' ? 'clip' : 'longform',
      views: r.views || 0, engagedViews: r.engagedViews ?? null,
      durationSeconds: dur, holdSeconds: hold,
      retention: dur > 0 ? +(hold / dur).toFixed(4) : null,
      heldSeconds: Math.round((r.views || 0) * hold),
      watchMinutes: r.watchMinutes ?? null,
      likes: r.likes || 0, comments: r.comments || 0, shares: r.shares || 0
    };
  }
  if (network === 'tiktok') {
    const src = r.impressionSources || {};
    return {
      id: r.videoId, network, title: r.videoDescription || r.title || '', url: r.shareUrl,
      publishedAt: r.createTime ?? null,
      format: 'clip',
      views: r.viewCount || 0, durationSeconds: r.duration || 0,
      holdSeconds: null, retention: null, heldSeconds: null,
      likes: r.likeCount || 0, comments: r.commentCount || 0, shares: r.shareCount || 0,
      /* Every one of these is null on a personal connection. Kept so the day
         the account moves to Business, the shape does not change. */
      sourcesAvailable: Object.values(src).some((v) => v != null)
    };
  }
  if (network === 'linkedin') {
    return {
      id: r.postId, network, title: (r.comment || '').slice(0, 120), url: r.url,
      publishedAt: at(r.created),
      format: r.type === 'TEXT' ? 'text' : (r.type || '').toLowerCase() || 'text',
      views: r.impressions || 0, uniqueImpressions: r.uniqueImpressions ?? null,
      durationSeconds: null, holdSeconds: null, retention: null, heldSeconds: null,
      likes: r.likes || 0, comments: 0, shares: 0,
      engagementRate: r.engagement != null ? +Number(r.engagement).toFixed(2) : null
    };
  }
  return { id: r.id ?? null, network, title: r.text ?? '', publishedAt: at(r.created ?? r.publishedAt), views: 0, likes: 0 };
}

/* -------------------------------------------------------------- score --- */

export function score(a) {
  const m = MODELS[a.network];
  if (!m) return null;
  const parts = {};
  let total = 0;

  if (m.retention) {
    const v = a.retention ?? 0;
    parts.retention = +(Math.min(v / m.retention.target, 1) * m.retention.weight).toFixed(1);
    total += parts.retention;
  }
  if (m.reach) {
    const v = Math.min((a.views || 0) / m.reach.divisor, m.reach.cap) / m.reach.cap;
    parts.reach = +(v * m.reach.weight).toFixed(1);
    total += parts.reach;
  }
  if (m.engagement) {
    const rate = a.engagementRate ?? (a.views > 0 ? ((a.likes + a.comments + a.shares) / a.views) * 100 : 0);
    parts.engagement = +(Math.min(rate / m.engagement.target, 1) * m.engagement.weight).toFixed(1);
    total += parts.engagement;
    parts.rate = +rate.toFixed(2);
  }

  total = Math.round(total);
  const band = total >= 70 ? 'sponsor' : total >= 40 ? 'working' : total >= 20 ? 'weak' : 'dead';
  return { total, band, parts, model: a.network };
}

/* ------------------------------------------------------------ handler --- */

export default async (req) => {
  const url = new URL(req.url);
  const seg = url.pathname.replace(/^\/api\/metricool\/?/, '').split('/').filter(Boolean);
  const route = seg[0] ?? '';
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (!authorised(req)) return bad('unauthorised', 401);

  try {
    if (route === 'verify') {
      const r = await mc('admin/simpleProfiles');
      return json({ ok: r.ok, brands: r.body });
    }

    /* GET /sync?days=90 - pull, normalise, score, store. The real one. */
    if (route === 'sync') {
      const days = Number(url.searchParams.get('days') || 90);
      const { from, to } = win(days);
      const store = metrics();
      const summary = {};
      const pulledAt = new Date().toISOString();

      for (const [network, path] of Object.entries(LIVE)) {
        const r = await mc(path, { start: from, end: to, from, to, timezone: TZ });
        const rows = Array.isArray(r.body?.data) ? r.body.data : [];
        let stored = 0;

        for (const raw of rows) {
          const a = normalise(network, raw);
          if (!a.id) continue;
          const key = `asset/${network}/${a.id}`;
          const prior = await store.get(key, { type: 'json' }).catch(() => null);
          const rec = {
            ...a,
            score: score(a),
            /* Tags are never overwritten by a sync. A human set them, and a
               refresh of the numbers is not a reason to lose that. */
            origin: prior?.origin ?? null,
            correspondent: prior?.correspondent ?? null,
            beat: prior?.beat ?? null,
            firstSeen: prior?.firstSeen ?? pulledAt,
            updatedAt: pulledAt
          };
          await store.setJSON(key, rec);
          stored++;
        }
        summary[network] = { status: r.status, returned: rows.length, stored };
      }

      await store.setJSON(`sync/${pulledAt}`, { pulledAt, window: { from, to }, summary });
      return json({ ok: true, pulledAt, window: { from, to }, summary });
    }

    /* GET /assets?network=&format=&band=&untagged=1&limit= */
    if (route === 'assets') {
      const q = Object.fromEntries(url.searchParams);
      const store = metrics();
      const { blobs } = await store.list({ prefix: 'asset/' });
      const out = [];
      for (const b of blobs) {
        const a = await store.get(b.key, { type: 'json' });
        if (!a) continue;
        if (q.network && a.network !== q.network) continue;
        if (q.format && a.format !== q.format) continue;
        if (q.band && a.score?.band !== q.band) continue;
        if (q.untagged === '1' && a.origin) continue;
        out.push(a);
      }
      out.sort((x, y) => (y.score?.total ?? 0) - (x.score?.total ?? 0));
      return json({ ok: true, count: out.length, assets: out.slice(0, Number(q.limit || 60)) });
    }

    /* POST /tag - {network, id, origin, correspondent, beat} */
    if (route === 'tag' && req.method === 'POST') {
      const { network, id, ...tags } = await req.json();
      if (!network || !id) return bad('network and id are required');
      const store = metrics();
      const key = `asset/${network}/${id}`;
      const a = await store.get(key, { type: 'json' });
      if (!a) return bad('not found', 404);
      const next = { ...a, ...tags, taggedAt: new Date().toISOString() };
      await store.setJSON(key, next);
      return json({ ok: true, asset: next });
    }

    /* GET /discover3 - timelines returned 400 not 404, so the path is real
       and the parameters were wrong. Hypothesis: it wants the metric codes
       the hosted tools use (YTEV01 and family), not plain names. */
    if (route === 'discover3') {
      const { from, to } = win(90);
      const tries = [
        ['v2/analytics/timelines', { metrics: 'YTEV01', start: from, end: to, timezone: TZ }],
        ['v2/analytics/timelines', { metric: 'YTEV01', start: from, end: to, timezone: TZ }],
        ['v2/analytics/timelines', { metrics: 'YTEV01,YTEV02', start: from, end: to, timezone: TZ }],
        ['v2/analytics/timelines', { metrics: 'followers', start: from, end: to, timezone: TZ }],
        ['v2/analytics/timelines', { metrics: 'YTEV01', from, to, timezone: TZ }],
        ['v2/analytics/timelines', { metrics: 'LIEV01,TKEV07,YTEV01', start: from, end: to, timezone: TZ }],
        ['v2/analytics/competitors/youtube', { start: from, end: to, timezone: TZ }],
        ['v2/analytics/timelines', { start: from, end: to, timezone: TZ }]
      ];
      const results = [];
      for (const [p, params] of tries) {
        const r = await mc(p, params);
        results.push({
          path: p, params, status: r.status, live: r.ok,
          body: JSON.stringify(r.body).slice(0, r.ok ? 400 : 200)
        });
      }
      return json({ ok: true, live: results.filter((x) => x.live), results });
    }

    if (route === 'raw') {
      const path = url.searchParams.get('path');
      if (!path) return bad('pass ?path=');
      const params = Object.fromEntries(url.searchParams);
      delete params.path;
      const r = await mc(path, params);
      return json({ ok: r.ok, status: r.status, body: r.body });
    }

    return bad(`unknown route "${route}". Try verify, sync, assets, tag, discover3, raw.`, 404);
  } catch (err) {
    return bad(err.message, 500);
  }
};
