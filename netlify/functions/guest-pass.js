import { json } from './_auth.js';
import { passes, status, authorisedPass, BOOKINGS, fileType, findRecording } from './_guest-pass.js';
import { getAccessToken } from './_google.js';

export default async (req) => {
  try {
    const pass=await authorisedPass(req);
    if(!pass)return json({error:'This backstage pass is missing, expired or inactive. Ask Vinny for your personal link.'},401);
    const s=passes();
    const summary=async()=>({name:pass.name,show:pass.show,why:pass.why,scope:pass.scope,bookingUrl:BOOKINGS[pass.show],...await status(pass)});
    if(req.method==='GET')return json(await summary());
    if(req.method!=='POST')return json({error:'Method not allowed'},405);
    const action=new URL(req.url).searchParams.get('action');
    if(action==='accept'){
      await s.setJSON(`accepted/${pass.id}`,{at:new Date().toISOString()},{onlyIfNew:true});
      return json(await summary());
    }
    if(action==='assets'){
      if(Number(req.headers.get('content-length')||0)>3500000)return json({error:'Please use a headshot under 3MB'},413);
      const body=await req.formData();
      if(body.get('permission')!=='yes')return json({error:'Confirm permission to use your headshot and bio for this appearance'},400);
      const bio=String(body.get('bio')||'').trim(),notes=String(body.get('notes')||'').trim();
      if(bio.length>1500||notes.length>2000)return json({error:'Please shorten your bio or preparation notes'},400);
      const file=body.get('headshot');
      if(file&&typeof file.arrayBuffer==='function'&&file.size){
        if(file.size>3*1024*1024)return json({error:'Please use a headshot under 3MB'},413);
        const bytes=Buffer.from(await file.arrayBuffer()),type=fileType(bytes);
        if(!type)return json({error:'Please upload a JPG, PNG or WebP headshot'},400);
        await s.set(`headshot/${pass.id}`,bytes,{metadata:{type,name:String(file.name).slice(0,150),at:new Date().toISOString()}});
      }
      if(bio)await s.setJSON(`bio/${pass.id}`,{bio,notes,permission:true,at:new Date().toISOString()});
      else if(notes)await s.setJSON(`notes/${pass.id}`,{notes,at:new Date().toISOString()});
      return json(await summary());
    }
    if(action==='booking'){
      const token=await getAccessToken();
      if(!token)return json({...await summary(),bookingMessage:'Your booking remains with Calendly. Vinny needs to reconnect the calendar before we can verify it here.'});
      const url=new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
      url.searchParams.set('timeMin',new Date(Date.now()-86400000).toISOString());
      url.searchParams.set('timeMax',new Date(Date.now()+366*86400000).toISOString());
      url.searchParams.set('singleEvents','true');url.searchParams.set('maxResults','250');url.searchParams.set('q',pass.email);
      const response=await fetch(url,{headers:{Authorization:`Bearer ${token}`}});
      if(!response.ok)return json({...await summary(),bookingMessage:'Calendar verification is temporarily unavailable. Your Calendly booking is unaffected.'});
      const data=await response.json();
      const match=findRecording(data.items||[],pass);
      if(match)await s.setJSON(`booking/${pass.id}`,{start:match.start?.dateTime||match.start?.date,eventId:match.id,verifiedAt:new Date().toISOString()});
      return json({...await summary(),bookingMessage:match?'Your recording is on Vinny’s calendar.':'No matching recording is on the calendar yet. Use the email address Vinny invited, and check again after booking.'});
    }
    return json({error:'Unknown action'},400);
  }catch(e){console.error('Guest pass operation failed',e.message);return json({error:'We couldn’t save that step. Please try again.'},503);}
};
export const config={rateLimit:{action:'rate_limit',windowLimit:30,windowSize:60,aggregateBy:'ip'}};
