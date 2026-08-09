import React, { useState, useEffect, useCallback } from "react";
import {
  Video, ArrowUpRight, Plus, Check, Clock4, Zap, CornerDownLeft, Link2,
  CalendarClock, Mail,
} from "lucide-react";
import {import React, { useState, useEffect, useCallback } from "react";
import {
  Video, ArrowUpRight, Plus, Check, Clock4, Zap, CornerDownLeft, Link2,
  CalendarClock, Mail,
} from "lucide-react";
import {
  C, MONO, BODY, DISPLAY, SH, R, Mono, Big, Card, Section, Pill, Field,
  Empty, Working, Problem, DAYS, iso, daysSince, parseJSON,
} from "../lib/ui.jsx";
import { callOp } from "../api.js";

/* ============================================================
   src/rooms/Today.jsx

   Live: /api/agenda, op "commitments", op "sweep".
   Nothing here comes from memory. Every panel either shows real
   data or says plainly why it can't.
   ============================================================ */

/* ---------- a sweep panel ---------- */

function Sweep({ tint, icon: I, title, sub, runLabel, onRun, state, children }) {
  return (
    <Card tint={tint} pad={18} style={{ marginBottom: 10 }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <I size={19} strokeWidth={2.1} color={C.ink} style={{ marginTop: 1, flexShrink: 0 }} />
          <div className="min-w-0">
            <div style={{ fontSize: 15.5, fontWeight: 600, color: C.ink, lineHeight: 1.25 }}>{title}</div>
            <div style={{ marginTop: 3 }}><Mono s={9}>{sub}</Mono></div>
          </div>
        </div>
        {state === "done" && (
          <span style={{ width: 24, height: 24, borderRadius: 999, background: C.ink, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Check size={13} strokeWidth={3} color="#fff" />
          </span>
        )}
      </div>
      {state === "idle" && <div style={{ marginTop: 14 }}><Pill full sm onClick={onRun}>{runLabel}</Pill></div>}
      {state === "running" && (
        <div className="lamp" style={{ marginTop: 14, textAlign: "center", padding: "10px 0" }}>
          <Mono>Reading…</Mono>
        </div>
      )}
      {state === "done" && (
        <div style={{ marginTop: 12, background: "rgba(255,255,255,.62)", borderRadius: 18, padding: "4px 0" }}>
          {children}
        </div>
      )}
    </Card>
  );
}

function Row({ children, onAdd, accent }) {
  const [added, setAdded] = useState(false);
  return (
    <div className="flex items-start gap-3" style={{ padding: "11px 14px", borderLeft: accent ? `3px solid ${accent}` : "none" }}>
      <div className="min-w-0 flex-1">{children}</div>
      {onAdd && (
        <button className="tap" disabled={added} aria-label="Add as task"
          onClick={() => { onAdd(); setAdded(true); }}
          style={{
            flexShrink: 0, width: 27, height: 27, borderRadius: 999, cursor: added ? "default" : "pointer",
            background: added ? C.ink : "transparent", border: added ? "none" : "1.5px solid rgba(20,24,51,.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
          {added ? <Check size={14} strokeWidth={3} color="#fff" /> : <Plus size={15} strokeWidth={2.5} color={C.ink2} />}
        </button>
      )}
    </div>
  );
}

/* ---------- the room ---------- */

export default function Today({
  today, dayKey, tasks, done, toggle, extras, addExtra,
  gaps, three, setThree, weekRows, weekAvg, calibration, pct, doneW, totalW, offAir,
  brief, setBrief, briefAt, setBriefAt, onDecisionKeep,
}) {
  const [capture, setCapture] = useState("");
  const [just, setJust] = useState("");
  const [copied, setCopied] = useState(false);
  const [ff, setFf] = useState({ state: "idle", data: null });
  const [briefState, setBriefState] = useState(brief ? "done" : "idle");
  const [err, setErr] = useState("");

  /* Fireflies — op "commitments". Returns { actions, decisions }. */
  const runMeetings = useCallback(async () => {
    setFf({ state: "running", data: null });
    setErr("");
    try {
      const r = await callOp({ op: "commitments" });
      const t = r.text.replace(/```json|```/g, "").trim();
      const obj = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
      setFf({ state: "done", data: obj });
    } catch (e) {
      setFf({ state: "idle", data: null });
      setErr(e.message || "The meetings sweep did not come back.");
    }
  }, []);

  const runBrief = useCallback(async () => {
    setBriefState("running");
    setErr("");
    try {
      const r = await callOp({ op: "sweep" });
      const [decisions] = r.text.split("---SUPPLEMENT---");
      setBrief(parseJSON(decisions));
      setBriefAt(Date.now());
      setBriefState("done");
    } catch (e) {
      setBriefState("idle");
      setErr(e.message || "The sweep did not come back.");
    }
  }, [setBrief, setBriefAt]);

  const maxWeek = Math.max(...weekRows.map((r) => r.pct || 0), 1);

  /* One path in, and it says so afterwards. A capture bar that swallows
     input silently is worse than no capture bar. */
  const commit = () => {
    const v = capture.trim();
    if (!v) return;
    addExtra(v);
    setCapture("");
    setJust(v);
    setTimeout(() => setJust(""), 2600);
  };

  return (
    <div style={{ padding: "0 16px 40px" }}>
      <Problem onDismiss={() => setErr("")}>{err}</Problem>

      {/* capture from anywhere */}
      <Card pad={14} style={{ marginBottom: 12 }}>
        <div className="flex items-center gap-2.5">
          <Zap size={17} strokeWidth={2.3} color={C.ink2} style={{ flexShrink: 0 }} />
          <input
            value={capture}
            onChange={(e) => setCapture(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") commit(); }}
            placeholder="Throw anything in here"
            style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", fontFamily: BODY, fontSize: 15, color: C.ink, padding: "6px 0" }}
          />
          {capture.trim() && (
            <button className="tap" onClick={commit} aria-label="Add"
              style={{ background: C.ink, border: "none", borderRadius: 999, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
              <CornerDownLeft size={15} strokeWidth={2.5} color="#fff" />
            </button>
          )}
        </div>
        {just && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(20,24,51,.07)" }}>
            <Mono s={9} c={C.ink}>Added · {just.slice(0, 44)}{just.length > 44 ? "…" : ""}</Mono>
          </div>
        )}
      </Card>

      <div className="flex justify-end" style={{ marginBottom: 10 }}>
        <button className="tap" onClick={() => {
          navigator.clipboard?.writeText("https://calendly.com/vinnyandco");
          setCopied(true); setTimeout(() => setCopied(false), 1600);
        }}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, background: C.card, border: "1.5px solid rgba(20,24,51,.1)", borderRadius: 999, padding: "8px 14px", cursor: "pointer", fontFamily: BODY, fontSize: 12.5, fontWeight: 600, color: C.ink }}>
          <Link2 size={14} strokeWidth={2.3} />{copied ? "Link copied" : "Send my Calendly"}
        </button>
      </div>

      {/* the two sweeps */}
      <Section label="First thing">
        <Sweep tint={C.lilac} icon={CalendarClock} title="Yesterday's meetings" sub="Fireflies, last 36 hours"
          runLabel="Sweep for actionables" onRun={runMeetings} state={ff.state}>
          {ff.data && (ff.data.decisions || []).map((d, i) => (
            <Row key={`d${i}`} accent={C.red} onAdd={() => addExtra(`Decision: ${d.what}`)}>
              <div style={{ marginBottom: 4 }}><Mono c={C.red} s={9}>Decision logged</Mono></div>
              <div style={{ fontSize: 14, color: C.ink, lineHeight: 1.4 }}>{d.what}</div>
              {d.why && <div style={{ fontSize: 12.5, color: C.ink2, marginTop: 3, lineHeight: 1.45 }}>{d.why}</div>}
              <div style={{ marginTop: 3 }}><Mono s={9}>{d.meeting}</Mono></div>
            </Row>
          ))}
          {ff.data && (ff.data.actions || []).map((a, i) => (
            <Row key={`a${i}`} onAdd={() => addExtra(a.what)}>
              <div style={{ fontSize: 14, color: C.ink, lineHeight: 1.4 }}>{a.what}</div>
              <div style={{ marginTop: 3 }}><Mono s={9}>{a.who}{a.when ? ` · ${a.when}` : ""} · {a.meeting}</Mono></div>
            </Row>
          ))}
          {ff.data && !(ff.data.actions || []).length && !(ff.data.decisions || []).length && (
            <div style={{ padding: "14px" }}><Mono>Nothing committed to. A quiet day is a valid answer.</Mono></div>
          )}
        </Sweep>

        <Sweep tint={C.mint} icon={Mail} title="The Briefing" sub="Gmail, Slack, Asana, Calendar, Fireflies, Drive"
          runLabel="Sweep platforms" onRun={runBrief} state={briefState}>
          {(brief || []).map((c, i) => (
            <Row key={i} onAdd={() => addExtra(`Reply — ${c.who}`)}>
              <div className="flex items-center gap-2 flex-wrap">
                <Mono s={9}>{(c.src || "").toUpperCase()}</Mono>
                <div style={{ fontSize: 14, color: C.ink, fontWeight: 500 }}>{c.who}</div>
                {c.urgency === "today" && <span style={{ width: 6, height: 6, borderRadius: 999, background: C.red }} />}
              </div>
              <div style={{ fontSize: 13, color: C.ink2, marginTop: 2, lineHeight: 1.4 }}>{c.what}</div>
              {c.needs && <div style={{ fontSize: 13, color: C.ink, marginTop: 5, lineHeight: 1.45 }}>{c.needs}</div>}
              {c.draft && (
                <div style={{ marginTop: 8 }}>
                  <Pill sm tone="ghost" onClick={() => onDecisionKeep(c)}>Keep the draft</Pill>
                </div>
              )}
            </Row>
          ))}
        </Sweep>
      </Section>

      {/* THE GAP */}
      {gaps.length > 0 && (
        <Section label="The Gap" right={<Mono c={C.red}>{gaps.length} slipping</Mono>}>
          {gaps.slice(0, 5).map((g, i) => (
            <Card key={i} pad={18} accent={g.w >= 3 ? C.red : g.w === 2 ? "#A8761A" : C.ink3} style={{ marginBottom: 9 }}>
              <div style={{ fontSize: 15, color: C.ink, fontWeight: 600, lineHeight: 1.3 }}>{g.t}</div>
              <p style={{ fontSize: 13, color: C.ink2, lineHeight: 1.5, marginTop: 6 }}>{g.s}</p>
            </Card>
          ))}
        </Section>
      )}

      {/* rundown */}
      <Section label="Rundown" right={<Mono>{offAir ? "rest day" : `${tasks.filter((t) => done[t.id]).length}/${tasks.length}`}</Mono>}>
        {offAir ? (
          <Card style={{ textAlign: "center", padding: "32px 20px" }}>
            <Big s={30} c={C.ink2}>OFF AIR</Big>
            <p style={{ fontSize: 13.5, color: C.ink2, marginTop: 8 }}>No rundown today. The score does not need you.</p>
          </Card>
        ) : (
          <Card pad={0} style={{ padding: "6px 0" }}>
            {tasks.map((t) => {
              const isDone = !!done[t.id];
              return (
                <div key={t.id} className="flex items-start gap-3" style={{ padding: "11px 16px" }}>
                  <button onClick={() => toggle(t.id)} className="tap" aria-label="Done"
                    style={{
                      width: 25, height: 25, flexShrink: 0, marginTop: 1, borderRadius: 999, cursor: "pointer",
                      border: isDone ? "none" : "1.5px solid rgba(20,24,51,.2)",
                      background: isDone ? C.ink : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                    {isDone && <Check size={13} strokeWidth={3} color="#fff" />}
                  </button>
                  <div className="min-w-0 flex-1" style={{ opacity: isDone ? 0.45 : 1 }}>
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span style={{ fontFamily: MONO, fontSize: 11, color: C.ink3 }}>{t.slot}</span>
                      <span style={{ fontSize: 14.5, color: C.ink, fontWeight: 500, textDecoration: isDone ? "line-through" : "none", textDecorationColor: "rgba(20,24,51,.3)" }}>
                        {t.name}
                      </span>
                    </div>
                    <div style={{ fontSize: 12.5, color: C.ink2, marginTop: 2, lineHeight: 1.45 }}>{t.note}</div>
                  </div>
                </div>
              );
            })}
          </Card>
        )}
      </Section>

      {/* week */}
      <Section label="This week" right={<Mono>{weekAvg !== null ? `${weekAvg}% avg` : "no baseline"}</Mono>}>
        <Card pad={0} style={{ padding: "20px 18px 14px" }}>
          <div className="flex items-end justify-between" style={{ gap: 8, height: 92 }}>
            {weekRows.map((r) => {
              const isToday = r.d === dayKey;
              const h = r.pct !== undefined ? Math.max(3, (r.pct / 100) * 58) : 3;
              return (
                <div key={r.d} className="flex flex-col items-center" style={{ flex: 1 }}>
                  <div style={{ fontFamily: MONO, fontSize: 10, color: C.ink2, marginBottom: 5 }}>{r.pct ?? ""}</div>
                  <div style={{ width: "100%", height: h, borderRadius: 8, background: isToday ? C.red : r.pct !== undefined ? C.ink : "rgba(20,24,51,.08)" }} />
                  <div style={{ fontFamily: MONO, fontSize: 10, color: isToday ? C.red : C.ink2, marginTop: 7 }}>
                    {DAYS[new Date(r.d).getDay()][0]}
                  </div>
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: 12.5, color: C.ink2, marginTop: 12, lineHeight: 1.5 }}>{calibration}</p>
        </Card>
      </Section>

      {/* tomorrow's three */}
      <Section label="Tomorrow's three">
        <Card>
          <textarea value={three} onChange={(e) => setThree(e.target.value)} rows={3} placeholder={"1.\n2.\n3."}
            style={{ width: "100%", background: "transparent", border: "none", outline: "none", resize: "none", fontFamily: BODY, fontSize: 14.5, color: C.ink, lineHeight: 1.7 }} />
        </Card>
      </Section>
    </div>
  );
}

  C, MONO, BODY, DISPLAY, SH, R, Mono, Big, Card, Section, Pill, Field,
  Empty, Working, Problem, DAYS, iso, daysSince, parseJSON,
} from "../lib/ui.jsx";
import { callOp } from "../api.js";

/* ============================================================
   src/rooms/Today.jsx

   Live: /api/agenda, op "commitments", op "sweep".
   Nothing here comes from memory. Every panel either shows real
   data or says plainly why it can't.
   ============================================================ */

/* ---------- the diary ticker ---------- */

function Diary() {
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res = await fetch("/api/agenda", { credentials: "same-origin" });
        const d = await res.json();
        if (live) setState({ ...d, loading: false });
      } catch (e) {
        if (live) setState({ loading: false, reason: `Could not reach the calendar: ${e.message}`, events: [] });
      }
    })();
    return () => { live = false; };
  }, []);

  if (state.loading) {
    return <div style={{ padding: "6px 4px 14px" }}><Mono>Reading the diary…</Mono></div>;
  }

  if (state.reason) {
    return (
      <Card tint={C.blush} pad={14} style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13.5, color: C.ink, lineHeight: 1.45 }}>{state.reason}</div>
      </Card>
    );
  }

  if (!state.events?.length) {
    return (
      <Card pad={14} style={{ marginBottom: 14 }}>
        <Mono>Nothing in the diary. That is a result, not a gap.</Mono>
      </Card>
    );
  }

  return (
    <div className="sc" style={{ display: "flex", gap: 9, overflowX: "auto", paddingBottom: 14, marginLeft: -4, paddingLeft: 4 }}>
      {state.events.map((e) => {
        const next = e.id === state.nextId;
        return (
          <div key={e.id} style={{
            flexShrink: 0, minWidth: 156, background: next ? C.ink : C.card,
            borderRadius: 20, padding: 14, boxShadow: SH, opacity: e.past ? 0.45 : 1,
          }}>
            <Mono c={next ? C.sand : C.ink2} s={9.5}>{e.at}{e.len ? ` · ${e.len}` : ""}</Mono>
            <div style={{ fontSize: 13.5, fontWeight: 500, color: next ? "#fff" : C.ink, lineHeight: 1.3, marginTop: 5, minHeight: 34 }}>
              {e.who}
            </div>
            {e.join && !e.past && (
              <a href={e.join} target="_blank" rel="noopener noreferrer" className="tap"
                style={{
                  marginTop: 9, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                  background: next ? C.sand : "rgba(20,24,51,.06)", color: C.ink, borderRadius: 999,
                  padding: "8px 0", fontFamily: BODY, fontSize: 12.5, fontWeight: 600, textDecoration: "none",
                }}>
                <Video size={13} strokeWidth={2.4} />Join
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---------- a sweep panel ---------- */

function Sweep({ tint, icon: I, title, sub, runLabel, onRun, state, children }) {
  return (
    <Card tint={tint} pad={18} style={{ marginBottom: 10 }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <I size={19} strokeWidth={2.1} color={C.ink} style={{ marginTop: 1, flexShrink: 0 }} />
          <div className="min-w-0">
            <div style={{ fontSize: 15.5, fontWeight: 600, color: C.ink, lineHeight: 1.25 }}>{title}</div>
            <div style={{ marginTop: 3 }}><Mono s={9}>{sub}</Mono></div>
          </div>
        </div>
        {state === "done" && (
          <span style={{ width: 24, height: 24, borderRadius: 999, background: C.ink, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Check size={13} strokeWidth={3} color="#fff" />
          </span>
        )}
      </div>
      {state === "idle" && <div style={{ marginTop: 14 }}><Pill full sm onClick={onRun}>{runLabel}</Pill></div>}
      {state === "running" && (
        <div className="lamp" style={{ marginTop: 14, textAlign: "center", padding: "10px 0" }}>
          <Mono>Reading…</Mono>
        </div>
      )}
      {state === "done" && (
        <div style={{ marginTop: 12, background: "rgba(255,255,255,.62)", borderRadius: 18, padding: "4px 0" }}>
          {children}
        </div>
      )}
    </Card>
  );
}

function Row({ children, onAdd, accent }) {
  const [added, setAdded] = useState(false);
  return (
    <div className="flex items-start gap-3" style={{ padding: "11px 14px", borderLeft: accent ? `3px solid ${accent}` : "none" }}>
      <div className="min-w-0 flex-1">{children}</div>
      {onAdd && (
        <button className="tap" disabled={added} aria-label="Add as task"
          onClick={() => { onAdd(); setAdded(true); }}
          style={{
            flexShrink: 0, width: 27, height: 27, borderRadius: 999, cursor: added ? "default" : "pointer",
            background: added ? C.ink : "transparent", border: added ? "none" : "1.5px solid rgba(20,24,51,.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
          {added ? <Check size={14} strokeWidth={3} color="#fff" /> : <Plus size={15} strokeWidth={2.5} color={C.ink2} />}
        </button>
      )}
    </div>
  );
}

/* ---------- the room ---------- */

export default function Today({
  today, dayKey, tasks, done, toggle, extras, addExtra,
  gaps, three, setThree, weekRows, weekAvg, calibration, pct, doneW, totalW, offAir,
  brief, setBrief, briefAt, setBriefAt, onDecisionKeep,
}) {
  const [capture, setCapture] = useState("");
  const [copied, setCopied] = useState(false);
  const [ff, setFf] = useState({ state: "idle", data: null });
  const [briefState, setBriefState] = useState(brief ? "done" : "idle");
  const [err, setErr] = useState("");

  /* Fireflies — op "commitments". Returns { actions, decisions }. */
  const runMeetings = useCallback(async () => {
    setFf({ state: "running", data: null });
    setErr("");
    try {
      const r = await callOp({ op: "commitments" });
      const t = r.text.replace(/```json|```/g, "").trim();
      const obj = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
      setFf({ state: "done", data: obj });
    } catch (e) {
      setFf({ state: "idle", data: null });
      setErr(e.message || "The meetings sweep did not come back.");
    }
  }, []);

  const runBrief = useCallback(async () => {
    setBriefState("running");
    setErr("");
    try {
      const r = await callOp({ op: "sweep" });
      const [decisions] = r.text.split("---SUPPLEMENT---");
      setBrief(parseJSON(decisions));
      setBriefAt(Date.now());
      setBriefState("done");
    } catch (e) {
      setBriefState("idle");
      setErr(e.message || "The sweep did not come back.");
    }
  }, [setBrief, setBriefAt]);

  const maxWeek = Math.max(...weekRows.map((r) => r.pct || 0), 1);

  return (
    <div style={{ padding: "0 16px 40px" }}>
      <Problem onDismiss={() => setErr("")}>{err}</Problem>

      {/* capture from anywhere */}
      <Card pad={14} style={{ marginBottom: 12 }}>
        <div className="flex items-center gap-2.5">
          <Zap size={17} strokeWidth={2.3} color={C.ink2} style={{ flexShrink: 0 }} />
          <input
            value={capture}
            onChange={(e) => setCapture(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && capture.trim()) { addExtra(capture.trim()); setCapture(""); } }}
            placeholder="Throw anything in here"
            style={{ flex: 1, minWidth: 0, background: "transparent", border: "none", outline: "none", fontFamily: BODY, fontSize: 15, color: C.ink, padding: "6px 0" }}
          />
          {capture.trim() && (
            <button className="tap" onClick={() => { addExtra(capture.trim()); setCapture(""); }}
              style={{ background: C.ink, border: "none", borderRadius: 999, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
              <CornerDownLeft size={15} strokeWidth={2.5} color="#fff" />
            </button>
          )}
        </div>
      </Card>

      <div className="flex justify-end" style={{ marginBottom: 10 }}>
        <button className="tap" onClick={() => {
          navigator.clipboard?.writeText("https://calendly.com/vinnyandco");
          setCopied(true); setTimeout(() => setCopied(false), 1600);
        }}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, background: C.card, border: "1.5px solid rgba(20,24,51,.1)", borderRadius: 999, padding: "8px 14px", cursor: "pointer", fontFamily: BODY, fontSize: 12.5, fontWeight: 600, color: C.ink }}>
          <Link2 size={14} strokeWidth={2.3} />{copied ? "Link copied" : "Send my Calendly"}
        </button>
      </div>

      <Diary />

      {/* the two sweeps */}
      <Section label="First thing">
        <Sweep tint={C.lilac} icon={CalendarClock} title="Yesterday's meetings" sub="Fireflies, last 36 hours"
          runLabel="Sweep for actionables" onRun={runMeetings} state={ff.state}>
          {ff.data && (ff.data.decisions || []).map((d, i) => (
            <Row key={`d${i}`} accent={C.red} onAdd={() => addExtra(`Decision: ${d.what}`)}>
              <div style={{ marginBottom: 4 }}><Mono c={C.red} s={9}>Decision logged</Mono></div>
              <div style={{ fontSize: 14, color: C.ink, lineHeight: 1.4 }}>{d.what}</div>
              {d.why && <div style={{ fontSize: 12.5, color: C.ink2, marginTop: 3, lineHeight: 1.45 }}>{d.why}</div>}
              <div style={{ marginTop: 3 }}><Mono s={9}>{d.meeting}</Mono></div>
            </Row>
          ))}
          {ff.data && (ff.data.actions || []).map((a, i) => (
            <Row key={`a${i}`} onAdd={() => addExtra(a.what)}>
              <div style={{ fontSize: 14, color: C.ink, lineHeight: 1.4 }}>{a.what}</div>
              <div style={{ marginTop: 3 }}><Mono s={9}>{a.who}{a.when ? ` · ${a.when}` : ""} · {a.meeting}</Mono></div>
            </Row>
          ))}
          {ff.data && !(ff.data.actions || []).length && !(ff.data.decisions || []).length && (
            <div style={{ padding: "14px" }}><Mono>Nothing committed to. A quiet day is a valid answer.</Mono></div>
          )}
        </Sweep>

        <Sweep tint={C.mint} icon={Mail} title="The Briefing" sub="Gmail, Slack, Asana, Calendar, Fireflies, Drive"
          runLabel="Sweep platforms" onRun={runBrief} state={briefState}>
          {(brief || []).map((c, i) => (
            <Row key={i} onAdd={() => addExtra(`Reply — ${c.who}`)}>
              <div className="flex items-center gap-2 flex-wrap">
                <Mono s={9}>{(c.src || "").toUpperCase()}</Mono>
                <div style={{ fontSize: 14, color: C.ink, fontWeight: 500 }}>{c.who}</div>
                {c.urgency === "today" && <span style={{ width: 6, height: 6, borderRadius: 999, background: C.red }} />}
              </div>
              <div style={{ fontSize: 13, color: C.ink2, marginTop: 2, lineHeight: 1.4 }}>{c.what}</div>
              {c.needs && <div style={{ fontSize: 13, color: C.ink, marginTop: 5, lineHeight: 1.45 }}>{c.needs}</div>}
              {c.draft && (
                <div style={{ marginTop: 8 }}>
                  <Pill sm tone="ghost" onClick={() => onDecisionKeep(c)}>Keep the draft</Pill>
                </div>
              )}
            </Row>
          ))}
        </Sweep>
      </Section>

      {/* THE GAP */}
      {gaps.length > 0 && (
        <Section label="The Gap" right={<Mono c={C.red}>{gaps.length} slipping</Mono>}>
          {gaps.slice(0, 5).map((g, i) => (
            <Card key={i} pad={18} accent={g.w >= 3 ? C.red : g.w === 2 ? "#A8761A" : C.ink3} style={{ marginBottom: 9 }}>
              <div style={{ fontSize: 15, color: C.ink, fontWeight: 600, lineHeight: 1.3 }}>{g.t}</div>
              <p style={{ fontSize: 13, color: C.ink2, lineHeight: 1.5, marginTop: 6 }}>{g.s}</p>
            </Card>
          ))}
        </Section>
      )}

      {/* rundown */}
      <Section label="Rundown" right={<Mono>{offAir ? "rest day" : `${tasks.filter((t) => done[t.id]).length}/${tasks.length}`}</Mono>}>
        {offAir ? (
          <Card style={{ textAlign: "center", padding: "32px 20px" }}>
            <Big s={30} c={C.ink2}>OFF AIR</Big>
            <p style={{ fontSize: 13.5, color: C.ink2, marginTop: 8 }}>No rundown today. The score does not need you.</p>
          </Card>
        ) : (
          <Card pad={0} style={{ padding: "6px 0" }}>
            {tasks.map((t) => {
              const isDone = !!done[t.id];
              return (
                <div key={t.id} className="flex items-start gap-3" style={{ padding: "11px 16px" }}>
                  <button onClick={() => toggle(t.id)} className="tap" aria-label="Done"
                    style={{
                      width: 25, height: 25, flexShrink: 0, marginTop: 1, borderRadius: 999, cursor: "pointer",
                      border: isDone ? "none" : "1.5px solid rgba(20,24,51,.2)",
                      background: isDone ? C.ink : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                    {isDone && <Check size={13} strokeWidth={3} color="#fff" />}
                  </button>
                  <div className="min-w-0 flex-1" style={{ opacity: isDone ? 0.45 : 1 }}>
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span style={{ fontFamily: MONO, fontSize: 11, color: C.ink3 }}>{t.slot}</span>
                      <span style={{ fontSize: 14.5, color: C.ink, fontWeight: 500, textDecoration: isDone ? "line-through" : "none", textDecorationColor: "rgba(20,24,51,.3)" }}>
                        {t.name}
                      </span>
                    </div>
                    <div style={{ fontSize: 12.5, color: C.ink2, marginTop: 2, lineHeight: 1.45 }}>{t.note}</div>
                  </div>
                </div>
              );
            })}
          </Card>
        )}
      </Section>

      {/* week */}
      <Section label="This week" right={<Mono>{weekAvg !== null ? `${weekAvg}% avg` : "no baseline"}</Mono>}>
        <Card pad={0} style={{ padding: "20px 18px 14px" }}>
          <div className="flex items-end justify-between" style={{ gap: 8, height: 92 }}>
            {weekRows.map((r) => {
              const isToday = r.d === dayKey;
              const h = r.pct !== undefined ? Math.max(3, (r.pct / 100) * 58) : 3;
              return (
                <div key={r.d} className="flex flex-col items-center" style={{ flex: 1 }}>
                  <div style={{ fontFamily: MONO, fontSize: 10, color: C.ink2, marginBottom: 5 }}>{r.pct ?? ""}</div>
                  <div style={{ width: "100%", height: h, borderRadius: 8, background: isToday ? C.red : r.pct !== undefined ? C.ink : "rgba(20,24,51,.08)" }} />
                  <div style={{ fontFamily: MONO, fontSize: 10, color: isToday ? C.red : C.ink2, marginTop: 7 }}>
                    {DAYS[new Date(r.d).getDay()][0]}
                  </div>
                </div>
              );
            })}
          </div>
          <p style={{ fontSize: 12.5, color: C.ink2, marginTop: 12, lineHeight: 1.5 }}>{calibration}</p>
        </Card>
      </Section>

      {/* tomorrow's three */}
      <Section label="Tomorrow's three">
        <Card>
          <textarea value={three} onChange={(e) => setThree(e.target.value)} rows={3} placeholder={"1.\n2.\n3."}
            style={{ width: "100%", background: "transparent", border: "none", outline: "none", resize: "none", fontFamily: BODY, fontSize: 14.5, color: C.ink, lineHeight: 1.7 }} />
        </Card>
      </Section>
    </div>
  );
}
