import React, { useState } from "react";
import { login } from "./api.js";

export default function Login({ onIn }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!pw) return;
    setBusy(true);
    setErr("");
    const ok = await login(pw);
    setBusy(false);
    if (ok) onIn();
    else setErr("Not that one.");
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#0A0A0A", fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
      <div style={{ width: 300 }}>
        <h1 style={{ fontFamily: "'Big Shoulders Display', sans-serif", fontWeight: 900, fontSize: 44, lineHeight: 0.9, color: "#E8272A", textShadow: "0 0 18px rgba(232,39,42,.45)", margin: 0 }}>
          THE COCKPIT
        </h1>
        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: ".24em", color: "#D2B48C", marginTop: 6, marginBottom: 20 }}>
          A V SPOT NETWORK PRODUCTION
        </div>
        <input
          type="password"
          autoFocus
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Password"
          style={{ width: "100%", background: "#12162E", border: "1px solid rgba(210,180,140,0.18)", color: "#EDEDF2", padding: "10px 12px", fontSize: 14 }}
        />
        <button
          onClick={submit}
          disabled={busy}
          style={{ width: "100%", marginTop: 8, background: "#E8272A", color: "#0A0A0A", border: "none", padding: "10px", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: ".14em", cursor: "pointer" }}
        >
          {busy ? "CHECKING…" : "GO ON AIR"}
        </button>
        {err && <p style={{ color: "#E8272A", fontSize: 12.5, marginTop: 10 }}>{err}</p>}
      </div>
    </div>
  );
}
