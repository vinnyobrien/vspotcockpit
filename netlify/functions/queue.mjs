import { getStore } from '@netlify/blobs';

export const config = { path: '/api/queue/*' };

/* ------------------------------------------------------------------ *
 * The V Spot Network â€” Cockpit Action Queue
 * Backing store for the rules layer. Cowork skills read and write here.
 * Rules v0.1. See vspot-cockpit-action-rules.md for the reasoning.
 * ------------------------------------------------------------------ */

const RULES = {
  version: '0.1',
  brandId: '6759442',
  timezone: 'Europe/Dublin',
  scoring: {
    hold: { weight: 40, divisor: 3, cap: 4 },
    reach: { weight: 35, divisor: 55, cap: 4 },
    engagement: { weight: 25, target: 1.5 }
  },
  bands: [
    { name: 'dead', min: 0, max: 19 },
    { name: 'weak', min: 20, max: 39 },
    { name: 'working', min: 40, max: 69 },
    { name: 'sponsor', min: 70, max: 100 }
  ],
  windows: {
    prime: [[7, 9], [21, 24]],
    weak: [[12, 15], [15, 18], [18, 21]],
    minGapHours: 6,
    maxClipsPerDay: 2
  },
  dayAttention: { mon: 696, tue: 42606, wed: 96463, thu: 61680, fri: 1714, sat: 3956, sun: 9489 },
  thresholds: {
    deadScore: 20,
    sponsorScore: 70,
    zeroEngagementViewsFloor: 1000,
    scoreFreezeHours: 72,
    duplicateTitleSimilarity: 0.85
  },
  baselineEmbargoUntil: '2026-12-01'
};

const SEVERITY = ['BLOCK', 'WARN', 'NOTE'];
const STATES = ['open', 'done', 'dismissed', 'superseded'];

/* ---------------------------------- store */

const actions = () => getStore({ name: 'vspot-actions', consistency: 'strong' });
const assets = () => getStore({ name: 'vspot-assets', consistency: 'strong' });

const json = (body, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
  });

const bad = (msg, status = 400) => json({ ok: false, error: msg }, status);

/* ---------------------------------- helpers */

function today(tz = RULES.timezone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(new Date());
}

function hourIn(tz, iso) {
  const d = iso ? new Date(iso) : new Date();
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hour12: false }).format(d));
}

function dayKey(iso) {
  const d = iso ? new Date(iso) : new Date();
  return new Intl.DateTimeFormat('en-GB', { timeZone: RULES.timezone, weekday: 'short' })
    .format(d).toLowerCase().slice(0, 3);
}

function makeId(rule, seq) {
  return `${rule}-${today().replace(/-/g, '')}-${String(seq).padStart(2, '0')}`;
}

function inWindow(hour, ranges) {
  return ranges.some(([a, b]) => hour >= a && hour < b);
}

/** Dice coefficient on bigrams. Used by PUB-10 duplicate detection. */
function similarity(a = '', b = '') {
  const grams = s => {
    const t = s.toLowerCase().replace(/[^a-z0-9 ]/g, '');
    const out = new Set();
    for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2));
    return out;
  };
  const A = grams(a), B = grams(b);
  if (!A.size || !B.size) return 0;
  let hit = 0;
  for (const g of A) if (B.has(g)) hit++;
  return (2 * hit) / (A.size + B.size);
}

/* ---------------------------------- scoring */

export function score({ views = 0, holdSeconds = 0, likes = 0 }) {
  const s = RULES.scoring;
  const hold = (Math.min(holdSeconds / s.hold.divisor, s.hold.cap) / s.hold.cap) * s.hold.weight;
  const reach = (Math.min(views / s.reach.divisor, s.reach.cap) / s.reach.cap) * s.reach.weight;
  const likeRate = views > 0 ? (likes / views) * 100 : 0;
  const eng = Math.min(likeRate / s.engagement.target, 1) * s.engagement.weight;
  const total = Math.round(hold + reach + eng);
  const band = RULES.bands.find(b => total >= b.min && total <= b.max)?.name ?? 'dead';
  return {
    total,
    band,
    likeRate: Number(likeRate.toFixed(2)),
    heldSeconds: Math.round(views * holdSeconds),
    parts: { hold: +hold.toFixed(1), reach: +reach.toFixed(1), engagement: +eng.toFixed(1) }
  };
}

/* ---------------------------------- rule engines */

/** PUB family. Input: array of planned posts {title, channel, scheduledAt}. */
function checkSchedule(planned = [], recent = []) {
  const raised = [];
  const byDay = {};
  for (const p of planned) {
    const d = new Intl.DateTimeFormat('en-CA', {
      timeZone: RULES.timezone, year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(new Date(p.scheduledAt));
    (byDay[d] ||= []).push(p);
  }

  for (const [day, posts] of Object.entries(byDay)) {
    posts.sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));

    posts.forEach((p, i) => {
      const hour = hourIn(RULES.timezone, p.scheduledAt);

      if (i === 1) {
        const gap = (new Date(p.scheduledAt) - new Date(posts[0].scheduledAt)) / 36e5;
        if (gap < RULES.windows.minGapHours) {
          raised.push(draft('PUB-01', 'BLOCK', p,
            `${gap.toFixed(1)}h after the first post. First slot medians 446 views, second medians 30.`,
            day));
        }
      }
      if (i >= RULES.windows.maxClipsPerDay) {
        raised.push(draft('PUB-02', 'BLOCK', p,
          `Third post on ${day}. Three clips a day medians 46 views against 126 for two.`, day));
      }
      if (inWindow(hour, [[15, 18]])) {
        raised.push(draft('PUB-03', 'WARN', p,
          `Scheduled ${hour}:00 Irish. That block medians 34 views across 7 posts. Try 07:30 or 21:30.`, day));
      }
      if (posts.length === 2 && i === 1) {
        const h0 = hourIn(RULES.timezone, posts[0].scheduledAt);
        if (inWindow(h0, RULES.windows.prime) && inWindow(hour, RULES.windows.prime)
            && ((h0 < 12) === (hour < 12))) {
          raised.push(draft('PUB-08', 'WARN', p,
            'Both posts land in the same audience window. Split one Irish morning, one New York afternoon.', day));
        }
      }
      for (const r of recent) {
        const sim = similarity(p.title, r.title);
        if (sim >= RULES.thresholds.duplicateTitleSimilarity) {
          raised.push(draft('PUB-10', 'BLOCK', p,
            `${Math.round(sim * 100)}% title match with "${r.title}". Duplicates split algorithmic signal.`, day));
        }
      }
    });

    if (!posts.some(p => inWindow(hourIn(RULES.timezone, p.scheduledAt), RULES.windows.prime))) {
      raised.push(draft('PUB-04', 'WARN', { title: `No prime-window asset on ${day}`, channel: 'network' },
        'Nothing scheduled 07:00-09:00 or 21:00-24:00 Irish.', day));
    }
    if (dayKey(posts[0].scheduledAt) === 'fri' && posts.length === 0) {
      raised.push(draft('PUB-05', 'WARN', { title: 'Friday gap', channel: 'network' },
        'Friday holds 1,714s against Wednesday 96,463s, and Friday is the name day.', day));
    }
  }
  return raised;
}

/** QUA + INT family, run on a scored asset. */
function checkAsset(asset, sc) {
  const raised = [];
  const t = RULES.thresholds;

  if (sc.total < t.deadScore) {
    raised.push(draft('QUA-02', 'WARN', asset,
      `Score ${sc.total}. Log the opening line, format, hour and whether it opened on a scene or a position.`));
  }
  if (sc.total >= t.sponsorScore) {
    raised.push(draft('QUA-03', 'WARN', asset,
      `Score ${sc.total}. Route to the sponsor evidence set and raise a Substack or LinkedIn echo within 7 days.`));
    raised.push(draft('EDI-02', 'WARN', asset,
      'Sponsor-grade asset with no written counterpart yet.'));
  }
  if (sc.total < 40) {
    raised.push(draft('QUA-04', 'NOTE', asset,
      'Scene test: did this open on a concrete image or an abstract position?'));
  }
  if (asset.format === 'longform' && asset.holdSeconds < 60) {
    raised.push(draft('QUA-07', 'WARN', asset,
      `Average view duration ${asset.holdSeconds}s on long-form. That is roughly 1% retention.`));
  }
  if (asset.views >= t.zeroEngagementViewsFloor && (asset.likes ?? 0) === 0) {
    raised.push(draft('INT-01', 'BLOCK', asset,
      `${asset.views} views, zero likes. Barred from all media packs, rate cards and sponsor decks.`));
  }
  if (asset.sponsored) {
    raised.push(draft('SPO-01', 'WARN', asset,
      `Draft the delivery note: score ${sc.total}, ${asset.views} views, ${sc.heldSeconds}s held, ${sc.likeRate}% like rate. Send within 48h.`));
  }
  return raised;
}

function draft(rule, severity, asset, evidence, due) {
  return {
    rule,
    severity,
    asset: asset.title ?? String(asset),
    channel: asset.channel ?? 'unknown',
    evidence,
    due: due ?? today(),
    state: 'open',
    outcome: ''
  };
}

/* ---------------------------------- persistence */

async function saveActions(list) {
  const store = actions();
  const saved = [];
  let seq = Date.now() % 100;
  for (const a of list) {
    const id = a.action_id ?? makeId(a.rule, seq++);
    const rec = { ...a, action_id: id, raised: a.raised ?? new Date().toISOString() };
    await store.setJSON(`actions/${id}`, rec);
    saved.push(rec);
  }
  return saved;
}

async function listActions(filter = {}) {
  const store = actions();
  const { blobs } = await store.list({ prefix: 'actions/' });
  const out = [];
  for (const b of blobs) {
    const rec = await store.get(b.key, { type: 'json' });
    if (!rec) continue;
    if (filter.state && rec.state !== filter.state) continue;
    if (filter.severity && rec.severity !== filter.severity) continue;
    if (filter.channel && rec.channel !== filter.channel) continue;
    if (filter.rule && !rec.rule.startsWith(filter.rule)) continue;
    if (filter.dueBy && rec.due > filter.dueBy) continue;
    out.push(rec);
  }
  const rank = { BLOCK: 0, WARN: 1, NOTE: 2 };
  out.sort((a, b) => rank[a.severity] - rank[b.severity] || a.due.localeCompare(b.due));
  return out;
}

/* ---------------------------------- auth */

function authorised(req) {
  const token = process.env.COCKPIT_TOKEN;
  if (!token) return true; // unset means open, for local dev only
  const h = req.headers.get('authorization') || '';
  return h === `Bearer ${token}`;
}

/* ---------------------------------- router */

export default async (req) => {
  const url = new URL(req.url);
  const seg = url.pathname.replace(/^\/api\/queue\/?/, '').split('/').filter(Boolean);
  const route = seg[0] ?? '';

  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (!authorised(req)) return bad('unauthorised', 401);

  try {
    /* GET /api/queue/rules */
    if (route === 'rules' && req.method === 'GET') return json(RULES);

    /* GET /api/queue/actions?state=open&severity=BLOCK */
    if (route === 'actions' && req.method === 'GET') {
      const f = Object.fromEntries(url.searchParams);
      return json({ ok: true, count: undefined, actions: await listActions(f) });
    }

    /* POST /api/queue/actions  â€” raise one or many */
    if (route === 'actions' && req.method === 'POST') {
      const body = await req.json();
      const list = Array.isArray(body) ? body : [body];
      for (const a of list) {
        if (!a.rule) return bad('rule is required');
        if (a.severity && !SEVERITY.includes(a.severity)) return bad(`severity must be one of ${SEVERITY}`);
      }
      return json({ ok: true, raised: await saveActions(list) }, 201);
    }

    /* PATCH /api/queue/actions/:id â€” close or dismiss */
    if (route === 'actions' && req.method === 'PATCH') {
      const id = seg[1];
      if (!id) return bad('action_id required in path');
      const store = actions();
      const rec = await store.get(`actions/${id}`, { type: 'json' });
      if (!rec) return bad('not found', 404);
      const body = await req.json();
      if (body.state && !STATES.includes(body.state)) return bad(`state must be one of ${STATES}`);
      const next = {
        ...rec,
        state: body.state ?? rec.state,
        outcome: body.outcome ?? rec.outcome,
        closed: body.state && body.state !== 'open' ? new Date().toISOString() : rec.closed
      };
      await store.setJSON(`actions/${id}`, next);
      return json({ ok: true, action: next });
    }

    /* POST /api/queue/score â€” score an asset, persist it, raise QUA/INT/SPO actions */
    if (route === 'score' && req.method === 'POST') {
      const body = await req.json();
      const list = Array.isArray(body) ? body : [body];
      const results = [];
      for (const asset of list) {
        const sc = score(asset);
        const rec = {
          ...asset,
          score: sc.total,
          band: sc.band,
          likeRate: sc.likeRate,
          heldSeconds: sc.heldSeconds,
          scoredAt: new Date().toISOString(),
          frozen: true
        };
        const key = `assets/${asset.channel ?? 'unknown'}/${(asset.id ?? asset.title ?? 'untitled')
          .toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60)}`;
        await assets().setJSON(key, rec);
        const raised = await saveActions(checkAsset(asset, sc));
        results.push({ asset: rec, score: sc, raised });
      }
      return json({ ok: true, results }, 201);
    }

    /* POST /api/queue/check-schedule â€” PUB rules, dry run by default */
    if (route === 'check-schedule' && req.method === 'POST') {
      const { planned = [], recent = [], commit = false } = await req.json();
      const found = checkSchedule(planned, recent);
      const blocking = found.filter(a => a.severity === 'BLOCK');
      const raised = commit ? await saveActions(found) : found;
      return json({ ok: true, clear: blocking.length === 0, blocking: blocking.length, actions: raised });
    }

    /* GET /api/queue/digest â€” what the morning skill reads */
    if (route === 'digest' && req.method === 'GET') {
      const open = await listActions({ state: 'open' });
      const d = today();
      return json({
        ok: true,
        date: d,
        dayWeight: RULES.dayAttention[dayKey()] ?? null,
        blocking: open.filter(a => a.severity === 'BLOCK'),
        dueToday: open.filter(a => a.severity !== 'BLOCK' && a.due <= d),
        upcoming: open.filter(a => a.due > d).slice(0, 10),
        overdue: open.filter(a => a.due < d),
        counts: {
          block: open.filter(a => a.severity === 'BLOCK').length,
          warn: open.filter(a => a.severity === 'WARN').length,
          note: open.filter(a => a.severity === 'NOTE').length
        }
      });
    }

    /* GET /api/queue/assets?band=sponsor â€” the evidence set */
    if (route === 'assets' && req.method === 'GET') {
      const band = url.searchParams.get('band');
      const store = assets();
      const { blobs } = await store.list({ prefix: 'assets/' });
      const out = [];
      for (const b of blobs) {
        const rec = await store.get(b.key, { type: 'json' });
        if (!rec) continue;
        if (band && rec.band !== band) continue;
        out.push(rec);
      }
      out.sort((a, b) => b.score - a.score);
      return json({ ok: true, embargo: RULES.baselineEmbargoUntil, assets: out });
    }

    /* GET /api/queue/export â€” everything, for the Signal Board */
    if (route === 'export' && req.method === 'GET') {
      return json({
        ok: true,
        generated: new Date().toISOString(),
        rules: RULES,
        actions: await listActions({})
      });
    }

    return bad(`unknown route "${route}". Try rules, actions, score, check-schedule, digest, assets, export.`, 404);
  } catch (err) {
    return bad(`queue error: ${err.message}`, 500);
  }
};
