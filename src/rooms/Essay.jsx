import React, { useState, useEffect, useCallback, useRef } from "react";
import { Send, RotateCcw, Check } from "lucide-react";
import {
  C, BODY, DISPLAY, Mono, Big, Card, Section, Pill, Field, Note, Empty,
  Problem, Chips,
} from "../lib/ui.jsx";
import { callOp, sGet, sSet } from "../api.js";

/* ============================================================
   src/rooms/Essay.jsx

   Live: op "essay" (argue), op "rewrite" (redraft).

   The draft is yours and is never silently altered. Rewrites are
   explicit, and the previous version is kept so you can always
   take it back. An editor that edits without asking is a liability.
   ============================================================ */

export default function Essay({ threads, threadContext, K }) {
  const [thread, setThread] = useState("");
  const [draft, setDraft] = useState("");
  const [prev, setPrev] = useState(null);
  const [chat, setChat] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("draft");
  const [saved, setSaved] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    (async () => {
      const s = await sGet(K.essay(thread), null);
      setDraft(s?.draft || "");
      setChat(s?.history || []);
      setPrev(null);
    })();
  }, [thread, K]);

  const save = useCallback(async (d, h) => {
    await sSet(K.essay(thread), { draft: d, history: h, updated: Date.now() });
    setSaved(true);
    setTimeout(() => setSaved(false), 1400);
  }, [thread, K]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chat, busy]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    const next = [...chat, { role: "user", content: text }];
    setChat(next);
    setInput("");
    setBusy("chat");
    setErr("");
    try {
      const r = await callOp({
        op: "essay",
        thread: threads.find((t) => t.id === thread)?.name || "",
        archive: threadContext(thread),
        draft,
        history: next,
      });
      const after = [...next, { role: "assistant", content: r.text }];
      setChat(after);
      save(draft, after);
    } catch (e) {
      setErr(e.message || "The editor did not come back.");
      setChat(next);
    }
    setBusy("");
  };

  const rewrite = async () => {
    if (busy || !draft.trim()) return;
    setBusy("rewrite");
    setErr("");
    try {
      const r = await callOp({
        op: "rewrite",
        thread: threads.find((t) => t.id === thread)?.name || "",
        archive: threadContext(thread),
        draft,
        history: chat,
        extra: input.trim(),
      });
      setPrev(draft);
      setDraft(r.text);
      save(r.text, chat);
      setInput("");
      setTab("draft");
    } catch (e) {
      setErr(e.message || "Rewrite failed. Your draft is untouched.");
    }
    setBusy("");
  };

  const words = draft.trim() ? draft.trim().split(/\s+/).length : 0;

  return (
    <div>
      <Note>
        An editor that knows the back catalogue and will tell you when you are repeating yourself.
        Saves per thread, so a wire story continues that thread's essay rather than starting a stray one.
      </Note>
      <Problem onDismiss={() => setErr("")}>{err}</Problem>

      <Card style={{ marginBottom: 14 }}>
        <Mono>Thread</Mono>
        <select value={thread} onChange={(e) => setThread(e.target.value)}
          style={{
            width: "100%", marginTop: 8, background: "rgba(20,24,51,.04)", border: "none",
            borderRadius: 14, padding: "13px 15px", fontFamily: BODY, fontSize: 14, color: C.ink, outline: "none",
          }}>
          <option value="">No thread, standalone</option>
          {threads.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <div className="flex items-center justify-between" style={{ marginTop: 10 }}>
          <Mono s={9}>{words} words</Mono>
          <Mono s={9} c={saved ? C.ink : C.ink2}>{saved ? "Saved" : "Saves as you type"}</Mono>
        </div>
      </Card>

      <Chips items={[["draft", "The draft"], ["editor", "The editor"]]} value={tab} onChange={setTab} />
      <div style={{ height: 14 }} />

      {tab === "draft" && (
        <>
          <Card pad={16}>
            <textarea
              value={draft}
              onChange={(e) => { setDraft(e.target.value); save(e.target.value, chat); }}
              rows={16}
              placeholder="Write here. Or paste what you have and start arguing about it."
              style={{
                width: "100%", background: "transparent", border: "none", outline: "none", resize: "none",
                fontFamily: BODY, fontSize: 15, color: C.ink, lineHeight: 1.7,
              }}
            />
          </Card>
          {prev && (
            <Card tint={C.sand} pad={14} style={{ marginTop: 10 }}>
              <div className="flex items-center justify-between gap-3">
                <span style={{ fontSize: 13, color: C.ink, lineHeight: 1.45 }}>
                  Rewritten. Your previous version is kept.
                </span>
                <Pill sm tone="ghost" onClick={() => { setDraft(prev); save(prev, chat); setPrev(null); }}>
                  Take it back
                </Pill>
              </div>
            </Card>
          )}
        </>
      )}

      {tab === "editor" && (
        <Card>
          {chat.length === 0 && (
            <p style={{ fontSize: 13.5, color: C.ink2, lineHeight: 1.6 }}>
              Tell it what the essay is trying to do. It has your archive for this thread, so it knows
              what you have already argued and will say so when you repeat yourself.
            </p>
          )}
          {chat.map((m, i) => (
            <div key={i} style={{ marginBottom: 16 }}>
              <Mono s={9} c={m.role === "user" ? C.red : C.ink2}>{m.role === "user" ? "Vinny" : "Editor"}</Mono>
              <div style={{ fontSize: 14, color: C.ink, lineHeight: 1.65, marginTop: 4, whiteSpace: "pre-wrap" }}>
                {m.content}
              </div>
            </div>
          ))}
          {busy && <div className="lamp"><Mono c={C.red}>{busy === "rewrite" ? "Rewriting…" : "Thinking…"}</Mono></div>}
          <div ref={endRef} />

          <div style={{ marginTop: chat.length ? 8 : 14 }}>
            <Field value={input} onChange={setInput} onEnter={send} rows={3} placeholder="Argue with it. Cmd+Enter to send." />
          </div>
          <div className="flex gap-2" style={{ marginTop: 10 }}>
            <Pill sm icon={Send} disabled={!!busy || !input.trim()} onClick={send}>Send</Pill>
            <Pill sm tone="ghost" icon={RotateCcw} disabled={!!busy || !draft.trim()} onClick={rewrite}>
              Rewrite the draft
            </Pill>
          </div>
        </Card>
      )}
    </div>
  );
}
