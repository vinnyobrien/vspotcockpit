import React, { useEffect, useMemo, useState } from "react";
import { sGet, sSet } from "../api.js";
import { C, BODY, Mono, Big, Card, Section } from "../lib/ui.jsx";

const KEY = "business-memory-v1";
const AREAS = ["Unsorted", "Guest", "Sponsor", "Show / episode", "Editorial", "Finance", "Operations"];
const KINDS = ["Note", "Link", "Meeting", "Idea", "File reference", "Decision"];
const STATUS = ["Captured", "Reviewed", "Action needed", "Archived"];
const field = {width:"100%",boxSizing:"border-box",border:"1px solid rgba(20,24,51,.2)",borderRadius:10,padding:"11px 12px",fontFamily:BODY,fontSize:14,background:"#fff",color:C.ink};
const label = {fontFamily:BODY,fontSize:12,fontWeight:650,color:C.ink2,display:"block",marginBottom:5};
export default function MemoryCapture() {
  const [items,setItems] = useState([]);
  const [loaded,setLoaded] = useState(false);
  const [automatic,setAutomatic] = useState([]);
  const [saving,setSaving] = useState(false);
  const [contextHits,setContextHits] = useState([]);
  const [contextLoading,setContextLoading] = useState(false);
  const [contextError,setContextError] = useState("");
  const [searched,setSearched] = useState(false);
  const [error,setError] = useState("");
  const [query,setQuery] = useState("");
  const [filter,setFilter] = useState("All");
  const [draft,setDraft] = useState({title:"",body:"",source:"",area:"Unsorted",kind:"Note"});
  useEffect(()=>{let alive=true;Promise.all([sGet(KEY,[]),sGet("business-memory-auto-v1",[])]).then(([manual,auto])=>{if(alive){setItems(Array.isArray(manual)?manual:[]);setAutomatic(Array.isArray(auto)?auto:[]);setLoaded(true)}});return()=>{alive=false}},[]);
  const persist = async next => {setSaving(true);setError("");const ok=await sSet(KEY,next);setSaving(false);if(ok){setItems(next);return true;}setError("Could not save. Your changes were not applied; please try again.");return false;};
  const capture = async e => {e.preventDefault();if(!draft.title.trim()||!draft.body.trim())return;
    const now=new Date().toISOString();
    const item={id:crypto.randomUUID(),title:draft.title.trim().slice(0,180),body:draft.body.trim().slice(0,12000),source:draft.source.trim().slice(0,1000),kind:draft.kind,area:draft.area,status:"Captured",createdAt:now,updatedAt:now,history:[{at:now,action:"Captured"}]};
    if(await persist([item,...items]))setDraft({title:"",body:"",source:"",area:"Unsorted",kind:"Note"});
  };
  const change = async (id,patch) => {const now=new Date().toISOString();await persist(items.map(x=>x.id===id?{...x,...patch,updatedAt:now,history:[...(x.history||[]),{at:now,action:Object.entries(patch).map(([k,v])=>k+": "+v).join(", ")}]}:x));};
  const searchContext = async e => {e.preventDefault();if(query.trim().length<3)return;setContextLoading(true);setContextError("");setSearched(false);try{const response=await fetch("/.netlify/functions/context-search?q="+encodeURIComponent(query.trim()),{credentials:"same-origin"});const result=await response.json();if(!response.ok)throw new Error(result.error||"Search failed");setContextHits(result.results||[]);setSearched(true);}catch(e){setContextError(e.message)}finally{setContextLoading(false)}};
  const shown=useMemo(()=>[...items,...automatic].filter(x=>(filter==="All"||x.status===filter)&&[x.title,x.body,x.source,x.area,x.kind].join(" ").toLowerCase().includes(query.toLowerCase())),[items,automatic,filter,query]);
  const pending=[...items,...automatic].filter(x=>x.status==="Captured"||x.status==="Action needed").length;
  return <div style={{fontFamily:BODY}}>
    <div style={{background:"#1A1F3C",color:"#F3F1EC",padding:23,borderRadius:18,borderBottom:"4px solid #E8272A",marginBottom:18}}>
      <Mono c="#D2B48C" s={10}>V SPOT MEDIA · BUSINESS MEMORY</Mono>
      <div style={{fontSize:30,fontWeight:800,marginTop:6}}>CAPTURE IT. CLEAR YOUR HEAD.</div>
      <p style={{fontSize:13,color:"#D2B48C",marginBottom:0}}>One inbox for notes and automatically captured Fireflies commitments. Review before acting; nothing is sent automatically.</p>
    </div>
    <Section label="Quick capture">
      <Card pad={18}><form onSubmit={capture} style={{display:"grid",gap:12}}>
        <div><label style={label}>What is it?</label><input style={field} value={draft.title} maxLength={180} required placeholder="A decision, idea, promise or useful thing" onChange={e=>setDraft({...draft,title:e.target.value})}/></div>
        <div><label style={label}>Details</label><textarea style={{...field,minHeight:110,resize:"vertical"}} value={draft.body} required placeholder="Paste the note, context, or what needs remembering…" onChange={e=>setDraft({...draft,body:e.target.value})}/></div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:10}}>
          <div><label style={label}>Type</label><select style={field} value={draft.kind} onChange={e=>setDraft({...draft,kind:e.target.value})}>{KINDS.map(x=><option key={x}>{x}</option>)}</select></div>
          <div><label style={label}>Belongs to</label><select style={field} value={draft.area} onChange={e=>setDraft({...draft,area:e.target.value})}>{AREAS.map(x=><option key={x}>{x}</option>)}</select></div>
        </div>
        <div><label style={label}>Source link or reference (optional)</label><input style={field} value={draft.source} placeholder="Fireflies URL, StreamYard link, email reference…" onChange={e=>setDraft({...draft,source:e.target.value})}/></div>
        <button disabled={!loaded||saving} type="submit" style={{background:"#E8272A",color:"#fff",border:0,borderRadius:10,padding:13,fontWeight:750,cursor:"pointer"}}>{saving?"Saving…":"Save to business memory"}</button>
      </form></Card>
    </Section>
    <Section label="Find the conversation · Fireflies + email follow-ups">
      <Card pad={16}>
        <form onSubmit={searchContext} style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <input style={{...field,flex:"1 1 220px"}} aria-label="Search recorded calls and email follow-ups" value={query} onChange={e=>setQuery(e.target.value)} placeholder="A guest, company, topic or promise…" minLength={3}/>
          <button type="submit" disabled={contextLoading||query.trim().length<3} style={{background:"#1A1F3C",color:"#fff",border:0,borderRadius:9,padding:"10px 17px",cursor:"pointer"}}>{contextLoading?"Searching…":"Find context"}</button>
        </form>
        <p style={{fontSize:12,color:C.ink2,marginBottom:0}}>Searches extracted Fireflies decisions and commitments, plus structured email follow-up imports. This is not yet a search of every Gmail message or full recording.</p>
        {contextError&&<p role="alert" style={{color:"#B81A1D"}}>{contextError}</p>}
        {searched&&<p style={{fontSize:12,fontWeight:700}}>{contextHits.length} source-backed results</p>}
        {contextHits.map((h,i)=><div key={h.kind+":"+h.sourceId+":"+i} style={{borderTop:"1px solid #ddd",padding:"12px 0"}}>
          <div style={{fontSize:11,color:C.ink2}}>{h.sourceType} · {h.kind} · {h.date||"Date unavailable"}{h.dueBasis?" · Due date: "+h.dueBasis:""}</div>
          <strong>{h.title}</strong>
          <p style={{fontSize:13,whiteSpace:"pre-wrap",overflowWrap:"anywhere",margin:"6px 0"}}>{h.evidence}</p>
          {h.owner&&<div style={{fontSize:12}}>Owner: {h.owner}</div>}
          {h.sourceUrl&&/^https:\/\//.test(h.sourceUrl)&&<a href={h.sourceUrl} target="_blank" rel="noopener noreferrer" style={{fontSize:12}}>Open original source</a>}
        </div>)}
      </Card>
    </Section>
    <Section label={"Memory inbox · "+pending+" to review"}>
      <div style={{display:"flex",gap:9,flexWrap:"wrap",marginBottom:12}}>
        <input aria-label="Search memory" style={{...field,flex:"1 1 220px"}} placeholder="Search everything captured…" value={query} onChange={e=>setQuery(e.target.value)}/>
        <select aria-label="Filter memory status" style={{...field,width:"auto"}} value={filter} onChange={e=>setFilter(e.target.value)}>{["All",...STATUS].map(x=><option key={x}>{x}</option>)}</select>
      </div>
      {error&&<p role="alert" style={{color:"#B81A1D"}}>{error}</p>}
      {!loaded?<p>Loading memory…</p>:shown.length===0?<Card pad={20}>No entries match yet. Capture the first thing worth remembering.</Card>:<div style={{display:"grid",gap:10}}>
        {shown.map(x=><Card key={x.id} pad={17} style={{borderLeft:"4px solid "+(x.status==="Action needed"?"#E8272A":"#D2B48C")}}>
          <div style={{display:"flex",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}><strong style={{fontSize:16}}>{x.title}</strong><Mono s={9}>{new Date(x.createdAt).toLocaleDateString()}</Mono></div>
          <div style={{fontSize:12,color:C.ink2,marginTop:5}}>{x.kind} · {x.area}{x.origin ? " · Auto-imported from "+x.origin : ""}</div>
          <p style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",fontSize:13.5,lineHeight:1.55}}>{x.body}</p>
          {x.source&&<div style={{fontSize:12,overflowWrap:"anywhere",marginBottom:12}}>Source: {/^https:\/\//i.test(x.source)?<a href={x.source} target="_blank" rel="noopener noreferrer">{x.source}</a>:x.source}</div>}
          {!x.origin && <div style={{display:"flex",gap:9,flexWrap:"wrap"}}>
            <select aria-label={"Status for "+x.title} style={{...field,width:"auto",fontSize:12}} value={x.status} disabled={saving} onChange={e=>change(x.id,{status:e.target.value})}>{STATUS.map(y=><option key={y}>{y}</option>)}</select>
            <select aria-label={"Area for "+x.title} style={{...field,width:"auto",fontSize:12}} value={x.area} disabled={saving} onChange={e=>change(x.id,{area:e.target.value})}>{AREAS.map(y=><option key={y}>{y}</option>)}</select>
          </div>}
          <details style={{fontSize:11,color:C.ink2,marginTop:12}}><summary>History · {(x.history||[]).length} entries</summary>{(x.history||[]).map((h,i)=><div key={i}>{new Date(h.at).toLocaleString()} · {h.action}</div>)}</details>
        </Card>)}
      </div>}
    </Section>
    <p style={{fontSize:12,color:C.ink2}}>Fireflies imports appear automatically after the scheduled morning processing job runs successfully. Imported records are read-only here; review and action them in Follow-ups. No automatic file-byte upload, cross-room assignment or external sending.</p>
  </div>;
}
