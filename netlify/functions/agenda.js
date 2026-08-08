import { requireAuth, json } from "./_auth.js";
import { getAccessToken } from "./_google.js";

/**
 * GET /api/agenda  → today's calendar, in the shape the diary ticker wants.
 *
 * Read only. Uses the calendar.readonly scope already granted, so no consent
 * change is needed. If Google is not connected this returns a named reason
 * rather than an empty list — a silent empty agenda looks like a free day.
 */

const clip = (s, n) => String(s || "").slice(0, n);

/** Meet, Zoom and Teams all surface differently. Check every plausible spot. */
function joinUrl(e) {
  if (e.hangoutLink) return e.hangoutLink;
  const entry = e.conferenceData?.entryPoints?.find((p) => p.entryPointType === "video");
  if (entry?.uri) return entry.uri;
  const hay = `${e.location || ""} ${e.description || ""}`;
  const m = hay.match(/https:\/\/[^\s<>"]*(zoom\.us|teams\.microsoft|meet\.google|whereby|streamyard)[^\s<>"]*/i);
  return m ? m[0] : null;
}

const mins = (a, b) => Math.max(0, Math.round((new Date(b) - new Date(a)) / 60000));
const label = (n) => (n >= 60 ? `${Math.floor(n / 60)}h${n % 60 ? ` ${n % 60}m` : ""}` : `${n}m`);

export default async (req) => {
  const denied = requireAuth(req);
  if (denied) return denied;

  const token = await getAccessToken();
  if (!token) return json({ connected: false, reason: "Google is not connected.", events: [] });

  // Local midnight to local midnight — not UTC, or the day boundary drifts.
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const to = new Date(from.getTime() + 86400000);

  const url =
    "https://www.googleapis.com/calendar/v3/calendars/primary/events" +
    `?timeMin=${encodeURIComponent(from.toISOString())}` +
    `&timeMax=${encodeURIComponent(to.toISOString())}` +
    "&singleEvents=true&orderBy=startTime&maxResults=40";

  let res;
  try {
    res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  } catch (e) {
    return json({ connected: true, reason: `Calendar unreachable: ${e.message}`, events: [] }, 502);
  }

  if (!res.ok) {
    const hint =
      res.status === 401 ? "Google rejected the token. Reconnect in the footer."
      : res.status === 403 ? "Calendar API not enabled, or scope missing."
      : `Calendar returned ${res.status}.`;
    return json({ connected: true, reason: hint, events: [] }, 502);
  }

  const data = await res.json();

  const events = (data.items || [])
    .filter((e) => e.status !== "cancelled")
    .map((e) => {
      const startISO = e.start?.dateTime || e.start?.date;
      const endISO = e.end?.dateTime || e.end?.date;
      const allDay = !e.start?.dateTime;
      const start = new Date(startISO);
      const n = allDay ? 0 : mins(startISO, endISO);
      return {
        id: e.id,
        at: allDay ? "All day" : start.toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit", hour12: false }),
        startISO,
        who: clip(e.summary, 120) || "Untitled",
        len: allDay ? "" : label(n),
        join: joinUrl(e),
        // Anyone other than you, so the ticker can name the room.
        with: (e.attendees || []).filter((a) => !a.self).map((a) => clip(a.displayName || a.email, 60)).slice(0, 6),
        past: !allDay && new Date(endISO) < now,
        allDay,
      };
    });

  // The next thing that hasn't finished. What the ticker highlights.
  const next = events.find((e) => !e.past && !e.allDay) || null;

  return json({
    connected: true,
    date: from.toISOString().slice(0, 10),
    events,
    nextId: next?.id || null,
    // A genuinely empty day and a broken connection must not look the same.
    empty: events.length === 0,
  });
};
