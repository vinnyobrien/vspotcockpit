import React, { useState } from "react";
import { Copy, Check, AlertTriangle } from "lucide-react";
import {
  C, BODY, DISPLAY, MONO, Mono, Big, Card, Section, Pill, Field, Note,
  Empty, Problem, Chips, parseObject,
} from "../lib/ui.jsx";
import { callOp } from "../api.js";

/* ============================================================
   src/rooms/Build.jsx

   Live: op "metadata" — the same op the old clip desk used.

   It names the argument first. If that cannot be written in one
   sentence there is no episode, and the guardrail in
   claude-background halts anything under 500 words or containing
   client material. Both of those are features.
   ============================================================ */

const CHANNELS = [
  { id: "linkedin", label: "LinkedIn" },
  { id: "substack", label: "Substack" },
  { id: "youtube", label: "YouTube" },
  { id: "spotify", label: "Spotify" },
  { id: "clips", label: "Clips" },
];

export default function Build() {
  const [context, setContext] = useState("");
  const [source, setSource] = useState("");
  const [out, setOut] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  /* Set when the confidentiality guardrail halts. Holds the terms it caught,
     so the reason field is per term rather than a blanket "proceed anyway". */
  const [blocked, setBlocked] = useState(null);
  const [reasons, setReasons] = useState({});
  const [ch, setCh] = useState("linkedin");
  const [copied, setCopied] = useState("");

  const words = source.trim() ? source.trim().split(/\s+/).length : 0;
  const short = words > 0 && words < 500;

  const run = async (overrides) => {
    setBusy(true);
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
    } catch (e) {
      setErr(e.message || "The build failed.");
      // The job carries the caught terms on a confidentiality halt, so the
      // reason field can name them rather than offering a blanket override.
      if (e.blocked?.length) setBlocked(e.blocked);
    }
    setBusy(false);
  };

  const copy = (v, tag) => {
    navigator.clipboard?.writeText(typeof v === "string" ? v : JSON.stringify(v, null, 2));
    setCopied(tag);
    setTimeout(() => setCopied(""), 1600);
  };

  return (
    <div>
      <Note>
        Transcript in, every channel out. It names the argument first — if that cannot be written in
        one sentence, there is no episode.
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
                <Field
                  tint="rgba(255,255,255,.7)"
                  value={reasons[term] || ""}
                  onChange={(v) => setReasons((r) => ({ ...r, [term]: v }))}
                  placeholder={`Why "${term}" is safe here`}
                />
              </div>
            </div>
          ))}
          <div className="flex items-center gap-2" style={{ marginTop: 14 }}>
            <Mono s={9}>
              {blocked.every((t) => (reasons[t] || "").trim().length >= 12)
                ? "Recorded on proceed"
                : "A sentence, not a keystroke"}
            </Mono>
            <span style={{ marginLeft: "auto" }}>
              <Pill sm danger
                disabled={busy || !blocked.every((t) => (reasons[t] || "").trim().length >= 12)}
                onClick={() => run(blocked.map((term) => ({ term, reason: reasons[term].trim() })))}>
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
            <Pill sm disabled={busy || words < 500} onClick={run}>
              {busy ? "Building…" : "Build it"}
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

      {busy && (
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
            <Card tint={C.sand} style={{ marginBottom: 16 }}>
              <Mono>The argument</Mono>
              <p style={{ fontSize: 15, color: C.ink, lineHeight: 1.5, marginTop: 8, fontWeight: 500 }}>
                {out.argument}
              </p>
            </Card>
          )}

          {(out.titles || []).length > 0 && (
            <Section label="Titles" right={<Mono s={9}>pick at publish</Mono>}>
              {out.titles.map((t, i) => (
                <Card key={i} pad={16} style={{ marginBottom: 8 }}>
                  <Mono s={9}>{(t.variant || "").toUpperCase()}</Mono>
                  <div style={{ fontSize: 15, color: C.ink, lineHeight: 1.35, marginTop: 5 }}>{t.text}</div>
                </Card>
              ))}
            </Section>
          )}

          <Chips items={CHANNELS.map((c) => [c.id, c.label])} value={ch} onChange={setCh} />
          <div style={{ height: 14 }} />

          {ch === "linkedin" && <Text body={out.linkedin || out.description?.hook} onCopy={copy} copied={copied} tag="li" />}
          {ch === "substack" && <Text body={out.substack} onCopy={copy} copied={copied} tag="ss" />}

          {ch === "youtube" && (
            <>
              {out.description?.hook && <Text label="Hook" body={out.description.hook} onCopy={copy} copied={copied} tag="hook" />}
              {(out.description?.claim_block || []).length > 0 && (
                <Text label="Claim block"
                  body={out.description.claim_block.map((c) => `${c.claim} — ${c.attributed_to} (${c.timestamp})`).join("\n\n")}
                  onCopy={copy} copied={copied} tag="claims" />
              )}
              {(out.description?.chapters || []).length > 0 && (
                <Text label="Chapters"
                  body={out.description.chapters.map((c) => `${c.t}  ${c.label}`).join("\n")}
                  onCopy={copy} copied={copied} tag="chapters" />
              )}
              {out.pinned_comment && <Text label="Pinned comment" body={out.pinned_comment} onCopy={copy} copied={copied} tag="pin" />}
            </>
          )}

          {ch === "spotify" && <Text body={out.spotify || out.description?.hook} onCopy={copy} copied={copied} tag="sp" />}

          {ch === "clips" && (
            <>
              {(out.clips || []).map((c, i) => (
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
            </>
          )}

          {(out.threads_back_to || []).length > 0 && (
            <Section label="Threads back to" style={{ marginTop: 20 }}>
              {out.threads_back_to.map((t, i) => (
                <Card key={i} pad={14} accent={C.red} style={{ marginBottom: 8 }}>
                  <Mono s={9} c={C.red}>{(t.relationship || "").toUpperCase()}</Mono>
                  <div style={{ fontSize: 13.5, color: C.ink, marginTop: 4, lineHeight: 1.4 }}>{t.title}</div>
                </Card>
              ))}
            </Section>
          )}

          <div style={{ marginTop: 18 }}>
            <Pill full tone="ghost" onClick={() => { setOut(null); setSource(""); }}>Build another</Pill>
          </div>
        </>
      )}
    </div>
  );
}

function Text({ label, body, onCopy, copied, tag }) {
  if (!body) return <Empty>Nothing generated for this channel.</Empty>;
  return (
    <Card pad={16} style={{ marginBottom: 10 }}>
      {label && <div style={{ marginBottom: 8 }}><Mono>{label}</Mono></div>}
      <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: BODY, fontSize: 14, lineHeight: 1.6, color: C.ink }}>
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
