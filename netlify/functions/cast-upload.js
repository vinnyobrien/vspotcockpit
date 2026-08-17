// cast-upload.js
// Returns a signed URL the browser PUTs the Kapwing render straight into.
// The bytes never touch a Netlify function, which is the only way this works
// inside the execution limit.
//
// Flow: client calls this, gets { uploadUrl, uploadId }, PUTs the file to
// uploadUrl, then sends uploadId to cast-submit.js.

import { opus } from './_opus.js';
import { requireAuth } from './_auth.js';

const MAX_MB = 512;
const ALLOWED = ['mp4', 'mov', 'mkv'];

export default async (req) => {
  const denied = await requireAuth(req);
  if (denied) return denied;

  if (req.method !== 'POST') {
    return json({ error: 'POST only' }, 405);
  }

  let payload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Body must be JSON' }, 400);
  }

  const { fileName, sizeMb, extension } = payload || {};

  const ext = String(extension || 'mp4').toLowerCase().replace(/^\./, '');
  if (!ALLOWED.includes(ext)) {
    return json({ error: `Extension must be one of ${ALLOWED.join(', ')}` }, 400);
  }

  const size = Number(sizeMb);
  if (!Number.isFinite(size) || size < 1) {
    return json({ error: 'sizeMb must be a number of at least 1' }, 400);
  }
  if (size > MAX_MB) {
    // A fifty second 9:16 render is well under this. Anything larger is a
    // long-form video that belongs in the Video room, not The Cast.
    return json(
      { error: `${Math.round(size)}MB exceeds the ${MAX_MB}MB Cast ceiling. Long form goes to Video.` },
      400
    );
  }

  try {
    const data = await opus('/uploads', {
      method: 'POST',
      body: {
        extension: ext,
        fileName: fileName || `cast-${Date.now()}.${ext}`,
        sizeMb: Math.ceil(size),
      },
    });

    const uploadUrl = data.upload_url || data.uploadUrl || data.signed_url;
    const uploadId = data.upload_id || data.uploadId || data.id;

    if (!uploadUrl || !uploadId) {
      // Live or nothing. If Opus changed the shape, fail loudly here rather
      // than handing the client an undefined it will PUT into the void.
      return json(
        { error: 'Opus returned no upload URL or id', received: Object.keys(data) },
        502
      );
    }

    return json({ uploadUrl, uploadId, maxMb: MAX_MB });
  } catch (err) {
    return json({ error: String(err.message || err) }, 502);
  }
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
