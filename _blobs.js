import { getStore } from "@netlify/blobs";

/**
 * Three stores, and no code path reads across the boundary.
 *   cockpit : day state, ledger, threads, signals. Mirrorable.
 *   vault   : client and commercial material. Never mirrored, never used to
 *             inform anything destined for publication.
 *   secrets : OAuth tokens. Never reachable from the browser, by construction.
 */
export const CLIENT_STORES = ["cockpit", "vault"]; // 'secrets' deliberately absent

export const store = (name) => getStore({ name, consistency: "strong" });

export async function readJSON(name, key, fallback = null) {
  try {
    const v = await store(name).get(key, { type: "json" });
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

export async function writeJSON(name, key, value) {
  await store(name).setJSON(key, value);
  return true;
}
