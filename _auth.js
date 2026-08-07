import crypto from "node:crypto";

const COOKIE = "vc_session";
const TTL_MS = 1000 * 60 * 60 * 24 * 14; // two weeks

const b64u = (b) => Buffer.from(b).toString("base64url");
const sign = (data, secret) => crypto.createHmac("sha256", secret).update(data).digest("base64url");

/** Constant time compare, so the password check leaks nothing through timing. */
export function safeEqual(a = "", b = "") {
  const A = Buffer.from(String(a));
  const B = Buffer.from(String(b));
  if (A.length !== B.length) {
    crypto.timingSafeEqual(A, A);
    return false;
  }
  return crypto.timingSafeEqual(A, B);
}

export function mintCookie(secret) {
  const payload = b64u(JSON.stringify({ exp: Date.now() + TTL_MS }));
  // Lax, not Strict. Google's OAuth redirect back to /api/oauth-callback is a
  // cross site top level navigation, and Strict withholds the cookie on those,
  // so the callback would 401 immediately after you granted consent. Lax still
  // blocks cross site POSTs and subresource requests, which is the real threat.
  return `${COOKIE}=${payload}.${sign(payload, secret)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${TTL_MS / 1000}`;
}

export const killCookie = () => `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;

function readCookie(req) {
  const raw = req.headers.get("cookie") || "";
  const hit = raw.split(";").map((c) => c.trim()).find((c) => c.startsWith(`${COOKIE}=`));
  return hit ? hit.slice(COOKIE.length + 1) : null;
}

/** Returns null when authenticated, or a Response to return as-is.
    Every function calls this before doing anything else. */
export function requireAuth(req) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return json({ error: "Server not configured" }, 500);

  const token = readCookie(req);
  if (!token) return json({ error: "Not authenticated" }, 401);

  const [payload, sig] = token.split(".");
  if (!payload || !sig) return json({ error: "Not authenticated" }, 401);
  if (!safeEqual(sig, sign(payload, secret))) return json({ error: "Not authenticated" }, 401);

  try {
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (!exp || Date.now() > exp) return json({ error: "Session expired" }, 401);
  } catch {
    return json({ error: "Not authenticated" }, 401);
  }
  return null;
}

export function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...extraHeaders },
  });
}
