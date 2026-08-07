import { requireAuth, json } from "./_auth.js";
import { publishNow, schedulePost } from "./_opus.js";

/**
 * Publishes or schedules one clip. Called straight from the tick in the queue,
 * with no model anywhere in the path. The arguments are already decided by the
 * time this runs, so this function's only job is to make the call faithfully
 * and report exactly what came back.
 */
export default async (req) => {
  const denied = requireAuth(req);
  if (denied) return denied;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let b;
  try {
    b = await req.json();
  } catch {
    return json({ error: "Bad request" }, 400);
  }

  const { projectId, clipId, postAccountId, title, description, publishAt } = b || {};
  if (!projectId || !clipId || !postAccountId || !title) {
    return json({ error: "Need projectId, clipId, postAccountId and title." }, 400);
  }

  try {
    const res = publishAt
      ? await schedulePost({ projectId, clipId, postAccountId, title, description, publishAt })
      : await publishNow({ projectId, clipId, postAccountId, title, description });

    const d = (res && (res.data || res)) || {};
    return json({
      ok: true,
      scheduleId: d.scheduleId || d.schedule_id || null,
      postTaskId: d.postTaskId || d.post_task_id || d.id || null,
      url: d.postUrl || d.url || d.permalink || "",
      raw: d,
    });
  } catch (e) {
    return json({ error: String(e.message || e) }, 502);
  }
};
