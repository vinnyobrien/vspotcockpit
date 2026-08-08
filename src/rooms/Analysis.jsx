import React, { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import {
  C, BODY, MONO, Mono, Big, Card, Section, Note, Empty,
} from "../lib/ui.jsx";

/* ============================================================
   src/rooms/Analysis.jsx

   Monthly, not daily. Reads what actually shipped rather than
   what was planned — the ledger, the published list, and the
   thread record.

   The only room with a cadence longer than a day, which is why
   it carries no badge and sits last.
   ============================================================ */

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export default function Analysis({ ledger, published, threads, history, today }) {
  const month = today.getMonth();
  const year = today.getFullYear();
  const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;

  const stats = useMemo(() => {
    const thisMonth = ledger.filter((l) => (l.date || "").startsWith(prefix));
    const shipped = published.filter((p) => (p.date || "").startsWith(prefix));
    const byKind = {};
    thisMonth.forEach((l) => { byKind[l.kind] = (byKind[l.kind] || 0) + 1; });
    const byPlatform = {};
    shipped.forEach((p) => { byPlatform[p.platform] = (byPlatform[p.platform] || 0) + 1; });
    const days = Object.entries(history).filter(([d]) => d.startsWith(prefix)).map(([, v]) => v.pct);
    const avg = days.length ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : null;
    return { total: thisMonth.length + shipped.length, byKind, byPlatform, shipped: shipped.length, avg, days: days.length };
  }, [ledger, published, history, prefix]);

  /* Threads that have gone quiet. Not a failure, but worth seeing. */
  const cold = useMemo(() => {
    return threads
      .filter((t) => t.last)
      .map((t) => ({ ...t, d: Math.floor((Date.now() - new Date(t.last)) / 86400000) }))
      .filter((t) => t.d > 21)
      .sort((a, b) => b.d - a.d)
      .slice(0, 5);
  }, [threads]);

  const unfired = threads.filter((t) => !t.last);

  if (!ledger.length && !published.length) {
    return (
      <div>
        <Note>Monthly, not daily. It reads what actually shipped rather than what was planned.</Note>
        <Empty>Nothing logged yet. This fills as the ledger does — a month is the shortest useful window.</Empty>
      </div>
    );
  }

  return (
    <div>
      <Note>Monthly, not daily. Read from the record of what actually left the building.</Note>

      <Card tint={C.mint} style={{ marginBottom: 12 }}>
        <Mono>{MONTHS[month]}</Mono>
        <div style={{ marginTop: 8 }}><Big s={42}>{stats.total} SHIPPED</Big></div>
        <p style={{ fontSize: 13.5, color: C.ink2, marginTop: 8, lineHeight: 1.5 }}>
          {Object.entries(stats.byKind).map(([k, v]) => `${v} ${k}`).join(", ") || "Nothing drafted"}
          {stats.shipped ? `, ${stats.shipped} clips published` : ""}.
          {stats.avg !== null ? ` Rundown averaging ${stats.avg}% across ${stats.days} days.` : ""}
        </p>
      </Card>

      {Object.keys(stats.byPlatform).length > 0 && (
        <Section label="Where it went">
          <Card>
            {Object.entries(stats.byPlatform).sort((a, b) => b[1] - a[1]).map(([p, n]) => {
              const max = Math.max(...Object.values(stats.byPlatform));
              return (
                <div key={p} className="flex items-center gap-3" style={{ padding: "8px 0" }}>
                  <span style={{ fontSize: 13.5, color: C.ink, width: 90, flexShrink: 0 }}>{p}</span>
                  <div style={{ flex: 1, height: 7, borderRadius: 999, background: "rgba(20,24,51,.07)" }}>
                    <div style={{ width: `${(n / max) * 100}%`, height: "100%", borderRadius: 999, background: C.ink }} />
                  </div>
                  <Mono s={9}>{n}</Mono>
                </div>
              );
            })}
          </Card>
        </Section>
      )}

      {cold.length > 0 && (
        <Section label="Threads going cold">
          {cold.map((t) => (
            <Card key={t.id} pad={16} accent={t.d > 60 ? C.red : undefined} style={{ marginBottom: 8 }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div style={{ fontSize: 14.5, color: C.ink, fontWeight: 500 }}>{t.name}</div>
                  <p style={{ fontSize: 12.5, color: C.ink2, marginTop: 4, lineHeight: 1.45 }}>{t.note}</p>
                </div>
                <Mono s={9} c={t.d > 60 ? C.red : C.ink2}>{t.d}d</Mono>
              </div>
            </Card>
          ))}
          <p style={{ fontSize: 12.5, color: C.ink2, lineHeight: 1.5, padding: "4px 6px" }}>
            Revive them or retire them. A thread nobody continues is a thread that was never one.
          </p>
        </Section>
      )}

      {unfired.length > 0 && (
        <Section label={`Loaded and unfired · ${unfired.length}`}>
          <Card tint={C.sand}>
            {unfired.map((t, i) => (
              <div key={t.id} style={{ padding: "9px 0", borderTop: i ? "1px solid rgba(20,24,51,.07)" : "none" }}>
                <div style={{ fontSize: 14, color: C.ink, fontWeight: 500 }}>{t.name}</div>
                <div style={{ fontSize: 12.5, color: C.ink2, marginTop: 3, lineHeight: 1.45 }}>{t.note}</div>
              </div>
            ))}
          </Card>
        </Section>
      )}

      <Card tint={C.blush} pad={16} style={{ marginTop: 8 }}>
        <div className="flex items-start gap-2.5">
          <AlertTriangle size={16} strokeWidth={2.3} color={C.red} style={{ marginTop: 1, flexShrink: 0 }} />
          <p style={{ fontSize: 12.5, color: C.ink2, lineHeight: 1.5 }}>
            Platform analytics are not wired in. YouTube and Meta both expose them cleanly over the OAuth
            you already have; Substack has no public API and X charges for it. What you see here is what
            the Cockpit itself recorded, which is the half nobody else can tell you.
          </p>
        </div>
      </Card>
    </div>
  );
}
