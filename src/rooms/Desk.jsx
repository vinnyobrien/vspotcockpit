import React, { useState, useCallback } from "react";
import { Send } from "lucide-react";
import { C, Mono, Card, Section, Pill, Field, Note, Problem } from "../lib/ui.jsx";
import { callOp } from "../api.js";

// Desk owns editorial discussion. News, writing, clips and sponsorship live in their rooms.
export default function Desk({ onGenerate, busy, wire, wireAt, onOpenRoom }) {
  const [err,setErr]=useState("");
  const [picked,setPicked]=useState(null);
  const [msg,setMsg]=useState("");
  const [chat,setChat]=useState([]);
  const [thinking,setThinking]=useState(false);
  const [email,setEmail]=useState("");
  const stories=Array.isArray(wire)?wire:[];
  const send=useCallback(async()=>{
    const text=msg.trim();
    if(!text || thinking)return;
    const next=[...chat,{role:"user",content:text}];
    setChat(next);setMsg("");setThinking(true);setErr("");
    try{
      const r=await callOp({op:"desk",story:picked===null?null:stories[picked],history:next,extra:text});
      setChat([...next,{role:"assistant",content:r.text}]);
    }catch(e){setErr(e.message || "The Desk could not complete the reply.");}
    finally{setThinking(false);}
  },[msg,chat,thinking,picked,wire]);
  return <div>
    <Note>Work through an angle here. Scan news, write, cut clips and develop sponsorships in their dedicated rooms.</Note>
    <Problem onDismiss={()=>setErr("")}>{err}</Problem>
    <Card pad={18} style={{marginBottom:16}}>
      <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
        {[["breaking","News & scripts"],["essay","Essay workshop"],["sub","Sub editor"],["clipdesk","Clip desk"],["growth","Sponsors"]].map(([id,label])=><Pill key={id} sm tone="ghost" onClick={()=>onOpenRoom(id)}>{label}</Pill>)}
      </div>
    </Card>
    <Section label="The Conversation">
      <Card>
        {chat.length===0 && <p style={{fontSize:15,color:C.ink2,lineHeight:1.6}}>Bring a thought, question or story. Challenge the angle, test the argument and decide what is worth making.</p>}
        {stories.length>0 && <details style={{marginBottom:18}}>
          <summary style={{cursor:"pointer",padding:"10px 0"}}>Use a previously loaded story · {stories.length}</summary>
          <p style={{fontSize:13,color:C.ink2}}>Earlier Desk wire{wireAt ? " · "+new Date(wireAt).toLocaleString("en-IE") : ""}. For a fresh scan, open News & scripts.</p>
          <label style={{fontSize:14}}>Conversation reference
            <select value={picked===null?"":picked} onChange={e=>setPicked(e.target.value===""?null:Number(e.target.value))} style={{display:"block",width:"100%",padding:12,fontSize:16,borderRadius:12,marginTop:8}}>
              <option value="">No story selected</option>
              {stories.map((story,i)=><option key={i} value={i}>{story.headline}</option>)}
            </select>
          </label>
          {picked!==null && stories[picked] && <p style={{lineHeight:1.5}}>{stories[picked].summary}{stories[picked].url && <> <a href={stories[picked].url} target="_blank" rel="noopener noreferrer">Read source ↗</a></>}</p>}
        </details>}
        {chat.map((m,i)=><div key={i} style={{marginBottom:16}}>
          <Mono s={10} c={m.role==="user"?C.red:C.ink2}>{m.role==="user"?"Vinny":"The Desk"}</Mono>
          <div style={{fontSize:16,lineHeight:1.6,marginTop:6,whiteSpace:"pre-wrap"}}>{m.content}</div>
        </div>)}
        {thinking && <div role="status" aria-live="polite"><Mono>Thinking…</Mono></div>}
        <Field value={msg} onChange={setMsg} onEnter={send} rows={3} placeholder="What are you thinking about?"/>
        <div style={{marginTop:12}}><Pill icon={Send} disabled={!msg.trim() || thinking} onClick={send}>{thinking?"Thinking…":"Discuss"}</Pill></div>
      </Card>
    </Section>
    <details style={{marginTop:20}}>
      <summary style={{cursor:"pointer",padding:"12px 4px",fontWeight:600}}>Other Desk tools</summary>
      <Card pad={18} style={{marginTop:10}}>
        <p style={{fontSize:14,lineHeight:1.5}}>Explore content ideas across the network.</p>
        <Pill sm disabled={!!busy} onClick={()=>onGenerate("ideas",null)}>{busy==="ideas"?"Generating…":"Generate ideas"}</Pill>
        <label style={{display:"block",marginTop:20,fontSize:14,fontWeight:600}}>FoundRae email brief</label>
        <Field value={email} onChange={setEmail} placeholder="What decision or update is the email about?"/>
        <div style={{marginTop:10}}><Pill sm disabled={!!busy || !email.trim()} onClick={()=>onGenerate("foundrae",null,email.trim())}>{busy?.startsWith("foundrae")?"Drafting…":"Draft email"}</Pill></div>
      </Card>
    </details>
  </div>;
}
