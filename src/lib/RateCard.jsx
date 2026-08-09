import React, { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { C, BODY, MONO, DISPLAY, Mono, Big, Card } from "./ui.jsx";

/* ============================================================
   src/lib/RateCard.jsx

   Base currency is USD, because that is where the signed number
   came from: Foundrae Phase 1 at $37,500 for eight weeks.

   Rates are FIXED, not live. A rate card that moves with the
   market quotes a different number every week and makes you look
   like you are guessing. Set them, note the date, review
   quarterly — and if the pound moves ten percent, that is a
   deliberate re-pricing rather than a surprise.

   FX risk sits with you on anything quoted in a client's
   currency. Camp Tralee is the one to watch: it is a euro-cost
   event with a dollar-denominated rate card.
   ============================================================ */

const FX = {
  USD: { rate: 1,    sym: "$", label: "USD" },
  GBP: { rate: 0.74, sym: "£", label: "GBP" },
  EUR: { rate: 0.86, sym: "€", label: "EUR" },
};
const FX_SET = "9 Aug 2026";

/* Round to something you would actually say out loud. Nobody quotes €21,543. */
function convert(usd, cur) {
  const v = usd * FX[cur].rate;
  if (v >= 10000) return Math.round(v / 500) * 500;
  if (v >= 1000) return Math.round(v / 100) * 100;
  if (v >= 100) return Math.round(v / 25) * 25;
  return Math.round(v / 5) * 5;
}

const show = (usd, cur) =>
  FX[cur].sym + convert(usd, cur).toLocaleString("en-GB");

export const CARD = [
  {
    group: "Consulting", tint: C.mint,
    lines: [
      { n: "Phase engagement", u: "8-week phase", p: 37500, signed: true,
        w: "Foundrae Phase 1, signed at this figure. The anchor for everything else." },
      { n: "Advisory retainer", u: "month", p: 4500,
        w: "Post-phase continuity. Two days a month, named workstreams." },
      { n: "Day rate", u: "day", p: 1800,
        w: "For work that will not fit a phase. Price it high enough that it rarely does." },
    ],
  },
  {
    group: "Production", tint: C.sky,
    lines: [
      { n: "Show production retainer", u: "month per client", p: 8000,
        w: "Watson Weekend productised. Format, guests, clips, distribution." },
      { n: "Show launch and format build", u: "engagement", p: 16000,
        w: "Naming, format bible, first six episodes. Feeds the retainer." },
      { n: "Episode package", u: "episode", p: 1200,
        w: "One-off. Transcript in, every channel out." },
    ],
  },
  {
    group: "Events", tint: C.apricot,
    lines: [
      { n: "Camp Tralee — headline", u: "sponsor", p: 25000,
        w: "Invitation-only, January, Ballygarry. Nobody can copy the room. Costs are in euro — quote accordingly." },
      { n: "Camp Tralee — supporting", u: "sponsor", p: 10000,
        w: "Omnisend, Trustap and Parcel Planet already in." },
      { n: "Camp Tralee — delegate place", u: "place", p: 950,
        w: "Paid attendance keeps the room self-selecting." },
      { n: "Virtual summit — title", u: "summit", p: 20000,
        w: "The Shopware model. Two a year is realistic." },
    ],
  },
  {
    group: "Research", tint: C.lilac,
    lines: [
      { n: "Operator report — presenting sponsor", u: "sponsor", p: 35000,
        w: "One artifact, twelve months of shelf life. Does not exist yet, and should." },
      { n: "Report — paid access", u: "buyer", p: 650,
        w: "Operators expense this without thinking. Vendors pay more." },
      { n: "Commissioned research", u: "project", p: 25000,
        w: "Same machinery, pointed at a vendor's category." },
    ],
  },
  {
    group: "Media", tint: C.sand,
    lines: [
      { n: "Show sponsorship", u: "season", p: 12000,
        w: "Parcel Planet is the proof it sells." },
      { n: "Newsletter placement", u: "quarter", p: 4000,
        w: "The floor, not the business." },
      { n: "Speaking and moderation", u: "engagement", p: 4500,
        w: "Mostly a lead source. Price it so it is never free." },
    ],
  },
];

export default function RateCard() {
  const [open, setOpen] = useState(false);
  const [cur, setCur] = useState("USD");
  const [group, setGroup] = useState(null);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="tap"
        style={{
          width: "100%", background: C.card, borderRadius: 20, padding: "14px 16px",
          border: "none", cursor: "pointer", textAlign: "left", marginBottom: 12,
          boxShadow: "0 1px 2px rgba(20,24,51,.04), 0 6px 20px rgba(20,24,51,.06)",
          display: "flex", alignItems: "center", gap: 10,
        }}>
        <ChevronRight size={16} strokeWidth={2.4} color={C.ink2} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 14.5, fontWeight: 600, color: C.ink }}>Rate card</span>
          <span style={{ display: "block", marginTop: 2 }}>
            <Mono s={9}>What everything costs, before you write the number down</Mono>
          </span>
        </span>
      </button>
    );
  }

  return (
    <Card pad={0} style={{ marginBottom: 14, padding: "16px 0 8px" }}>
      <button onClick={() => setOpen(false)} className="tap"
        style={{ width: "100%", background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: "0 16px 12px", display: "flex", alignItems: "center", gap: 10 }}>
        <ChevronDown size={16} strokeWidth={2.4} color={C.ink2} style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 14.5, fontWeight: 600, color: C.ink, flex: 1 }}>Rate card</span>
      </button>

      {/* currency */}
      <div style={{ padding: "0 16px 14px" }}>
        <div className="flex gap-1.5">
          {Object.entries(FX).map(([k, v]) => (
            <button key={k} onClick={() => setCur(k)} className="tap"
              style={{
                flex: 1, padding: "9px 0", borderRadius: 999, cursor: "pointer",
                fontFamily: BODY, fontSize: 13, fontWeight: cur === k ? 600 : 500,
                background: cur === k ? C.ink : "transparent",
                color: cur === k ? "#fff" : C.ink2,
                border: cur === k ? "none" : "1.5px solid rgba(20,24,51,.14)",
              }}>
              {v.sym} {v.label}
            </button>
          ))}
        </div>
        <div style={{ marginTop: 8 }}>
          <Mono s={8.5}>
            {cur === "USD"
              ? "Base currency. Every price is set here."
              : `Converted at ${FX[cur].rate} · fixed ${FX_SET} · review quarterly`}
          </Mono>
        </div>
      </div>

      {CARD.map((g) => {
        const isOpen = group === g.group;
        return (
          <div key={g.group}>
            <button onClick={() => setGroup(isOpen ? null : g.group)} className="tap"
              style={{
                width: "100%", background: isOpen ? g.tint : "transparent", border: "none",
                cursor: "pointer", textAlign: "left", padding: "11px 16px",
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
              }}>
              <span style={{ fontFamily: DISPLAY, fontSize: 18, fontWeight: 800, color: C.ink }}>
                {g.group.toUpperCase()}
              </span>
              <Mono s={9}>{g.lines.length} lines</Mono>
            </button>

            {isOpen && g.lines.map((l) => (
              <div key={l.n} style={{ background: g.tint, padding: "10px 16px 12px" }}>
                <div className="flex items-baseline justify-between gap-3">
                  <span style={{ fontSize: 13.5, color: C.ink, fontWeight: 500, lineHeight: 1.3 }}>{l.n}</span>
                  <span style={{ fontFamily: DISPLAY, fontSize: 19, fontWeight: 800, color: C.ink, flexShrink: 0, whiteSpace: "nowrap" }}>
                    {show(l.p, cur)}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap" style={{ marginTop: 3 }}>
                  <Mono s={8.5}>per {l.u}</Mono>
                  {l.signed
                    ? <Mono s={8.5} c={C.red}>signed</Mono>
                    : <Mono s={8.5} style={{ opacity: .65 }}>proposed</Mono>}
                  {cur !== "USD" && <Mono s={8.5} style={{ opacity: .5 }}>${l.p.toLocaleString("en-GB")}</Mono>}
                </div>
                <p style={{ fontSize: 12, color: C.ink2, lineHeight: 1.45, marginTop: 5 }}>{l.w}</p>
              </div>
            ))}
          </div>
        );
      })}

      <div style={{ padding: "12px 16px 6px" }}>
        <Mono s={9}>
          One signed number. The rest are proposals — the true figure is whatever a buyer says yes to.
          FX risk sits with you on anything quoted in their currency.
        </Mono>
      </div>
    </Card>
  );
}
