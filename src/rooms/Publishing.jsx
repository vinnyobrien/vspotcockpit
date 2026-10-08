import React, {useEffect,useState} from 'react';
import {C,Card,Big,Mono,Pill,Field} from '../lib/ui.jsx';
import {readKey,writeKey} from '../lib/api.js';
import {PUBLISHING_KEY,RELEASE_SCHEDULE,COPY_FIELDS,newRelease,seedPublishing,releaseBlockers} from '../lib/publishing.js';

export default function Publishing({onProduction,onCalendar}) {
  const [items,setItems]=useState(null),[draft,setDraft]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
  async function load(){try{const rows=await readKey(PUBLISHING_KEY,seedPublishing());if(!Array.isArray(rows))throw new Error('Publishing records are invalid.');setItems(rows);setDraft(rows[0]||null);setError('');}catch(e){setError(e.message);}}
  useEffect(()=>{load();},[]);
  const set=(key,value)=>setDraft(d=>({...d,[key]:value}));
  async function save(){setBusy(true);try{const latest=await readKey(PUBLISHING_KEY,seedPublishing());if(!Array.isArray(latest))throw new Error('Reload the publishing records.');const next=latest.some(x=>x.id===draft.id)?latest.map(x=>x.id===draft.id?draft:x):[draft,...latest];await writeKey(PUBLISHING_KEY,next);setItems(next);setNotice('Release pack saved.');setError('');}catch(e){setError(e.message);}finally{setBusy(false);}}
  return <div>
    <Card style={{background:C.sand,marginBottom:18}}><Big s={23}>WEEKLY RELEASES</Big><p>All release times are in Ireland. Wednesday, Thursday and Friday have no fixed time yet.</p><table style={{width:'100%',textAlign:'left'}}><thead><tr><th>Programme</th><th>Day</th><th>Time</th></tr></thead><tbody>{RELEASE_SCHEDULE.map(s=><tr key={s.show}><td style={{padding:'8px 0'}}>{s.show}</td><td>{s.day}</td><td>{s.time||'To set'}</td></tr>)}</tbody></table><p>Prepare and schedule each release ahead of time. Calendar markers do not upload or publish episodes.</p><Pill sm tone="ghost" onClick={onCalendar}>Content Calendar</Pill></Card>
    {error&&<Card><p role="alert">{error}</p><Pill onClick={load}>Reload publishing records</Pill></Card>}
    {!items?<p>Loading release packs…</p>:<>
      <div style={{display:'flex',gap:10,marginBottom:18,flexWrap:'wrap'}}><select aria-label="Release pack" value={draft?.id||''} onChange={e=>{setDraft(items.find(x=>x.id===e.target.value));setNotice('');}} style={{padding:10,flex:1}}>{items.map(x=><option key={x.id} value={x.id}>{x.guest||x.show} · {x.date||'Date pending'}</option>)}</select><Pill sm onClick={()=>{const row=newRelease(crypto.randomUUID());setItems([row,...items]);setDraft(row);setNotice('New pack — save to keep it.');}}>New release pack</Pill></div>
      {draft&&<>
        <Card style={{marginBottom:18}}><Big s={23}>{draft.guest||draft.show}</Big><p style={{color:releaseBlockers(draft).length?C.red:C.ink}}><strong>{releaseBlockers(draft).length?'Preparation pending':'Ready to schedule'}</strong></p><p style={{fontSize:12}}>{releaseBlockers(draft).join(' · ')}</p><p>Episode titles, claims and chapters must come from the complete transcript and final exports. The Substack piece should explore what the conversation reveals about the person and their motivations.</p>
          <label>Programme<select aria-label="Programme" value={draft.show} onChange={e=>set('show',e.target.value)} style={{display:'block',padding:10,margin:'8px 0'}}>{RELEASE_SCHEDULE.map(s=><option key={s.show}>{s.show}</option>)}</select></label>
          <label>Guest / episode<Field value={draft.guest} onChange={v=>set('guest',v)}/></label>
          <div style={{display:'flex',gap:14,margin:'14px 0'}}><label>Release date<input type="date" value={draft.date} onChange={e=>set('date',e.target.value)}/></label><label>Release time (Ireland)<input type="time" value={draft.time} onChange={e=>set('time',e.target.value)}/></label></div>
          {[['videoLink','Final video link'],['audioLink','Final audio link'],['transcriptLink','Complete transcript link'],['notes','Production notes']].map(([key,label])=><label key={key} style={{display:'block',marginTop:12}}>{label}<Field value={draft[key]} rows={key==='notes'?3:undefined} onChange={v=>set(key,v)}/></label>)}
          {[['edit','Full edit reviewed: opening, closing, sponsor and clean transitions'],['transcript','Complete transcript verified against the episode'],['chapters','Chapters checked against final video and audio timing'],['copy','All release copy reviewed']].map(([key,label])=><label key={key} style={{display:'block',marginTop:12}}><input type="checkbox" checked={draft.checks[key]} onChange={e=>set('checks',{...draft.checks,[key]:e.target.checked})}/> {label}</label>)}
          <div style={{marginTop:16}}><Pill sm tone="ghost" onClick={onProduction}>Open Production</Pill></div>
        </Card>
        {COPY_FIELDS.map(([key,label])=><Card key={key} style={{marginBottom:14}}><h3>{label}</h3><Field value={draft.copy[key]} rows={key.includes('Title')?undefined:6} placeholder={key.includes('Chapters')?'Verified timecodes from the final export':''} onChange={v=>set('copy',{...draft.copy,[key]:v})}/><Pill sm tone="ghost" disabled={!draft.copy[key]} onClick={async()=>{try{await navigator.clipboard.writeText(draft.copy[key]);setNotice(`${label} copied.`);}catch{setError('Could not copy. Select the text manually.');}}}>Copy</Pill></Card>)}
        <Card><Big s={20}>PUBLISHED LINKS</Big>{Object.keys(draft.links).map(key=><label key={key} style={{display:'block',marginTop:12}}>{key}<Field value={draft.links[key]} onChange={v=>set('links',{...draft.links,[key]:v})}/></label>)}<p>Record the live links after release so the whole episode stays together.</p></Card>
        <div style={{position:'sticky',bottom:0,padding:16,background:C.card,marginTop:14}}><Pill disabled={busy} onClick={save}>{busy?'Saving…':'Save release pack'}</Pill>{notice&&<Mono>{notice}</Mono>}</div>
      </>}
    </>}
  </div>;
}
