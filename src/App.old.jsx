import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";

/* ============================================================
   THE COCKPIT  ·  A V SPOT NETWORK PRODUCTION
   Daily operations rundown for Vinny O'Brien
   ============================================================ */

const C = {
  red: "#B81A1D",
  navy: "#EDEBE4",
  black: "#F5F3EE",
  tan: "#565C82",
  grey: "#767CA0",
  navyLift: "#F2E6D0",
  navyDeep: "#FFFFFF",
  line: "rgba(20,24,51,0.12)",
};

const FONT_D = "'Big Shoulders Display', 'Oswald', Impact, sans-serif";
const FONT_B = "'IBM Plex Sans', system-ui, sans-serif";
const FONT_M = "'IBM Plex Mono', ui-monospace, monospace";

/* ---------- the rundown ---------- */

const DAILY = [
  { id: "wire", slot: "07:00", name: "The Wire", note: "Read the headlines. Pick the one story you are carrying today.", w: 1, lane: "content" },
  { id: "sixty", slot: "07:30", name: "Sixty Seconds", note: "Record and post the YouTube Short. Yesterday, and what you think about it. End on the hook into Sunday.", w: 3, lane: "content" },
  { id: "fnd-inbox", slot: "09:00", name: "Foundrae inbox", note: "Clear it. House rules: short, clear, linked, decision named.", w: 2, lane: "foundrae" },
  { id: "fnd-deep", slot: "10:00", name: "Foundrae deep work", note: "Ninety minutes. One named workstream. Phone in another room.", w: 3, lane: "foundrae" },
  { id: "fnd-listen", slot: "11:30", name: "Listen back", note: "One call recording or transcript. Notes into the log, not your head.", w: 1, lane: "foundrae" },
  { id: "post", slot: "12:30", name: "The Post", note: "LinkedIn text post. Second hit of the day.", w: 2, lane: "content" },
  { id: "approach", slot: "14:00", name: "The Approach", note: "One proactive move. Build the thing first, then send it.", w: 2, lane: "pipeline" },
  { id: "vspot", slot: "16:00", name: "The V Spot", note: "Daily news drop. It is daily now.", w: 3, lane: "content" },
  { id: "shutdown", slot: "17:30", name: "Shutdown", note: "Log the day. Name tomorrow's three before you close the lid.", w: 1, lane: "ops" },
];

const FIXTURES = {
  1: [{ id: "pipeline", slot: "15:00", name: "Pipeline review", note: "Sponsor conversations. Who moved, who stalled, who is next.", w: 2, lane: "pipeline" }],
  2: [{ id: "ostrich", slot: "15:00", name: "The Ostrich Report", note: "Record with Hendrik. Diary slot, not a maybe.", w: 3, lane: "content" }],
  3: [{ id: "fnd-session", slot: "14:00", name: "Foundrae client session", note: "Twenty minutes prep before. Agenda sent the night before.", w: 2, lane: "foundrae" }],
  4: [{ id: "longform", slot: "13:00", name: "Substack long form", note: "The week's essay. Write it, do not research it.", w: 3, lane: "content" }],
  5: [
    { id: "supplement", slot: "11:00", name: "The Sunday Supplement", note: "Record the long form for YouTube. Mark three moments while recording that can be cut as Shorts.", w: 3, lane: "content" },
    { id: "calibrate", slot: "17:00", name: "Week calibration", note: "Read the score. Adjust next week's volume honestly.", w: 1, lane: "ops" },
  ],
  0: [{ id: "supp-out", slot: "10:00", name: "Supplement publishes", note: "Check it went out. Then go and do something else.", w: 1, lane: "ops" }],
};

const ACCOUNTS = [
  { id: "6853f3c16581970b2eebf51a", platform: "YouTube", short: "YT" },
  { id: "6a6a4fc9b6bbd46119642533", platform: "TikTok", short: "TT" },
  { id: "6a6a4ff343c4264488aa4fa0", platform: "X", short: "X" },
];

const LANE = {
  content: { label: "CONTENT", c: C.red },
  foundrae: { label: "FOUNDRAE", c: C.tan },
  pipeline: { label: "PIPELINE", c: "#3D7A91" },
  ops: { label: "OPS", c: C.grey },
};


/* Output kinds holding client or commercial material. These live in a separate
   local vault, never enter the mirrorable ledger, and never leave the device. */
const CONFIDENTIAL = new Set(["foundrae", "reply", "sponsor"]);

/* ---------- the floor ----------
   The irreducible day. When life takes over, this is what still happens.
   A floor day is a legitimate outcome, not a failure. */
const FLOOR_IDS = ["sixty", "vspot", "fnd-inbox"];

/* ---------- running threads ----------
   Seeded from Vinny's actual published history. "seeded" means the last-touch
   date came from chat archaeology, not from the cockpit's own record, so it is
   approximate. Once the cockpit logs a real touch, that flag drops away. */

const SEED_THREADS = [
  { id: "friction", name: "Friction as currency", note: "The twenty years deleting friction essay. Friction does not disappear, it moves.", last: "2026-05-26", seeded: true },
  { id: "agentic", name: "Agentic commerce, promotion goes dark", note: "Price agents, Black Friday as Schelling point, the transparency paradox, the BNPL two agent standoff.", last: "2026-05-26", seeded: true },
  { id: "deminimis", name: "De minimis and tariffs", note: "Standing coverage. The chaos, as ever, is the policy.", last: "2026-07-23", seeded: true },
  { id: "joybuy", name: "Joybuy shock doctrine", note: "Chapter three was the Ocado retail media hire. Monetisation staffed before anyone noticed the logistics landed.", last: "2026-07-23", seeded: true },
  { id: "china-eu", name: "Chinese platforms in Europe", note: "Temu, Shein's half price listing, JD. The Cross-Border Magazine piece sits here.", last: "2026-07-23", seeded: true },
  { id: "shopify-bank", name: "Shopify is quietly a bank", note: "The 1.35bn merchant lending book. Lenders get tested in downturns.", last: "2026-07-23", seeded: true },
  { id: "post-purchase", name: "Post purchase land grab", note: "TikTok logistics, the Parcel Planet frame. Own the moment before a platform does.", last: "2026-03-04", seeded: true },
  { id: "identity", name: "Identity as the agentic battleground", note: "Flagged off the fraud ring story, never run. This one is loaded and unfired.", last: null, seeded: true },
  { id: "sovereignty", name: "European AI sovereignty", note: "The Reformation frame, Karen Hao, the pseudo religion essay.", last: null, seeded: true },
  { id: "infrastructure", name: "Infrastructure quietly winning", note: "The unglamorous layer takes the value while everyone watches the interface.", last: null, seeded: true },
  { id: "store", name: "The store is not dead", note: "It just had to get interesting again.", last: null, seeded: true },
];

const MAX_LEDGER = 180;

/* ---------- connected platforms ---------- */

const MCP = {
  gmail: { type: "url", url: "https://gmailmcp.googleapis.com/mcp/v1", name: "gmail" },
  calendar: { type: "url", url: "https://calendarmcp.googleapis.com/mcp/v1", name: "google-calendar" },
  drive: { type: "url", url: "https://drivemcp.googleapis.com/mcp/v1", name: "google-drive" },
  slack: { type: "url", url: "https://mcp.slack.com/mcp", name: "slack" },
  asana: { type: "url", url: "https://mcp.asana.com/v2/mcp", name: "asana" },
  fireflies: { type: "url", url: "https://api.fireflies.ai/mcp", name: "fireflies" },
  notion: { type: "url", url: "https://mcp.notion.com/mcp", name: "notion" },
};



/* ---------- storage ---------- */

const K = {
  day: (d) => `day:${d}`,
  hist: "history",
  ledger: "ledger",
  threads: "threads",
  vault: "vault:entries", // routed to the separate vault store by api.js
  signals: "signals",
  sources: "sources",
  reading: "reading-list",
  calendar: "content-calendar",
  shorts: (d) => `shorts:${d}`,
  published: "published-shorts",
  guests: "guests",
  assets: "sponsor-assets",
  essay: (t) => `essay:${t || "untitled"}`,
};

import { sGet, sSet, callOp, saveToGoogleDoc, publishClipDirect } from "./api.js";

/* ---------- dates ---------- */

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function weekDates(today) {
  const d = new Date(today);
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(d);
    x.setDate(d.getDate() + i);
    return iso(x);
  });
}

/* Strips the obvious identifiers before anything is written to an external
   surface. This is a backstop, not the primary control. The primary control is
   that confidential kinds never enter the ledger at all. */
function redact(s) {
  if (!s) return s;
  return s
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]")
    .replace(/\+?\d[\d\s().-]{8,}\d/g, "[number]")
    .replace(/https?:\/\/(?:drive|docs|mail)\.google\.com\/\S+/gi, "[internal link]")
    .replace(/\b(?:sk-|xox[baprs]-|ghp_)\S+/gi, "[credential]");
}

function daysSince(dateStr, today) {
  if (!dateStr) return null;
  const ms = new Date(today).setHours(0, 0, 0, 0) - new Date(dateStr).setHours(0, 0, 0, 0);
  return Math.max(0, Math.round(ms / 86400000));
}

/* ---------- api ---------- */

/* Tool use means several text blocks. Take the last one that is valid JSON.
   On failure, carry the raw reply on the error so the UI can show what the
   model actually said. A parse error with the reply thrown away tells you
   nothing about the cause. */
function parseJSON(text) {
  const t = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const end = t.lastIndexOf("]");
  if (end === -1) {
    const e = new Error(t.trim() ? `It replied with prose instead of data: "${t.trim().slice(0, 400)}"` : "It returned nothing at all.");
    e.raw = t;
    throw e;
  }
  for (let i = t.lastIndexOf("[", end); i !== -1; i = t.lastIndexOf("[", i - 1)) {
    try {
      const v = JSON.parse(t.slice(i, end + 1));
      if (Array.isArray(v)) return v;
    } catch {
      /* keep walking back */
    }
    if (i === 0) break;
  }
  const head = t.slice(0, 300).replace(/\s+/g, " ");
  throw new Error(`Found brackets but could not parse the list, which usually means the reply was cut off mid-JSON. It started: "${head}..."`);
}

/* ============================================================
   APP
   ============================================================ */

export default function Cockpit({ onLogout, googleConnected }) {
  const today = useMemo(() => new Date(), []);
  const dayKey = iso(today);
  const dow = today.getDay();

  const tasks = useMemo(() => {
    const base = dow === 6 ? [] : dow === 0 ? [] : DAILY;
    return [...base, ...(FIXTURES[dow] || [])].sort((a, b) => a.slot.localeCompare(b.slot));
  }, [dow]);

  const [ready, setReady] = useState(false);
  const [done, setDone] = useState({});
  const [extras, setExtras] = useState([]);
  const [wire, setWire] = useState(null);
  const [wireAt, setWireAt] = useState(null);
  const [brief, setBrief] = useState(null);
  const [briefAt, setBriefAt] = useState(null);
  const [briefMeta, setBriefMeta] = useState(null);
  const [handled, setHandled] = useState({});
  const [log, setLog] = useState([]);
  const [history, setHistory] = useState({});
  const [ledger, setLedger] = useState([]);
  const [vault, setVault] = useState([]);
  const [signals, setSignals] = useState([]);
  const [sources, setSources] = useState({});
  const [cal, setCal] = useState({});
  const [supplement, setSupplement] = useState([]);
  const [briefTab, setBriefTab] = useState("decisions");
  const [workshop, setWorkshop] = useState(false);
  const [desk, setDesk] = useState(false);
  const [shorts, setShorts] = useState(null);
  const [published, setPublished] = useState([]);
  const [guests, setGuests] = useState([]);
  const [assets, setAssets] = useState([]);
  const [floorDay, setFloorDay] = useState(false);
  const [shift, setShift] = useState(0);
  const [threads, setThreads] = useState(SEED_THREADS);
  const [three, setThree] = useState("");
  const [panel, setPanel] = useState(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const saveTimer = useRef(null);

  const all = useMemo(() => [...tasks, ...extras], [tasks, extras]);

  /* Floor mode scores you against the irreducible day, not the ideal one.
     A 9am start is a different day, not a failed one. */
  const scored = useMemo(() => (floorDay ? all.filter((t) => FLOOR_IDS.includes(t.id)) : all), [all, floorDay]);
  const totalW = scored.reduce((s, t) => s + t.w, 0) || 1;
  const doneW = scored.reduce((s, t) => s + (done[t.id] ? t.w : 0), 0);
  const pct = Math.round((doneW / totalW) * 100);

  /* Shift moves every slot by whole hours so the rundown survives real life. */
  /* Two pieces a day, at least one written and one video. Filling both is
     what "content done" actually means, so the rundown reads from here. */
  const todayCal = cal[dayKey] || {};
  const calDone = !!(todayCal.written && todayCal.video);

  const shifted = useCallback(
    (slot) => {
      if (!shift) return slot;
      const [h, m] = slot.split(":").map(Number);
      const nh = Math.min(23, h + shift);
      return `${String(nh).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    },
    [shift]
  );

  /* load */
  useEffect(() => {
    (async () => {
      const d = await sGet(K.day(dayKey), {});
      setDone(d.done || {});
      setExtras(d.extras || []);
      setWire(d.wire || null);
      setWireAt(d.wireAt || null);
      setBrief(d.brief || null);
      setBriefAt(d.briefAt || null);
      setBriefMeta(d.briefMeta || null);
      setHandled(d.handled || {});
      setLog(d.log || []);
      setThree(d.three || "");
      setHistory(await sGet(K.hist, {}));
      setLedger(await sGet(K.ledger, []));
      setVault(await sGet(K.vault, []));
      setSignals(await sGet(K.signals, []));
      setSources(await sGet(K.sources, {}));
      setCal(await sGet(K.calendar, {}));
      setShorts(await sGet(K.shorts(dayKey), null));
      setPublished(await sGet(K.published, []));
      setGuests(await sGet(K.guests, []));
      setAssets(await sGet(K.assets, []));
      setSupplement(await sGet(K.reading, []));
      setThreads(await sGet(K.threads, SEED_THREADS));
      setFloorDay(!!d.floorDay);
      setShift(d.shift || 0);
      setReady(true);
    })();
  }, [dayKey]);

  /* save (debounced) */
  useEffect(() => {
    if (!ready) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await sSet(K.day(dayKey), { done, extras, wire, wireAt, brief, briefAt, briefMeta, handled, log, three, floorDay, shift });
      const h = { ...history, [dayKey]: { pct, doneW, totalW } };
      setHistory(h);
      await sSet(K.hist, h);
    }, 600);
    return () => clearTimeout(saveTimer.current);
    // eslint-disable-next-line
  }, [done, extras, wire, brief, handled, log, three, floorDay, shift, ready]);

  const toggle = (id) => setDone((p) => ({ ...p, [id]: !p[id] }));

  // Filling both calendar slots completes the day's content obligation.
  useEffect(() => {
    if (!ready) return;
    if (todayCal.video) setDone((p) => (p.sixty ? p : { ...p, sixty: true }));
    if (todayCal.written) setDone((p) => (p.post ? p : { ...p, post: true }));
    // eslint-disable-next-line
  }, [todayCal.video, todayCal.written, ready]);

  /* Content goes to the ledger, which can be mirrored. Client and commercial
     material goes to the vault, which cannot. The split happens here, once,
     so there is no path by which a Foundrae draft reaches Notion. */
  const push = (entry) => {
    const id = Math.random().toString(36).slice(2);
    const secret = CONFIDENTIAL.has(entry.kind);
    setLog((p) => [{ ...entry, ts: Date.now(), id, secret }, ...p]);

    const line = {
      id,
      date: dayKey,
      kind: entry.kind,
      thread: entry.thread || null,
      title: entry.sub || entry.title,
      gist: (entry.body || "").replace(/\s+/g, " ").slice(0, 220),
    };

    if (secret) {
      setVault((p) => {
        const next = [{ ...line, gist: undefined }, ...p].slice(0, MAX_LEDGER);
        sSet(K.vault, next);
        return next;
      });
      return; // never touches the ledger, never touches threads
    }

    setLedger((p) => {
      const next = [line, ...p].slice(0, MAX_LEDGER);
      sSet(K.ledger, next);
      return next;
    });

    if (entry.thread) {
      setThreads((p) => {
        const next = p.map((t) => (t.id === entry.thread ? { ...t, last: dayKey, seeded: false } : t));
        sSet(K.threads, next);
        return next;
      });
    }
  };

  /* What the generators get told about his own back catalogue. */
  const threadContext = useCallback(
    (threadId) => {
      const t = threads.find((x) => x.id === threadId);
      // public ledger only. The vault never informs generation destined for publication.
      const onThread = ledger.filter((l) => l.thread === threadId).slice(0, 4);
      const recent = ledger.slice(0, 6);
      if (!ledger.length && !t) return "";

      let s = "\n\nVINNY'S OWN ARCHIVE. Use it, do not repeat it.\n";
      if (t) {
        s += `\nRUNNING THREAD: "${t.name}". ${t.note}`;
        s += t.last ? ` Last touched ${t.last}${t.seeded ? " (approximate, from archive)" : ""}.` : " Never published on yet, this would be the opening move.";
      }
      if (onThread.length) {
        s += `\n\nWHAT HE ALREADY SAID ON THIS THREAD:\n${onThread.map((l) => `- ${l.date} (${l.kind}): ${l.gist}`).join("\n")}`;
      }
      if (recent.length) {
        s += `\n\nPUBLISHED IN THE LAST FEW DAYS, DO NOT REUSE THESE FRAMES:\n${recent.map((l) => `- ${l.date}: ${l.title}`).join("\n")}`;
      }
      s += `\n\nRULES ON CONTINUITY:
- If this genuinely continues a thread he has run, open with a callback in his construction ("As we covered...") plus exactly one sentence of context. Never assume the reader remembers.
- If a frame, analogy or intellectual reference appears in the archive above from the last fourteen days, do not use it again. Find a different door into the idea.
- Continuity is a reward for the loyal reader, not a tax on the new one. One sentence, then move.`;
      return s;
    },
    [threads, ledger]
  );

  /* Export the public ledger as a file. Confidential vault entries are not
     included, by construction: this function never reads the vault. */
  const exportLedger = useCallback(() => {
    const rows = ledger
      .filter((l) => !CONFIDENTIAL.has(l.kind))
      .map((l) => ({ ...l, gist: redact(l.gist), title: redact(l.title) }));
    const blob = new Blob([JSON.stringify({ exported: new Date().toISOString(), threads, entries: rows }, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `vspot-ledger-${iso(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [ledger, threads]);

  /* ---- the sweep: every platform, decisions only ---- */
  const runSweep = useCallback(async () => {
    setBusy("brief");
    setErr("");
    try {
      const r = await callOp({ op: "sweep" });
      const [decisionsRaw, suppRaw] = r.text.split("---SUPPLEMENT---");
      setBrief(parseJSON(decisionsRaw));
      try {
        const found = suppRaw ? parseJSON(suppRaw) : [];
        if (found.length) {
          setSupplement((prev) => {
            const seen = new Set(prev.map((x) => (x.link || x.title || "").toLowerCase()));
            const next = [...found.filter((x) => !seen.has((x.link || x.title || "").toLowerCase())), ...prev].slice(0, 60);
            sSet(K.reading, next);
            return next;
          });
        }
      } catch {
        /* the decisions array is the important half, do not lose it over this */
      }
      setBriefAt(Date.now());
      setBriefMeta({ calls: r.calls.length, failed: r.failed });
    } catch (e) {
      setErr(e.message || "The sweep did not come back.");
    }
    setBusy("");
  }, [today]);

  /* Add something to Sunday's list by hand. It looks the thing up rather than
     trusting the URL slug for a title. */
  const addReading = useCallback(async (url) => {
    setBusy("reading");
    setErr("");
    try {
      const r = await callOp({ op: "reading", extra: url });
      const t = r.text.replace(/```json|```/g, "").trim();
      const item = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
      setSupplement((prev) => {
        const next = [{ ...item, link: url, added: dayKey }, ...prev.filter((x) => x.link !== url)].slice(0, 60);
        sSet(K.reading, next);
        return next;
      });
      setBriefTab("supplement");
    } catch (e) {
      setErr(e.message || "Could not add that.");
    }
    setBusy("");
    // eslint-disable-next-line
  }, [dayKey]);

  /* Today's shorts queue. Reads the whole Opus library, proposes with reasons. */
  const pullShorts = useCallback(async (n) => {
    setBusy("shorts");
    setErr("");
    try {
      const r = await callOp({ op: "clips", extra: String(n || 6) });
      const list = parseJSON(r.text);
      setShorts(list);
      sSet(K.shorts(dayKey), list);
    } catch (e) {
      setErr(e.message || "Could not reach the clip library.");
    }
    setBusy("");
    // eslint-disable-next-line
  }, [dayKey]);

  /* Publish one approved clip to one account. Only ever from a tick. */
  const publishClip = useCallback(async (clip, account, when) => {
    setBusy("pub" + clip.clipId + account.id);
    setErr("");
    try {
      const res = await publishClipDirect({
        projectId: clip.projectId,
        clipId: clip.clipId,
        postAccountId: account.id,
        title: clip.title,
        description: clip.description,
        ...(when ? { publishAt: when } : {}),
      });

      const row = {
        id: Math.random().toString(36).slice(2),
        date: dayKey,
        title: clip.title,
        episode: clip.episode,
        guest: clip.guest || "",
        platform: account.platform,
        url: res.url || "",
        scheduled: when || "",
        note: res.note || "",
      };
      setPublished((p) => {
        const next = [row, ...p].slice(0, 300);
        sSet(K.published, next);
        return next;
      });

      // A shipped short fills today's video slot in the planner.
      setCal((prev) => {
        if (prev[dayKey]?.video) return prev;
        const next = { ...prev, [dayKey]: { ...(prev[dayKey] || {}), video: clip.title } };
        sSet(K.calendar, next);
        return next;
      });
    } catch (e) {
      setErr(e.message || "Publish failed. Nothing was posted.");
    }
    setBusy("");
    // eslint-disable-next-line
  }, [dayKey]);

  /* THE GAP. Not a to-do list. These are the things that go quiet without
     anyone noticing, because nothing breaks when they do. */
  const gaps = useMemo(() => {
    const out = [];
    const daysAgo = (d) => (d ? daysSince(d, today) : null);

    const lastOutreach = vault.find((v) => v.kind === "sponsor");
    const d1 = daysAgo(lastOutreach && lastOutreach.date);
    if (d1 === null) out.push({ w: 3, t: "No sponsor approach has ever gone out", s: "The Approach is in the rundown every day at 14:00. Build the thing first, then send it." });
    else if (d1 >= 5) out.push({ w: 3, t: `No sponsor approach in ${d1} days`, s: "Pipelines do not stall loudly. They just stop returning anything." });

    const live = assets.filter((a) => a.status !== "declined");
    const sent = live.filter((a) => a.status === "sent" || a.status === "won");
    if (live.length && !sent.length) out.push({ w: 2, t: `${live.length} spec build${live.length > 1 ? "s" : ""} made and none sent`, s: "A rainy day proposal that never leaves the drive is a hobby." });

    const awaiting = assets.filter((a) => a.status === "sent" && daysAgo(a.touched) !== null && daysAgo(a.touched) >= 7);
    awaiting.slice(0, 2).forEach((a) =>
      out.push({
        w: 2,
        t: `${a.name} has been sitting ${daysAgo(a.touched)} days with no movement`,
        s: "One line, no pitch. Ask whether it landed with the right person. Most of these die of silence rather than no.",
      })
    );

    const camp = assets.filter((a) => a.camp);
    const campWarm = camp.filter((a) => daysAgo(a.touched) !== null && daysAgo(a.touched) <= 14);
    if (!camp.length) out.push({ w: 3, t: "No Camp Tralee prospects tracked", s: "January is closer than it reads. Omnisend, Trustap and Parcel Planet are confirmed. Who is next?" });
    else if (!campWarm.length) out.push({ w: 3, t: `Camp Tralee has gone quiet, ${camp.length} prospects untouched in a fortnight`, s: "An invitation-only event needs its pipeline warm months out, not weeks." });

    const confirmed = guests.filter((g) => ["confirmed", "recorded"].includes(g.stage));
    const booked = guests.filter((g) => g.stage === "confirmed");
    if (!booked.length) out.push({ w: 3, t: "No guest confirmed for the next Struggle Bus", s: "A weekly show with no one booked is a gap you find out about on a Thursday." });
    if (confirmed.length && !guests.some((g) => g.stage === "approached")) out.push({ w: 1, t: "Nobody new approached", s: "One ask a week keeps the run going. It compounds slowly and fails fast." });

    const written = Object.values(cal).filter((d) => d && d.written).length;
    if (!written) out.push({ w: 1, t: "Nothing written scheduled this week", s: "Shorts build reach. The written work is what people subscribe to." });

    return out.sort((a, b) => b.w - a.w);
    // eslint-disable-next-line
  }, [vault, assets, guests, cal, today]);

  /* ---- the wire ---- */
  const pullWire = useCallback(async () => {
    setBusy("wire");
    setErr("");
    try {
      const r = await callOp({ op: "wire", threads });
      const stories = parseJSON(r.text);
      setWire(stories);
      // Count what each source is actually giving us, so dead weight shows up.
      setSources((prev) => {
        const next = { ...prev };
        stories.forEach((st) => {
          const k = (st.source || "unknown").trim();
          next[k] = { seen: (next[k]?.seen || 0) + 1, used: next[k]?.used || 0 };
        });
        sSet(K.sources, next);
        return next;
      });
      setWireAt(Date.now());
    } catch (e) {
      setErr(e.message || "The wire did not come back.");
    }
    setBusy("");
  }, [today, threads]);

  /* ---- generators ---- */
  const TITLES = { post: "LinkedIn post", script: "Sixty second script", substack: "Substack angles", ideas: "Content ideas", sponsor: "Sponsor approach", foundrae: "Foundrae email", reply: "Reply draft" };

  const generate = useCallback(async (kind, story, extra) => {
    const tag = kind + (story ? story.headline : extra || "");
    setBusy(tag);
    setErr("");
    const archive = threadContext(story ? story.thread : null);

    if (story && story.source) {
      setSources((prev) => {
        const k = story.source.trim();
        const next = { ...prev, [k]: { seen: prev[k]?.seen || 1, used: (prev[k]?.used || 0) + 1 } };
        sSet(K.sources, next);
        return next;
      });
    }

    // Open the panel immediately so the click has an obvious consequence.
    setPanel({ kind, title: TITLES[kind], sub: story ? story.headline : extra || "", body: "", loading: true });

    try {
      const r = await callOp({ op: "generate", kind, story, extra, archive: kind === "foundrae" ? "" : archive });
      const entry = {
        kind,
        title: TITLES[kind],
        sub: story ? story.headline : extra || "",
        body: r.text,
        thread: story ? story.thread || null : null,
        secret: CONFIDENTIAL.has(kind),
      };
      push(entry);
      setPanel({ ...entry, loading: false });
    } catch (e) {
      setPanel(null);
      setErr(e.message || "Generation failed.");
    }
    setBusy("");
    // eslint-disable-next-line
  }, [threadContext]);

  /* ---- week + calibration ---- */
  const week = weekDates(today);
  const weekRows = week.map((d) => ({ d, ...(d === dayKey ? { pct, doneW, totalW } : history[d] || null) }));
  const weekScored = weekRows.filter((r) => r.pct !== undefined && new Date(r.d) <= today);
  const weekAvg = weekScored.length ? Math.round(weekScored.reduce((s, r) => s + r.pct, 0) / weekScored.length) : null;

  const calibration = useMemo(() => {
    const vals = Object.entries(history)
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .slice(0, 5)
      .map(([, v]) => v.pct);
    if (vals.length < 3) return "Not enough days logged yet. Give it a week before you judge the volume.";
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    if (avg >= 85) return `Trailing average ${Math.round(avg)}%. You have room. Add one thing, not three.`;
    if (avg >= 60) return `Trailing average ${Math.round(avg)}%. The volume is about right. Protect it.`;
    return `Trailing average ${Math.round(avg)}%. You are carrying more than the week can hold. Cut the two lowest weight items and see what happens.`;
  }, [history]);

  /* ============================================================ */

  const offAir = tasks.length === 0;

  return (
    <div style={{ background: C.black, minHeight: "100vh", fontFamily: FONT_B, color: "#141833" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@500;700;900&family=IBM+Plex+Sans:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        .lamp { animation: pulse 2.4s ease-in-out infinite; }
        @keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: .55 } }
        .row { transition: background .18s ease, opacity .18s ease; }
        .row:hover { background: rgba(20,24,51,.04); }
        .btn { transition: all .15s ease; cursor: pointer; }
        .btn:hover { transform: translateY(-1px); }
        .btn:focus-visible, .row:focus-visible { outline: 2px solid ${C.tan}; outline-offset: 2px; }
        textarea, input { font-family: ${FONT_B}; }
        @media (prefers-reduced-motion: reduce) { *, .lamp { animation: none !important; transition: none !important; } }
      `}</style>

      {/* ---------------- HEADER ---------------- */}
      <header style={{ background: C.navy, borderBottom: `1px solid ${C.line}` }}>
        <div className="px-5 py-4 md:px-8" style={{ maxWidth: 1280, margin: "0 auto" }}>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex items-baseline gap-3">
                <h1 style={{ fontFamily: FONT_D, fontWeight: 900, fontSize: 42, lineHeight: 0.9, letterSpacing: "0.01em", color: C.red, textShadow: `0 0 18px rgba(0,0,0,0)` }}>
                  THE COCKPIT
                </h1>
                <span className="lamp" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: FONT_M, fontSize: 10, letterSpacing: ".18em", color: pct === 100 ? C.red : C.grey }}>
                  <span style={{ width: 8, height: 8, borderRadius: 99, background: pct === 100 ? C.red : "#9095B5", boxShadow: pct === 100 ? `0 0 10px ${C.red}` : "none" }} />
                  {pct === 100 ? "ON AIR" : offAir ? "OFF AIR" : "STANDBY"}
                </span>
              </div>
              <div style={{ fontFamily: FONT_M, fontSize: 10, letterSpacing: ".24em", color: C.tan, marginTop: 4 }}>
                A V SPOT NETWORK PRODUCTION
              </div>
            </div>

            <div className="text-right">
              <div style={{ fontFamily: FONT_M, fontSize: 11, letterSpacing: ".16em", color: C.grey }}>
                {DAYS[dow]} {today.getDate()} {MONTHS[today.getMonth()]} {today.getFullYear()}
              </div>
              <Meter pct={pct} />
              <div style={{ fontFamily: FONT_M, fontSize: 11, color: C.grey, marginTop: 4 }}>
                <span style={{ color: "#141833", fontSize: 15, fontWeight: 500 }}>{pct}%</span> transmission · {doneW}/{totalW} weighted
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="px-5 py-6 md:px-8" style={{ maxWidth: 1280, margin: "0 auto" }}>
        {err && (
          <div
            role="alert"
            style={{ position: "fixed", left: 16, right: 16, bottom: 16, zIndex: 70, background: "#FFD8D9", border: `1px solid ${C.red}`, padding: "12px 14px", fontSize: 13, lineHeight: 1.5, boxShadow: "0 8px 30px rgba(0,0,0,.6)", maxWidth: 640, margin: "0 auto" }}
          >
            <div className="flex items-start gap-3">
              <span style={{ flex: 1 }}>{err}</span>
              <button className="btn" onClick={() => setErr("")} style={{ ...btnStyle(C.grey, true), borderColor: "transparent" }}>DISMISS</button>
            </div>
          </div>
        )}

        <div className="grid gap-6" style={{ gridTemplateColumns: "minmax(0,1fr)" }}>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
            {/* ---------------- RUNDOWN ---------------- */}
            <section>
              {gaps.length > 0 && (
                <div className="mb-5">
                  <SectionHead n="00" title="THE GAP" right={`${gaps.length} slipping`} />
                  <div style={{ border: `1px solid ${C.red}55` }}>
                    {gaps.slice(0, 5).map((g, i) => (
                      <div key={i} className="px-3 py-2.5" style={{ background: i === 0 ? "#FFD8D9" : C.navyDeep, borderTop: i === 0 ? "none" : `1px solid rgba(20,24,51,.07)`, borderLeft: `3px solid ${g.w >= 3 ? C.red : g.w === 2 ? "#A8761A" : "#9095B5"}` }}>
                        <div style={{ fontSize: 13.5, fontWeight: 500, lineHeight: 1.35 }}>{g.t}</div>
                        <p style={{ fontSize: 12, color: C.grey, marginTop: 3, lineHeight: 1.45 }}>{g.s}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <SectionHead n="01" title="RUNDOWN" right={offAir ? "rest day" : `${all.filter((t) => done[t.id]).length}/${all.length}`} />

              {!offAir && (
                <div className="flex items-center gap-2 mb-2 flex-wrap px-3 py-2" style={{ background: floorDay ? "#F2E6D0" : C.navyDeep, border: `1px solid ${C.line}` }}>
                  <button className="btn" onClick={() => setFloorDay(!floorDay)} style={btnStyle(C.tan, !floorDay)}>
                    {floorDay ? "FLOOR DAY ON" : "DECLARE A FLOOR DAY"}
                  </button>
                  <div className="flex items-center gap-1">
                    <span style={{ fontFamily: FONT_M, fontSize: 9.5, color: C.grey, letterSpacing: ".1em" }}>SHIFT</span>
                    {[0, 1, 2, 3].map((h) => (
                      <button key={h} className="btn" onClick={() => setShift(h)} style={{ ...btnStyle(shift === h ? C.tan : C.grey, shift !== h), padding: "4px 7px" }}>
                        +{h}
                      </button>
                    ))}
                  </div>
                  {floorDay && (
                    <p style={{ fontSize: 11.5, color: C.tan, width: "100%", lineHeight: 1.45 }}>
                      Scored against three things: the video, the V Spot, and the Foundrae inbox. Everything else today is a bonus, not a debt.
                    </p>
                  )}
                </div>
              )}

              {offAir ? (
                <div className="px-4 py-8 text-center" style={{ background: C.navyDeep, border: `1px solid ${C.line}` }}>
                  <div style={{ fontFamily: FONT_D, fontSize: 28, color: C.tan }}>OFF AIR</div>
                  <p style={{ fontSize: 13, color: C.grey, marginTop: 6 }}>No rundown today. The score does not need you.</p>
                </div>
              ) : (
                <div style={{ border: `1px solid ${C.line}` }}>
                  {all.map((t, i) => {
                    const isDone = !!done[t.id];
                    const lane = LANE[t.lane] || LANE.ops;
                    const isFloor = FLOOR_IDS.includes(t.id);
                    const muted = floorDay && !isFloor;
                    return (
                      <div
                        key={t.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => toggle(t.id)}
                        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), toggle(t.id))}
                        className="row flex gap-3 px-3 py-3"
                        style={{
                          background: isDone ? "rgba(20,24,51,.03)" : C.navyDeep,
                          borderTop: i === 0 ? "none" : `1px solid rgba(20,24,51,.07)`,
                          borderLeft: `3px solid ${isDone ? lane.c : "transparent"}`,
                          opacity: isDone ? 0.55 : muted ? 0.3 : 1,
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ fontFamily: FONT_M, fontSize: 11, color: shift ? C.tan : C.grey, paddingTop: 3, minWidth: 38 }}>{shifted(t.slot)}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span style={{ fontFamily: FONT_D, fontSize: 19, fontWeight: 700, letterSpacing: ".01em", textDecoration: isDone ? "line-through" : "none" }}>
                              {t.name.toUpperCase()}
                            </span>
                            <span style={{ fontFamily: FONT_M, fontSize: 9, letterSpacing: ".12em", color: lane.c, border: `1px solid ${lane.c}40`, padding: "1px 5px" }}>
                              {lane.label}
                            </span>
                            <span style={{ fontFamily: FONT_M, fontSize: 9, color: C.grey }}>w{t.w}</span>
                            {isFloor && <span style={{ fontFamily: FONT_M, fontSize: 8.5, letterSpacing: ".1em", color: C.tan }}>FLOOR</span>}
                          </div>
                          <p style={{ fontSize: 12.5, color: C.grey, marginTop: 2, lineHeight: 1.45 }}>{t.note}</p>
                        </div>
                        <div style={{ width: 18, height: 18, marginTop: 3, flexShrink: 0, border: `1px solid ${isDone ? lane.c : "#9095B5"}`, background: isDone ? lane.c : "transparent", display: "grid", placeItems: "center" }}>
                          {isDone && <span style={{ color: C.black, fontSize: 12, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <AddTask onAdd={(t) => setExtras((p) => [...p, t])} />

              {/* tomorrow's three */}
              <div className="mt-5">
                <SectionHead n="02" title="TOMORROW'S THREE" />
                <textarea
                  value={three}
                  onChange={(e) => setThree(e.target.value)}
                  placeholder={"1.\n2.\n3."}
                  rows={4}
                  style={{ width: "100%", background: C.navyDeep, border: `1px solid ${C.line}`, color: "#141833", padding: 12, fontSize: 13, lineHeight: 1.6, resize: "vertical" }}
                />
              </div>

              {/* week */}
              <div className="mt-5">
                <SectionHead n="03" title="THE WEEK" right={weekAvg !== null ? `${weekAvg}% avg` : ""} />
                <div style={{ background: C.navyDeep, border: `1px solid ${C.line}`, padding: 14 }}>
                  <div className="flex items-end justify-between gap-2" style={{ height: 76 }}>
                    {weekRows.map((r) => {
                      const isToday = r.d === dayKey;
                      const h = r.pct !== undefined ? Math.max(3, (r.pct / 100) * 60) : 3;
                      return (
                        <div key={r.d} className="flex flex-col items-center gap-1.5" style={{ flex: 1 }}>
                          <div style={{ width: "100%", height: h, background: isToday ? C.red : r.pct !== undefined ? C.tan : "rgba(20,24,51,0.08)", boxShadow: isToday ? `0 0 10px rgba(0,0,0,0)` : "none" }} />
                          <span style={{ fontFamily: FONT_M, fontSize: 9, color: isToday ? C.red : C.grey }}>{DAYS[(new Date(r.d).getDay())][0]}</span>
                        </div>
                      );
                    })}
                  </div>
                  <p style={{ fontSize: 12, color: C.tan, marginTop: 12, lineHeight: 1.5, borderTop: `1px solid ${C.line}`, paddingTop: 10 }}>
                    {calibration}
                  </p>
                </div>
              </div>

              {/* content calendar */}
              <div className="mt-5">
                <SectionHead n="04" title="CONTENT CALENDAR" right={calDone ? "today filled" : "today open"} />
                <ContentCalendar
                  cal={cal}
                  today={today}
                  recent={ledger.filter((l) => !CONFIDENTIAL.has(l.kind)).slice(0, 12)}
                  onSet={(dayKey2, slot, value) => {
                    const next = { ...cal, [dayKey2]: { ...(cal[dayKey2] || {}), [slot]: value } };
                    setCal(next);
                    sSet(K.calendar, next);
                  }}
                />
              </div>

              {/* source ledger */}
              <div className="mt-5">
                <SectionHead n="05" title="SOURCES" right={`${Object.keys(sources).length} tracked`} />
                <SourceLedger sources={sources} />
              </div>

              {/* guests */}
              <div className="mt-5">
                <SectionHead n="05b" title="GUESTS" right={`${guests.filter((g) => g.stage === "confirmed").length} confirmed`} />
                <Pipeline
                  rows={guests}
                  stages={["idea", "approached", "confirmed", "recorded", "published"]}
                  placeholder="Name, and the show"
                  onChange={(next) => { setGuests(next); sSet(K.guests, next); }}
                />
              </div>

              {/* sponsor assets and Camp Tralee */}
              <div className="mt-5">
                <SectionHead n="05c" title="SPONSOR ASSETS" right={`${assets.filter((a) => a.camp).length} camp tralee`} />
                <Assets rows={assets} onChange={(next) => { setAssets(next); sSet(K.assets, next); }} />
              </div>

              {/* the thread line */}
              <div className="mt-5">
                <SectionHead
                  n="06"
                  title="THE THREAD LINE"
                  right={`${ledger.length} logged`}
                  action={
                    <button className="btn" onClick={exportLedger} disabled={!ledger.length} style={btnStyle(C.grey, true)}>
                      "EXPORT"
                    </button>
                  }
                />
                <div style={{ border: `1px solid ${C.line}` }}>
                  {[...threads]
                    .sort((a, b) => (b.last || "").localeCompare(a.last || ""))
                    .map((t, i) => {
                      const d = daysSince(t.last, today);
                      const heat = d === null ? "#9095B5" : d <= 7 ? C.red : d <= 21 ? C.tan : "#9095B5";
                      const label = d === null ? "unfired" : d === 0 ? "today" : `${d}d`;
                      return (
                        <div
                          key={t.id}
                          className="flex items-start gap-3 px-3 py-2.5"
                          style={{ background: C.navyDeep, borderTop: i === 0 ? "none" : `1px solid rgba(20,24,51,.07)`, borderLeft: `3px solid ${heat}` }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span style={{ fontSize: 13.5, fontWeight: 500, color: d !== null && d > 21 ? C.grey : "#141833" }}>{t.name}</span>
                              {t.seeded && <span style={{ fontFamily: FONT_M, fontSize: 8.5, color: "#767CA0", letterSpacing: ".1em" }}>SEEDED</span>}
                            </div>
                            {d !== null && d > 21 && (
                              <p style={{ fontSize: 11.5, color: "#767CA0", marginTop: 2 }}>Going cold. Revive it or retire it.</p>
                            )}
                            {d === null && <p style={{ fontSize: 11.5, color: "#767CA0", marginTop: 2 }}>{t.note}</p>}
                          </div>
                          <span style={{ fontFamily: FONT_M, fontSize: 10, color: heat, paddingTop: 2 }}>{label}</span>
                        </div>
                      );
                    })}
                </div>
              </div>
            </section>

            {/* ---------------- WIRE + STUDIO ---------------- */}
            <section>
              <SectionHead
                n="07"
                title="THE BRIEFING"
                right={briefAt ? `swept ${new Date(briefAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "not swept"}
                action={
                  <button className="btn" onClick={runSweep} disabled={busy === "brief"} style={btnStyle(C.tan)}>
                    {busy === "brief" ? "SWEEPING…" : brief ? "SWEEP AGAIN" : "SWEEP PLATFORMS"}
                  </button>
                }
              />

              <div className="px-3 py-2 mb-2" style={{ background: "#F2E6D0", borderLeft: `2px solid ${C.tan}` }}>
                <div style={{ fontFamily: FONT_M, fontSize: 9, letterSpacing: ".16em", color: C.tan, marginBottom: 3 }}>STANDING ORDERS</div>
                <p style={{ fontSize: 12, color: "#4A5075", lineHeight: 1.5 }}>
                  Live or nothing. Nothing on this screen comes from memory. Every card arrives with the work done to the last step, and the last step is yours.
                </p>
              </div>

              {!brief && busy !== "brief" && (
                <div className="px-4 py-8 mb-6" style={{ background: C.navyDeep, border: `1px solid ${C.line}` }}>
                  <p style={{ fontSize: 13, color: C.grey, lineHeight: 1.55 }}>
                    Not swept yet. This reads Gmail, Slack, Asana, Calendar, Fireflies and Drive, then hands you back only the things that need a decision.
                  </p>
                </div>
              )}
              {busy === "brief" && <div className="mb-6"><Skeleton /></div>}

              {(brief || supplement.length > 0) && (
                <div className="flex gap-2 mb-2">
                  {[["decisions", `DECISIONS ${brief ? brief.length : 0}`], ["supplement", `SUNDAY SUPPLEMENT ${supplement.length}`]].map(([k, label]) => (
                    <button key={k} className="btn" onClick={() => setBriefTab(k)} style={{ ...btnStyle(briefTab === k ? C.tan : C.grey, briefTab !== k), padding: "5px 10px" }}>
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {briefTab === "supplement" && (
                <div className="grid gap-2 mb-6">
                  <AddReading onAdd={addReading} busy={busy === "reading"} />
                  {supplement.length === 0 ? (
                    <div className="px-4 py-6" style={{ background: C.navyDeep, border: `1px solid ${C.line}` }}>
                      <p style={{ fontSize: 13, color: C.grey }}>Nothing in Promotions worth an hour on Sunday. That is a result, not a gap.</p>
                    </div>
                  ) : (
                    supplement.map((x, i) => (
                      <article key={i} style={{ background: C.navyDeep, border: `1px solid ${C.line}`, borderLeft: `3px solid ${x.gated ? "#A8761A" : C.tan}`, padding: 14 }}>
                        <div className="flex items-center gap-2" style={{ marginBottom: 4 }}>
                          <span style={{ fontFamily: FONT_M, fontSize: 9, letterSpacing: ".1em", color: "#767CA0" }}>{(x.source || "").toUpperCase()}</span>
                          {x.gated && <span style={{ fontFamily: FONT_M, fontSize: 8.5, letterSpacing: ".1em", color: "#A8761A" }}>GATED</span>}
                          <button className="btn" onClick={() => setSupplement((p) => { const n = p.filter((_, j) => j !== i); sSet(K.reading, n); return n; })}
                            style={{ ...btnStyle(C.grey, true), borderColor: "transparent", color: "#9095B5", marginLeft: "auto", fontSize: 9, padding: "1px 5px" }}>✕</button>
                        </div>
                        <h3 style={{ fontFamily: FONT_D, fontSize: 19, fontWeight: 700, lineHeight: 1.1 }}>{x.title}</h3>
                        <p style={{ fontSize: 13, color: C.tan, lineHeight: 1.5, marginTop: 5 }}>{x.why}</p>
                        {x.link && (
                          <a className="btn" href={x.link} target="_blank" rel="noopener noreferrer" style={{ ...btnStyle(C.grey, true), textDecoration: "none", display: "inline-block", marginTop: 8 }}>OPEN ↗</a>
                        )}
                      </article>
                    ))
                  )}
                </div>
              )}

              {brief && briefTab === "decisions" && (
                <div className="mb-6">
                  {briefMeta && (
                    <div style={{ fontFamily: FONT_M, fontSize: 9.5, color: briefMeta.failed ? C.red : "#767CA0", marginBottom: 6, letterSpacing: ".08em" }}>
                      {briefMeta.calls} PLATFORM CALLS{briefMeta.failed ? ` · ${briefMeta.failed} FAILED, TREAT AS UNKNOWN NOT EMPTY` : " · ALL RETURNED"}
                    </div>
                  )}
                  <div className="grid gap-2">
                    {brief.map((c, i) => (
                      <DecisionCard
                        key={i}
                        card={c}
                        state={handled[i]}
                        onSet={(v) => setHandled((p) => ({ ...p, [i]: p[i] === v ? undefined : v }))}
                        onKeep={() => push({ kind: "reply", title: "Reply draft", sub: c.who, body: c.draft })}
                      />
                    ))}
                  </div>
                </div>
              )}

              <SectionHead
                n="08"
                title="THE WIRE"
                right={wireAt ? `pulled ${new Date(wireAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "not pulled"}
                action={
                  <button className="btn" onClick={pullWire} disabled={busy === "wire"} style={btnStyle(C.red)}>
                    {busy === "wire" ? "PULLING…" : wire ? "REFRESH" : "PULL THE WIRE"}
                  </button>
                }
              />

              {!wire && busy !== "wire" && (
                <div className="px-4 py-8" style={{ background: C.navyDeep, border: `1px solid ${C.line}` }}>
                  <p style={{ fontSize: 13, color: C.grey }}>Nothing on the wire yet. Pull it and the day has a subject.</p>
                </div>
              )}
              {busy === "wire" && <Skeleton />}

              {wire && (
                <div className="grid gap-2">
                  {wire.map((s, i) => (
                    <article key={i} style={{ background: C.navyDeep, border: `1px solid ${C.line}`, padding: 14 }}>
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span style={{ fontFamily: FONT_M, fontSize: 9, letterSpacing: ".12em", color: C.tan, border: `1px solid ${C.tan}40`, padding: "1px 5px" }}>{s.region}</span>
                        <span style={{ fontFamily: FONT_M, fontSize: 9, letterSpacing: ".1em", color: C.grey }}>{(s.topic || "").toUpperCase()}</span>
                        <span style={{ fontFamily: FONT_M, fontSize: 9, color: "#767CA0" }}>· {s.source}</span>
                        {s.thread && (() => {
                          const t = threads.find((x) => x.id === s.thread);
                          if (!t) return null;
                          const d = daysSince(t.last, today);
                          return (
                            <span style={{ fontFamily: FONT_M, fontSize: 9, letterSpacing: ".06em", color: C.red, marginLeft: "auto" }}>
                              ↳ {t.name.toUpperCase()}{d !== null ? ` · ${d}D` : " · UNFIRED"}
                            </span>
                          );
                        })()}
                      </div>
                      <h3 style={{ fontFamily: FONT_D, fontSize: 21, fontWeight: 700, lineHeight: 1.05, marginBottom: 6 }}>
                        {s.url ? (
                          <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ color: "#141833", textDecoration: "none", borderBottom: `1px solid ${C.red}60` }}>
                            {s.headline}
                          </a>
                        ) : (
                          s.headline
                        )}
                      </h3>
                      <p style={{ fontSize: 13, color: "#4A5075", lineHeight: 1.5 }}>{s.summary}</p>
                      {s.url && (
                        <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ display: "block", fontFamily: FONT_M, fontSize: 10.5, color: "#3D7A91", marginTop: 5, wordBreak: "break-all", textDecoration: "none" }}>
                          {s.source ? `${s.source} · ` : ""}{s.url.replace(/^https?:\/\//, "").slice(0, 72)}
                        </a>
                      )}
                      <p style={{ fontSize: 13, color: C.tan, lineHeight: 1.5, marginTop: 6, fontStyle: "italic" }}>{s.pov}</p>
                      <div className="flex gap-2 mt-3 flex-wrap">
                        <button className="btn" onClick={() => setWorkshop({ story: s })} disabled={!!busy} style={btnStyle("#6B5CA5", true)}>
                          DISCUSS
                        </button>
                        {[["post", "LINKEDIN POST"], ["script", "60 SEC SCRIPT"], ["substack", "SUBSTACK ANGLES"]].map(([k, label]) => {
                          const mine = busy === k + s.headline;
                          return (
                            <button key={k} className="btn" onClick={() => generate(k, s)} disabled={!!busy} style={btnStyle(mine ? C.red : C.grey, !mine)}>
                              {mine ? "WRITING…" : label}
                            </button>
                          );
                        })}
                      </div>
                    </article>
                  ))}
                </div>
              )}

              {/* studio */}
              <div className="mt-6">
                <SectionHead
                  n="09"
                  title="THE SHORTS"
                  right={shorts ? `${shorts.length} proposed` : "not pulled"}
                  action={
                    <button className="btn" onClick={() => pullShorts(6)} disabled={busy === "shorts"} style={btnStyle("#C2603F")}>
                      {busy === "shorts" ? "READING LIBRARY..." : shorts ? "PULL AGAIN" : "PULL TODAY'S CLIPS"}
                    </button>
                  }
                />
                <div className="mb-6">
                  {!shorts && busy !== "shorts" && (
                    <div className="px-4 py-6" style={{ background: C.navyDeep, border: `1px solid ${C.line}` }}>
                      <p style={{ fontSize: 13, color: C.grey, lineHeight: 1.55 }}>
                        Reads the whole OpusClip library, old episodes included, and proposes today's shorts with a reason and a hook. You tick, it publishes, the URL lands below for the ads buyer.
                      </p>
                    </div>
                  )}
                  {busy === "shorts" && (
                    <div className="px-4 py-5 mb-2" style={{ background: C.navyDeep, border: `1px solid ${C.line}` }}>
                      <div className="lamp" style={{ fontFamily: FONT_M, fontSize: 10, letterSpacing: ".16em", color: "#C2603F" }}>READING THE LIBRARY...</div>
                      <p style={{ fontSize: 12.5, color: C.grey, marginTop: 6, lineHeight: 1.5 }}>
                        Listing projects, then clips, then choosing. Ninety seconds is normal. Leave this tab open.
                      </p>
                    </div>
                  )}
                  {shorts && (
                    <div className="grid gap-2">
                      {shorts.map((c) => (
                        <ShortCard key={c.clipId} clip={c} busy={busy} onPublish={publishClip} done={published.find((p) => p.title === c.title)} />
                      ))}
                    </div>
                  )}

                  {published.length > 0 && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <span style={{ fontFamily: FONT_M, fontSize: 9.5, letterSpacing: ".14em", color: C.tan }}>SHIPPED, FOR THE ADS BUYER</span>
                        <button className="btn" onClick={() => navigator.clipboard?.writeText(published.filter((p) => p.url).map((p) => p.platform + "\t" + p.title + "\t" + p.url).join("\n"))} style={btnStyle(C.grey, true)}>COPY ALL URLS</button>
                      </div>
                      <div style={{ border: `1px solid ${C.line}` }}>
                        {published.slice(0, 12).map((p, i) => (
                          <div key={p.id} className="flex items-center gap-2 px-3 py-2" style={{ background: C.navyDeep, borderTop: i === 0 ? "none" : "1px solid rgba(20,24,51,.07)" }}>
                            <span style={{ fontFamily: FONT_M, fontSize: 9, color: C.tan, minWidth: 46 }}>{p.platform}</span>
                            <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{p.title}</span>
                            {p.url ? (
                              <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: FONT_M, fontSize: 10, color: "#3D7A91" }}>OPEN</a>
                            ) : (
                              <span style={{ fontFamily: FONT_M, fontSize: 9.5, color: "#767CA0" }}>{p.scheduled ? "SCHEDULED" : "NO URL YET"}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <SectionHead n="10" title="THE STUDIO" />
                <div className="grid gap-2 sm:grid-cols-2">
                  <Card title="Content ideas" note="Six angles across the network, threaded to what you already run." busy={busy === "ideas"} onRun={() => generate("ideas")} accent={C.red} />
                  <Prompted title="Sponsor approach" note="Names a prospect, builds the asset first, then writes the short email." placeholder="Prospect name" accent="#3D7A91" busy={busy.startsWith("sponsor")} onRun={(v) => generate("sponsor", null, v)} />
                  <Prompted title="Foundrae email" note="House rules enforced. Under 150 words, decision named, documents linked." placeholder="What is the email about?" accent={C.tan} busy={busy.startsWith("foundrae")} onRun={(v) => generate("foundrae", null, v)} />
                  <Card title="Sixty seconds" note="Standalone script for the morning video when the wire is not the subject." busy={busy === "script"} onRun={() => generate("script", null)} accent={C.red} />
                  <Card title="Clip desk" note="Paste a transcript. Get six ranked clips, or the full metadata object. Nothing publishes without your tick." busy={false} onRun={() => setDesk(true)} accent="#C2603F" />
                  <Card title="Essay workshop" note="Argue a V Spot essay into shape with an editor who knows your back catalogue. Saves per thread." busy={false} onRun={() => setWorkshop({})} accent="#6B5CA5" />
                </div>
              </div>

              {/* today's output */}
              <div className="mt-6">
                <SectionHead n="11" title="TODAY'S OUTPUT" right={`${log.length} drafted`} />
                {log.length === 0 ? (
                  <div className="px-4 py-6" style={{ background: C.navyDeep, border: `1px solid ${C.line}` }}>
                    <p style={{ fontSize: 13, color: C.grey }}>Nothing drafted yet. Everything you generate lands here and stays for the day.</p>
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {log.map((e) => (
                      <Output key={e.id} entry={e} onDelete={() => setLog((p) => p.filter((x) => x.id !== e.id))} />
                    ))}
                  </div>
                )}
              </div>

              {/* signals */}
              <div className="mt-6">
                <SectionHead n="12" title="SIGNALS" right={signals.length ? `${signals.length} weeks logged` : "no baseline yet"} />
                <Signals rows={signals} onAdd={(row) => {
                  const next = [row, ...signals.filter((r) => r.week !== row.week)].slice(0, 26);
                  setSignals(next);
                  sSet(K.signals, next);
                }} />
              </div>
            </section>
          </div>
        </div>

        {panel && <ResultPanel entry={panel} onClose={() => setPanel(null)} />}
        {desk && <ClipDesk onClose={() => setDesk(false)} />}
        {workshop && <EssayWorkshop threads={threads} threadContext={threadContext} seed={workshop.story || null} onClose={() => setWorkshop(false)} />}

        <footer className="flex items-center justify-between gap-3 flex-wrap" style={{ marginTop: 48, paddingTop: 16, borderTop: `1px solid ${C.line}`, fontFamily: FONT_M, fontSize: 10, letterSpacing: ".18em", color: "#9095B5" }}>
          <span>THE COCKPIT · SAVES ITSELF · TRALEE, KERRY</span>
          <span className="flex gap-2 items-center">
            <a className="btn" href="/api/oauth-start" style={{ ...btnStyle(googleConnected === "workspace" ? C.tan : C.grey, true), textDecoration: "none" }}>
              {googleConnected === "workspace" ? "WORKSPACE CONNECTED" : "CONNECT GMAIL + CALENDAR"}
            </a>
            <a className="btn" href="/api/oauth-start?service=youtube" style={{ ...btnStyle(googleConnected === "youtube" ? C.tan : C.grey, true), textDecoration: "none" }}>
              {googleConnected === "youtube" ? "YOUTUBE CONNECTED" : "CONNECT YOUTUBE"}
            </a>
            <button className="btn" onClick={onLogout} style={btnStyle(C.grey, true)}>SIGN OUT</button>
          </span>
        </footer>
      </main>
    </div>
  );
}

/* ============================================================
   PIECES
   ============================================================ */

function Meter({ pct }) {
  const segs = 20;
  const lit = Math.round((pct / 100) * segs);
  return (
    <div className="flex gap-[3px] mt-2 justify-end">
      {Array.from({ length: segs }, (_, i) => (
        <div
          key={i}
          style={{
            width: 7,
            height: 16,
            background: i < lit ? (i > segs - 4 ? C.red : C.tan) : "transparent",
            border: `1px solid ${i < lit ? "transparent" : "rgba(20,24,51,.18)"}`,
            boxShadow: i < lit && i > segs - 4 ? `0 0 8px ${C.red}` : "none",
          }}
        />
      ))}
    </div>
  );
}

function SectionHead({ n, title, right, action }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-2">
      <div className="flex items-baseline gap-2">
        <span style={{ fontFamily: FONT_M, fontSize: 10, color: C.red }}>{n}</span>
        <h2 style={{ fontFamily: FONT_D, fontSize: 22, fontWeight: 700, letterSpacing: ".03em" }}>{title}</h2>
      </div>
      <div className="flex items-center gap-3">
        {right && <span style={{ fontFamily: FONT_M, fontSize: 10, color: C.grey }}>{right}</span>}
        {action}
      </div>
    </div>
  );
}

function btnStyle(color, ghost) {
  return {
    fontFamily: FONT_M,
    fontSize: 10,
    letterSpacing: ".1em",
    padding: "6px 10px",
    background: ghost ? "transparent" : color,
    color: ghost ? color : C.black,
    border: `1px solid ${ghost ? color + "55" : color}`,
    fontWeight: 500,
  };
}

function Card({ title, note, onRun, busy, accent }) {
  return (
    <div style={{ background: C.navyDeep, border: `1px solid ${C.line}`, padding: 14, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 10 }}>
      <div>
        <h3 style={{ fontFamily: FONT_D, fontSize: 19, fontWeight: 700 }}>{title.toUpperCase()}</h3>
        <p style={{ fontSize: 12.5, color: C.grey, lineHeight: 1.45, marginTop: 3 }}>{note}</p>
      </div>
      <button className="btn" onClick={onRun} disabled={busy} style={{ ...btnStyle(accent, true), alignSelf: "flex-start" }}>
        {busy ? "WRITING…" : "GENERATE"}
      </button>
    </div>
  );
}

function Prompted({ title, note, placeholder, onRun, busy, accent }) {
  const [v, setV] = useState("");
  return (
    <div style={{ background: C.navyDeep, border: `1px solid ${C.line}`, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
      <div>
        <h3 style={{ fontFamily: FONT_D, fontSize: 19, fontWeight: 700 }}>{title.toUpperCase()}</h3>
        <p style={{ fontSize: 12.5, color: C.grey, lineHeight: 1.45, marginTop: 3 }}>{note}</p>
      </div>
      <div className="flex gap-2">
        <input
          value={v}
          onChange={(e) => setV(e.target.value)}
          placeholder={placeholder}
          style={{ flex: 1, minWidth: 0, background: C.navy, border: `1px solid ${C.line}`, color: "#141833", padding: "6px 9px", fontSize: 12.5 }}
        />
        <button className="btn" onClick={() => v.trim() && onRun(v.trim())} disabled={busy || !v.trim()} style={btnStyle(accent, true)}>
          {busy ? "…" : "GO"}
        </button>
      </div>
    </div>
  );
}

const SRC = {
  gmail: { label: "GMAIL", c: "#B81A1D" },
  slack: { label: "SLACK", c: "#3D7A91" },
  asana: { label: "ASANA", c: "#C2603F" },
  calendar: { label: "CALENDAR", c: "#565C82" },
  fireflies: { label: "FIREFLIES", c: "#6B5CA5" },
};

function DecisionCard({ card, state, onSet, onKeep }) {
  const [showDraft, setShowDraft] = useState(false);
  const [copied, setCopied] = useState(false);
  const src = SRC[card.src] || { label: (card.src || "").toUpperCase(), c: C.grey };
  const urgent = card.urgency === "today";
  const settled = !!state;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(card.draft);
      onKeep();
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      onKeep();
    }
  };

  return (
    <article
      style={{
        background: C.navyDeep,
        border: `1px solid ${urgent && !settled ? C.red + "55" : C.line}`,
        borderLeft: `3px solid ${settled ? "#9095B5" : src.c}`,
        padding: 14,
        opacity: settled ? 0.45 : 1,
        transition: "opacity .2s ease",
      }}
    >
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        <span style={{ fontFamily: FONT_M, fontSize: 9, letterSpacing: ".12em", color: src.c, border: `1px solid ${src.c}40`, padding: "1px 5px" }}>{src.label}</span>
        {urgent && <span style={{ fontFamily: FONT_M, fontSize: 9, letterSpacing: ".12em", color: C.red }}>TODAY</span>}
        <span style={{ fontFamily: FONT_M, fontSize: 9.5, color: "#767CA0" }}>{card.when}</span>
        {settled && <span style={{ fontFamily: FONT_M, fontSize: 9, color: C.tan, letterSpacing: ".1em" }}>{state.toUpperCase()}</span>}
      </div>

      <h3 style={{ fontFamily: FONT_D, fontSize: 20, fontWeight: 700, lineHeight: 1.1 }}>{card.who}</h3>
      <p style={{ fontSize: 13, color: "#4A5075", lineHeight: 1.5, marginTop: 4 }}>{card.what}</p>

      <p style={{ fontSize: 13.5, color: C.tan, lineHeight: 1.5, marginTop: 8, paddingTop: 8, borderTop: `1px solid rgba(20,24,51,.07)` }}>
        {card.needs}
      </p>

      {showDraft && card.draft && (
        <pre style={{ marginTop: 10, padding: 12, background: C.navy, border: `1px solid ${C.line}`, whiteSpace: "pre-wrap", fontFamily: FONT_B, fontSize: 13, lineHeight: 1.6, color: "#232748" }}>
          {card.draft}
        </pre>
      )}

      <div className="flex gap-2 mt-3 flex-wrap items-center">
        {card.draft ? (
          <>
            <button className="btn" onClick={() => setShowDraft(!showDraft)} style={btnStyle(C.tan, true)}>
              {showDraft ? "HIDE DRAFT" : "SEE DRAFT"}
            </button>
            <button className="btn" onClick={copy} style={btnStyle(C.tan)}>{copied ? "COPIED" : "USE IT"}</button>
          </>
        ) : null}
        <button className="btn" onClick={() => onSet("done")} style={btnStyle(C.grey, true)}>DONE</button>
        <button className="btn" onClick={() => onSet("deferred")} style={btnStyle(C.grey, true)}>DEFER</button>
        <button className="btn" onClick={() => onSet("not mine")} style={{ ...btnStyle(C.grey, true), borderColor: "transparent", color: "#767CA0" }}>NOT MINE</button>
        {card.link && (
          <a href={card.link} target="_blank" rel="noopener noreferrer" className="btn" style={{ ...btnStyle(C.grey, true), textDecoration: "none", marginLeft: "auto" }}>
            OPEN ↗
          </a>
        )}
      </div>
    </article>
  );
}

function Output({ entry, onDelete }) {
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(entry.body);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div style={{ background: C.navyDeep, border: `1px solid ${C.line}` }}>
      <div className="flex items-center justify-between gap-3 px-3 py-2" style={{ borderBottom: open ? `1px solid ${C.line}` : "none" }}>
        <button className="btn text-left" onClick={() => setOpen(!open)} style={{ background: "none", border: "none", flex: 1, minWidth: 0, padding: 0 }}>
          <span style={{ fontFamily: FONT_D, fontSize: 17, fontWeight: 700, color: C.tan }}>{entry.title.toUpperCase()}</span>
          {entry.sub && <span style={{ fontSize: 12, color: C.grey, marginLeft: 8 }}>{entry.sub.slice(0, 48)}</span>}
        </button>
        {entry.secret && (
          <span title="Stored locally. Never mirrored, never used to inform published content." style={{ fontFamily: FONT_M, fontSize: 8.5, letterSpacing: ".1em", color: C.tan, border: `1px solid ${C.tan}40`, padding: "2px 5px", whiteSpace: "nowrap" }}>
            LOCAL ONLY
          </span>
        )}
        <button className="btn" onClick={copy} style={btnStyle(C.grey, true)}>{copied ? "COPIED" : "COPY"}</button>
        <button className="btn" onClick={onDelete} style={{ ...btnStyle(C.grey, true), borderColor: "transparent", color: "#767CA0" }}>✕</button>
      </div>
      {open && (
        <pre style={{ padding: 14, margin: 0, whiteSpace: "pre-wrap", fontFamily: FONT_B, fontSize: 13.5, lineHeight: 1.62, color: "#232748" }}>{entry.body}</pre>
      )}
    </div>
  );
}

function AddTask({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slot, setSlot] = useState("15:00");
  const submit = () => {
    if (!name.trim()) return;
    onAdd({ id: "x" + Math.random().toString(36).slice(2), slot, name: name.trim(), note: "Added today.", w: 1, lane: "ops" });
    setName("");
    setOpen(false);
  };
  if (!open)
    return (
      <button className="btn mt-2" onClick={() => setOpen(true)} style={{ ...btnStyle(C.grey, true), width: "100%", padding: "8px" }}>
        + ADD SOMETHING TO TODAY
      </button>
    );
  return (
    <div className="flex gap-2 mt-2">
      <input value={slot} onChange={(e) => setSlot(e.target.value)} style={{ width: 64, background: C.navyDeep, border: `1px solid ${C.line}`, color: "#141833", padding: "6px 8px", fontFamily: FONT_M, fontSize: 12 }} />
      <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="What is it?" style={{ flex: 1, minWidth: 0, background: C.navyDeep, border: `1px solid ${C.line}`, color: "#141833", padding: "6px 9px", fontSize: 13 }} />
      <button className="btn" onClick={submit} style={btnStyle(C.tan, true)}>ADD</button>
    </div>
  );
}

/* Outcome metrics, entered weekly by hand. Completion is an input. These are
   the outputs. Six weeks at 100% with these flat is a very well run failure. */
const FIELDS = [
  { k: "liFollowers", label: "LinkedIn followers" },
  { k: "liViews", label: "LinkedIn 7d views" },
  { k: "subs", label: "Substack subs" },
  { k: "ytSubs", label: "YouTube subs" },
  { k: "ytWatch", label: "YouTube watch hrs" },
  { k: "spend", label: "Ad spend GBP" },
];

const PHASES = [
  { n: 1, name: "Subscribers", note: "Paid pushes the base. Judge on cost per sub, nothing else." },
  { n: 2, name: "Search", note: "Titles, descriptions, chapters. Judge on impressions from search." },
  { n: 3, name: "Watch time", note: "Retention and session length. Judge on average view duration." },
];

function isoWeek(d) {
  const t = new Date(d);
  t.setHours(0, 0, 0, 0);
  t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7));
  const w1 = new Date(t.getFullYear(), 0, 4);
  const n = 1 + Math.round(((t - w1) / 86400000 - 3 + ((w1.getDay() + 6) % 7)) / 7);
  return `${t.getFullYear()}-W${String(n).padStart(2, "0")}`;
}

function Signals({ rows, onAdd }) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState(1);
  const [v, setV] = useState({});
  const week = isoWeek(new Date());
  const latest = rows[0];
  const prev = rows[1];

  const delta = (k) => {
    if (!latest || !prev || latest[k] == null || prev[k] == null) return null;
    return Number(latest[k]) - Number(prev[k]);
  };

  const cps = latest && latest.spend && prev && latest.ytSubs != null && prev.ytSubs != null && latest.ytSubs > prev.ytSubs
    ? (Number(latest.spend) / (Number(latest.ytSubs) - Number(prev.ytSubs))).toFixed(2)
    : null;

  return (
    <div style={{ background: C.navyDeep, border: `1px solid ${C.line}`, padding: 14 }}>
      {/* the sequence */}
      <div className="flex gap-2 mb-3 flex-wrap">
        {PHASES.map((ph) => (
          <button key={ph.n} className="btn" onClick={() => setPhase(ph.n)} style={{ ...btnStyle(phase === ph.n ? C.red : C.grey, phase !== ph.n), padding: "5px 9px" }}>
            {ph.n}. {ph.name.toUpperCase()}
          </button>
        ))}
      </div>
      <p style={{ fontSize: 12.5, color: C.grey, lineHeight: 1.5, marginBottom: 12 }}>
        {PHASES[phase - 1].note} Running all three at once means you cannot tell which one worked. Move to the next when the current number stops improving, not when the month ends.
      </p>

      {rows.length === 0 ? (
        <p style={{ fontSize: 13, color: C.grey, lineHeight: 1.5 }}>
          No baseline. Log this week's numbers before the paid spend starts, or you will never know what it bought you.
        </p>
      ) : (
        <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))" }}>
          {FIELDS.map((f) => {
            const d = delta(f.k);
            return (
              <div key={f.k} style={{ borderLeft: `2px solid ${d > 0 ? C.tan : d < 0 ? C.red : "#9095B5"}`, paddingLeft: 8 }}>
                <div style={{ fontFamily: FONT_M, fontSize: 9, color: C.grey, letterSpacing: ".06em" }}>{f.label.toUpperCase()}</div>
                <div style={{ fontFamily: FONT_M, fontSize: 17 }}>{latest[f.k] ?? "-"}</div>
                {d !== null && <div style={{ fontFamily: FONT_M, fontSize: 10, color: d > 0 ? C.tan : d < 0 ? C.red : C.grey }}>{d > 0 ? "+" : ""}{d}</div>}
              </div>
            );
          })}
        </div>
      )}

      {cps && (
        <p style={{ fontSize: 12.5, color: C.tan, marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.line}` }}>
          Cost per YouTube subscriber this week: GBP {cps}. That is the only number phase one is judged on.
        </p>
      )}

      {!open ? (
        <button className="btn mt-3" onClick={() => setOpen(true)} style={{ ...btnStyle(C.grey, true), width: "100%", padding: 8 }}>
          + LOG {week}
        </button>
      ) : (
        <div className="mt-3 grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))" }}>
          {FIELDS.map((f) => (
            <div key={f.k}>
              <label style={{ fontFamily: FONT_M, fontSize: 9, color: C.grey, letterSpacing: ".06em", display: "block", marginBottom: 3 }}>{f.label.toUpperCase()}</label>
              <input
                inputMode="numeric"
                value={v[f.k] ?? ""}
                onChange={(e) => setV({ ...v, [f.k]: e.target.value })}
                style={{ width: "100%", background: C.navy, border: `1px solid ${C.line}`, color: "#141833", padding: "6px 8px", fontFamily: FONT_M, fontSize: 13 }}
              />
            </div>
          ))}
          <button className="btn" onClick={() => { onAdd({ week, phase, ...v }); setV({}); setOpen(false); }} style={{ ...btnStyle(C.tan), alignSelf: "flex-end", height: 32 }}>
            SAVE WEEK
          </button>
        </div>
      )}
    </div>
  );
}

/* The generated piece, shown the moment you ask for it. Copy, or send it
   straight to a new Google Doc. */
function ResultPanel({ entry, onClose }) {
  const [copied, setCopied] = useState(false);
  const [doc, setDoc] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    const esc = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(entry.body);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setErr("Clipboard blocked. Select the text and copy manually.");
    }
  };

  const toDoc = async () => {
    setSaving(true);
    setErr("");
    try {
      const name = `${entry.title}${entry.sub ? " - " + entry.sub.slice(0, 60) : ""} (${iso(new Date())})`;
      setDoc(await saveToGoogleDoc(name, entry.body));
    } catch (e) {
      setErr(e.message || "Could not save to Drive.");
    }
    setSaving(false);
  };

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(20,24,51,.35)", zIndex: 50, display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "5vh 16px", overflowY: "auto" }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.navyDeep, border: `1px solid ${C.line}`, borderTop: `3px solid ${C.red}`, width: "100%", maxWidth: 720 }}>
        <div className="flex items-center justify-between gap-3 px-4 py-3" style={{ borderBottom: `1px solid ${C.line}` }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontFamily: FONT_D, fontSize: 22, fontWeight: 700, color: C.tan, lineHeight: 1 }}>{entry.title.toUpperCase()}</h2>
            {entry.sub && <p style={{ fontSize: 12, color: C.grey, marginTop: 3 }}>{entry.sub.slice(0, 90)}</p>}
          </div>
          <button className="btn" onClick={onClose} style={{ ...btnStyle(C.grey, true), borderColor: "transparent", fontSize: 15 }}>✕</button>
        </div>

        {entry.loading ? (
          <div className="px-4 py-10 text-center">
            <div style={{ fontFamily: FONT_M, fontSize: 11, letterSpacing: ".18em", color: C.red }} className="lamp">WRITING…</div>
            <p style={{ fontSize: 12.5, color: C.grey, marginTop: 8 }}>Twenty to sixty seconds. It is reading your archive so it does not repeat you.</p>
          </div>
        ) : (
          <>
            <pre style={{ padding: 18, margin: 0, whiteSpace: "pre-wrap", fontFamily: FONT_B, fontSize: 14.5, lineHeight: 1.65, color: "#141833", maxHeight: "55vh", overflowY: "auto" }}>
              {entry.body}
            </pre>

            <div className="flex gap-2 px-4 py-3 flex-wrap items-center" style={{ borderTop: `1px solid ${C.line}` }}>
              <button className="btn" onClick={copy} style={btnStyle(C.tan)}>{copied ? "COPIED" : "COPY"}</button>
              {doc ? (
                <a className="btn" href={doc.url} target="_blank" rel="noopener noreferrer" style={{ ...btnStyle(C.tan, true), textDecoration: "none" }}>
                  OPEN IN DOCS ↗
                </a>
              ) : (
                <button className="btn" onClick={toDoc} disabled={saving} style={btnStyle("#3D7A91", true)}>
                  {saving ? "SAVING…" : "SAVE TO GOOGLE DOC"}
                </button>
              )}
              {entry.secret && (
                <span style={{ fontFamily: FONT_M, fontSize: 9, letterSpacing: ".1em", color: C.tan }}>CONFIDENTIAL · LOCAL LEDGER ONLY</span>
              )}
            </div>
            {err && <p style={{ fontSize: 12.5, color: C.red, padding: "0 18px 14px" }}>{err}</p>}
          </>
        )}
      </div>
    </div>
  );
}

/* Two slots a day, one written and one video. A day is only content-complete
   when both are filled, and filling them ticks the rundown. */
function ContentCalendar({ cal, today, recent, onSet }) {
  const [open, setOpen] = useState(null); // "YYYY-MM-DD:slot"
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    return iso(d);
  });

  const Slot = ({ dk, slot, label }) => {
    const val = cal[dk]?.[slot] || "";
    const key = `${dk}:${slot}`;
    const isOpen = open === key;
    return (
      <div style={{ flex: 1, minWidth: 0 }}>
        {isOpen ? (
          <div>
            <input
              autoFocus
              defaultValue={val}
              placeholder={label}
              onKeyDown={(e) => {
                if (e.key === "Enter") { onSet(dk, slot, e.target.value.trim()); setOpen(null); }
                if (e.key === "Escape") setOpen(null);
              }}
              onBlur={(e) => { onSet(dk, slot, e.target.value.trim()); setOpen(null); }}
              style={{ width: "100%", background: C.navy, border: `1px solid ${C.tan}`, color: "#141833", padding: "4px 6px", fontSize: 12 }}
            />
            {recent.length > 0 && (
              <div className="flex gap-1 mt-1 flex-wrap">
                {recent.slice(0, 4).map((r) => (
                  <button key={r.id} className="btn" onMouseDown={(e) => { e.preventDefault(); onSet(dk, slot, r.title); setOpen(null); }}
                    style={{ ...btnStyle(C.grey, true), fontSize: 8.5, padding: "2px 5px", maxWidth: 130, overflow: "hidden", whiteSpace: "nowrap" }}>
                    {(r.title || "").slice(0, 22)}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <button className="btn text-left" onClick={() => setOpen(key)}
            style={{ width: "100%", background: val ? "#D6EFE0" : "transparent",
                     border: `1px dashed ${val ? "transparent" : "#9095B5"}`,
                     borderLeft: `2px solid ${val ? (slot === "video" ? C.red : C.tan) : "#9095B5"}`,
                     color: val ? "#141833" : "#767CA0", padding: "5px 7px", fontSize: 11.5, lineHeight: 1.3 }}>
            {val || `+ ${label}`}
          </button>
        )}
      </div>
    );
  };

  return (
    <div style={{ border: `1px solid ${C.line}` }}>
      {days.map((dk, i) => {
        const d = new Date(dk);
        const full = !!(cal[dk]?.written && cal[dk]?.video);
        return (
          <div key={dk} className="flex gap-2 px-3 py-2 items-start"
               style={{ background: C.navyDeep, borderTop: i === 0 ? "none" : `1px solid rgba(20,24,51,.07)`,
                        borderLeft: `3px solid ${full ? C.tan : i === 0 ? C.red : "transparent"}` }}>
            <div style={{ minWidth: 34, paddingTop: 4 }}>
              <div style={{ fontFamily: FONT_M, fontSize: 10, color: i === 0 ? C.red : C.grey }}>{DAYS[d.getDay()][0]}{DAYS[d.getDay()][1].toLowerCase()}</div>
              <div style={{ fontFamily: FONT_M, fontSize: 9, color: "#767CA0" }}>{d.getDate()}</div>
            </div>
            <div className="flex gap-1.5" style={{ flex: 1, minWidth: 0 }}>
              <Slot dk={dk} slot="written" label="written" />
              <Slot dk={dk} slot="video" label="video" />
            </div>
          </div>
        );
      })}
      <p style={{ fontSize: 11, color: "#767CA0", padding: "8px 10px", borderTop: `1px solid ${C.line}`, lineHeight: 1.4 }}>
        Two a day, minimum one written and one video. Filling both ticks Sixty Seconds and The Post in the rundown.
      </p>
    </div>
  );
}

/* Which sources are actually earning their place. Seen is how often the wire
   surfaced them, used is how often you built something from them. */
function SourceLedger({ sources }) {
  const rows = Object.entries(sources)
    .map(([name, v]) => ({ name, ...v, rate: v.seen ? v.used / v.seen : 0 }))
    .sort((a, b) => b.used - a.used || b.seen - a.seen);

  if (!rows.length)
    return (
      <div className="px-4 py-5" style={{ background: C.navyDeep, border: `1px solid ${C.line}` }}>
        <p style={{ fontSize: 12.5, color: C.grey }}>Nothing tracked yet. Pull the wire a few times and the pattern appears.</p>
      </div>
    );

  const light = (r) => (r.used >= 3 ? C.tan : r.used >= 1 ? "#A8761A" : r.seen >= 4 ? C.red : "#9095B5");
  const verdict = (r) => (r.used >= 3 ? "carrying you" : r.used >= 1 ? "occasional" : r.seen >= 4 ? "noise, consider dropping" : "too early to say");

  return (
    <div style={{ border: `1px solid ${C.line}` }}>
      {rows.slice(0, 14).map((r, i) => (
        <div key={r.name} className="flex items-center gap-2 px-3 py-2"
             style={{ background: C.navyDeep, borderTop: i === 0 ? "none" : `1px solid rgba(20,24,51,.07)` }}>
          <span style={{ width: 8, height: 8, borderRadius: 99, background: light(r), flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, color: "#141833", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{r.name}</div>
            <div style={{ fontSize: 10.5, color: "#767CA0" }}>{verdict(r)}</div>
          </div>
          <span style={{ fontFamily: FONT_M, fontSize: 10, color: C.grey, whiteSpace: "nowrap" }}>{r.used}/{r.seen}</span>
        </div>
      ))}
    </div>
  );
}

/* Draft on the left, editor on the right. The draft is yours and is never
   silently altered: rewrites are explicit, and the previous version is kept
   so you can always take it back. */
function EssayWorkshop({ threads, threadContext, seed, onClose }) {
  const [thread, setThread] = useState(seed?.thread || "");
  const [draft, setDraft] = useState("");
  const [prev, setPrev] = useState(null);
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("draft"); // mobile
  const endRef = useRef(null);

  useEffect(() => {
    (async () => {
      // Keyed by thread, so discussing a wire story continues that thread's
      // essay rather than starting a disconnected document.
      const saved = await sGet(K.essay(thread), null);
      setDraft(saved?.draft || "");
      setHistory(saved?.history || []);
      setPrev(null);
    })();
  }, [thread]);

  const save = useCallback(
    (d, h) => sSet(K.essay(thread), { draft: d, history: h, updated: Date.now() }),
    [thread]
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, busy]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    const next = [...history, { role: "user", content: text }];
    setHistory(next);
    setInput("");
    setBusy("chat");
    setErr("");
    try {
      const r = await callOp({
        op: "essay",
        thread: threads.find((t) => t.id === thread)?.name || "",
        archive: threadContext(thread),
        story: seed || null,
        draft,
        history: next,
      });
      const after = [...next, { role: "assistant", content: r.text }];
      setHistory(after);
      save(draft, after);
    } catch (e) {
      setErr(e.message || "The editor did not come back.");
      setHistory(next);
    }
    setBusy("");
  };

  const rewrite = async () => {
    if (busy) return;
    setBusy("rewrite");
    setErr("");
    try {
      const r = await callOp({
        op: "rewrite",
        thread: threads.find((t) => t.id === thread)?.name || "",
        archive: threadContext(thread),
        story: seed || null,
        draft,
        history,
        extra: input.trim(),
      });
      setPrev(draft);
      setDraft(r.text);
      save(r.text, history);
      setInput("");
      setTab("draft");
    } catch (e) {
      setErr(e.message || "Rewrite failed.");
    }
    setBusy("");
  };

  const words = draft.trim() ? draft.trim().split(/\s+/).length : 0;

  return (
    <div style={{ position: "fixed", inset: 0, background: C.black, zIndex: 60, display: "flex", flexDirection: "column" }}>
      <div className="flex items-center gap-3 px-4 py-3 flex-wrap" style={{ background: C.navy, borderBottom: `1px solid ${C.line}` }}>
        <h2 style={{ fontFamily: FONT_D, fontSize: 24, fontWeight: 900, color: "#6B5CA5", lineHeight: 1 }}>ESSAY WORKSHOP</h2>
        <select value={thread} onChange={(e) => setThread(e.target.value)}
          style={{ background: C.navyDeep, border: `1px solid ${C.line}`, color: "#141833", padding: "5px 8px", fontSize: 12.5, maxWidth: 240 }}>
          <option value="">No thread, standalone</option>
          {threads.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <span style={{ fontFamily: FONT_M, fontSize: 10, color: C.grey }}>{words} words</span>
        <div className="flex gap-1 lg:hidden">
          {["draft", "editor"].map((k) => (
            <button key={k} className="btn" onClick={() => setTab(k)} style={{ ...btnStyle(tab === k ? C.tan : C.grey, tab !== k), padding: "4px 8px" }}>{k.toUpperCase()}</button>
          ))}
        </div>
        <button className="btn" onClick={onClose} style={{ ...btnStyle(C.grey, true), marginLeft: "auto" }}>CLOSE</button>
      </div>

      {err && <div className="px-4 py-2" style={{ background: "#FFD8D9", fontSize: 12.5 }}>{err}</div>}

      <div className="flex" style={{ flex: 1, minHeight: 0 }}>
        {/* draft */}
        <div className={tab === "draft" ? "flex flex-col" : "hidden lg:flex lg:flex-col"} style={{ flex: 1.25, minWidth: 0, borderRight: `1px solid ${C.line}` }}>
          <textarea
            value={draft}
            onChange={(e) => { setDraft(e.target.value); save(e.target.value, history); }}
            placeholder="Write here. Or paste what you have and start arguing about it."
            style={{ flex: 1, background: C.navyDeep, border: "none", color: "#141833", padding: 20, fontSize: 15, lineHeight: 1.7, resize: "none", outline: "none", fontFamily: FONT_B }}
          />
          {prev && (
            <div className="px-3 py-2 flex items-center gap-2" style={{ borderTop: `1px solid ${C.line}`, background: C.navy }}>
              <span style={{ fontSize: 11.5, color: C.tan }}>Rewritten. Your previous version is kept.</span>
              <button className="btn" onClick={() => { setDraft(prev); save(prev, history); setPrev(null); }} style={btnStyle(C.grey, true)}>TAKE IT BACK</button>
            </div>
          )}
        </div>

        {/* editor */}
        <div className={tab === "editor" ? "flex flex-col" : "hidden lg:flex lg:flex-col"} style={{ flex: 1, minWidth: 0 }}>
          <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
            {seed && (
              <div style={{ background: C.navyDeep, border: `1px solid ${C.line}`, borderLeft: `3px solid #6B5CA5`, padding: 12, marginBottom: 14 }}>
                <div style={{ fontFamily: FONT_M, fontSize: 9, letterSpacing: ".12em", color: "#767CA0", marginBottom: 3 }}>
                  STARTED FROM THE WIRE{seed.source ? ` · ${seed.source.toUpperCase()}` : ""}
                </div>
                <div style={{ fontFamily: FONT_D, fontSize: 17, fontWeight: 700, lineHeight: 1.15 }}>{seed.headline}</div>
                {seed.pov && <p style={{ fontSize: 12.5, color: C.tan, marginTop: 5, fontStyle: "italic", lineHeight: 1.5 }}>{seed.pov}</p>}
              </div>
            )}
            {history.length === 0 && (
              <p style={{ fontSize: 13, color: C.grey, lineHeight: 1.6 }}>
                {seed
                  ? "It has the story and your archive for this thread. Ask it what the story is actually evidence of, or tell it your instinct and make it argue back."
                  : "Tell it what the essay is trying to do. It has your archive for this thread, so it knows what you have already argued and will tell you when you are repeating yourself."}
              </p>
            )}
            {history.map((m, i) => (
              <div key={i} style={{ marginBottom: 14 }}>
                <div style={{ fontFamily: FONT_M, fontSize: 9, letterSpacing: ".14em", color: m.role === "user" ? C.red : "#6B5CA5", marginBottom: 3 }}>
                  {m.role === "user" ? "VINNY" : "EDITOR"}
                </div>
                <div style={{ fontSize: 13.5, lineHeight: 1.6, color: m.role === "user" ? "#4A5075" : "#141833", whiteSpace: "pre-wrap" }}>{m.content}</div>
              </div>
            ))}
            {busy && <div className="lamp" style={{ fontFamily: FONT_M, fontSize: 10, letterSpacing: ".16em", color: "#6B5CA5" }}>{busy === "rewrite" ? "REWRITING…" : "THINKING…"}</div>}
            <div ref={endRef} />
          </div>

          <div style={{ borderTop: `1px solid ${C.line}`, padding: 10, background: C.navy }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(); }}
              rows={3}
              placeholder="Argue with it. Cmd+Enter to send."
              style={{ width: "100%", background: C.navyDeep, border: `1px solid ${C.line}`, color: "#141833", padding: 9, fontSize: 13, lineHeight: 1.5, resize: "vertical" }}
            />
            <div className="flex gap-2 mt-2">
              <button className="btn" onClick={send} disabled={!!busy || !input.trim()} style={btnStyle("#6B5CA5")}>SEND</button>
              <button className="btn" onClick={rewrite} disabled={!!busy || !draft.trim()} style={btnStyle(C.tan, true)}>REWRITE DRAFT</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Branch A and B of the desk. Transcript in, proposals out, nothing published.
   The tick is the gate, exactly as the contract requires. */
function ClipDesk({ onClose }) {
  const [mode, setMode] = useState("selection");
  const [context, setContext] = useState("");
  const [source, setSource] = useState("");
  const [out, setOut] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [approved, setApproved] = useState({});

  const words = source.trim() ? source.trim().split(/\s+/).length : 0;

  const run = async () => {
    setBusy(true); setErr(""); setOut(null);
    try {
      const r = await callOp({ op: mode, extra: context, draft: source });
      const t = r.text.replace(/```json|```/g, "").trim();
      const a = mode === "selection" ? t.indexOf("[") : t.indexOf("{");
      const b = mode === "selection" ? t.lastIndexOf("]") : t.lastIndexOf("}");
      setOut(JSON.parse(t.slice(a, b + 1)));
    } catch (e) { setErr(e.message || "The desk failed."); }
    setBusy(false);
  };

  const copy = (v) => navigator.clipboard?.writeText(typeof v === "string" ? v : JSON.stringify(v, null, 2));

  return (
    <div style={{ position: "fixed", inset: 0, background: C.black, zIndex: 60, display: "flex", flexDirection: "column" }}>
      <div className="flex items-center gap-3 px-4 py-3 flex-wrap" style={{ background: C.navy, borderBottom: `1px solid ${C.line}` }}>
        <h2 style={{ fontFamily: FONT_D, fontSize: 24, fontWeight: 900, color: "#C2603F", lineHeight: 1 }}>CLIP DESK</h2>
        {[["selection", "SELECT CLIPS"], ["metadata", "WRITE METADATA"]].map(([k, l]) => (
          <button key={k} className="btn" onClick={() => { setMode(k); setOut(null); }} style={{ ...btnStyle(mode === k ? "#C2603F" : C.grey, mode !== k), padding: "5px 9px" }}>{l}</button>
        ))}
        <span style={{ fontFamily: FONT_M, fontSize: 10, color: words < 500 && words > 0 ? C.red : C.grey }}>{words} words{words > 0 && words < 500 ? " · under the 500 floor" : ""}</span>
        <button className="btn" onClick={onClose} style={{ ...btnStyle(C.grey, true), marginLeft: "auto" }}>CLOSE</button>
      </div>

      {err && <div className="px-4 py-3" style={{ background: "#FFD8D9", fontSize: 13, lineHeight: 1.5 }}>{err}</div>}

      <div className="flex" style={{ flex: 1, minHeight: 0 }}>
        <div className="flex flex-col" style={{ flex: 1, minWidth: 0, borderRight: `1px solid ${C.line}` }}>
          <input value={context} onChange={(e) => setContext(e.target.value)} placeholder="Which show, which episode, who is in it"
            style={{ background: C.navy, border: "none", borderBottom: `1px solid ${C.line}`, color: "#141833", padding: "10px 14px", fontSize: 13 }} />
          <textarea value={source} onChange={(e) => setSource(e.target.value)}
            placeholder="Paste the transcript with timestamps. Under 500 words and the desk halts, by design."
            style={{ flex: 1, background: C.navyDeep, border: "none", color: "#4A5075", padding: 14, fontSize: 13, lineHeight: 1.6, resize: "none", outline: "none", fontFamily: FONT_M }} />
          <div className="px-3 py-2" style={{ borderTop: `1px solid ${C.line}`, background: C.navy }}>
            <button className="btn" onClick={run} disabled={busy || words < 500} style={btnStyle("#C2603F")}>
              {busy ? "RUNNING…" : mode === "selection" ? "RANK THE CLIPS" : "WRITE THE METADATA"}
            </button>
          </div>
        </div>

        <div style={{ flex: 1.1, minWidth: 0, overflowY: "auto", padding: 16 }}>
          {!out && !busy && <p style={{ fontSize: 13, color: C.grey, lineHeight: 1.6 }}>Output lands here as a queue awaiting your tick. Nothing leaves this screen on its own.</p>}
          {busy && <div className="lamp" style={{ fontFamily: FONT_M, fontSize: 10, letterSpacing: ".16em", color: "#C2603F" }}>WORKING…</div>}

          {out && mode === "selection" && out.map((c, i) => (
            <div key={i} style={{ background: C.navyDeep, border: `1px solid ${C.line}`, borderLeft: `3px solid ${approved[i] ? C.tan : c.divergence ? C.red : "#9095B5"}`, padding: 12, marginBottom: 8, opacity: approved[i] ? 0.5 : 1 }}>
              <div className="flex items-center gap-2 mb-1">
                <span style={{ fontFamily: FONT_M, fontSize: 10, color: C.tan }}>{c.start} – {c.end}</span>
                {c.divergence && <span style={{ fontFamily: FONT_M, fontSize: 8.5, letterSpacing: ".1em", color: C.red }}>CROSS-ATLANTIC</span>}
              </div>
              <div style={{ fontFamily: FONT_D, fontSize: 18, fontWeight: 700 }}>{c.hook}</div>
              <p style={{ fontSize: 12.5, color: C.grey, marginTop: 4, lineHeight: 1.5 }}>{c.why_it_carries}</p>
              {c.boundary_note && <p style={{ fontSize: 12, color: C.red, marginTop: 4 }}>Boundary: {c.boundary_note}</p>}
              <div className="flex gap-2 mt-2">
                <button className="btn" onClick={() => setApproved((p) => ({ ...p, [i]: !p[i] }))} style={btnStyle(C.tan, !approved[i])}>{approved[i] ? "APPROVED" : "APPROVE"}</button>
                <button className="btn" onClick={() => copy(c)} style={btnStyle(C.grey, true)}>COPY</button>
              </div>
            </div>
          ))}

          {out && mode === "metadata" && (
            <div className="grid gap-3">
              {(out.titles || []).map((t, i) => (
                <div key={i} style={{ background: C.navyDeep, border: `1px solid ${C.line}`, padding: 10 }}>
                  <div style={{ fontFamily: FONT_M, fontSize: 9, letterSpacing: ".12em", color: "#C2603F" }}>{(t.variant || "").toUpperCase()}</div>
                  <div style={{ fontSize: 14.5, marginTop: 3 }}>{t.text}</div>
                </div>
              ))}
              {out.hook && <Block label="HOOK" body={out.hook} onCopy={() => copy(out.hook)} />}
              {(out.claim_block || []).length > 0 && (
                <Block label="CLAIM BLOCK" onCopy={() => copy(out.claim_block)}
                  body={out.claim_block.map((c) => `${c.claim} — ${c.attributed_to} (${c.timestamp})`).join("\n\n")} />
              )}
              {(out.chapters || []).length > 0 && (
                <Block label="CHAPTERS" onCopy={() => copy(out.chapters.map((c) => `${c.t} ${c.label}`).join("\n"))}
                  body={out.chapters.map((c) => `${c.t}  ${c.label}`).join("\n")} />
              )}
              {out.pinned_comment && <Block label="PINNED COMMENT" body={out.pinned_comment} onCopy={() => copy(out.pinned_comment)} />}
              {(out.threads_back_to || []).length > 0 && (
                <Block label="THREADS BACK TO" onCopy={() => copy(out.threads_back_to)}
                  body={out.threads_back_to.map((t) => `${t.relationship}: ${t.title}${t.note ? ` — ${t.note}` : ""}`).join("\n")} />
              )}
              {(out.clips || []).map((c, i) => (
                <Block key={i} label={`CLIP ${i + 1} · ${c.start}–${c.end} · ${c.hook}`} onCopy={() => copy(c.captions)}
                  body={Object.entries(c.captions || {}).map(([k, v]) => `[${k}]\n${v}`).join("\n\n")} />
              ))}
              <button className="btn" onClick={() => copy(out)} style={{ ...btnStyle("#C2603F", true), alignSelf: "flex-start" }}>COPY FULL JSON</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Block({ label, body, onCopy }) {
  return (
    <div style={{ background: C.navyDeep, border: `1px solid ${C.line}`, padding: 12 }}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span style={{ fontFamily: FONT_M, fontSize: 9, letterSpacing: ".12em", color: C.tan }}>{label}</span>
        <button className="btn" onClick={onCopy} style={{ ...btnStyle(C.grey, true), fontSize: 8.5, padding: "2px 6px" }}>COPY</button>
      </div>
      <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: FONT_B, fontSize: 13, lineHeight: 1.6, color: "#232748" }}>{body}</pre>
    </div>
  );
}

function AddReading({ onAdd, busy }) {
  const [v, setV] = useState("");
  return (
    <div className="flex gap-2" style={{ background: C.navyDeep, border: `1px solid ${C.line}`, padding: 10 }}>
      <input value={v} onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && v.trim()) { onAdd(v.trim()); setV(""); } }}
        placeholder="Paste a URL for Sunday"
        style={{ flex: 1, minWidth: 0, background: C.navy, border: `1px solid ${C.line}`, color: "#141833", padding: "6px 9px", fontSize: 12.5 }} />
      <button className="btn" onClick={() => { if (v.trim()) { onAdd(v.trim()); setV(""); } }} disabled={busy || !v.trim()} style={btnStyle(C.tan, true)}>
        {busy ? "LOOKING…" : "ADD"}
      </button>
    </div>
  );
}

/* A simple staged pipeline. Deliberately not a kanban: the point is to see
   what has gone quiet, and a list sorted by staleness does that better. */
function Pipeline({ rows, stages, placeholder, onChange }) {
  const [name, setName] = useState("");
  const add = () => {
    if (!name.trim()) return;
    onChange([{ id: Math.random().toString(36).slice(2), name: name.trim(), stage: stages[0], touched: iso(new Date()), note: "" }, ...rows]);
    setName("");
  };
  const set = (id, patch) =>
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch, touched: iso(new Date()) } : r)));

  const stale = (r) => daysSince(r.touched, new Date());

  return (
    <div style={{ border: `1px solid ${C.line}` }}>
      <div className="flex gap-2 px-2 py-2" style={{ background: C.navy, borderBottom: `1px solid ${C.line}` }}>
        <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder={placeholder}
          style={{ flex: 1, minWidth: 0, background: C.navyDeep, border: `1px solid ${C.line}`, color: "#141833", padding: "5px 8px", fontSize: 12.5 }} />
        <button className="btn" onClick={add} disabled={!name.trim()} style={btnStyle(C.tan, true)}>ADD</button>
      </div>
      {rows.length === 0 ? (
        <p style={{ fontSize: 12.5, color: C.grey, padding: 12 }}>Nothing tracked. The gap above will keep telling you so.</p>
      ) : (
        [...rows].sort((a, b) => stages.indexOf(a.stage) - stages.indexOf(b.stage) || (stale(b) - stale(a))).map((r, i) => {
          const d = stale(r);
          const cold = d !== null && d > 14 && !["published", "recorded"].includes(r.stage);
          return (
            <div key={r.id} className="px-3 py-2" style={{ background: C.navyDeep, borderTop: i === 0 ? "none" : `1px solid rgba(20,24,51,.07)`, borderLeft: `3px solid ${cold ? C.red : r.stage === "confirmed" ? C.tan : "#9095B5"}` }}>
              <div className="flex items-center gap-2">
                <span style={{ flex: 1, minWidth: 0, fontSize: 13, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{r.name}</span>
                <span style={{ fontFamily: FONT_M, fontSize: 9.5, color: cold ? C.red : "#767CA0" }}>{d === 0 ? "today" : d + "d"}</span>
                <button className="btn" onClick={() => onChange(rows.filter((x) => x.id !== r.id))} style={{ ...btnStyle(C.grey, true), borderColor: "transparent", color: "#9095B5", fontSize: 9, padding: "1px 4px" }}>✕</button>
              </div>
              <div className="flex gap-1 mt-1.5 flex-wrap">
                {stages.map((st) => (
                  <button key={st} className="btn" onClick={() => set(r.id, { stage: st })}
                    style={{ ...btnStyle(r.stage === st ? C.tan : C.grey, r.stage !== st), fontSize: 8.5, padding: "2px 6px" }}>
                    {st.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

/* Spec builds and microsites made for prospects. Camp Tralee flagged, because
   an invitation-only event in January needs its pipeline warm now. */
function Assets({ rows, onChange }) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const STATUS = ["built", "sent", "won", "declined"];

  const add = () => {
    if (!name.trim()) return;
    onChange([{ id: Math.random().toString(36).slice(2), name: name.trim(), url: url.trim(), status: "built", camp: false, touched: iso(new Date()) }, ...rows]);
    setName("");
    setUrl("");
  };
  const set = (id, patch) => onChange(rows.map((r) => (r.id === id ? { ...r, ...patch, touched: iso(new Date()) } : r)));

  return (
    <div style={{ border: `1px solid ${C.line}` }}>
      <div className="grid gap-1.5 px-2 py-2" style={{ background: C.navy, borderBottom: `1px solid ${C.line}` }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Prospect, and what you built them"
          style={{ background: C.navyDeep, border: `1px solid ${C.line}`, color: "#141833", padding: "5px 8px", fontSize: 12.5 }} />
        <div className="flex gap-1.5">
          <input value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} placeholder="netlify URL"
            style={{ flex: 1, minWidth: 0, background: C.navyDeep, border: `1px solid ${C.line}`, color: "#141833", padding: "5px 8px", fontFamily: FONT_M, fontSize: 11.5 }} />
          <button className="btn" onClick={add} disabled={!name.trim()} style={btnStyle(C.tan, true)}>ADD</button>
        </div>
      </div>
      {rows.length === 0 ? (
        <p style={{ fontSize: 12.5, color: C.grey, padding: 12 }}>No spec builds tracked. The Salesfire piece worked because it existed before the conversation did.</p>
      ) : (
        rows.map((r, i) => (
          <div key={r.id} className="px-3 py-2" style={{ background: C.navyDeep, borderTop: i === 0 ? "none" : `1px solid rgba(20,24,51,.07)`, borderLeft: `3px solid ${r.camp ? C.red : r.status === "won" ? C.tan : r.status === "sent" ? "#3D7A91" : "#9095B5"}` }}>
            <div className="flex items-center gap-2">
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{r.name}</span>
              {r.url && <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: FONT_M, fontSize: 9.5, color: "#3D7A91" }}>OPEN</a>}
              <button className="btn" onClick={() => onChange(rows.filter((x) => x.id !== r.id))} style={{ ...btnStyle(C.grey, true), borderColor: "transparent", color: "#9095B5", fontSize: 9, padding: "1px 4px" }}>✕</button>
            </div>
            <div className="flex gap-1 mt-1.5 flex-wrap items-center">
              {STATUS.map((st) => (
                <button key={st} className="btn" onClick={() => set(r.id, { status: st })}
                  style={{ ...btnStyle(r.status === st ? C.tan : C.grey, r.status !== st), fontSize: 8.5, padding: "2px 6px" }}>{st.toUpperCase()}</button>
              ))}
              <button className="btn" onClick={() => set(r.id, { camp: !r.camp })}
                style={{ ...btnStyle(r.camp ? C.red : C.grey, !r.camp), fontSize: 8.5, padding: "2px 6px", marginLeft: "auto" }}>CAMP TRALEE</button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function ShortCard({ clip, busy, onPublish, done }) {
  const [open, setOpen] = useState(false);
  return (
    <article style={{ background: C.navyDeep, border: `1px solid ${C.line}`, borderLeft: `3px solid ${done ? C.tan : clip.divergence ? C.red : "#C2603F"}`, padding: 13, opacity: done ? 0.55 : 1 }}>
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        <span style={{ fontFamily: FONT_M, fontSize: 9, letterSpacing: ".1em", color: "#767CA0" }}>{(clip.episode || "").toUpperCase().slice(0, 34)}</span>
        {clip.guest && <span style={{ fontFamily: FONT_M, fontSize: 9, color: C.tan }}>{clip.guest}</span>}
        <span style={{ fontFamily: FONT_M, fontSize: 9, color: C.grey }}>{clip.seconds}s</span>
        {clip.divergence && <span style={{ fontFamily: FONT_M, fontSize: 8.5, letterSpacing: ".1em", color: C.red }}>CROSS-ATLANTIC</span>}
        <span style={{ fontFamily: FONT_M, fontSize: 8.5, color: "#9095B5" }}>opus #{clip.opus_rank}</span>
      </div>
      <h3 style={{ fontFamily: FONT_D, fontSize: 19, fontWeight: 700, lineHeight: 1.15 }}>{clip.title}</h3>
      <p style={{ fontSize: 12.5, color: "#4A5075", marginTop: 4, lineHeight: 1.5 }}>
        <span style={{ color: "#C2603F" }}>HOOK</span> {clip.hook}
      </p>
      <p style={{ fontSize: 12.5, color: C.tan, marginTop: 4, lineHeight: 1.5 }}>{clip.reason}</p>
      {open && (
        <pre style={{ marginTop: 8, padding: 10, background: C.navy, border: `1px solid ${C.line}`, whiteSpace: "pre-wrap", fontFamily: FONT_B, fontSize: 12.5, lineHeight: 1.55, color: "#232748" }}>{clip.description}</pre>
      )}
      <div className="flex gap-2 mt-2.5 flex-wrap items-center">
        <button className="btn" onClick={() => setOpen(!open)} style={btnStyle(C.grey, true)}>{open ? "HIDE COPY" : "SEE COPY"}</button>
        {ACCOUNTS.map((a) => {
          const mine = busy === "pub" + clip.clipId + a.id;
          return (
            <button key={a.id} className="btn" onClick={() => onPublish(clip, a, null)} disabled={!!busy} style={btnStyle(mine ? C.red : "#C2603F", !mine)}>
              {mine ? "POSTING..." : "PUBLISH " + a.short}
            </button>
          );
        })}
        {done && <span style={{ fontFamily: FONT_M, fontSize: 9, color: C.tan }}>SHIPPED</span>}
      </div>
    </article>
  );
}

function Skeleton() {
  return (
    <div className="grid gap-2">
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ background: C.navyDeep, border: `1px solid ${C.line}`, padding: 14 }}>
          <div style={{ height: 8, width: "22%", background: "rgba(20,24,51,0.08)", marginBottom: 10 }} />
          <div style={{ height: 16, width: "78%", background: "rgba(20,24,51,0.08)", marginBottom: 8 }} />
          <div style={{ height: 10, width: "94%", background: "rgba(20,24,51,0.05)" }} />
        </div>
      ))}
    </div>
  );
}
