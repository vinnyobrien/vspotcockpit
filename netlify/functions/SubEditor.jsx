import React, { useState, useMemo, useCallback } from "react";
import { AlertTriangle, Check, Plus, X, Scale, Search, Flag } from "lucide-react";
import {
  C, BODY, MONO, DISPLAY, SH, Mono, Big, Card, Section, Pill, Field, Note,
  Empty, Problem, Chips, iso, parseObject,
} from "../lib/ui.jsx";
import { callOp, sGet, sSet } from "../api.js";

/* ============================================================
   src/rooms/SubEditor.jsx

   The role the desk was missing. Everything goes through here
   before it leaves.

   Three jobs, in cost order:

   1. VOICE — deterministic, instant, free. Em-dashes, stock
      phrases, sentence rhythm. No model call, because a machine
      checking for machine writing is a slow way to count commas.

   2. CLAIMS — every factual assertion gets a source and a tier.
      Inferences are the dangerous ones: they read like facts.

   3. CONTRADICTION — does this argue against something already
      published? Not a block. Changing your mind is allowed and
      often the point. It just has to be marked, because an
      unmarked reversal reads as not having noticed.
   ============================================================ */

const TELLS = [
  [/\bdelve\b/gi, "delve"], [/\btapestry\b/gi, "tapestry"],
  [/\bin today's (fast-paced|ever-changing|digital)\b/gi, "in today's fast-paced"],
  [/\bit'?s worth noting\b/gi, "it's worth noting"],
  [/\bit'?s important to (note|remember|understand)\b/gi, "it's important to note"],
  [/\bmoreover\b/gi, "moreover"], [/\bfurthermore\b/gi, "furthermore"],
  [/\bin conclusion\b/gi, "in conclusion"], [/\blet'?s (dive|explore)\b/gi, "let's dive in"],
  [/\bgame[- ]chang(er|ing)\b/gi, "game-changer"], [/\bleverag(e|ing)\b/gi, "leverage"],
  [/\bnavigat(e|ing) the (complex|ever)\b/gi, "navigating the complex"],
  [/\bunlock(ing)? the (power|potential)\b/gi, "unlock the potential"],
  [/\bat the end of the day\b/gi, "at the end of the day"],
  [/\bnot only\b[^.]{0,80}\bbut also\b/gi, "not only… but also"],
  [/\brobust\b/gi, "robust"], [/\bseamless(ly)?\b/gi, "seamless"],
  [/\bcrucial\b/gi, "crucial"], [/\bvital\b/gi, "vital"],
  [/\bthat said,/gi, "that said,"], [/\bultimately,/gi, "ultimately,"],
  [/\bthe reality is\b/gi, "the reality is"], [/\bwhen it comes to\b/gi, "when it comes to"],
  [/\bplays a (key|vital|crucial) role\b/gi, "plays a key role"],
  [/\bin the realm of\b/gi, "in the realm of"], [/\ba testament to\b/gi, "a testament to"],
];

export function analyse(text) {
  const t = String(text || "");
  const words = t.trim().split(/\s+/).filter(Boolean);
  const sentences = t.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 1);
  const paras = t.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const flags = [];
  let penalty = 0;

  const em = (t.match(/—/g) || []).length;
  if (em) {
    flags.push({ sev: 3, t: `${em} em-dash${em > 1 ? "es" : ""}`, w: "House rule is none, ever. The single clearest tell." });
    penalty += Math.min(30, em * 12);
  }

  const hits = [];
  TELLS.forEach(([re, label]) => { const m = t.match(re); if (m) hits.push([label, m.length]); });
  if (hits.length) {
    const n = hits.reduce((s, [, c]) => s + c, 0);
    flags.push({ sev: 3, t: `${n} stock phrase${n > 1 ? "s" : ""}`, w: hits.map(([l, c]) => (c > 1 ? `${l} ×${c}` : l)).join(", ") });
    penalty += Math.min(55, n * 5);
  }

  // Uniform sentence length is the deepest tell. People vary; models do not.
  const lens = sentences.map((s) => s.split(/\s+/).length);
  const mean = lens.reduce((a, b) => a + b, 0) / (lens.length || 1);
  const sd = Math.sqrt(lens.reduce((a, b) => a + (b - mean) ** 2, 0) / (lens.length || 1));
  const cv = mean ? sd / mean : 0;
  if (sentences.length >= 4 && cv < 0.42) {
    flags.push({ sev: 2, t: "Sentences too even", w: `Average ${Math.round(mean)} words, variation ${Math.round(cv * 100)}%. Under 42% reads machined. Break one in three.` });
    penalty += 16;
  }

  const openers = paras.map((p) => p.split(/\s+/)[0].toLowerCase().replace(/[^a-z]/g, ""));
  const dupes = openers.filter((o, i) => openers.indexOf(o) !== i && o.length > 2);
  if (dupes.length >= 2) {
    flags.push({ sev: 1, t: "Paragraphs open the same way", w: `"${[...new Set(dupes)].join('", "')}" repeats.` });
    penalty += 8;
  }

  const hedges = (t.match(/\b(may|might|could|perhaps|possibly|arguably|somewhat|relatively|fairly)\b/gi) || []).length;
  if (words.length && (hedges / words.length) * 1000 > 12) {
    flags.push({ sev: 2, t: "Hedged into mush", w: `${hedges} hedges in ${words.length} words. State it or cut it.` });
    penalty += 14;
  }

  const tri = (t.match(/\b\w+,\s\w+,?\sand\s\w+\b/g) || []).length;
  if (tri >= 3) {
    flags.push({ sev: 1, t: `${tri} lists of three`, w: "Three-part lists are a model habit. Use two, or four." });
    penalty += 7;
  }

  const ly = (t.match(/\b\w+ly\b/gi) || []).length;
  if (words.length > 150 && (ly / words.length) * 100 > 3.2) {
    flags.push({ sev: 1, t: "Adverb-heavy", w: `${ly} words ending -ly. Usually a weak verb wearing a hat.` });
    penalty += 7;
  }

  return {
    flags, score: Math.max(0, 100 - penalty),
    words: words.length, sentences: sentences.length,
    mean: Math.round(mean), cv: Math.round(cv * 100),
  };
}

const TIERS = {
  primary:  { label: "Primary",   c: C.ink,  w: "Filing, transcript, the company itself." },
  official: { label: "Official",  c: C.ink2, w: "Press release, earnings call, regulator." },
  trade:    { label: "Trade",     c: C.ink2, w: "Reported by a publication you rate." },
  aggregate:{ label: "Aggregator",c: C.red,  w: "Someone repeating someone. Weakest link." },
  inferred: { label: "Inferred",  c: C.red,  w: "Yours, not theirs. Say so, or it reads as fact." },
};

export default function SubEditor({ threads, ledger, K }) {
  const [tab, setTab] = useState("check");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [read, setRead] = useState(null);
  const [claims, setClaims] = useState([]);
  const [loaded, setLoaded] = useState(false);

  React.useEffect(() => {
    (async () => { setClaims(await sGet("claims", [])); setLoaded(true); })();
  }, []);

  const saveClaims = (next) => { setClaims(next); sSet("claims", next); };
  const voice = useMemo(() => analyse(text), [text]);

  /* The expensive half. Contradiction, missing angle, and the claims that
     need a source — all in one call, because three calls is three waits. */
  const runRead = useCallback(async () => {
    if (!text.trim()) return;
    setBusy("read"); setErr(""); setRead(null);
    try {
      const archive = ledger.slice(0, 40).map((l) => `${l.date} · ${l.title}: ${l.gist || ""}`).join("\n");
      const threadList = threads.map((t) => `${t.name}: ${t.note}${t.last ? ` (last ${t.last})` : " (never run)"}`).join("\n");
      const r = await callOp({
        op: "desk",
        extra: "SUB-EDITOR PASS",
        draft: text.slice(0, 18000),
        archive: `PUBLISHED ARCHIVE:\n${archive}\n\nRUNNING THREADS:\n${threadList}`,
        history: [{
          role: "user",
          content:
`Act as sub-editor on the draft. Return ONLY JSON, no preamble:

{
  "claims": [{ "claim": "", "tier": "primary|official|trade|aggregate|inferred", "why": "" }],
  "contradictions": [{ "now": "", "before": "", "where": "", "reading": "" }],
  "missing": [{ "angle": "", "why": "" }],
  "verdict": ""
}

claims: every factual assertion a reader could check. Tier honestly — if the
draft states something as fact that is actually Vinny's inference, tier it
"inferred". That is the failure mode that costs credibility.

contradictions: where this argues against something in the archive. Changing
position is allowed and often the point. "reading" says how it lands unmarked —
whether it looks like a considered reversal or like he forgot.

missing: at most two. The angle a reader who knows the archive would expect and
does not find. Not general improvements.

verdict: one sentence. Blunt.` }],
      });
      setRead(parseObject(r.text));
    } catch (e) {
      setErr(e.message || "The read did not come back.");
    }
    setBusy("");
  }, [text, ledger, threads]);

  const addClaim = (c) => {
    saveClaims([{
      id: Math.random().toString(36).slice(2),
      claim: c.claim, tier: c.tier || "inferred", why: c.why || "",
      source: "", checked: "", date: iso(new Date()), status: "open",
    }, ...claims]);
  };
  const patchClaim = (id, p) => saveClaims(claims.map((c) => (c.id === id ? { ...c, ...p } : c)));
  const dropClaim = (id) => saveClaims(claims.filter((c) => c.id !== id));

  const open = claims.filter((c) => c.status === "open");
  const band = voice.score >= 85 ? { c: C.ink, t: "Reads like you" }
    : voice.score >= 65 ? { c: "#A8761A", t: "Some tells" }
    : { c: C.red, t: "Reads machine-written" };

  return (
    <div>
      <Note>Everything goes through here before it leaves. Voice is checked instantly; the rest costs a call.</Note>
      <Problem onDismiss={() => setErr("")}>{err}</Problem>

      <Chips items={[["check", "The read"], ["claims", `Claims${open.length ? ` · ${open.length}` : ""}`]]} value={tab} onChange={setTab} />
      <div style={{ height: 14 }} />

      {tab === "check" && (
        <>
          <Card style={{ marginBottom: 14 }}>
            <Field value={text} onChange={setText} rows={10} placeholder="Paste the draft. Anything going out." />
            <div className="flex items-center justify-between gap-3" style={{ marginTop: 12 }}>
              <Mono s={9}>{voice.words} words · {voice.sentences} sentences</Mono>
              <Pill sm disabled={!text.trim() || !!busy} onClick={runRead}>
                {busy === "read" ? "Reading…" : "Full read"}
              </Pill>
            </div>
          </Card>

          {text.trim() && (
            <Card tint={voice.score >= 85 ? C.mint : voice.score >= 65 ? C.sand : C.blush} style={{ marginBottom: 14 }}>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <Mono>Voice</Mono>
                  <div style={{ marginTop: 4 }}><Big s={42} c={band.c}>{voice.score}</Big></div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <Mono s={9.5} c={band.c}>{band.t}</Mono>
                  <div style={{ marginTop: 3 }}><Mono s={9}>avg {voice.mean}w · var {voice.cv}%</Mono></div>
                </div>
              </div>
              {voice.flags.length === 0 && (
                <p style={{ fontSize: 13, color: C.ink2, lineHeight: 1.5, marginTop: 10 }}>
                  Nothing caught. Rhythm varies, no stock phrases, no em-dashes.
                </p>
              )}
              {voice.flags.map((f, i) => (
                <div key={i} className="flex items-start gap-2.5" style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(20,24,51,.09)" }}>
                  <span style={{ width: 7, height: 7, borderRadius: 999, marginTop: 6, flexShrink: 0,
                    background: f.sev === 3 ? C.red : f.sev === 2 ? "#A8761A" : C.ink3 }} />
                  <div>
                    <div style={{ fontSize: 13.5, color: C.ink, fontWeight: 600 }}>{f.t}</div>
                    <p style={{ fontSize: 12.5, color: C.ink2, lineHeight: 1.45, marginTop: 3 }}>{f.w}</p>
                  </div>
                </div>
              ))}
            </Card>
          )}

          {busy === "read" && (
            <Card><div className="lamp"><Mono c={C.red}>Reading against the archive…</Mono></div></Card>
          )}

          {read && (
            <>
              {read.verdict && (
                <Card tint={C.ink} style={{ marginBottom: 14 }}>
                  <Mono c={C.sand}>Verdict</Mono>
                  <p style={{ fontSize: 15, color: "#fff", lineHeight: 1.5, marginTop: 8 }}>{read.verdict}</p>
                </Card>
              )}

              {(read.contradictions || []).length > 0 && (
                <Section label="Against the record" right={<Mono c={C.red}>{read.contradictions.length}</Mono>}>
                  {read.contradictions.map((c, i) => (
                    <Card key={i} pad={16} accent={C.red} style={{ marginBottom: 9 }}>
                      <div style={{ fontSize: 14, color: C.ink, fontWeight: 600, lineHeight: 1.4 }}>{c.now}</div>
                      <p style={{ fontSize: 13, color: C.ink2, lineHeight: 1.5, marginTop: 6 }}>
                        Previously: {c.before}{c.where ? ` · ${c.where}` : ""}
                      </p>
                      {c.reading && (
                        <p style={{ fontSize: 12.5, color: C.ink, lineHeight: 1.5, marginTop: 8, paddingTop: 8, borderTop: "1px solid rgba(20,24,51,.09)" }}>
                          {c.reading}
                        </p>
                      )}
                      <div className="flex gap-2" style={{ marginTop: 12 }}>
                        <Pill sm tone="ghost" onClick={() => setText(
                          `As we covered previously, ${c.before} That is not where I have landed now, and it is worth saying why.\n\n` + text
                        )}>Mark the change</Pill>
                      </div>
                    </Card>
                  ))}
                  <p style={{ fontSize: 12.5, color: C.ink2, lineHeight: 1.5, padding: "2px 6px" }}>
                    Changing position is allowed and often the point. Unmarked, it reads as not having noticed.
                  </p>
                </Section>
              )}

              {(read.missing || []).length > 0 && (
                <Section label="You should be talking about">
                  {read.missing.map((m, i) => (
                    <Card key={i} pad={16} tint={C.sand} style={{ marginBottom: 9 }}>
                      <div style={{ fontSize: 14, color: C.ink, fontWeight: 600, lineHeight: 1.4 }}>{m.angle}</div>
                      <p style={{ fontSize: 12.5, color: C.ink2, lineHeight: 1.5, marginTop: 5 }}>{m.why}</p>
                    </Card>
                  ))}
                </Section>
              )}

              {(read.claims || []).length > 0 && (
                <Section label="Claims to stand behind" right={<Mono>{read.claims.length}</Mono>}>
                  {read.claims.map((c, i) => {
                    const tier = TIERS[c.tier] || TIERS.inferred;
                    return (
                      <Card key={i} pad={16} accent={tier.c} style={{ marginBottom: 9 }}>
                        <div className="flex items-start justify-between gap-3">
                          <span style={{ fontSize: 13.5, color: C.ink, lineHeight: 1.45, flex: 1 }}>{c.claim}</span>
                          <Mono s={8.5} c={tier.c}>{tier.label}</Mono>
                        </div>
                        {c.why && <p style={{ fontSize: 12, color: C.ink2, lineHeight: 1.45, marginTop: 6 }}>{c.why}</p>}
                        <div style={{ marginTop: 10 }}>
                          <Pill sm tone="ghost" icon={Plus} onClick={() => addClaim(c)}>Log it</Pill>
                        </div>
                      </Card>
                    );
                  })}
                </Section>
              )}
            </>
          )}
        </>
      )}

      {tab === "claims" && (
        <>
          <Note>Every claim that has left the building, and what it rests on. Inferences are the ones to watch.</Note>
          {!loaded && <Mono>Loading…</Mono>}
          {loaded && !claims.length && <Empty>Nothing logged. Run a read and log what it finds.</Empty>}
          {claims.map((c) => {
            const tier = TIERS[c.tier] || TIERS.inferred;
            return (
              <Card key={c.id} pad={16} accent={c.status === "verified" ? C.ink : tier.c} style={{ marginBottom: 10 }}>
                <div className="flex items-start justify-between gap-3">
                  <span style={{ fontSize: 13.5, color: C.ink, lineHeight: 1.45, flex: 1 }}>{c.claim}</span>
                  <button onClick={() => dropClaim(c.id)} className="tap"
                    style={{ background: "none", border: "none", cursor: "pointer", color: C.ink3, flexShrink: 0, display: "flex" }}>
                    <X size={13} strokeWidth={2.4} />
                  </button>
                </div>

                <div className="sc flex gap-1.5" style={{ overflowX: "auto", marginTop: 10 }}>
                  {Object.entries(TIERS).map(([k, v]) => (
                    <button key={k} onClick={() => patchClaim(c.id, { tier: k })} className="tap"
                      style={{
                        flexShrink: 0, fontFamily: BODY, fontSize: 11, fontWeight: c.tier === k ? 600 : 500,
                        padding: "6px 11px", borderRadius: 999, cursor: "pointer",
                        background: c.tier === k ? C.ink : "transparent",
                        color: c.tier === k ? "#fff" : C.ink2,
                        border: c.tier === k ? "none" : "1.5px solid rgba(20,24,51,.14)",
                      }}>{v.label}</button>
                  ))}
                </div>
                <div style={{ marginTop: 6 }}><Mono s={8.5}>{tier.w}</Mono></div>

                <div style={{ marginTop: 10 }}>
                  <Field value={c.source} onChange={(v) => patchClaim(c.id, { source: v })}
                    placeholder="Where it came from — URL, filing, transcript timestamp" />
                </div>

                <div className="flex gap-2" style={{ marginTop: 10 }}>
                  <Pill sm tone={c.status === "verified" ? "solid" : "ghost"} icon={Check}
                    onClick={() => patchClaim(c.id, { status: c.status === "verified" ? "open" : "verified", checked: iso(new Date()) })}>
                    {c.status === "verified" ? `Checked ${c.checked}` : "Mark checked"}
                  </Pill>
                  {c.status !== "verified" && !c.source && <Mono s={9} c={C.red}>No source yet</Mono>}
                </div>
              </Card>
            );
          })}
        </>
      )}
    </div>
  );
}
