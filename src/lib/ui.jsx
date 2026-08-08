import React, { useState } from "react";

/* ============================================================
   src/lib/ui.jsx
   Tokens and primitives. Every room imports from here, so the
   palette lives in one place and cannot drift again.
   Contrast-checked: ink on ground 15.67:1, ink2 5.83:1,
   white on red 6.56:1. Red is a fill, never text.
   ============================================================ */

export const C = {
  ground: "#F5F3EE",
  card: "#FFFFFF",
  ink: "#141833",
  ink2: "#565C82",
  ink3: "#767CA0",
  red: "#B81A1D",
  apricot: "#FFE0CE",
  sky: "#D6E8F5",
  mint: "#D6EFE0",
  lilac: "#E2DDF7",
  sand: "#F2E6D0",
  blush: "#FFD8D9",
  line: "rgba(20,24,51,0.10)",
};

export const DISPLAY = "'Big Shoulders Display','Oswald',Impact,sans-serif";
export const BODY = "'IBM Plex Sans',system-ui,-apple-system,sans-serif";
export const MONO = "'IBM Plex Mono',ui-monospace,monospace";

export const SH = "0 1px 2px rgba(20,24,51,.04), 0 6px 20px rgba(20,24,51,.06)";
export const SH_UP = "0 2px 6px rgba(20,24,51,.06), 0 18px 44px rgba(20,24,51,.14)";
export const R = 24;

/* ---------- text ---------- */

export const Mono = ({ children, c = C.ink2, s = 10, style }) => (
  <span style={{ fontFamily: MONO, fontSize: s, letterSpacing: ".12em", textTransform: "uppercase", color: c, ...style }}>
    {children}
  </span>
);

export const Big = ({ children, s = 30, c = C.ink, style }) => (
  <div style={{ fontFamily: DISPLAY, fontSize: s, fontWeight: 800, lineHeight: 1, color: c, letterSpacing: ".01em", ...style }}>
    {children}
  </div>
);

export const Note = ({ children }) => (
  <p style={{ fontSize: 14, color: C.ink2, lineHeight: 1.55, marginBottom: 18 }}>{children}</p>
);

/* ---------- surfaces ---------- */

export const Card = ({ tint = C.card, children, pad = 20, style, accent }) => (
  <div style={{
    background: tint, borderRadius: R, padding: pad, boxShadow: SH,
    ...(accent ? { borderLeft: `3px solid ${accent}` } : {}),
    ...style,
  }}>
    {children}
  </div>
);

export const Section = ({ label, right, children, style }) => (
  <div style={{ marginBottom: 18, ...style }}>
    <div className="flex items-center justify-between gap-3" style={{ padding: "0 4px 8px" }}>
      <Mono>{label}</Mono>
      {right}
    </div>
    {children}
  </div>
);

/* ---------- controls ---------- */

export function Pill({ children, onClick, tone = "solid", full, icon: I, disabled, sm, danger }) {
  const solid = tone === "solid";
  const bg = danger ? C.red : C.ink;
  return (
    <button onClick={onClick} disabled={disabled} className="tap"
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
        width: full ? "100%" : "auto", padding: sm ? "10px 15px" : "14px 22px", borderRadius: 999,
        fontFamily: BODY, fontSize: sm ? 13 : 15, fontWeight: 600,
        background: disabled ? "rgba(20,24,51,.05)" : solid ? bg : "transparent",
        color: disabled ? C.ink3 : solid ? "#fff" : C.ink,
        border: solid ? "none" : "1.5px solid rgba(20,24,51,.15)",
        cursor: disabled ? "not-allowed" : "pointer",
        whiteSpace: "nowrap",
      }}>
      {I && <I size={sm ? 14 : 17} strokeWidth={2.2} />}
      {children}
    </button>
  );
}

export function Chips({ items, value, onChange }) {
  return (
    <div className="sc flex gap-2" style={{ overflowX: "auto", paddingBottom: 2 }}>
      {items.map(([k, label]) => (
        <button key={k} onClick={() => onChange(k)} className="tap"
          style={{
            flexShrink: 0, padding: "9px 15px", borderRadius: 999, cursor: "pointer",
            fontFamily: BODY, fontSize: 13.5, fontWeight: value === k ? 600 : 500,
            background: value === k ? C.ink : "transparent",
            color: value === k ? "#fff" : C.ink2,
            border: value === k ? "none" : "1.5px solid rgba(20,24,51,.14)",
          }}>
          {label}
        </button>
      ))}
    </div>
  );
}

export function Field({ value, onChange, placeholder, onEnter, rows, tint = "rgba(20,24,51,.04)" }) {
  const shared = {
    width: "100%", boxSizing: "border-box", background: tint, border: "1.5px solid transparent",
    borderRadius: 14, padding: rows ? 13 : "13px 15px", fontFamily: BODY, fontSize: 14.5,
    color: C.ink, lineHeight: 1.55, outline: "none",
  };
  if (rows) {
    return <textarea value={value} rows={rows} placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => { if (onEnter && e.key === "Enter" && (e.metaKey || e.ctrlKey)) onEnter(); }}
      style={{ ...shared, resize: "none" }} />;
  }
  return <input value={value} placeholder={placeholder}
    onChange={(e) => onChange(e.target.value)}
    onKeyDown={(e) => { if (onEnter && e.key === "Enter") onEnter(); }}
    style={shared} />;
}

/* ---------- state ---------- */

export const Empty = ({ children }) => (
  <Card><p style={{ fontSize: 13.5, color: C.ink2, lineHeight: 1.55 }}>{children}</p></Card>
);

export const Working = ({ children }) => (
  <Card>
    <div className="lamp"><Mono c={C.red}>{children || "Working…"}</Mono></div>
  </Card>
);

/** Errors say what happened and what to do. Never a bare "failed". */
export function Problem({ children, onDismiss }) {
  if (!children) return null;
  return (
    <Card tint={C.blush} style={{ marginBottom: 14 }}>
      <div className="flex items-start gap-3">
        <span style={{ fontSize: 13.5, color: C.ink, lineHeight: 1.5, flex: 1 }}>{children}</span>
        {onDismiss && (
          <button onClick={onDismiss} className="tap"
            style={{ background: "none", border: "none", cursor: "pointer", color: C.ink2, fontSize: 16, lineHeight: 1, padding: 0 }}>
            ✕
          </button>
        )}
      </div>
    </Card>
  );
}

/** Two-step confirm. Anything that leaves the building uses this. */
export function Confirm({ label, confirmLabel, onConfirm, disabled, sm, full }) {
  const [armed, setArmed] = useState(false);
  if (!armed) {
    return <Pill sm={sm} full={full} disabled={disabled} tone="ghost" onClick={() => setArmed(true)}>{label}</Pill>;
  }
  return (
    <span className="flex gap-2" style={{ width: full ? "100%" : "auto" }}>
      <Pill sm={sm} danger full={full} onClick={() => { setArmed(false); onConfirm(); }}>
        {confirmLabel || "Yes, do it"}
      </Pill>
      <Pill sm={sm} tone="ghost" onClick={() => setArmed(false)}>Cancel</Pill>
    </span>
  );
}

/* ---------- dates ---------- */

export const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
export const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export function daysSince(dateStr, today = new Date()) {
  if (!dateStr) return null;
  const ms = new Date(today).setHours(0, 0, 0, 0) - new Date(dateStr).setHours(0, 0, 0, 0);
  return Math.max(0, Math.round(ms / 86400000));
}

export function weekDates(today) {
  const d = new Date(today);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(d);
    x.setDate(d.getDate() + i);
    return iso(x);
  });
}

/* ---------- parsing ----------
   Tool use means several text blocks. Take the last valid JSON array, and
   carry the raw reply on the error so the UI can show what it actually said.
   A parse error with the reply thrown away tells you nothing. */

export function parseJSON(text) {
  const t = String(text || "").replace(/```json/gi, "").replace(/```/g, "").trim();
  const end = t.lastIndexOf("]");
  if (end === -1) {
    const e = new Error(t ? `It replied with prose instead of data: "${t.slice(0, 300)}"` : "It returned nothing at all.");
    e.raw = t;
    throw e;
  }
  for (let i = t.lastIndexOf("[", end); i !== -1; i = t.lastIndexOf("[", i - 1)) {
    try {
      const v = JSON.parse(t.slice(i, end + 1));
      if (Array.isArray(v)) return v;
    } catch { /* keep walking back */ }
    if (i === 0) break;
  }
  throw new Error(`Found brackets but could not parse the list, which usually means the reply was cut off. It started: "${t.slice(0, 200).replace(/\s+/g, " ")}..."`);
}

export function parseObject(text) {
  const t = String(text || "").replace(/```json/gi, "").replace(/```/g, "").trim();
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a === -1 || b === -1) throw new Error(`Expected an object, got: "${t.slice(0, 200)}"`);
  return JSON.parse(t.slice(a, b + 1));
}
