
import React, { useState, useCallback } from "react";
import { RotateCcw, ExternalLink, Send } from "lucide-react";
import {
  C, BODY, MONO, DISPLAY, Mono, Big, Card, Section, Pill, Field, Note,
  Empty, Problem, Chips, daysSince, parseJSON,
} from "../lib/ui.jsx";
import { callOp } from "../api.js";

/* ============================================================
   src/rooms/Desk.jsx

   Live: op "wire", op "desk", op "generate".
   The wire carries prior art — when a story continues something
   already argued, it says so before anything gets written. That
   is what makes the archive compound rather than accumulate.
   ============================================================ */

const STUDIO = [
  { kind: "ideas",    name: "Content ideas",   tint: C.sky,     note: "Six angles across the network, threaded to what already runs." },
  { kind: "sponsor",  name: "Sponsor approach", tint: C.apricot, note: "Prospect in. Builds the asset first, then the short email.", prompt: "Prospect name", flag: true },
  { kind: "foundrae", name: "Foundrae email",  tint: C.mint,    note: "Under 150 words, decision named, documents linked.", prompt: "What is the email about?" },
  { kind: "script",   name: "Sixty Seconds",   tint: C.sand,    note: "Standalone satirical script when the wire is not the subject." },
];

export default function Desk({ threads, today, onGenerate, busy, wire, setWire, wireAt, setWireAt, onOpenEssay, onOpenClipDesk }) {
  const [err, setErr] = useState("");
  const [pulling, setPulling] = useState(false);
  const [picked, setPicked] = useState(null);
  const [msg, setMsg] = useState("");
  const [chat, setChat] = useState([]);
  const [thinking, setThinking] = useState(false);
  const [prompts, setPrompts] = useState({});

  const pullWire = useCallback(async () => {
    setPulling(true);
    setErr("");
    try {
      const r = await callOp({ op: "wire", threads });
      setWire(parseJSON(r.text));
      setWireAt(Date.now());
      setPicked(null);
    } catch (e) {
      setErr(e.message || "The wire did not come back.");
    }
    setPulling(false);
  }, [threads, setWire, setWireAt]);

  const send = useCallback(async () => {
    const text = msg.trim();
    if (!text || thinking) return;
    const next = [...chat, { role: "user", content: text }];
    setChat(next);
    setMsg("");
    setThinking(true);
    setErr("");
    try {
      const story = picked !== null && wire ? wire[picked] : null;
      const r = await callOp({ op: "desk", story, history: next, extra: text });
      setChat([...next, { role: "assistant", content: r.text }]);
    } catch (e) {
      setErr(e.message || "The desk did not come back.");
    }
    setThinking(false);
  }, [msg, chat, thinking, picked, wire]);

  /* Prior art. If a story continues a thread, say what was already argued
     and when — before a word gets written about it. */
  const priorArt = (s) => {
    if (!s.thread) return null;
    const t = (threads || []).find((x) => x.id === s.thread);
    if (!t) return null;
    const d = daysSince(t.last, today);
    if (d === null) return `Opens "${t.name}". Never published on this, so this is the first move.`;
    return `Continues "${t.name}". Last touched ${d === 0 ? "today" : `${d} days ago`}.`;
  };

  return (
    <div>
      <Note>Everything from the last 24 hours. Pick the one you're carrying and the day builds off it.</Note>
      <Problem onDismiss={() => setErr("")}>{err}</Problem>

      <Section
        label="The Wire"
        right={<Pill sm onClick={pullWire} disabled={pulling}>{pulling ? "Pulling…" : wire ? "Refresh" : "Pull the wire"}</Pill>}
      >
        {pulling && <div className="lamp" style={{ padding: "18px 4px" }}><Mono>Reading the last 24 hours…</Mono></div>}
        {!wire && !pulling && <Empty>Nothing on the wire yet. Pull it and the day has a subject.</Empty>}
        {wire && wire.map((s, i) => {
          const prior = priorArt(s);
          const on = picked === i;
          return (
            <Card key={i} pad={18} tint={on ? C.sand : C.card} style={{ marginBottom: 9, cursor: "pointer" }}>
              <div onClick={() => setPicked(on ? null : i)}>
                <div className="flex items-center gap-2 flex-wrap" style={{ marginBottom: 6 }}>
                  <Mono s={9.5} c={C.ink2}>{s.region}</Mono>
                  <Mono s={9.5}>{(s.topic || "").toUpperCase()}</Mono>
                  <Mono s={9} style={{ opacity: .7 }}>{s.source}</Mono>
                </div>
                <div style={{ fontFamily: DISPLAY, fontSize: 21, fontWeight: 800, lineHeight: 1.08, color: C.ink }}>
                  {s.headline}
                </div>
                <p style={{ fontSize: 13.5, color: C.ink2, lineHeight: 1.5, marginTop: 6 }}>{s.summary}</p>
                {s.pov && <p style={{ fontSize: 13.5, color: C.ink, lineHeight: 1.5, marginTop: 8, fontStyle: "italic" }}>{s.pov}</p>}

                {prior && (
                  <div className="flex items-start gap-2" style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(20,24,51,.08)" }}>
                    <RotateCcw size={13} strokeWidth={2.3} color={C.red} style={{ marginTop: 2, flexShrink: 0 }} />
                    <span style={{ fontSize: 12.5, color: C.ink2, lineHeight: 1.45 }}>{prior}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 flex-wrap" style={{ marginTop: 13 }}>
                {s.url && (
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="tap"
                    style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "10px 15px", borderRadius: 999, border: "1.5px solid rgba(20,24,51,.15)", fontFamily: BODY, fontSize: 13, fontWeight: 600, color: C.ink, textDecoration: "none" }}>
                    Source <ExternalLink size={13} strokeWidth={2.3} />
                  </a>
                )}
                <Pill sm tone="ghost" onClick={() => onOpenEssay({ story: s })}>Essay</Pill>
                {[["post", "LinkedIn"], ["script", "Sixty Seconds"], ["substack", "Substack"]].map(([k, l]) => (
                  <Pill key={k} sm tone="ghost" disabled={!!busy} onClick={() => onGenerate(k, s)}>
                    {busy === k + s.headline ? "Writing…" : l}
                  </Pill>
                ))}
              </div>
            </Card>
          );
        })}
      </Section>

      <Section label="The Conversation" right={<Mono>{picked === null ? "no story picked" : "wire in view"}</Mono>}>
        <Card>
          {chat.length === 0 && (
            <p style={{ fontSize: 13.5, color: C.ink2, lineHeight: 1.55 }}>
              It has today's wire and your thread archive, and it searches when a claim needs checking.
              Ask which story is the real one, or tell it a pick is weak and see whether it agrees.
            </p>
          )}
          {chat.map((m, i) => (
            <div key={i} style={{ marginBottom: 14 }}>
              <Mono s={9} c={m.role === "user" ? C.red : C.ink2}>{m.role === "user" ? "Vinny" : "The Desk"}</Mono>
              <div style={{ fontSize: 14, color: C.ink, lineHeight: 1.6, marginTop: 4, whiteSpace: "pre-wrap" }}>{m.content}</div>
            </div>
          ))}
          {thinking && <div className="lamp"><Mono>Thinking…</Mono></div>}
          <div style={{ marginTop: chat.length ? 6 : 12 }}>
            <Field value={msg} onChange={setMsg} onEnter={send} rows={3} placeholder="Which of these is the real story? Cmd+Enter to send." />
          </div>
          <div className="flex gap-2" style={{ marginTop: 10 }}>
            <Pill sm icon={Send} disabled={!msg.trim() || thinking} onClick={send}>Send</Pill>
            <Pill sm tone="ghost" onClick={pullWire} disabled={pulling}>Refresh the wire</Pill>
          </div>
        </Card>
      </Section>

      <Section label="The Studio">
        <div style={{ display: "grid", gap: 10 }}>
          {STUDIO.map((s) => (
            <Card key={s.kind} tint={s.tint} pad={18} style={s.flag ? { border: `2px solid ${C.red}` } : undefined}>
              {s.flag && <div style={{ marginBottom: 6 }}><Mono c={C.red} s={9}>Priority this month</Mono></div>}
              <Big s={20}>{s.name.toUpperCase()}</Big>
              <p style={{ fontSize: 12.5, color: C.ink2, marginTop: 5, lineHeight: 1.45 }}>{s.note}</p>
              {s.prompt ? (
                <div style={{ marginTop: 12 }}>
                  <Field
                    tint="rgba(255,255,255,.7)"
                    value={prompts[s.kind] || ""}
                    onChange={(v) => setPrompts((p) => ({ ...p, [s.kind]: v }))}
                    onEnter={() => prompts[s.kind]?.trim() && onGenerate(s.kind, null, prompts[s.kind].trim())}
                    placeholder={s.prompt}
                  />
                  <div style={{ marginTop: 9 }}>
                    <Pill sm full disabled={!!busy || !prompts[s.kind]?.trim()}
                      onClick={() => onGenerate(s.kind, null, prompts[s.kind].trim())}>
                      {busy?.startsWith(s.kind) ? "Writing…" : "Build it"}
                    </Pill>
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: 12 }}>
                  <Pill sm full disabled={!!busy} onClick={() => onGenerate(s.kind, null)}>
                    {busy === s.kind ? "Writing…" : "Generate"}
                  </Pill>
                </div>
              )}
            </Card>
          ))}

          <Card tint={C.blush} pad={18}>
            <Big s={20}>CLIP DESK</Big>
            <p style={{ fontSize: 12.5, color: C.ink2, marginTop: 5, lineHeight: 1.45 }}>
              Paste a transcript. Six ranked clips, or the full metadata object. Nothing publishes without your tick.
            </p>
            <div style={{ marginTop: 12 }}><Pill sm full tone="ghost" onClick={onOpenClipDesk}>Open the desk</Pill></div>
          </Card>

          <Card tint={C.lilac} pad={18}>
            <Big s={20}>ESSAY WORKSHOP</Big>
            <p style={{ fontSize: 12.5, color: C.ink2, marginTop: 5, lineHeight: 1.45 }}>
              Argue a piece into shape with an editor that knows the back catalogue. Saves per thread.
            </p>
            <div style={{ marginTop: 12 }}><Pill sm full tone="ghost" onClick={() => onOpenEssay({})}>Open the workshop</Pill></div>
          </Card>
        </div>
      </Section>
    </div>
  );
}
