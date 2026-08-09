import React, { useState } from "react";
import { Send, Check, Plus, Mail } from "lucide-react";
import {
  C, BODY, DISPLAY, Mono, Big, Card, Section, Pill, Field, Note, Empty,
  Problem, Confirm, iso, daysSince,
} from "../lib/ui.jsx";
import React, { useState } from "react";

   ============================================================ */

const STAGES = ["idea", "approached", "confirmed", "recorded", "published"];
const ASSETS = ["headshot", "logo", "bio", "questions"];
const SHOWS = ["The Struggle Bus", "The Ostrich Report", "The Sunday Supplement"];

const TEMPLATES = {
  cold: {
    label: "Cold ask",
    subject: (g) => `${g.show || "The Struggle Bus"} — would you come on?`,
    body: (g) => `Hi ${g.name.split(" ")[0]},

I run ${g.show || "The Struggle Bus"}, a show for people who actually operate ecommerce rather than talk about it. Forty minutes, no slides, no pitch.

I'd like to have you on because ${g.why || "[the specific reason — name the thing they said or did]"}.

If it's a yes, I'll send a slot. If it's a no, that's genuinely fine and I won't chase.

Vinny`,
  },
  warm: {
    label: "Warm intro",
    subject: (g) => `${g.show || "The Struggle Bus"} — following up on ${g.source || "the intro"}`,
    body: (g) => `Hi ${g.name.split(" ")[0]},

Good to be connected. ${g.source ? `Thanks to ${g.source} for putting us together.` : ""}

The show is forty minutes, conversational, and the audience is operators rather than vendors. The bit I'd want from you is ${g.why || "[the specific angle]"}.

Would a fifteen minute pre-call suit before we book anything?

Vinny`,
  },
  precall: {
    label: "Pre-call invite",
    subject: () => "Fifteen minutes before we record",
    body: (g) => `Hi ${g.name.split(" ")[0]},

Before we record, a short call to agree what we're actually arguing about. Fifteen minutes, no prep needed.

Pick a time here: https://calendly.com/vinnyandco

Vinny`,
  },
  recording: {
    label: "Recording invite",
    subject: (g) => `${g.show || "The Struggle Bus"} — booking the recording`,
    body: (g) => `Hi ${g.name.split(" ")[0]},

Ready to record. Pick a slot: https://calendly.com/vinnyandco

It's StreamYard, browser only, nothing to install. Headphones if you have them, and somewhere without a hard echo.

Vinny`,
  },
  assets: {
    label: "Asset request",
    subject: () => "Four things before we publish",
    body: (g) => `Hi ${g.name.split(" ")[0]},

Four things and then we're set:

1. A headshot you're happy with
2. Company logo, ideally a transparent PNG
3. Two lines of bio, written how you'd want to be introduced
4. Anything you'd like asked, or anything you'd rather not be

Reply with whatever you have. Missing one isn't a blocker.

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
  const [sent, setSent] = useState({});

  const save = (next) => { setGuests(next); sSet(K.guests, next); };

  const add = () => {
    if (!name.trim()) return;
    save([{
      id: Math.random().toString(36).slice(2), name: name.trim(), show,
      stage: "idea", email: "", company: "", source: "", why: "",
      assets: {}, touched: iso(today),
    }, ...guests]);
    setName("");
  };

  const patch = (id, p) =>
    save(guests.map((g) => (g.id === id ? { ...g, ...p, touched: iso(today) } : g)));

  const compose = (g, key) => {
    const t = TEMPLATES[key];
    setDraft({ guestId: g.id, key, to: g.email, subject: t.subject(g), body: t.body(g) });
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
      setSent((s) => ({ ...s, [draft.guestId + draft.key]: true }));
      setDraft(null);
    } catch (e) {
      setErr(e.message || "Nothing was sent.");
    }
    setSending(false);
  };

  const assetCount = (g) => ASSETS.filter((a) => g.assets?.[a]).length;

  return (
    <div>
      <Note>
        Five stages, four assets, six emails. Assets are chased by email, never auto-downloaded —
        a conference headshot belongs to the photographer.
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
          const n = assetCount(g);
          const d = daysSince(g.touched, today);
          const cold = d !== null && d > 14 && !["published", "recorded"].includes(g.stage);
          const isOpen = open === g.id;
          return (
            <Card key={g.id} pad={18} accent={cold ? C.red : g.stage === "confirmed" ? C.ink : undefined} style={{ marginBottom: 10 }}>
              <button onClick={() => setOpen(isOpen ? null : g.id)} className="tap"
                style={{ width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Big s={21}>{g.name.toUpperCase()}</Big>
                    <div style={{ marginTop: 4 }}>
                      <Mono s={9}>{g.company || g.show}{g.source ? ` · ${g.source}` : ""}</Mono>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <Big s={20} c={n === 4 ? C.ink2 : C.red}>{n}/4</Big>
                    <div style={{ marginTop: 2 }}><Mono s={9} c={cold ? C.red : C.ink2}>{d === 0 ? "today" : `${d}d`}</Mono></div>
                  </div>
                </div>
              </button>

              <div className="sc flex gap-1.5" style={{ overflowX: "auto", marginTop: 12 }}>
                {STAGES.map((s) => (
                  <button key={s} onClick={() => patch(g.id, { stage: s })} className="tap"
                    style={{
                      flexShrink: 0, fontFamily: BODY, fontSize: 11.5, fontWeight: g.stage === s ? 600 : 500,
                      padding: "7px 12px", borderRadius: 999, cursor: "pointer",
                      background: g.stage === s ? C.ink : "transparent",
                      color: g.stage === s ? "#fff" : C.ink2,
                      border: g.stage === s ? "none" : "1.5px solid rgba(20,24,51,.14)",
                    }}>
                    {s}
                  </button>
                ))}
              </div>

              {isOpen && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(20,24,51,.08)" }}>
                  <div style={{ display: "grid", gap: 8 }}>
                    <Field value={g.email} onChange={(v) => patch(g.id, { email: v })} placeholder="Email" />
                    <Field value={g.company} onChange={(v) => patch(g.id, { company: v })} placeholder="Company" />
                    <Field value={g.source} onChange={(v) => patch(g.id, { source: v })} placeholder="Where the lead came from" />
                    <Field value={g.why} onChange={(v) => patch(g.id, { why: v })} rows={2} placeholder="Why them. The specific thing they said or did." />
                  </div>

                  <div style={{ marginTop: 14 }}><Mono>Assets</Mono></div>
                  <div className="flex gap-1.5 flex-wrap" style={{ marginTop: 8 }}>
                    {ASSETS.map((a) => {
                      const has = !!g.assets?.[a];
                      return (
                        <button key={a} onClick={() => patch(g.id, { assets: { ...(g.assets || {}), [a]: !has } })} className="tap"
                          style={{
                            fontFamily: BODY, fontSize: 12, fontWeight: 500, padding: "8px 13px", borderRadius: 999,
                            cursor: "pointer", background: has ? C.mint : "transparent",
                            color: C.ink, border: has ? "none" : "1.5px solid rgba(20,24,51,.14)",
                            display: "inline-flex", alignItems: "center", gap: 5,
                          }}>
                          {has && <Check size={12} strokeWidth={3} />}{a}
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ marginTop: 16 }}><Mono>Emails</Mono></div>
                  <div className="flex gap-1.5 flex-wrap" style={{ marginTop: 8 }}>
                    {Object.entries(TEMPLATES).map(([k, t]) => (
                      <Pill key={k} sm tone="ghost" disabled={!g.email}
                        onClick={() => compose(g, k)}>
                        {sent[g.id + k] ? `${t.label} ✓` : t.label}
                      </Pill>
                    ))}
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
            style={{ background: C.card, borderRadius: "28px 28px 0 0", width: "100%", maxWidth: 460, maxHeight: "90vh", overflowY: "auto", padding: 20 }}>
            <div className="flex items-center gap-2" style={{ marginBottom: 14 }}>
              <Mail size={17} strokeWidth={2.2} color={C.ink2} />
              <Mono>{TEMPLATES[draft.key].label} · to {draft.to}</Mono>
            </div>
            <Field value={draft.subject} onChange={(v) => setDraft({ ...draft, subject: v })} placeholder="Subject" />
            <div style={{ height: 10 }} />
            <Field value={draft.body} onChange={(v) => setDraft({ ...draft, body: v })} rows={12} />
            <div className="flex gap-2 items-center" style={{ marginTop: 14, paddingBottom: 10 }}>
              <Pill sm tone="ghost" onClick={() => setDraft(null)} disabled={sending}>Discard</Pill>
              {sending
                ? <Pill sm disabled>Sending…</Pill>
                : <Confirm sm label="Send it" confirmLabel="Yes, send" onConfirm={send} />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
