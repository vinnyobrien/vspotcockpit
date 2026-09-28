import React, { useEffect, useMemo, useState } from "react";
import { C, BODY, Mono, Card, Section, Pill } from "../lib/ui.jsx";
import { sGet, sSet } from "../api.js";

const KEY = "editor:prompts";
const until = (days) => Date.now() + days * 86400000;

/** A small editorial intervention, based only on records already in the cockpit. */
export default function EditorialCall({ gaps, threads, onNavigate }) {
  const [responses, setResponses] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [thought, setThought] = useState("");
  const [thread, setThread] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    sGet(KEY, {}).then((value) => { if (active) { setResponses(value || {}); setLoaded(true); } });
    return () => { active = false; };
  }, []);

  const prompts = useMemo(() => {
    const items = [{
      id: "opinion", title: "What did you hear that you disagree with?",
      why: "Name the claim, the thing you saw that complicates it, and who you would ask to defend it.",
      room: "essay", action: "Develop the argument",
    }];
    if (gaps.some((g) => /sponsor|spec build|Camp Tralee/i.test(g.t))) items.push({
      id: "commercial", title: "Who should hear your argument next?",
      why: "Your sponsor pipeline has a gap. Pick one relevant partner and make a specific offer around the work you are already making.",
      room: "growth", action: "Open partners",
    });
    if (gaps.some((g) => /guest/i.test(g.t))) items.push({
      id: "guest", title: "Who would make this argument better?",
      why: "The next interview needs a guest. Invite someone who might challenge your view, not just endorse it.",
      room: "guests", action: "Open guests",
    });
    const stale = (threads || []).find((t) => t.last && Date.now() - new Date(t.last).getTime() > 21 * 86400000);
    if (stale) items.push({
      id: `thread:${stale.id}`, title: `Is “${stale.name}” still true?`,
      why: "An old argument deserves another look in light of what you have learned since.",
      room: "essay", action: "Revisit the essay", thread: stale.id,
    });
    return items.filter((p) => !responses[p.id] || responses[p.id] <= Date.now()).slice(0, 3);
  }, [gaps, threads, responses]);

  const quiet = async (id, days) => {
    const next = { ...responses, [id]: until(days) };
    if (await sSet(KEY, next)) setResponses(next);
    else setError("Could not save that choice. Please try again.");
  };

  const capture = async () => {
    const text = thought.trim();
    if (!text || saving) return;
    setSaving(true);
    setError("");
    const target = thread || "untitled";
    const key = `essay:${target}`;
    const existing = await sGet(key, {});
    const entry = { id: crypto.randomUUID(), text, at: Date.now(), from: "Editor's call" };
    const next = { ...existing, capture: [entry, ...(existing.capture || [])], updated: Date.now() };
    if (await sSet(key, next)) {
      setThought("");
      await quiet("opinion", 1);
      onNavigate("essay", target);
    } else setError("The thought did not save. It is still in the box below.");
    setSaving(false);
  };

  if (!loaded || !prompts.length) return null;
  return <Section label="Editor's call" right={<Mono>your move</Mono>}>
    {error && <p role="alert" style={{ color: C.red, fontSize: 13, marginBottom: 8 }}>{error}</p>}
    {prompts.map((p) => <Card key={p.id} tint={p.id === "opinion" ? C.lilac : C.sand} pad={18} style={{ marginBottom: 9 }}>
      <div style={{ fontSize: 17, fontWeight: 700, color: C.ink, lineHeight: 1.25 }}>{p.title}</div>
      <p style={{ color: C.ink2, fontSize: 13, lineHeight: 1.45, marginTop: 5 }}>{p.why}</p>
      {p.id === "opinion" && <>
        <textarea value={thought} onChange={(e) => setThought(e.target.value)} rows={3}
          placeholder="Your words, rough edges welcome. Nothing is published."
          style={{ width: "100%", marginTop: 12, padding: 11, borderRadius: 10, border: "1px solid rgba(20,24,51,.15)", background: "#fff", fontFamily: BODY, fontSize: 14, resize: "vertical" }} />
        <select value={thread} onChange={(e) => setThread(e.target.value)} aria-label="Essay thread"
          style={{ width: "100%", marginTop: 7, padding: 9, borderRadius: 10, border: "1px solid rgba(20,24,51,.15)", background: "#fff", color: C.ink }}>
          <option value="">New idea</option>
          {(threads || []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
        <Pill sm disabled={p.id === "opinion" && (!thought.trim() || saving)}
          onClick={p.id === "opinion" ? capture : () => onNavigate(p.room, p.thread || "")}>
          {p.id === "opinion" ? (saving ? "Saving…" : "Keep in Essay") : p.action}
        </Pill>
        <Pill sm tone="ghost" onClick={() => quiet(p.id, 2)}>Ask me later</Pill>
        <Pill sm tone="ghost" onClick={() => quiet(p.id, 7)}>Done for now</Pill>
      </div>
    </Card>)}
  </Section>;
}
