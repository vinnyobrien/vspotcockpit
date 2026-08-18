import React, { useState } from "react";
import { Send, Check, Plus, Copy, ExternalLink, X, Clock4 } from "lucide-react";
import {
  C, BODY, DISPLAY, MONO, Mono, Big, Card, Section, Pill, Field, Note,
  Empty, Problem, Confirm, iso, daysSince,
} from "../lib/ui.jsx";

/* ============================================================
   src/rooms/Guests.jsx

   Live: /api/send-email → Resend, and every send is written twice:
   to the guest's own sequence so you can see where they are, and
   to the server ledger so the Gap and Analysis can query it.

   That log is the point. "Sent the asset request" is a memory.
   "ASSET REQUEST · 2026-08-06" is a record, and it is what stops
   you chasing someone twice or not at all.

   Assets are chased, never fetched. A conference headshot belongs
   to the photographer, not to whoever can right-click it.
   ============================================================ */

const STAGES = ["idea", "approached", "booked", "recorded", "published"];
const ASSETS = ["headshot", "logo", "bio", "questions"];
const SHOWS = ["The Struggle Bus", "The Ostrich Report", "The Sunday Supplement"];
const CALENDLY = "https://calendly.com/vinnyandco";

const first = (n) => String(n || "").trim().split(" ")[0] || "there";

const TEMPLATES = {
  cold: {
    label: "Cold",
    subject: (g) => `${g.show} — would you come on?`,
    body: (g) => `Hi ${first(g.name)},

I run ${g.show}, a show for people who actually operate ecommerce rather than talk about it. Forty minutes, no slides, no pitch.

I'd like to have you on because ${g.why || "[the specific thing they said or did]"}.

If it's a yes I'll send a slot. If it's a no that's genuinely fine, and I won't chase.

Vinny`,
  },
  warm: {
    label: "Warm intro",
    subject: (g) => `${g.show} — following up`,
    body: (g) => `Hi ${first(g.name)},

Good to be connected.${g.source ? ` Thanks to ${g.source} for putting us together.` : ""}

The show is forty minutes, conversational, and the audience is operators rather than vendors. The part I'd want from you is ${g.why || "[the specific angle]"}.

Would fifteen minutes suit before we book anything?

Vinny`,
  },
  precall: {
    label: "Pre-call invite",
    subject: () => "Fifteen minutes before we record",
    body: (g) => `Hi ${first(g.name)},

Before we record, a short call to agree what we're actually arguing about. Fifteen minutes, no prep needed.

Pick a time here: ${CALENDLY}

Vinny`,
  },
  recording: {
    label: "Recording invite",
    subject: (g) => `${g.show} — booking the recording`,
    body: (g) => `Hi ${first(g.name)},

Ready to record. Pick a slot: ${CALENDLY}

It's StreamYard, browser only, nothing to install. Headphones if you have them, and somewhere without a hard echo.

Vinny`,
  },
  assets: {
    label: "Asset request",
    subject: () => "Four things before we publish",
    body: (g) => `Hi ${first(g.name)},

Four things and then we're set:

1. A headshot you're happy with
2. Company logo, ideally a transparent PNG
3. Two lines of bio, written how you'd want to be introduced
4. Anything you'd like asked, or anything you'd rather not be

Reply with whatever you have. Missing one isn't a blocker.

Vinny`,
  },
  thanks: {
    label: "Thanks and live",
    subject: (g) => `${g.show} — you're live`,
    body: (g) => `Hi ${first(g.name)},

That's live. Thanks for giving it the time — the part about ${g.why || "[the moment worth naming]"} is the bit people will quote.

Clips are going out over the next week. I'll send them as they land in case you want them.

Vinny`,
  },
};

export default function Guests({ guests, setGuests, sSet, K, today }) {
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(null);
  const [name, setName] = useState("");
  const [show, setShow] = useState(SHOWS[0]);
  const [draft, setDraft] = useState(null);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);

  const save = (next) => { setGuests(next); sSet(K.guests, next); };

  const add = () => {
    if (!name.trim()) return;
    save([{
      id: Math.random().toString(36).slice(2), name: name.trim(), show,
      stage: "idea", email: "", company: "", source: "", why: "", notes: "",
      date: "", slot: "precall", assets: {}, emails: [], touched: iso(today),
    }, ...guests]);
    setName("");
  };

  const patch = (id, p) =>
    save(guests.map((g) => (g.id === id ? { ...g, ...p, touched: iso(today) } : g)));

  const remove = (id) => save(guests.filter((g) => g.id !== id));

  const compose = (g, key) =>
    setDraft({ g, key, to: g.email, subject: TEMPLATES[key].subject(g), body: TEMPLATES[key].body(g) });

  /* Records the step against the guest, then lets the server record it again
     in the ledger. Two records because they answer different questions:
     "where is this guest" and "what has this app ever sent". */
  const logStep = (g, key) => {
    const entry = { key, at: iso(today) };
    patch(g.id, { emails: [...(g.emails || []), entry] });
  };

  const send = async () => {
    if (!draft) return;
    setSending(true);
    setErr("");
    try {
      const res = await fetch("/api/send-email", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          to: draft.to, subject: draft.subject, body: draft.body,
          confirm: true, context: `guest.${draft.key}`,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `Send failed (${res.status})`);
      logStep(draft.g, draft.key);
      setDraft(null);
    } catch (e) {
      setErr(e.message || "Nothing was sent.");
    }
    setSending(false);
  };

  const mailto = (d) =>
    `mailto:${encodeURIComponent(d.to)}?subject=${encodeURIComponent(d.subject)}&body=${encodeURIComponent(d.body)}`;

  const count = (g) => ASSETS.filter((a) => g.assets?.[a]).length;
  const lastStep = (g) => (g.emails || [])[g.emails.length - 1];

  return (
    <div>
      <Note>
        Five stages, four assets, six emails. Every send is logged against the guest, so you can see
        where each one actually is rather than trying to remember.
      </Note>
      <Problem onDismiss={() => setErr("")}>{err}</Problem>

      <Card style={{ marginBottom: 16 }}>
        <Field value={name} onChange={setName} onEnter={add} placeholder="Guest name" />
        <div className="flex gap-2" style={{ marginTop: 10 }}>
          <select value={show} onChange={(e) => setShow(e.target.value)}
            style={{ flex: 1, minWidth: 0, background: "rgba(20,24,51,.04)", border: "none", borderRadius: 14, padding: "13px 15px", fontFamily: BODY, fontSize: 14, color: C.ink, outline: "none" }}>
            {SHOWS.map((s) => <option key={s}>{s}</option>)}
          </select>
          <Pill icon={Plus} disabled={!name.trim()} onClick={add}>Add</Pill>
        </div>
      </Card>

      {guests.length === 0 && <Empty>Nobody tracked. The Gap will keep telling you so.</Empty>}

      {[...guests]
        .sort((a, b) => STAGES.indexOf(a.stage) - STAGES.indexOf(b.stage) || (daysSince(b.touched, today) - daysSince(a.touched, today)))
        .map((g) => {
          const n = count(g);
          const d = daysSince(g.touched, today);
          const cold = d !== null && d > 14 && !["published", "recorded"].includes(g.stage);
          const isOpen = open === g.id;
          const last = lastStep(g);
          return (
            <Card key={g.id} pad={18} accent={cold ? C.red : g.stage === "booked" ? C.ink : undefined} style={{ marginBottom: 10 }}>
              <div className="flex items-start justify-between gap-3">
                <button onClick={() => setOpen(isOpen ? null : g.id)} className="tap min-w-0 flex-1"
                  style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}>
                  <Big s={21}>{g.name.toUpperCase()}</Big>
                  <div style={{ marginTop: 4 }}>
                    <Mono s={9}>{g.company || g.show}{g.source ? ` · ${g.source}` : ""}</Mono>
                  </div>
                  {last && (
                    <div style={{ marginTop: 5 }}>
                      <Mono s={9} c={C.red}>{TEMPLATES[last.key].label.toUpperCase()} · {last.at}</Mono>
                    </div>
                  )}
                </button>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <Big s={20} c={n === 4 ? C.ink2 : C.red}>{n}/4</Big>
                  <div className="flex items-center justify-end gap-2" style={{ marginTop: 4 }}>
                    <Mono s={9} c={cold ? C.red : C.ink2}>{d === 0 ? "today" : `${d}d`}</Mono>
                    <button onClick={() => remove(g.id)} className="tap" aria-label="Remove"
                      style={{ background: "none", border: "none", cursor: "pointer", color: C.ink3, padding: 0, display: "flex" }}>
                      <X size={13} strokeWidth={2.4} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="sc flex gap-1.5" style={{ overflowX: "auto", marginTop: 12 }}>
                {STAGES.map((s) => (
                  <button key={s} onClick={() => patch(g.id, { stage: s })} className="tap"
                    style={{
                      flexShrink: 0, fontFamily: BODY, fontSize: 11.5, fontWeight: g.stage === s ? 600 : 500,
                      padding: "7px 12px", borderRadius: 999, cursor: "pointer",
                      background: g.stage === s ? C.ink : "transparent",
                      color: g.stage === s ? "#fff" : C.ink2,
                      border: g.stage === s ? "none" : "1.5px solid rgba(20,24,51,.14)",
                    }}>{s}</button>
                ))}
              </div>

              {isOpen && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(20,24,51,.08)" }}>
                  <div style={{ display: "grid", gap: 8 }}>
                    <Field value={g.email} onChange={(v) => patch(g.id, { email: v })} placeholder="Email" />
                    <Field value={g.company} onChange={(v) => patch(g.id, { company: v })} placeholder="Company" />
                    <Field value={g.source} onChange={(v) => patch(g.id, { source: v })} placeholder="Where the lead came from" />
                    <select value={g.show} onChange={(e) => patch(g.id, { show: e.target.value })}
                      style={{ width: "100%", background: "rgba(20,24,51,.04)", border: "none", borderRadius: 14, padding: "13px 15px", fontFamily: BODY, fontSize: 14, color: C.ink, outline: "none" }}>
                      {SHOWS.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>

                  {/* date and what it is */}
                  <div className="flex gap-2" style={{ marginTop: 8 }}>
                    <input type="date" value={g.date || ""} onChange={(e) => patch(g.id, { date: e.target.value })}
                      style={{ flex: 1, minWidth: 0, background: "rgba(20,24,51,.04)", border: "none", borderRadius: 14, padding: "12px 15px", fontFamily: BODY, fontSize: 14, color: C.ink, outline: "none" }} />
                    {[["precall", "Pre-call"], ["recording", "Recording"]].map(([k, l]) => (
                      <button key={k} onClick={() => patch(g.id, { slot: k })} className="tap"
                        style={{
                          flexShrink: 0, fontFamily: BODY, fontSize: 12.5, fontWeight: g.slot === k ? 600 : 500,
                          padding: "12px 14px", borderRadius: 14, cursor: "pointer",
                          background: g.slot === k ? C.ink : "transparent",
                          color: g.slot === k ? "#fff" : C.ink2,
                          border: g.slot === k ? "none" : "1.5px solid rgba(20,24,51,.14)",
                        }}>{l}</button>
                    ))}
                  </div>

                  <div style={{ marginTop: 16 }}><Mono>Assets</Mono></div>
                  <div className="flex gap-1.5 flex-wrap" style={{ marginTop: 8 }}>
                    {ASSETS.map((a) => {
                      const has = !!g.assets?.[a];
                      return (
                        <button key={a} onClick={() => patch(g.id, { assets: { ...(g.assets || {}), [a]: !has } })} className="tap"
                          style={{
                            fontFamily: BODY, fontSize: 12, fontWeight: 500, padding: "8px 13px", borderRadius: 999,
                            cursor: "pointer", background: has ? C.mint : "transparent", color: C.ink,
                            border: has ? "none" : "1.5px solid rgba(20,24,51,.14)",
                            display: "inline-flex", alignItems: "center", gap: 5,
                          }}>
                          {has && <Check size={12} strokeWidth={3} />}{a}
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ marginTop: 16 }}><Mono>Notes</Mono></div>
                  <div style={{ marginTop: 8 }}>
                    <Field value={g.notes} onChange={(v) => patch(g.id, { notes: v })} rows={3}
                      placeholder="What you want out of this one. Threads they connect to. Anything they said in the pre-call." />
                  </div>
                  <div style={{ marginTop: 8 }}>
                    <Field value={g.why} onChange={(v) => patch(g.id, { why: v })} rows={2}
                      placeholder="Why them — this goes into the emails, so make it specific." />
                  </div>

                  {/* the sequence */}
                  {(g.emails || []).length > 0 && (
                    <>
                      <div style={{ marginTop: 18 }}><Mono>The sequence</Mono></div>
                      <Card pad={0} tint="rgba(20,24,51,.03)" style={{ marginTop: 8, boxShadow: "none", padding: "4px 0" }}>
                        {g.emails.map((e, i) => (
                          <div key={i} className="flex items-center gap-2.5" style={{ padding: "9px 14px" }}>
                            <Check size={13} strokeWidth={2.8} color={C.ink} style={{ flexShrink: 0 }} />
                            <span style={{ fontSize: 13, color: C.ink, flex: 1 }}>{TEMPLATES[e.key].label}</span>
                            <Mono s={9}>{e.at}</Mono>
                          </div>
                        ))}
                      </Card>
                    </>
                  )}

                  <div style={{ marginTop: 18 }}><Mono>Send</Mono></div>
                  <div className="flex gap-1.5 flex-wrap" style={{ marginTop: 8 }}>
                    {Object.entries(TEMPLATES).map(([k, t]) => {
                      const already = (g.emails || []).some((e) => e.key === k);
                      return (
                        <Pill key={k} sm tone="ghost" disabled={!g.email} onClick={() => compose(g, k)}>
                          {already ? `${t.label} ✓` : t.label}
                        </Pill>
                      );
                    })}
                  </div>
                  {!g.email && <div style={{ marginTop: 8 }}><Mono s={9} c={C.red}>Add an email address first</Mono></div>}
                </div>
              )}
            </Card>
          );
        })}

      {/* the draft sheet */}
      {draft && (
        <div onClick={() => !sending && setDraft(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(20,24,51,.35)", zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: C.card, borderRadius: "28px 28px 0 0", width: "100%", maxWidth: 460, maxHeight: "92vh", overflowY: "auto", padding: 20 }}>
            <div style={{ marginBottom: 14 }}>
              <Mono>{TEMPLATES[draft.key].label} · to {draft.to}</Mono>
            </div>
            <Field value={draft.subject} onChange={(v) => setDraft({ ...draft, subject: v })} placeholder="Subject" />
            <div style={{ height: 10 }} />
            <Field value={draft.body} onChange={(v) => setDraft({ ...draft, body: v })} rows={13} />

            <div className="flex gap-2 flex-wrap items-center" style={{ marginTop: 14, paddingBottom: 14 }}>
              <Pill sm tone="ghost" icon={Copy}
                onClick={() => { navigator.clipboard?.writeText(draft.body); setCopied(true); setTimeout(() => setCopied(false), 1600); }}>
                {copied ? "Copied" : "Copy"}
              </Pill>
              <a className="tap" href={mailto(draft)} onClick={() => logStep(draft.g, draft.key)}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 15px", borderRadius: 999, border: "1.5px solid rgba(20,24,51,.15)", fontFamily: BODY, fontSize: 13, fontWeight: 600, color: C.ink, textDecoration: "none" }}>
                Open in Mail <ExternalLink size={13} strokeWidth={2.3} />
              </a>
              <span style={{ marginLeft: "auto" }}>
                {sending
                  ? <Pill sm disabled>Sending…</Pill>
                  : <Confirm sm label="Send it" confirmLabel="Yes, send" onConfirm={send} />}
              </span>
            </div>
            <Mono s={9}>Sending logs the step against {first(draft.g.name)} and to the ledger.</Mono>
            <div style={{ height: 12 }} />
          </div>
        </div>
      )}
    </div>
  );
}
