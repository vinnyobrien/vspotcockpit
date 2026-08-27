import React, { useState, useRef } from "react";
import { UploadCloud, Copy, Check, Send } from "lucide-react";
import { C, MONO, Mono, Card, Pill, Field, Empty, Problem } from "./ui.jsx";
import { mediaPresign, mediaRegister, mediaSchedule, mediaShare } from "../api.js";

/* ============================================================
   src/lib/Upload.jsx

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


const DESTINATIONS = [
  ["twitter", "X", "video+image"],
  ["tiktok", "TikTok", "video+image"],
  ["youtube", "YouTube", "video"],
];

/* Your own 90 days say 21:30 Irish medians 644 views against 34 for
   mid-afternoon. Default to the next 21:30, or tomorrow 07:30 if that
   window has already gone — never stack two inside six hours. */
function defaultSlot() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const at = (day, h, m) => `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}T${pad(h)}:${pad(m)}:00`;
  if (d.getHours() < 21) return at(d, 21, 30);
  const t = new Date(d.getTime() + 864e5);
  return at(t, 7, 30);
}

/* token is optional. In the browser the session cookie authenticates;
   the prop exists only for callers outside a browser. */
export default function Upload({ onUploaded, token }) {
  const [file, setFile] = useState(null);
  const [meta, setMeta] = useState(null);
  const [tags, setTags] = useState({ origin: "", correspondent: "house", beat: "general" });
  const [note, setNote] = useState("");
  const [pct, setPct] = useState(0);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [done, setDone] = useState(null);
  const [copied, setCopied] = useState(false);
  const [kind, setKind] = useState("video");
  const [nets, setNets] = useState([]);
  const [caption, setCaption] = useState("");
  const [ytTitle, setYtTitle] = useState("");
  const [ai, setAi] = useState(true);
  const [when, setWhen] = useState(defaultSlot());
  const [sched, setSched] = useState(null);
  const inputRef = useRef(null);
  const schedRef = useRef(null);

  /* Read duration and dimensions client side, so the record carries them
     without anyone typing them in. */
  const pick = (f) => {
    if (!f) return;
    setFile(f);
    setDone(null);
    setErr("");
    setPct(0);
    setSched(null);
    const isImage = (f.type || "").startsWith("image/");
    setKind(isImage ? "image" : "video");
    /* A still has no duration, and reading it through a <video> element
       returns nothing rather than failing loudly. Branch on the type. */
    if (isImage) {
      const img = new Image();
      img.onload = () => {
        setMeta({ durationSeconds: null, width: img.naturalWidth, height: img.naturalHeight });
        URL.revokeObjectURL(img.src);
      };
      img.onerror = () => setMeta(null);
      img.src = URL.createObjectURL(f);
      return;
    }
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
      const { uploadUrl, key, contentType } = await mediaPresign({
        filename: file.name,
        contentType: file.type || (kind === "image" ? "image/jpeg" : "video/mp4"),
        bytes: file.size,
      }, token);

      /* XHR rather than fetch, purely for upload progress. A 19MB PUT with no
         feedback looks identical to a hang. */
      const fileId = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl, true);
        xhr.setRequestHeader("Content-Type", contentType || file.type || "video/mp4");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setPct(Math.round((e.loaded / e.total) * 100));
        };
        /* Drive's resumable PUT returns the file resource in the body on
           success. The id only exists here — presign cannot know it. */
        xhr.onload = () => {
          if (xhr.status < 200 || xhr.status >= 300) {
            return reject(new Error(`Drive refused the upload: ${xhr.status}. ${(xhr.responseText || "").slice(0, 180)}`));
          }
          try {
            const r = JSON.parse(xhr.responseText || "{}");
            if (!r.id) return reject(new Error("Drive accepted the bytes but returned no file id."));
            resolve(r.id);
          } catch {
            reject(new Error("Drive returned something that was not the file record."));
          }
        };
        xhr.onerror = () => reject(new Error("The browser blocked the upload before it reached Drive. That is CORS on the session, not the file or the connection."));
        xhr.send(file);
      }, token);

      /* Link-readable, then registered. Sharing is its own call because it
         needs the id the PUT just produced. */
      const shared = await mediaShare({ fileId }, token);

      const rec = await mediaRegister({
        key, fileId, publicUrl: shared.publicUrl, filename: file.name, bytes: file.size,
        ...meta, ...tags, kind, note: note.trim(),
      }, token);

      setDone(rec.media);
      setFile(null);
      setPct(100);
      if (inputRef.current) inputRef.current.value = "";
      onUploaded?.(rec.media);
    } catch (e) {
      setErr(e.message || "Upload failed. Nothing was stored.");
    }
    setBusy("");
  };


  const toggleNet = (n) => {
    if (n === "youtube" && kind === "image") return;
    setNets(nets.includes(n) ? nets.filter((x) => x !== n) : [...nets, n]);
  };

  const schedule = async () => {
    if (!done || !nets.length) return;
    setBusy("schedule");
    setErr("");
    try {
      const r = await mediaSchedule({
        mediaUrl: done.publicUrl,
        kind,
        text: caption.trim(),
        networks: nets,
        when,
        youtubeTitle: ytTitle.trim(),
        aiGenerated: ai,
        durationSeconds: meta?.durationSeconds ?? done.durationSeconds ?? null,
        width: meta?.width ?? done.width ?? null,
        height: meta?.height ?? done.height ?? null,
      }, token);
      setSched(r);
      /* It sits under the Drive URL and the destination pills, which on a phone
         is well below the fold. A confirmation nobody scrolls to is not one. */
      setTimeout(() => schedRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
    } catch (e) {
      setErr(e.message || "Metricool refused the schedule. Nothing was queued.");
    }
    setBusy("");
  };

  const mb = file ? (file.size / 1048576).toFixed(1) : null;

  return (
    <div>
      <Problem onDismiss={() => setErr("")}>{err}</Problem>

      <Card pad={16} style={{ marginBottom: 12 }}>
        <Mono>Upload a clip</Mono>

        <div style={{ marginTop: 12 }}>
          <input
            ref={inputRef}
            type="file"
            accept="video/*,image/*"
            capture={undefined}
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
          <Mono s={9}>{tags.origin ? "Straight to Drive, not through Netlify" : "Set an origin first"}</Mono>
          <Pill sm icon={UploadCloud} disabled={!file || !tags.origin || !!busy} onClick={upload}>
            Upload
          </Pill>
        </div>
      </Card>

      {done && (
        <Card tint={C.mint} pad={16}>
          <div style={{ fontSize: 14, color: C.ink, lineHeight: 1.6 }}>
            Uploaded and tagged. Uploaded to Drive and shared read-only. Metricool pulls the file
            through its own Drive link, so this goes straight into a post.
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
          <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid rgba(20,24,51,.10)" }}>
            <Mono s={9}>Send it to</Mono>
            <div className="flex gap-2" style={{ marginTop: 6, flexWrap: "wrap" }}>
              {DESTINATIONS.map(([v, l, takes]) => {
                const blocked = v === "youtube" && kind === "image";
                return (
                  <Pill key={v} sm
                    tone={nets.includes(v) ? "solid" : "ghost"}
                    disabled={blocked}
                    onClick={() => toggleNet(v)}>
                    {l}{blocked ? " · video only" : ""}
                  </Pill>
                );
              })}
            </div>

            {nets.length > 0 && (
              <>
                <div style={{ marginTop: 12 }}>
                  <Field value={caption} onChange={setCaption}
                    placeholder={nets.every((n) => n === "youtube")
                      ? "Description (optional for YouTube)"
                      : "Caption — X and TikTok both use this"} />
                </div>

                {nets.includes("youtube") && (
                  <div style={{ marginTop: 10 }}>
                    <Field value={ytTitle} onChange={setYtTitle}
                      placeholder="YouTube title — required, and separate from the caption" />
                  </div>
                )}

                <div style={{ marginTop: 12 }}>
                  <Mono s={9}>Publish at · Europe/Dublin</Mono>
                  <div style={{ marginTop: 6 }}>
                    <input type="datetime-local" value={when}
                      onChange={(e) => setWhen(e.target.value)}
                      style={{ fontFamily: MONO, fontSize: 12, padding: "7px 9px",
                        border: "1px solid rgba(20,24,51,.16)", borderRadius: 4,
                        background: "#fff", color: C.ink }} />
                  </div>
                </div>

                <div style={{ marginTop: 12 }}>
                  <Pill sm tone={ai ? "solid" : "ghost"} onClick={() => setAi(!ai)}>
                    {ai ? "Declared AI-generated" : "Not AI-generated"}
                  </Pill>
                  <div style={{ marginTop: 6 }}>
                    <Mono s={9}>
                      Both TikTok and YouTube require this declaration. Leave it on for
                      anything with a correspondent in it.
                    </Mono>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3" style={{ marginTop: 16 }}>
                  <Mono s={9}>{nets.length} destination{nets.length === 1 ? "" : "s"}</Mono>
                  <Pill sm icon={Send} disabled={!!busy} onClick={schedule}>
                    {busy === "schedule" ? "Scheduling…" : "Schedule"}
                  </Pill>
                </div>
              </>
            )}

            {sched?.ok && (
              <div ref={schedRef} style={{
                marginTop: 16, padding: "14px 16px", borderRadius: 4,
                background: "#f0f7f1", border: "1px solid rgba(30,132,73,.28)",
                borderLeft: "4px solid #1E8449",
              }}>
                <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".9px",
                  textTransform: "uppercase", color: "#1E8449", fontWeight: 700 }}>
                  Scheduled
                </div>
                <div style={{ fontSize: 15, color: C.ink, marginTop: 6, lineHeight: 1.5 }}>
                  {(sched.confirmedNetworks?.length
                    ? sched.confirmedNetworks.map((n) => n.network).join(", ")
                    : sched.scheduled.join(", "))}
                  {" \u00b7 "}
                  {(sched.confirmedAt || sched.at || "").replace("T", " ")} Irish
                  {sched.youtubeType ? " \u00b7 YouTube as a " + sched.youtubeType : ""}
                </div>
                <div style={{ marginTop: 8, display: "grid", gap: 3 }}>
                  {(sched.confirmedNetworks || []).map((n) => (
                    <Mono key={n.network} s={10}>{n.network} \u2014 {n.status}</Mono>
                  ))}
                  <Mono s={10}>
                    {sched.mediaIngested
                      ? "Metricool has pulled the file into its own storage."
                      : "Warning: Metricool kept the Drive link, not the file. It will not publish."}
                  </Mono>
                  {sched.postId ? <Mono s={10}>Metricool post {sched.postId}</Mono> : null}
                </div>
                <div style={{ marginTop: 9, fontSize: 12.5, color: C.ink2, lineHeight: 1.5 }}>
                  In the planner, not published. Confirmed by reading Metricool back,
                  not by our own request returning 200.
                </div>
              </div>
            )}
          </div>

        </Card>
      )}

      {!file && !done && (
        <Empty>
          Nothing selected. Files go straight to Google Drive rather than through the Cockpit,
          so size is not a constraint here.
        </Empty>
      )}
    </div>
  );
}
