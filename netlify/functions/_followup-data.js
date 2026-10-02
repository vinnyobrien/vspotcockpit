import { createHash } from 'node:crypto';

export const emptyFollowups = () => ({actions:[],reviews:[],imports:[],updated:null});
const clip=(value,max=500)=>String(value || '').trim().slice(0,max);
const norm=value=>clip(value).toLowerCase().replace(/\s+/g,' ');
export const actionId=a=>createHash('sha256').update([a.sourceType,a.sourceId,norm(a.owner),norm(a.evidence)].join('\0')).digest('hex').slice(0,24);
export function safeLink(value) {try{const u=new URL(value);return u.protocol==='https:' ? u.href : '';}catch{return '';}}
export function mergeBrief(prior,payload,messageId,now=new Date().toISOString()) {
  if(payload?.schema!=='cockpit-actions-v1' || !Array.isArray(payload.actions) || !Array.isArray(payload.reviews)) throw new Error('Invalid cockpit brief attachment');
  if(prior.imports.includes(messageId)) return prior;
  if(payload.actions.length>300 || payload.reviews.length>150) throw new Error('Brief attachment is too large');
  const actions=new Map(prior.actions.map(a=>[a.id,a]));
  for(const a of payload.actions){
    if(!['fireflies','email','calendar'].includes(a.sourceType) || !clip(a.sourceId) || !clip(a.title) || !clip(a.owner) || !clip(a.evidence) || !/^\d{4}-\d{2}-\d{2}$/.test(a.dueDate || '') || !['agreed','proposed'].includes(a.dueBasis)) throw new Error('Action is missing its owner, evidence or due date');
    const id=actionId(a),old=actions.get(id);
    actions.set(id,{id,sourceType:a.sourceType,sourceId:clip(a.sourceId,200),sourceUrl:safeLink(a.sourceUrl),sourceDate:clip(a.sourceDate,60),title:clip(a.title),owner:clip(a.owner,120),dueDate:old?.dateEdited ? old.dueDate : a.dueDate,dueBasis:old?.dateEdited ? old.dueBasis : a.dueBasis,evidence:clip(a.evidence,1000),draft:clip(a.draft,4000),state:old?.state || 'open',dateEdited:old?.dateEdited || false,created:old?.created || now,updated:now,history:old?.history || [],messageId});
  }
  const reviews=new Map(prior.reviews.map(r=>[r.sourceId,r]));
  for(const r of payload.reviews){if(!clip(r.sourceId))throw new Error('Review lacks a transcript ID');reviews.set(clip(r.sourceId,200),{sourceId:clip(r.sourceId,200),sourceUrl:safeLink(r.sourceUrl),sourceDate:clip(r.sourceDate,60),title:clip(r.title,200),summary:clip(r.summary,1500),reviewedAt:clip(r.reviewedAt,60) || now});}
  return {actions:[...actions.values()],reviews:[...reviews.values()],imports:[...prior.imports,messageId].slice(-1000),updated:now};
}
export function updateFollowup(data,input,now=new Date().toISOString()) {
  const item=data.actions.find(a=>a.id===input.id);if(!item)throw new Error('Action not found');
  let change;
  if(input.action==='due'){if(!/^\d{4}-\d{2}-\d{2}$/.test(input.date || ''))throw new Error('Choose a due date');change={dueDate:input.date,dueBasis:'agreed',dateEdited:true};}
  else if(['done','dismissed','open'].includes(input.action))change={state:input.action};
  else throw new Error('Unknown action');
  return {...data,updated:now,actions:data.actions.map(a=>a.id===input.id?{...a,...change,updated:now,history:[...a.history,{action:input.action,date:input.date || null,at:now}]}:a)};
}
