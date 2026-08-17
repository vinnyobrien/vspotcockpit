// cast-status.js
// Client polls this every ten seconds while a Cast render processes.
// Returns { state } until a clip exists, then { state: 'ready', clip }.
//
// The identifier is curationId, NOT id. id is the composite
// "projectId.curationId" and publishing rejects it with "Clip not found".
// This cost a day the first time. It is not costing a day again.

import { opus } from './_opus.js';
import { requireAuth } from './_auth.js';

export default async (req) => {
  const denied = await requireAuth(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const projectId = url.searchParams.get('projectId');
  if (!projectId) return json({ error: 'projectId required' }, 400);

  try {
    const data = await opus(`/projects/${encodeURIComponent(projectId)}/clips`);
    const clips = data.clips || data.items || (Array.isArray(data) ? data : []);

    if (!clips.length) {
      return json({ state: 'processing', projectId });
    }

    // No-clip mode returns exactly one output. If more than one comes back,
    // skipSlicing did not take and the render was cut. Say so rather than
    // quietly publishing a fragment.
    if (clips.length > 1) {
      return json(
        {
          state: 'unexpected',
          projectId,
          count: clips.length,
          message:
            'Opus returned more than one output. skipSlicing did not apply, so the render was cut into clips. Do not publish. Resubmit.',
        },
        200
      );
    }

    const c = clips[0];
    const curationId = c.curationId || c.curation_id;

    if (!curationId) {
      return json(
        { state: 'unexpected', projectId, message: 'Clip has no curationId', keys: Object.keys(c) },
        502
      );
    }

    return json({
      state: 'ready',
      projectId,
      clip: {
        curationId,
        title: c.title || null,
        durationSec: c.duration || c.durationSec || null,
        previewUrl: c.previewUrl || c.preview_url || null,
      },
    });
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
