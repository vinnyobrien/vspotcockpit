import React, { useEffect, useState } from "react";
import { C, Big, Card, Section, Mono, Note } from "../lib/ui.jsx";

const DATES = ["2026-10-07", "2026-10-14", "2026-10-21", "2026-10-28"];
const INITIAL = {
  status: "pilot",
  sessions: DATES.map((date, i) => ({ id: date, date, title: i === 0 ? "The first room" : "", status: "planned", liveUrl: "", question: "", attendance: "", recapUrl: "" })),
};

const BENEFITS = [
  "Weekly 30-minute live commerce conversation during the four-week pilot",
  "Questions and story suggestions from paying subscribers",
  "Replay for paid subscribers who cannot join live",
  "Opportunity to pitch for a subscriber podcast conversation; participation is editorially selected and never guaranteed",
];

const CHECKLIST = [
  "Confirm the paid tier name, price and benefits in Substack before announcing",
  "Schedule each live in Substack for paid subscribers; copy its link below",
  "Reserve 14:45–15:45 Europe/Dublin in the calendar (prep, live, notes)",
  "Ask for questions 48 hours ahead; choose one lead story and two backups",
  "Send reminder 24 hours ahead and a short last-call note on the day",
  "Afterwards: save replay, answer missed questions, log attendance and upgrade response",
];

export default function Subscribers({ sGet, sSet, storageKey }) {
  const [data, setData] = useState(null);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    let active = true;
    sGet(storageKey, INITIAL).then((saved) => {
      if (active) setData({ ...INITIAL, ...saved, sessions: saved?.sessions?.length ? saved.sessions : INITIAL.sessions });
    }).catch(() => { if (active) setData(INITIAL); });
    return () => { active = false; };
  }, [sGet, storageKey]);

  const save = async (next) => {
    try { await sSet(storageKey, next); setSaveError(""); }
    catch { setSaveError("Could not save this change. Please try again."); }
  };
  const patch = (id, field, value, persist = false) => {
    const next = { ...data, sessions: data.sessions.map((s) => s.id === id ? { ...s, [field]: value } : s) };
    setData(next);
    if (persist) save(next);
  };

  if (!data) return <Note>Loading subscriber series…</Note>;

  return <div>
    <Note>Four-week pilot. This is the production tracker; publishing and access happen in Substack.</Note>
    {saveError && <p role="alert" style={{ color: C.red }}>{saveError}</p>}
    <Card tint={C.mint} style={{ marginBottom: 18 }}>
      <Mono c={C.ink}>PAID SUBSCRIPTION · PROPOSED OFFER</Mono>
      <div style={{ marginTop: 8 }}><Big s={26}>THE ROOM</Big></div>
      <p style={{ fontSize: 14, lineHeight: 1.5, marginTop: 10 }}>Come into the weekly conversation behind the essays and shows. Bring a question, challenge a take, or suggest the story we should pull apart next.</p>
      <ul style={{ paddingLeft: 20, margin: "12px 0 0", fontSize: 14, lineHeight: 1.65 }}>{BENEFITS.map((b) => <li key={b}>{b}</li>)}</ul>
      <p style={{ fontSize: 13, lineHeight: 1.5, marginTop: 12 }}>The public essays and shows continue. The live room and replay are the paid benefit. Do not promise every subscriber a podcast appearance or personal consulting.</p>
    </Card>

    <Section label="Calendar · four-week pilot">
      <Note>Wednesdays, 15:00–15:30 Europe/Dublin. In October this is 10:00 US Eastern for the first three dates, then 11:00 on 28 October after Ireland changes clocks. Calendar availability was checked on 28 September; recheck before publishing invitations.</Note>
      {data.sessions.map((s) => <Card key={s.id} style={{ marginBottom: 12 }}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div><Big s={19}>{new Date(`${s.date}T12:00:00Z`).toLocaleDateString("en-IE", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).toUpperCase()}</Big><div style={{ marginTop: 4 }}><Mono s={10}>15:00 IRELAND · 30 MINUTES</Mono></div></div>
          <select aria-label={`Status for ${s.date}`} value={s.status} onChange={(e) => patch(s.id, "status", e.target.value, true)} style={{ fontSize: 14, padding: 8, borderRadius: 8 }}>
            {[["planned", "Planned"], ["scheduled", "Scheduled"], ["promoted", "Promoted"], ["held", "Held"], ["recapped", "Recapped"], ["cancelled", "Cancelled"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
          {[["title", "Lead story / title"], ["liveUrl", "Substack live link"], ["question", "Lead subscriber question"], ["attendance", "Attendance and upgrades"], ["recapUrl", "Replay / recap link"]].map(([field, label]) =>
            <label key={field} style={{ display: "grid", gap: 4, fontSize: 13, color: C.ink2 }}>{label}
              <input value={s[field]} onChange={(e) => patch(s.id, field, e.target.value)} onBlur={() => save(data)} style={{ width: "100%", padding: 10, borderRadius: 9, border: "1px solid rgba(20,24,51,.2)", fontSize: 14, color: C.ink }} />
            </label>)}
        </div>
        {s.liveUrl && <a href={s.liveUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 12, fontSize: 14 }}>Open live session ↗</a>}
      </Card>)}
    </Section>
    <Section label="Production checklist"><Card><ul style={{ paddingLeft: 20, margin: 0, fontSize: 14, lineHeight: 1.7 }}>{CHECKLIST.map((x) => <li key={x}>{x}</li>)}</ul></Card></Section>
  </div>;
}
