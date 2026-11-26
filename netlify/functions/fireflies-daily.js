import { readJSON, writeJSON, store } from "./_blobs.js";
import { anthropicKey } from "./_key.js";
import { recentMeetings, firefliesConfigured } from "./_fireflies.js";
import { record } from "./_ledger.js";
import { createHash } from "node:crypto";

/**
 * netlify/functions/fireflies-daily.js — scheduled transcript poll, every 15 minutes.
 *
 * Polls the recent meeting window, extracts only newly available or changed
 * transcripts, and files the results in the cockpit. A deterministic
 * transcript fingerprint makes the repeated poll cheap and idempotent.
 *
 * Due dates are assigned rather than left blank. An action without a date is
 * a wish, and the whole reason things fall through is that nobody said when.
 * If a date was named in the meeting it is used. If not, the urgency of the
 * commitment sets it — and that assumption is stated on the item, so you can
 * see it was inferred rather than agreed.
 *
 * Env: ANTHROPIC_API_KEY_NEWSDESK, FIREFLIES_API_KEY.
 */

export const config = { schedule: "*/15 * * * *" };

const INBOX = "fireflies-inbox";
const COMMITMENTS = "fireflies-commitments";
const PROCESSED = "fireflies-processed-v1";
const STATUS = "fireflies-status-v1";
const MAX = 300;

const iso = (d) => d.toISOString().slice(0, 10);
const today = () => iso(new Date());
const plus = (n) => iso(new Date(Date.now() + n * 86400000));
const idFor = (kind, parts) => createHash("sha256")
  .update([kind, ...parts].join("\u0000")).digest("hex").slice(0, 20);
const fingerprint = (meeting) => createHash("sha256")
  .update(JSON.stringify([meeting.title, meeting.date, meeting.overview, meeting.actions]))
  .digest("hex");
const unique = (items) => [...new Map(items.map((item) => [item.id, item])).values()];

/** Move legacy Fireflies extracts out of the mirrorable store. Copy and verify
 * each private record before removing its old copy; retries are idempotent. */
async function migratePrivateRecords() {
  const marker = "fireflies-private-migration-v1";
  if (await readJSON("vault", marker, false)) return;

  const priorCommitments = await readJSON("cockpit", "commitments", null);
  if (priorCommitments) {
    const privateCommitments = (await readJSON("vault", COMMITMENTS, {})) || {};
    const moved = {
      actions: unique([...(priorCommitments.actions || []), ...(privateCommitments.actions || [])]),
      decisions: unique([...(priorCommitments.decisions || []), ...(privateCommitments.decisions || [])]),
      updated: privateCommitments.updated || priorCommitments.updated || null,
    };
    await writeJSON("vault", COMMITMENTS, moved);
    const check = await readJSON("vault", COMMITMENTS, {});
    const ids = new Set([...(check.actions || []), ...(check.decisions || [])].map((item) => item.id));
    const expected = [...(priorCommitments.actions || []), ...(priorCommitments.decisions || [])];
    if (expected.some((item) => !ids.has(item.id))) throw new Error("Private Fireflies commitment migration could not be verified.");
    await store("cockpit").delete("commitments");
  }

  const priorInbox = await readJSON("cockpit", "inbox", []);
  const priorInboxRows = Array.isArray(priorInbox) ? priorInbox : [];
  const movedInbox = priorInboxRows.filter((item) => /fireflies/i.test(item.from || ""));
  if (movedInbox.length) {
    const privateInbox = (await readJSON("vault", INBOX, [])) || [];
    const moved = unique([...movedInbox, ...(Array.isArray(privateInbox) ? privateInbox : [])]);
    await writeJSON("vault", INBOX, moved);
    const check = await readJSON("vault", INBOX, []);
    const ids = new Set((Array.isArray(check) ? check : []).map((item) => item.id));
    if (movedInbox.some((item) => !ids.has(item.id))) throw new Error("Private Fireflies inbox migration could not be verified.");
    await writeJSON("cockpit", "inbox", priorInboxRows.filter((item) => !/fireflies/i.test(item.from || "")));
  }

  const priorMemory = await readJSON("cockpit", "business-memory-auto-v1", null);
  if (Array.isArray(priorMemory) && priorMemory.length) {
    const privateMemory = (await readJSON("vault", "business-memory-auto-v1", [])) || [];
    const moved = unique([...priorMemory, ...(Array.isArray(privateMemory) ? privateMemory : [])]);
    await writeJSON("vault", "business-memory-auto-v1", moved);
    const check = await readJSON("vault", "business-memory-auto-v1", []);
    const ids = new Set((Array.isArray(check) ? check : []).map((item) => item.id));
    if (priorMemory.some((item) => !ids.has(item.id))) throw new Error("Private Fireflies memory migration could not be verified.");
    await store("cockpit").delete("business-memory-auto-v1");
  }

  await writeJSON("vault", marker, { completedAt: new Date().toISOString() });
}

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
  try {
    await migratePrivateRecords();
    if (!firefliesConfigured()) throw new Error("FIREFLIES_API_KEY is not set.");
    const { clean: key } = anthropicKey();
    if (!key) throw new Error("No Anthropic key set.");

    const meetings = await recentMeetings(36);
    if (!meetings.length) {
      const previous = (await readJSON("vault", STATUS, {})) || {};
      await writeJSON("vault", STATUS, {
        ...previous, lastCheckedAt: new Date().toISOString(),
        lastNewMeetingCount: 0, lastError: null,
      });
      return new Response("no recent meetings", { status: 200 });
    }

    const processed = (await readJSON("vault", PROCESSED, {})) || {};
    const pending = meetings.filter((meeting) => processed[meeting.id]?.fingerprint !== fingerprint(meeting));
    if (!pending.length) {
      const previous = (await readJSON("vault", STATUS, {})) || {};
      await writeJSON("vault", STATUS, {
        ...previous, lastCheckedAt: new Date().toISOString(),
        lastNewMeetingCount: 0, lastError: null,
      });
      return new Response("no new transcript changes", { status: 200 });
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
        content: JSON.stringify(pending.map((m) => ({
          id: m.id, title: m.title, date: m.date, minutes: m.minutes,
          participants: m.participants, overview: m.overview, actionItems: m.actions,
        })), null, 2),
      }],
    }, key));

    const meetingFor = (title) => pending.find((m) =>
      String(m.title || "").trim().toLowerCase() === String(title || "").trim().toLowerCase()
    ) || null;

    const actions = (out.actions || []).map((a) => ({
      id: idFor("action", [meetingFor(a.meeting)?.id || a.meeting, a.who, a.what]),
      what: String(a.what || "").slice(0, 300),
      who: String(a.who || "").slice(0, 60),
      meeting: String(a.meeting || "").slice(0, 140),
      meetingId: meetingFor(a.meeting)?.id || "",
      meetingDate: meetingFor(a.meeting)?.date || null,
      sourceUrl: meetingFor(a.meeting)?.url || "",
      due: /^\d{4}-\d{2}-\d{2}$/.test(a.due) ? a.due : nextWorking(3),
      agreed: a.agreed === true,
      blocks: String(a.blocks || "").slice(0, 120),
      state: "open",
      raised: today(),
    })).filter((a) => a.what);

    const decisions = (out.decisions || []).map((d) => ({
      id: idFor("decision", [meetingFor(d.meeting)?.id || d.meeting, d.what]),
      what: String(d.what || "").slice(0, 300),
      why: String(d.why || "").slice(0, 300),
      meeting: String(d.meeting || "").slice(0, 140),
      meetingId: meetingFor(d.meeting)?.id || "",
      meetingDate: meetingFor(d.meeting)?.date || null,
      sourceUrl: meetingFor(d.meeting)?.url || "",
      date: today(),
    })).filter((d) => d.what);

    const markProcessed = async () => {
      const next = { ...processed };
      for (const meeting of pending) {
        next[meeting.id] = {
          fingerprint: fingerprint(meeting),
          title: meeting.title,
          processedAt: new Date().toISOString(),
        };
      }
      const recent = Object.entries(next).slice(-1000);
      await writeJSON("vault", PROCESSED, Object.fromEntries(recent));
    };

    if (!actions.length && !decisions.length) {
      await record("fireflies.quiet", { meetings: pending.length, reason: "nothing committed" });
      await markProcessed();
      await writeJSON("vault", STATUS, {
        lastCheckedAt: new Date().toISOString(),
        lastNewMeetingCount: pending.length,
        lastActionCount: 0,
        lastDecisionCount: 0,
        lastError: null,
      });
      return new Response("new meetings, nothing committed to", { status: 200 });
    }

    // Commitments are the durable record. The inbox is just how you notice.
    const prior = (await readJSON("vault", COMMITMENTS, {})) || {};
    await writeJSON("vault", COMMITMENTS, {
      actions: unique([...actions, ...(prior.actions || [])]).slice(0, MAX),
      decisions: unique([...decisions, ...(prior.decisions || [])]).slice(0, MAX),
      updated: new Date().toISOString(),
    });

    const inbox = (await readJSON("vault", INBOX, [])) || [];
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

    await writeJSON("vault", INBOX, unique([...items, ...inbox]).slice(0, MAX));
    // Business Memory's automated lane is separate from manually captured notes.
    // This avoids an hourly job overwriting a note that someone is editing.
    const memoryKey = "business-memory-auto-v1";
    const oldMemory = await readJSON("vault", memoryKey, []);
    const sourceByTitle = new Map(pending.map(m => [String(m.title || "").toLowerCase(), m]));
    const now = new Date().toISOString();
    const autoEntries = [
      ...decisions.map(d => {
        const meeting = sourceByTitle.get(d.meeting.toLowerCase());
        return {
          id: "ff-" + d.id, title: "Decision: " + d.what,
          body: [d.why, "Meeting: " + d.meeting].filter(Boolean).join("\\n\\n"),
          source: meeting?.url || "", kind: "Decision", area: "Unsorted",
          status: "Captured", origin: "Fireflies", sourceId: meeting?.id || "",
          createdAt: now, updatedAt: now, history: [{at:now,action:"Imported from Fireflies"}],
        };
      }),
      ...actions.map(a => {
        const meeting = sourceByTitle.get(a.meeting.toLowerCase());
        return {
          id: "ff-" + a.id, title: a.what,
          body: ["Owner: " + a.who, "Meeting: " + a.meeting,
            "Due: " + a.due + (a.agreed ? " (agreed)" : " (inferred — review)"),
            a.blocks ? "Blocks: " + a.blocks : ""].filter(Boolean).join("\\n"),
          source: meeting?.url || "", kind: "Meeting", area: "Unsorted",
          status: "Captured", origin: "Fireflies", sourceId: meeting?.id || "",
          createdAt: now, updatedAt: now, history: [{at:now,action:"Imported from Fireflies"}],
        };
      }),
    ];
    const byId = new Map((Array.isArray(oldMemory) ? oldMemory : []).map(entry => [entry.id,entry]));
    for (const entry of autoEntries) if (!byId.has(entry.id)) byId.set(entry.id,entry);
    await writeJSON("vault", memoryKey, [...byId.values()].slice(-MAX).reverse());

    await record("fireflies.filed", {
      meetings: pending.length, actions: actions.length, decisions: decisions.length,
    });
    await markProcessed();
    await writeJSON("vault", STATUS, {
      lastCheckedAt: new Date().toISOString(),
      lastFiledAt: new Date().toISOString(),
      lastNewMeetingCount: pending.length,
      lastActionCount: actions.length,
      lastDecisionCount: decisions.length,
      lastError: null,
    });

    return new Response(`filed ${actions.length} actions, ${decisions.length} decisions`, { status: 200 });

  } catch (e) {
    const message = String(e.message || e).slice(0, 300);
    await record("fireflies.failed", { error: message });
    try {
      const previous = (await readJSON("vault", STATUS, {})) || {};
      await writeJSON("vault", STATUS, {
        ...previous, lastCheckedAt: new Date().toISOString(),
        lastErrorAt: new Date().toISOString(), lastError: message,
      });
    } catch { /* Preserve the original scheduled-job error. */ }
    return new Response(`failed: ${e.message}`, { status: 500 });
  }
};
