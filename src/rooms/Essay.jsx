import React, { useState, useEffect, useCallback, useRef } from "react";
import { Send, RotateCcw, Mic, MicOff, CornerDownLeft, Trash2, Globe } from "lucide-react";
import {
  C, BODY, MONO, Mono, Card, Pill, Field, Note, Empty, Confirm,
  Problem, Chips,
} from "../lib/ui.jsx";
import { callOp, sGet, sSet, publishEssay } from "../api.js";

/* ============================================================
   src/rooms/Essay.jsx

   Live: op "essay" (argue), op "rewrite" (redraft),
         POST /api/publish-essay (commit to the hub).

   Four surfaces, in the order the work actually happens:

     Capture  raw. Talk into it. Nothing here is judged and nothing
              here is sent anywhere until you promote it.
     Draft    the thing you are writing. Never silently altered.
     Editor   argues with you, knows the back catalogue.
     Publish  commits the body to VINLAND.

   The capture column exists because the previous version had one
   textarea holding the finished draft, so dictating a half-formed
   thought meant dirtying the thing you were trying to write. Raw
   and worked material need separate homes or you stop using the
   raw one.
   ============================================================ */

const uid = () => Math.random().toString(36).slice(2, 9);

/** Browser dictation where it exists. Chrome and Edge, effectively. */
const Recognition =
  typeof window !== "undefined" &&
  (window.SpeechRecognition || window.webkitSpeechRecognition);

export default function Essay({ threads, threadContext, K }) {
  const [thread, setThread] = useState("");
  const [draft, setDraft] = useState("");
  const [capture, setCapture] = useState([]);
  const [scratch, setScratch] = useState("");
  const [prev, setPrev] = useState(null);
  const [chat, setChat] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("capture");
  const [saved, setSaved] = useState(false);
  const [listening, setListening] = useState(false);
  const [slug, setSlug] = useState("");
  const [result, setResult] = useState(null);
  const endRef = useRef(null);
  const recRef = useRef(null);
  const scratchRef = useRef("");

  scratchRef.current = scratch;

  useEffect(() => {
    (async () => {
      const s = await sGet(K.essay(thread), null);
      setDraft(s?.draft || "");
      setChat(s?.history || []);
      setCapture(Array.isArray(s?.capture) ? s.capture : []);
      setSlug(s?.slug || "");
      setPrev(null);
      setResult(null);
    })();
  }, [thread, K]);

  /* One writer for the whole record. The old version saved (draft, history)
     as positional arguments, which meant any new field was silently dropped
     by every existing call site. Patch semantics instead. */
  const save = useCallback(async (patch) => {
    const next = {
      draft, history: chat, capture, slug,
      ...patch,
      updated: Date.now(),
    };
    await sSet(K.essay(thread), next);
    setSaved(true);
    setTimeout(() => setSaved(false), 1400);
  }, [thread, K, draft, chat, capture, slug]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chat, busy]);

  /* ---------------------------------------------------------- capture --- */

  const stopListening = useCallback(() => {
    try { recRef.current?.stop(); } catch { /* already stopped */ }
    recRef.current = null;
    setListening(false);
  }, []);

  useEffect(() => stopListening, [stopListening]);

  const listen = () => {
    if (listening) return stopListening();
    if (!Recognition) return;
    const rec = new Recognition();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = "en-IE";
    rec.onresult = (e) => {
      let add = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) add += e.results[i][0].transcript;
      }
      if (add.trim()) {
        const base = scratchRef.current;
        setScratch(base ? `${base.replace(/\s+$/, "")} ${add.trim()}` : add.trim());
      }
    };
    // Chrome ends the session on its own after a pause. Restart rather than
    // dying mid-thought, which is the whole point of continuous dictation.
    rec.onend = () => { if (recRef.current === rec) { try { rec.start(); } catch { stopListening(); } } };
    rec.onerror = (e) => {
      stopListening();
      if (e.error === "not-allowed") setErr("The browser blocked the microphone. Allow it in the address bar, or dictate with the system keyboard instead.");
      else if (e.error !== "no-speech" && e.error !== "aborted") setErr(`Dictation stopped: ${e.error}.`);
    };
    recRef.current = rec;
    setListening(true);
    try { rec.start(); } catch { stopListening(); }
  };

  const keep = () => {
    const text = scratch.trim();
    if (!text) return;
    const next = [{ id: uid(), text, at: Date.now() }, ...capture];
    setCapture(next);
    setScratch("");
    save({ capture: next });
  };

  const promote = (frag) => {
    const next = draft.trim() ? `${draft.replace(/\s+$/, "")}\n\n${frag.text}` : frag.text;
    const rest = capture.filter((c) => c.id !== frag.id);
    setDraft(next);
    setCapture(rest);
    save({ draft: next, capture: rest });
    setTab("draft");
  };

  const bin = (id) => {
    const rest = capture.filter((c) => c.id !== id);
    setCapture(rest);
    save({ capture: rest });
  };

  /* ----------------------------------------------------------- editor --- */

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
      save({ history: after });
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
      save({ draft: r.text });
      setInput("");
      setTab("draft");
    } catch (e) {
      setErr(e.message || "Rewrite failed. Your draft is untouched.");
    }
    setBusy("");
  };

  /* ---------------------------------------------------------- publish --- */

  const paragraphs = draft.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

  const publish = async () => {
    setBusy("publish");
    setErr("");
    setResult(null);
    try {
      const r = await publishEssay({ slug: slug.trim().toLowerCase(), body: draft });
      setResult(r);
      save({ slug: slug.trim().toLowerCase() });
    } catch (e) {
      setErr(e.message || "Publish failed. Nothing was committed.");
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
          <Mono s={9}>{words} words · {capture.length} kept</Mono>
          <Mono s={9} c={saved ? C.ink : C.ink2}>{saved ? "Saved" : "Saves as you type"}</Mono>
        </div>
      </Card>

      <Chips
        items={[["capture", "Capture"], ["draft", "The draft"], ["editor", "The editor"], ["publish", "Publish"]]}
        value={tab} onChange={setTab}
      />
      <div style={{ height: 14 }} />

      {/* ------------------------------------------------------ capture --- */}

      {tab === "capture" && (
        <>
          <Card pad={16} style={{ marginBottom: 12 }}>
            <Field
              value={scratch} onChange={setScratch} rows={6} onEnter={keep}
              placeholder={listening
                ? "Listening. Talk."
                : "Say it badly. Half a thought is fine. Cmd+Enter to keep it."}
            />
            <div className="flex items-center justify-between gap-3" style={{ marginTop: 12 }}>
              <div className="flex gap-2">
                {Recognition && (
                  <Pill sm tone={listening ? "solid" : "ghost"} danger={listening}
                    icon={listening ? MicOff : Mic} onClick={listen}>
                    {listening ? "Stop" : "Dictate"}
                  </Pill>
                )}
                <Pill sm disabled={!scratch.trim()} onClick={keep}>Keep it</Pill>
              </div>
              {listening && <Mono s={9} c={C.red}>Recording</Mono>}
            </div>
            {!Recognition && (
              <p style={{ fontSize: 12.5, color: C.ink3, lineHeight: 1.5, marginTop: 10 }}>
                This browser has no dictation. Use the system keyboard's microphone instead, which is
                better anyway: it already knows how you speak, and it works offline.
              </p>
            )}
          </Card>

          {capture.length === 0 ? (
            <Empty>
              Nothing kept yet. This column is for raw material, so it stays out of the draft until
              you decide it has earned a place. Fragments promote into the draft in one tap.
            </Empty>
          ) : (
            capture.map((f) => (
              <Card key={f.id} pad={14} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 14, color: C.ink, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                  {f.text}
                </div>
                <div className="flex items-center justify-between gap-3" style={{ marginTop: 10 }}>
                  <Mono s={9}>{new Date(f.at).toLocaleString("en-IE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</Mono>
                  <div className="flex gap-2">
                    <Pill sm tone="ghost" icon={CornerDownLeft} onClick={() => promote(f)}>Into the draft</Pill>
                    <Pill sm tone="ghost" icon={Trash2} onClick={() => bin(f.id)}>Bin</Pill>
                  </div>
                </div>
              </Card>
            ))
          )}
        </>
      )}

      {/* -------------------------------------------------------- draft --- */}

      {tab === "draft" && (
        <>
          <Card pad={16}>
            <textarea
              value={draft}
              onChange={(e) => { setDraft(e.target.value); save({ draft: e.target.value }); }}
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
                <Pill sm tone="ghost" onClick={() => { setDraft(prev); save({ draft: prev }); setPrev(null); }}>
                  Take it back
                </Pill>
              </div>
            </Card>
          )}
        </>
      )}

      {/* ------------------------------------------------------- editor --- */}

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

      {/* ------------------------------------------------------ publish --- */}

      {tab === "publish" && (
        <>
          <Card style={{ marginBottom: 12 }}>
            <Mono>VINLAND slug</Mono>
            <div style={{ marginTop: 8 }}>
              <Field value={slug} onChange={setSlug} placeholder="friction-as-currency" />
            </div>
            <p style={{ fontSize: 12.5, color: C.ink3, lineHeight: 1.5, marginTop: 10 }}>
              The slug has to already exist in the VINLAND index, because that is what generates the
              page. Publishing against an unknown slug is refused rather than committed, so a typo
              costs you nothing.
            </p>
            <div className="flex items-center justify-between gap-3" style={{ marginTop: 14 }}>
              <Mono s={9}>{paragraphs.length} paragraphs · {words} words</Mono>
              <Confirm
                sm
                label="Publish to VINLAND"
                confirmLabel="Yes, commit it"
                disabled={!!busy || !slug.trim() || !paragraphs.length}
                onConfirm={publish}
              />
            </div>
          </Card>

          {busy === "publish" && <Card><div className="lamp"><Mono c={C.red}>Committing…</Mono></div></Card>}

          {result && (
            <Card tint={C.mint} pad={16}>
              <div style={{ fontSize: 14, color: C.ink, lineHeight: 1.6 }}>
                {result.replacing ? "Updated" : "Published"} {result.paragraphs} paragraphs.
                The hub rebuilds on the commit, so give it a minute before the URL is live.
              </div>
              <div style={{ marginTop: 10 }}>
                <a href={result.url} target="_blank" rel="noopener noreferrer"
                  style={{ fontFamily: MONO, fontSize: 11, color: C.ink, letterSpacing: ".06em" }}>
                  {result.url}
                </a>
              </div>
            </Card>
          )}

          {!result && busy !== "publish" && !paragraphs.length && (
            <Empty>Nothing to publish yet. Write the draft first.</Empty>
          )}

          {!result && busy !== "publish" && paragraphs.length > 0 && (
            <Card pad={16}>
              <Mono>How it will land</Mono>
              <div style={{ marginTop: 10 }}>
                {paragraphs.slice(0, 3).map((p, i) => (
                  <p key={i} style={{ fontSize: 13.5, color: C.ink2, lineHeight: 1.65, marginBottom: 10 }}>{p}</p>
                ))}
                {paragraphs.length > 3 && (
                  <Mono s={9}>and {paragraphs.length - 3} more</Mono>
                )}
              </div>
              <p style={{ fontSize: 12.5, color: C.ink3, lineHeight: 1.5, marginTop: 12 }}>
                Blank lines separate paragraphs. Single line breaks are joined, because the page
                renders one paragraph per entry and stray breaks arrive as sentence fragments.
              </p>
            </Card>
          )}

          <div style={{ height: 10 }} />
          <Card pad={14}>
            <div className="flex items-center gap-2">
              <Globe size={14} strokeWidth={2.2} color={C.ink2} />
              <span style={{ fontSize: 12.5, color: C.ink2, lineHeight: 1.5 }}>
                Publishing writes only the body. The index, title and teaser stay hand-maintained.
              </span>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
