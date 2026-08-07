import { readJSON, writeJSON } from "./_blobs.js";

/* A paste from a console often carries a trailing newline or wrapping quotes.
   Google rejects those as invalid_client with no hint as to why. */
const clean = (v) => (v || "").trim().replace(/^["']|["']$/g, "");
export const googleId = () => clean(process.env.GOOGLE_CLIENT_ID);
export const googleSecret = () => clean(process.env.GOOGLE_CLIENT_SECRET);
export const googleRedirect = () => clean(process.env.GOOGLE_REDIRECT_URI);

/* Google refuses youtube.readonly and drive.file in one consent request, so
   they are two authorisations with two token sets. Nothing about this is a
   workaround: they are genuinely separate grants and are stored separately. */
const TOKEN_KEY = "google:tokens";
const YT_TOKEN_KEY = "google:youtube-tokens";
const keyFor = (service) => (service === "youtube" ? YT_TOKEN_KEY : TOKEN_KEY);

export const YT_SCOPES = "https://www.googleapis.com/auth/youtube.readonly";

export const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/drive.readonly",
  // drive.file is the narrowest write scope Google offers: it grants access
  // ONLY to files this app itself creates. It cannot read, edit or delete
  // anything already in the Drive. Used solely for the user initiated
  // "save to Google Doc" button, never by the assistant on its own.
  "https://www.googleapis.com/auth/drive.file",
].join(" ");

export const scopesFor = (service) => (service === "youtube" ? YT_SCOPES : SCOPES);

/** Read only scopes, deliberately. The assistant proposes, it never sends. */
export async function getAccessToken(service) {
  const KEY = keyFor(service);
  const saved = await readJSON("secrets", KEY, null);
  if (!saved) return null;

  if (saved.expires_at && Date.now() < saved.expires_at - 60_000) return saved.access_token;
  if (!saved.refresh_token) return null;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: googleId(),
      client_secret: googleSecret(),
      refresh_token: saved.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return null;
  const t = await res.json();
  const next = {
    access_token: t.access_token,
    refresh_token: saved.refresh_token,
    expires_at: Date.now() + (t.expires_in || 3600) * 1000,
  };
  await writeJSON("secrets", KEY, next);
  return next.access_token;
}

export async function saveTokens(t, service) {
  await writeJSON("secrets", keyFor(service), {
    access_token: t.access_token,
    refresh_token: t.refresh_token,
    expires_at: Date.now() + (t.expires_in || 3600) * 1000,
  });
}

/** MCP server entries, each carrying the token server side. The browser never sees it. */
export function googleServers(token) {
  if (!token) return [];
  const mk = (url, name) => ({ type: "url", url, name, authorization_token: token });
  return [
    mk("https://gmailmcp.googleapis.com/mcp/v1", "gmail"),
    mk("https://calendarmcp.googleapis.com/mcp/v1", "google-calendar"),
    mk("https://drivemcp.googleapis.com/mcp/v1", "google-drive"),
  ];
}

/* OpusClip, reached over MCP. The key is server side only and never returned
   to the browser, exactly like the Google tokens above. */
export function opusServer() {
  const key = (process.env.OPUS_API_KEY || "").trim().replace(/^["']|["']$/g, "");
  if (!key) return null;
  return { type: "url", url: "https://api.opus.pro/api/mcp", name: "opusclip", authorization_token: key };
}
