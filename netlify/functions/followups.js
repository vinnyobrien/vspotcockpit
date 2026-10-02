import { requireAuth,json } from './_auth.js';
import { store } from './_blobs.js';
import { FOLLOWUP_KEY,importFollowups } from './_followup-import.js';
import { emptyFollowups,updateFollowup } from './_followup-data.js';
export default async req=>{
  const denied=requireAuth(req);if(denied)return denied;
  const db=store('vault');
  try{
    if(req.method==='GET')return json({data:await db.get(FOLLOWUP_KEY,{type:'json'}) || emptyFollowups(),sync:await db.get('daily-followups-import-status',{type:'json'})});
    if(req.method!=='POST')return json({error:'Method not allowed'},405);
    const input=await req.json();
    if(input.action==='sync'){const result=await importFollowups();return json({data:result.data,sync:{at:new Date().toISOString(),errors:result.errors,imported:result.imported}});}
    const data=updateFollowup(await db.get(FOLLOWUP_KEY,{type:'json'}) || emptyFollowups(),input);await db.setJSON(FOLLOWUP_KEY,data);return json({data});
  }catch(e){return json({error:e.message},400);}
};
