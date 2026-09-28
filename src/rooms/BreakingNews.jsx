import React, { useEffect, useState } from "react";
import { C, BODY, Mono, Big, Card, Section, Pill, Empty, Problem } from "../lib/ui.jsx";
import { callOp, sGet, sSet, saveToGoogleDoc } from "../api.js";

const ARCHIVE = "vspot:scripts";
const decode = (text) => {
  const clean = String(text || "").replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  try { return JSON.parse(clean); } catch {
    const a = clean.indexOf("{"), b = clean.lastIndexOf("}");
    if (a < 0 || b <= a) throw new Error("The shortlist did not come back in a usable format. Try the scan again.");
    return JSON.parse(clean.slice(a, b + 1));
  }
};

export default function BreakingNews() {
  const [items, setItems] = useState([]);
  const [report, setReport] = useState([]);
  const [selected, setSelected] = useState([]);
  const [angles, setAngles] = useState({});
  const [direction, setDirection] = useState("");
  const [archive, setArchive] = useState([]);
  const [current, setCurrent] = useState(null);
  const [script, setScript] = useState("");
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => { sGet(ARCHIVE, []).then((rows) => setArchive(Array.isArray(rows) ? rows : [])); }, []);

  const scan = async () => {
    setBusy("scan"); setErr("");
    try {
      const r = await callOp({ op: "breaking_shortlist" });
      const parsed = decode(r.text);
      const byId = new Map((r.candidates || []).map((s) => [s.id, s]));
      const seen = new Set();
      const next = (parsed.picks || []).map((p) => {
        const source = byId.get(p.id);
        if (!source || seen.has(p.id) || !/^https?:\/\//.test(source.url)) return null;
        seen.add(p.id);
        return {
          ...source,
          why: String(p.why || "").slice(0, 400),
          angles: (Array.isArray(p.angles) ? p.angles : []).map(String).slice(0, 2),
          verify: String(p.verify || "Check the original article before recording.").slice(0, 400),
        };
      }).filter(Boolean);
      if (!next.length) throw new Error("No source-backed picks came back. Try scanning again.");
      setItems(next); setReport(r.feedReport || []); setSelected([]); setAngles({});
    } catch (e) { setErr(e.message || "The news scan failed."); }
    setBusy("");
  };

  const toggle = (id) => setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id)
    : prev.length < 8 ? [...prev, id] : prev);

  const selectedNews = () => selected.map((id) => {
    const s = items.find((item) => item.id === id);
    return s && { id: s.id, title: s.title, source: s.source, region: s.region,
      summary: s.summary, why: s.why, angle: s.angles[angles[id] || 0] || "", url: s.url };
  }).filter(Boolean);

  const generate = async () => {
    if (selected.length < 5 || selected.length > 8) return;
    setBusy("script"); setErr("");
    try {
      const sources = selectedNews();
      const r = await callOp({ op: "breaking_script", news: sources, extra: direction });
      const draft = String(r.text || "").trim();
      if (!draft) throw new Error("The script came back empty. Try again.");
      const entry = {
        id: crypto.randomUUID(), title: `The V Spot — ${new Date().toLocaleDateString("en-IE", { dateStyle: "long" })}`,
        createdAt: new Date().toISOString(), sources, direction, script: draft, doc: null,
      };
      setCurrent(entry); setScript(draft);
      const next = [entry, ...archive].slice(0, 100);
      if (await sSet(ARCHIVE, next)) setArchive(next);
      else setErr("Script generated, but the archive did not save. Copy it before leaving this page.");
    } catch (e) { setErr(e.message || "Could not generate the rundown."); }
    setBusy("");
  };

  const saveDraft = async () => {
    if (!current) return false;
    const updated = { ...current, script, editedAt: new Date().toISOString() };
    const next = [updated, ...archive.filter((x) => x.id !== updated.id)].slice(0, 100);
    if (!await sSet(ARCHIVE, next)) { setErr("The archive did not save. Your edits are still on screen."); return false; }
    setCurrent(updated); setArchive(next); setErr("");
    return true;
  };

  const saveDoc = async () => {
    if (!current || !script.trim()) return;
    setBusy("doc"); setErr("");
    try {
      if (!await saveDraft()) return;
      const sources = current.sources.map((s, i) => `${i + 1}. ${s.title} — ${s.source}\n${s.url}`).join("\n\n");
      const doc = await saveToGoogleDoc(current.title, `${script}\n\nSOURCE LINKS — VERIFY BEFORE RECORDING\n\n${sources}`);
      const updated = { ...current, script, doc: { id: doc.id, url: doc.url || `https://docs.google.com/document/d/${doc.id}/edit`, at: new Date().toISOString() } };
      const next = [updated, ...archive.filter((x) => x.id !== updated.id)].slice(0, 100);
      setCurrent(updated);
      if (await sSet(ARCHIVE, next)) setArchive(next);
      else setErr("Google Doc created, but its link did not save in the cockpit archive. Open or copy the link below.");
    } catch (e) { setErr(e.message || "Google did not create the Doc."); }
    setBusy("");
  };

  const openArchive = (entry) => { setCurrent(entry); setScript(entry.script); setErr(""); };

  return <div style={{ padding: "0 16px 40px" }}>
    <Problem onDismiss={() => setErr("")}>{err}</Problem>
    <Card tint={C.blush} pad={20} style={{ marginBottom: 16 }}>
      <Big s={27}>BREAKING NEWS</Big>
      <p style={{ fontSize: 13.5, lineHeight: 1.5, color: C.ink2, marginTop: 7 }}>
        Fresh trade stories, your selection, one satirical rundown. The feed gives us leads, not verified facts. Open the original articles before you record.
      </p>
      <div style={{ marginTop: 14 }}><Pill sm disabled={!!busy} onClick={scan}>{busy === "scan" ? "Scanning feeds…" : "Scan the news"}</Pill></div>
    </Card>

    {items.length > 0 && <Section label="The shortlist" right={<Mono>{selected.length}/8 selected · choose 5–8</Mono>}>
      {items.map((s) => <Card key={s.id} pad={17} tint={selected.includes(s.id) ? C.sand : C.card} style={{ marginBottom: 9 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div>
            <Mono s={9}>{s.source} · {s.region} · {new Date(s.at).toLocaleString("en-IE", { dateStyle: "medium", timeStyle: "short" })}</Mono>
            <div style={{ fontSize: 17, fontWeight: 700, color: C.ink, lineHeight: 1.25, marginTop: 5 }}>{s.title}</div>
          </div>
          <input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggle(s.id)}
            aria-label={`Select ${s.title}`} style={{ width: 23, height: 23, accentColor: C.red, flexShrink: 0 }} />
        </div>
        <p style={{ fontSize: 13, lineHeight: 1.45, color: C.ink2, marginTop: 8 }}>{s.summary}</p>
        <p style={{ fontSize: 13, lineHeight: 1.45, color: C.ink, marginTop: 8 }}><strong>Why it made the cut:</strong> {s.why}</p>
        <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: C.red, display: "inline-block", marginTop: 8 }}>Read original ↗</a>
        <p style={{ fontSize: 12, color: C.ink2, marginTop: 5 }}>Check: {s.verify}</p>
        {selected.includes(s.id) && <div style={{ marginTop: 10 }}>
          <Mono s={9}>THE COMIC ANGLE</Mono>
          <select value={angles[s.id] || 0} onChange={(e) => setAngles((p) => ({ ...p, [s.id]: Number(e.target.value) }))}
            aria-label={`Comic angle for ${s.title}`}
            style={{ display: "block", width: "100%", marginTop: 5, padding: 9, borderRadius: 10, border: "1px solid rgba(20,24,51,.16)", background: "#fff", color: C.ink, fontFamily: BODY }}>
            {s.angles.map((angle, i) => <option key={i} value={i}>{angle}</option>)}
          </select>
        </div>}
      </Card>)}
      <Card pad={17} tint={C.mint}>
        <label htmlFor="vspot-direction" style={{ fontSize: 13, fontWeight: 650, color: C.ink }}>Your line on the day</label>
        <textarea id="vspot-direction" value={direction} onChange={(e) => setDirection(e.target.value)} rows={3}
          placeholder="What links these stories? Which claim should the jokes land on?"
          style={{ width: "100%", marginTop: 8, padding: 10, background: "#fff", border: "1px solid rgba(20,24,51,.15)", borderRadius: 9, fontFamily: BODY, fontSize: 14 }} />
        <div style={{ marginTop: 10 }}><Pill sm disabled={selected.length < 5 || selected.length > 8 || !!busy} onClick={generate}>
          {busy === "script" ? "Writing rundown…" : `Generate draft from ${selected.length} stories`}
        </Pill></div>
      </Card>
      {report.some((r) => !r.ok) && <p style={{ fontSize: 12, color: C.ink2, marginTop: 8 }}>
        {report.filter((r) => !r.ok).length} feed(s) unavailable in this scan. The shortlist uses sources that responded.
      </p>}
    </Section>}

    {current && <Section label="The rundown" right={<Mono>{current.doc ? "Google Doc saved" : "Cockpit draft"}</Mono>}>
      <Card pad={18}>
        <div style={{ fontSize: 17, fontWeight: 700, color: C.ink }}>{current.title}</div>
        <p style={{ fontSize: 12, color: C.ink2, marginTop: 5 }}>Draft. Read and verify every source. Edit the spoken copy before recording.</p>
        <textarea value={script} onChange={(e) => setScript(e.target.value)} rows={24}
          aria-label="V Spot script" style={{ width: "100%", marginTop: 12, padding: 12, borderRadius: 9, border: "1px solid rgba(20,24,51,.16)", background: "#fff", fontFamily: BODY, fontSize: 14, lineHeight: 1.55 }} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          <Pill sm tone="ghost" onClick={saveDraft} disabled={!!busy}>Save edits</Pill>
          <Pill sm onClick={saveDoc} disabled={!!busy || !script.trim()}>{busy === "doc" ? "Creating Doc…" : current.doc ? "Create updated Google Doc" : "Create Google Doc"}</Pill>
          {current.doc?.url && <a href={current.doc.url} target="_blank" rel="noopener noreferrer" style={{ alignSelf: "center", color: C.red, fontSize: 13 }}>Open Google Doc ↗</a>}
        </div>
        {current.doc && <p style={{ fontSize: 12, color: C.ink2, marginTop: 8 }}>The Doc is a snapshot. If you edit here afterward, save edits and create an updated Doc.</p>}
      </Card>
    </Section>}

    <Section label="Script archive" right={<Mono>{archive.length} saved</Mono>}>
      {archive.length ? archive.map((entry) => <Card key={entry.id} pad={14} style={{ marginBottom: 7 }}>
        <button onClick={() => openArchive(entry)} style={{ border: 0, background: "transparent", color: C.ink, fontWeight: 650, fontSize: 14, textAlign: "left", cursor: "pointer" }}>
          {entry.title} · {entry.sources?.length || 0} stories
        </button>
        {entry.doc?.url && <a href={entry.doc.url} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 10, fontSize: 12, color: C.red }}>Doc ↗</a>}
      </Card>) : <Empty>No scripts archived yet. The first one starts with a scan.</Empty>}
    </Section>
  </div>;
}
