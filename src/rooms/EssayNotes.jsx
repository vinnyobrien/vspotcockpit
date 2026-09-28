import React, { useEffect, useMemo, useState } from "react";
import { C, BODY, Mono, Big, Card, Pill, Problem } from "../lib/ui.jsx";
import { callOp, sGet, sSet } from "../api.js";

const KEY = "essay-notes:v1";
const FIRST = { id: "rain-two-million-years", title: "It once rained for 2M years on earth.", url: "https://www.vinnyandco.com/p/it-once-rained-for-2m-years-on-earth", excerpt: "", context: "" };
const date = (value) => new Date(value).toLocaleDateString("en-IE", { day: "numeric", month: "short" });
const recent = (row) => row.usedAt && Date.now() - new Date(row.usedAt).getTime() < 7 * 86400000;
const input = { width: "100%", padding: "11px 12px", border: "1px solid #c9c6cf", borderRadius: 10, background: "#fff", color: C.ink, font: `15px ${BODY}`, boxSizing: "border-box" };
const label = { display: "block", margin: "12px 0 5px", fontSize: 13, fontWeight: 700, color: C.ink };
const clean = (value) => String(value || "").trim();

export default function EssayNotes() {
  const [data, setData] = useState({ essays: [FIRST], notes: [] });
  const [selected, setSelected] = useState(FIRST.id);
  const [form, setForm] = useState({ title: "", url: "", excerpt: "", context: "" });
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    sGet(KEY, null).then((saved) => {
      if (saved && Array.isArray(saved.essays) && Array.isArray(saved.notes)) {
        setData(saved);
        setSelected(saved.essays[0]?.id || "");
      }
    });
  }, []);
  const save = async (next) => {
    const ok = await sSet(KEY, next);
    if (!ok) throw new Error("Could not save the Notes room. Please try again.");
    setData(next);
  };
  const essays = useMemo(() => data.essays.map((essay) => {
    const last = data.notes.find((note) => note.essayId === essay.id && note.usedAt);
    return { ...essay, usedAt: last?.usedAt || null };
  }), [data]);
  const essay = essays.find((item) => item.id === selected);
  const eligible = essays.filter((item) => !recent(item));
  const update = (field, value) => setForm((old) => ({ ...old, [field]: value }));

  const add = async () => {
    setError(""); setMessage("");
    try {
      const title = clean(form.title), url = clean(form.url), excerpt = clean(form.excerpt);
      const parsed = new URL(url);
      if (!title || !["http:", "https:"].includes(parsed.protocol)) throw new Error("Add the essay title and its direct link.");
      if (data.essays.some((item) => item.url === parsed.href)) throw new Error("That essay is already on the shelf.");
      const item = { id: crypto.randomUUID(), title, url: parsed.href, excerpt, context: clean(form.context) };
      await save({ ...data, essays: [...data.essays, item] });
      setSelected(item.id); setForm({ title: "", url: "", excerpt: "", context: "" });
    } catch (e) { setError(e.message); }
  };
  const change = async (field, value) => {
    if (!essay) return;
    setError("");
    try {
      await save({ ...data, essays: data.essays.map((item) => item.id === essay.id ? { ...item, [field]: value } : item) });
    } catch (e) { setError(e.message); }
  };
  const generate = async () => {
    setError(""); setMessage("");
    if (!essay || !clean(essay.excerpt)) { setError("Paste an exact passage from the essay first. The desk will not invent a quotation."); return; }
    if (recent(essay)) { setError("This essay was used in the past seven days. Pick another one or wait for the rotation."); return; }
    setBusy(true);
    try {
      const result = await callOp({ op: "essay_note", story: { title: essay.title, url: essay.url, excerpt: essay.excerpt, context: essay.context } });
      const text = clean(result.text);
      if (!text) throw new Error("The draft came back empty.");
      setDraft(text);
      setMessage("Draft ready. Edit it here, then copy and mark it used.");
    } catch (e) { setError(e.message || "Could not draft the Note."); }
    setBusy(false);
  };
  const markUsed = async () => {
    if (!essay || !clean(draft)) return;
    setError(""); setMessage("");
    try {
      const note = { id: crypto.randomUUID(), essayId: essay.id, title: essay.title, url: essay.url, text: draft, usedAt: new Date().toISOString() };
      await save({ ...data, notes: [note, ...data.notes].slice(0, 300) });
      setDraft(""); setMessage("Recorded in the rotation. You can publish the copied draft as a Substack Note.");
    } catch (e) { setError(e.message); }
  };
  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); setMessage("Copied. Ready for Substack Notes."); }
    catch { setError("Clipboard unavailable. Select and copy the draft manually."); }
  };

  return <div style={{ color: C.ink, fontFamily: BODY, maxWidth: 780 }}>
    <Big s={30}>The Note Desk</Big>
    <p style={{ fontSize: 16, lineHeight: 1.5, margin: "10px 0 20px" }}>A peculiar line from the archive. A thought from the man who wrote it. One direct route back to the essay.</p>
    {error && <Problem onDismiss={() => setError("")}>{error}</Problem>}
    {message && <p role="status" style={{ color: C.ink, fontSize: 14 }}>{message}</p>}
    <Card style={{ marginBottom: 16 }}>
      <Mono>THE ROTATION · 7 DAYS</Mono>
      <p style={{ fontSize: 15, lineHeight: 1.5 }}>{eligible.length} of {essays.length} essays ready. Draft three different essays each day; an essay becomes unavailable here after you mark its Note used.</p>
      <label style={label} htmlFor="note-essay">Choose an essay</label>
      <select id="note-essay" style={input} value={selected} onChange={(e) => { setSelected(e.target.value); setDraft(""); }}>
        {essays.map((item) => <option key={item.id} value={item.id}>{recent(item) ? "Used " + date(item.usedAt) + " · " : ""}{item.title}</option>)}
      </select>
      {essay && <div>
        <p style={{ fontSize: 14 }}><a href={essay.url} target="_blank" rel="noreferrer">Open the individual essay ↗</a></p>
        <label style={label} htmlFor="note-excerpt">Exact passage from the essay</label>
        <textarea id="note-excerpt" rows={3} style={input} value={essay.excerpt} onChange={(e) => change("excerpt", e.target.value)} placeholder="Paste a short, exact extract you want to revisit." />
        <label style={label} htmlFor="note-context">What was going on in your head? (optional)</label>
        <textarea id="note-context" rows={2} style={input} value={essay.context || ""} onChange={(e) => change("context", e.target.value)} placeholder="The feeling, scene, disagreement, or odd thought behind it." />
        <div style={{ marginTop: 14 }}><Pill onClick={generate} disabled={busy || recent(essay)}>{busy ? "Writing…" : "Draft a Note"}</Pill></div>
      </div>}
    </Card>
    {draft && <Card style={{ marginBottom: 16 }}>
      <Mono>DRAFT · YOU HAVE THE FINAL WORD</Mono>
      <textarea aria-label="Edit Substack Note" rows={8} style={{ ...input, margin: "12px 0" }} value={draft} onChange={(e) => setDraft(e.target.value)} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <Pill onClick={() => copy(draft)}>Copy Note</Pill>
        <Pill tone="ghost" onClick={markUsed}>Mark used in rotation</Pill>
      </div>
    </Card>}
    <Card style={{ marginBottom: 16 }}>
      <Mono>ADD AN ESSAY</Mono>
      <label style={label} htmlFor="new-title">Title</label><input id="new-title" style={input} value={form.title} onChange={(e) => update("title", e.target.value)} />
      <label style={label} htmlFor="new-url">Direct essay link</label><input id="new-url" type="url" style={input} value={form.url} onChange={(e) => update("url", e.target.value)} />
      <label style={label} htmlFor="new-excerpt">Exact passage (optional)</label><textarea id="new-excerpt" rows={2} style={input} value={form.excerpt} onChange={(e) => update("excerpt", e.target.value)} />
      <div style={{ marginTop: 14 }}><Pill onClick={add}>Add to shelf</Pill></div>
    </Card>
    <Mono>USED NOTES</Mono>
    {data.notes.length ? data.notes.slice(0, 15).map((note) => <Card key={note.id} style={{ margin: "10px 0" }}>
      <strong>{note.title}</strong> · {date(note.usedAt)}
      <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{note.text}</p>
      <Pill tone="ghost" sm onClick={() => copy(note.text)}>Copy again</Pill>
    </Card>) : <p style={{ fontSize: 14 }}>Nothing used yet. The archive is waiting with unreasonable confidence.</p>}
  </div>;
}
