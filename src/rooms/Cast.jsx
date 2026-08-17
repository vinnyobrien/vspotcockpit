import React, { useState, useRef, useCallback, useEffect } from "react";
import { Copy, Check, Upload, Pencil } from "lucide-react";
import {
  C, BODY, MONO, DISPLAY, SH, Mono, Big, Card, Section, Pill,
  Field, Note, Empty, Problem, Chips, Confirm, parseJSON,
} from "../lib/ui.jsx";
import { callOp, sGet, sSet } from "../api.js";
import { readyCast, getBlock, TREATMENTS } from "../lib/cast-blocks.js";

/* ============================================================
   src/rooms/Cast.jsx

   The Cast is not a mouthpiece. A correspondent carries a STANCE,
   which is what they believe before they read anything, and the
   generator is instructed to let that stance take them somewhere
   the editor did not go. A correspondent who only ever agrees is a
   filter with a hat on.

   Two checks are therefore INVERTED here relative to Sub-Editor.
   Voice similarity to Vinny is a defect, not a pass. Contradicting
   the archive is a note, not a halt. What still binds absolutely is
   the claim ledger: wrong about meaning, never about fact.

   Kapwing has no generation API. The render step is manual by
   nature, which sits exactly where the standing orders already put
   things. The room does the work to the last step. The last step is
   yours.

   Publishing reuses onPublish, the same handler the clip desk uses,
   so a Cast piece lands in the same published blob and Analysis
   counts it without knowing it was different.
   ============================================================ */

const ACCOUNTS = [
  { id: "6853f3c16581970b2eebf51a", platform: "YouTube", short: "YT", tint: C.blush,
    rule: "Video title, under 60 characters, no hashtags.", cap: 60 },
  { id: "6a6a4fc9b6bbd46119642533", platform: "TikTok", short: "TT", tint: C.mint,
    rule: "Hook first. One line of context.", cap: 300 },
  { id: "6a6a4ff343c4264488aa4fa0", platform: "X", short: "X", tint: C.sky,
    rule: "Single claim. No link — a URL costs 13x.", cap: 280 },
];

const MAX_MB = 512;

/* Kapwing takes one pasted block. Built here rather than by the model, because
   the treatment is a brand constant and does not need a token spent on it. */
function kapwingPrompt(scenes, correspondent) {
  const t = TREATMENTS[correspondent.treatment] || TREATMENTS["red-neon"];
  const shots = (scenes || [])
    .map((s) => `Scene ${s.n}. ${s.action}`)
    .join("\n");
  return [
    `Nine by sixteen vertical video, ${(scenes || []).length} scenes, roughly fifty seconds.`,
    "",
    `Consistent character throughout: ${correspondent.name}. Save this as a reusable persona on the first render so every future piece from this correspondent matches.`,
    "",
    shots,
    "",
    `Ground: ${t.ground}. Accent: ${t.accent}. Look: ${t.look}.`,
    t.forbid,
  ].join("\n");
}

function CopyBox({ label, text, tint, rows = 8 }) {
  const [done, setDone] = useState(false);
  return (
    <Card tint={tint} pad={16} style={{ marginBottom: 12 }}>
      <div className="flex items-center justify-between gap-2">
        <Mono s={9.5}>{label}</Mono>
        <Pill sm tone="ghost" icon={done ? Check : Copy}
          onClick={() => {
            navigator.clipboard?.writeText(text);
            setDone(true);
            setTimeout(() => setDone(false), 1600);
          }}>
          {done ? "Copied" : "Copy"}
        </Pill>
      </div>
      <p style={{
        fontFamily: label === "KAPWING PROMPT" ? MONO : BODY,
        fontSize: label === "KAPWING PROMPT" ? 11.5 : 13.5,
        color: C.ink, lineHeight: 1.55, marginTop: 10, whiteSpace: "pre-wrap",
      }}>{text}</p>
      <div style={{ height: rows === 0 ? 0 : 0 }} />
    </Card>
  );
}

/* One finished Cast clip, three platforms, three pieces of copy.
   Deliberately shaped like QueuedClip in Video.jsx. Same handler downstream. */
function CastPublish({ clip, captions, published, busy, onPublish }) {
  const [copy, setCopy] = useState(() => ({
    YouTube: (captions?.youtube || clip.title || "").slice(0, 100),
    TikTok: captions?.tiktok || "",
    X: (captions?.twitter || "").replace(/https?:\/\/\S+/g, "").trim(),
  }));
  const [editing, setEditing] = useState(null);

  return (
    <Card pad={18} style={{ marginBottom: 12 }}>
      <div style={{ fontFamily: DISPLAY, fontSize: 19, fontWeight: 800, lineHeight: 1.1, color: C.ink }}>
        {clip.title}
      </div>
      {clip.seconds && <div style={{ marginTop: 4 }}><Mono s={9}>{clip.seconds}s</Mono></div>}

      <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
        {ACCOUNTS.map((a) => {
          const shipped = published.find((p) => p.title === clip.title && p.platform === a.platform);
          const mine = busy === "pub" + clip.clipId + a.id;
          const text = copy[a.platform] || "";
          const isEditing = editing === a.platform;
          const over = text.length > a.cap;
          const hasLink = a.platform === "X" && /https?:\/\/|\w+\.(com|ie|co|news|app)\b/i.test(text);

          return (
            <div key={a.id} style={{ background: a.tint, borderRadius: 18, padding: 14, opacity: shipped ? 0.55 : 1 }}>
              <div className="flex items-center justify-between gap-2">
                <Mono s={9.5}>{a.platform}</Mono>
                <Mono s={9} c={over ? C.red : C.ink2}>{text.length}/{a.cap}</Mono>
              </div>

              {isEditing ? (
                <div style={{ marginTop: 9 }}>
                  <Field tint="rgba(255,255,255,.75)" rows={a.platform === "YouTube" ? 2 : 4}
                    value={text} onChange={(v) => setCopy({ ...copy, [a.platform]: v })} />
                </div>
              ) : (
                <p style={{ fontSize: 13.5, color: C.ink, lineHeight: 1.5, marginTop: 8, whiteSpace: "pre-wrap" }}>
                  {text || <span style={{ color: C.ink2 }}>Nothing written for {a.platform} yet.</span>}
                </p>
              )}

              <div style={{ marginTop: 6 }}>
                <Mono s={8.5} style={{ opacity: .75 }}>{a.rule}</Mono>
              </div>
              {hasLink && (
                <div style={{ marginTop: 5 }}>
                  <Mono s={8.5} c={C.red}>This carries a link. Reach drops and the post costs 13x.</Mono>
                </div>
              )}

              <div className="flex gap-2 items-center" style={{ marginTop: 11 }}>
                <Pill sm tone="ghost" icon={isEditing ? Check : Pencil}
                  onClick={() => setEditing(isEditing ? null : a.platform)}>
                  {isEditing ? "Done" : "Edit"}
                </Pill>
                <span style={{ marginLeft: "auto" }}>
                  {shipped
                    ? <Mono s={9}>Shipped ✓</Mono>
                    : mine
                      ? <Pill sm disabled>Posting…</Pill>
                      : <Confirm sm label={`Publish ${a.short}`} confirmLabel="Yes, publish"
                          disabled={!!busy || !text.trim() || over}
                          onConfirm={() => onPublish(clip, a, text)} />}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default function Cast({ published, onPublish, busy, K }) {
  const cast = readyCast();

  const [who, setWho] = useState(cast[0]?.id || null);
  const [material, setMaterial] = useState("");
  const [piece, setPiece] = useState(null);
  const [writing, setWriting] = useState(false);
  const [err, setErr] = useState("");

  const [uploading, setUploading] = useState(false);
  const [projectId, setProjectId] = useState(null);
  const [state, setState] = useState(null);
  const [clip, setClip] = useState(null);
  const fileRef = useRef(null);

  /* Write. The stance goes in whole; the op is instructed not to agree. */
  const write = useCallback(async () => {
    if (!who || !material.trim()) return;
    setWriting(true);
    setErr("");
    setPiece(null);
    try {
      const block = getBlock(who);
      const priorArt = (await sGet(K.castPrior, "")) || "";
      const r = await callOp({
        op: "cast",
        correspondent: block,
        material: material.trim(),
        priorArt,
      });
      const out = parseJSON(r.text);
      if (!out || !out.script) throw new Error("The correspondent returned nothing usable.");
      setPiece({ ...out, correspondent: block });
    } catch (e) {
      setErr(e.message || "Could not reach the correspondent.");
    }
    setWriting(false);
  }, [who, material, K]);

  /* Upload the Kapwing render, then submit in no-clip mode.
     The bytes go browser to signed URL directly. They never touch a function,
     which is the only way this fits inside the execution limit. */
  const upload = useCallback(async (file) => {
    if (!file || !piece) return;
    const mb = file.size / (1024 * 1024);
    if (mb > MAX_MB) {
      setErr(`${Math.round(mb)}MB is over the ${MAX_MB}MB ceiling. Long form belongs in Video.`);
      return;
    }
    setUploading(true);
    setErr("");
    try {
      const ext = (file.name.split(".").pop() || "mp4").toLowerCase();

      const link = await fetch("/api/cast-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: file.name, sizeMb: Math.ceil(mb), extension: ext }),
      }).then((r) => r.json());
      if (link.error) throw new Error(link.error);

      const put = await fetch(link.uploadUrl, { method: "PUT", body: file });
      if (!put.ok) throw new Error(`Upload rejected with ${put.status}.`);

      const sub = await fetch("/api/cast-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uploadId: link.uploadId,
          correspondent: piece.correspondent.name,
          slug: (piece.position || "").slice(0, 40),
        }),
      }).then((r) => r.json());
      if (sub.error) throw new Error(sub.error);

      setProjectId(sub.projectId);
      setState("processing");
    } catch (e) {
      setErr(e.message || "Upload failed.");
    }
    setUploading(false);
  }, [piece]);

  /* Poll. Processing takes minutes, so the wait lives in the client and not in
     a function that would die at ten seconds. */
  useEffect(() => {
    if (!projectId || state !== "processing") return;
    let live = true;
    const tick = async () => {
      try {
        const r = await fetch(`/api/cast-status?projectId=${encodeURIComponent(projectId)}`)
          .then((x) => x.json());
        if (!live) return;
        if (r.state === "ready") {
          setClip({
            clipId: r.clip.curationId,
            projectId,
            title: piece?.correspondent?.name
              ? `${piece.correspondent.name}: ${piece.position || ""}`.slice(0, 90)
              : r.clip.title,
            seconds: r.clip.durationSec,
          });
          setState("ready");
        } else if (r.state === "unexpected") {
          setErr(r.message || "Opus returned something unexpected. Do not publish.");
          setState("stuck");
        } else if (r.error) {
          setErr(r.error);
          setState("stuck");
        }
      } catch {
        /* transient; the next tick tries again */
      }
    };
    const h = setInterval(tick, 10000);
    tick();
    return () => { live = false; clearInterval(h); };
  }, [projectId, state, piece]);

  if (!cast.length) {
    return (
      <div>
        <Empty>
          No correspondent has a stance yet. A character block without a stance produces
          ventriloquism, so the room stays shut until one lands.
        </Empty>
      </div>
    );
  }

  return (
    <div>
      <Chips items={cast.map((c) => [c.id, c.name.split(" ")[0]])} value={who} onChange={setWho} />
      <div style={{ height: 18 }} />
      <Problem onDismiss={() => setErr("")}>{err}</Problem>

      <Note>
        The correspondent holds a position before reading anything and is instructed to land
        where that takes them. Disagreement with you is the format working, not a fault.
        Facts still bind absolutely.
      </Note>

      <Section label="Material" style={{ marginTop: 18 }}>
        <Card pad={16}>
          <Field rows={8} value={material} onChange={setMaterial}
            placeholder="Paste the raw material. Notes, observations, a story, your own reading of it. Everything the correspondent asserts must be traceable back to what goes in here." />
          <div style={{ marginTop: 12 }}>
            {writing
              ? <Pill full disabled>Writing…</Pill>
              : <Pill full onClick={write} disabled={!material.trim()}>
                  Send it to {getBlock(who).name.split(" ")[0]}
                </Pill>}
          </div>
        </Card>
      </Section>

      {piece && (
        <>
          <Section label="Position" style={{ marginTop: 24 }}>
            <Card tint={C.sand} pad={16}>
              <p style={{ fontSize: 14, color: C.ink, lineHeight: 1.5 }}>{piece.position}</p>
              {piece.divergence && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(20,24,51,.09)" }}>
                  <Mono s={9.5} c={C.red}>DIVERGES FROM YOU</Mono>
                  <p style={{ fontSize: 13, color: C.ink, lineHeight: 1.5, marginTop: 6 }}>
                    {piece.divergence}
                  </p>
                </div>
              )}
              {!piece.divergence && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(20,24,51,.09)" }}>
                  <Mono s={9.5}>NO DIVERGENCE</Mono>
                  <p style={{ fontSize: 13, color: C.ink2, lineHeight: 1.5, marginTop: 6 }}>
                    This correspondent landed where you did. Worth a second look before it goes out,
                    because a cast that always agrees is not a cast.
                  </p>
                </div>
              )}
            </Card>
          </Section>

          <Section label="Script" style={{ marginTop: 20 }}>
            <CopyBox label="SPOKEN" text={piece.script} tint={C.lilac} />
          </Section>

          {piece.claims?.length > 0 && (
            <Section label="Claims made" style={{ marginTop: 20 }}>
              <Card pad={0} style={{ padding: "6px 0" }}>
                {piece.claims.map((c, i) => (
                  <div key={i} style={{
                    padding: "10px 16px", fontSize: 12.5, color: C.ink, lineHeight: 1.45,
                    borderTop: i ? "1px solid rgba(20,24,51,.07)" : "none",
                  }}>{c}</div>
                ))}
              </Card>
              <div style={{ marginTop: 8 }}>
                <Mono s={8.5} style={{ opacity: .75 }}>
                  Wrong about meaning is allowed. Wrong about fact is not. Check these against the material.
                </Mono>
              </div>
            </Section>
          )}

          <Section label="Render" style={{ marginTop: 24 }}>
            <CopyBox label="KAPWING PROMPT"
              text={kapwingPrompt(piece.scenes, piece.correspondent)} tint={C.apricot} />
            <Card pad={16}>
              <p style={{ fontSize: 13, color: C.ink2, lineHeight: 1.55 }}>
                Paste that into Kapwing, render nine by sixteen, download, then bring the file back here.
                Kapwing has no generation API, so this step is manual and will stay manual.
              </p>
              <input ref={fileRef} type="file" accept="video/mp4,video/quicktime,video/x-matroska"
                style={{ display: "none" }}
                onChange={(e) => upload(e.target.files?.[0])} />
              <div style={{ marginTop: 12 }}>
                {uploading
                  ? <Pill full disabled>Uploading…</Pill>
                  : <Pill full icon={Upload} onClick={() => fileRef.current?.click()}
                      disabled={state === "processing"}>
                      Upload the render
                    </Pill>}
              </div>
            </Card>
          </Section>
        </>
      )}

      {state === "processing" && (
        <Card style={{ marginTop: 12 }}>
          <div className="lamp"><Mono c={C.red}>Processing…</Mono></div>
          <p style={{ fontSize: 12.5, color: C.ink2, marginTop: 8, lineHeight: 1.5 }}>
            Reframing and captioning the whole piece, nothing cut. A few minutes is normal.
            This keeps checking on its own.
          </p>
        </Card>
      )}

      {state === "ready" && clip && (
        <Section label="Publish" style={{ marginTop: 24 }}>
          <Note>Nothing has gone out. Three platforms, three pieces of copy, one confirm each.</Note>
          <div style={{ height: 12 }} />
          <CastPublish clip={clip} captions={piece?.captions} published={published}
            busy={busy} onPublish={onPublish} />
        </Section>
      )}
    </div>
  );
}
