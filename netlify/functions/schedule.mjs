/* ------------------------------------------------------------------ *
 * The V Spot Network — scheduler
 *
 * POST /api/schedule  →  Metricool v2/scheduler/posts
 *
 * Endpoint verified live 26 Aug 2026 (GET returned 200). Same auth shape
 * as the ingest: X-Mc-Auth header, userId and blogId on the query string.
 *
 * The media URL must be public and non-expiring, which is the whole
 * reason R2 exists. Metricool fetches the file itself; nothing is
 * proxied through Netlify, so the 6MB function limit never applies.
 *
 * Destination rules are enforced here, not in the browser, because the
 * browser is where a rule quietly stops being true.
 * ------------------------------------------------------------------ */

import { requireAuth } from './_auth.js';

export const config = { path: '/api/schedule' };

const BASE = 'https://app.metricool.com/api';
const BLOG_ID = '6759442';
const TZ = 'Europe/Dublin';

const json = (b, s = 200) => new Response(JSON.stringify(b, null, 2), {
  status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
});
const bad = (m, s = 400) => json({ ok: false, error: m }, s);

/* Two ways in, deliberately. The browser is already logged in with the
   session cookie every other function uses, so the room needs no token
   pasted into it. The bearer stays for the Cowork skills, which call these
   endpoints from outside a browser and have no cookie. */
function authorised(req) {
  const token = process.env.COCKPIT_TOKEN;
  if (token && (req.headers.get('authorization') || '') === `Bearer ${token}`) return true;
  return requireAuth(req) === null;
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (!authorised(req)) return bad('Unauthorised', 401);

  /* GET - read the queue back from Metricool rather than trusting a local
     record of what we think we sent. A post is scheduled when Metricool says
     it is, not when our POST returned 200. */
  if (req.method === 'GET') {
    const token = process.env.METRICOOL_TOKEN;
    const userId = process.env.METRICOOL_USER_ID;
    if (!token || !userId) return bad('METRICOOL_TOKEN or METRICOOL_USER_ID is not set', 500);

    const now = new Date();
    const from = new Date(now.getTime() - 7 * 864e5);
    const to = new Date(now.getTime() + 60 * 864e5);
    const stamp = (d) => d.toISOString().slice(0, 19);

    const u = new URL(`${BASE}/v2/scheduler/posts`);
    u.searchParams.set('userId', userId);
    u.searchParams.set('blogId', BLOG_ID);
    u.searchParams.set('start', stamp(from));
    u.searchParams.set('end', stamp(to));

    const r = await fetch(u, { headers: { 'X-Mc-Auth': token, accept: 'application/json' } });
    if (!r.ok) return json({ ok: false, error: `Metricool refused the read: ${r.status}` }, 502);
    const { data = [] } = await r.json();

    const posts = data.map((p) => ({
      id: p.id,
      at: p.publicationDate?.dateTime ?? null,
      text: (p.text || '').slice(0, 120),
      draft: !!p.draft,
      media: Array.isArray(p.media) ? p.media.length : 0,
      networks: (p.providers || []).map((x) => ({ network: x.network, status: x.detailedStatus || x.status }))
    })).sort((a, b) => String(a.at).localeCompare(String(b.at)));

    return json({ ok: true, count: posts.length, posts });
  }

  if (req.method !== 'POST') return bad('GET or POST only', 405);

  const token = process.env.METRICOOL_TOKEN;
  const userId = process.env.METRICOOL_USER_ID;
  if (!token || !userId) return bad('METRICOOL_TOKEN or METRICOOL_USER_ID is not set', 500);

  let body;
  try { body = await req.json(); } catch { return bad('Body is not JSON'); }

  const {
    mediaUrl, kind = 'video', text = '', networks = [],
    when, youtubeTitle = '', aiGenerated = false,
    durationSeconds = null, width = null, height = null
  } = body;

  /* ---- validation, in the order that fails cheapest first ---- */

  if (!mediaUrl || !/^https:\/\//.test(mediaUrl)) {
    return bad('mediaUrl must be a public https URL. Upload to Drive first.');
  }
  if (!Array.isArray(networks) || networks.length === 0) {
    return bad('Pick at least one destination.');
  }

  const ALLOWED = ['twitter', 'tiktok', 'youtube'];
  const unknown = networks.filter((n) => !ALLOWED.includes(n));
  if (unknown.length) return bad(`Not a destination this room handles: ${unknown.join(', ')}`);

  /* YouTube will not take a still. Caught here rather than as a 400 from
     Metricool three seconds later with a less useful message. */
  if (kind === 'image' && networks.includes('youtube')) {
    return bad('YouTube needs a video. Drop it from the destinations, or upload the clip instead of the still.');
  }
  if (networks.includes('youtube') && !youtubeTitle.trim()) {
    return bad('YouTube requires a title of its own. It does not use the caption.');
  }
  if (!text.trim() && !networks.every((n) => n === 'youtube')) {
    return bad('Caption is required for X and TikTok.');
  }
  if (!when) return bad('No publish time given.');

  /* Vertical and under three minutes is a Short. Anything else is a video,
     including a vertical clip that runs long — YouTube decides on both. */
  const isShort = kind === 'video'
    && (height || 0) > (width || 0)
    && (durationSeconds || 0) > 0
    && (durationSeconds || 0) <= 180;

  const networkData = {};
  if (networks.includes('twitter')) networkData.twitterData = { tags: [] };
  if (networks.includes('tiktok')) {
    networkData.tiktokData = {
      disableComment: false, disableDuet: false, disableStitch: false,
      privacyOption: 'PUBLIC_TO_EVERYONE',
      commercialContentThirdParty: false, commercialContentOwnBrand: false,
      autoAddMusic: false, photoCoverIndex: 0,
      /* TikTok ignores this on photo-only posts; harmless to send, and
         the correspondents are synthetic so it must be set on video. */
      isAigc: !!aiGenerated
    };
  }
  if (networks.includes('youtube')) {
    networkData.youtubeData = {
      title: youtubeTitle.trim().slice(0, 100),
      type: isShort ? 'short' : 'video',
      privacy: 'public',
      tags: [],
      madeForKids: false,
      isAiGeneratedContent: !!aiGenerated
    };
  }

  const info = {
    autoPublish: true,
    draft: false,
    /* Without this, Metricool keeps the Drive link as a LINK and hands that to
       X/TikTok/YouTube at publish time. They cannot fetch a Drive viewer page,
       so the post sits PENDING and then fails on the network side - scheduled
       successfully, published never. Setting it true makes Metricool pull the
       bytes into its own storage at schedule time, which is the whole point of
       having Drive linked in the first place. Defaults to false. */
    saveExternalMediaFiles: true,
    descendants: [],
    firstCommentText: '',
    hasNotReadNotes: false,
    media: [mediaUrl],
    mediaAltText: [],
    providers: networks.map((n) => ({ network: n })),
    publicationDate: { dateTime: when, timezone: TZ },
    shortener: false,
    smartLinkData: { ids: [] },
    text,
    ...networkData
  };

  const url = new URL(`${BASE}/v2/scheduler/posts`);
  url.searchParams.set('userId', userId);
  url.searchParams.set('blogId', BLOG_ID);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'X-Mc-Auth': token, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(info)
  });

  const raw = await res.text();
  let out; try { out = JSON.parse(raw); } catch { out = raw.slice(0, 500); }

  if (!res.ok) {
    /* Relayed unaltered. Metricool's rejections name the field, and
       rewriting them into something friendlier loses the field name. */
    return json({ ok: false, status: res.status, error: out }, 502);
  }

  const post = out?.data ?? {};
  return json({
    ok: true,
    scheduled: networks,
    postId: post.id ?? null,
    /* Echo back what Metricool RECORDED, not what we sent. If it silently
       dropped or moved something, this is where it shows. */
    confirmedAt: post.publicationDate?.dateTime ?? null,
    confirmedNetworks: (post.providers || []).map((p) => ({
      network: p.network, status: p.detailedStatus || p.status
    })),
    mediaIngested: post.saveExternalMediaFiles === true,
    at: when,
    youtubeType: networks.includes('youtube') ? (isShort ? 'short' : 'video') : null,
    metricool: out
  });
};
