import React, { useEffect, useState } from 'react';
import { C, BODY, Card, Big, Mono, Pill } from '../lib/ui.jsx';
import { TONE, dateInDublin, shiftDate, newItem, blockers, deadlines } from '../lib/editorial-calendar.js';

export function useEditorialCalendar() {
  const [data,setData]=useState(null), [error,setError]=useState(''), [busy,setBusy]=useState(false);
  async function load() { setBusy(true); try { const r=await fetch('/api/editorial-calendar',{credentials:'same-origin'}); const d=await r.json(); if(!r.ok) throw new Error(d.error || 'Calendar unavailable'); setData(d);setError(''); } catch(e){setError(e.message);} finally{setBusy(false);} }
  useEffect(()=>{load();},[]);
  async function mutate(action,item) { setBusy(true); try {const r=await fetch('/api/editorial-calendar',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json'},body:JSON.stringify({action,revision:data.revision,...(action==='save'?{item}:{id:item.id})})}); const d=await r.json(); if(!r.ok) throw new Error(d.error || 'Could not save');setData(d);setError('');return true;} catch(e){setError(e.message);return false;} finally{setBusy(false);} }
  return {data,error,busy,load,mutate};
}
export function CalendarPriority({calendar,onOpen}) {
  const {data,error}=calendar, today=dateInDublin();
  const due=(data?.items || []).flatMap(deadlines).filter(d=>d.date<=shiftDate(today,7)).sort((a,b)=>a.date.localeCompare(b.date));
  const waiting=data?.items.filter(i=>i.status==='review').length || 0;
  return <div style={{padding:'8px 16px 14px'}}><button onClick={onOpen} style={{width:'100%',textAlign:'left',padding:18,borderRadius:18,border:'2px solid '+C.ink,background:C.sand,color:C.ink,fontFamily:BODY,cursor:'pointer'}}>
    <strong style={{fontSize:17}}>Content Calendar · {waiting} awaiting sign-off</strong>
    <div style={{fontSize:13,marginTop:6}}>{error ? 'Calendar unavailable — open to reload' : !data ? 'Loading deadlines…' : due.length ? `${due.filter(d=>d.date<today).length} overdue · ${due.length} deadlines in view · ${due[0].label}: ${due[0].date} — ${due[0].item.title}` : 'No deadlines in the next seven days. Plan the next idea.'}</div>
    <div style={{fontSize:12,marginTop:6}}>V Spot returns 9 October · Sponsor deadlines · Thinking time · Vinny’s sign-off →</div>
  </button></div>;
}

const fieldStyle={width:'100%',padding:'10px 12px',borderRadius:10,border:'1px solid rgba(20,24,51,.2)',fontFamily:BODY,fontSize:16,background:'white',color:C.ink};
function Input({label,value,onChange,type='text'}) {return <label style={{display:'block',fontSize:12,color:C.ink2}}>{label}<input type={type} value={value ?? ''} onChange={e=>onChange(e.target.value)} style={{...fieldStyle,marginTop:5}}/></label>;}
const statusText={planned:'Planning',review:'Awaiting Vinny’s sign-off',approved:'Signed off',published:'Published (confirmed)'};

export default function ContentCalendar({calendar,onSubEditor}) {
  const {data,error,busy,load,mutate}=calendar;
  const [editing,setEditing]=useState(null),[filter,setFilter]=useState('all'),[start,setStart]=useState('2026-10-05');
  const end=shiftDate(start,6),today=dateInDublin();
  const [confirm,setConfirm]=useState(null);
  const set=(k,v)=>setEditing(p=>({...p,[k]:v}));
  const items=(data?.items || []).filter(i=>i.date>=start && i.date<=end && (filter==='all' || filter==='sponsored' ? (filter!=='sponsored'||i.sponsor) : i.status==='review')).sort((a,b)=>`${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  const agenda=(data?.items || []).flatMap(deadlines).filter(d=>d.date>=start && d.date<=end).sort((a,b)=>a.date.localeCompare(b.date));
  return <div>
    <p style={{lineHeight:1.6,color:C.ink2}}>Plan the work before the release. All dates and release times are in Ireland. The 9 October return is confirmed; later Friday slots and preparation dates are editable working plans.</p>
    {error && <Card><p role="alert">{error}</p><Pill onClick={load} disabled={busy}>Reload calendar</Pill></Card>}
    {!data ? <p>Loading calendar…</p> : <>
    <Card style={{marginBottom:16}}><div style={{display:'flex',gap:10,flexWrap:'wrap',alignItems:'center'}}>
      <Pill sm tone="ghost" onClick={()=>setStart(shiftDate(start,-7))}>Previous week</Pill>
      <Input label="Week starting" type="date" value={start} onChange={setStart}/>
      <Pill sm tone="ghost" onClick={()=>setStart(shiftDate(start,7))}>Next week</Pill>
      <Pill sm onClick={()=>setEditing(newItem(shiftDate(start,4)))} disabled={busy}>Add content</Pill>
    </div><div style={{marginTop:14,display:'flex',gap:8,flexWrap:'wrap'}}>{[['all','All content'],['sponsored','Sponsored'],['review','Sign-off queue']].map(([v,l])=><Pill key={v} sm tone={filter===v?'solid':'ghost'} onClick={()=>setFilter(v)}>{l}</Pill>)}<Pill sm tone="ghost" onClick={()=>setStart(shiftDate(today,-((new Date(today+'T12:00Z').getUTCDay()+6)%7)))}>This week</Pill></div></Card>
    <Card style={{marginBottom:16,background:C.lilac}}><Big s={22}>THINKING & DEADLINES</Big><p style={{fontSize:13}}>Reserved idea sessions count as work. Complete them before the brief and edit.</p>
      {!agenda.length && <p>No preparation blocks this week.</p>}
      {agenda.map(d=><div key={d.item.id+d.key} style={{padding:'10px 0',borderTop:'1px solid rgba(20,24,51,.12)',fontSize:13}}><strong>{d.date} · {d.label}{d.date<today?' · OVERDUE':''}</strong><div>{d.item.title}{d.key==='ideas'?` · ${d.item.ideaMinutes} minutes reserved`:''}</div></div>)}
    </Card>
    {!items.length && <Card>No releases match this week and filter. Preparation deadlines remain visible above.</Card>}
    {items.map(i=><Card key={i.id} style={{marginBottom:16,borderLeft:'4px solid '+(i.approval?C.ink:C.red)}}>
      <Mono>{i.date} · {i.time || 'Release time to agree'} · {i.show}</Mono><div style={{marginTop:8}}><Big s={24}>{i.title}</Big></div>
      <p><strong>{statusText[i.status]}</strong> · {i.owner} · {i.format}</p><p style={{fontSize:13}}>{i.channels}</p>
      {i.sponsor && <p style={{background:C.sand,padding:12,borderRadius:12}}>Sponsor: <strong>{i.sponsor}</strong> · Approval due {i.sponsorDate || 'MISSING'}<br/>{i.sponsorNeeds}<br/>Evidence: {i.sponsorEvidence || 'Awaiting approval'}</p>}
      <p style={{fontSize:13,whiteSpace:'pre-wrap'}}>{i.notes}</p>
      {i.status==='review' && blockers(i).length>0 && <p style={{color:C.red}}>Sign-off blocked: {blockers(i).join(', ')}.</p>}
      {i.approval && <p style={{fontSize:12}}>Signed off by {i.approval.by} · {new Date(i.approval.at).toLocaleString('en-IE',{timeZone:'Europe/Dublin'})}</p>}
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}><Pill sm tone="ghost" disabled={busy} onClick={()=>setEditing(structuredClone(i))}>Edit / checklist</Pill>
        {i.status==='planned' && <Pill sm disabled={busy} onClick={()=>mutate('review',i)}>Submit for sign-off</Pill>}
        {i.status==='review' && <Pill sm disabled={busy || blockers(i).length>0} onClick={()=>setConfirm({item:i,action:'approve'})}>Vinny: sign off</Pill>}
        {i.status==='approved' && <Pill sm disabled={busy} onClick={()=>setConfirm({item:i,action:'published'})}>Confirm published</Pill>}
      </div>
      {!!i.history.length && <details style={{marginTop:14,fontSize:12}}><summary>Approval and revision history</summary>{i.history.map((h,n)=><p key={n}>{h.at} · {h.action}</p>)}</details>}
    </Card>)}
    <Card style={{marginTop:20}}><Big s={20}>TONE REFERENCE</Big><p style={{fontSize:13,lineHeight:1.6}}>{TONE}</p><Pill sm tone="ghost" onClick={onSubEditor}>Open Sub-Editor review</Pill><p style={{fontSize:12}}>Calendar sign-off records clearance for the current version. Publishing through other rooms or platforms still uses their existing controls. This calendar does not auto-publish.</p></Card>
    </>}
    {editing && <div style={{position:'fixed',inset:0,zIndex:60,background:'rgba(20,24,51,.45)',overflowY:'auto',padding:20}}><div role="dialog" aria-modal="true" aria-label="Edit content plan" style={{maxWidth:760,margin:'20px auto',background:C.card,borderRadius:22,padding:24}}>
      <Big s={25}>CONTENT PLAN</Big><p style={{fontSize:13}}>Saving changes clears previous sign-off. Confirm sponsor obligations from the agreement.</p>
      <form onSubmit={async e=>{e.preventDefault();if(await mutate('save',editing))setEditing(null);}}>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:14}}>
          {[['title','Title'],['show','Show / publication'],['format','Format'],['owner','Owner'],['channels','Channels'],['date','Release date','date'],['time','Release time (Ireland)','time'],['ideaDate','Thinking / idea session','date'],['ideaMinutes','Reserved minutes','number'],['briefDate','Brief due','date'],['draftDate','Draft / edit due','date'],['reviewDate','Sub-Editor review due','date'],['signoffDate','Vinny sign-off due','date'],['sponsor','Sponsor (blank if none confirmed)'],['sponsorDate','Sponsor approval deadline','date'],['sponsorNeeds','Sponsor deliverables / placement'],['sponsorEvidence','Sponsor approval evidence / link'],['finalLink','Final asset / copy link']].map(([k,l,t])=><Input key={k} label={l} type={t} value={editing[k]} onChange={v=>set(k,k==='ideaMinutes'?Number(v):v)}/>)}
        </div>
        <label style={{display:'block',marginTop:14}}>Notes / idea<textarea style={{...fieldStyle,minHeight:100,marginTop:6}} value={editing.notes} onChange={e=>set('notes',e.target.value)}/></label>
        <div style={{display:'grid',gap:10,margin:'18px 0'}}>{[['ideas','Thinking session completed'],['brief','Brief agreed'],['draft','Draft / edit ready'],['review','Sub-Editor tone, source and branding review completed'],...(editing.sponsor?[['sponsor','Sponsor approval received; evidence recorded above']]:[])].map(([k,l])=><label key={k}><input type="checkbox" checked={editing.checks[k]} onChange={e=>set('checks',{...editing.checks,[k]:e.target.checked})}/> {l}</label>)}</div>
        {error && <p role="alert" style={{color:C.red}}>{error}</p>}
        <div style={{display:'flex',gap:10}}><button disabled={busy} style={{...fieldStyle,width:'auto',cursor:'pointer',fontWeight:700}} type="submit">{busy?'Saving…':'Save plan'}</button><button type="button" disabled={busy} style={{...fieldStyle,width:'auto',cursor:'pointer'}} onClick={()=>setEditing(null)}>Cancel</button></div>
      </form>
    </div></div>}
    {confirm && <div style={{position:'fixed',inset:0,zIndex:70,background:'rgba(20,24,51,.5)',padding:24,display:'grid',placeItems:'center'}}><Card style={{maxWidth:480}}><div role="dialog" aria-modal="true" aria-label="Confirm calendar action"><Big s={23}>{confirm.action==='approve'?'SIGN OFF THIS VERSION':'CONFIRM PUBLICATION'}</Big><p>{confirm.item.title}</p><p>{confirm.action==='approve'?'I, Vinny, approve this content, its release plan and any sponsor commitments.':'I confirm this signed-off version has been published. This records the release; it does not publish to any channel.'}</p>{error&&<p role="alert">{error}</p>}<div style={{display:'flex',gap:10}}><Pill disabled={busy} onClick={async()=>{if(await mutate(confirm.action,confirm.item))setConfirm(null);}}>Confirm</Pill><Pill tone="ghost" disabled={busy} onClick={()=>setConfirm(null)}>Cancel</Pill></div></div></Card></div>}
  </div>;
}
