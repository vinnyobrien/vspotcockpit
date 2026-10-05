// Endpoint definitions adapted from tripleaceme/tap-substack (MIT).
// Only aggregate analytics and post metadata; never fetch the subscriber list.
export const PUBLICATION = 'vinnyobrien';
const SUMMARY_FIELDS = ['subscribers','subscribersLast30Days','appSubscribers','appSubscribersLast30Days','totalEmail','totalEmailLast30Days','views','viewsDelta','openRate','openRateDiff'];
const EMAIL_FIELDS = ['post_id','title','post_date','audience','delivered','opens','open_rate','likes','comments','shares','downloads','downloads_day30','signups','subscribes'];
export function pick(record, fields) {
  return Object.fromEntries(fields.filter(k => record[k] !== undefined).map(k => [k, record[k]]));
}
export async function requestSubstack(path, token, fetcher = fetch) {
  const response = await fetcher(`https://${PUBLICATION}.substack.com${path}`, {
    headers: { accept: 'application/json', 'user-agent': 'VSpotCockpit/1.0', ...(token ? { cookie: `substack.sid=${token}` } : {}) },
    redirect: 'error', signal: AbortSignal.timeout(20000),
  });
  if ([401,403].includes(response.status)) throw new Error('Substack connection expired or lacks publication access. Reconnect in Audience Stats.');
  if (response.status === 429) throw new Error('Substack rate limit reached. Try refreshing later.');
  if (!response.ok) throw new Error(`Substack returned HTTP ${response.status}.`);
  const type = response.headers.get('content-type') || '';
  if (!type.includes('json')) throw new Error('Substack returned a page instead of analytics. Sign-in or network access may be required.');
  return response.json();
}
export async function extractStats(token, { fetcher = fetch, pause = ms => new Promise(r => setTimeout(r, ms)) } = {}) {
  const raw = await requestSubstack('/api/v1/publish-dashboard/summary', token, fetcher);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !SUMMARY_FIELDS.some(k => k in raw)) throw new Error('Substack dashboard response has changed; no verified metrics returned.');
  const posts = [];
  const seen = new Set();
  let complete = false;
  for (let page = 0; page < 200; page++) {
    await pause(550);
    const result = await requestSubstack(`/api/v1/publication/stats/email_stats?offset=${page * 10}`, token, fetcher);
    if (!Array.isArray(result?.rows)) throw new Error('Substack email analytics response has changed.');
    const rows = result.rows;
    let added = 0;
    for (const row of rows) {
      if (row.post_id == null || seen.has(String(row.post_id))) continue;
      seen.add(String(row.post_id)); posts.push(pick(row, EMAIL_FIELDS)); added++;
    }
    if (rows.length < 10) { complete = true; break; }
    if (!added) throw new Error('Substack pagination repeated a page; refresh was stopped to avoid misleading totals.');
  }
  if (!complete) throw new Error('Substack archive exceeded the extraction limit; totals were not replaced.');
  return { publication: PUBLICATION, fetchedAt: new Date().toISOString(), summary: pick(raw, SUMMARY_FIELDS), posts, complete };
}
export function yearStats(posts, year) {
  const selected = posts.filter(p => new Date(p.post_date).getUTCFullYear() === Number(year));
  const sum = key => selected.some(p => typeof p[key] === 'number') ? selected.reduce((n,p) => n + (typeof p[key] === 'number' ? p[key] : 0), 0) : null;
  const delivered = sum('delivered'), opens = sum('opens');
  const paired = selected.filter(p => typeof p.delivered === 'number' && typeof p.opens === 'number');
  const denominator = paired.reduce((n,p) => n+p.delivered,0);
  return { posts: selected, delivered, opens, downloads: sum('downloads'), openRate: denominator ? paired.reduce((n,p)=>n+p.opens,0)/denominator : null,
    coverage: { delivered: selected.filter(p=>typeof p.delivered==='number').length, opens: paired.length, downloads: selected.filter(p=>typeof p.downloads==='number').length } };
}
