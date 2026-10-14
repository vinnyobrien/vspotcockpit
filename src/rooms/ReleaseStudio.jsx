import React, { useEffect, useMemo, useState } from "react";
import { Check, Copy, ExternalLink, Film, Headphones, FileText } from "lucide-react";
import { C, BODY, Big, Card, Mono, Pill } from "../lib/ui.jsx";
import { readKey } from "../lib/api.js";
import { PUBLISHING_KEY, seedPublishing } from "../lib/publishing.js";

const DESTINATIONS = [
  { id: "assets", label: "Final assets" },
  { id: "spotify", label: "Spotify" },
  { id: "youtube", label: "YouTube" },
  { id: "substack", label: "Substack" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "more", label: "Shorts & X" },
];

const blocks = [
  ["spotifyTitle", "Spotify title"], ["spotifyDescription", "Spotify description"], ["spotifyChapters", "Spotify chapters"],
  ["youtubeTitle", "YouTube title"], ["youtubeDescription", "YouTube description"], ["youtubeChapters", "YouTube chapters"],
  ["substackTitle", "Substack title"], ["substackBody", "Substack article"], ["linkedinPost", "LinkedIn post"],
];

function noteBlock(notes, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = String(notes || "").match(new RegExp(`(?:^|\\n)${escaped}\\s*\\n([\\s\\S]*?)(?=\\n[A-Z][A-Z0-9 /&’'—-]{2,}\\s*(?:\\n|$)|$)`, "i"));
  return match?.[1]?.trim() || "";
}

function shortAssets(notes) {
  const delivered = noteBlock(notes, "DELIVERED EXPORTS");
  const matches = [...delivered.matchAll(/(Captioned master|Captioned 50\.5-second short|Clean master|Updated Spotify audio):\s*(https?:\/\/\S+|sandbox:\/\/\S+)/gi)];
  return matches.map(([, label, url]) => ({ label: label.replace(/^Captioned /i, ""), url }));
}

function usableUrl(value) {
  try { const url = new URL(String(value || "")); return ["https:", "http:"].includes(url.protocol) ? url.href : ""; }
  catch { return ""; }
}

function drivePreviewUrl(value) {
  try {
    const url = new URL(String(value || ""));
    if (url.protocol !== "https:" || url.hostname !== "drive.google.com") return "";
    const id = url.pathname.match(/^\/file\/d\/([^/]+)/)?.[1];
    return id ? `https://drive.google.com/file/d/${id}/preview` : "";
  } catch { return ""; }
}

export default function ReleaseStudio() {
  const [items, setItems] = useState(null);
  const [selectedId, setSelectedId] = useState("");
  const [tab, setTab] = useState("assets");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  useEffect(() => {
    let live = true;
    readKey(PUBLISHING_KEY, seedPublishing()).then((rows) => {
      if (!live) return;
      if (!Array.isArray(rows)) throw new Error("Release packs are not available.");
      const ordered = [...rows].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
      setItems(ordered);
      setSelectedId(ordered.find((x) => /cindy marshall/i.test(`${x.guest} ${x.show}`))?.id || ordered[0]?.id || "");
      setError("");
    }).catch((e) => { if (live) setError(e.message || "Could not load release packs."); });
    return () => { live = false; };
  }, []);

  const item = useMemo(() => items?.find((x) => x.id === selectedId) || null, [items, selectedId]);
  const extraAssets = useMemo(() => shortAssets(item?.notes), [item]);
  const videoUrl = usableUrl(item?.videoLink);
  const driveVideoPreview = drivePreviewUrl(item?.videoLink);

  async function copy(value, label) {
    if (!value?.trim()) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(""), 1600);
      setError("");
    } catch { setError("Clipboard access failed. Select the text and copy it manually."); }
  }

  const textCard = (key, label, title = false, override = undefined) => {
    const value = override ?? item?.copy?.[key] ?? "";
    return <Card key={key} style={{ marginBottom: 12 }}>
      <div className="flex items-center justify-between gap-3"><Big s={17}>{label}</Big><Pill sm tone="ghost" icon={copied === key ? Check : Copy} disabled={!value} onClick={() => copy(value, key)}>{copied === key ? "Copied" : "Copy"}</Pill></div>
      <textarea aria-label={label} readOnly value={value} placeholder="No copy saved in this release pack yet."
        rows={title ? 2 : Math.min(14, Math.max(4, (value.match(/\n/g)?.length || 0) + 2))}
        style={{ width: "100%", boxSizing: "border-box", marginTop: 10, padding: 12, border: "1px solid rgba(20,24,51,.15)", borderRadius: 12, background: "#fff", color: C.ink, font: `14px/1.6 ${BODY}`, resize: "vertical" }} />
    </Card>;
  };

  return <div>
    <Card style={{ background: C.sand, marginBottom: 14 }}>
      <div className="flex items-center justify-between gap-3" style={{ flexWrap: "wrap" }}>
        <div><Mono c={C.ink2}>PRODUCTION HANDOFF</Mono><Big s={24} style={{ marginTop: 5 }}>Episode outputs</Big></div>
        {items?.length > 0 && <select aria-label="Release pack" value={selectedId} onChange={(e) => { setSelectedId(e.target.value); setTab("assets"); }} style={{ maxWidth: "100%", padding: 10, borderRadius: 10, border: "1px solid rgba(20,24,51,.2)", color: C.ink, font: `13px ${BODY}` }}>
          {items.map((x) => <option key={x.id} value={x.id}>{x.guest || x.show} · {x.date || "Date pending"}</option>)}
        </select>}
      </div>
      <p style={{ marginBottom: 0, fontSize: 13, color: C.ink2, lineHeight: 1.5 }}>The finished assets and platform-ready copy, together. Nothing publishes from this screen; copy each block into its destination.</p>
    </Card>
    {error && <Card role="alert" style={{ marginBottom: 12, borderLeft: `4px solid ${C.red}` }}>{error}</Card>}
    {!items && !error && <Card>Loading episode outputs…</Card>}
    {items && !items.length && <Card>No release packs saved yet.</Card>}
    {item && <>
      <div style={{ margin: "14px 0", display: "flex", gap: 7, flexWrap: "wrap" }} role="tablist" aria-label="Episode output tabs">
        {DESTINATIONS.map((x) => <button key={x.id} role="tab" aria-selected={tab === x.id} onClick={() => setTab(x.id)} className="tap"
          style={{ border: `1px solid ${tab === x.id ? C.ink : "rgba(20,24,51,.18)"}`, background: tab === x.id ? C.ink : "white", color: tab === x.id ? "white" : C.ink, borderRadius: 999, padding: "8px 12px", font: `600 11px ${BODY}`, cursor: "pointer" }}>{x.label}</button>)}
      </div>

      {tab === "assets" && <>
        <Card style={{ marginBottom: 12 }}>
          <div className="flex items-center justify-between gap-3"><Big s={20}>{item.guest || item.show}</Big><Mono>{item.date || "Date pending"}</Mono></div>
          <p style={{ marginBottom: 0, fontSize: 13, color: C.ink2 }}>{item.show}{item.time ? ` · ${item.time} Ireland` : ""}</p>
        </Card>
        {driveVideoPreview ? <Card style={{ padding: 10, marginBottom: 12 }}><iframe title={`${item.guest || item.show} final cut`} src={driveVideoPreview} allow="autoplay; encrypted-media" allowFullScreen style={{ display: "block", width: "100%", height: "min(68vh, 700px)", border: 0, borderRadius: 12, background: "#111" }} /><div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}><Pill sm tone="ghost" icon={ExternalLink} onClick={() => window.open(videoUrl, "_blank", "noopener,noreferrer")}>Open final cut in Drive</Pill></div></Card>
          : videoUrl ? <Card style={{ padding: 10, marginBottom: 12 }}><video controls preload="metadata" src={videoUrl} style={{ display: "block", width: "100%", maxHeight: "68vh", borderRadius: 12, background: "#111" }} /><div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}><Pill sm tone="ghost" icon={ExternalLink} onClick={() => window.open(videoUrl, "_blank", "noopener,noreferrer")}>Open final cut</Pill></div></Card>
          : <Card style={{ marginBottom: 12, borderLeft: `4px solid ${C.red}` }}><div className="flex gap-3"><Film size={19} color={C.red}/><div><Big s={17}>Final cut link needs a permanent address</Big><p style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 4 }}>The saved video path points to a temporary sandbox folder, so the Cockpit cannot play or open it. Replace it in Publishing with a shareable Drive/Library link or a hosted video URL to make the master available here.</p><Mono s={9}>{item.videoLink || "No final video link saved"}</Mono></div></div></Card>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
          {[["Spotify audio", item.audioLink, Headphones], ["Captions / transcript", item.transcriptLink, FileText], ...extraAssets.map((x) => [x.label, x.url, Film])].map(([label, url, Icon]) => {
            const href = usableUrl(url);
            return <Card key={label} style={{ marginBottom: 0 }}><div className="flex items-center gap-2"><Icon size={16} color={C.ink2}/><Big s={16}>{label}</Big></div><p style={{ fontSize: 11, color: C.ink2, overflowWrap: "anywhere", lineHeight: 1.45 }}>{!url ? "Not supplied" : href ? url : "Temporary sandbox path — unavailable from Cockpit"}</p><div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>{href && <Pill sm tone="ghost" icon={copied === label ? Check : Copy} onClick={() => copy(url, label)}>{copied === label ? "Copied" : "Copy link"}</Pill>}{href && <a href={href} target="_blank" rel="noreferrer" style={{ color: C.ink, fontSize: 12, alignSelf: "center" }}>Open</a>}</div></Card>;
          })}
        </div>
        {!!item.notes && <details style={{ marginTop: 14 }}><summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 700 }}>Production notes and QA</summary><Card style={{ marginTop: 9 }}><pre style={{ margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere", font: `12px/1.6 ${BODY}`, color: C.ink2 }}>{item.notes}</pre></Card></details>}
      </>}

      {tab === "spotify" && <>{textCard("spotifyTitle", "Spotify title", true)}{textCard("spotifyDescription", "Spotify description")}{textCard("spotifyChapters", "Spotify chapters")}</>}
      {tab === "youtube" && <>{textCard("youtubeTitle", "YouTube title", true)}{textCard("youtubeDescription", "YouTube description")}{textCard("youtubeChapters", "YouTube chapters")}</>}
      {tab === "substack" && <>{textCard("substackTitle", "Substack title", true)}{textCard("substackBody", "Substack article")}</>}
      {tab === "linkedin" && textCard("linkedinPost", "LinkedIn release post")}
      {tab === "more" && <>
        {textCard("xPost", "X / Twitter post", false, noteBlock(item.notes, "TWITTER COPY") || undefined)}
        {textCard("shortTitle", "Short title", true, noteBlock(item.notes, "SHORT TITLE") || undefined)}
        {textCard("shortDescription", "Short description", false, noteBlock(item.notes, "SHORT DESCRIPTION") || undefined)}
        {textCard("shortPost", "Short post", false, noteBlock(item.notes, "SHORT POST") || undefined)}
        {!item.copy?.xPost && !noteBlock(item.notes, "TWITTER COPY") && !noteBlock(item.notes, "SHORT TITLE") && <Card>No extra platform copy is saved for this episode.</Card>}
      </>}

      <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {blocks.filter(([key]) => item.copy?.[key]).map(([key, label]) => <span key={key} style={{ background: C.mint, borderRadius: 99, padding: "5px 9px", fontSize: 10, color: C.ink }}>{label} ready</span>)}
      </div>
    </>}
  </div>;
}
