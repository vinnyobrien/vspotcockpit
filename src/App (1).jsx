import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  MessageSquare, Film, PenLine, Users, TrendingUp, Mic, Hammer,
  Drama, LineChart, ChevronLeft,
} from "lucide-react";
import {
  C, BODY, SH, R, Mono, Big, Card, Section, Pill, Problem,
  iso, DAYS, MONTHS, daysSince, weekDates,
} from "./lib/ui.jsx";
import { sGet, sSet, callOp, publishClipDirect } from "./api.js";

import Today from "./rooms/Today.jsx";
import Desk from "./rooms/Desk.jsx";
import Video from "./rooms/Video.jsx";

/* ============================================================
   THE COCKPIT · A V SPOT NETWORK PRODUCTION

   Standing orders, unchanged because nothing has improved on them:
     Live or nothing. Nothing on this screen comes from memory.
     Every card arrives with the work done to the last step,
     and the last step is yours.

   Ten rooms, no parents. A hub, not a tab bar — grouping ten peers
   into four categories was a taxonomy the work does not have.
   Nothing is ever late.
   ============================================================ */

const K = {
  day: (d) => `day:${d}`,
  hist: "history",
  ledger: "ledger",
  threads: "threads",
  vault: "vault:entries",
  calendar: "content-calendar",
  shorts: (d) => `shorts:${d}`,
  published: "published-shorts",
  guests: "guests",
  assets: "sponsor-assets",
};

const DAILY = [
  { id: "wire", slot: "07:00", name: "The Wire", note: "Read the headlines. Pick the one story you are carrying today.", w: 1 },
  { id: "sixty", slot: "07:30", name: "Sixty Seconds", note: "Record and post the Short. Yesterday, and what you think about it.", w: 3 },
  { id: "fnd-inbox", slot: "09:00", name: "Foundrae inbox", note: "Clear it. Short, clear, linked, decision named.", w: 2 },
  { id: "fnd-deep", slot: "10:00", name: "Foundrae deep work", note: "Ninety minutes. One named workstream. Phone in another room.", w: 3 },
  { id: "fnd-listen", slot: "11:30", name: "Listen back", note: "One call recording. Notes into the log, not your head.", w: 1 },
  { id: "post", slot: "12:30", name: "The Post", note: "LinkedIn text post. Second hit of the day.", w: 2 },
  { id: "approach", slot: "14:00", name: "The Approach", note: "One proactive move. Build the thing first, then send it.", w: 2 },
  { id: "vspot", slot: "16:00", name: "The V Spot", note: "Daily news drop. It is daily now.", w: 3 },
  { id: "shutdown", slot: "17:30", name: "Shutdown", note: "Log the day. Name tomorrow's three before you close the lid.", w: 1 },
];

const FIXTURES = {
  1: [{ id: "pipeline", slot: "15:00", name: "Pipeline review", note: "Who moved, who stalled, who is next.", w: 2 }],
  2: [{ id: "ostrich", slot: "15:00", name: "The Ostrich Report", note: "Record with Hendrik. Diary slot, not a maybe.", w: 3 }],
  3: [{ id: "fnd-session", slot: "14:00", name: "Foundrae client session", note: "Twenty minutes prep before. Agenda sent the night before.", w: 2 }],
  4: [{ id: "longform", slot: "13:00", name: "Substack long form", note: "The week's essay. Write it, do not research it.", w: 3 }],
  5: [
    { id: "supplement", slot: "11:00", name: "The Sunday Supplement", note: "Record the long form. Mark three moments that can be cut as Shorts.", w: 3 },
    { id: "calibrate", slot: "17:00", name: "Week calibration", note: "Read the score. Adjust next week's volume honestly.", w: 1 },
  ],
  0: [{ id: "supp-out", slot: "10:00", name: "Supplement publishes", note: "Check it went out. Then go and do something else.", w: 1 }],
};

const SEED_THREADS = [
  { id: "friction", name: "Friction as currency", note: "Friction does not disappear, it moves.", last: "2026-05-26", seeded: true },
  { id: "agentic", name: "Agentic commerce, promotion goes dark", note: "Price agents, the transparency paradox.", last: "2026-05-26", seeded: true },
  { id: "deminimis", name: "De minimis and tariffs", note: "Standing coverage. The chaos, as ever, is the policy.", last: "2026-07-23", seeded: true },
  { id: "joybuy", name: "Joybuy shock doctrine", note: "Monetisation staffed before anyone noticed the logistics landed.", last: "2026-07-23", seeded: true },
  { id: "china-eu", name: "Chinese platforms in Europe", note: "Temu, Shein's half price listing, JD.", last: "2026-07-23", seeded: true },
  { id: "shopify-bank", name: "Shopify is quietly a bank", note: "The merchant lending book. Lenders get tested in downturns.", last: "2026-07-23", seeded: true },
  { id: "post-purchase", name: "Post purchase land grab", note: "Own the moment before a platform does.", last: "2026-03-04", seeded: true },
  { id: "identity", name: "Identity as the agentic battleground", note: "Loaded and unfired.", last: null, seeded: true },
  { id: "sovereignty", name: "European AI sovereignty", note: "The Reformation frame, Karen Hao.", last: null, seeded: true },
  { id: "infrastructure", name: "Infrastructure quietly winning", note: "The unglamorous layer takes the value.", last: null, seeded: true },
  { id: "store", name: "The store is not dead", note: "It just had to get interesting again.", last: null, seeded: true },
];

/* Client and commercial material. Never enters the mirrorable ledger. */
const CONFIDENTIAL = new Set(["foundrae", "reply", "sponsor"]);
const MAX_LEDGER = 180;
const TITLES = {
  post: "LinkedIn post", script: "Sixty second script", substack: "Substack angles",
  ideas: "Content ideas", sponsor: "Sponsor approach", foundrae: "Foundrae email", reply: "Reply draft",
};

const ROOMS = [
  { id: "desk",     name: "The Desk", icon: MessageSquare, tint: C.sky,     blurb: "Wire, conversation, studio" },
  { id: "video",    name: "Video",    icon: Film,          tint: C.mint,    blurb: "Shorts and calendar" },
  { id: "essay",    name: "Essay",    icon: PenLine,       tint: C.lilac,   blurb: "The long form" },
  { id: "guests",   name: "Guests",   icon: Users,         tint: C.blush,   blurb: "Pipeline and assets" },
  { id: "growth",   name: "Growth",   icon: TrendingUp,    tint: C.apricot, blurb: "Sponsors and Camp Tralee" },
  { id: "shows",    name: "Shows",    icon: Mic,           tint: C.sand,    blurb: "Feeds and episodes" },
  { id: "build",    name: "Build",    icon: Hammer,        tint: C.sky,     blurb: "Transcript in, channels out" },
  { id: "cast",     name: "The Cast", icon: Drama,         tint: C.lilac,   blurb: "Murt, Reagan, Jimmy" },
  { id: "analysis", name: "Analysis", icon: LineChart,     tint: C.mint,    blurb: "Monthly" },
];

const ghost = {
  padding: "10px 15px", borderRadius: 999, background: "transparent",
  border: "1.5px solid rgba(20,24,51,.15)", fontFamily: BODY, fontSize: 12.5,
  fontWeight: 600, color: C.ink, cursor: "pointer",
};

/* ============================================================ */

export default function Cockpit({ onLogout, googleConnected }) {
  const today = useMemo(() => new Date(), []);
  const dayKey = iso(today);
  const dow = today.getDay();

  const [room, setRoom] = useState(null);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const [panel, setPanel] = useState(null);

  const [done, setDone] = useState({});
  const [extras, setExtras] = useState([]);
  const [three, setThree] = useState("");
  const [wire, setWire] = useState(null);
  const [wireAt, setWireAt] = useState(null);
  const [brief, setBrief] = useState(null);
  const [briefAt, setBriefAt] = useState(null);
  const [log, setLog] = useState([]);
  const [history, setHistory] = useState({});
  const [ledger, setLedger] = useState([]);
  const [vault, setVault] = useState([]);
  const [threads, setThreads] = useState(SEED_THREADS);
  const [cal, setCal] = useState({});
  const [shorts, setShorts] = useState(null);
  const [published, setPublished] = useState([]);
  const [guests, setGuests] = useState([]);
  const [assets, setAssets] = useState([]);
  const saveTimer = useRef(null);

  const tasks = useMemo(() => {
    const base = dow === 6 || dow === 0 ? [] : DAILY;
    return [...base, ...(FIXTURES[dow] || [])].sort((a, b) => a.slot.localeCompare(b.slot));
  }, [dow]);

  const all = useMemo(() => [...tasks, ...extras], [tasks, extras]);
  const totalW = all.reduce((s, t) => s + t.w, 0) || 1;
  const doneW = all.reduce((s, t) => s + (done[t.id] ? t.w : 0), 0);
  const pct = Math.round((doneW / totalW) * 100);
  const offAir = tasks.length === 0;

  useEffect(() => {
    (async () => {
      const d = await sGet(K.day(dayKey), {});
      setDone(d.done || {});
      setExtras(d.extras || []);
      setThree(d.three || "");
      setWire(d.wire || null);
      setWireAt(d.wireAt || null);
      setBrief(d.brief || null);
      setBriefAt(d.briefAt || null);
      setLog(d.log || []);
      setHistory(await sGet(K.hist, {}));
      setLedger(await sGet(K.ledger, []));
      setVault(await sGet(K.vault, []));
      setThreads(await sGet(K.threads, SEED_THREADS));
      setCal(await sGet(K.calendar, {}));
      setShorts(await sGet(K.shorts(dayKey), null));
      setPublished(await sGet(K.published, []));
      setGuests(await sGet(K.guests, []));
      setAssets(await sGet(K.assets, []));
      setReady(true);
    })();
  }, [dayKey]);

  useEffect(() => {
    if (!ready) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await sSet(K.day(dayKey), { done, extras, three, wire, wireAt, brief, briefAt, log });
      const h = { ...history, [dayKey]: { pct, doneW, totalW } };
      setHistory(h);
      await sSet(K.hist, h);
    }, 600);
    return () => clearTimeout(saveTimer.current);
    // eslint-disable-next-line
  }, [done, extras, three, wire, brief, log, ready]);

  const toggle = (id) => setDone((p) => ({ ...p, [id]: !p[id] }));

  const addExtra = (name) =>
    setExtras((p) => [...p, { id: "x" + Math.random().toString(36).slice(2), slot: "—", name, note: "Added today.", w: 1 }]);

  /* Content goes to the ledger, which can leave. Client and commercial
     material goes to the vault, which cannot. The split happens once, here. */
  const push = (entry) => {
    const id = Math.random().toString(36).slice(2);
    const secret = CONFIDENTIAL.has(entry.kind);
    setLog((p) => [{ ...entry, ts: Date.now(), id, secret }, ...p]);

    const line = {
      id, date: dayKey, kind: entry.kind, thread: entry.thread || null,
      title: entry.sub || entry.title,
      gist: (entry.body || "").replace(/\s+/g, " ").slice(0, 220),
    };

    if (secret) {
      setVault((p) => { const n = [{ ...line, gist: undefined }, ...p].slice(0, MAX_LEDGER); sSet(K.vault, n); return n; });
      return;
    }
    setLedger((p) => { const n = [line, ...p].slice(0, MAX_LEDGER); sSet(K.ledger, n); return n; });
    if (entry.thread) {
      setThreads((p) => {
        const n = p.map((t) => (t.id === entry.thread ? { ...t, last: dayKey, seeded: false } : t));
        sSet(K.threads, n);
        return n;
      });
    }
  };

  const threadContext = useCallback((threadId) => {
    const t = threads.find((x) => x.id === threadId);
    const onThread = ledger.filter((l) => l.thread === threadId).slice(0, 4);
    const recent = ledger.slice(0, 6);
    if (!ledger.length && !t) return "";
    let s = "\n\nVINNY'S OWN ARCHIVE. Use it, do not repeat it.\n";
    if (t) {
      s += `\nRUNNING THREAD: "${t.name}". ${t.note}`;
      s += t.last ? ` Last touched ${t.last}${t.seeded ? " (approximate)" : ""}.` : " Never published on yet.";
    }
    if (onThread.length) s += `\n\nALREADY SAID ON THIS THREAD:\n${onThread.map((l) => `- ${l.date} (${l.kind}): ${l.gist}`).join("\n")}`;
    if (recent.length) s += `\n\nPUBLISHED RECENTLY, DO NOT REUSE THESE FRAMES:\n${recent.map((l) => `- ${l.date}: ${l.title}`).join("\n")}`;
    s += `\n\nCONTINUITY: one sentence of callback, then move. If a frame appears above from the last fourteen days, find a different door into the idea.`;
    return s;
  }, [threads, ledger]);

  const generate = useCallback(async (kind, story, extra) => {
    setBusy(kind + (story ? story.headline : extra || ""));
    setErr("");
    setPanel({ kind, title: TITLES[kind] || kind, sub: story ? story.headline : extra || "", body: "", loading: true });
    try {
      const archive = threadContext(story ? story.thread : null);
      const r = await callOp({ op: "generate", kind, story, extra, archive: kind === "foundrae" ? "" : archive });
      const entry = {
        kind, title: TITLES[kind] || kind, sub: story ? story.headline : extra || "",
        body: r.text, thread: story ? story.thread || null : null, secret: CONFIDENTIAL.has(kind),
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

  const onPublish = useCallback(async (clip, account) => {
    setBusy("pub" + clip.clipId + account.id);
    setErr("");
    try {
      const res = await publishClipDirect({
        projectId: clip.projectId, clipId: clip.clipId, postAccountId: account.id,
        title: clip.title, description: clip.description,
      });
      const row = {
        id: Math.random().toString(36).slice(2), date: dayKey, title: clip.title,
        episode: clip.episode, platform: account.platform, url: res.url || "", note: res.note || "",
      };
      setPublished((p) => { const n = [row, ...p].slice(0, 300); sSet(K.published, n); return n; });
      setCal((prev) => {
        if (prev[dayKey]?.video) return prev;
        const n = { ...prev, [dayKey]: { ...(prev[dayKey] || {}), video: clip.title } };
        sSet(K.calendar, n);
        return n;
      });
    } catch (e) {
      setErr(e.message || "Publish failed. Nothing was posted.");
    }
    setBusy("");
    // eslint-disable-next-line
  }, [dayKey]);

  const onSetCal = (dk, slot, value) => {
    const next = { ...cal, [dk]: { ...(cal[dk] || {}), [slot]: value } };
    setCal(next);
    sSet(K.calendar, next);
  };

  /* THE GAP. Not a to-do list. The things that go quiet without anyone
     noticing, because nothing breaks when they do. */
  const gaps = useMemo(() => {
    const out = [];
    const ago = (d) => (d ? daysSince(d, today) : null);

    const lastOutreach = vault.find((v) => v.kind === "sponsor");
    const d1 = ago(lastOutreach && lastOutreach.date);
    if (d1 === null) out.push({ w: 3, t: "No sponsor approach has ever gone out", s: "The Approach is in the rundown every day at 14:00. Build the thing first, then send it." });
    else if (d1 >= 5) out.push({ w: 3, t: `No sponsor approach in ${d1} days`, s: "Pipelines do not stall loudly. They just stop returning anything." });

    const live = assets.filter((a) => a.status !== "declined");
    const sent = live.filter((a) => a.status === "sent" || a.status === "won");
    if (live.length && !sent.length) out.push({ w: 2, t: `${live.length} spec build${live.length > 1 ? "s" : ""} made and none sent`, s: "A proposal that never leaves the drive is a hobby." });

    if (!assets.filter((a) => a.camp).length) {
      out.push({ w: 3, t: "No Camp Tralee prospects tracked", s: "January is closer than it reads. Omnisend, Trustap and Parcel Planet are confirmed. Who is next?" });
    }
    if (!guests.filter((g) => g.stage === "confirmed").length) {
      out.push({ w: 3, t: "No guest confirmed for the next Struggle Bus", s: "A weekly show with no one booked is a gap you find out about on a Thursday." });
    }
    if (!Object.values(cal).filter((d) => d && d.written).length) {
      out.push({ w: 1, t: "Nothing written scheduled this week", s: "Shorts build reach. The written work is what people subscribe to." });
    }

    return out.sort((a, b) => b.w - a.w);
    // eslint-disable-next-line
  }, [vault, assets, guests, cal, today]);

  const weekRows = weekDates(today).map((d) => ({ d, ...(d === dayKey ? { pct, doneW, totalW } : history[d] || {}) }));
  const scoredDays = weekRows.filter((r) => r.pct !== undefined && new Date(r.d) <= today);
  const weekAvg = scoredDays.length ? Math.round(scoredDays.reduce((s, r) => s + r.pct, 0) / scoredDays.length) : null;

  const calibration = useMemo(() => {
    const vals = Object.entries(history).sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 5).map(([, v]) => v.pct);
    if (vals.length < 3) return "Not enough days logged yet. Give it a week before you judge the volume.";
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    if (avg >= 85) return `Trailing average ${Math.round(avg)}%. You have room. Add one thing, not three.`;
    if (avg >= 60) return `Trailing average ${Math.round(avg)}%. The volume is about right. Protect it.`;
    return `Trailing average ${Math.round(avg)}%. You are carrying more than the week can hold. Cut the two lowest weight items.`;
  }, [history]);

  const current = ROOMS.find((r) => r.id === room);

  if (!ready) return <div style={{ background: C.ground, minHeight: "100vh" }} />;

  return (
    <div style={{ background: "#E8E5DE", minHeight: "100vh", fontFamily: BODY }}>
      <style>{`
        * { box-sizing: border-box; }
        .tap:active { transform: scale(.97); }
        .tap:focus-visible { outline: 2.5px solid ${C.ink}; outline-offset: 3px; }
        .lamp { animation: pulse 2.2s ease-in-out infinite; }
        @keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: .5 } }
        @keyframes slide { from { transform: translateX(24px); opacity: 0 } to { transform: translateX(0); opacity: 1 } }
        .rm { animation: slide .28s cubic-bezier(.22,1,.36,1); }
        .sc::-webkit-scrollbar { display: none; }
        .sc { scrollbar-width: none; }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important } }
      `}</style>

      <div style={{ maxWidth: 460, margin: "0 auto", background: C.ground, minHeight: "100vh", position: "relative", overflow: "hidden" }}>
        <div style={{ padding: "20px 20px 12px" }}>
          {room ? (
            <button onClick={() => setRoom(null)} className="tap flex items-center gap-1.5"
              style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: C.ink2 }}>
              <ChevronLeft size={19} strokeWidth={2.4} />
              <span style={{ fontSize: 14.5, fontWeight: 500 }}>Today</span>
            </button>
          ) : (
            <div className="flex items-start justify-between gap-3">
              <div>
                <Mono s={9.5}>{DAYS[dow]} {today.getDate()} {MONTHS[today.getMonth()]} · Tralee</Mono>
                <div style={{ marginTop: 3 }}><Big s={30}>THE COCKPIT</Big></div>
              </div>
              <div style={{ textAlign: "right" }}>
                <Big s={26} c={pct === 100 ? C.red : C.ink}>{pct}%</Big>
                <div style={{ marginTop: 2 }}><Mono s={9}>{doneW}/{totalW}</Mono></div>
              </div>
            </div>
          )}
        </div>

        <div className="sc" style={{ height: "calc(100vh - 74px)", overflowY: "auto" }}>
          <div style={{ padding: "0 16px" }}>
            <Problem onDismiss={() => setErr("")}>{err}</Problem>
          </div>

          {!room && (
            <>
              <Today
                today={today} dayKey={dayKey} tasks={all} done={done} toggle={toggle}
                extras={extras} addExtra={addExtra} gaps={gaps} three={three} setThree={setThree}
                weekRows={weekRows} weekAvg={weekAvg} calibration={calibration}
                pct={pct} doneW={doneW} totalW={totalW} offAir={offAir}
                brief={brief} setBrief={setBrief} briefAt={briefAt} setBriefAt={setBriefAt}
                onDecisionKeep={(c) => push({ kind: "reply", title: "Reply draft", sub: c.who, body: c.draft })}
              />

              <div style={{ padding: "0 16px 24px" }}>
                <Section label="The rooms">
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {ROOMS.map((r) => {
                      const I = r.icon;
                      return (
                        <button key={r.id} onClick={() => setRoom(r.id)} className="tap"
                          style={{
                            background: r.tint, borderRadius: R, padding: 16, border: "none", cursor: "pointer",
                            boxShadow: SH, minHeight: 108, display: "flex", flexDirection: "column",
                            justifyContent: "space-between", textAlign: "left",
                          }}>
                          <I size={20} strokeWidth={2.1} color={C.ink} />
                          <div>
                            <Big s={20}>{r.name.toUpperCase()}</Big>
                            <div style={{ fontSize: 11.5, color: C.ink2, marginTop: 3 }}>{r.blurb}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </Section>

                <div className="flex flex-wrap gap-2" style={{ paddingTop: 8 }}>
                  <a className="tap" href="/api/oauth-start" style={{ ...ghost, textDecoration: "none" }}>
                    {googleConnected === "workspace" ? "Google connected" : "Connect Google"}
                  </a>
                  <a className="tap" href="/api/oauth-start?service=youtube" style={{ ...ghost, textDecoration: "none" }}>
                    {googleConnected === "youtube" ? "YouTube connected" : "Connect YouTube"}
                  </a>
                  <button className="tap" onClick={onLogout} style={ghost}>Sign out</button>
                </div>
              </div>
            </>
          )}

          {room && (
            <div className="rm" style={{ padding: "0 16px 40px" }}>
              <div style={{ marginBottom: 18 }}><Big s={36}>{current.name.toUpperCase()}</Big></div>

              {room === "desk" && (
                <Desk
                  threads={threads} today={today} onGenerate={generate} busy={busy}
                  wire={wire} setWire={setWire} wireAt={wireAt} setWireAt={setWireAt}
                  onOpenEssay={() => setErr("The essay workshop is the next room to be built.")}
                  onOpenClipDesk={() => setErr("The clip desk is the next room to be built.")}
                />
              )}

              {room === "video" && (
                <Video
                  shorts={shorts} setShorts={setShorts} dayKey={dayKey} published={published}
                  onPublish={onPublish} busy={busy} cal={cal} onSetCal={onSetCal} today={today} K={K}
                />
              )}

              {!["desk", "video"].includes(room) && (
                <Card tint={current.tint} pad={24} style={{ minHeight: 200, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                  <Mono>{current.blurb}</Mono>
                  <div style={{ marginTop: 10 }}><Big s={30}>{current.name.toUpperCase()}</Big></div>
                  <p style={{ fontSize: 13.5, color: C.ink2, lineHeight: 1.55, marginTop: 10 }}>
                    Not built yet. The endpoints behind it are live, so this is a missing screen, not a missing system.
                  </p>
                </Card>
              )}
            </div>
          )}
        </div>

        {panel && <Panel entry={panel} onClose={() => setPanel(null)} />}
      </div>
    </div>
  );
}

/* The generated piece, shown the moment you ask for it. */
function Panel({ entry, onClose }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const esc = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  return (
    <div onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(20,24,51,.35)", zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: C.card, borderRadius: "28px 28px 0 0", width: "100%", maxWidth: 460, maxHeight: "88vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "18px 20px 12px", borderBottom: "1px solid rgba(20,24,51,.07)" }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Big s={22}>{(entry.title || "").toUpperCase()}</Big>
              {entry.sub && <div style={{ marginTop: 4 }}><Mono s={9}>{entry.sub.slice(0, 70)}</Mono></div>}
            </div>
            <button onClick={onClose} className="tap"
              style={{ background: "none", border: "none", cursor: "pointer", color: C.ink2, fontSize: 18, lineHeight: 1 }}>✕</button>
          </div>
        </div>

        {entry.loading ? (
          <div style={{ padding: "40px 20px", textAlign: "center" }}>
            <div className="lamp"><Mono c={C.red}>Writing…</Mono></div>
            <p style={{ fontSize: 13, color: C.ink2, marginTop: 10, lineHeight: 1.5 }}>
              Twenty to sixty seconds. It is reading your archive so it does not repeat you.
            </p>
          </div>
        ) : (
          <>
            <div className="sc" style={{ flex: 1, overflowY: "auto", padding: 20 }}>
              <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: BODY, fontSize: 14.5, lineHeight: 1.65, color: C.ink }}>
                {entry.body}
              </pre>
            </div>
            <div className="flex gap-2 items-center" style={{ padding: "14px 20px 22px", borderTop: "1px solid rgba(20,24,51,.07)" }}>
              <Pill sm onClick={() => {
                navigator.clipboard?.writeText(entry.body);
                setCopied(true);
                setTimeout(() => setCopied(false), 1600);
              }}>
                {copied ? "Copied" : "Copy"}
              </Pill>
              {entry.secret && <Mono s={9}>Confidential · vault only</Mono>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
