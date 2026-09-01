import { getStore } from '@netlify/blobs';
import { requireAuth } from './_auth.js';
import { getAccessToken } from './_google.js';

export const config = { path: '/api/health' };

/* ------------------------------------------------------------------ *
 * Cockpit self-test
 *
 * Two questions, deliberately separated:
 *
 *   CHECKS   - is it working? Live round-trips, not pings. A store that
 *              answers a list call but cannot complete write-read-delete
 *              is broken in the way that actually bites.
 *
 *   EFFICACY - is it doing its job? A capture desk that accepts clips
 *              nobody reads is technically healthy and practically a
 *              landfill. Uptime cannot see that; these counts can.
 *
 * Non-destructive. Probe keys are written under _health/ and removed
 * before returning. Never returns a secret value, only whether it is set.
 * ------------------------------------------------------------------ */

const json = (body, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
  });

function authorised(req) {
  for (const name of ['COCKPIT_TOKEN', 'CAPTURE_TOKEN']) {
    const t = process.env[name];
    if (t && (req.headers.get('authorization') || '') === `Bearer ${t}`) return true;
  }
  return requireAuth(req) === null;
}

const DAY = 864e5;
const ageDays = (iso) => iso ? Math.floor((Date.now() - new Date(iso)) / DAY) : null;

/* Every check returns the same shape so the report can be scanned in one
   pass rather than read. */
async function check(name, fn) {
  const started = Date.now();
  try {
    const detail = await fn();
    return { name, ok: true, ms: Date.now() - started, ...detail };
  } catch (err) {
    return { name, ok: false, ms: Date.now() - started, error: err.message };
  }
}

/* Full write-read-delete against a store. A read-only probe would pass
   on a store that has lost write access, which is the failure that
   silently loses captures. */
async function roundTrip(storeName) {
  const store = getStore({ name: storeName, consistency: 'strong' });
  const key = `_health/probe-${Date.now()}`;
  const payload = { probe: true, at: new Date().toISOString() };

  await store.setJSON(key, payload);
  const back = await store.get(key, { type: 'json' });
  await store.delete(key);

  if (!back || back.at !== payload.at) {
    throw new Error('wrote, but read back nothing or something different — check consistency setting');
  }
  const { blobs } = await store.list();
  return { store: storeName, records: blobs.filter(b => !b.key.startsWith('_health/')).length };
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (!authorised(req)) return json({ ok: false, error: 'unauthorised' }, 401);

  const deep = new URL(req.url).searchParams.get('deep') === '1';
  const checks = [];
  const warnings = [];

  /* ---------- environment: names only, never values ---------- */
  const expected = ['CAPTURE_TOKEN', 'COCKPIT_TOKEN'];
  const env = Object.fromEntries(expected.map(k => [k, Boolean(process.env[k])]));
  checks.push({ name: 'env', ok: Object.values(env).every(Boolean), set: env });
  for (const [k, v] of Object.entries(env)) {
    if (!v) warnings.push(`${k} is not set. Any function relying on it will fall open or reject everything.`);
  }

  /* ---------- storage ---------- */
  for (const s of ['captures', 'vspot-media', 'vspot-actions', 'vspot-assets']) {
    checks.push(await check(`blobs:${s}`, () => roundTrip(s)));
  }

  /* ---------- google drive ---------- */
  checks.push(await check('google:drive', async () => {
    const token = await getAccessToken('default');
    if (!token) throw new Error('Google is not connected. Press Connect Google in Settings.');
    const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress),storageQuota', {
      headers: { authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error(`Drive rejected the token: ${res.status}`);
    const { user, storageQuota } = await res.json();
    const usedPct = storageQuota?.limit
      ? Math.round((Number(storageQuota.usage) / Number(storageQuota.limit)) * 100)
      : null;
    if (usedPct !== null && usedPct > 90) {
      warnings.push(`Drive is ${usedPct}% full. Media uploads fail hard when it fills.`);
    }
    return { account: user?.emailAddress ?? null, usedPct };
  }));

  /* ---------- capture round-trip: the whole path, end to end ---------- */
  if (deep) {
    checks.push(await check('capture:lifecycle', async () => {
      const store = getStore({ name: process.env.CAPTURE_STORE || 'captures', consistency: 'strong' });
      const url = `https://example.com/_health/${Date.now()}`;
      const origin = new URL(req.url).origin;
      const auth = req.headers.get('authorization');
      const headers = { 'content-type': 'application/json', ...(auth ? { authorization: auth } : {}) };

      const first = await fetch(`${origin}/api/capture`, {
        method: 'POST', headers,
        body: JSON.stringify({ type: 'clip', url, title: 'health probe', note: 'probe', threads: ['Health Probe'], source: 'health' })
      }).then(r => r.json());
      if (!first.id) throw new Error(`capture refused the probe: ${JSON.stringify(first)}`);

      /* Re-post with tracking junk. Must merge, not duplicate. This is the
         single behaviour the whole desk depends on. */
      const second = await fetch(`${origin}/api/capture`, {
        method: 'POST', headers,
        body: JSON.stringify({ type: 'clip', url: `${url}?utm_source=health&fbclid=x`, source: 'health' })
      }).then(r => r.json());

      const deduped = second.duplicate === true && second.id === first.id;
      const rec = await store.get(first.id, { type: 'json' });
      const slugged = (rec?.threads ?? []).includes('health-probe');

      await store.delete(first.id);

      if (!deduped) throw new Error('URL normalisation is not deduplicating — the desk will fill with copies');
      if (!slugged) throw new Error('thread slugification is not running — threads will fragment');
      return { deduped, slugged, seen: second.seen_count ?? null };
    }));
  }

  /* ---------- efficacy: is the desk actually being used? ---------- */
  const efficacy = {};
  try {
    const store = getStore({ name: process.env.CAPTURE_STORE || 'captures', consistency: 'strong' });
    const { blobs } = await store.list();
    const recs = (await Promise.all(
      blobs.filter(b => !b.key.startsWith('_health/'))
           .map(b => store.get(b.key, { type: 'json' }).catch(() => null))
    )).filter(Boolean);

    const by = (s) => recs.filter(r => r.status === s);
    const parked = by('parked');
    const stale = parked.filter(r => ageDays(r.captured_at) > 30);
    const noNote = recs.filter(r => !r.note || !String(r.note).trim());
    const closed = by('used').length + by('dropped').length;

    efficacy.captures = {
      total: recs.length,
      parked: parked.length,
      reading: by('reading').length,
      used: by('used').length,
      dropped: by('dropped').length,
      parkedOver30Days: stale.length,
      oldestParkedDays: parked.length
        ? Math.max(...parked.map(r => ageDays(r.captured_at) ?? 0)) : 0,
      withoutNote: noNote.length,
      /* The number that says whether this was worth building. Capture is
         easy; closing the loop is the job. */
      closeRate: recs.length ? Math.round((closed / recs.length) * 100) : null
    };

    if (stale.length >= 10) {
      warnings.push(`${stale.length} clips parked over 30 days. The desk is filling faster than it empties — book a reading slot or start dropping.`);
    }
    if (recs.length >= 10 && efficacy.captures.closeRate !== null && efficacy.captures.closeRate < 20) {
      warnings.push(`Only ${efficacy.captures.closeRate}% of captures have been used or dropped. Capture is working; reading is not.`);
    }
    if (noNote.length > recs.length / 2 && recs.length >= 6) {
      warnings.push(`${noNote.length} of ${recs.length} captures have no note. The reason is the part that cannot be reconstructed later.`);
    }
    if (recs.length <= 1) {
      warnings.push('The capture store is effectively empty. If the Shortcuts are built, nothing is reaching them.');
    }
  } catch (err) {
    efficacy.captures = { error: err.message };
  }

  /* Media tagging. media.mjs is explicit that an untagged clip cannot be
     attributed later, so untagged registrations are a real debt. */
  try {
    const store = getStore({ name: 'vspot-media', consistency: 'strong' });
    const { blobs } = await store.list({ prefix: 'media/' });
    const recs = (await Promise.all(
      blobs.map(b => store.get(b.key, { type: 'json' }).catch(() => null))
    )).filter(Boolean);
    const untagged = recs.filter(r => !r.origin || !r.correspondent || !r.beat);
    efficacy.media = { registered: recs.length, untagged: untagged.length };
    if (untagged.length) {
      warnings.push(`${untagged.length} media records are missing origin, correspondent or beat. They cannot be attributed in a sponsor pack.`);
    }
  } catch (err) {
    efficacy.media = { error: err.message };
  }

  /* Action queue backlog. */
  try {
    const store = getStore({ name: 'vspot-actions', consistency: 'strong' });
    const { blobs } = await store.list({ prefix: 'actions/' });
    const recs = (await Promise.all(
      blobs.map(b => store.get(b.key, { type: 'json' }).catch(() => null))
    )).filter(Boolean);
    const open = recs.filter(r => r.state === 'open');
    const todayStr = new Date().toISOString().slice(0, 10);
    const overdue = open.filter(r => r.due && r.due < todayStr);
    const blocking = open.filter(r => r.severity === 'BLOCK');

    efficacy.queue = { total: recs.length, open: open.length, overdue: overdue.length, blocking: blocking.length };
    if (blocking.length) warnings.push(`${blocking.length} BLOCK actions are open. Publishing should not proceed past these.`);
    if (overdue.length >= 5) warnings.push(`${overdue.length} actions are overdue. The queue is being written to but not worked.`);
  } catch (err) {
    efficacy.queue = { error: err.message };
  }

  const failed = checks.filter(c => !c.ok);

  return json({
    ok: failed.length === 0,
    generated: new Date().toISOString(),
    deep,
    summary: {
      checksRun: checks.length,
      checksFailed: failed.length,
      failing: failed.map(c => c.name),
      warnings: warnings.length
    },
    checks,
    efficacy,
    warnings
  }, failed.length ? 503 : 200);
};
