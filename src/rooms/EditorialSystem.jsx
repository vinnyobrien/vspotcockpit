import React, { useEffect, useState } from "react";
import { C, BODY, Card, Mono, Pill, Field, Problem, Chips } from "../lib/ui.jsx";
import { sGet, sSet } from "../api.js";

const KEY = "editorial-system:v1";
const SEED_TALKS = [
  { id: "nerds", title: "Revenge of the Nerds", source: "Revenge of the Nerds essay", stage: "idea", pitch: "" },
  { id: "customer", title: "Who Owns the Customer?", source: "Consumer sovereignty / personal AI essays", stage: "idea", pitch: "" },
  { id: "right-now", title: "I'm Not Mr Right. I'm Mr Right Now.", source: "Black Friday / seasoned operator essay", stage: "idea", pitch: "" },
];
const SEED_ASSETS = [
  { id: "skyline", title: "V Spot Media skyline badge", kind: "Master candidate", source: "Library: V-Spot Media Skyline Badge Logo.png", status: "source identified; master export pending" },
  { id: "neon", title: "V Spot Media neon badge", kind: "Variant", source: "Library: V-Spot Media neon badge.png", status: "source identified" },
  { id: "mono", title: "V Spot Media monochrome badge", kind: "Variant", source: "Library: V-Spot Media monochrome logo.png", status: "source identified" },
];
const initial = { rules: [], talks: SEED_TALKS, assets: SEED_ASSETS };
const uid = () => globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
const inputStyle = { width: "100%", border: "1px solid #ccd0d7", borderRadius: 9, padding: 10, fontFamily: BODY, fontSize: 14, boxSizing: "border-box", color: C.ink };
export default function EditorialSystem() {
  const [data, setData] = useState(initial);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("rules");
  const [err, setErr] = useState("");
  const [rule, setRule] = useState("");
  const [scope, setScope] = useState("global");
  const [before, setBefore] = useState("");
  const [after, setAfter] = useState("");
  const [title, setTitle] = useState("");
  const [source, setSource] = useState("");
  useEffect(() => {
    let active = true;
    sGet(KEY, null).then(v => { if (active) { setData(v && typeof v === "object" ? { ...initial, ...v } : initial); setLoaded(true); } });
    return () => { active = false; };
  }, []);
  const persist = async next => {
    const ok = await sSet(KEY, next);
    if (!ok) { setErr("Could not save to cockpit storage. Changes were not committed."); return false; }
    setData(next); setErr(""); return true;
  };
  const addRule = async () => {
    if (!rule.trim()) return;
    const next = { ...data, rules: [{ id: uid(), text: rule.trim(), scope, before: before.trim(), after: after.trim(), approved: true, at: new Date().toISOString() }, ...data.rules] };
    if (await persist(next)) { setRule(""); setBefore(""); setAfter(""); }
  };
  const removeRule = async id => { await persist({ ...data, rules: data.rules.filter(r => r.id !== id) }); };
  const addTalk = async () => {
    if (!title.trim()) return;
    const next = { ...data, talks: [...data.talks, { id: uid(), title: title.trim(), source: source.trim(), pitch: "", stage: "idea" }] };
    if (await persist(next)) { setTitle(""); setSource(""); }
  };
  const updateTalk = async (id, patch) => { await persist({ ...data, talks: data.talks.map(t => t.id === id ? { ...t, ...patch } : t) }); };
  if (!loaded) return <Card>Loading editorial library…</Card>;
  return <div style={{ paddingBottom: 36 }}>
    <Card tint={C.ink} style={{ marginBottom: 14, color: "#fff" }}>
      <Mono c="#D2B48C">V Spot Media · Editorial System</Mono>
      <h2 style={{ fontSize: 26, fontWeight: 800, margin: "8px 0", color: "#fff" }}>One voice. Many formats.</h2>
      <p style={{ fontSize: 13, lineHeight: 1.6 }}>Approved phrases, source artwork and essays becoming talks. Your edits are the authority. Nothing here publishes or emails automatically.</p>
    </Card>
    <Problem onDismiss={() => setErr("")}>{err}</Problem>
    <Chips items={[[ "rules", "Voice & rules" ], [ "assets", "Artwork" ], [ "talks", "Speaking" ]]} value={tab} onChange={setTab} />
    <div style={{ height: 14 }} />
    {tab === "rules" && <>
      <Card style={{ marginBottom: 12 }}>
        <Mono>Approve a reusable editorial rule</Mono>
        <p style={{ fontSize: 13, color: C.ink2, margin: "10px 0" }}>Only rules you explicitly save are applied to your editorial reference. Edits elsewhere do not silently become global preferences.</p>
        <Field rows={3} value={rule} onChange={setRule} placeholder="e.g. Avoid corporate filler; lead with the actual point." />
        <label style={{ display: "block", fontSize: 12, marginTop: 10 }}>Applies to</label>
        <select value={scope} onChange={e => setScope(e.target.value)} style={inputStyle}>
          <option value="global">All V Spot Media copy</option><option value="vspot">V Spot News</option><option value="struggle">Struggle Bus</option><option value="ostrich">Ostrich Report</option><option value="sponsor">Sponsor outreach</option><option value="consulting">Consulting</option>
        </select>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 8, marginTop: 10 }}>
          <Field value={before} onChange={setBefore} placeholder="Original phrase (optional)" />
          <Field value={after} onChange={setAfter} placeholder="Preferred replacement (optional)" />
        </div>
        <div style={{ marginTop: 12 }}><Pill sm disabled={!rule.trim()} onClick={addRule}>Approve & save rule</Pill></div>
      </Card>
      {data.rules.length === 0 ? <Card>No saved rules yet. Start with a phrase you routinely replace.</Card> : data.rules.map(r => <Card key={r.id} style={{ marginBottom: 9 }}>
        <Mono>{r.scope} · Approved {new Date(r.at).toLocaleDateString()}</Mono>
        <p style={{ margin: "10px 0", fontSize: 14 }}>{r.text}</p>
        {r.before && <p style={{ fontSize: 12, color: C.ink2 }}>Before: {r.before} → After: {r.after || "(omit)"}</p>}
        <Pill sm tone="ghost" onClick={() => removeRule(r.id)}>Revoke rule</Pill>
      </Card>)}
    </>}
    {tab === "assets" && <>
      <Card style={{ marginBottom: 12 }}>
        <Mono>Network identity</Mono>
        <p style={{ fontSize: 14, marginTop: 10 }}>The approved walking wine-and-water silhouette is the network signature. Quick 0.5–1.5 second stamp for all shows; extended V SPOT MEDIA production seal for external work. Keep sponsor logos separate.</p>
        <p style={{ fontSize: 12, color: C.ink2 }}>Asset registry below records source names, not image binaries. Verify and register exact original files and rights before production use.</p>
      </Card>
      {data.assets.map(a => <Card key={a.id} style={{ marginBottom: 9 }}>
        <strong>{a.title}</strong><p style={{ fontSize: 12, color: C.ink2 }}>{a.kind} · {a.status}</p><p style={{ fontSize: 12 }}>{a.source}</p>
      </Card>)}
      <Card><Mono>Image rule</Mono><p style={{ fontSize: 13, marginTop: 8 }}>Start with a written story, then commission or generate its visual. Never publish generic filler imagery, alter approved headshots, or use client material in public prompts.</p></Card>
    </>}
    {tab === "talks" && <>
      <Card style={{ marginBottom: 12 }}>
        <Mono>Speaking catalogue</Mono>
        <p style={{ fontSize: 13, color: C.ink2, marginTop: 8 }}>Convert essays into 12–18 minute original talks, speaker abstracts, audition reels, visual decks and bookable offerings. No TED affiliation implied.</p>
        <Field value={title} onChange={setTitle} placeholder="Talk title" />
        <div style={{ height: 8 }} /><Field value={source} onChange={setSource} placeholder="Source essay or idea" />
        <div style={{ marginTop: 12 }}><Pill sm disabled={!title.trim()} onClick={addTalk}>Add talk candidate</Pill></div>
      </Card>
      {data.talks.map(t => <Card key={t.id} style={{ marginBottom: 9 }}>
        <strong>{t.title}</strong><p style={{ fontSize: 12, color: C.ink2, margin: "6px 0" }}>Source: {t.source || "Not linked yet"}</p>
        <label style={{ fontSize: 12 }}>Development stage</label>
        <select value={t.stage} onChange={e => updateTalk(t.id, { stage: e.target.value })} style={inputStyle}>
          {["idea","developing","ready_to_pitch","booked","delivered","retired"].map(x => <option key={x} value={x}>{x.replaceAll("_"," ")}</option>)}
        </select>
        <label style={{ display: "block", marginTop: 9, fontSize: 12 }}>Speaker pitch / promise</label>
        <textarea key={t.id + t.pitch} defaultValue={t.pitch} onBlur={e => { if (e.target.value !== t.pitch) updateTalk(t.id, { pitch: e.target.value }); }} rows={3} style={{ ...inputStyle, resize: "vertical" }} placeholder="What will the audience leave knowing?" />
      </Card>)}
    </>}
  </div>;
}
