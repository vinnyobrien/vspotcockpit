import React, { useEffect, useState } from "react";
import { C, BODY, Mono, Card, Section, Pill } from "../lib/ui.jsx";
import { callOp } from "../api.js";
import { readKey, writeKey } from "../lib/api.js";

const dateInDublin = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Dublin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const prompts = [
  ["At IMRG, loyalty received 0% in the discussion of where AI changes commerce. What does that miss about why customers return, and what example proves it?", "Record a 60-second answer for a Have I Got Ecomm News For You debate round."],
  ["Which claim from a recent ecommerce conversation sounded plausible in the room but fell apart when you thought about an actual merchant?", "Name one guest who would defend it on The Struggle Bus."],
  ["Where have you seen a retailer confuse a better checkout with a better relationship, and what happened to the customer?", "Keep one concrete example for an Ostrich Report interview question."],
  ["What did three weeks of events change your mind about for 2027, and who made you reconsider it?", "Write a one-line Camp Tralee session premise."],
  ["Which ecommerce announcement deserves satire because its promise and the operator's reality are miles apart?", "Sketch one visual gag for The V Spot that you can record at home."],
  ["What opinion would you say to a sponsor in person but have not put in an offer, and what evidence supports it?", "Draft a one-line sponsor conversation opener."],
  ["Which interview taught you something you still disagree with, and what would you ask that guest now?", "Save the question for a remote follow-up recording."],
];
const initial = (day) => {
  const index = Math.abs(Math.floor((Date.parse(day + "T00:00:00Z") - Date.UTC(2026, 8, 29)) / 86400000)) % prompts.length;
  return { day, question: prompts[index][0], action: prompts[index][1], turns: [], sources: [], drafts: [], updatedAt: null };
};
const style = { width: "100%", padding: 10, borderRadius: 10, border: "1px solid rgba(20,24,51,.16)", background: "#fff", color: C.ink, fontFamily: BODY, fontSize: 14 };

export default function EditorialCall() {
  const today = dateInDublin();
  const [day, setDay] = useState(today), [session, setSession] = useState(null);
  const [thought, setThought] = useState(""), [label, setLabel] = useState(""), [url, setUrl] = useState("");
  const [draftText, setDraftText] = useState(""), [busy, setBusy] = useState(""), [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setSession(null); setDraftText(""); setError("");
    readKey("editor-call:" + day, null).then((saved) => {
      if (active) { const value = saved || initial(day); setSession(value); setDraftText(value.drafts?.at(-1)?.text || ""); }
    }).catch((e) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [day]);
  const persist = async (next) => {
    const saved = { ...next, updatedAt: new Date().toISOString() };
    await writeKey("editor-call:" + day, saved);
    setSession(saved);
    return saved;
  };
  const reply = async () => {
    if (!thought.trim() || !session || busy) return;
    setBusy("reply"); setError("");
    const turn = { id: crypto.randomUUID(), role: "vinny", text: thought.trim(), at: new Date().toISOString() };
    try {
      const saved = await persist({ ...session, turns: [...session.turns, turn] });
      setThought("");
      try {
        const result = await callOp({ op: "editorial_followup", editorial: saved });
        if (result.text?.trim()) await persist({ ...saved, turns: [...saved.turns, { id: crypto.randomUUID(), role: "producer", text: result.text.trim(), at: new Date().toISOString() }] });
      } catch (e) { setError("Your thought was saved. The follow-up failed: " + e.message); }
    } catch (e) { setError("Your thought did not save: " + e.message); }
    setBusy("");
  };
  const addSource = async () => {
    let parsed;
    try { parsed = new URL(url.trim()); } catch { setError("Add a full https:// link."); return; }
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || !label.trim()) { setError("Add a label and an https:// link."); return; }
    try {
      await persist({ ...session, sources: [...session.sources, { id: crypto.randomUUID(), label: label.trim().slice(0, 120), url: parsed.href, at: new Date().toISOString() }] });
      setLabel(""); setUrl(""); setError("");
    } catch (e) { setError(e.message); }
  };
  const generate = async (format) => {
    if (!session?.turns.some((t) => t.role === "vinny") || busy) return;
    setBusy("draft"); setError("");
    try {
      const result = await callOp({ op: "editorial_draft", editorial: { ...session, format } });
      const text = String(result.text || "").trim();
      if (!text) throw new Error("Empty draft.");
      const draft = { id: crypto.randomUUID(), format, text, origin: "generated", at: new Date().toISOString(), turnIds: session.turns.filter((t) => t.role === "vinny").map((t) => t.id), sourceIds: session.sources.map((s) => s.id) };
      await persist({ ...session, drafts: [...session.drafts, draft] });
      setDraftText(text);
    } catch (e) { setError("No draft was saved: " + e.message); }
    setBusy("");
  };
  const saveEdit = async () => {
    if (!session?.drafts.length) return;
    const last = session.drafts.at(-1);
    if (draftText === last.text) return;
    try {
      await persist({ ...session, drafts: [...session.drafts, { ...last, id: crypto.randomUUID(), text: draftText, origin: "Vinny edit", at: new Date().toISOString(), basedOn: last.id }] });
      setError("");
    } catch (e) { setError("Your edit did not save: " + e.message); }
  };
  return <Section label="Editor's call" right={<Mono>{day === today ? "today's idea" : day}</Mono>}>
    <Card tint={C.lilac} pad={18}>
      <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.3 }}>{session?.question || "Loading today's question…"}</div>
      <p style={{ fontSize: 13, color: C.ink2, marginTop: 7 }}><b>Small move:</b> {session?.action}</p>
      {error && <p role="alert" style={{ color: C.red, fontSize: 13, marginTop: 10 }}>{error}</p>}
      {session && <>
        <div style={{ display: "grid", gap: 8, marginTop: 14 }}>{session.turns.map((t) => <div key={t.id} style={{ background: t.role === "vinny" ? "#fff" : C.sand, borderRadius: 12, padding: 12 }}>
          <Mono s={9}>{t.role === "vinny" ? "Your raw thought" : "Producer's question"} · {new Date(t.at).toLocaleString("en-IE")}</Mono>
          <div style={{ whiteSpace: "pre-wrap", fontSize: 14, marginTop: 5 }}>{t.text}</div>
        </div>)}</div>
        <textarea value={thought} onChange={(e) => setThought(e.target.value)} rows={3} placeholder="Reply with the rough thought, example, disagreement or evidence…" aria-label="Your reply" style={{ ...style, marginTop: 12, resize: "vertical" }} />
        <div style={{ marginTop: 8 }}><Pill sm disabled={!thought.trim() || !!busy} onClick={reply}>{busy === "reply" ? "Saving and thinking…" : "Send thought"}</Pill></div>
        <p style={{ fontSize: 12, color: C.ink2, marginTop: 7 }}>Your words are saved first. Nothing is published.</p>
        <details style={{ marginTop: 14 }}><summary style={{ cursor: "pointer", fontWeight: 650 }}>Sources and provenance · {session.sources.length} links</summary>
          <p style={{ fontSize: 12, color: C.ink2 }}>Links are recorded as leads; the producer has not verified them.</p>
          {session.sources.map((s) => <p key={s.id} style={{ fontSize: 13 }}><a href={s.url} target="_blank" rel="noreferrer">{s.label}</a> · {new Date(s.at).toLocaleString("en-IE")}</p>)}
          <input style={{ ...style, marginTop: 7 }} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Source, interview or event" aria-label="Source label" />
          <input style={{ ...style, marginTop: 7 }} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" aria-label="Source URL" />
          <div style={{ marginTop: 8 }}><Pill sm tone="ghost" disabled={!label.trim() || !url.trim() || !!busy} onClick={addSource}>Keep source</Pill></div>
          <p style={{ fontSize: 12, color: C.ink2 }}>The dated record keeps original replies, producer questions, source links, draft versions and the reply IDs behind each draft.</p>
        </details>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 16 }}>
          {[["script", "Script"], ["linkedin", "LinkedIn post"], ["note", "Substack Note"]].map(([format, title]) => <Pill key={format} sm disabled={!!busy || !session.turns.some((t) => t.role === "vinny")} onClick={() => generate(format)}>{busy === "draft" ? "Working…" : "Draft " + title}</Pill>)}
        </div>
        {!!session.drafts.length && <div style={{ marginTop: 15 }}>
          <Mono s={9}>Working draft · {session.drafts.at(-1).format} · {session.drafts.at(-1).origin} · version {session.drafts.length}</Mono>
          <textarea rows={10} aria-label="Editable draft" value={draftText} onChange={(e) => setDraftText(e.target.value)} style={{ ...style, marginTop: 8, resize: "vertical" }} />
          <Pill sm onClick={saveEdit} disabled={draftText === session.drafts.at(-1).text}>Save my edit</Pill>
          <details style={{ marginTop: 12 }}><summary style={{ cursor: "pointer", fontSize: 13 }}>Draft history and inputs</summary>
            {session.drafts.map((d, i) => <div key={d.id} style={{ borderTop: "1px solid rgba(20,24,51,.12)", padding: "9px 0", fontSize: 12 }}>
              <b>Version {i + 1}</b> · {d.format} · {d.origin} · {new Date(d.at).toLocaleString("en-IE")}
              <div>{d.turnIds?.length || 0} of your replies and {d.sourceIds?.length || 0} source links recorded at generation.</div>
              <button type="button" onClick={() => setDraftText(d.text)} style={{ border: 0, background: "transparent", color: C.ink2, textDecoration: "underline", cursor: "pointer", padding: 0 }}>Load this version into editor</button>
            </div>)}
          </details>
        </div>}
      </>}
    </Card>
    <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
      <label htmlFor="editor-day" style={{ fontSize: 12, color: C.ink2 }}>Open a dated call</label>
      <input id="editor-day" type="date" max={today} value={day} onChange={(e) => { if (e.target.value) setDay(e.target.value); }} />
      {day !== today && <Pill sm tone="ghost" onClick={() => setDay(today)}>Today</Pill>}
    </div>
  </Section>;
}
