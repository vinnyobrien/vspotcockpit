import React, { useEffect, useMemo, useState } from 'react';
import { C, Mono, Big, Card, Section, Pill, Field, Note, Problem } from '../lib/ui.jsx';
import { sGet, sSet } from '../api.js';
import { parseVtt, excerptAround } from '../lib/vtt.js';

const KEY = 'episode-intelligence:v1';
const TYPES = [
  ['story', 'Human story'], ['claim', 'Check a claim'], ['disagreement', 'Disagreement'],
  ['question', 'Next question'], ['clip', 'Clip candidate'], ['essay', 'Essay seed'],
];
const uid = () => crypto.randomUUID();

function brief(episode) {
  const lines = [
    `${episode.show} · ${episode.title || 'Untitled episode'}`,
    `Guest: ${episode.guestName || 'Unlinked'}`,
    `Your central reading: ${episode.reading || '[Add your own reading before generating copy.]'}`,
    '', 'SELECTED MOMENTS (timecoded, from the transcript)',
  ];
  for (const moment of episode.moments || []) {
    lines.push(`[${moment.start}–${moment.end}] ${moment.type}: ${moment.excerpt}`);
    if (moment.reading) lines.push(`Vinny's reading: ${moment.reading}`);
    if (moment.source) lines.push(`Source or verification: ${moment.source}`);
  }
  lines.push('', 'These are selected excerpts, not a complete transcript. Preserve uncertainty and verify names and numbers against the recording.');
  return lines.join('\n');
}

export default function EpisodeIntelligence({ guests = [], onBuild }) {
  const [episodes, setEpisodes] = useState([]);
  const [selected, setSelected] = useState('');
  const [cues, setCues] = useState([]);
  const [query, setQuery] = useState('');
  const [type, setType] = useState('story');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    sGet(KEY, []).then(rows => {
      const list = Array.isArray(rows) ? rows : [];
      setEpisodes(list);
      setSelected(list[0]?.id || '');
      setReady(true);
    });
  }, []);

  const episode = episodes.find(item => item.id === selected);
  const matches = useMemo(() => cues.map((cue, index) => ({ ...cue, index }))
    .filter(cue => cue.text.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 80), [cues, query]);

  const save = async next => {
    setEpisodes(next);
    if (!(await sSet(KEY, next))) setError('Could not save the episode record. Check your connection before leaving.');
    else { setError(''); setNotice('Saved.'); }
  };
  const update = patch => {
    if (!episode) return;
    save(episodes.map(item => item.id === selected ? { ...item, ...patch, updated: new Date().toISOString() } : item));
  };
  const addEpisode = () => {
    const id = uid();
    save([{ id, title: '', show: 'The Struggle Bus', guestId: '', guestName: '', reading: '', moments: [], created: new Date().toISOString() }, ...episodes]);
    setSelected(id);
    setCues([]);
    setNotice('New episode. Import a VTT transcript to select moments.');
  };
  const importFile = async file => {
    if (!file) return;
    const parsed = parseVtt(await file.text());
    if (!parsed.length) { setError('No VTT cues found. Export a WebVTT file with timecodes.'); return; }
    setCues(parsed);
    setQuery('');
    setError('');
    setNotice(`${parsed.length} cues loaded in this browser session. The complete transcript was not saved.`);
  };
  const mark = index => {
    const excerpt = excerptAround(cues, index);
    update({ moments: [...episode.moments, { id: uid(), type, ...excerpt, reading: '', source: '', status: 'review' }] });
  };
  const changeMoment = (id, patch) => update({ moments: episode.moments.map(m => m.id === id ? { ...m, ...patch } : m) });
  const removeMoment = id => update({ moments: episode.moments.filter(m => m.id !== id) });
  const copy = async () => { await navigator.clipboard.writeText(brief(episode)); setNotice('Episode brief copied.'); };

  if (!ready) return <Mono>Loading episodes…</Mono>;
  return <div>
    <Note>One conversation, many possible pieces. Keep your reading alongside the recording; selected moments are saved, the full VTT stays in this browser session.</Note>
    <Problem onDismiss={() => setError('')}>{error}</Problem>
    {notice && <p style={{ color: C.ink2, fontSize: 12 }}>{notice}</p>}
    <div className="flex gap-2 items-center" style={{ margin: '16px 0' }}>
      <select value={selected} onChange={e => { setSelected(e.target.value); setCues([]); setNotice('Import the VTT again to select more moments.'); }} style={{ flex: 1, padding: 12, borderRadius: 12 }}>
        <option value="">Choose an episode</option>
        {episodes.map(e => <option key={e.id} value={e.id}>{e.title || 'Untitled episode'} · {e.guestName || 'Guest pending'}</option>)}
      </select>
      <Pill sm onClick={addEpisode}>New episode</Pill>
    </div>
    {episode && <>
      <Card style={{ marginBottom: 16 }}>
        <Big s={20}>THE CONVERSATION</Big>
        <div style={{ display: 'grid', gap: 9, marginTop: 12 }}>
          <Field value={episode.title} onChange={v => update({ title: v })} placeholder="Episode title" />
          <select value={episode.show} onChange={e => update({ show: e.target.value })} style={{ padding: 10, borderRadius: 10 }}>
            {['The Struggle Bus', 'The Ostrich Report', 'The V Spot', 'Other'].map(x => <option key={x}>{x}</option>)}
          </select>
          <select value={episode.guestId} onChange={e => {
            const g = guests.find(x => String(x.id) === e.target.value);
            update({ guestId: e.target.value, guestName: g?.name || episode.guestName });
          }} style={{ padding: 10, borderRadius: 10 }}>
            <option value="">Guest not in the pipeline</option>
            {guests.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <Field value={episode.guestName} onChange={v => update({ guestName: v, guestId: '' })} placeholder="Guest name (if not in the pipeline)" />
          <Field value={episode.reading} onChange={v => update({ reading: v })} rows={3} placeholder="What did this conversation change or sharpen for you? Your words go here." />
        </div>
      </Card>
      <Card style={{ marginBottom: 16 }}>
        <Section label="Transcript desk" />
        <input type="file" accept=".vtt,text/vtt" onChange={e => importFile(e.target.files?.[0])} />
        {cues.length > 0 && <>
          <div className="flex gap-2" style={{ marginTop: 12 }}>
            <Field value={query} onChange={setQuery} placeholder="Search the conversation" />
            <select value={type} onChange={e => setType(e.target.value)} style={{ borderRadius: 10 }}>
              {TYPES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </div>
          <div style={{ maxHeight: 350, overflowY: 'auto', marginTop: 12 }}>
            {matches.map(cue => <div key={cue.index} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid #ddd' }}>
              <Mono s={9}>{cue.start}</Mono><span style={{ flex: 1, fontSize: 13 }}>{cue.text}</span>
              <button type="button" onClick={() => mark(cue.index)}>Mark</button>
            </div>)}
          </div>
          <Mono s={9}>Mark saves roughly 70 seconds around a cue. Trim the excerpt below before using it.</Mono>
        </>}
      </Card>
      <Section label={`The intelligence · ${episode.moments.length} moments`} />
      {episode.moments.map(m => <Card key={m.id} style={{ marginBottom: 10 }}>
        <Mono s={9}>{m.start}–{m.end} · {TYPES.find(t => t[0] === m.type)?.[1]}</Mono>
        <Field value={m.excerpt} onChange={v => changeMoment(m.id, { excerpt: v })} rows={3} />
        <div style={{ marginTop: 8 }}><Field value={m.reading} onChange={v => changeMoment(m.id, { reading: v })} rows={2} placeholder="Your reading, disagreement or next question" /></div>
        <div style={{ marginTop: 8 }}><Field value={m.source} onChange={v => changeMoment(m.id, { source: v })} placeholder="Source / verification needed" /></div>
        <div className="flex gap-2" style={{ marginTop: 8 }}>
          <select value={m.status} onChange={e => changeMoment(m.id, { status: e.target.value })}><option value="review">Needs review</option><option value="approved">Approved</option><option value="dropped">Dropped</option></select>
          <button type="button" onClick={() => removeMoment(m.id)}>Remove</button>
        </div>
      </Card>)}
      {episode.moments.length > 0 && <Card style={{ marginTop: 16 }}>
        <Big s={18}>TAKE IT FURTHER</Big>
        <p style={{ fontSize: 13, lineHeight: 1.5 }}>A timecoded brief for the existing Build room. Review the claims and your central reading before generating channel copy.</p>
        <div className="flex gap-2"><Pill sm onClick={copy}>Copy brief</Pill><Pill sm onClick={() => onBuild({ context: `${episode.show} · ${episode.title}`, source: brief(episode) })}>Open in Build</Pill></div>
      </Card>}
    </>}
  </div>;
}
