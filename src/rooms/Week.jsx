import React, { useState, useMemo } from "react";
import { Check, Plus, X } from "lucide-react";
import {
  C, BODY, MONO, DISPLAY, SH, R, Mono, Big, Card, Section, Pill, Field,
  Note, Chips, iso, DAYS,
} from "../lib/ui.jsx";

/* ============================================================
   src/rooms/Week.jsx

   Every publishing slot across the network, filled or open.

   The point is the empty ones. A content calendar that only shows
   what you planned tells you nothing; this shows what the week
   could carry and what it is actually carrying, which is the
   number that decides whether there is anything to sell.
   ============================================================ */

/* daily = every weekday. dow = only those days (0 Sun … 6 Sat). */
const SLOTS = [
  { id: "wire",     name: "The Wire",        at: "07:00", tint: C.sand,    daily: true,  kind: "input",  note: "Read, not published." },
  { id: "sixty",    name: "Sixty Seconds",   at: "07:30", tint: C.mint,    daily: true,  kind: "video",  note: "YouTube Short." },
  { id: "x1",       name: "The claim",       at: "08:00", tint: C.apricot, daily: true,  kind: "post",   note: "X · Vinny." },
  { id: "x2",       name: "The absurdity",   at: "12:00", tint: C.apricot, daily: true,  kind: "post",   note: "X · Murt." },
  { id: "post",     name: "The Post",        at: "12:30", tint: C.sky,     daily: true,  kind: "written",note: "LinkedIn." },
  { id: "shorts",   name: "Shorts",          at: "13:00", tint: C.mint,    daily: true,  kind: "video",  note: "YouTube, TikTok, X." },
  { id: "x3",       name: "The optimisation",at: "16:00", tint: C.apricot, daily: true,  kind: "post",   note: "X · Reagan." },
  { id: "vspot",    name: "The V Spot",      at: "16:00", tint: C.sky,     daily: true,  kind: "written",note: "Daily drop." },
  { id: "x4",       name: "The mechanism",   at: "20:00", tint: C.apricot, daily: true,  kind: "post",   note: "X · Jimmy." },

  { id: "ostrich",  name: "The Ostrich Report", at: "15:00", tint: C.lilac, dow: [2], kind: "show",    note: "Record with Hendrik." },
  { id: "substack", name: "Substack long form", at: "13:00", tint: C.blush, dow: [4], kind: "written", note: "The week's essay." },
  { id: "supp",     name: "Sunday Supplement",  at: "11:00", tint: C.lilac, dow: [5], kind: "show",    note: "Record the long form." },
  { id: "corr",     name: "Correspondent film", at: "14:00", tint: C.sand,  dow: [3], kind: "video",   note: "One of the three." },
];

const KINDS = {
  written: { label: "Written", c: C.ink },
  video:   { label: "Video",   c: C.red },
  post:    { label: "Post",    c: C.ink2 },
  show:    { label: "Show",    c: C.ink },
  input:   { label: "Input",   c: C.ink3 },
};

export default function Week({ today, cal, onSetCal, published }) {
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState(null);
  const [text, setText] = useState("");

  const days = useMemo(() => {
    const start = new Date(today);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7) + offset * 7);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [today, offset]);

  const slotsFor = (d) => {
    const dow = d.getDay();
    const weekend = dow === 0 || dow === 6;
    return SLOTS.filter((s) => {
      if (s.dow) return s.dow.includes(dow);
      return s.daily && !weekend;
    }).filter((s) => filter === "all" || s.kind === filter);
  };

  /* A slot is filled if something was written into it, or — for video — if a
     clip actually shipped that day. Publishing counts without being told. */
  const value = (d, s) => {
    const k = iso(d);
    const v = cal[k]?.[s.id];
    if (v) return v;
    if (s.kind === "video" && published.some((p) => p.date === k)) return "shipped";
    return "";
  };

  const stats = useMemo(() => {
    let open = 0, filled = 0;
    days.forEach((d) => slotsFor(d).forEach((s) => {
      if (s.kind === "input") return;
      value(d, s) ? filled++ : open++;
    }));
    return { open, filled, total: open + filled };
  }, [days, cal, filter, published]);

  const label = offset === 0 ? "This week" : offset === 1 ? "Next week" : offset === -1 ? "Last week" : `${offset > 0 ? "+" : ""}${offset} weeks`;

  return (
    <div>
      <Note>
        Every slot the week can carry. The empty ones are the point — a calendar
        that only shows what you planned tells you nothing.
      </Note>

      <Card style={{ marginBottom: 14 }}>
        <div className="flex items-center justify-between gap-3">
          <button onClick={() => setOffset(offset - 1)} className="tap"
            style={{ background: "none", border: "none", cursor: "pointer", color: C.ink2, fontSize: 20, padding: "0 6px" }}>‹</button>
          <div style={{ textAlign: "center" }}>
            <Big s={22}>{label.toUpperCase()}</Big>
            <div style={{ marginTop: 3 }}>
              <Mono s={9}>{days[0].getDate()} {days[0].toLocaleDateString("en-GB", { month: "short" })} – {days[6].getDate()} {days[6].toLocaleDateString("en-GB", { month: "short" })}</Mono>
            </div>
          </div>
          <button onClick={() => setOffset(offset + 1)} className="tap"
            style={{ background: "none", border: "none", cursor: "pointer", color: C.ink2, fontSize: 20, padding: "0 6px" }}>›</button>
        </div>

        <div className="flex items-center gap-3" style={{ marginTop: 14 }}>
          <div style={{ flex: 1, height: 8, borderRadius: 999, background: "rgba(20,24,51,.08)", overflow: "hidden" }}>
            <div style={{ width: `${stats.total ? (stats.filled / stats.total) * 100 : 0}%`, height: "100%", background: C.ink }} />
          </div>
          <Mono s={9.5}>{stats.filled}/{stats.total} filled</Mono>
        </div>
        {stats.open > 0 && (
          <p style={{ fontSize: 12.5, color: C.ink2, lineHeight: 1.45, marginTop: 9 }}>
            {stats.open} open {stats.open === 1 ? "slot" : "slots"}. Not all of them need filling — but you cannot
            sell inventory you have not named.
          </p>
        )}
      </Card>

      <Chips
        items={[["all", "Everything"], ["written", "Written"], ["video", "Video"], ["post", "Posts"], ["show", "Shows"]]}
        value={filter} onChange={setFilter} />
      <div style={{ height: 14 }} />

      {days.map((d) => {
        const k = iso(d);
        const isToday = k === iso(today);
        const slots = slotsFor(d);
        if (!slots.length) return null;
        return (
          <div key={k} style={{ marginBottom: 14 }}>
            <div className="flex items-baseline gap-2" style={{ padding: "0 4px 8px" }}>
              <Big s={19} c={isToday ? C.red : C.ink}>
                {DAYS[d.getDay()]} {d.getDate()}
              </Big>
              {isToday && <Mono s={9} c={C.red}>today</Mono>}
            </div>

            {slots.map((s) => {
              const v = value(d, s);
              const key = `${k}:${s.id}`;
              const isEditing = editing === key;
              const kind = KINDS[s.kind];

              return (
                <div key={s.id} style={{
                  background: v ? s.tint : C.card, borderRadius: 18, padding: 14, marginBottom: 8,
                  boxShadow: SH, borderLeft: `3px solid ${v ? kind.c : "rgba(20,24,51,.1)"}`,
                }}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Mono s={9.5}>{s.at}</Mono>
                    <span style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>{s.name}</span>
                    <Mono s={8.5} c={kind.c}>{kind.label}</Mono>
                    <span style={{ marginLeft: "auto" }}>
                      {v
                        ? <Check size={15} strokeWidth={2.8} color={C.ink} />
                        : <Mono s={8.5} style={{ opacity: .6 }}>open</Mono>}
                    </span>
                  </div>

                  <div style={{ marginTop: 4 }}><Mono s={8.5} style={{ opacity: .7 }}>{s.note}</Mono></div>

                  {s.kind !== "input" && (
                    isEditing ? (
                      <div style={{ marginTop: 10 }}>
                        <Field tint="rgba(255,255,255,.75)" value={text} onChange={setText}
                          onEnter={() => { onSetCal(k, s.id, text.trim()); setEditing(null); }}
                          placeholder="What is going in this slot?" />
                        <div className="flex gap-2" style={{ marginTop: 8 }}>
                          <Pill sm onClick={() => { onSetCal(k, s.id, text.trim()); setEditing(null); }}>Save</Pill>
                          <Pill sm tone="ghost" onClick={() => setEditing(null)}>Cancel</Pill>
                          {v && (
                            <button onClick={() => { onSetCal(k, s.id, ""); setEditing(null); }} className="tap"
                              style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: C.ink2, display: "flex", alignItems: "center" }}>
                              <X size={15} strokeWidth={2.4} />
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => { setEditing(key); setText(v === "shipped" ? "" : v); }} className="tap"
                        style={{
                          width: "100%", marginTop: 10, textAlign: "left", cursor: "pointer",
                          background: v ? "rgba(255,255,255,.6)" : "rgba(20,24,51,.03)",
                          border: "none", borderRadius: 13, padding: "11px 13px",
                          fontFamily: BODY, fontSize: 13.5, color: v ? C.ink : C.ink2,
                        }}>
                        {v === "shipped" ? "Clip shipped — name it" : v || "+ fill this slot"}
                      </button>
                    )
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
