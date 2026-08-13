import React, { useState, useEffect, useCallback } from "react";
import { Copy, Check, AlertTriangle, RotateCcw, Save } from "lucide-react";
import {
  C, BODY, DISPLAY, MONO, Mono, Big, Card, Section, Pill, Field, Note,
  Empty, Problem, Chips, iso, parseObject,
} from "../lib/ui.jsx";
import { callOp, sGet, sSet } from "../api.js";

/* ============================================================
   src/rooms/Build.jsx

   Transcript in, every channel out.

   Two passes, not one. The metadata pass is the retrieval layer —
   titles, hook, claims, chapters, threads. The channel pass is
   persuasion, written one surface at a time so each gets a full
   prompt rather than a field in a long JSON blob.

   Nothing is sent anywhere. Publish means saved, with a copy
   button per channel. The last step stays yours.
   ============================================================ */

const CHANNELS = [
  { id: "linkedin", label: "LinkedIn", note: "120–200 words. First line carries it." },
  { id: "substack", label: "Substack", note: "250–400 words. The note, not the essay." },
  { id: "youtube",  label: "YouTube",  note: "First 150 characters state the conclusion." },
  { id: "spotify",  label: "Spotify",  note: "Under 200 words. Survives partial attention." },
];

export default function Build() {
  const [context, setContext] = useState("");
  const [source, setSource] = useState("");
  const [out, setOut] = useState(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [blocked, setBlocked] = useState(null);
  const [reasons, setReasons] = useState({});
  const [tab, setTab] = useState("meta");
  const [copied, setCopied] = useState("");

  const [drafts, setDrafts] = useState({});     // { linkedin: "…" }
  const [history, setHistory] = useState({});   // { linkedin: [turns] }
  const [notes, setNotes] = useState({});       // the feedback boxes
  const [saved, setSaved] = useState(null);

  const words = source.trim() ? source.trim().split(/\s+/).length : 0;
  const short = words > 0 && words < 500;
  const slug = (context || "episode").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60);

  /* Restore anything already saved for this episode. */
  useEffect(() => {
    if (!out) return;
    (async () => {
      const prior = await sGet(`build:${slug}`, null);
      if (prior?.drafts) { setDrafts(prior.drafts); setSaved(prior.at); }
    })();
    // eslint-disable-next-line
  }, [out]);

  const runMeta = async (overrides) => {
    setBusy("meta");
    setErr("");
    setOut(null);
    if (!overrides) setBlocked(null);
    try {
      const r = await callOp({
        op: "metadata", extra: context, draft: source,
        ...(overrides?.length ? { overrides } : {}),
      });
      setOut(parseObject(r.text));
      setBlocked(null);
      setReasons({});
      setDrafts({});
      setHistory({});
    } catch (e) {
      setErr(e.message || "The build failed.");
      if (e.blocked?.length) setBlocked(e.blocked);
    }
    setBusy("");
  };

  /* One channel, on its own. `note` is feedback on the previous attempt —
     it goes in as a reply so the prior draft stays in view and only what
     was asked for changes. */
  const runChannel = useCallback(async (kind, note) => {
    if (!out) return;
    setBusy(kind);
    setErr("");
    try {
      const material = [
        out.argument ? `ARGUMENT: ${out.argument}` : "",
        (out.titles || []).map((t) => `${t.variant}: ${t.text}`).join("\n"),
        out.hook ? `\nHOOK: ${out.hook}` : "",
        (out.claim_block || []).length
          ? `\nCLAIMS:\n${out.claim_block.map((c) => `- ${c.claim} — ${c.attributed_to} (${c.timestamp})`).join("\n")}`
          : "",
        (out.chapters || []).length
          ? `\nCHAPTERS:\n${out.chapters.map((c) => `${c.t} ${c.label}`).join("\n")}`
          : "",
      ].filter(Boolean).join("\n");

      const turns = note
        ? [
            ...(history[kind] || []),
            { role: "assistant", content: drafts[kind] || "" },
            { role: "user", content: `Change this: ${note}\n\nKeep the argument as it is. Rewrite only what the note asks for, and return the full text again.` },
          ]
        : [];

      const r = await callOp({ op: "channel", kind, extra: context, draft: material, history: turns });
      const text = String(r.text || "").trim();

      setDrafts((d) => ({ ...d, [kind]: text }));
      setHistory((h) => ({ ...h, [kind]: turns.length ? [...turns, { role: "assistant", content: text }] : [] }));
      setNotes((n) => ({ ...n, [kind]: "" }));
    } catch (e) {
      setErr(e.message || `The ${kind} draft failed.`);
    }
    setBusy("");
  }, [out, context, drafts, history]);

  /* Publish means stored. Nothing leaves the building. */
  const publish = async () => {
    setBusy("save");
    try {
      const at = new Date().toISOString();
      await sSet(`build:${slug}`, {
        at, context, slug,
        argument: out?.argument || "",
        titles: out?.titles || [],
        drafts,
      });
      setSaved(at);
    } catch (e) {
      setErr(e.message || "Could not save.");
    }
    setBusy("");
  };

  const copy = (v, tag) => {
    navigator.clipboard?.writeText(typeof v === "string" ? v : JSON.stringify(v, null, 2));
    setCopied(tag);
    setTimeout(() => setCopied(""), 1600);
  };

  const filled = CHANNELS.filter((c) => drafts[c.id]).length;

  return (
    <div>
      <Note>
        Transcript in, every channel out. Publishing here means saved and ready to paste, not sent.
      </Note>
      <Problem onDismiss={() => { setErr(""); setBlocked(null); }}>{err}</Problem>

      {/* Not a "proceed anyway" button. Each term needs its own reason, and the
          reason is recorded — because if a client name ever does reach public
          metadata, there has to be a record of what was said. */}
      {blocked && (
        <Card tint={C.blush} style={{ marginBottom: 14 }}>
          <Mono c={C.red}>Held for a reason</Mono>
          <p style={{ fontSize: 13, color: C.ink2, lineHeight: 1.5, marginTop: 8 }}>
            Say why {blocked.length > 1 ? "each of these is" : "this is"} not a client reference.
            It goes in the record with the piece.
          </p>
          {blocked.map((term) => (
            <div key={term} style={{ marginTop: 12 }}>
              <Mono s={9}>{term}</Mono>
              <div style={{ marginTop: 6 }}>
                <Field tint="rgba(255,255,255,.7)" value={reasons[term] || ""}
                  onChange={(v) => setReasons((r) => ({ ...r, [term]: v }))}
                  placeholder={`Why "${term}" is safe here`} />
              </div>
            </div>
          ))}
          <div className="flex items-center gap-2" style={{ marginTop: 14 }}>
            <Mono s={9}>
              {blocked.every((t) => (reasons[t] || "").trim().length >= 12)
                ? "Recorded on proceed" : "A sentence, not a keystroke"}
            </Mono>
            <span style={{ marginLeft: "auto" }}>
              <Pill sm danger
                disabled={!!busy || !blocked.every((t) => (reasons[t] || "").trim().length >= 12)}
                onClick={() => runMeta(blocked.map((term) => ({ term, reason: reasons[term].trim() })))}>
                {busy ? "Building…" : "Proceed"}
              </Pill>
            </span>
          </div>
        </Card>
      )}

      {!out && (
        <Card>
          <Field value={context} onChange={setContext} placeholder="Which show, which episode, who is in it" />
          <div style={{ marginTop: 10 }}>
            <Field value={source} onChange={setSource} rows={10}
              placeholder="Paste the transcript with timestamps. Under 500 words and it halts, by design." />
          </div>
          <div className="flex items-center justify-between gap-3" style={{ marginTop: 12 }}>
            <Mono s={9} c={short ? C.red : C.ink2}>
              {words} words{short ? " · under the 500 floor" : ""}
            </Mono>
            <Pill sm disabled={!!busy || words < 500} onClick={() => runMeta()}>
              {busy === "meta" ? "Reading…" : "Build it"}
            </Pill>
          </div>
          {short && (
            <p style={{ fontSize: 12.5, color: C.ink2, lineHeight: 1.45, marginTop: 10 }}>
              The floor exists because clip boundaries inferred from a title or a virality score are
              guesses. Paste the full transcript.
            </p>
          )}
        </Card>
      )}

      {busy === "meta" && !blocked && (
        <Card style={{ marginTop: 12 }}>
          <div className="lamp"><Mono c={C.red}>Reading the transcript…</Mono></div>
          <p style={{ fontSize: 12.5, color: C.ink2, marginTop: 8, lineHeight: 1.5 }}>
            It checks for client material before it writes anything. That halt is not a failure.
          </p>
        </Card>
      )}

      {out && (
        <>
          {out.argument && (
            <Card tint={C.sand} style={{ marginBottom: 14 }}>
              <Mono>The argument</Mono>
              <p style={{ fontSize: 15, color: C.ink, lineHeight: 1.5, marginTop: 8, fontWeight: 500 }}>
                {out.argument}
              </p>
            </Card>
          )}

          <Chips
            items={[["meta", "Metadata"], ...CHANNELS.map((c) => [c.id, drafts[c.id] ? `${c.label} ✓` : c.label])]}
            value={tab} onChange={setTab}
          />
          <div style={{ height: 14 }} />

          {tab === "meta" && (
            <>
              {(out.titles || []).length > 0 && (
                <Section label="Titles" right={<Mono s={9}>pick at publish</Mono>}>
                  {out.titles.map((t, i) => (
                    <Card key={i} pad={16} style={{ marginBottom: 8 }}>
                      <Mono s={9}>{(t.variant || "").toUpperCase()}</Mono>
                      <div className="flex items-start justify-between gap-3" style={{ marginTop: 5 }}>
                        <span style={{ fontSize: 15, color: C.ink, lineHeight: 1.35 }}>{t.text}</span>
                        <button onClick={() => copy(t.text, `t${i}`)} className="tap"
                          style={{ background: "none", border: "none", cursor: "pointer", color: C.ink2, flexShrink: 0, display: "flex" }}>
                          {copied === `t${i}` ? <Check size={15} strokeWidth={2.6} /> : <Copy size={15} strokeWidth={2.2} />}
                        </button>
                      </div>
                    </Card>
                  ))}
                </Section>
              )}

              {out.hook && <Block label="Hook" body={out.hook} onCopy={copy} copied={copied} tag="hook" />}

              {(out.claim_block || []).length > 0 && (
                <Block label="Claim block"
                  body={out.claim_block.map((c) => `${c.claim} — ${c.attributed_to} (${c.timestamp})`).join("\n\n")}
                  onCopy={copy} copied={copied} tag="claims" />
              )}

              {(out.chapters || []).length > 0 && (
                <Block label="Chapters" body={out.chapters.map((c) => `${c.t}  ${c.label}`).join("\n")}
                  onCopy={copy} copied={copied} tag="chapters" />
              )}

              {out.pinned_comment && (
                <Block label="Pinned comment" body={out.pinned_comment} onCopy={copy} copied={copied} tag="pin" />
              )}

              {(out.clips || []).length > 0 && (
                <Section label="Clips" style={{ marginTop: 18 }}>
                  {out.clips.map((c, i) => (
                    <Card key={i} pad={16} style={{ marginBottom: 10 }}>
                      <Mono s={9}>{c.start}–{c.end}</Mono>
                      <div style={{ fontFamily: DISPLAY, fontSize: 19, fontWeight: 800, color: C.ink, lineHeight: 1.1, marginTop: 6 }}>
                        {c.hook}
                      </div>
                      {c.why_it_carries && (
                        <p style={{ fontSize: 12.5, color: C.ink2, lineHeight: 1.45, marginTop: 5 }}>{c.why_it_carries}</p>
                      )}
                      {c.captions && (
                        <div style={{ marginTop: 10, background: "rgba(20,24,51,.03)", borderRadius: 14, padding: 12 }}>
                          {Object.entries(c.captions).map(([k, v]) => (
                            <div key={k} style={{ marginBottom: 8 }}>
                              <Mono s={8.5}>{k}</Mono>
                              <div style={{ fontSize: 13, color: C.ink, lineHeight: 1.5, marginTop: 3 }}>{v}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{ marginTop: 10 }}>
                        <Pill sm tone="ghost" icon={Copy} onClick={() => copy(c.captions || c, `clip${i}`)}>
                          {copied === `clip${i}` ? "Copied" : "Copy captions"}
                        </Pill>
                      </div>
                    </Card>
                  ))}
                </Section>
              )}

              {(out.threads_back_to || []).length > 0 && (
                <Section label="Threads back to" style={{ marginTop: 18 }}>
                  {out.threads_back_to.map((t, i) => (
                    <Card key={i} pad={14} accent={C.red} style={{ marginBottom: 8 }}>
                      <Mono s={9} c={C.red}>{(t.relationship || "").toUpperCase()}</Mono>
                      <div style={{ fontSize: 13.5, color: C.ink, marginTop: 4, lineHeight: 1.4 }}>{t.title}</div>
                      {t.note && <p style={{ fontSize: 12.5, color: C.ink2, marginTop: 4, lineHeight: 1.45 }}>{t.note}</p>}
                    </Card>
                  ))}
                </Section>
              )}
            </>
          )}

          {CHANNELS.map((ch) => tab === ch.id && (
            <div key={ch.id}>
              <div style={{ padding: "0 4px 10px" }}><Mono s={9}>{ch.note}</Mono></div>

              {!drafts[ch.id] && busy !== ch.id && (
                <>
                  <Empty>Nothing written for {ch.label} yet.</Empty>
                  <div style={{ marginTop: 12 }}>
                    <Pill full disabled={!!busy} onClick={() => runChannel(ch.id)}>Write the {ch.label} version</Pill>
                  </div>
                </>
              )}

              {busy === ch.id && (
                <Card><div className="lamp"><Mono c={C.red}>Writing…</Mono></div></Card>
              )}

              {drafts[ch.id] && busy !== ch.id && (
                <>
                  <Card pad={16}>
                    <textarea
                      value={drafts[ch.id]}
                      onChange={(e) => setDrafts((d) => ({ ...d, [ch.id]: e.target.value }))}
                      rows={ch.id === "substack" ? 16 : 11}
                      style={{
                        width: "100%", background: "transparent", border: "none", outline: "none",
                        resize: "none", fontFamily: BODY, fontSize: 14.5, color: C.ink, lineHeight: 1.65,
                      }}
                    />
                    <div className="flex items-center justify-between gap-3" style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(20,24,51,.07)" }}>
                      <Mono s={9}>
                        {drafts[ch.id].trim().split(/\s+/).length} words · {drafts[ch.id].length} chars
                      </Mono>
                      <Pill sm tone="ghost" icon={Copy} onClick={() => copy(drafts[ch.id], ch.id)}>
                        {copied === ch.id ? "Copied" : "Copy"}
                      </Pill>
                    </div>
                  </Card>

                  {/* Feedback rewrites this channel only. The argument is fixed,
                      so a note cannot drift the piece away from itself. */}
                  <Card tint={C.sand} style={{ marginTop: 10 }}>
                    <Mono>Change it</Mono>
                    <div style={{ marginTop: 8 }}>
                      <Field tint="rgba(255,255,255,.7)" value={notes[ch.id] || ""}
                        onChange={(v) => setNotes((n) => ({ ...n, [ch.id]: v }))}
                        onEnter={() => notes[ch.id]?.trim() && runChannel(ch.id, notes[ch.id].trim())}
                        placeholder="Too long. Lead with the margin point. Less of a summary." />
                    </div>
                    <div className="flex gap-2" style={{ marginTop: 10 }}>
                      <Pill sm disabled={!!busy || !notes[ch.id]?.trim()}
                        onClick={() => runChannel(ch.id, notes[ch.id].trim())}>
                        Rewrite
                      </Pill>
                      <Pill sm tone="ghost" icon={RotateCcw} disabled={!!busy}
                        onClick={() => runChannel(ch.id)}>
                        Start again
                      </Pill>
                    </div>
                  </Card>
                </>
              )}
            </div>
          ))}

          <Card tint={filled ? C.mint : C.card} style={{ marginTop: 18 }}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <Mono>{filled} of {CHANNELS.length} written</Mono>
                {saved && <div style={{ marginTop: 4 }}><Mono s={9}>Saved {new Date(saved).toLocaleString("en-GB")}</Mono></div>}
              </div>
              <Pill sm icon={Save} disabled={!filled || !!busy} onClick={publish}>
                {busy === "save" ? "Saving…" : "Publish"}
              </Pill>
            </div>
            <p style={{ fontSize: 12.5, color: C.ink2, lineHeight: 1.5, marginTop: 10 }}>
              Publishing saves this episode's copy against its own key. Nothing is sent — copy each
              channel out when you post it.
            </p>
          </Card>

          <div style={{ marginTop: 14 }}>
            <Pill full tone="ghost" onClick={() => { setOut(null); setSource(""); setDrafts({}); setTab("meta"); }}>
              Build another
            </Pill>
          </div>
        </>
      )}
    </div>
  );
}

function Block({ label, body, onCopy, copied, tag }) {
  if (!body) return null;
  return (
    <Card pad={16} style={{ marginBottom: 10 }}>
      <Mono>{label}</Mono>
      <pre style={{ margin: "8px 0 0", whiteSpace: "pre-wrap", fontFamily: BODY, fontSize: 14, lineHeight: 1.6, color: C.ink }}>
        {body}
      </pre>
      <div className="flex items-center justify-between" style={{ marginTop: 12 }}>
        <Mono s={9}>{String(body).length} chars</Mono>
        <Pill sm tone="ghost" icon={Copy} onClick={() => onCopy(body, tag)}>
          {copied === tag ? "Copied" : "Copy"}
        </Pill>
      </div>
    </Card>
  );
}
