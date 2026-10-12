import crypto from 'node:crypto';
import { requireAuth, json } from './_auth.js';
import { passes, hash, status, BOOKINGS } from './_guest-pass.js';

export default async (req) => {
  const denied = requireAuth(req, {allowOpen:false});
  if (denied) return denied;
  const s = passes(), url = new URL(req.url);
  if(req.method==='GET') {
    const id=url.searchParams.get('id'), asset=url.searchParams.get('asset');
    if(id && asset) {
      if(!/^[a-f0-9-]{36}$/.test(id)) return json({error:'Invalid pass'},400);
      if(asset==='bio') return json(await s.get(`bio/${id}`,{type:'json'}) || {});
      if(asset==='headshot') {
        const f=await s.getWithMetadata(`headshot/${id}`,{type:'arrayBuffer'});
        if(!f) return json({error:'Headshot not received'},404);
        return new Response(f.data,{headers:{'content-type':f.metadata.type,'cache-control':'no-store','content-disposition':'attachment; filename="guest-headshot"','x-content-type-options':'nosniff'}});
      }
      return json({error:'Unknown asset'},400);
    }
    const {blobs}=await s.list({prefix:'definitions/'});
    const rows=await Promise.all(blobs.map(async b=>{
      const p=await s.get(b.key,{type:'json'});
      return {id:p.id,guestId:p.guestId,name:p.name,email:p.email,show:p.show,why:p.why,scope:p.scope,passUrl:p.passUrl,guestPassword:p.guestPassword,...await status(p)};
    }));
    return json({passes:rows});
  }
  if(req.method!=='POST') return json({error:'Method not allowed'},405);
  let b;try{b=await req.json();}catch{return json({error:'Invalid request'},400);}
  const name=String(b.name||'').trim(),email=String(b.email||'').trim().toLowerCase();
  if(!name || name.length>120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length>254) return json({error:'A guest name and email are required'},400);
  if(!BOOKINGS[b.show]) return json({error:'Choose a supported show'},400);
  const {blobs}=await s.list({prefix:'definitions/'});
  for(const f of blobs){const p=await s.get(f.key,{type:'json'});if(p.email===email&&p.show===b.show&&!p.revoked&&p.expiresAt>Date.now())return json({pass:{id:p.id,name:p.name,email:p.email,show:p.show,why:p.why,scope:p.scope,passUrl:p.passUrl,guestPassword:p.guestPassword,...await status(p)}});}
  const id=crypto.randomUUID(),token=crypto.randomBytes(32).toString('hex'),guestPassword=crypto.randomBytes(6).toString('base64url');
  const room=/^shaje\b/i.test(name)?'shaje':'guest';
  const passUrl=`https://thevspotnews.com/backstage/${room}/#pass=${id}.${token}`;
  const p={id,guestId:String(b.guestId||id).slice(0,120),name,email,show:b.show,
    why:String(b.why||'Your story, what shaped your decisions and the questions you care about.').slice(0,1200),
    scope:String(b.scope||'One episode').slice(0,160),passUrl,guestPassword,passwordHash:hash(guestPassword),tokenHash:hash(token),createdAt:new Date().toISOString(),expiresAt:Date.now()+90*86400000};
  await s.setJSON(`definitions/${id}`,p,{onlyIfNew:true});
  return json({pass:{id,name,email,show:p.show,why:p.why,scope:p.scope,passUrl,guestPassword,...await status(p)}},201);
};
