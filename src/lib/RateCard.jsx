import React, { useState, useMemo } from "react";

/* ═══════════════════════════════════════════════════════════
   VINNY AND CO · RATE CARD AND REVENUE MODEL

   One honest anchor: Foundrae Phase 1 is £29k for eight weeks
   (US$37,500). That is the only price in here derived from a
   real signed engagement. Everything else is a proposal to
   test, and is marked as such.

   The point is not the numbers. It is that every line has a
   number at all, so "is this work paying" becomes answerable.
   ═══════════════════════════════════════════════════════════ */

const C = {
  ground: "#F5F3EE", card: "#FFFFFF", ink: "#141833", ink2: "#565C82",
  ink3: "#767CA0", red: "#B81A1D",
  apricot: "#FFE0CE", sky: "#D6E8F5", mint: "#D6EFE0",
  lilac: "#E2DDF7", sand: "#F2E6D0", blush: "#FFD8D9",
};
const DISPLAY = "'Big Shoulders Display','Oswald',Impact,sans-serif";
const BODY = "'IBM Plex Sans',system-ui,-apple-system,sans-serif";
const MONO = "'IBM Plex Mono',ui-monospace,monospace";
const SH = "0 1px 2px rgba(20,24,51,.04), 0 6px 20px rgba(20,24,51,.06)";

/* ---------- the rate card ---------- */

const LINES = [
  {
    id: "consult", group: "Consulting", tint: C.mint,
    name: "Phase engagement",
    unit: "8-week phase", price: 29000, qty: 3, max: 6,
    basis: "anchored", note: "Foundrae Phase 1, signed. The only real number here.",
  },
  {
    id: "advisory", group: "Consulting", tint: C.mint,
    name: "Monthly advisory retainer",
    unit: "month", price: 3500, qty: 12, max: 36,
    basis: "proposed", note: "Post-phase continuity. Two days a month, named workstreams.",
  },
  {
    id: "production", group: "Production", tint: C.sky,
    name: "Show production retainer",
    unit: "month per client", price: 6000, qty: 12, max: 48,
    basis: "proposed", note: "Watson Weekend productised. Format, guests, clips, distribution. The Cockpit is the delivery mechanism.",
  },
  {
    id: "launch", group: "Production", tint: C.sky,
    name: "Show launch and format build",
    unit: "engagement", price: 12000, qty: 2, max: 8,
    basis: "proposed", note: "Naming, format bible, first six episodes. Feeds the retainer.",
  },
  {
    id: "camp", group: "Events", tint: C.apricot,
    name: "Camp Tralee — headline sponsor",
    unit: "sponsor", price: 20000, qty: 2, max: 4,
    basis: "proposed", note: "Invitation-only, Ballygarry, January. Nobody can copy the room.",
  },
  {
    id: "campsupport", group: "Events", tint: C.apricot,
    name: "Camp Tralee — supporting sponsor",
    unit: "sponsor", price: 8000, qty: 4, max: 10,
    basis: "proposed", note: "Omnisend, Trustap and Parcel Planet already confirmed at some level.",
  },
  {
    id: "camptickets", group: "Events", tint: C.apricot,
    name: "Camp Tralee — delegate places",
    unit: "place", price: 750, qty: 40, max: 120,
    basis: "proposed", note: "Paid attendance keeps the room self-selecting.",
  },
  {
    id: "summit", group: "Events", tint: C.apricot,
    name: "Virtual summit — title sponsor",
    unit: "summit", price: 15000, qty: 2, max: 6,
    basis: "proposed", note: "The Shopware model. Two a year is realistic.",
  },
  {
    id: "report", group: "Research", tint: C.lilac,
    name: "Cross-border operator report — presenting sponsor",
    unit: "sponsor", price: 25000, qty: 1, max: 3,
    basis: "proposed", note: "One artifact, twelve months of shelf life. The reason people cite you rather than Rithum.",
  },
  {
    id: "reportsale", group: "Research", tint: C.lilac,
    name: "Report — paid access",
    unit: "buyer", price: 495, qty: 60, max: 400,
    basis: "proposed", note: "Operators expense this without thinking. Vendors pay more.",
  },
  {
    id: "custom", group: "Research", tint: C.lilac,
    name: "Commissioned research",
    unit: "project", price: 18000, qty: 1, max: 6,
    basis: "proposed", note: "A vendor wants the survey run at their category. High margin, same machinery.",
  },
  {
    id: "showsponsor", group: "Media", tint: C.sand,
    name: "Show sponsorship — season",
    unit: "season", price: 9000, qty: 3, max: 8,
    basis: "proposed", note: "Struggle Bus, Ostrich Report. Parcel Planet is the proof it sells.",
  },
  {
    id: "newsletter", group: "Media", tint: C.sand,
    name: "Newsletter placement — quarter",
    unit: "quarter", price: 3000, qty: 4, max: 16,
    basis: "proposed", note: "The floor, not the business. Worth having, never worth chasing.",
  },
  {
    id: "speaking", group: "Media", tint: C.sand,
    name: "Speaking and moderation",
    unit: "engagement", price: 3500, qty: 6, max: 20,
    basis: "proposed", note: "Mostly a lead source. Price it so it isn't free.",
  },
];

const GROUPS = [
  { id: "Consulting", tint: C.mint,    note: "Highest margin, hardest to scale. It is the floor under everything." },
  { id: "Production", tint: C.sky,     note: "The only line where the Cockpit is literally the product." },
  { id: "Events",     tint: C.apricot, note: "Where niche B2B media actually makes money. Defensible — nobody can copy the room." },
  { id: "Research",   tint: C.lilac,   note: "The compounding line. One artifact, four revenue paths." },
  { id: "Media",      tint: C.sand,    note: "Baseline. Necessary, never sufficient." },
];

/* ---------- the value check ---------- */

const PATHS = {
  billable: { label: "Billable now", c: C.red, w: 4, note: "Invoiceable this month." },
  asset:    { label: "Builds a sellable asset", c: C.ink, w: 3, note: "Becomes something with a price on it." },
  lead:     { label: "Generates leads", c: C.ink2, w: 2, note: "Puts you in front of a buyer." },
  audience: { label: "Builds the audience", c: C.ink3, w: 1, note: "Makes the above possible. Slow, real." },
  none:     { label: "Pays nothing", c: "#9095B5", w: 0, note: "Enjoyable. Not revenue." },
};

const WORK = [
  { n: "Foundrae engagement", h: 14, p: "billable", why: "Signed, invoiced, ongoing." },
  { n: "Watson Weekend production", h: 6, p: "billable", why: "Paid production. Also the proof case for selling it again." },
  { n: "Sponsor approach (The Approach)", h: 2, p: "lead", why: "None has ever gone out. This is the single highest-leverage unbooked hour in the week." },
  { n: "Camp Tralee build", h: 3, p: "asset", why: "Highest ceiling of anything on this list." },
  { n: "Cross-border operator report", h: 0, p: "asset", why: "Does not exist yet. Would unlock three other lines." },
  { n: "Substack essays", h: 4, p: "lead", why: "The eBay piece brought private replies from people who never comment. That is the lead list." },
  { n: "The Struggle Bus", h: 4, p: "asset", why: "Sponsorable, and the guest list is the network." },
  { n: "The Ostrich Report", h: 3, p: "asset", why: "Sponsorable. Rithum spine is 15 weeks of inventory." },
  { n: "Sunday Supplement", h: 3, p: "audience", why: "Reading other people's research. Becomes revenue only when you publish your own." },
  { n: "Daily V Spot drop", h: 4, p: "audience", why: "Rhythm and reach. No direct mechanism." },
  { n: "Sixty Seconds", h: 3, p: "audience", why: "Reach. Feeds YouTube, which is growing." },
  { n: "Clip distribution", h: 2, p: "audience", why: "Cheap reach now the desk works properly." },
  { n: "Correspondent videos", h: 4, p: "audience", why: "Reach without diluting the byline. Do not monetise — the moment Murt sells something he stops working." },
  { n: "Nearly News", h: 3, p: "none", why: "Genuinely funny. No mechanism attached to it, and that is a choice, not an oversight." },
  { n: "Building the Cockpit", h: 6, p: "asset", why: "Time back, and it is the delivery mechanism for production retainers." },
];

const money = (n) => "£" + Math.round(n).toLocaleString("en-GB");
const short = (n) => (n >= 1000 ? "£" + (n / 1000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, "") + "k" : "£" + n);

export default function RateCard() {
  const [qty, setQty] = useState(() => Object.fromEntries(LINES.map((l) => [l.id, l.qty])));
  const [tab, setTab] = useState("card");
  const [open, setOpen] = useState(null);

  const total = useMemo(
    () => LINES.reduce((s, l) => s + l.price * (qty[l.id] ?? 0), 0),
    [qty]
  );

  const byGroup = useMemo(() => {
    const m = {};
    LINES.forEach((l) => { m[l.group] = (m[l.group] || 0) + l.price * (qty[l.id] ?? 0); });
    return m;
  }, [qty]);

  const hours = WORK.reduce((s, w) => s + w.h, 0);
  const weighted = WORK.reduce((s, w) => s + w.h * PATHS[w.p].w, 0);
  const score = Math.round((weighted / (hours * 4)) * 100);
  const nearCash = WORK.filter((w) => w.p === "billable" || w.p === "lead").reduce((s, w) => s + w.h, 0);

  return (
    <div style={{ background: "#E8E5DE", minHeight: "100vh", fontFamily: BODY, padding: "0 0 40px" }}>
      <style>{`
        * { box-sizing: border-box; }
        .tap:active { transform: scale(.98); }
        input[type=range] { -webkit-appearance: none; appearance: none; background: transparent; }
        input[type=range]::-webkit-slider-runnable-track { height: 5px; border-radius: 999px; background: rgba(20,24,51,.12); }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 20px; height: 20px; border-radius: 999px; background: ${C.ink}; margin-top: -7.5px; cursor: pointer; }
        input[type=range]::-moz-range-track { height: 5px; border-radius: 999px; background: rgba(20,24,51,.12); }
        input[type=range]::-moz-range-thumb { width: 20px; height: 20px; border: none; border-radius: 999px; background: ${C.ink}; cursor: pointer; }
      `}</style>

      <div style={{ maxWidth: 620, margin: "0 auto", background: C.ground, minHeight: "100vh" }}>
        {/* header */}
        <div style={{ padding: "24px 20px 14px" }}>
          <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: ".14em", color: C.ink2, textTransform: "uppercase" }}>
            Vinny and Co Consulting · Tralee
          </div>
          <div style={{ fontFamily: DISPLAY, fontSize: 34, fontWeight: 800, color: C.ink, lineHeight: 1, marginTop: 4 }}>
            RATE CARD AND REVENUE MODEL
          </div>
        </div>

        {/* running total */}
        <div style={{ padding: "0 16px 16px" }}>
          <div style={{ background: C.ink, borderRadius: 24, padding: 22, boxShadow: SH }}>
            <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: ".14em", color: C.sand, textTransform: "uppercase" }}>
              Modelled annual revenue
            </div>
            <div style={{ fontFamily: DISPLAY, fontSize: 52, fontWeight: 800, color: "#fff", lineHeight: 1, marginTop: 6 }}>
              {money(total)}
            </div>
            <div style={{ display: "flex", gap: 3, marginTop: 16, borderRadius: 999, overflow: "hidden", height: 9 }}>
              {GROUPS.map((g) => {
                const v = byGroup[g.id] || 0;
                if (!v) return null;
                return <div key={g.id} title={g.id} style={{ width: `${(v / total) * 100}%`, background: g.tint }} />;
              })}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 12 }}>
              {GROUPS.map((g) => {
                const v = byGroup[g.id] || 0;
                if (!v) return null;
                return (
                  <span key={g.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 999, background: g.tint }} />
                    <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: ".08em", color: "rgba(255,255,255,.75)", textTransform: "uppercase" }}>
                      {g.id} {short(v)}
                    </span>
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {/* tabs */}
        <div style={{ display: "flex", gap: 8, padding: "0 16px 16px" }}>
          {[["card", "The rate card"], ["check", "Does the work pay?"]].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className="tap"
              style={{
                padding: "10px 16px", borderRadius: 999, cursor: "pointer",
                fontFamily: BODY, fontSize: 13.5, fontWeight: tab === k ? 600 : 500,
                background: tab === k ? C.ink : "transparent",
                color: tab === k ? "#fff" : C.ink2,
                border: tab === k ? "none" : "1.5px solid rgba(20,24,51,.14)",
              }}>{l}</button>
          ))}
        </div>

        {tab === "card" && (
          <div style={{ padding: "0 16px" }}>
            {GROUPS.map((g) => (
              <div key={g.id} style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, padding: "0 4px 8px" }}>
                  <span style={{ fontFamily: DISPLAY, fontSize: 22, fontWeight: 800, color: C.ink }}>{g.id.toUpperCase()}</span>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: C.ink2 }}>{short(byGroup[g.id] || 0)}</span>
                </div>
                <p style={{ fontSize: 12.5, color: C.ink2, lineHeight: 1.45, padding: "0 4px 10px" }}>{g.note}</p>

                {LINES.filter((l) => l.group === g.id).map((l) => {
                  const n = qty[l.id] ?? 0;
                  const sub = l.price * n;
                  const isOpen = open === l.id;
                  return (
                    <div key={l.id} style={{ background: g.tint, borderRadius: 20, padding: 16, marginBottom: 9, boxShadow: SH }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                        <button onClick={() => setOpen(isOpen ? null : l.id)} className="tap"
                          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left", flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 15, fontWeight: 600, color: C.ink, lineHeight: 1.3 }}>{l.name}</div>
                          <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: ".08em", color: C.ink2, marginTop: 4, textTransform: "uppercase" }}>
                            {money(l.price)} per {l.unit}
                            {l.basis === "anchored" && <span style={{ color: C.red }}> · signed</span>}
                          </div>
                        </button>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ fontFamily: DISPLAY, fontSize: 22, fontWeight: 800, color: sub ? C.ink : C.ink3, lineHeight: 1 }}>
                            {short(sub)}
                          </div>
                          <div style={{ fontFamily: MONO, fontSize: 9.5, color: C.ink2, marginTop: 3 }}>× {n}</div>
                        </div>
                      </div>

                      <input type="range" min={0} max={l.max} value={n}
                        onChange={(e) => setQty({ ...qty, [l.id]: Number(e.target.value) })}
                        style={{ width: "100%", marginTop: 12 }} />

                      {isOpen && (
                        <p style={{ fontSize: 12.5, color: C.ink2, lineHeight: 1.5, marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(20,24,51,.09)" }}>
                          {l.note}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

            <div style={{ background: C.blush, borderRadius: 20, padding: 18, marginBottom: 16 }}>
              <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: ".14em", color: C.red, textTransform: "uppercase" }}>
                Read this before quoting anything
              </div>
              <p style={{ fontSize: 13, color: C.ink, lineHeight: 1.55, marginTop: 8 }}>
                One number here is real: the Foundrae phase. Everything else is a proposal, priced by
                shape rather than evidence, and the only way to find the true figure is to put it in
                front of a buyer and watch their face. Send three and you will know more than any
                model can tell you.
              </p>
            </div>
          </div>
        )}

        {tab === "check" && (
          <div style={{ padding: "0 16px" }}>
            <div style={{ background: C.card, borderRadius: 24, padding: 20, boxShadow: SH, marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: ".14em", color: C.ink2, textTransform: "uppercase" }}>
                    Revenue proximity
                  </div>
                  <div style={{ fontFamily: DISPLAY, fontSize: 46, fontWeight: 800, color: C.ink, lineHeight: 1, marginTop: 4 }}>
                    {score}%
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: MONO, fontSize: 9.5, color: C.ink2 }}>{hours} HRS/WEEK</div>
                  <div style={{ fontFamily: MONO, fontSize: 9.5, color: C.red, marginTop: 3 }}>{nearCash} NEAR CASH</div>
                </div>
              </div>
              <p style={{ fontSize: 13, color: C.ink2, lineHeight: 1.55, marginTop: 12 }}>
                {nearCash} of {hours} hours are billable or lead-generating. The rest builds the audience
                that makes those hours possible — which is not waste, but it is not revenue either, and
                the ratio is the thing to watch rather than the score.
              </p>
            </div>

            {Object.entries(PATHS).map(([k, p]) => {
              const rows = WORK.filter((w) => w.p === k);
              if (!rows.length) return null;
              const h = rows.reduce((s, w) => s + w.h, 0);
              return (
                <div key={k} style={{ marginBottom: 18 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 4px 8px" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 999, background: p.c }} />
                      <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".12em", color: C.ink, textTransform: "uppercase" }}>
                        {p.label}
                      </span>
                    </span>
                    <span style={{ fontFamily: MONO, fontSize: 10, color: C.ink2 }}>{h} hrs</span>
                  </div>
                  {rows.map((w) => (
                    <div key={w.n} style={{ background: C.card, borderRadius: 18, padding: 15, marginBottom: 8, boxShadow: SH, borderLeft: `3px solid ${p.c}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <span style={{ fontSize: 14.5, fontWeight: 600, color: C.ink, lineHeight: 1.3 }}>{w.n}</span>
                        <span style={{ fontFamily: MONO, fontSize: 10, color: C.ink2, flexShrink: 0 }}>{w.h}h</span>
                      </div>
                      <p style={{ fontSize: 12.5, color: C.ink2, lineHeight: 1.5, marginTop: 5 }}>{w.why}</p>
                    </div>
                  ))}
                </div>
              );
            })}

            <div style={{ background: C.sand, borderRadius: 20, padding: 18, marginBottom: 16 }}>
              <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: ".14em", color: C.ink2, textTransform: "uppercase" }}>
                The one that stands out
              </div>
              <p style={{ fontSize: 13.5, color: C.ink, lineHeight: 1.55, marginTop: 8 }}>
                Two hours a week are allocated to The Approach and none has ever gone out. Every other
                line on this list is working. That one is the difference between an audience and a
                business, and it is the cheapest hour you own.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
