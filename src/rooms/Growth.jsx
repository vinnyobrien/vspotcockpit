import React, { useState } from "react";
import { Lock, Send, Check, ChevronLeft, ExternalLink, Plus } from "lucide-react";
import {
  C, BODY, DISPLAY, MONO, SH, SH_UP, R, Mono, Big, Card, Section, Pill,
  Field, Note, Empty, Problem, Confirm, iso, daysSince,
} from "../lib/ui.jsx";
import { callOp } from "../api.js";

/* ============================================================
   src/rooms/Growth.jsx

   The Approach, end to end. Brief → build → preview → send →
   reply → close.

   The order matters and is the whole method: build the asset
   first, then write the email around it. A microsite can absorb
   feedback in a minute, which is a different commercial
   instrument to a PDF someone has to reject.
   ============================================================ */

const STEPS = ["Brief", "Build", "Preview", "Send", "Reply", "Close"];
const STATUS = ["built", "sent", "won", "declined"];

export default function Growth({ assets, setAssets, sSet, K, today, onGenerate, busy }) {
  const [pack, setPack] = useState(false);
  const save = (n) => { setAssets(n); sSet(K.assets, n); };

  if (pack) return <Pack back={() => setPack(false)} assets={assets} save={save} today={today} />;

  const add = (name) => {
    if (!name.trim()) return;
    save([{ id: Math.random().toString(36).slice(2), name: name.trim(), url: "", status: "built", camp: false, touched: iso(today) }, ...assets]);
  };
  const patch = (id, p) => save(assets.map((a) => (a.id === id ? { ...a, ...p, touched: iso(today) } : a)));

  return (
    <div>
      <Note>Build the asset first, then send it. That order is the method, not a preference.</Note>

      <Card tint={C.apricot} style={{ marginBottom: 18, border: `2px solid ${C.red}` }}>
        <Mono c={C.red}>Priority this month</Mono>
        <div style={{ marginTop: 8 }}><Big s={26}>THE APPROACH</Big></div>
        <p style={{ fontSize: 13.5, color: C.ink2, marginTop: 8, lineHeight: 1.5 }}>
          Say what you want out of it. It builds a microsite, drafts the email, takes the changes,
          then turns the agreed version into a signable proposal.
        </p>
        <div style={{ marginTop: 14 }}><Pill full onClick={() => setPack(true)}>Start a pack</Pill></div>
      </Card>

      <Section label={`Prospects · ${assets.length}`}>
        <AddRow onAdd={add} />
        {assets.length === 0 && <Empty>Nothing tracked. The Salesfire piece worked because it existed before the conversation did.</Empty>}
        {assets.map((a) => {
          const d = daysSince(a.touched, today);
          return (
            <Card key={a.id} pad={16} accent={a.camp ? C.red : a.status === "won" ? C.ink : undefined} style={{ marginBottom: 9 }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div style={{ fontSize: 15.5, fontWeight: 600, color: C.ink, lineHeight: 1.3 }}>{a.name}</div>
                  <div style={{ marginTop: 3 }}><Mono s={9}>{d === 0 ? "today" : `${d}d ago`}</Mono></div>
                </div>
                {a.url && (
                  <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ color: C.ink2, flexShrink: 0 }}>
                    <ExternalLink size={16} strokeWidth={2.2} />
                  </a>
                )}
              </div>
              <div className="sc flex gap-1.5" style={{ overflowX: "auto", marginTop: 11 }}>
                {STATUS.map((s) => (
                  <button key={s} onClick={() => patch(a.id, { status: s })} className="tap"
                    style={{
                      flexShrink: 0, fontFamily: BODY, fontSize: 11.5, fontWeight: a.status === s ? 600 : 500,
                      padding: "7px 12px", borderRadius: 999, cursor: "pointer",
                      background: a.status === s ? C.ink : "transparent",
                      color: a.status === s ? "#fff" : C.ink2,
                      border: a.status === s ? "none" : "1.5px solid rgba(20,24,51,.14)",
                    }}>{s}</button>
                ))}
                <button onClick={() => patch(a.id, { camp: !a.camp })} className="tap"
                  style={{
                    flexShrink: 0, marginLeft: "auto", fontFamily: BODY, fontSize: 11.5, fontWeight: 600,
                    padding: "7px 12px", borderRadius: 999, cursor: "pointer",
                    background: a.camp ? C.red : "transparent", color: a.camp ? "#fff" : C.ink2,
                    border: a.camp ? "none" : "1.5px solid rgba(20,24,51,.14)",
                  }}>Camp Tralee</button>
              </div>
            </Card>
          );
        })}
      </Section>
    </div>
  );
}

function AddRow({ onAdd }) {
  const [v, setV] = useState("");
  return (
    <Card style={{ marginBottom: 12 }}>
      <div className="flex gap-2">
        <div style={{ flex: 1, minWidth: 0 }}>
          <Field value={v} onChange={setV} onEnter={() => { onAdd(v); setV(""); }} placeholder="Prospect, and what you built them" />
        </div>
        <Pill icon={Plus} disabled={!v.trim()} onClick={() => { onAdd(v); setV(""); }}>Add</Pill>
      </div>
    </Card>
  );
}

/* ---------- the pack ---------- */

function Pack({ back, assets, save, today }) {
  const [step, setStep] = useState(0);
  const [prospect, setProspect] = useState("");
  const [aim, setAim] = useState("");
  const [copy, setCopy] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [augmented, setAugmented] = useState(false);

  const build = async () => {
    setBusy(true);
    setErr("");
    try {
      const r = await callOp({ op: "generate", kind: "sponsor", extra: `${prospect}. ${aim}` });
      setCopy(r.text);
      setStep(2);
    } catch (e) {
      setErr(e.message || "Could not build the pack.");
    }
    setBusy(false);
  };

  const record = () => {
    save([{
      id: Math.random().toString(36).slice(2), name: prospect, url: "",
      status: "sent", camp: /camp|tralee/i.test(aim), touched: iso(today),
    }, ...assets]);
    setStep(4);
  };

  return (
    <div>
      <button onClick={back} className="tap flex items-center gap-1.5"
        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: C.ink2, marginBottom: 16 }}>
        <ChevronLeft size={17} strokeWidth={2.4} /><span style={{ fontSize: 13.5, fontWeight: 500 }}>Growth</span>
      </button>

      <div className="flex items-center gap-1" style={{ marginBottom: 20 }}>
        {STEPS.map((s, i) => (
          <div key={s} style={{ flex: 1 }}>
            <div style={{ height: 4, borderRadius: 999, background: i <= step ? C.ink : "rgba(20,24,51,.1)" }} />
            <div style={{ marginTop: 6, textAlign: "center" }}><Mono s={8} c={i === step ? C.ink : C.ink2}>{s}</Mono></div>
          </div>
        ))}
      </div>

      <Problem onDismiss={() => setErr("")}>{err}</Problem>

      {step === 0 && (
        <>
          <Note>Say what you want out of it. Not the format — the outcome.</Note>
          <Card>
            <Mono>Prospect</Mono>
            <div style={{ marginTop: 8 }}><Field value={prospect} onChange={setProspect} placeholder="Who" /></div>
            <div style={{ marginTop: 16 }}><Mono>What you want to achieve</Mono></div>
            <div style={{ marginTop: 8 }}>
              <Field value={aim} onChange={setAim} rows={5}
                placeholder="The outcome, the framing, who it's aimed at, and what you will not concede." />
            </div>
            <div style={{ marginTop: 14 }}>
              <Pill full disabled={!prospect.trim() || !aim.trim()} onClick={() => setStep(1)}>Next</Pill>
            </div>
          </Card>
        </>
      )}

      {step === 1 && (
        <>
          <Note>Assembling from what the Cockpit already knows. Nothing here comes from memory.</Note>
          <Card>
            {[
              ["Audience", "Pulled from what has actually shipped"],
              ["Formats", "From the show record"],
              ["Rate card", "Current commercial terms"],
              ["Proof", "Episodes that ran their category"],
              ["The line", "Whatever you said you will not concede"],
            ].map(([k, v], i) => (
              <div key={k} className="flex items-start gap-3" style={{ padding: "12px 0", borderTop: i ? "1px solid rgba(20,24,51,.07)" : "none" }}>
                <span style={{ width: 21, height: 21, borderRadius: 999, background: C.ink, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", marginTop: 1 }}>
                  <Check size={12} strokeWidth={3} color="#fff" />
                </span>
                <div className="min-w-0">
                  <div style={{ fontSize: 14.5, color: C.ink, fontWeight: 500 }}>{k}</div>
                  <div style={{ marginTop: 2 }}><Mono s={9}>{v}</Mono></div>
                </div>
              </div>
            ))}
            <div style={{ marginTop: 16 }}>
              <Pill full disabled={busy} onClick={build}>{busy ? "Building…" : "Build the pack"}</Pill>
            </div>
          </Card>
        </>
      )}

      {step === 2 && (
        <>
          <Note>A site, not a PDF. It can change and redeploy in a minute, which is why it beats an attachment.</Note>
          <Card tint={C.ink} pad={22} style={{ marginBottom: 14, boxShadow: SH_UP }}>
            <Mono c={C.sand} s={9}>{prospect}</Mono>
            <div style={{ fontFamily: DISPLAY, fontSize: 30, fontWeight: 800, color: "#fff", lineHeight: 1.05, marginTop: 10 }}>
              {augmented ? "REVISED" : "THE PACK"}
            </div>
            <pre style={{ margin: "12px 0 0", whiteSpace: "pre-wrap", fontFamily: BODY, fontSize: 13.5, lineHeight: 1.6, color: "rgba(255,255,255,.8)", maxHeight: 260, overflowY: "auto" }}>
              {copy}
            </pre>
          </Card>

          <Card tint={C.blush} pad={16} style={{ marginBottom: 14 }}>
            <div className="flex items-start gap-2.5">
              <Lock size={16} strokeWidth={2.3} color={C.red} style={{ marginTop: 1, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 14, color: C.ink, fontWeight: 600 }}>Password it, noindex it, obfuscate the name</div>
                <p style={{ fontSize: 12.5, color: C.ink2, marginTop: 4, lineHeight: 1.45 }}>
                  Your rate card is on this page. A guessable URL means other prospects read your pricing.
                </p>
              </div>
            </div>
          </Card>

          <div className="flex gap-2">
            <Pill sm tone="ghost" onClick={() => setStep(1)}>Rebuild</Pill>
            <Pill sm full onClick={() => setStep(3)}>Deploy and draft the email</Pill>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <Note>The email carries one line and the link. The site does the arguing.</Note>
          <Card>
            <Mono>Via Resend</Mono>
            <p style={{ fontSize: 14.5, color: C.ink, lineHeight: 1.6, marginTop: 12 }}>
              I put together what this would actually look like rather than describing it. It's here,
              password below. The part worth two minutes is the section on what stays under our control.
            </p>
            <div className="flex gap-2" style={{ marginTop: 16 }}>
              <Pill sm tone="ghost">Edit</Pill>
              <Confirm sm label="Send it" confirmLabel="Yes, send" onConfirm={record} />
            </div>
          </Card>
        </>
      )}

      {step === 4 && (
        <>
          <Note>Sent, and logged. The Gap stops asking.</Note>
          <div style={{ display: "grid", gap: 10 }}>
            <button onClick={() => setStep(5)} className="tap"
              style={{ background: C.mint, borderRadius: 22, padding: 20, border: "none", cursor: "pointer", boxShadow: SH, textAlign: "left" }}>
              <Big s={22}>APPROVED</Big>
              <p style={{ fontSize: 13, color: C.ink2, marginTop: 6, lineHeight: 1.45 }}>Archive the site, generate the proposal, send for signature.</p>
            </button>
            <button onClick={() => { setAugmented(true); setStep(1); }} className="tap"
              style={{ background: C.apricot, borderRadius: 22, padding: 20, border: "none", cursor: "pointer", boxShadow: SH, textAlign: "left" }}>
              <Big s={22}>AUGMENT</Big>
              <p style={{ fontSize: 13, color: C.ink2, marginTop: 6, lineHeight: 1.45 }}>They want changes. Rebuild and redeploy over the same link.</p>
            </button>
          </div>
        </>
      )}

      {step === 5 && (
        <>
          <Note>Everything below runs on connectors already authorised.</Note>
          {[
            { n: "Proposal PDF", d: "The agreed site, flattened. Scope, deliverables, payment terms.", tint: C.sand },
            { n: "DocuSign", d: "Out for signature. The countersigned copy returns to the pack.", tint: C.sky },
            { n: "PayPal", d: "Payment link on the invoice schedule.", tint: C.lilac },
          ].map((x) => (
            <Card key={x.n} tint={x.tint} pad={18} style={{ marginBottom: 10 }}>
              <Big s={20}>{x.n.toUpperCase()}</Big>
              <p style={{ fontSize: 13, color: C.ink2, marginTop: 6, lineHeight: 1.45 }}>{x.d}</p>
              <div style={{ marginTop: 12 }}><Pill sm tone="ghost">Not wired yet</Pill></div>
            </Card>
          ))}
          <div style={{ marginTop: 8 }}><Pill full onClick={back}>Done</Pill></div>
        </>
      )}
    </div>
  );
}
