import { requireAuth, json } from "./_auth.js";
import { getAccessToken } from "./_google.js";

/**
 * Creates a NEW Google Doc from text the user chose to save. Uses the
 * drive.file scope, so it can only touch documents it created itself.
 * This is user initiated only. Nothing calls it automatically.
 */
export default async (req) => {
  const denied = requireAuth(req);
  if (denied) return denied;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let title, body;
  try {
    ({ title, body } = await req.json());
  } catch {
    return json({ error: "Bad request" }, 400);
  }
  if (!body || typeof body !== "string") return json({ error: "Nothing to save" }, 400);

  const token = await getAccessToken();
  if (!token) return json({ error: "Google is not connected. Use CONNECT GOOGLE in the footer first." }, 428);

  const name = (title || "Untitled").toString().slice(0, 120);
  const boundary = "cockpit-" + Math.random().toString(36).slice(2);
  const metadata = { name, mimeType: "application/vnd.google-apps.document" };

  const multipart =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n` +
    `${body.slice(0, 200000)}\r\n--${boundary}--`;

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: multipart,
    }
  );

  if (!res.ok) {
    let hint = "";
    try {
      const e = await res.json();
      hint = e?.error?.message ? String(e.error.message).slice(0, 200) : "";
    } catch {
      /* ignore */
    }
    if (res.status === 403) hint = "Reconnect Google. The document scope was added after you first authorised.";
    return json({ error: `Google returned ${res.status}. ${hint}` }, 502);
  }

  const doc = await res.json();
  return json({ ok: true, id: doc.id, name: doc.name, url: doc.webViewLink });
};
