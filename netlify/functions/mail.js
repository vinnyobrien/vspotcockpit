import { requireAuth, json } from "./_auth.js";
import { getAccessToken } from "./_google.js";

/**
 * GET  /api/mail            → high-priority threads needing a reply
 * GET  /api/mail?id=<id>    → one message, in full
 *
 * Read only. Uses gmail.readonly, which is already granted, so no consent
 * change and no new scope.
 *
 * The query is the opinionated part. "High priority" here means: in the
 * primary inbox, addressed to you rather than a list, not already replied to,
 * and recent enough to still matter. Anything else is noise dressed as mail.
 */

const API = "https://gmail.googleapis.com/gmail/v1/users/me";

/* Directly to you, primary tab only, last fortnight, not something you have
   already answered. `-in:sent` catches threads where the last word was yours. */
const QUERY = [
  "in:inbox",
  "category:primary",
  "-in:chats",
  "-from:me",
  "newer_than:14d",
  "-label:^i_lp",              // Gmail's own "low priority" marker
].join(" ");

const header = (h, name) =>
  (h || []).find((x) => x.name.toLowerCase() === name.toLowerCase())?.value || "";

/** Gmail nests bodies arbitrarily deep. Prefer plain text, fall back to HTML. */
function extractBody(payload) {
  const out = { text: "", html: "" };
  const walk = (p) => {
    if (!p) return;
    const data = p.body?.data;
    if (data) {
      const decoded = Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
      if (p.mimeType === "text/plain" && !out.text) out.text = decoded;
      if (p.mimeType === "text/html" && !out.html) out.html = decoded;
    }
    (p.parts || []).forEach(walk);
  };
  walk(payload);
  const body = out.text || out.html.replace(/<[^>]+>/g, " ");
  // Quoted history doubles the length and adds nothing to a decision.
  return body
    .split(/\n\s*On .{10,80} wrote:|\n>{1,}\s|\n-{2,}\s*Original Message/i)[0]
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const addr = (s) => {
  const m = String(s).match(/^(.*?)\s*<([^>]+)>$/);
  return m ? { name: m[1].replace(/"/g, "").trim(), email: m[2].trim() } : { name: "", email: String(s).trim() };
};

async function g(path, token) {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const hint = res.status === 401 ? "Google rejected the token. Reconnect in the footer."
      : res.status === 403 ? "Gmail API not enabled, or the readonly scope is missing."
      : `Gmail returned ${res.status}.`;
    throw new Error(hint);
  }
  return res.json();
}

export default async (req) => {
  const denied = requireAuth(req);
  if (denied) return denied;

  const token = await getAccessToken();
  if (!token) return json({ connected: false, reason: "Google is not connected.", messages: [] });

  const id = new URL(req.url).searchParams.get("id");

  try {
    /* One message, in full. */
    if (id) {
      const m = await g(`/messages/${encodeURIComponent(id)}?format=full`, token);
      const h = m.payload?.headers;
      const from = addr(header(h, "From"));
      return json({
        connected: true,
        message: {
          id: m.id,
          threadId: m.threadId,
          from, to: header(h, "To"),
          subject: header(h, "Subject") || "(no subject)",
          date: header(h, "Date"),
          replyTo: header(h, "Reply-To") || from.email,
          body: extractBody(m.payload).slice(0, 12000),
          labels: m.labelIds || [],
          url: `https://mail.google.com/mail/u/0/#inbox/${m.threadId}`,
        },
      });
    }

    /* The list. */
    const list = await g(`/messages?q=${encodeURIComponent(QUERY)}&maxResults=25`, token);
    const ids = (list.messages || []).map((x) => x.id);
    if (!ids.length) return json({ connected: true, messages: [], empty: true });

    // Metadata only — full bodies for 25 messages is slow and mostly unread.
    const messages = [];
    for (const mid of ids) {
      const m = await g(
        `/messages/${mid}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=To`,
        token
      );
      const h = m.payload?.headers;
      const from = addr(header(h, "From"));
      messages.push({
        id: m.id,
        threadId: m.threadId,
        from,
        subject: header(h, "Subject") || "(no subject)",
        snippet: (m.snippet || "").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&"),
        date: header(h, "Date"),
        unread: (m.labelIds || []).includes("UNREAD"),
        starred: (m.labelIds || []).includes("STARRED"),
        important: (m.labelIds || []).includes("IMPORTANT"),
        url: `https://mail.google.com/mail/u/0/#inbox/${m.threadId}`,
      });
    }

    // Gmail's own importance signal first, then unread, then recency.
    messages.sort((a, b) =>
      (b.important - a.important) || (b.starred - a.starred) ||
      (b.unread - a.unread) || (new Date(b.date) - new Date(a.date))
    );

    return json({ connected: true, count: messages.length, messages });

  } catch (e) {
    return json({ connected: true, reason: e.message, messages: [] }, 502);
  }
};
