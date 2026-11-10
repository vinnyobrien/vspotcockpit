import React,{useEffect,useMemo,useState} from "react";
import {sGet,sSet} from "../api.js";
import {C,BODY,Mono,Card,Section} from "../lib/ui.jsx";
const KEY="commercial-barometer-v1";
const outcomes=["Exploring","Proposal sent","Negotiating","Won","Lost","Paused"];
const field={width:"100%",boxSizing:"border-box",border:"1px solid #c8cbd3",borderRadius:9,padding:11,fontSize:13,fontFamily:BODY,background:"#fff"};
const empty={company:"",opportunity:"",relationship:"New",offer:"",agreed:"",effort:"",outcome:"Exploring",objection:"",reason:"",next:""};
export default function CommercialBarometer(){
 const [records,setRecords]=useState([]),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[form,setForm]=useState(empty);
 useEffect(()=>{let alive=true;sGet(KEY,[]).then(x=>{if(alive){setRecords(Array.isArray(x)?x:[]);setReady(true)}});return()=>{alive=false}},[]);
 const save=async next=>{setBusy(true);setError("");const ok=await sSet(KEY,next);setBusy(false);if(ok)setRecords(next);else setError("Could not save. Please retry.");return ok};
 const submit=async e=>{e.preventDefault();if(!form.company.trim()||!form.opportunity.trim())return;const at=new Date().toISOString();if(await save([{...form,id:crypto.randomUUID(),createdAt:at,updatedAt:at},...records]))setForm(empty)};
 const update=async(id,key,value)=>{const at=new Date().toISOString();await save(records.map(x=>x.id===id?{...x,[key]:value,updatedAt:at}:x))};
 const complete=records.filter(x=>["Won","Lost"].includes(x.outcome));
 const won=complete.filter(x=>x.outcome==="Won");
 const numeric=x=>{const n=Number(String(x||"").replace(/[^0-9.]/g,""));return Number.isFinite(n)?n:0};
 const pricePairs=won.filter(x=>numeric(x.offer)>0&&numeric(x.agreed)>0);
 const ratio=pricePairs.length?Math.round(pricePairs.reduce((s,x)=>s+numeric(x.agreed)/numeric(x.offer),0)/pricePairs.length*100):null;
 const labels=[["Cases recorded",records.length],["Closed outcomes",complete.length],["Won",won.length],["Agreed / offered",ratio===null?"No data":ratio+"%"]];
 return <div style={{fontFamily:BODY}}>
 <div style={{background:"#1A1F3C",color:"#F3F1EC",padding:24,borderRadius:16,marginBottom:18,borderBottom:"4px solid #E8272A"}}>
 <Mono c="#D2B48C" s={10}>V SPOT MEDIA · COMMERCIAL INTELLIGENCE</Mono>
 <div style={{fontSize:30,fontWeight:800,marginTop:8}}>THE BAROMETER</div>
 <p style={{color:"#D2B48C",fontSize:13,marginBottom:0}}>Build judgement from real offers, outcomes and reasons. Not a price list, and not an automatic negotiation engine.</p></div>
 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginBottom:18}}>{labels.map(([name,value])=><Card key={name} pad={14}><div style={{fontSize:12,color:C.ink2}}>{name}</div><div style={{fontSize:23,fontWeight:800}}>{value}</div></Card>)}</div>
 <Section label="Log a commercial judgement"><Card pad={17}><form onSubmit={submit} style={{display:"grid",gap:10}}>
 <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:10}}>
 {[["company","Company / contact"],["opportunity","Opportunity / deliverables"],["offer","Opening offer (€ or £)"],["agreed","Agreed amount (€ or £)"],["effort","Expected effort (hours)"],["objection","Buyer feedback / objection"],["reason","Why this price or exception?"],["next","Next action / date"]].map(([key,label])=><label key={key} style={{fontSize:12,fontWeight:650}}>{label}<input style={{...field,marginTop:5}} required={key==="company"||key==="opportunity"} value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})}/></label>)}
 <label style={{fontSize:12,fontWeight:650}}>Relationship<select style={{...field,marginTop:5}} value={form.relationship} onChange={e=>setForm({...form,relationship:e.target.value})}>{["New","Warm introduction","Existing","Longstanding"].map(x=><option key={x}>{x}</option>)}</select></label>
 <label style={{fontSize:12,fontWeight:650}}>Outcome<select style={{...field,marginTop:5}} value={form.outcome} onChange={e=>setForm({...form,outcome:e.target.value})}>{outcomes.map(x=><option key={x}>{x}</option>)}</select></label>
 </div><button type="submit" disabled={!ready||busy} style={{padding:12,background:"#E8272A",border:0,borderRadius:9,color:"#fff",fontWeight:750}}>{busy?"Saving…":"Record opportunity"}</button></form></Card></Section>
 <Section label="Evidence ledger">{error&&<p role="alert" style={{color:"#b42318"}}>{error}</p>}
 {!ready?<p>Loading…</p>:!records.length?<Card pad={20}>No commercial outcomes recorded yet. Start with a recent proposal and the reason behind your pricing. Until then, there is no reliable trend to report.</Card>:<div style={{display:"grid",gap:10}}>{records.map(x=><Card key={x.id} pad={16}>
 <strong>{x.company} · {x.opportunity}</strong><div style={{fontSize:12,color:C.ink2,marginTop:5}}>{x.relationship} · Offered {x.offer||"not recorded"} · Agreed {x.agreed||"not recorded"} · Effort {x.effort||"unknown"}h</div>
 <p style={{fontSize:13,whiteSpace:"pre-wrap"}}>{x.reason||"No pricing rationale recorded"}{x.objection?"\nBuyer feedback: "+x.objection:""}{x.next?"\nNext: "+x.next:""}</p>
 <label style={{fontSize:12}}>Outcome <select disabled={busy} style={{...field,width:"auto",marginLeft:8}} value={x.outcome} onChange={e=>update(x.id,"outcome",e.target.value)}>{outcomes.map(o=><option key={o}>{o}</option>)}</select></label>
 </Card>)}</div>}</Section>
 <p style={{fontSize:12,color:C.ink2}}>Evidence-based pilot: manually recorded opportunities only. No emails are read or sent, no external market data is ingested, and no prices are recommended automatically. Enter monetary values in a consistent currency before comparing ratios.</p>
 </div>;
}
