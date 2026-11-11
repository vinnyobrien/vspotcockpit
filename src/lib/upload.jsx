import React, { useState, useRef, useEffect } from "react";
import { C, Card, Pill } from "./ui.jsx";
import { mediaPresign, mediaRegister, mediaSchedule, mediaShare } from "../api.js";

export function dublinNow(date = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {timeZone:"Europe/Dublin",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(date).map(p => [p.type,p.value]));
  return p.year+"-"+p.month+"-"+p.day+"T"+p.hour+":"+p.minute;
}
export function scheduleReceipt(r, requested) {
  const confirmed = r?.ok === true && !!r.postId && !!r.confirmedAt && r.mediaIngested === true
    && requested.every(n => (r.confirmedNetworks || []).some(p => p.network === n && !/fail|error|reject/i.test(p.status || "")));
  return {confirmed, message: confirmed ? "Your file, time and channels are recorded in Metricool." : "The request was accepted, but the file, time or channels could not all be confirmed. Check the planner before trying again."};
}
const destinations = [["twitter","X"],["tiktok","TikTok"],["youtube","YouTube"]];
function nextSlot() {
  const now = dublinNow();
  if (now.slice(11) < "21:30") return now.slice(0,10)+"T21:30";
  const tomorrow = new Date(now.slice(0,10)+"T12:00:00Z");
  tomorrow.setUTCDate(tomorrow.getUTCDate()+1);
  return tomorrow.toISOString().slice(0,10)+"T07:30";
}
export default function Upload({onUploaded, token}) {
  const [file,setFile] = useState(null), [preview,setPreview] = useState("");
  const [meta,setMeta] = useState({}), [done,setDone] = useState(null);
  const [tags,setTags] = useState({origin:"",correspondent:"house",beat:"general"});
  const [note,setNote] = useState(""), [busy,setBusy] = useState(""), [phase,setPhase] = useState("");
  const [pct,setPct] = useState(0), [error,setError] = useState("");
  const [nets,setNets] = useState([]), [caption,setCaption] = useState(""), [title,setTitle] = useState("");
  const [when,setWhen] = useState(nextSlot), [ai,setAi] = useState(false);
  const [review,setReview] = useState(false), [result,setResult] = useState(null), [copied,setCopied] = useState(false);
  const lock = useRef(false), picker = useRef(null), receipt = useRef(null), reviewPanel = useRef(null), currentFile = useRef(null);
  const kind = (file?.type || done?.kind || "").startsWith("image") ? "image" : "video";
  useEffect(() => () => { if(preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => { if(done || result) receipt.current?.scrollIntoView({behavior:"smooth",block:"start"}); }, [done,result]);
  useEffect(() => { if(review) reviewPanel.current?.scrollIntoView({behavior:"smooth",block:"start"}); }, [review]);
  const choose = f => {
    if(!f || lock.current) return;
    if(!/^(video|image)\//.test(f.type || "")) {setError("Choose a video or image from Photos or Files.");return;}
    currentFile.current=f; setFile(f);setPreview(URL.createObjectURL(f));setMeta({});
    setDone(null);setResult(null);setReview(false);setError("");setPct(0);setNets([]);setCaption("");setTitle("");setCopied(false);
  };
  const upload = async () => {
    if(!file || !tags.origin || lock.current) return;
    lock.current=true;setBusy("upload");setError("");setPct(0);setPhase("Preparing upload…");
    try {
      const {uploadUrl,key,contentType} = await mediaPresign({filename:file.name,contentType:file.type,bytes:file.size},token);
      setPhase("Uploading file…");
      const fileId = await new Promise((resolve,reject) => {
        const x = new XMLHttpRequest();x.open("PUT",uploadUrl,true);x.setRequestHeader("Content-Type",contentType || file.type);
        x.timeout=20*60*1000;
        x.upload.onprogress=e=>{if(e.lengthComputable)setPct(Math.round(e.loaded/e.total*100));};
        x.onerror=()=>reject(new Error("Upload interrupted. Check your connection."));
        x.ontimeout=()=>reject(new Error("Upload timed out. Check your connection."));
        x.onload=()=>{if(x.status<200 || x.status>=300){reject(new Error("Drive refused the upload ("+x.status+")."));return;}
          try {const r=JSON.parse(x.responseText);if(!r.id)throw new Error("File transfer could not be confirmed.");resolve(r.id);}
          catch(e){reject(e);}
        };x.send(file);
      });
      setPhase("File transferred. Saving to your library…");
      const shared=await mediaShare({fileId},token);
      const r=await mediaRegister({key,fileId,publicUrl:shared.publicUrl,filename:file.name,bytes:file.size,...meta,...tags,kind,note:note.trim()},token);
      if(!r.media?.publicUrl)throw new Error("Your library record could not be confirmed.");
      setDone({...r.media,kind});setPct(100);
      try {onUploaded?.(r.media);} catch { /* Keep the saved receipt if a parent refresh fails. */ }
    } catch(e) {setError((e?.message || "Upload could not be confirmed.")+" The file may already be in Drive.");}
    finally {lock.current=false;setBusy("");}
  };
  const validation = !nets.length ? "Choose a destination." : nets.includes("youtube") && !title.trim() ? "Add a YouTube title." : nets.some(n=>n!=="youtube") && !caption.trim() ? "Add a caption for X or TikTok." : !when || when.slice(0,16)<=dublinNow() ? "Choose a future time in Ireland." : "";
  const schedule = async () => {
    if(lock.current || result || !done) return;
    if(validation){setError(validation);setReview(false);return;}
    lock.current=true;setBusy("schedule");setError("");
    try {
      const r=await mediaSchedule({mediaUrl:done.publicUrl,kind,text:caption.trim(),networks:nets,when,youtubeTitle:title.trim(),aiGenerated:ai,durationSeconds:meta.durationSeconds??done.durationSeconds??null,width:meta.width??done.width??null,height:meta.height??done.height??null},token);
      if(r?.ok!==true)throw new Error(r?.error || "Scheduling could not be confirmed.");
      setResult(r);setReview(false);
    } catch(e){setError((e?.message || "Scheduling could not be confirmed.")+" Check the Metricool planner before retrying to avoid a duplicate.");setReview(false);}
    finally {lock.current=false;setBusy("");}
  };
  const status=result ? scheduleReceipt(result,nets) : null;
  const field=(label,value,change,props={})=><label className="upload-field">{label}<input value={value} onChange={e=>change(e.target.value)} {...props}/></label>;
  return <div className="upload-flow">
    <style>{`
      .upload-flow { color: #141833; }
      .upload-flow .upload-field {display:block;margin:16px 0;font-size:14px;font-weight:600;}
      .upload-flow input,.upload-flow select,.upload-flow textarea {display:block;width:100%;box-sizing:border-box;margin-top:8px;padding:12px;font-size:16px;border:1px solid #c5c7d1;border-radius:12px;background:#fff;color:#141833;}
      .upload-flow button {min-height:44px;}
      .upload-flow .upload-preview {width:100%;max-height:300px;object-fit:contain;background:#141833;border-radius:16px;margin-top:16px;}
      .upload-flow p {line-height:1.5;overflow-wrap:anywhere;}
      .upload-flow .upload-buttons {display:flex;flex-wrap:wrap;gap:10px;margin-top:16px;}
    `}</style>
    <div style={{background:C.ink,color:"white",padding:22,borderRadius:24,marginBottom:16}}>
      <h2 style={{fontSize:24,margin:0}}>Add video</h2>
      <p style={{marginBottom:0}}>1. Upload · 2. Choose channels · 3. Confirm</p>
    </div>
    {error && <div role="alert" style={{padding:18,background:C.blush,borderRadius:16,marginBottom:16}}>{error}<p><a href="https://app.metricool.com" target="_blank" rel="noopener noreferrer">Open Metricool planner</a></p></div>}
    {done && <div ref={receipt} tabIndex={-1} role="status" aria-live="polite" style={{padding:22,background:status && !status.confirmed ? C.sand : C.mint,borderRadius:22,marginBottom:16}}>
      <strong style={{fontSize:22}}>{status ? status.confirmed ? "Schedule confirmed" : "Schedule needs checking" : "Upload complete"}</strong>
      <p>{done.filename || file?.name} · saved to your library</p>
      {status ? <><p>{status.message}</p><p>{(result.confirmedAt || result.at || "").replace("T"," ")} · Ireland time</p>
        <p>{(result.confirmedNetworks || []).map(p=>(destinations.find(([id])=>id===p.network)?.[1] || p.network)+" · "+(p.status || "recorded")).join(" / ")}</p>
        {result.postId && <p>Reference: {result.postId}</p>}
        <a href="https://app.metricool.com" target="_blank" rel="noopener noreferrer">Open Metricool planner</a>
        <p>Scheduled for later; publishing has not happened yet.</p>
      </> : <p>Next: choose your channels below.</p>}
    </div>}
    {!done && <Card pad={20}>
      <strong style={{fontSize:20}}>Choose your file</strong>
      <input ref={picker} aria-label="Choose video or image" type="file" accept="video/*,image/*" disabled={!!busy} onChange={e=>choose(e.target.files?.[0])}/>
      {preview && (kind==="image" ? <img src={preview} alt="Selected upload" className="upload-preview" onLoad={e=>{if(currentFile.current===file)setMeta({width:e.target.naturalWidth,height:e.target.naturalHeight});}}/> :
        <video src={preview} controls playsInline preload="metadata" className="upload-preview" onLoadedMetadata={e=>{if(currentFile.current===file)setMeta({durationSeconds:Number.isFinite(e.target.duration)?Math.round(e.target.duration):null,width:e.target.videoWidth,height:e.target.videoHeight});}}/>)}
      {file && <p>{file.name} · {(file.size/1048576).toFixed(1)} MB{meta.durationSeconds ? " · "+meta.durationSeconds+"s" : ""}</p>}
      <fieldset disabled={!!busy} style={{border:0,padding:0,margin:0}}>
        {[["origin","Origin · required",[["","Choose origin"],["original","Original"],["guest-clip","Guest clip"],["podcast-cut","Podcast cut"],["archive","Archive"]]],["correspondent","Correspondent",[["house","House"],["murt","Murt"],["reagan","Reagan"],["jimmy","Jimmy"]]],["beat","Beat",[["general","General"],["retail-media","Retail media"],["agentic","Agentic"],["uk","UK"]]]].map(([key,label,options])=><label key={key} className="upload-field">{label}<select value={tags[key]} onChange={e=>setTags({...tags,[key]:e.target.value})}>{options.map(([v,name])=><option key={v} value={v}>{name}</option>)}</select></label>)}
        {field("Library note",note,setNote,{placeholder:"What is this clip about?"})}
      </fieldset>
      {busy==="upload" && <div role="status" aria-live="polite"><progress max="100" value={pct} style={{width:"100%"}}/><p>{phase} {pct<100 ? pct+"%" : ""}</p></div>}
      <Pill disabled={!file || !tags.origin || !!busy} onClick={upload}>{busy==="upload" ? "Uploading…" : "Upload to library"}</Pill>
      {!tags.origin && file && <p>Choose an origin to enable upload.</p>}
    </Card>}
    {done && <Card pad={20}>
      {preview && (kind==="image" ? <img src={preview} alt="Uploaded file" className="upload-preview"/> : <video src={preview} controls playsInline className="upload-preview"/>)}
      <div className="upload-buttons"><a href={done.publicUrl} target="_blank" rel="noopener noreferrer">Open saved file</a><Pill tone="ghost" onClick={async()=>{try{await navigator.clipboard.writeText(done.publicUrl);setCopied(true);}catch{setError("Could not copy the link. Open the saved file instead.");}}}>{copied ? "Link copied" : "Copy link"}</Pill></div>
      {!result && <fieldset disabled={!!busy || review} style={{border:0,padding:0,margin:0}}>
        <h3>Where should it go?</h3>
        <div className="upload-buttons">{destinations.map(([id,name])=><Pill key={id} disabled={!!busy || review || kind==="image" && id==="youtube"} tone={nets.includes(id)?"solid":"ghost"} onClick={()=>setNets(nets.includes(id)?nets.filter(n=>n!==id):[...nets,id])}>{name}{kind==="image" && id==="youtube" ? " · video only" : ""}</Pill>)}</div>
        <p style={{fontSize:13}}>This upload flow supports X, TikTok and YouTube. LinkedIn is still to be added.</p>
        {nets.length>0 && <>
          <label className="upload-field">{nets.every(n=>n==="youtube")?"Description (optional)":"Caption · required"}<textarea rows={4} value={caption} onChange={e=>setCaption(e.target.value)}/></label>
          {nets.includes("youtube") && field("YouTube title · required",title,setTitle,{maxLength:100})}
          {field("Publish at · Ireland time (Europe/Dublin)",when,setWhen,{type:"datetime-local"})}
          <label style={{display:"flex",gap:12,alignItems:"center"}}><input style={{width:22,margin:0}} type="checkbox" checked={ai} onChange={e=>setAi(e.target.checked)}/> Contains AI-generated footage or voice</label>
          <p style={{fontSize:13}}>Turn on for a synthetic presenter, voice or altered footage. Caption polishing alone does not make your phone footage AI-generated.</p>
          <Pill disabled={!!busy || review} onClick={()=>{if(validation){setError(validation);return;}setError("");setReview(true);}}>Review schedule</Pill>
        </>}
      </fieldset>}
      {review && !result && <div ref={reviewPanel} role="region" aria-label="Review schedule" style={{padding:20,border:"2px solid "+C.ink,borderRadius:18,marginTop:20}}>
        <strong style={{fontSize:20}}>Ready to schedule?</strong><p>{done.filename || file?.name}</p>
        <p>{destinations.filter(([id])=>nets.includes(id)).map(([,name])=>name).join(" · ")}</p><p>{when.replace("T"," ")} · Ireland time</p>
        <p style={{whiteSpace:"pre-wrap"}}>{caption || "(No description)"}</p>{nets.includes("youtube") && <p>YouTube title: {title}</p>}
        <p>AI-generated footage or voice: {ai ? "Yes" : "No"}</p>
        <div className="upload-buttons"><Pill tone="ghost" disabled={!!busy} onClick={()=>setReview(false)}>Keep editing</Pill><Pill disabled={!!busy} onClick={schedule}>{busy==="schedule" ? "Confirming…" : "Confirm schedule"}</Pill></div>
      </div>}
      <div className="upload-buttons"><Pill tone="ghost" disabled={!!busy} onClick={()=>{setDone(null);setResult(null);setFile(null);setPreview("");setMeta({});setReview(false);setError("");}}>Add another file</Pill></div>
    </Card>}
  </div>;
}
