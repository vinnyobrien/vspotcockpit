import { requireAuth, json } from "./_auth.js";
import { opusProbe } from "./_opus.js";

/** Tells us whether the Opus key works, and against which path.
    Reports status codes only, never the key. */
export default async (req) => {
  const denied = requireAuth(req);
  if (denied) return denied;
  return json({ probes: await opusProbe() });
};
