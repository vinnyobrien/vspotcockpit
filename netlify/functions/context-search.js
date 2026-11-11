import { requireAuth, json } from "./_auth.js";
import { readJSON } from "./_blobs.js";
import { store } from "./_blobs.js";
import { FOLLOWUP_KEY } from "./_followup-import.js";

// Source-grounded context retrieval; no raw email export or public publication.
// Explicit query only. Private commercial follow-ups remain in vault.
const norm=s=>String(s||"").toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();
const matches=(item,q)=>norm(item).includes(q);
const cap=(s,n=600)=>String(s||"").slice(0,n);
export default async req=>{
  const denied=requireAuth(req);if(denied)return denied;
  if(req.method!=="GET")return json({error:"Method not allowed"},405);
  const url=new URL(req.url),query=cap(url.searchParams.get("q"),120).trim(),q=norm(query);
  if(q.length<3)return json({error:"Enter at least three characters to find context."},400);
  try {
    const [followups,meetings]=await Promise.all([
      store("vault").get(FOLLOWUP_KEY,{type:"json"}),
      readJSON("cockpit","commitments",{})
    ]);
    const hits=[];
    for(const a of followups?.actions||[]){
      if(matches([a.title,a.owner,a.evidence,a.draft].join(" "),q))
        hits.push({kind:"followup",sourceType:a.sourceType,sourceId:a.sourceId,sourceUrl:a.sourceUrl||"",date:a.sourceDate||a.created,title:cap(a.title,300),evidence:cap(a.evidence,900),owner:a.owner,dueDate:a.dueDate,dueBasis:a.dueBasis,status:a.state});
    }
    for(const r of followups?.reviews||[]){
      if(matches([r.title,r.summary].join(" "),q))
        hits.push({kind:"meeting_review",sourceType:"fireflies",sourceId:r.sourceId,sourceUrl:r.sourceUrl||"",date:r.sourceDate,title:cap(r.title,300),evidence:cap(r.summary,900)});
    }
    for(const a of meetings?.actions||[]){
      if(matches([a.meeting,a.who,a.what,a.blocks].join(" "),q))
        hits.push({kind:"meeting_action",sourceType:"fireflies",sourceId:a.id,date:a.raised,title:cap(a.what,300),evidence:cap(a.meeting,300),owner:a.who,dueDate:a.due,dueBasis:a.agreed?"agreed":"inferred",status:a.state});
    }
    for(const d of meetings?.decisions||[]){
      if(matches([d.meeting,d.what,d.why].join(" "),q))
        hits.push({kind:"meeting_decision",sourceType:"fireflies",sourceId:d.id,date:d.date,title:cap(d.what,300),evidence:cap(d.why,600),meeting:d.meeting});
    }
    hits.sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")));
    return json({query,results:hits.slice(0,80),total:hits.length,coverage:{fireflies:"extracted meeting decisions/actions and imported reviews",email:"structured self-email follow-ups only; not all Gmail correspondence"},note:"Sources may overlap. Review before drafting or sending; never treat inferred due dates as agreed."});
  }catch(e){return json({error:"Context retrieval failed",detail:cap(e.message,180)},500);}
};
