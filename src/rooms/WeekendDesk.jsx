import React, { useEffect, useState } from "react";
import { C, Mono, Big, Card, Pill, Field, Problem } from "../lib/ui.jsx";
import { sGetStrict, sSetStrict } from "../api.js";
import { dateInDublin } from "../lib/editorial-calendar.js";
import { recordAudit } from "../lib/audit.js";

const KEY = "weekend-editorial-v1";
const blankStory = () => ({ id: crypto.randomUUID(), title: "", url: "", source: "", author: "", brand: "", email: "", note: "" });
const blankIssue = () => ({ id: crypto.randomUUID(), format: "saturday", publishDate: "", createdAt: new Date().toISOString(), status: "collecting", stories: [blankStory()], draft: "", publishedUrl: "", emailDraft: "", subeditor: null });
const formats = {
  saturday: { label: "Saturday Nuggets", descriptor: "A sharp weekend note built from useful signals." },
  sunday: { label: "Sunday Supplement", descriptor: "Two or three interesting stories, tied together by your point of view." },
};

export default function WeekendDesk({ onSubEditor, active = true }) {
  const [issues, setIssues] = useState([]);
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [signoffArmed, setSignoffArmed] = useState(false);

  useEffect(() => { if (!active) return undefined; let live = true; sGetStrict(KEY, []).then((rows) => { if (live) { const list = Array.isArray(rows) ? rows : []; setIssues(list); setReady(true); if (selected) { const current = list.find((item) => item.id === selected); if (current) setDraft(structuredClone(current)); } } }).catch((e) => { if (live) { setError(e.message); setReady(true); } }); return () => { live = false; }; }, [active]);
  const openIssue = (item) => { setSelected(item.id); setDraft(structuredClone(item)); setError(""); setNotice(""); setSignoffArmed(false); };
  const update = (key, value) => setDraft((old) => ({ ...old, [key]: value }));
  const updateStory = (id, key, value) => setDraft((old) => ({ ...old, stories: old.stories.map((story) => story.id === id ? { ...story, [key]: value } : story) }));
  const persist = async (next, success = "Saved to the Weekend Desk.", auditAction = null) => {
    setBusy(true); setError(""); setNotice("");
    try {
      await sSetStrict(KEY, next);
      setIssues(next); const current = next.find((item) => item.id === selected) || null; setDraft(current); setSelected(current?.id || null);
      try { await recordAudit({ action: auditAction?.action || "Weekend edition saved", target: formats[draft?.format]?.label || "Weekend edition", detail: auditAction?.detail || `${draft?.stories?.length || 0} source record(s); status ${draft?.status || "collecting"}`, source: "Weekend Desk" }); setNotice(success); }
      catch { setError("Edition saved, but the daily audit entry failed. Retry Save edition to record it."); }
      return true;
    } catch (e) { setError(e.message || "Could not save this edition."); return false; }
    finally { setBusy(false); }
  };
  const save = async () => {
    if (!draft) return;
    const next = [{ ...draft, updatedAt: new Date().toISOString() }, ...issues.filter((item) => item.id !== draft.id)].slice(0, 100);
    await persist(next);
  };
  const create = (format) => { const item = { ...blankIssue(), format, publishDate: dateInDublin() }; setSelected(item.id); setDraft(item); setError(""); setNotice(""); setSignoffArmed(false); };
  const sendToEditor = async () => {
    if (!draft?.draft.trim()) return;
    setBusy(true); setError("");
    try {
      const handoff = { id: draft.id, kind: "weekend-post", recordId: draft.id, status: "awaiting_subeditor", format: formats[draft.format].label, destination: "Weekend Desk", sourceDay: `weekend:${draft.id}`, draft: draft.draft, sentAt: new Date().toISOString() };
      await sSetStrict("subeditor:handoff", handoff);
      const updated = { ...draft, status: "subeditor", subeditor: null, updatedAt: new Date().toISOString() };
      await persist([updated, ...issues.filter((item) => item.id !== updated.id)], "Sent to the Sub-Editor. The post stays in review until you approve it.", { action: "Sent edition to Sub-Editor", detail: `Draft ${draft.id} entered editorial review` });
      onSubEditor?.();
    } catch (e) { setError(e.message || "Could not hand off this edition."); setBusy(false); }
  };
  const markPublished = async () => {
    if (draft?.status !== "approved") { setError("Record publication only after Friday sign-off is recorded."); return; }
    if (!draft?.publishedUrl.trim()) { setError("Add the live post link before recording publication."); return; }
    const updated = { ...draft, status: "published", publishedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const emailDraft = updated.stories.filter((s) => s.email.trim()).map((s) => `To: ${s.author} <${s.email}>\nSubject: A note on ${s.brand || s.title}\n\nHi ${s.author.split(" ")[0] || "there"},\n\nI enjoyed reading your work on ${s.title}. I pulled together a short view on it in this weekend's ${formats[updated.format].label}: ${updated.publishedUrl}\n\nThought you might find the perspective useful. No ask attached; I wanted to share the response and say thanks for the work.\n\nVinny`).join("\n\n---\n\n");
    const withEmail = { ...updated, emailDraft };
    await persist([withEmail, ...issues.filter((item) => item.id !== withEmail.id)], "Publication recorded. Author email drafts are ready for review.", { action: "Publication recorded", detail: `${updated.publishedUrl}; ${updated.stories.filter((s) => s.email.trim()).length} author email draft(s) prepared` });
  };
  const approve = async () => {
    if (!draft?.subeditor) { setError("Run the Sub-Editor review before Friday sign-off."); return; }
    if (!draft.plannedChannels?.trim() || !draft.plannedTime?.trim()) { setError("Add the planned channels and publication time before sign-off."); return; }
    const updated = { ...draft, status: "approved", approvedAt: new Date().toISOString(), approvedBy: "Vinny", updatedAt: new Date().toISOString() };
    await persist([updated, ...issues.filter((item) => item.id !== updated.id)], "Friday sign-off recorded. Schedule the approved copy in the chosen publishing tool.", { action: "Friday sign-off", detail: `Approved for ${updated.publishDate} at ${updated.plannedTime} on ${updated.plannedChannels}` });
  };

  return <div>
    <Card tint={C.lilac} pad={20} style={{ marginBottom: 16 }}>
      <Big s={27}>WEEKEND DESK</Big>
      <p style={{ fontSize: 14, lineHeight: 1.55, color: C.ink2 }}>Dot can gather recent marketing and product updates from Gmail Promotions and Updates, pick two or three stories, and leave a source-linked edition here. Tag the author and the company as the relationship pipeline grows.</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <Pill sm disabled={!ready || busy} onClick={() => create("saturday")}>Start Saturday Nuggets</Pill>
        <Pill sm tone="ghost" disabled={!ready || busy} onClick={() => create("sunday")}>Start Sunday Supplement</Pill>
      </div>
    </Card>
    {error && <Problem onDismiss={() => setError("")}>{error}</Problem>}
    {notice && <p role="status" style={{ color: C.ink2, fontSize: 13 }}>{notice}</p>}
    {!ready && <Card>Loading saved weekend editions…</Card>}
    {ready && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 10, marginBottom: 16 }}>
      {issues.length === 0 && <Card><strong>No weekend editions yet.</strong><div style={{ fontSize: 13, marginTop: 6 }}>Start with a Saturday or Sunday test, then ask Dot to fill it from the Promotions and Updates mail.</div></Card>}
      {issues.map((item) => <Card key={item.id} pad={14} tint={selected === item.id ? C.sand : C.card}>
        <button type="button" onClick={() => openIssue(item)} style={{ display: "block", width: "100%", border: 0, background: "transparent", textAlign: "left", color: C.ink, cursor: "pointer", padding: 0 }}>
          <Mono>{item.publishDate || "Date not set"} · {item.status.replaceAll("_", " ")}</Mono>
          <div style={{ fontWeight: 700, marginTop: 5 }}>{formats[item.format]?.label || "Weekend post"}</div>
          <div style={{ fontSize: 12, color: C.ink2, marginTop: 4 }}>{item.stories.length} stories · {item.stories.map((s) => s.brand).filter(Boolean).join(", ") || "Companies not tagged"}</div>
        </button>
      </Card>)}
    </div>}
    {draft && <Card pad={18}>
      <Mono>TEST EDITION · {formats[draft.format].label}</Mono>
      <p style={{ color: C.ink2, fontSize: 13 }}>{formats[draft.format].descriptor} Dot prepares the material; you choose the angle and approve publication.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 10 }}>
        <label style={{ fontSize: 12 }}>Publish date<input type="date" value={draft.publishDate} onChange={(e) => update("publishDate", e.target.value)} style={inputStyle}/></label>
        <div style={{ fontSize: 12 }}>Status<div style={{ ...inputStyle, fontWeight: 700 }}>{draft.status.replaceAll("_", " ")}</div></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 10, marginTop: 10 }}>
        <label style={{ fontSize: 12 }}>Planned channels<input value={draft.plannedChannels || ""} onChange={(e) => update("plannedChannels", e.target.value)} placeholder="e.g. LinkedIn, Substack" style={inputStyle}/></label>
        <label style={{ fontSize: 12 }}>Planned publish time (Ireland)<input type="time" value={draft.plannedTime || ""} onChange={(e) => update("plannedTime", e.target.value)} style={inputStyle}/></label>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 20 }}><Big s={20}>STORY SOURCES</Big><Pill sm tone="ghost" disabled={draft.stories.length >= 3} onClick={() => update("stories", [...draft.stories, blankStory()])}>Add story</Pill></div>
      {draft.stories.map((story, index) => <Card key={story.id} tint={C.paper} pad={14} style={{ marginTop: 10 }}>
        <Mono>STORY {index + 1}</Mono>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 8, marginTop: 8 }}>
          <Field value={story.title} onChange={(v) => updateStory(story.id,"title",v)} placeholder="Article / update title"/>
          <Field value={story.url} onChange={(v) => updateStory(story.id,"url",v)} placeholder="Original source URL"/>
          <Field value={story.author} onChange={(v) => updateStory(story.id,"author",v)} placeholder="Author name"/>
          <Field value={story.brand} onChange={(v) => updateStory(story.id,"brand",v)} placeholder="Brand / SaaS company"/>
          <Field value={story.email} onChange={(v) => updateStory(story.id,"email",v)} placeholder="Author email (if known)" type="email"/>
          <Field value={story.source} onChange={(v) => updateStory(story.id,"source",v)} placeholder="Gmail Promotions / Updates / other"/>
        </div>
        <Field value={story.note} onChange={(v) => updateStory(story.id,"note",v)} rows={2} placeholder="What matters, what we think, and any checks needed"/>
        {draft.stories.length > 1 && <Pill sm tone="ghost" onClick={() => update("stories", draft.stories.filter((s) => s.id !== story.id))}>Remove story</Pill>}
      </Card>)}
      <label style={{ display: "block", marginTop: 16, fontSize: 12 }}>Your angle<textarea value={draft.draft} onChange={(e) => update("draft", e.target.value)} rows={8} placeholder="Paste Dot's Saturday or Sunday draft here. Keep source links and distinguish the company's claims from your view." style={inputStyle}/></label>
      <label style={{ display: "block", marginTop: 12, fontSize: 12 }}>Published post link<input value={draft.publishedUrl} onChange={(e) => update("publishedUrl", e.target.value)} placeholder="Add after it goes live" style={inputStyle}/></label>
      {draft.emailDraft && <details style={{ marginTop: 14 }}><summary>Author follow-up drafts · review before sending</summary><pre style={{ whiteSpace: "pre-wrap", font: "inherit", fontSize: 13, lineHeight: 1.5 }}>{draft.emailDraft}</pre></details>}
      {draft.subeditor && <Card tint={C.mint} pad={12} style={{ marginTop: 12 }}><Mono>SUB-EDITOR RESULT</Mono><p>{draft.subeditor.verdict || "Review complete."}</p><pre style={{ whiteSpace: "pre-wrap", font: "inherit", fontSize: 12 }}>{JSON.stringify({ claims: draft.subeditor.claims, missing: draft.subeditor.missing, contradictions: draft.subeditor.contradictions }, null, 2)}</pre></Card>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
        <Pill sm disabled={busy} onClick={save}>{busy ? "Saving…" : "Save edition"}</Pill>
        <Pill sm tone="ghost" disabled={busy || !draft.draft.trim()} onClick={sendToEditor}>Send to Sub-Editor</Pill>
        {!signoffArmed
          ? <Pill sm tone="ghost" disabled={busy || draft.status === "approved" || draft.status === "published"} onClick={() => setSignoffArmed(true)}>Friday sign-off</Pill>
          : <><Pill sm disabled={busy} onClick={async () => { await approve(); setSignoffArmed(false); }}>Confirm sign-off</Pill><Pill sm tone="ghost" onClick={() => setSignoffArmed(false)}>Cancel</Pill></>}
        <Pill sm tone="ghost" disabled={busy} onClick={markPublished}>Record published + prepare emails</Pill>
      </div>
      {draft.approvedAt && <p style={{ fontSize: 12 }}>Signed off by {draft.approvedBy} · {new Date(draft.approvedAt).toLocaleString("en-IE", { timeZone: "Europe/Dublin" })}</p>}
      <p style={{ fontSize: 11, color: C.ink2, marginTop: 12 }}>Friday sign-off records your approval. It does not schedule or publish. The publication tool must confirm any scheduled slot. External email remains a reviewed draft in this test.</p>
    </Card>}
  </div>;
}

const inputStyle = { display: "block", width: "100%", boxSizing: "border-box", marginTop: 5, padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(20,24,51,.2)", background: "white", color: C.ink, font: "inherit", fontSize: 14 };
