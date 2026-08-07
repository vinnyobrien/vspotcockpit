import { requireAuth, json } from "./_auth.js";
import { saveTokens, googleId, googleSecret, googleRedirect } from "./_google.js";

export default async (req) => {
  const denied = requireAuth(req);
  if (denied) return denied;

  const u = new URL(req.url);
  const code = u.searchParams.get("code");
  const service = u.searchParams.get("state") === "youtube" ? "youtube" : "workspace";
  if (!code) return json({ error: "No code" }, 400);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: googleId(),
      client_secret: googleSecret(),
      redirect_uri: googleRedirect(),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    // Google's error codes are diagnostic and contain no secret material.
    let code = "", desc = "";
    try {
      const e = await res.json();
      code = e.error || "";
      desc = String(e.error_description || "").slice(0, 200);
    } catch {
      /* ignore */
    }
    const hints = {
      invalid_client:
        "GOOGLE_CLIENT_SECRET on this site does not match the OAuth client in Google Console. If you rotated the secret recently, check the Netlify value updated in the Production deploy context, not just one of the others.",
      invalid_grant:
        "The authorisation code was already used or has expired. Start again from CONNECT GOOGLE.",
      redirect_uri_mismatch:
        "GOOGLE_REDIRECT_URI does not exactly match an authorised redirect URI in Google Console.",
      unauthorized_client:
        "This OAuth client is not permitted to use the authorization_code grant. Check the client is type Web application.",
    };
    return json(
      { error: `Google rejected the token exchange: ${code || res.status}. ${hints[code] || desc}` },
      502
    );
  }

  await saveTokens(await res.json(), service);
  return new Response(null, { status: 302, headers: { location: `/?connected=${service}` } });
};
