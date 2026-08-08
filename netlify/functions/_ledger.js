/**
 * netlify/functions/_ledger.js
 *
 * Append-only record of every action the Cockpit takes on your behalf.
 *
 * Not a compliance chore. Three things depend on it:
 *   · "Read, propose, never act" becomes provable rather than claimed
 *   · The Gap queries it — "no sponsor approach has ever gone out"
 *   · Analysis reads it — what shipped, where, and which sources recur
 *
 * One blob per day so no single key grows without bound.
 */

import { readJSON, writeJSON } from "./_blobs.js";

const day = (d = new Date()) => d.toISOString().slice(0, 10);
const MAX_PER_DAY = 500;

/**
 * @param {string} action  verb.noun, e.g. "email.sent", "clip.published"
 * @param {object} detail  small, and never a secret
 */
export async function record(action, detail = {}) {
  const key = `ledger:${day()}`;
  try {
    const log = (await readJSON("cockpit", key, [])) || [];
    const entry = {
      at: new Date().toISOString(),
      action: String(action).slice(0, 60),
      ...Object.fromEntries(
        Object.entries(detail).map(([k, v]) => [k, typeof v === "string" ? v.slice(0, 300) : v])
      ),
    };
    await writeJSON("cockpit", key, [...log, entry].slice(-MAX_PER_DAY));
    return entry;
  } catch {
    // A failed write must never block the action it was recording. It is a
    // record of work, not a gate on it.
    return null;
  }
}

/** Read back a span of days, newest last. */
export async function history(days = 30) {
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const log = await readJSON("cockpit", `ledger:${day(d)}`, []);
    if (Array.isArray(log)) out.push(...log);
  }
  return out;
}

/**
 * How long since an action last happened, in days. null means never.
 * This is what The Gap runs on.
 */
export async function daysSince(action, days = 90) {
  const log = await history(days);
  const hits = log.filter((e) => e.action === action);
  if (!hits.length) return null;
  const last = new Date(hits[hits.length - 1].at);
  return Math.floor((Date.now() - last) / 86400000);
}
