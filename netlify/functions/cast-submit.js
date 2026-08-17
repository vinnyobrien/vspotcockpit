// cast-submit.js
// Submits the uploaded render to OpusClip in NO-CLIP mode and returns the
// project id straight away. It does not wait. Processing takes minutes and a
// standard function dies at ten seconds, so waiting here guarantees a 502 that
// looks like a broken integration.
//
// skipSlicing:true is what makes this work. It keeps the full video as one
// output instead of cutting a fifty second piece into three useless fragments.
// It cannot be combined with enableAutoHook or clipDurationsSec, both of which
// are clip-only options and will be rejected.

import { opus, castTitle } from './_opus.js';
import { requireAuth } from './_auth.js';
import { append } from './_ledger.js';

export default async (req) => {
  const denied = await requireAuth(req);
  if (denied) return denied;

  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  let payload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'Body must be JSON' }, 400);
  }

  const { uploadId, correspondent, slug, aspectRatio } = payload || {};

  if (!uploadId) return json({ error: 'uploadId required' }, 400);
  if (!correspondent) return json({ error: 'correspondent required' }, 400);

  const title = castTitle(correspondent, slug || new Date().toISOString().slice(0, 10));

  try {
    const data = await opus('/projects', {
      method: 'POST',
      body: {
        videoUrl: uploadId,
        title,
        skipSlicing: true,
        aspectRatio: aspectRatio || 'portrait',
        enableCaption: true,
        // Deliberately absent: enableAutoHook, clipDurationsSec.
        // Both conflict with skipSlicing and are rejected when set together.
      },
    });

    const projectId = data.project_id || data.projectId || data.id;
    if (!projectId) {
      return json({ error: 'Opus returned no project id', received: Object.keys(data) }, 502);
    }

    await append({
      kind: 'cast:submit',
      projectId,
      correspondent,
      title,
      at: new Date().toISOString(),
    });

    return json({ projectId, title, state: 'processing' });
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
