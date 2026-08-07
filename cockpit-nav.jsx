import React, { useState, useRef, useEffect } from "react";
import { Clock, PenTool, Users, BarChart3 } from "lucide-react";

/* ============================================================
   Navigation model — all ten screens, two moves maximum.

   Tap a tab, swipe within it. Horizontal gesture moves between
   sibling screens; vertical stays free for actual scrolling,
   which is the thing a full-page reel would have taken away.
   ============================================================ */

const C = {
  ground: "#F5F3EE", ink: "#141833", ink2: "#565C82", red: "#B81A1D", white: "#fff",
  apricot: "#FFE0CE", sky: "#D6E8F5", mint: "#D6EFE0", lilac: "#E2DDF7", sand: "#F2E6D0", blush: "#FFD8D9",
};
const DISPLAY = "'Big Shoulders Display','Oswald',Impact,sans-serif";
const BODY = "'IBM Plex Sans',system-ui,sans-serif";
const MONO = "'IBM Plex Mono',ui-monospace,monospace";
const SHADOW = "0 1px 2px rgba(20,24,51,.04), 0 8px 24px rgba(20,24,51,.07)";

const GROUPS = [
  { id: "today", label: "Today", icon: Clock, screens: [
    { id: "run", name: "Run of day", tint: C.apricot, note: "Nine slots. One live.", stat: "3 need you" },
    { id: "wire", name: "The Wire", tint: C.sand, note: "Morning sweep, 18 headlines.", stat: "3 flagged" },
  ]},
  { id: "make", label: "Make", icon: PenTool, screens: [
    { id: "desk", name: "The Desk", tint: C.sky, note: "Editorial chat with your back catalogue.", stat: "2 threads" },
    { id: "clips", name: "Clips", tint: C.mint, note: "Swipe deck. Publish or skip.", stat: "12 waiting" },
    { id: "essay", name: "Essay", tint: C.lilac, note: "Argue a V Spot piece into shape.", stat: "1 draft" },
    { id: "video", name: "Video", tint: C.blush, note: "Sixty Seconds and correspondent cuts.", stat: "Posted 07:30" },
    { id: "shows", name: "Shows", tint: C.apricot, note: "Struggle Bus, Watson Weekend.", stat: "S3 live" },
    { id: "build", name: "Build", tint: C.sand, note: "Sites, decks, deployments.", stat: "2 open" },
  ]},
  { id: "people", label: "People", icon: Users, screens: [
    { id: "guests", name: "Guests", tint: C.mint, note: "Assets outstanding on two bookings.", stat: "5 of 12" },
    { id: "cast", name: "The Cast", tint: C.lilac, note: "Correspondents and recurring characters.", stat: "6 active" },
    { id: "growth", name: "Growth", tint: C.sky, note: "Camp Tralee sponsors and pipeline.", stat: "3 open" },
  ]},
  { id: "back", label: "Look back", icon: BarChart3, screens: [
    { id: "analysis", name: "Analysis", tint: C.sand, note: "What ran, what landed.", stat: "Week to date" },
  ]},
];

function Swiper({ screens, groupId }) {
  const [i, setI] = useState(0);
  const [dx, setDx] = useState(0);
  const start = useRef(null);
  const box = useRef(null);
  const w = useRef(1);

  useEffect(() => { setI(0); setDx(0); }, [groupId]);
  useEffect(() => {
    const m = () => { if (box.current) w.current = box.current.offsetWidth; };
    m(); window.addEventListener("resize", m);
    return () => window.removeEventListener("resize", m);
  }, []);

  const down = (e) => { start.current = e.clientX; e.currentTarget.setPointerCapture(e.pointerId); };
  const move = (e) => {
    if (start.current === null) return;
    let d = e.clientX - start.current;
    if ((i === 0 && d > 0) || (i === screens.length - 1 && d < 0)) d *= 0.32;
    setDx(d);
  };
  const up = () => {
    if (start.current === null) return;
    const t = Math.min(70, w.current * 0.18);
    if (dx < -t && i < screens.length - 1) setI(i + 1);
    else if (dx > t && i > 0) setI(i - 1);
    start.current = null; setDx(0);
  };

  return (
    <div>
      {/* chip row — random access within the group */}
      {screens.length > 1 && (
        <div className="ck-scroll flex gap-2" style={{ overflowX: "auto", padding: "2px 0 14px" }}>
          {screens.map((s, n) => (
            <button
              key={s.id} onClick={() => setI(n)} className="ck-tap"
              style={{
                flexShrink: 0, padding: "9px 15px", borderRadius: 999, cursor: "pointer",
                fontFamily: BODY, fontSize: 13.5, fontWeight: n === i ? 600 : 500,
                background: n === i ? C.ink : "transparent",
                color: n === i ? C.white : C.ink2,
                border: n === i ? "none" : "1.5px solid rgba(20,24,51,.14)",
              }}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      <div ref={box} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        style={{ overflow: "hidden", touchAction: "pan-y", cursor: "grab" }}>
        <div style={{
          display: "flex",
          transform: `translateX(calc(${-i * 100}% + ${dx}px))`,
          transition: start.current === null ? "transform .38s cubic-bezier(.22,1,.36,1)" : "none",
        }}>
          {screens.map((s) => (
            <div key={s.id} style={{ minWidth: "100%", paddingRight: 2 }}>
              <div style={{ background: s.tint, borderRadius: 28, padding: 26, minHeight: 300, boxShadow: SHADOW, display: "flex", flexDirection: "column" }}>
                <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: ".14em", textTransform: "uppercase", color: C.ink2 }}>
                  {s.stat}
                </span>
                <div style={{ fontFamily: DISPLAY, fontSize: 42, fontWeight: 800, lineHeight: 1, color: C.ink, marginTop: 12 }}>
                  {s.name.toUpperCase()}
                </div>
                <p style={{ fontSize: 15, color: C.ink2, lineHeight: 1.55, marginTop: 12 }}>{s.note}</p>
                <div style={{ marginTop: "auto", paddingTop: 22 }}>
                  <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".12em", color: C.ink2, opacity: .75 }}>
                    SCREEN CONTENT GOES HERE
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {screens.length > 1 && (
        <div className="flex justify-center gap-1.5" style={{ paddingTop: 14 }}>
          {screens.map((s, n) => (
            <span key={s.id} style={{
              width: n === i ? 20 : 6, height: 6, borderRadius: 999,
              background: n === i ? C.ink : "rgba(20,24,51,.18)", transition: "width .3s ease",
            }} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Nav() {
  const [g, setG] = useState(1);

  useEffect(() => {
    if (document.getElementById("ck-fonts")) return;
    const l = document.createElement("link");
    l.id = "ck-fonts"; l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;800&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap";
    document.head.appendChild(l);
  }, []);

  const group = GROUPS[g];

  return (
    <div style={{ background: "#E8E5DE", minHeight: "100vh", fontFamily: BODY }}>
      <style>{`
        .ck-tap:active{transform:scale(.96)}
        .ck-tap:focus-visible{outline:2.5px solid ${C.ink};outline-offset:3px}
        .ck-scroll::-webkit-scrollbar{display:none}
        @media (prefers-reduced-motion:reduce){*{transition:none!important}}
      `}</style>

      <div style={{ maxWidth: 430, margin: "0 auto", background: C.ground, minHeight: "100vh", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
        <div style={{ padding: "20px 20px 8px" }}>
          <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: ".14em", color: C.ink2 }}>FRIDAY 7 AUGUST</span>
          <div style={{ fontFamily: DISPLAY, fontSize: 27, fontWeight: 800, color: C.ink, lineHeight: 1, letterSpacing: ".03em" }}>
            THE COCKPIT
          </div>
        </div>

        <div className="ck-scroll" style={{ flex: 1, overflowY: "auto", padding: "10px 16px 110px", scrollbarWidth: "none" }}>
          <Swiper screens={group.screens} groupId={group.id} />
          <p style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: ".1em", color: C.ink2, textAlign: "center", marginTop: 22, opacity: .7 }}>
            {group.screens.length > 1 ? "SWIPE BETWEEN SCREENS" : "SINGLE SCREEN"}
          </p>
        </div>

        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(245,243,238,.92)", backdropFilter: "blur(14px)", borderTop: "1px solid rgba(20,24,51,.08)", padding: "9px 8px 22px", display: "flex", justifyContent: "space-around" }}>
          {GROUPS.map((x, n) => {
            const on = n === g; const Icon = x.icon;
            return (
              <button key={x.id} onClick={() => setG(n)} className="ck-tap"
                style={{ background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 5, padding: "6px 10px", position: "relative", minWidth: 66 }}>
                <Icon size={22} strokeWidth={on ? 2.5 : 2} color={on ? C.ink : C.ink2} />
                <span style={{ fontSize: 11, fontWeight: on ? 600 : 500, color: on ? C.ink : C.ink2, whiteSpace: "nowrap" }}>{x.label}</span>
                {on && <span style={{ position: "absolute", bottom: -1, width: 20, height: 3, borderRadius: 999, background: C.ink }} />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
