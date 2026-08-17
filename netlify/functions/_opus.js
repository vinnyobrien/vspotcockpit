// _opus.js
// Single transport for OpusClip. Every Cast function goes through here so the
// base URL and the auth header exist in exactly one place.
//
// >>> ONE THING TO CONFIRM <<<
// Open netlify/functions/opus-publish.js and copy its base URL and headers
// into OPUS_BASE and opusHeaders() below. If they already match, change
// nothing. Getting this wrong produces a 401 that reads like a bad API key.

const OPUS_BASE = 'https://api.opus.pro/api/v1';

function opusHeaders() {
  const key = process.env.OPUS_API_KEY;
  const org = process.env.OPUS_ORG_ID;
  if (!key) throw new Error('OPUS_API_KEY missing. Redeploy after adding it.');
  if (!org) throw new Error('OPUS_ORG_ID missing. Redeploy after adding it.');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${key}`,
    'X-Org-Id': org,
  };
}

// Opus allows 30 requests a minute. Everything here is paced at 250ms, same as
// the nine-project read in claude-background.js.
let lastCall = 0;
async function paced() {
  const gap = Date.now() - lastCall;
  if (gap < 250) await new Promise((r) => setTimeout(r, 250 - gap));
  lastCall = Date.now();
}

export async function opus(path, { method = 'GET', body } = {}) {
  await paced();
  const res = await fetch(`${OPUS_BASE}${path}`, {
    method,
    headers: opusHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    // Do not swallow this. An unparseable body from Opus is a real signal,
    // usually an HTML error page from a bad path.
    throw new Error(`Opus returned non-JSON from ${path}: ${text.slice(0, 200)}`);
  }

  if (!res.ok) {
    throw new Error(
      `Opus ${res.status} on ${path}: ${data.message || data.error || text.slice(0, 200)}`
    );
  }
  return data;
}

// Cast projects must be findable and excludable. The Video room's selector
// reads every project now, so without this prefix Murt shows up in the clip
// swipe deck as a proposed clip.
export const CAST_PREFIX = 'CAST/';

export function castTitle(correspondentName, slug) {
  return `${CAST_PREFIX}${correspondentName} ${slug}`.slice(0, 120);
}

export function isCastProject(title) {
  return typeof title === 'string' && title.startsWith(CAST_PREFIX);
}
