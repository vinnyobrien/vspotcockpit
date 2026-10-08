import React,{useEffect,useRef,useState} from 'react';
import {Camera,Upload,Download,Receipt} from 'lucide-react';
import {C,Card,Mono,Pill} from '../lib/ui.jsx';

const field={width:'100%',padding:12,border:'1px solid #ccc',borderRadius:10,font:'inherit',boxSizing:'border-box'};
const statuses={saved:'Saved · awaiting scan',accepted:'Accepted for scanning · review required',unknown:'Delivery uncertain · check scanner',attention:'Delivery needs attention'};
async function request(path,init){const r=await fetch(path,{credentials:'same-origin',...init});const d=await r.json();if(!r.ok){const e=new Error(r.status===401?'Sign in to open your private receipts.':d.error || 'Request failed');e.status=r.status;throw e;}return d;}

export default function Finance(){
  const [data,setData]=useState(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[locked,setLocked]=useState(false),[password,setPassword]=useState('');
  const [files,setFiles]=useState([]),[purpose,setPurpose]=useState(''),[category,setCategory]=useState('unclassified'),[share,setShare]=useState('100');
  const camera=useRef(null),picker=useRef(null);
  async function load(){try{const d=await request('/api/receipts');setData(d);setLocked(false);}catch(e){setLocked(e.status===401);setError(e.message);}}
  useEffect(()=>{load();},[]);
  async function login(e){e.preventDefault();setBusy(true);try{await request('/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password})});setPassword('');setError('');await load();}catch(e){setError(e.message);}finally{setBusy(false);}}
  function choose(list){setFiles(Array.from(list || []));setNotice('');}
  async function upload(e){e.preventDefault();setBusy(true);setError('');setNotice('');let count=0,duplicates=0;
    try{for(const file of files){if(file.size>3*1024*1024)throw new Error(`${file.name}: choose a file under 3 MB.`);const form=new FormData();form.append('file',file);form.append('purpose',purpose);form.append('category',category);form.append('businessPercent',share);const d=await request('/api/receipts',{method:'POST',body:form});count++;if(d.duplicate)duplicates++;}
      setFiles([]);setPurpose('');setNotice(`${count} receipt${count===1?'':'s'} saved${duplicates?` (${duplicates} already saved)` : ''}. Ready for review.`);
    }catch(e){setError(`${e.message}${count?` ${count} earlier file(s) saved. Re-select the remaining files; duplicates will be skipped.`:''}`);}finally{await load();setBusy(false);}}
  async function deliver(id){setBusy(true);setError('');try{const d=await request('/api/receipts?action=deliver',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({id})});setNotice(d.delivery.message || d.delivery.status);}catch(e){setError(e.message);}finally{await load();setBusy(false);}}
  function exportManifest(){const blob=new Blob([JSON.stringify({schema:'cockpit-receipt-capture-v1',exportedAt:new Date().toISOString(),entity:'Irish sole trader',receipts:data.receipts},null,2)],{type:'application/json'});const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='cockpit-receipts.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
  return <div><p>Snap a receipt, upload an invoice, or choose files from your phone. Originals stay private; expenses need review before entering the accounts.</p>
    {error&&<p role="alert" style={{color:C.red}}>{error}</p>}
    {notice&&<p role="status">{notice}</p>}
    {locked?<Card><Mono>Private finance</Mono><form onSubmit={login}><p>Use your cockpit password to access receipts.</p><label>Password<input type="password" autoComplete="current-password" style={field} value={password} onChange={e=>setPassword(e.target.value)} required/></label><div style={{marginTop:12}}><Pill disabled={busy || !password} onClick={login}>Sign in</Pill></div></form></Card>:!data?<p>Loading receipt inbox…</p>:<>
    <Card style={{marginBottom:16}}><Mono>Receipt inbox · Irish sole trader</Mono><form onSubmit={upload}>
      <div style={{display:'flex',gap:10,flexWrap:'wrap',margin:'18px 0'}}><Pill icon={Camera} disabled={busy} onClick={()=>camera.current.click()}>Take a photo</Pill><Pill icon={Upload} tone="ghost" disabled={busy} onClick={()=>picker.current.click()}>Upload receipts</Pill></div>
      <input ref={camera} aria-label="Photograph receipt" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" hidden onChange={e=>{choose(e.target.files);e.target.value='';}}/>
      <input ref={picker} aria-label="Choose receipt files" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple hidden onChange={e=>{choose(e.target.files);e.target.value='';}}/>
      <div onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(!busy)choose(e.dataTransfer.files);}} style={{border:'2px dashed #bbb',borderRadius:12,padding:16,marginBottom:16}}>{files.length?<ul>{files.map((f,i)=><li key={i}>{f.name} · {(f.size/1024/1024).toFixed(1)} MB</li>)}</ul>:'Drop receipts here. JPG, PNG, WebP or PDF · up to 3 MB each.'}</div>
      <label>Business purpose<input style={{...field,margin:'6px 0 14px'}} maxLength={400} value={purpose} onChange={e=>setPurpose(e.target.value)} placeholder="e.g. train to a sponsor meeting"/></label>
      <label>Suggested category<select style={{...field,margin:'6px 0 14px'}} value={category} onChange={e=>setCategory(e.target.value)}>{data.categories.map(c=><option key={c.code} value={c.code}>{c.label}</option>)}</select></label>
      <label>Business use (%)<input style={{...field,maxWidth:150,display:'block',margin:'6px 0 14px'}} type="number" min="0" max="100" step="any" value={share} onChange={e=>setShare(e.target.value)}/></label>
      <Pill icon={Receipt} disabled={busy || !files.length} onClick={upload}>{busy?'Working…':'Save receipts'}</Pill><p style={{fontSize:12}}>The purpose and category apply to all selected files. These are review notes, not confirmed tax deductions.</p>
    </form></Card>
    <Card style={{marginBottom:16}}><Mono>Scanning & expense review</Mono>{data.wrangler.configured?<><p>Receipt Wrangler is configured. Send a saved receipt for scanning, then review its amount, date, category and business use there. Acceptance does not confirm extraction or approval.</p><a href={data.wrangler.url} target="_blank" rel="noreferrer">Open Receipt Wrangler</a></>:<><p>Photo and file capture is available. Automatic extraction awaits the Receipt Wrangler service connection.</p><details><summary>Connection requirements</summary><p>A hosted Receipt Wrangler instance with its database, Redis and receipt processing configured.</p><ul>{data.wrangler.missing.map(k=><li key={k}>{k}</li>)}</ul></details></>}</Card>
    <div style={{display:'flex',gap:10,alignItems:'center',justifyContent:'space-between',margin:'22px 0 12px',flexWrap:'wrap'}}><h3 style={{margin:0}}>Saved receipts ({data.receipts.length})</h3><Pill sm icon={Download} tone="ghost" disabled={!data.receipts.length} onClick={exportManifest}>Export capture notes</Pill></div>
    {!data.receipts.length?<Card>Your receipt inbox is ready for the first upload.</Card>:data.receipts.map(r=><Card key={r.id} style={{marginBottom:12}}><Mono>{statuses[r.delivery.status] || r.delivery.status}</Mono><h3 style={{overflowWrap:'anywhere'}}>{r.filename}</h3><p>{r.purpose || 'Business purpose not supplied'}</p><p style={{fontSize:13}}>{data.categories.find(c=>c.code===r.category)?.label || r.category} · {r.businessPercent}% business use · unreviewed</p><p style={{fontSize:12}}>Captured {new Date(r.capturedAt).toLocaleString('en-IE',{timeZone:'Europe/Dublin'})}</p><div style={{display:'flex',gap:12,alignItems:'center',flexWrap:'wrap'}}><a href={'/api/receipts?file='+r.id}>Download original</a>{data.wrangler.configured && r.delivery.status==='saved'&&<Pill sm disabled={busy} onClick={()=>deliver(r.id)}>Send for scanning</Pill>}</div>{r.delivery.message&&<p style={{fontSize:13}}>{r.delivery.message}</p>}</Card>)}
    <p style={{fontSize:12}}>Capture notes are an audit trail, not a P&amp;L. Final expense entries, VAT treatment and approval belong in the accounting ledger. Form 11 mappings are versioned to the published 2025 form and must be checked for the filing year.</p>
    </>}
  </div>;
}
