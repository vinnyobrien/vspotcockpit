import { requireAuth, json } from "./_auth.js";
import { readJSON } from "./_blobs.js";

/** Collect the result of a background job. */
export default async (req) => {
  const denied = requireAuth(req);
  if (denied) return denied;

  const id = (new URL(req.url).searchParams.get("id") || "").replace(/[^A-Za-z0-9-]/g, "").slice(0, 64);
  if (!id) return json({ error: "Missing id" }, 400);

  return json((await readJSON("cockpit", `job:${id}`, null)) || { status: "pending" });
};
