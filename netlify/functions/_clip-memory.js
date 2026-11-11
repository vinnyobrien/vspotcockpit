import { createHash } from "node:crypto";
import { readJSON, writeJSON } from "./_blobs.js";

// Stores the short transcript excerpt and its source, not full recordings.
// The same source can generate many Opus IDs for essentially one spoken moment.
const KEY="opus:moment-ledger:v1", LIMIT=2000;
const tidy=s=>String(s||"").toLowerCase().replace(/__silence/g," ").replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();
const words=s=>new Set(tidy(s).split(" ").filter(w=>w.length>3));
const overlap=(a,b)=>{const x=words(a),y=words(b);if(x.size<7||y.size<7)return false;let n=0;for(const w of x)if(y.has(w))n++;return n/Math.min(x.size,y.size)>=0.72;};
export function isRepeatedMoment(candidate,ledger) {
  const source=String(candidate.projectId||"");
  if(!source)return false;
  return ledger.some(m=>m.projectId===source&&(m.clipId===String(candidate.clipId)||overlap(m.transcript,candidate.transcript)));
}
export async function loadMomentLedger(){const x=await readJSON("cockpit",KEY,[]);return Array.isArray(x)?x:[];}
export async function rememberMoments(clips,tier) {
  const previous=await loadMomentLedger();
  const next=[...previous];
  for(const c of clips){
    if(!c.projectId||!c.clipId)continue;
    const item={projectId:String(c.projectId),clipId:String(c.clipId),transcript:String(c.transcript||"").slice(0,500),tier,firstShownAt:new Date().toISOString(),fingerprint:createHash("sha256").update(tidy(c.transcript)).digest("hex").slice(0,20)};
    if(!isRepeatedMoment(item,next))next.push(item);
  }
  await writeJSON("cockpit",KEY,next.slice(-LIMIT));
  return {total:next.length,added:next.length-previous.length};
}
