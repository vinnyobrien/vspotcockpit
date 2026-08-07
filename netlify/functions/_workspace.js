/**
 * Reads Calendar and Gmail through Google's generally available REST APIs.
 *
 * This replaces the Workspace MCP servers, which are still gated behind the
 * Google Workspace Developer Preview Program and return 400 to clients outside
 * it. Doing the fetching here has two advantages beyond just working:
 *
 *   1. The model gets no tools at all on the sweep, so it is structurally
 *      incapable of sending, deleting or modifying anything. Read only stops
 *      being a promise in a prompt and becomes a property of the system.
 *   2. We control exactly what leaves Google: headers, snippets and a hard cap.
 *      Full message bodies are never fetched.
 */

/* Standing mutes. These are noise, permanently, by Vinny's instruction:
   Ed O'Regan's weekly football mail (he does not play), and Flower Factory
   reporting (he asked to be removed and it kept coming). */
const MUTE_FROM = ["oregan", "flowerfactory", "flower factory"];
const MUTE_SUBJECT = ["football", "5-a-side", "five a side"];

const muted = (from, subject) => {
  const f = (from || "").toLowerCase();
  const s = (subject || "").toLowerCase();
  if (MUTE_FROM.some((m) => f.includes(m))) return true;
  return f.includes("oregan") && MUTE_SUBJECT.some((m) => s.includes(m));
};

const GAPI = {
  events: "https://www.googleapis.com/calendar/v3/calendars/primary/events",
  list: "https://gmail.googleapis.com/gmail/v1/users/me/messages",
  msg: (id) => `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}`,
};

async function get(url, token) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    let detail = "";
    try {
      const e = await res.json();
      detail = e?.error?.message || "";
    } catch {
      /* ignore */
    }
    throw new Error(`${res.status} ${detail}`.trim());
  }
  return res.json();
}

const header = (m, name) =>
  (m.payload?.headers || []).find((h) => h.name.toLowerCase() === name)?.value || "";

export async function fetchCalendar(token) {
  const now = new Date();
  const end = new Date(now.getTime() + 36 * 3600 * 1000);
  const url =
    `${GAPI.events}?timeMin=${now.toISOString()}&timeMax=${end.toISOString()}` +
    `&singleEvents=true&orderBy=startTime&maxResults=20`;
  const data = await get(url, token);
  return (data.items || []).map((e) => ({
    summary: e.summary || "(no title)",
    start: e.start?.dateTime || e.start?.date || "",
    end: e.end?.dateTime || e.end?.date || "",
    attendees: (e.attendees || []).map((a) => a.email).slice(0, 8),
    location: e.location || "",
    link: e.htmlLink || "",
    description: (e.description || "").slice(0, 300),
  }));
}

async function messagesFor(query, token, max) {
  const list = await get(`${GAPI.list}?q=${encodeURIComponent(query)}&maxResults=${max}`, token);
  return (list.messages || []).map((m) => m.id);
}

export async function fetchGmail(token) {
  // Recent inbox mail he has not sent himself. Snippets only, never bodies.
  const ids = await messagesFor(
    "in:inbox newer_than:4d -from:me -category:promotions -category:social",
    token,
    18
  );

  const msgs = await Promise.allSettled(
    ids.map((id) =>
      get(
        `${GAPI.msg(id)}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=To`,
        token
      )
    )
  );

  return msgs
    .filter((r) => r.status === "fulfilled")
    .map((r) => r.value)
    .map((m) => ({
      id: m.id,
      threadId: m.threadId,
      from: header(m, "from"),
      subject: header(m, "subject"),
      date: header(m, "date"),
      snippet: (m.snippet || "").slice(0, 400),
      unread: (m.labelIds || []).includes("UNREAD"),
      link: `https://mail.google.com/mail/u/0/#inbox/${m.threadId}`,
    }))
    .filter((m) => !muted(m.from, m.subject));
}

/* The Promotions tab is where the good reports hide. Research, benchmarks and
   state-of-industry PDFs from vendors are Sunday Supplement fuel, not inbox
   noise, so they are fetched separately and land in their own tab. */
export async function fetchSupplement(token) {
  const ids = await messagesFor(
    "category:promotions newer_than:10d (report OR research OR benchmark OR study OR whitepaper OR \"state of\" OR index OR survey OR data OR trends)",
    token,
    20
  );

  const msgs = await Promise.allSettled(
    ids.map((id) =>
      get(`${GAPI.msg(id)}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`, token)
    )
  );

  return msgs
    .filter((r) => r.status === "fulfilled")
    .map((r) => r.value)
    .map((m) => ({
      from: header(m, "from"),
      subject: header(m, "subject"),
      date: header(m, "date"),
      snippet: (m.snippet || "").slice(0, 400),
      link: `https://mail.google.com/mail/u/0/#inbox/${m.threadId}`,
    }))
    .filter((m) => !muted(m.from, m.subject));
}

/** Never throws. A failed source is reported, never silently presented as empty. */
export async function fetchBriefing(token) {
  const out = { calendar: [], gmail: [], supplement: [], failures: [] };

  const [cal, mail, supp] = await Promise.allSettled([
    fetchCalendar(token),
    fetchGmail(token),
    fetchSupplement(token),
  ]);

  if (cal.status === "fulfilled") out.calendar = cal.value;
  else out.failures.push({ source: "calendar", error: String(cal.reason?.message || cal.reason) });

  if (mail.status === "fulfilled") out.gmail = mail.value;
  else out.failures.push({ source: "gmail", error: String(mail.reason?.message || mail.reason) });

  if (supp.status === "fulfilled") out.supplement = supp.value;
  else out.failures.push({ source: "promotions", error: String(supp.reason?.message || supp.reason) });

  return out;
}
