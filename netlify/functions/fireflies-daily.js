import { readJSON, writeJSON } from "./_blobs.js";
import { anthropicKey } from "./_key.js";
import { recentMeetings, firefliesConfigured } from "./_fireflies.js";
import { record } from "./_ledger.js";

/**
 * netlify/functions/fireflies-daily.js  —  scheduled, hourly, acts at 08:00.
 *
 * Pulls yesterday's meetings, extracts what was committed to and what was
 * decided, gives every action a due date, and files it all before you open the
 * app. The Fireflies read is slow, so it happens while you are asleep rather
 * than while you are waiting.
 *
 * Due dates are assigned rather than left blank. An action without a date is
 * a wish, and the whole reason things fall through is that nobody said when.
 * If a date was named in the meeting it is used. If not, the urgency of the
 * commitment sets it — and that assumption is stated on the item, so you can
 * see it was inferred rather than agreed.
 *
 * Env: ANTHROPIC_API_KEY_NEWSDESK, FIREFLIES_API_KEY.
 */

export const config = { schedule: "@hourly" };

const HOUR = 8;                       // Dublin local
const INBOX = "inbox";
const COMMITMENTS = "commitments";
const MAX = 300;

const dublinHour = () =>
  Number(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Dublin", hour: "2-digit", hour12: false,
  }).format(new Date()));

const iso = (d) => d.toISOString().slice(0, 10);
const today = () => iso(new Date());
const plus = (n) => iso(new Date(Date.now() + n * 86400000));

/** Next weekday, so nothing lands due on a Saturday nobody works. */
function nextWorking(days) {
  const d = new Date(Date.now() + days * 86400000);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return iso(d);
}

async function anthropic(payload, key) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(`Anthropic ${res.status}. ${e?.error?.message || ""}`.trim());
  }
  const data = await res.json();
  return (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
}

const parseObj = (t) => {
  const s = String(t).replace(/```json|```/g, "").trim();
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a === -1 || b === -1) throw new Error(`Expected an object, got: ${s.slice(0, 200)}`);
  return JSON.parse(s.slice(a, b + 1));
};

export default async () => {
  if (dublinHour() !== HOUR) return new Response("not the hour", { status: 200 });

  const ranKey = `fireflies-ran:${today()}`;
  if (await readJSON("cockpit", ranKey, false)) {
    return new Response("already ran today", { status: 200 });
  }
  await writeJSON("cockpit", ranKey, true);

  try {
    if (!firefliesConfigured()) throw new Error("FIREFLIES_API_KEY is not set.");
    const { clean: key } = anthropicKey();
    if (!key) throw new Error("No Anthropic key set.");

    // 36 hours so a Monday morning still catches Friday afternoon.
    const meetings = await recentMeetings(36);
    if (!meetings.length) {
      await record("fireflies.quiet", { reason: "no meetings" });
      return new Response("no meetings", { status: 200 });
    }

    const out = parseObj(await anthropic({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      system: `You are reading yesterday's meetings and pulling out what was committed to
and what was decided.

An ACTION is something a named person agreed to do. Not a topic that came up,
not a possibility floated. If nobody committed, it is not an action.

A DECISION is a settled question with its reasoning. Decisions are worth more
than actions and get lost faster, because nobody writes them down.

EVERY action gets a due date. Use this ladder:
  · a date was named in the meeting        → use it, and set "agreed": true
  · "by end of week", "next week" etc      → resolve to a date, "agreed": true
  · nothing said, but it blocks someone    → 1 working day, "agreed": false
  · nothing said, ordinary commitment      → 3 working days, "agreed": false
  · nothing said, background task          → 7 working days, "agreed": false

"agreed": false means you inferred the date. Say so — an invented deadline
presented as an agreed one is worse than no deadline at all.

Today is ${today()}. Use YYYY-MM-DD.

Return ONLY JSON:
{
  "actions": [{ "who": "", "what": "", "meeting": "", "due": "", "agreed": false, "blocks": "" }],
  "decisions": [{ "what": "", "why": "", "meeting": "" }]
}

Use the words that were actually said. Do not smooth them into business prose.
If the reasoning on a decision was not stated, write "reason not stated" rather
than supplying a plausible one. An empty list is a valid answer.`,
      messages: [{
        role: "user",
        content: JSON.stringify(meetings.map((m) => ({
          title: m.title, date: m.date, minutes: m.minutes,
          participants: m.participants, overview: m.overview, actionItems: m.actions,
        })), null, 2),
      }],
    }, key));

    const actions = (out.actions || []).map((a) => ({
      id: Math.random().toString(36).slice(2),
      what: String(a.what || "").slice(0, 300),
      who: String(a.who || "").slice(0, 60),
      meeting: String(a.meeting || "").slice(0, 140),
      due: /^\d{4}-\d{2}-\d{2}$/.test(a.due) ? a.due : nextWorking(3),
      agreed: a.agreed === true,
      blocks: String(a.blocks || "").slice(0, 120),
      state: "open",
      raised: today(),
    })).filter((a) => a.what);

    const decisions = (out.decisions || []).map((d) => ({
      id: Math.random().toString(36).slice(2),
      what: String(d.what || "").slice(0, 300),
      why: String(d.why || "").slice(0, 300),
      meeting: String(d.meeting || "").slice(0, 140),
      date: today(),
    })).filter((d) => d.what);

    if (!actions.length && !decisions.length) {
      await record("fireflies.quiet", { meetings: meetings.length, reason: "nothing committed" });
      return new Response("meetings, but nothing committed to", { status: 200 });
    }

    // Commitments are the durable record. The inbox is just how you notice.
    const prior = (await readJSON("cockpit", COMMITMENTS, {})) || {};
    await writeJSON("cockpit", COMMITMENTS, {
      actions: [...actions, ...(prior.actions || [])].slice(0, MAX),
      decisions: [...decisions, ...(prior.decisions || [])].slice(0, MAX),
      updated: new Date().toISOString(),
    });

    const inbox = (await readJSON("cockpit", INBOX, [])) || [];
    const items = [
      ...decisions.map((d) => ({
        id: d.id, at: new Date().toISOString(),
        title: `Decision: ${d.what}`,
        body: [d.why, d.meeting].filter(Boolean).join("\n\n"),
        room: null, from: "Fireflies", tag: "decision", seen: false,
      })),
      ...actions.map((a) => ({
        id: a.id, at: new Date().toISOString(),
        title: a.what,
        body: [
          `${a.who} · ${a.meeting}`,
          `Due ${a.due}${a.agreed ? " (agreed in the meeting)" : " (assumed — nobody said when)"}`,
          a.blocks ? `Blocks: ${a.blocks}` : "",
        ].filter(Boolean).join("\n"),
        room: null, from: "Fireflies", tag: "action", seen: false,
      })),
    ];

    await writeJSON("cockpit", INBOX, [...items, ...inbox].slice(0, MAX));
    await record("fireflies.filed", {
      meetings: meetings.length, actions: actions.length, decisions: decisions.length,
    });

    return new Response(`filed ${actions.length} actions, ${decisions.length} decisions`, { status: 200 });

  } catch (e) {
    await record("fireflies.failed", { error: String(e.message || e).slice(0, 300) });
    return new Response(`failed: ${e.message}`, { status: 200 });
  }
};
