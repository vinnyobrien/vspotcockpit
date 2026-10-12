import crypto from 'node:crypto';
import { store } from './_blobs.js';

export const passes = () => store('guest-backstage');
export const hash = (v) => crypto.createHash('sha256').update(v).digest('hex');
export const BOOKINGS = {
  'The Struggle Bus': 'https://calendly.com/vinnyob/struggle-bus-recording-1',
  'The Ostrich Report': 'https://calendly.com/vinnyob/sunday-supplement-recording-clone',
  'The Sunday Supplement': 'https://calendly.com/vinnyob/sunday-supplement-recording',
};
export async function status(pass) {
  const s = passes();
  const [accepted, booking, bio, headshot] = await Promise.all([
    s.get(`accepted/${pass.id}`, {type:'json'}), s.get(`booking/${pass.id}`, {type:'json'}),
    s.get(`bio/${pass.id}`, {type:'json'}), s.getMetadata(`headshot/${pass.id}`),
  ]);
  return { acceptedAt: accepted?.at || null, bookedAt: booking?.start || null,
    bookingVerified: !!booking?.start, bioReceived: !!bio?.bio, headshotReceived: !!headshot,
    ready: !!accepted && !!booking?.start && !!bio?.bio && !!headshot };
}
export function fileType(bytes) {
  if (bytes[0]===0xff && bytes[1]===0xd8 && bytes[2]===0xff) return 'image/jpeg';
  if (bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'image/png';
  if (bytes.subarray(0,4).toString()==='RIFF' && bytes.subarray(8,12).toString()==='WEBP') return 'image/webp';
  return null;
}
export async function authorisedPass(req, read = id => passes().get(`definitions/${id}`,{type:'json'})) {
  const id = new URL(req.url).searchParams.get('id');
  const token = (req.headers.get('authorization') || '').replace(/^Bearer /,'');
  if (!/^[a-f0-9-]{36}$/.test(id || '') || token.length!==64) return null;
  const p = await read(id);
  if (!p || p.expiresAt<Date.now() || p.revoked || hash(token)!==p.tokenHash) return null;
  const password=req.headers.get('x-guest-password')||'';
  if(!p.passwordHash || password.length>80 || hash(password)!==p.passwordHash) return null;
  return p;
}

export function findRecording(items, pass) {
  return items.find(e => e.status!=='cancelled' && (e.attendees||[]).some(a=>a.email?.toLowerCase()===pass.email) &&
    ((e.summary||'').toLowerCase().includes(pass.show.toLowerCase().replace(/^the /,'')) ||
      (/recording/i.test(e.summary||'') && (e.description||'').includes(BOOKINGS[pass.show]))));
}

// Overlay guest-scoped documents on the existing roster without replacing it.
export async function enrichGuests(guests=[]) {
  const {blobs}=await passes().list({prefix:'definitions/'});
  const all=await Promise.all(blobs.map(async b=>{const p=await passes().get(b.key,{type:'json'});return {...p,...await status(p)};}));
  const base=Array.isArray(guests)?guests:[];
  const combined=[...base,...all.filter(p=>!base.some(g=>g.id===p.guestId||(g.email===p.email&&g.show===p.show))).map(p=>({id:p.guestId,name:p.name,email:p.email,show:p.show,why:p.why,stage:'approached',assets:{},emails:[],touched:p.createdAt.slice(0,10)}))];
  return combined.map(g=>{const p=all.find(p=>g.id===p.guestId||(g.email===p.email&&g.show===p.show));if(!p)return g;return {...g,stage:['recorded','published'].includes(g.stage)?g.stage:p.bookedAt?'booked':p.acceptedAt?'confirmed':g.stage,date:p.bookedAt?p.bookedAt.slice(0,10):g.date,assets:{...g.assets,bio:p.bioReceived||!!g.assets?.bio,headshot:p.headshotReceived||!!g.assets?.headshot},backstage:{id:p.id,passUrl:p.passUrl,guestPassword:p.guestPassword,acceptedAt:p.acceptedAt,bookedAt:p.bookedAt,ready:p.ready,bioReceived:p.bioReceived,headshotReceived:p.headshotReceived}};});
}
