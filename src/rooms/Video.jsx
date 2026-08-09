import React, { useState, useRef, useCallback } from "react";
import { Check, X, RotateCcw, ExternalLink, Copy, Pencil } from "lucide-react";
import {
  C, BODY, MONO, DISPLAY, SH, SH_UP, R, Mono, Big, Card, Section, Pill,
  Field, Note, Empty, Problem, Chips, Confirm, iso, DAYS, parseJSON,
} from "../lib/ui.jsx";
import { callOp, sSet } from "../api.js";

/* ============================================================
   src/rooms/Video.jsx

   Swiping only queues. Publishing is a separate, per-platform act,
   because swiping the wrong way should never put something on
   YouTube.

   Copy is written per platform, not once and reused. From the
   metadata contract: a YouTube Short title under 60 characters is
   not an X post is not an Instagram caption. Never the same text
   four times.
   ============================================================ */

const ACCOUNTS = [
  { id: "6853f3c16581970b2eebf51a", platform: "YouTube", short: "YT", tint: C.blush,
    rule: "Claim as title, under 60 characters, no hashtags." },
  { id: "6a6a4fc9b6bbd46119642533", platform: "TikTok", short: "TT", tint: C.mint,
    rule: "Hook first. One line of context. Trend-aware, not trend-chasing." },
  { id: "6a6a4ff343c4264488aa4fa0", platform: "X", short: "X", tint: C.sky,
    rule: "Single claim. No thread, no emoji, no link — a URL costs 13x." },
];

const TINTS = [C.mint, C.sand, C.apricot, C.sky, C.lilac, C.blush];

/* Per-platform copy, derived from what the model returned for the clip.
   Falls back sensibly rather than leaving a box empty. */
function seedCopy(clip) {
  const title = clip.title || "";
  const hook = clip.hook || "";
  const desc = clip.description || "";
  return {
    YouTube: title.length <= 60 ? title : title.slice(0, 57).trim() + "…",
    TikTok: [hook, desc].filter(Boolean).join("\n\n").slice(0, 300) || title,
    X: (hook || title).replace(/https?:\/\/\S+/g, "").trim().slice(0, 270),
  };
}

function Deck({ clips, onDone }) {
  const [n, setN] = useState(0);
  const [dx, setDx] = useState(0);
  const [fly, setFly] = useState(null);
  const [log, setLog] = useState([]);
  const start = useRef(null);

  const decide = useCallback((keep) => {
    setFly(keep ? 1 : -1);
    setTimeout(() => {
      const next = [...log, { clip: clips[n], keep }];
      setLog(next);
      setN((v) => v + 1);
      setFly(null);
      setDx(0);
      if (n + 1 >= clips.length) onDone(next.filter((x) => x.keep).map((x) => x.clip));
    }, 240);
  }, [log, n, clips, onDone]);

  const undo = () => { if (log.length) { setLog((l) => l.slice(0, -1)); setN((v) => v - 1); setDx(0); } };
  const down = (e) => { start.current = e.clientX; e.currentTarget.setPointerCapture(e.pointerId); };
  const move = (e) => { if (start.current !== null) setDx(e.clientX - start.current); };
  const up = () => {
    if (start.current === null) return;
    start.current = null;
    if (dx > 90) decide(true); else if (dx < -90) decide(false); else setDx(0);
  };

  const kept = log.filter((l) => l.keep).length;
  if (n >= clips.length) return null;
  const off = fly ? fly * 520 : dx;

  return (
    <>
      <div style={{ position: "relative", height: 340, marginBottom: 18 }}>
        {[clips[n + 1], clips[n]].filter(Boolean).map((c, idx) => {
          const top = idx === 1 || !clips[n + 1];
          return (
            <div key={c.clipId}
              onPointerDown={top ? down : undefined} onPointerMove={top ? move : undefined}
              onPointerUp={top ? up : undefined} onPointerCancel={top ? up : undefined}
              style={{
                position: "absolute", inset: 0, background: TINTS[(n + idx) % TINTS.length],
                borderRadius: R, padding: 22, boxShadow: top ? SH_UP : SH,
                transform: top ? `translateX(${off}px) rotate(${off / 22}deg)` : "scale(.93) translateY(15px)",
                transition: start.current === null ? "transform .24s ease, opacity .24s ease" : "none",
                opacity: fly ? 0 : 1, touchAction: "pan-y", cursor: top ? "grab" : "default",
                display: "flex", flexDirection: "column", overflow: "hidden",
              }}>
              <div className="flex gap-2 flex-wrap">
                <Mono s={9}>{(c.episode || "").slice(0, 26)}</Mono>
                {c.seconds && <Mono s={9}>{c.seconds}s</Mono>}
                {c.opus_rank && <Mono s={9} style={{ opacity: .6 }}>Opus #{c.opus_rank}</Mono>}
                {c.divergence && <Mono s={9} c={C.red}>Cross-Atlantic</Mono>}
              </div>
              <div style={{ fontFamily: DISPLAY, fontSize: 26, fontWeight: 800, lineHeight: 1.05, color: C.ink, marginTop: 12 }}>
                {c.title}
              </div>
              {c.hook && (
                <p style={{ fontSize: 14, color: C.ink, lineHeight: 1.5, marginTop: 10 }}>
                  <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: ".1em", color: C.red }}>HOOK </span>
                  {c.hook}
                </p>
              )}
              {c.reason && <p style={{ fontSize: 13.5, color: C.ink2, lineHeight: 1.5, marginTop: 8 }}>{c.reason}</p>}
              <div style={{ marginTop: "auto", paddingTop: 10 }}><Mono s={9}>Right to keep · left to skip</Mono></div>
              {top && (
                <>
                  <Tag show={dx > 40} text="KEEP" col={C.red} side="left" />
                  <Tag show={dx < -40} text="SKIP" col={C.ink} side="right" />
                </>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-center gap-4">
        <Round onClick={() => decide(false)} label="Skip"><X size={23} strokeWidth={2.4} color={C.ink} /></Round>
        <Round onClick={undo} label="Undo" sm disabled={!log.length}>
          <RotateCcw size={17} strokeWidth={2.4} color={log.length ? C.ink2 : "rgba(86,92,130,.3)"} />
        </Round>
        <Round onClick={() => decide(true)} label="Keep" accent><Check size={23} strokeWidth={2.6} color="#fff" /></Round>
      </div>
      <div style={{ textAlign: "center", marginTop: 12 }}>
        <Mono>{clips.length - n} to go · {kept} kept</Mono>
      </div>
    </>
  );
}

const Tag = ({ show, text, col, side }) => (
  <div style={{
    position: "absolute", top: 20, [side]: 20, fontFamily: MONO, fontSize: 11.5, letterSpacing: ".16em",
    padding: "7px 13px", borderRadius: 999, border: `2px solid ${col}`, color: col,
    background: "rgba(255,255,255,.75)", opacity: show ? 1 : 0, transition: "opacity .15s ease",
    transform: `rotate(${side === "left" ? -9 : 9}deg)`,
  }}>{text}</div>
);

const Round = ({ children, onClick, label, accent, sm, disabled }) => {
  const d = sm ? 44 : 60;
  return (
    <button onClick={onClick} aria-label={label} disabled={disabled} className="tap"
      style={{
        width: d, height: d, borderRadius: 999, flexShrink: 0, display: "flex",
        alignItems: "center", justifyContent: "center",
        background: accent ? C.red : "#fff", border: accent ? "none" : "1.5px solid rgba(20,24,51,.1)",
        boxShadow: disabled ? "none" : SH, opacity: disabled ? .5 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}>{children}</button>
  );
};

/* One clip, three platforms, three pieces of copy. */
function QueuedClip({ clip, published, busy, onPublish }) {
  const [copy, setCopy] = useState(() => seedCopy(clip));
  const [editing, setEditing] = useState(null);

  return (
    <Card pad={18} style={{ marginBottom: 12 }}>
      <div style={{ fontFamily: DISPLAY, fontSize: 19, fontWeight: 800, lineHeight: 1.1, color: C.ink }}>
        {clip.title}
      </div>
      {clip.seconds && <div style={{ marginTop: 4 }}><Mono s={9}>{clip.seconds}s · {clip.episode || ""}</Mono></div>}

      <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
        {ACCOUNTS.map((a) => {
          const shipped = published.find((p) => p.title === clip.title && p.platform === a.platform);
          const mine = busy === "pub" + clip.clipId + a.id;
          const text = copy[a.platform] || "";
          const isEditing = editing === a.platform;
          const over = a.platform === "YouTube" && text.length > 60;

          return (
            <div key={a.id} style={{ background: a.tint, borderRadius: 18, padding: 14, opacity: shipped ? 0.55 : 1 }}>
              <div className="flex items-center justify-between gap-2">
                <Mono s={9.5}>{a.platform}</Mono>
                <Mono s={9} c={over ? C.red : C.ink2}>{text.length}{a.platform === "YouTube" ? "/60" : a.platform === "X" ? "/280" : ""}</Mono>
              </div>

              {isEditing ? (
                <div style={{ marginTop: 9 }}>
                  <Field tint="rgba(255,255,255,.75)" rows={a.platform === "YouTube" ? 2 : 4}
                    value={text} onChange={(v) => setCopy({ ...copy, [a.platform]: v })} />
                </div>
              ) : (
                <p style={{ fontSize: 13.5, color: C.ink, lineHeight: 1.5, marginTop: 8, whiteSpace: "pre-wrap" }}>
                  {text || <span style={{ color: C.ink2 }}>Nothing written for {a.platform} yet.</span>}
                </p>
              )}

              <div style={{ marginTop: 6 }}><Mono s={8.5} style={{ opacity: .75 }}>{a.rule}</Mono></div>

              <div className="flex gap-2 items-center" style={{ marginTop: 11 }}>
                <Pill sm tone="ghost" icon={isEditing ? Check : Pencil}
                  onClick={() => setEditing(isEditing ? null : a.platform)}>
                  {isEditing ? "Done" : "Edit"}
                </Pill>
                <span style={{ marginLeft: "auto" }}>
                  {shipped
                    ? <Mono s={9}>Shipped ✓</Mono>
                    : mine
                      ? <Pill sm disabled>Posting…</Pill>
                      : <Confirm sm label={`Publish ${a.short}`} confirmLabel="Yes, publish"
                          disabled={!!busy || !text.trim()}
                          onConfirm={() => onPublish(clip, a, text)} />}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default function Video({
  shorts, setShorts, dayKey, published, onPublish, busy, cal, onSetCal, today, K,
}) {
  const [tab, setTab] = useState("shorts");
  const [err, setErr] = useState("");
  const [pulling, setPulling] = useState(false);
  const [queue, setQueue] = useState(null);

  const pull = useCallback(async () => {
    setPulling(true);
    setErr("");
    setQueue(null);
    try {
      const r = await callOp({ op: "clips", extra: "12" });
      const list = parseJSON(r.text);
      setShorts(list);
      await sSet(K.shorts(dayKey), list);
    } catch (e) {
      setErr(e.message || "Could not reach the clip library.");
    }
    setPulling(false);
  }, [dayKey, setShorts, K]);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    return iso(d);
  });

  return (
    <div>
      <Chips items={[["shorts", "The Shorts"], ["cal", "Calendar"]]} value={tab} onChange={setTab} />
      <div style={{ height: 18 }} />
      <Problem onDismiss={() => setErr("")}>{err}</Problem>

      {tab === "shorts" && (
        <>
          <Note>
            Filtered against everything already proposed and rotated across themes. Keeping queues a clip.
            Publishing is per platform, with its own copy, and nothing goes twice.
          </Note>

          {!shorts && !pulling && (
            <>
              <Empty>Nothing pulled yet. This reads every project in the library, not just the recent ones.</Empty>
              <div style={{ marginTop: 12 }}><Pill full onClick={pull}>Pull today's clips</Pill></div>
            </>
          )}

          {pulling && (
            <Card>
              <div className="lamp"><Mono c={C.red}>Reading the library…</Mono></div>
              <p style={{ fontSize: 12.5, color: C.ink2, marginTop: 8, lineHeight: 1.5 }}>
                Listing projects, then clips, then choosing. Ninety seconds is normal.
              </p>
            </Card>
          )}

          {shorts && !queue && <Deck clips={shorts} onDone={setQueue} />}

          {queue && (
            <>
              <Card tint={C.mint} style={{ textAlign: "center", marginBottom: 16 }}>
                <Big s={40}>{queue.length} KEPT</Big>
                <p style={{ fontSize: 13.5, color: C.ink2, marginTop: 8 }}>
                  Nothing has gone out. Check the copy per platform, then publish where you want it.
                </p>
              </Card>

              {queue.map((c) => (
                <QueuedClip key={c.clipId} clip={c} published={published} busy={busy} onPublish={onPublish} />
              ))}

              <div style={{ marginTop: 8 }}>
                <Pill full tone="ghost" onClick={() => { setQueue(null); pull(); }}>Pull another set</Pill>
              </div>
            </>
          )}

          {published.length > 0 && (
            <Section label="Shipped" style={{ marginTop: 24 }}
              right={
                <Pill sm tone="ghost" icon={Copy}
                  onClick={() => navigator.clipboard?.writeText(published.filter((p) => p.url).map((p) => `${p.platform}\t${p.title}\t${p.url}`).join("\n"))}>
                  Copy URLs
                </Pill>
              }>
              <Card pad={0} style={{ padding: "6px 0" }}>
                {published.slice(0, 12).map((p, i) => (
                  <div key={p.id} className="flex items-center gap-3" style={{ padding: "11px 16px", borderTop: i ? "1px solid rgba(20,24,51,.07)" : "none" }}>
                    <Mono s={9} style={{ minWidth: 52 }}>{p.platform}</Mono>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: C.ink, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{p.title}</span>
                    {p.url
                      ? <a href={p.url} target="_blank" rel="noopener noreferrer" style={{ color: C.ink2, display: "flex" }}><ExternalLink size={15} strokeWidth={2.2} /></a>
                      : <Mono s={9}>{p.scheduled ? "Scheduled" : "No URL"}</Mono>}
                  </div>
                ))}
              </Card>
            </Section>
          )}
        </>
      )}

      {tab === "cal" && (
        <>
          <Note>Two a day, minimum one written and one video. Filling both ticks the rundown.</Note>
          {days.map((dk, i) => {
            const d = new Date(dk);
            const row = cal[dk] || {};
            const full = !!(row.written && row.video);
            return (
              <Card key={dk} pad={16} accent={full ? C.ink : i === 0 ? C.red : undefined} style={{ marginBottom: 9 }}>
                <Mono c={i === 0 ? C.red : C.ink2} s={9.5}>{DAYS[d.getDay()].slice(0, 2)} {d.getDate()}</Mono>
                <div style={{ display: "grid", gap: 7, marginTop: 9 }}>
                  {[["written", "written"], ["video", "video"]].map(([slot, label]) => (
                    <input key={slot} defaultValue={row[slot] || ""} placeholder={`+ ${label}`}
                      onBlur={(e) => onSetCal(dk, slot, e.target.value.trim())}
                      style={{
                        width: "100%", boxSizing: "border-box",
                        background: row[slot] ? C.mint : "rgba(20,24,51,.03)",
                        border: "none", borderRadius: 13, padding: "11px 13px",
                        fontFamily: BODY, fontSize: 13.5, color: C.ink, outline: "none",
                      }} />
                  ))}
                </div>
              </Card>
            );
          })}
        </>
      )}
    </div>
  );
}
