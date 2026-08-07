import { safeEqual, mintCookie, killCookie, json } from "./_auth.js";

export default async (req) => {
  if (req.method === "DELETE") return json({ ok: true }, 200, { "set-cookie": killCookie() });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const { SITE_PASSWORD, SESSION_SECRET } = process.env;
  if (!SITE_PASSWORD || !SESSION_SECRET) return json({ error: "Server not configured" }, 500);

  let password = "";
  try {
    ({ password } = await req.json());
  } catch {
    return json({ error: "Bad request" }, 400);
  }

  if (!safeEqual(password, SITE_PASSWORD)) {
    await new Promise((r) => setTimeout(r, 800)); // blunt the brute force
    return json({ error: "Wrong password" }, 401);
  }
  return json({ ok: true }, 200, { "set-cookie": mintCookie(SESSION_SECRET) });
};
