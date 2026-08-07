import { requireAuth, json } from "./_auth.js";
import { scopesFor, googleId, googleRedirect } from "./_google.js";

export default async (req) => {
  const denied = requireAuth(req);
  if (denied) return denied;

  const GOOGLE_CLIENT_ID = googleId();
  const GOOGLE_REDIRECT_URI = googleRedirect();
  if (!GOOGLE_CLIENT_ID || !GOOGLE_REDIRECT_URI) return json({ error: "Google not configured" }, 500);

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", GOOGLE_CLIENT_ID);
  url.searchParams.set("redirect_uri", GOOGLE_REDIRECT_URI);
  url.searchParams.set("response_type", "code");
  const service = new URL(req.url).searchParams.get("service") === "youtube" ? "youtube" : "workspace";
  url.searchParams.set("scope", scopesFor(service));
  url.searchParams.set("state", service);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");

  return Response.redirect(url.toString(), 302);
};
