import React, { useState, useEffect } from "react";
import { Video, ChevronRight } from "lucide-react";
import { C, BODY, MONO, SH, Mono } from "./ui.jsx";

/* ============================================================
   src/lib/Diary.jsx

   Lives in the shell, not in a room, so the day is visible from
   wherever you are. You should never have to navigate back to
   Today to find out a call starts in four minutes.

   Fetches once and holds it. Re-fetching on every room change
   would hammer /api/agenda for data that changes hourly at most.
   ============================================================ */

let cache = null;          // module scope, so it survives room switches
let cachedAt = 0;
const TTL = 10 * 60 * 1000;

export default function Diary({ compact }) {
  const [state, setState] = useState(cache);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    let live = true;
    if (cache && Date.now() - cachedAt < TTL) { setState(cache); return; }
    (async () => {
      try {
        const res = await fetch("/api/agenda", { credentials: "same-origin" });
        const d = await res.json();
        cache = { ...d, loading: false };
        cachedAt = Date.now();
        if (live) setState(cache);
      } catch (e) {
        const fail = { loading: false, reason: `Could not reach the calendar: ${e.message}`, events: [] };
        cache = fail; cachedAt = Date.now();
        if (live) setState(fail);
      }
    })();
    return () => { live = false; };
  }, []);

  /* Ticks once a minute so "starts in 4 min" stays true. */
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  if (!state) {
    return <div style={{ padding: "6px 20px 12px" }}><Mono>Reading the diary…</Mono></div>;
  }

  if (state.reason) {
    return (
      <div style={{ padding: "0 16px 12px" }}>
        <div style={{ background: C.blush, borderRadius: 16, padding: "11px 14px" }}>
          <span style={{ fontSize: 12.5, color: C.ink, lineHeight: 1.4 }}>{state.reason}</span>
        </div>
      </div>
    );
  }

  const events = state.events || [];
  if (!events.length) {
    return (
      <div style={{ padding: "0 16px 12px" }}>
        <div style={{ background: C.card, borderRadius: 16, padding: "11px 14px", boxShadow: SH }}>
          <Mono s={9.5}>Nothing in the diary. That is a result, not a gap.</Mono>
        </div>
      </div>
    );
  }

  const next = events.find((e) => e.id === state.nextId);
  const mins = next?.startISO ? Math.round((new Date(next.startISO) - now) / 60000) : null;
  const soon = mins !== null && mins > 0 && mins <= 15;

  /* Compact form for room headers: the next thing, and a way into it. */
  if (compact) {
    if (!next) return null;
    return (
      <div style={{ padding: "0 16px 12px" }}>
        <div style={{
          background: soon ? C.red : C.card, borderRadius: 16, padding: "11px 14px",
          boxShadow: SH, display: "flex", alignItems: "center", gap: 10,
        }}>
          <Mono s={9.5} c={soon ? "#fff" : C.ink2}>{next.at}</Mono>
          <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 500, color: soon ? "#fff" : C.ink, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
            {next.who}
          </span>
          {mins !== null && mins > 0 && mins <= 60 && (
            <Mono s={9} c={soon ? "rgba(255,255,255,.8)" : C.ink2}>in {mins}m</Mono>
          )}
          {next.join && (
            <a href={next.join} target="_blank" rel="noopener noreferrer" className="tap"
              style={{
                flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 4,
                background: soon ? "#fff" : "rgba(20,24,51,.06)", color: C.ink,
                borderRadius: 999, padding: "6px 11px", fontFamily: BODY, fontSize: 12,
                fontWeight: 600, textDecoration: "none",
              }}>
              <Video size={12} strokeWidth={2.4} />Join
            </a>
          )}
        </div>
      </div>
    );
  }

  /* Full ticker. */
  return (
    <div className="sc" style={{ display: "flex", gap: 9, overflowX: "auto", padding: "0 16px 14px" }}>
      {events.map((e) => {
        const isNext = e.id === state.nextId;
        const m = e.startISO ? Math.round((new Date(e.startISO) - now) / 60000) : null;
        const urgent = isNext && m !== null && m > 0 && m <= 15;
        return (
          <div key={e.id} style={{
            flexShrink: 0, minWidth: 156,
            background: urgent ? C.red : isNext ? C.ink : C.card,
            borderRadius: 20, padding: 14, boxShadow: SH, opacity: e.past ? 0.45 : 1,
          }}>
            <Mono c={isNext ? C.sand : C.ink2} s={9.5}>
              {e.at}{e.len ? ` · ${e.len}` : ""}
            </Mono>
            <div style={{ fontSize: 13.5, fontWeight: 500, color: isNext ? "#fff" : C.ink, lineHeight: 1.3, marginTop: 5, minHeight: 34 }}>
              {e.who}
            </div>
            {isNext && m !== null && m > 0 && m <= 60 && (
              <div style={{ marginTop: 4 }}><Mono s={9} c="rgba(255,255,255,.75)">starts in {m} min</Mono></div>
            )}
            {e.join && !e.past && (
              <a href={e.join} target="_blank" rel="noopener noreferrer" className="tap"
                style={{
                  marginTop: 9, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                  background: isNext ? C.sand : "rgba(20,24,51,.06)", color: C.ink, borderRadius: 999,
                  padding: "8px 0", fontFamily: BODY, fontSize: 12.5, fontWeight: 600, textDecoration: "none",
                }}>
                <Video size={13} strokeWidth={2.4} />Join
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}
