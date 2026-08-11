import { json } from "./_auth.js";
import { readJSON, writeJSON } from "./_blobs.js";
import { record } from "./_ledger.js";

/**
 * POST /api/inbox  → drops a note into the Cockpit from outside it.
 *
 * Deliberately NOT behind the session cookie, because the whole point is that
 * a chat, a shortcut or a scripimport React, { useState, useEffect, useCallback } from "react";
import { Mail, ExternalLink, Send, Check, Star, FileText, RotateCcw } from "lucide-react";
import {
  C, BODY, MONO, DISPLAY, Mono, Big, Card, Section, Pill, Field, Note,
  Empty, Problem, Confirm, iso, parseObject,
} from "../lib/ui.jsx";
import { callOp, sGet, sSet } from "../api.js";

/* ============================================================
   src/rooms/Inbox.jsx

   Live: /api/mail (read), op "desk" (draft), /api/send-email (reply),
   /api/doc-create (file it).

   The point is not to show you email. Gmail already does that better.
   The point is that every message arrives with the reply written and
   the next step named, so the decision is yes or no rather than
   twenty minutes of composition.

   Nothing sends without a second tap. The server refuses without
   confirm:true regardless, so the rule holds even if this screen
   is wrong.
   ============================================================ */

export default function Inbox({ threads, ledger }) {
  const [state, setState] = useState({ loading: true });
  const [open, setOpen] = useState(null);      // full message
  const [read, setRead] = useState(null);      // the model's take
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [handled, setHandled] = useState([]);

  useEffect(() => {
    (async () => {
      setHandled(await sGet("mail-handled", []));
      try {
        const res = await fetch("/api/mail", { credentials: "same-origin" });
        setState({ ...(await res.json()), loading: false });
      } catch (e) {
        setState({ loading: false, reason: `Could not reach Gmail: ${e.message}`, messages: [] });
      }
    })();
  }, []);

  const openMessage = useCallback(async (m) => {
    setOpen({ ...m, loading: true });
    setRead(null);
    setDraft("");
    setErr("");
    try {
      const res = await fetch(`/api/mail?id=${encodeURIComponent(m.id)}`, { credentials: "same-origin" });
      const d = await res.json();
      if (d.reason) throw new Error(d.reason);
      setOpen({ ...d.message, loading: false });
    } catch (e) {
      setOpen(null);
      setErr(e.message || "Could not open that message.");
    }
  }, []);

  /* One call does three jobs: what it actually asks for, the reply, and what
     happens after the reply. The third is the one people forget. */
  const think = useCallback(async () => {
    if (!open || open.loading) return;
    setBusy("read");
    setErr("");
    try {
      const archive = (ledger || []).slice(0, 20).map((l) => `${l.date}: ${l.title}`).join("\n");
      const r = await callOp({
        op: "desk",
        extra: "INBOX TRIAGE",
        draft: `FROM: ${open.from.name || open.from.email} <${open.from.email}>\nSUBJECT: ${open.subject}\n\n${open.body}`,
        archive,
        history: [{
          role: "user",
          content:
`Triage this email. Return ONLY JSON:

{
  "asks": "",
  "urgency": "today|this week|no rush|none",
  "reply": "",
  "next": "",
  "watch": ""
}

asks: what they actually want, in one sentence. Not what the email says — what
it wants. Those differ more often than people admit.

reply: written as Vinny. Short, direct, no throat-clearing, no "hope you're
well". Name the decision if there is one. If a date is needed, propose one
rather than asking when suits. If no reply is warranted, return "".

next: the thing that happens after the reply is sent. A document to write, a
call to book, a person to chase. If sending the reply genuinely closes it, say
"Nothing. This closes it."

watch: anything that would embarrass him — a commitment implied but not made, a
number he has not verified, a client confidentiality edge. Empty if none.` }],
      });
      const out = parseObject(r.text);
      setRead(out);
      setDraft(out.reply || "");
    } catch (e) {
      setErr(e.message || "The read did not come back.");
    }
    setBusy("");
  }, [open, ledger]);

  const send = async () => {
    if (!open || !draft.trim()) return;
    setBusy("send");
    setErr("");
    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          to: open.replyTo || open.from.email,
          subject: /^re:/i.test(open.subject) ? open.subject : `Re: ${open.subject}`,
          body: draft,
          confirm: true,
          context: "inbox.reply",
        }),
      });
      const d = await res.json();
      if (!res.ok || d.error) throw new Error(d.error || `Send failed (${res.status})`);
      markHandled(open.id);
      setOpen(null);
    } catch (e) {
      setErr(e.message || "Nothing was sent.");
    }
    setBusy("");
  };

  /* File it. doc-create puts a note in Drive, which is the only route into a
     Claude Project that actually exists — see the note at the bottom. */
  const file = async () => {
    if (!open) return;
    setBusy("file");
    setErr("");
    try {
      const body = [
        `From: ${open.from.name || ""} <${open.from.email}>`,
        `Date: ${open.date}`,
        read?.asks ? `\nAsks: ${read.asks}` : "",
        read?.next ? `Next: ${read.next}` : "",
        `\n---\n`,
        open.body,
      ].filter(Boolean).join("\n");
      const res = await fetch("/api/doc-create", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: `Mail · ${open.subject}`.slice(0, 120), body }),
      });
      const d = await res.json();
      if (!res.ok || d.error) throw new Error(d.error || "Could not file it.");
      markHandled(open.id);
    } catch (e) {
      setErr(e.message || "Could not file it.");
    }
    setBusy("");
  };

  const markHandled = (id) => {
    const next = [...new Set([id, ...handled])].slice(0, 400);
    setHandled(next);
    sSet("mail-handled", next);
  };

  const messages = (state.messages || []).filter((m) => !handled.includes(m.id));

  if (state.loading) return <div style={{ padding: "18px 4px" }}><Mono>Reading the inbox…</Mono></div>;

  if (state.reason) {
    return (
      <>
        <Note>Reads the primary inbox only. Promotions, social and lists never appear here.</Note>
        <Card tint={C.blush}><p style={{ fontSize: 13.5, color: C.ink, lineHeight: 1.5 }}>{state.reason}</p></Card>
      </>
    );
  }

  /* ── one message ── */
  if (open) {
    return (
      <div>
        <button onClick={() => { setOpen(null); setRead(null); }} className="tap"
          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: C.ink2, marginBottom: 16, fontSize: 13.5, fontWeight: 500 }}>
          ‹ Inbox
        </button>
        <Problem onDismiss={() => setErr("")}>{err}</Problem>

        <Card style={{ marginBottom: 14 }}>
          <Mono s={9}>{open.from?.name || open.from?.email}</Mono>
          <div style={{ marginTop: 6 }}><Big s={22}>{open.subject.toUpperCase()}</Big></div>
          {open.loading ? (
            <div className="lamp" style={{ marginTop: 14 }}><Mono>Opening…</Mono></div>
          ) : (
            <>
              <pre style={{
                margin: "14px 0 0", whiteSpace: "pre-wrap", fontFamily: BODY, fontSize: 14,
                lineHeight: 1.6, color: C.ink2, maxHeight: 320, overflowY: "auto",
              }}>{open.body}</pre>
              <div className="flex gap-2 items-center" style={{ marginTop: 14 }}>
                <Pill sm disabled={!!busy} onClick={think}>{busy === "read" ? "Reading…" : "What does it want?"}</Pill>
                <a href={open.url} target="_blank" rel="noopener noreferrer" className="tap"
                  style={{ marginLeft: "auto", color: C.ink2, display: "flex" }}>
                  <ExternalLink size={16} strokeWidth={2.2} />
                </a>
              </div>
            </>
          )}
        </Card>

        {read && (
          <>
            <Card tint={C.sand} style={{ marginBottom: 12 }}>
              <Mono>What it actually asks</Mono>
              <p style={{ fontSize: 14.5, color: C.ink, lineHeight: 1.5, marginTop: 7 }}>{read.asks}</p>
              {read.urgency && read.urgency !== "none" && (
                <div style={{ marginTop: 8 }}><Mono s={9} c={read.urgency === "today" ? C.red : C.ink2}>{read.urgency}</Mono></div>
              )}
            </Card>

            {read.watch && (
              <Card tint={C.blush} pad={16} style={{ marginBottom: 12 }}>
                <Mono c={C.red}>Careful</Mono>
                <p style={{ fontSize: 13.5, color: C.ink, lineHeight: 1.5, marginTop: 6 }}>{read.watch}</p>
              </Card>
            )}

            {draft ? (
              <Card style={{ marginBottom: 12 }}>
                <Mono>The reply</Mono>
                <div style={{ marginTop: 8 }}><Field value={draft} onChange={setDraft} rows={9} /></div>
                <div className="flex gap-2 items-center" style={{ marginTop: 12 }}>
                  <Mono s={9}>to {open.replyTo || open.from?.email}</Mono>
                  <span style={{ marginLeft: "auto" }}>
                    {busy === "send"
                      ? <Pill sm disabled>Sending…</Pill>
                      : <Confirm sm label="Send it" confirmLabel="Yes, send" onConfirm={send} />}
                  </span>
                </div>
              </Card>
            ) : (
              <Card style={{ marginBottom: 12 }}>
                <p style={{ fontSize: 13.5, color: C.ink2, lineHeight: 1.5 }}>No reply warranted.</p>
              </Card>
            )}

            {read.next && (
              <Card tint={C.mint} pad={16} style={{ marginBottom: 12 }}>
                <Mono>Next</Mono>
                <p style={{ fontSize: 14, color: C.ink, lineHeight: 1.5, marginTop: 6 }}>{read.next}</p>
              </Card>
            )}

            <div className="flex gap-2">
              <Pill sm tone="ghost" icon={FileText} disabled={!!busy} onClick={file}>
                {busy === "file" ? "Filing…" : "File to Drive"}
              </Pill>
              <Pill sm tone="ghost" icon={Check} onClick={() => { markHandled(open.id); setOpen(null); }}>
                Done with it
              </Pill>
            </div>
          </>
        )}
      </div>
    );
  }

  /* ── the list ── */
  return (
    <div>
      <Note>
        Primary inbox only, last fortnight, addressed to you. Every message opens with the reply
        written and the next step named.
      </Note>
      <Problem onDismiss={() => setErr("")}>{err}</Problem>

      {!messages.length && (
        <Empty>
          {state.empty ? "Nothing in the primary inbox needing you. That is a result." : "All handled."}
        </Empty>
      )}

      {messages.map((m) => (
        <button key={m.id} onClick={() => openMessage(m)} className="tap w-full text-left"
          style={{
            background: C.card, borderRadius: 20, padding: 16, marginBottom: 9, border: "none",
            cursor: "pointer", boxShadow: "0 1px 2px rgba(20,24,51,.04), 0 6px 20px rgba(20,24,51,.06)",
            borderLeft: `3px solid ${m.important ? C.red : m.unread ? C.ink : "transparent"}`,
          }}>
          <div className="flex items-center gap-2 flex-wrap">
            <span style={{ fontSize: 13.5, color: C.ink, fontWeight: 600 }}>{m.from.name || m.from.email}</span>
            {m.starred && <Star size={12} strokeWidth={2.4} color={C.ink2} />}
            {m.unread && <span style={{ width: 6, height: 6, borderRadius: 999, background: C.ink }} />}
          </div>
          <div style={{ fontSize: 14.5, color: C.ink, lineHeight: 1.35, marginTop: 4 }}>{m.subject}</div>
          <p style={{ fontSize: 12.5, color: C.ink2, lineHeight: 1.45, marginTop: 4 }}>
            {m.snippet.slice(0, 150)}{m.snippet.length > 150 ? "…" : ""}
          </p>
        </button>
      ))}

      {handled.length > 0 && (
        <div style={{ padding: "10px 6px" }}>
          <button onClick={() => { setHandled([]); sSet("mail-handled", []); }} className="tap"
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
            <Mono s={9}>{handled.length} handled · show again</Mono>
          </button>
        </div>
      )}
    </div>
  );
}

