import React, { useState, useRef } from "react";
import { uploadCloud, Copy, Check } from "lucide-react";
import { C, MONO, Mono, Card, Pill, Field, Empty, Problem } from "./ui.jsx";
import { mediaPresign, mediaRegister } from "../api.js";

/* ============================================================
   src/lib/upload.jsx

   Live: POST /api/media/presign, PUT straight to R2, POST /api/media/register

   The bytes bypass Netlify entirely. A 19MB clip would break the 6MB
   function limit in both directions, so the browser uploads to R2 on a
   presigned URL and only the registry entry comes back here.

   The three tag fields are not optional decoration. Origin, correspondent
   and beat are what make "do podcast cuts outperform originals" or "is
   Reagan suppressing Jimmy" answerable. A clip filed untagged today cannot
   be attributed in December, so the publish button stays closed until
   origin is set.
   ============================================================ */

const ORIGINS = [
  ["original", "Original"],
  ["guest-clip", "Guest clip"],
  ["podcast-cut", "Podcast cut"],
  ["archive", "Archive"],
];

const CORRESPONDENTS = [
  ["house", "House"],
  ["murt", "Murt"],
  ["reagan", "Reagan"],
  ["jimmy", "Jimmy"],
];

const BEATS = [
  ["general", "General"],
  ["retail-media", "Retail media"],
  ["agentic", "Agentic"],
  ["uk", "UK"],
];

export default function upload({ onuploaded }) {
  const [file, setFile] = useState(null);
  const [meta, setMeta] = useState(null);
  const [tags, setTags] = useState({ origin: "", correspondent: "house", beat: "general" });
  const [note, setNote] = useState("");
  const [pct, setPct] = useState(0);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [done, setDone] = useState(null);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef(null);

  /* Read duration and dimensions client side, so the record carries them
     without anyone typing them in. */
  const pick = (f) => {
    if (!f) return;
    setFile(f);
    setDone(null);
    setErr("");
    setPct(0);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      setMeta({ durationSeconds: Math.round(v.duration), width: v.videoWidth, height: v.videoHeight });
      URL.revokeObjectURL(v.src);
    };
    v.onerror = () => setMeta(null);
    v.src = URL.createObjectURL(f);
  };

  const upload = async () => {
    if (!file || !tags.origin) return;
    setBusy("upload");
    setErr("");
    setPct(0);
    try {
      const { uploadUrl, publicUrl, key, contentType } = await mediaPresign({
        filename: file.name,
        contentType: file.type || "video/mp4",
      });

      /* XHR rather than fetch, purely for upload progress. A 19MB PUT with no
         feedback looks identical to a hang. */
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl, true);
        xhr.setRequestHeader("Content-Type", contentType || file.type || "video/mp4");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setPct(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300
          ? resolve()
          : reject(new Error(`R2 refused the upload: ${xhr.status}. Check the bucket name and keys.`)));
        xhr.onerror = () => reject(new Error("upload failed. Usually CORS on the bucket, not the file."));
        xhr.send(file);
      });

      const rec = await mediaRegister({
        key, publicUrl, filename: file.name, bytes: file.size,
        ...meta, ...tags, note: note.trim(),
      });

      setDone(rec.media);
      setFile(null);
      setPct(100);
      if (inputRef.current) inputRef.current.value = "";
      onuploaded?.(rec.media);
    } catch (e) {
      setErr(e.message || "upload failed. Nothing was stored.");
    }
    setBusy("");
  };

  const mb = file ? (file.size / 1048576).toFixed(1) : null;

  return (
    <div>
      <Problem onDismiss={() => setErr("")}>{err}</Problem>

      <Card pad={16} style={{ marginBottom: 12 }}>
        <Mono>upload a clip</Mono>

        <div style={{ marginTop: 12 }}>
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            onChange={(e) => pick(e.target.files?.[0])}
            style={{ fontSize: 13, color: C.ink2, width: "100%" }}
          />
        </div>

        {file && (
          <div style={{ marginTop: 10 }}>
            <Mono s={9}>
              {mb} MB
              {meta ? ` · ${meta.durationSeconds}s · ${meta.width}×${meta.height}` : ""}
            </Mono>
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <Mono s={9}>Origin · required</Mono>
          <div className="flex gap-2" style={{ marginTop: 6, flexWrap: "wrap" }}>
            {ORIGINS.map(([v, l]) => (
              <Pill key={v} sm tone={tags.origin === v ? "solid" : "ghost"}
                onClick={() => setTags({ ...tags, origin: v })}>{l}</Pill>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <Mono s={9}>Correspondent</Mono>
          <div className="flex gap-2" style={{ marginTop: 6, flexWrap: "wrap" }}>
            {CORRESPONDENTS.map(([v, l]) => (
              <Pill key={v} sm tone={tags.correspondent === v ? "solid" : "ghost"}
                onClick={() => setTags({ ...tags, correspondent: v })}>{l}</Pill>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <Mono s={9}>Beat</Mono>
          <div className="flex gap-2" style={{ marginTop: 6, flexWrap: "wrap" }}>
            {BEATS.map(([v, l]) => (
              <Pill key={v} sm tone={tags.beat === v ? "solid" : "ghost"}
                onClick={() => setTags({ ...tags, beat: v })}>{l}</Pill>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          <Field value={note} onChange={setNote} placeholder="What it is, one line" />
        </div>

        {busy === "upload" && (
          <div style={{ marginTop: 14 }}>
            <div style={{ height: 6, background: "rgba(20,24,51,.08)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: C.red, transition: "width .2s" }} />
            </div>
            <div style={{ marginTop: 6 }}><Mono s={9} c={C.red}>{pct}% uploaded</Mono></div>
          </div>
        )}

        <div className="flex items-center justify-between gap-3" style={{ marginTop: 16 }}>
          <Mono s={9}>{tags.origin ? "Straight to R2, not through Netlify" : "Set an origin first"}</Mono>
          <Pill sm icon={uploadCloud} disabled={!file || !tags.origin || !!busy} onClick={upload}>
            upload
          </Pill>
        </div>
      </Card>

      {done && (
        <Card tint={C.mint} pad={16}>
          <div style={{ fontSize: 14, color: C.ink, lineHeight: 1.6 }}>
            uploaded and tagged. This URL is what Metricool fetches from, so it can go
            straight into a scheduled post.
          </div>
          <div style={{ marginTop: 10, wordBreak: "break-all" }}>
            <a href={done.publicUrl} target="_blank" rel="noopener noreferrer"
              style={{ fontFamily: MONO, fontSize: 11, color: C.ink, letterSpacing: ".04em" }}>
              {done.publicUrl}
            </a>
          </div>
          <div style={{ marginTop: 12 }}>
            <Pill sm tone="ghost" icon={copied ? Check : Copy} onClick={() => {
              navigator.clipboard?.writeText(done.publicUrl);
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            }}>
              {copied ? "Copied" : "Copy URL"}
            </Pill>
          </div>
        </Card>
      )}

      {!file && !done && (
        <Empty>
          Nothing selected. Files go straight to R2 rather than through the Cockpit,
          so size is not a constraint here.
        </Empty>
      )}
    </div>
  );
}
