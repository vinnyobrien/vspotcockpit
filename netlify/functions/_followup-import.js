import { getAccessToken } from './_google.js';
import { store } from './_blobs.js';
import { emptyFollowups,mergeBrief } from './_followup-data.js';

export const FOLLOWUP_KEY='daily-followups-v1';
function parts(part){return [part,...(part.parts || []).flatMap(parts)];}
const header=(message,name)=>(message.payload.headers || []).find(h=>h.name.toLowerCase()===name.toLowerCase())?.value || '';
async function get(path,token){const r=await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error(`Gmail import returned ${r.status}`);return r.json();}
export async function importFollowups(){
  const db=store('vault');
  const token=await getAccessToken();if(!token)throw new Error('Connect Google in the cockpit to import the emailed actions.');
  const profile=await get('profile',token),email=profile.emailAddress.toLowerCase();
  let data=await db.get(FOLLOWUP_KEY,{type:'json'}) || emptyFollowups();
  const ids=[];let pageToken;
  do{const q='in:sent from:me to:me newer_than:14d filename:cockpit-actions.json';const page=await get(`messages?q=${encodeURIComponent(q)}&maxResults=50${pageToken?'&pageToken='+encodeURIComponent(pageToken):''}`,token);ids.push(...(page.messages || []).map(m=>m.id));pageToken=page.nextPageToken;}while(pageToken && ids.length<200);
  const errors=[];let imported=0;
  for(const id of ids.reverse()){
    if(data.imports.includes(id))continue;
    try{
      const message=await get(`messages/${encodeURIComponent(id)}?format=full`,token);
      const sender=header(message,'From').match(/<([^>]+)>/)?.[1] || header(message,'From').trim();
      if(sender.toLowerCase()!==email || !message.labelIds?.includes('SENT') || !/^Cockpit (morning brief|evening review) [—-] \d{4}-\d{2}-\d{2}$/.test(header(message,'Subject')))continue;
      const part=parts(message.payload).find(p=>p.filename==='cockpit-actions.json');if(!part)continue;
      if((part.body?.size || 0)>500000)throw new Error('Attachment exceeds import limit');
      const body=part.body?.attachmentId ? await get(`messages/${encodeURIComponent(id)}/attachments/${encodeURIComponent(part.body.attachmentId)}`,token) : part.body;
      const payload=JSON.parse(Buffer.from(body?.data || '', 'base64url').toString('utf8'));
      data=mergeBrief(data,payload,id);await db.setJSON(FOLLOWUP_KEY,data);imported++;
    }catch(e){errors.push({messageId:id,error:e.message});}
  }
  await db.setJSON('daily-followups-import-status',{at:new Date().toISOString(),imported,errors,hasMore:Boolean(pageToken)});
  return {data,imported,errors};
}
