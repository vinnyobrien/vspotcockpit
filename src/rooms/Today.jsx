import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus, Check, Link2, Mail,
} from "lucide-react";
import {
  C, MONO, BODY, Mono, Big, Card, Section, Pill, Problem, DAYS, parseJSON,
} from "../lib/ui.jsx";
import { callOp, getMemoryHealth, sGetStrict } from "../api.js";
import EditorialCall from "./EditorialCall.jsx";

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
  threads, onEditorialNavigate,
}) {
  const [capture, setCapture] = useState({ title: "", kind: "action", owner: "", dueDate: "", details: "" });
  const [showCaptureDetails, setShowCaptureDetails] = useState(false);
  const setCaptureField = (key) => (event) => setCapture((previous) => ({ ...previous, [key]: event.target.value }));
  const [just, setJust] = useState("");
  const [copied, setCopied] = useState(false);
  const [ff, setFf] = useState({ state: "loading", data: null });
  const [briefState, setBriefState] = useState(brief ? "done" : "idle");
  const [err, setErr] = useState("");
  const briefAutoStarted = useRef(false);

  /* Fireflies is filed by the scheduled server job. Today only reads its
     durable record; opening this screen must not trigger another AI sweep. */
  const refreshMeetings = useCallback(async () => {
    try {
      const data = await sGetStrict("vault:fireflies-commitments", {});
      let health = null;
      try { health = await getMemoryHealth(); } catch { /* Meeting data remains useful without diagnostics. */ }
      setFf({ state: "done", data: data || {}, health: health?.fireflies || null });
    } catch (e) {
      setFf({ state: "error", data: null });
      setErr(e.message || "The Fireflies record could not be read.");
    }
  }, []);

  useEffect(() => {
    refreshMeetings();
    const timer = window.setInterval(refreshMeetings, 120000);
    const onFocus = () => refreshMeetings();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [refreshMeetings]);

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

  /* Refresh a stale briefing when Today opens. The button remains as a
     deliberate retry, while routine use no longer depends on pressing it. */
  useEffect(() => {
    if (briefAutoStarted.current) return;
    if (!briefAt || Date.now() - briefAt > 60 * 60 * 1000) {
      briefAutoStarted.current = true;
      runBrief();
    }
  }, [briefAt, runBrief]);

  const maxWeek = Math.max(...weekRows.map((r) => r.pct || 0), 1);

  /* One path in, and it says so afterwards. A capture bar that swallows
     input silently is worse than no capture bar. */
  const commit = (event) => {
    event.preventDefault();
    const v = capture.title.trim();
    if (!v) return;
    addExtra(capture);
    setCapture({ title: "", kind: "action", owner: "", dueDate: "", details: "" });
    setShowCaptureDetails(false);
    setJust(v);
    setTimeout(() => setJust(""), 2600);
  };

  return (
    <div style={{ padding: "0 16px 40px" }}>
      <Problem onDismiss={() => setErr("")}>{err}</Problem>

      <Card pad={14} style={{ marginBottom: 14 }}>
        <form onSubmit={commit}>
          <label htmlFor="capture-title" style={{ fontWeight: 700 }}>Capture an item</label>
          <div className="flex items-center gap-2.5" style={{ marginBlock: "5px 8px" }}>
            <input id="capture-title" name="title" value={capture.title} onChange={setCaptureField("title")}
              required maxLength={250} placeholder="What needs attention?"
              style={{ flex: 1, minWidth: 0, color: C.ink, background: C.ground, borderRadius: 8, padding: 9, fontSize: 16 }} />
            <button type="submit" className="tap" disabled={!capture.title.trim()}
              style={{ background: C.ink, color: C.card, borderRadius: 8, minHeight: 44, paddingInline: 12 }}>Add</button>
          </div>
          <button type="button" onClick={() => setShowCaptureDetails((open) => !open)}
            aria-expanded={showCaptureDetails} aria-controls="capture-fields" style={{ fontSize: 13, textDecoration: "underline", cursor: "pointer" }}>
            {showCaptureDetails ? "Hide fields" : "Add type, owner or due date"}
          </button>
          <div id="capture-fields" hidden={!showCaptureDetails} style={{ marginTop: showCaptureDetails ? 10 : 0 }}>
            <div className="cockpit-capture-fields">
              <label>Type<select name="kind" value={capture.kind} onChange={setCaptureField("kind")}>
                <option value="action">Action</option>
                <option value="editorial">Editorial idea</option>
                <option value="commercial">Commercial follow-up</option>
                <option value="production">Production task</option>
              </select></label>
              <label>Owner<input name="owner" value={capture.owner} onChange={setCaptureField("owner")} maxLength={100} /></label>
              <label>Due date<input type="date" name="dueDate" value={capture.dueDate} onChange={setCaptureField("dueDate")} /></label>
              <label className="cockpit-capture-details">Details<textarea name="details" value={capture.details} onChange={setCaptureField("details")} rows={2} maxLength={1000} /></label>
            </div>
          </div>
          <div role="status">{just && <Mono s={9}>Added to Today · {just}</Mono>}</div>
        </form>
      </Card>

      {/* automatic meeting intake plus the current connected-source briefing */}
      <Section label="Briefing & meeting intake">
        <Card tint={C.lilac} pad={18} style={{ marginBottom: 10 }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div style={{ fontSize: 15.5, fontWeight: 600, color: C.ink, lineHeight: 1.25 }}>Recent meetings</div>
              <div style={{ marginTop: 3 }}><Mono s={9}>FIREFLIES · AUTOMATIC INTAKE</Mono></div>
            </div>
            <button className="tap" onClick={refreshMeetings} aria-label="Refresh meeting list"
              style={{ border: "1px solid rgba(20,24,51,.16)", borderRadius: 999, background: "transparent", padding: "5px 10px", cursor: "pointer", fontFamily: BODY, fontSize: 11, color: C.ink2 }}>Refresh</button>
          </div>
          {ff.state === "loading" ? <div style={{ marginTop: 12 }}><Mono>Loading saved meeting actions…</Mono></div> : ff.state === "error" ? <div style={{ marginTop: 12 }}><Mono c={C.red}>The saved meeting list is unavailable.</Mono></div> : (() => {
            const cutoff = Date.now() - 36 * 60 * 60 * 1000;
            const recent = (items) => (items || []).filter((item) => {
              const at = item.meetingDate || item.raised || item.date;
              const ms = at ? new Date(at).getTime() : NaN;
              return Number.isFinite(ms) && ms >= cutoff;
            });
            const decisions = recent(ff.data?.decisions);
            const actions = recent(ff.data?.actions);
            return <>
              <div className="flex items-center justify-between" style={{ marginTop: 10, padding: "8px 10px", borderRadius: 10, background: "rgba(255,255,255,.55)" }}>
                <Mono>{actions.length} actions · {decisions.length} decisions · last 36 hours</Mono>
                <Mono s={8}>{ff.health?.lastCheckedAt ? `Checked ${new Date(ff.health.lastCheckedAt).toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit" })}` : "Awaiting first check"}</Mono>
              </div>
              {ff.health?.lastError && <div style={{ padding: "7px 10px 0" }}><Mono c={C.red}>Automatic intake issue: {ff.health.lastError}</Mono></div>}
              {decisions.map((d, i) => (
            <Row key={`d${i}`} accent={C.red} onAdd={() => addExtra({ title: d.what, kind: "decision", source: "fireflies" })}>
              <div style={{ marginBottom: 4 }}><Mono c={C.red} s={9}>Decision logged</Mono></div>
              <div style={{ fontSize: 14, color: C.ink, lineHeight: 1.4 }}>{d.what}</div>
              {d.why && <div style={{ fontSize: 12.5, color: C.ink2, marginTop: 3, lineHeight: 1.45 }}>{d.why}</div>}
              <div className="flex items-center gap-2" style={{ marginTop: 3 }}><Mono s={9}>{d.meeting}</Mono>{d.sourceUrl && <a href={d.sourceUrl} target="_blank" rel="noreferrer" aria-label="Open Fireflies transcript"><Link2 size={12} /></a>}</div>
            </Row>
              ))}
              {actions.map((a, i) => (
            <Row key={`a${i}`} onAdd={() => addExtra({ title: a.what, source: "fireflies", dueDate: a.due })}>
              <div style={{ fontSize: 14, color: C.ink, lineHeight: 1.4 }}>{a.what}</div>
              <div className="flex items-center gap-2" style={{ marginTop: 3 }}><Mono s={9}>{a.who}{a.due ? ` · due ${a.due}${a.agreed ? "" : " (inferred)"}` : ""} · {a.meeting}</Mono>{a.sourceUrl && <a href={a.sourceUrl} target="_blank" rel="noreferrer" aria-label="Open Fireflies transcript"><Link2 size={12} /></a>}</div>
            </Row>
              ))}
              {!actions.length && !decisions.length && <div style={{ padding: "14px 10px 4px" }}><Mono>No new actions or decisions from meetings in the last 36 hours.</Mono></div>}
            </>;
          })()}
        </Card>

        <Sweep tint={C.mint} icon={Mail} title="The Briefing" sub={`Gmail, Calendar, Drive · ${briefAt ? `updated ${new Date(briefAt).toLocaleTimeString("en-IE", { hour: "2-digit", minute: "2-digit" })}` : "current connections"}`}
          runLabel="Retry briefing" onRun={runBrief} state={briefState}>
          {(brief || []).map((c, i) => (
            <Row key={i} onAdd={() => addExtra({ title: `Follow up · ${c.who}`, source: c.src || "briefing" })}>
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
      <div id="today-outcomes" tabIndex={-1}>
      <Section label="Today's outcomes" right={<Mono>{offAir ? "rest day" : `${tasks.filter((t) => done[t.id]).length}/${tasks.length}`}</Mono>}>
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
                  <button onClick={() => toggle(t.id)} className="tap" aria-label={`Done: ${t.name}`} aria-pressed={isDone}
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
                    {t.note && <div style={{ fontSize: 12.5, color: C.ink2, marginTop: 2, lineHeight: 1.45 }}>{t.note}</div>}
                    {t.kind && <div style={{ marginTop: 3 }}><Mono s={9}>
                      {[t.kind, t.owner, t.dueDate && `Due ${t.dueDate}`, t.source !== "manual" && t.source].filter(Boolean).join(" · ")}
                    </Mono></div>}
                  </div>
                </div>
              );
            })}
          </Card>
        )}
      </Section>

      </div>

      <details className="cockpit-today-details">
        <summary>Editorial desk tools</summary>
      <EditorialCall gaps={gaps} threads={threads} onNavigate={onEditorialNavigate} />

      <div className="flex justify-end" style={{ marginBottom: 10 }}>
        <button className="tap" onClick={() => {
          navigator.clipboard?.writeText("https://calendly.com/vinnyob/podcast-precall-discussion");
          setCopied(true); setTimeout(() => setCopied(false), 1600);
        }}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, background: C.card, border: "1.5px solid rgba(20,24,51,.1)", borderRadius: 999, padding: "8px 14px", cursor: "pointer", fontFamily: BODY, fontSize: 12.5, fontWeight: 600, color: C.ink }}>
          <Link2 size={14} strokeWidth={2.3} />{copied ? "Link copied" : "Copy pre-call link"}
        </button>
      </div>

      </details>

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
