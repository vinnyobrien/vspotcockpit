import { requireAuth, json } from "./_auth.js";
import { anthropicKey, keySource } from "./_key.js";
import { getAccessToken, opusServer } from "./_google.js";
import crypto from "node:crypto";

/* A short one way fingerprint. Enough to tell whether a value CHANGED,
   useless for recovering the value itself. */
const fp = (v) => (v ? crypto.createHash("sha256").update(v).digest("hex").slice(0, 12) : null);

/** Reports the SHAPE of configuration, never a value. Safe to call while
    signed in, useless to anyone else. */
export default async (req) => {
  const denied = requireAuth(req);
  if (denied) return denied;

  const [ws, yt] = await Promise.all([
    getAccessToken().catch(() => null),
    getAccessToken("youtube").catch(() => null),
  ]);

  const { raw, clean } = anthropicKey();

  return json({
    anthropicKey: {
      readFrom: keySource(),
      present: !!raw,
      rawLength: raw.length,
      trimmedLength: clean.length,
      hadWhitespace: raw !== raw.trim(),
      hadQuotes: /^["']|["']$/.test(raw.trim()),
      prefix: clean.slice(0, 7),
      looksRight: clean.startsWith("sk-ant-") && clean.length > 90,
    },
    opus: {
      keySet: !!opusServer(),
      length: (process.env.OPUS_API_KEY || "").trim().length,
      fingerprint: fp((process.env.OPUS_API_KEY || "").trim()),
    },
    github: {
      keySet: !!(process.env.GITHUB_TOKEN || "").trim(),
      length: (process.env.GITHUB_TOKEN || "").trim().length,
      prefix: (process.env.GITHUB_TOKEN || "").trim().slice(0, 11),
      looksRight: /^(github_pat_|ghp_)/.test((process.env.GITHUB_TOKEN || "").trim()),
    },
    sessionSecret: !!process.env.SESSION_SECRET,
    sitePassword: !!process.env.SITE_PASSWORD,
    google: {
      // Client IDs are not secret, so the tail is shown to confirm which
      // OAuth client this site is pointed at.
      clientIdTail: (process.env.GOOGLE_CLIENT_ID || "").slice(-30) || null,
      clientSecretFingerprint: fp((process.env.GOOGLE_CLIENT_SECRET || "").trim()),
      clientSecretLength: (process.env.GOOGLE_CLIENT_SECRET || "").trim().length,
      redirectUri: process.env.GOOGLE_REDIRECT_URI || null,
      workspaceConnected: !!ws,
      youtubeConnected: !!yt,
    },
  });
};
