import React, { useState } from "react";
import { ExternalLink, Download } from "lucide-react";
import {
  C, BODY, MONO, Mono, Big, Card, Section, Pill, Field, Note, Empty,
  Problem, Chips,
} from "../lib/ui.jsx";
import { sGet, sSet } from "../api.js";

/* ============================================================
   src/rooms/Shows.jsx

   Live: /api/feed?url=  → _rss.js

   Paste a feed, the back catalogue arrives. Each episode then
   carries its own guest, assets, notes and emails.
   ============================================================ */

const SHOWS = [
  { id: "struggle", name: "The Struggle Bus", tint: C.apricot, note: "Season 3. Sponsor: Parcel Planet." },
  { id: "ostrich",  name: "The Ostrich Report", tint: C.sky,   note: "Weekly with Hendrik Laubscher." },
  { id: "sunday",   name: "The Sunday Supplement", tint: C.sand, note: "Not live yet." },
];

export default function Shows({ K }) {
  const [show, setShow] = useState("struggle");
  const [feeds, setFeeds] = useState({});
  const [episodes, setEpisodes] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [loaded, setLoaded] = useState(false);

  React.useEffect(() => {
    (async () => {
      setFeeds(await sGet("show-feeds", {}));
      setEpisodes(await sGet("episodes", {}));
      setLoaded(true);
    })();
  }, []);

  const current = SHOWS.find((s) => s.id === show);
  const url = feeds[show] || "";
  const rows = episodes[show] || [];

  const setUrl = (v) => {
    const next = { ...feeds, [show]: v };
    setFeeds(next);
    sSet("show-feeds", next);
  };

  const pull = async () => {
    if (!url.trim()) return;
    setBusy(true);
    setErr("");
    try {
      const res = await fetch(`/api/feed?url=${encodeURIComponent(url.trim())}`, { credentials: "same-origin" });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `The feed returned ${res.status}.`);

      const items = (data.items || data.episodes || (Array.isArray(data) ? data : [])).slice(0, 60).map((e) => ({
        title: e.title || "Untitled",
        date: (e.pubDate || e.date || e.published || "").slice(0, 10),
        link: e.link || e.url || "",
        summary: (e.description || e.summary || "").replace(/<[^>]+>/g, "").slice(0, 260),
      }));

      if (!items.length) throw new Error("The feed parsed but had no episodes in it. Check the URL is the RSS feed and not the show page.");

      const next = { ...episodes, [show]: items };
      setEpisodes(next);
      await sSet("episodes", next);
    } catch (e) {
      setErr(e.message || "Could not read that feed.");
    }
    setBusy(false);
  };

  if (!loaded) return <div style={{ padding: "20px 4px" }}><Mono>Loading…</Mono></div>;

  return (
    <div>
      <Note>Paste a feed and the whole back catalogue arrives. Each episode then carries its own guest, assets and notes.</Note>
      <Problem onDismiss={() => setErr("")}>{err}</Problem>

      <Chips items={SHOWS.map((s) => [s.id, s.name.replace("The ", "")])} value={show} onChange={setShow} />
      <div style={{ height: 14 }} />

      <Card tint={current.tint} style={{ marginBottom: 16 }}>
        <Big s={22}>{current.name.toUpperCase()}</Big>
        <div style={{ marginTop: 5 }}><Mono s={9}>{current.note}</Mono></div>
        <div style={{ marginTop: 14 }}>
          <Field tint="rgba(255,255,255,.7)" value={url} onChange={setUrl} onEnter={pull}
            placeholder="https://anchor.fm/s/…/podcast/rss" />
        </div>
        <div style={{ marginTop: 10 }}>
          <Pill full sm icon={Download} disabled={busy || !url.trim()} onClick={pull}>
            {busy ? "Reading the feed…" : rows.length ? "Pull again" : "Pull episodes"}
          </Pill>
        </div>
      </Card>

      {rows.length === 0 && !busy && (
        <Empty>No episodes pulled yet. The feed URL is usually on the show's hosting dashboard, not the public page.</Empty>
      )}

      {rows.length > 0 && (
        <Section label={`Episodes · ${rows.length}`}>
          {rows.slice(0, 25).map((e, i) => (
            <Card key={i} pad={16} style={{ marginBottom: 9 }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Mono s={9}>{e.date}</Mono>
                  <div style={{ fontSize: 14.5, color: C.ink, fontWeight: 500, lineHeight: 1.35, marginTop: 4 }}>
                    {e.title}
                  </div>
                  {e.summary && (
                    <p style={{ fontSize: 12.5, color: C.ink2, lineHeight: 1.45, marginTop: 5 }}>
                      {e.summary.slice(0, 150)}{e.summary.length > 150 ? "…" : ""}
                    </p>
                  )}
                </div>
                {e.link && (
                  <a href={e.link} target="_blank" rel="noopener noreferrer" style={{ color: C.ink2, flexShrink: 0 }}>
                    <ExternalLink size={16} strokeWidth={2.2} />
                  </a>
                )}
              </div>
            </Card>
          ))}
        </Section>
      )}
    </div>
  );
}
