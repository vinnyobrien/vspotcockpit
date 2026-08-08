import { requireAuth, json } from "./_auth.js";
import { record } from "./_ledger.js";

/**
 * POST /api/send-email  → sends through Resend.
 *
 * Two rules, both deliberate:
 *
 *   1. `confirm: true` is required. The house rule is draft only, never send
 *      without approval. A missing flag returns the rendered draft and sends
 *      nothing, so an accidental call can't put mail in front of a client.
 *
 *   2. Every send is written to the ledger. Outbound email is the highest
 *      consequence action in the app, so it is the first thing instrumented.
 *
 * Needs RESEND_API_KEY. The from domain is already verified.
 */

const FROM = process.env.RESEND_FROM || "Vinny O'Brien <vinny@vinnyandco.com>";
const key = () => (process.env.RESEND_API_KEY || "").trim().replace(/^["']|["']$/g, "");

const list = (v) => (Array.isArray(v) ? v : [v]).map((s) => String(s || "").trim()).filter(Boolean);
const looksLikeEmail = (s) => /^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(s);

/** Plain text to minimal HTML. Paragraphs on blank lines, nothing clever. */
const toHtml = (body) =>
  `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#141833">` +
  String(body)
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px">${p.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>")}</p>`)
    .join("") +
  `</div>`;

export default async (req) => {
  const denied = requireAuth(req);
  if (denied) return denied;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body;
  try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }

  const to = list(body.to);
  const subject = String(body.subject || "").trim().slice(0, 200);
  const text = String(body.body || body.text || "").trim();
  const cc = list(body.cc);
  const replyTo = String(body.replyTo || "").trim();
  const context = String(body.context || "").slice(0, 120);   // e.g. "guest.asset_request"

  if (!to.length) return json({ error: "No recipient." }, 400);
  const bad = [...to, ...cc].filter((a) => !looksLikeEmail(a));
  if (bad.length) return json({ error: `Not an address: ${bad.join(", ")}` }, 400);
  if (!subject) return json({ error: "No subject." }, 400);
  if (text.length < 10) return json({ error: "Body is empty." }, 400);

  // Rule 1 — nothing leaves without an explicit tick.
  if (body.confirm !== true) {
    return json({
      sent: false,
      needsConfirmation: true,
      preview: { from: FROM, to, cc, subject, body: text },
      note: "Nothing was sent. Call again with confirm: true.",
    });
  }

  const k = key();
  if (!k) return json({ error: "RESEND_API_KEY is not set on this site." }, 500);

  let res, data;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${k}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to,
        ...(cc.length ? { cc } : {}),
        ...(replyTo ? { reply_to: replyTo } : {}),
        subject,
        text,
        html: toHtml(text),
      }),
    });
    data = await res.json().catch(() => ({}));
  } catch (e) {
    await record("email.failed", { to: to.join(", "), subject, context, error: e.message });
    return json({ error: `Resend unreachable: ${e.message}` }, 502);
  }

  if (!res.ok) {
    const detail = data?.message || data?.name || `status ${res.status}`;
    await record("email.failed", { to: to.join(", "), subject, context, error: String(detail) });
    return json({ error: `Resend refused it: ${detail}` }, 502);
  }

  // Rule 2 — the record is written after the send, never instead of it.
  await record("email.sent", { id: data.id, to: to.join(", "), subject, context });

  return json({ sent: true, id: data.id, to, subject });
};
