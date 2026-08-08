import React, { useState } from "react";
import { login } from "./api.js";

const C = {
  ground: "#F5F3EE", card: "#FFFFFF", ink: "#141833",
  ink2: "#565C82", red: "#B81A1D",
};

export default function Login({ onIn }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!pw) return;
    setBusy(true);
    setErr("");
    try {
      const ok = await login(pw);
      if (ok) onIn();
      else setErr("Not that one.");
    } catch (e) {
      setErr(e?.message || "Could not reach the server.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20, background: C.ground, fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 330, background: C.card, borderRadius: 28, padding: 28, boxShadow: "0 1px 2px rgba(20,24,51,.04), 0 8px 28px rgba(20,24,51,.08)" }}>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 9.5, letterSpacing: ".2em", color: C.ink2, textTransform: "uppercase" }}>
          A V Spot Network production
        </div>
        <h1 style={{ fontFamily: "'Big Shoulders Display', sans-serif", fontWeight: 800, fontSize: 44, lineHeight: .92, color: C.ink, margin: "10px 0 22px", letterSpacing: ".02em" }}>
          THE COCKPIT
        </h1>
        <input
          type="password" autoFocus value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Password"
          style={{ width: "100%", boxSizing: "border-box", background: "rgba(20,24,51,.04)", border: "1.5px solid transparent", borderRadius: 14, color: C.ink, padding: "14px 16px", fontSize: 15, fontFamily: "inherit", outline: "none" }}
        />
        <button
          onClick={submit} disabled={busy || !pw}
          style={{ width: "100%", marginTop: 10, background: busy || !pw ? "rgba(20,24,51,.06)" : C.ink, color: busy || !pw ? C.ink2 : "#fff", border: "none", borderRadius: 999, padding: "15px", fontFamily: "inherit", fontSize: 15, fontWeight: 600, cursor: busy || !pw ? "not-allowed" : "pointer" }}
        >
          {busy ? "Checking…" : "Go on air"}
        </button>
        {err && (
          <div style={{ marginTop: 12, background: "#FFD8D9", borderRadius: 14, padding: "12px 14px", fontSize: 13.5, color: C.ink, lineHeight: 1.45 }}>
            {err}
          </div>
        )}
        <div style={{ marginTop: 22, paddingTop: 16, borderTop: "1px solid rgba(20,24,51,.07)", fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, letterSpacing: ".14em", color: C.ink2, textTransform: "uppercase" }}>
          Tralee, Kerry
        </div>
      </div>
    </div>
  );
}
