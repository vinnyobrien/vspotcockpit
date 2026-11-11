import { requireAuth, json } from "./_auth.js";
import { readJSON, store } from "./_blobs.js";
import { firefliesConfigured } from "./_fireflies.js";
import { FOLLOWUP_KEY } from "./_followup-import.js";

// Operational diagnostics without exposing credentials or message bodies.
export default async req => {
  const denied=requireAuth(req);if(denied)return denied;
  if(req.method!=="GET")return json({error:"Method not allowed"},405);
  try{
    const [commitments,followups,sync,ledger]=await Promise.all([
      readJSON("cockpit","commitments",{}),
      store("vault").get(FOLLOWUP_KEY,{type:"json"}),
      store("vault").get("daily-followups-import-status",{type:"json"}),
      readJSON("cockpit","opus:moment-ledger:v1",[])
    ]);
    return json({
      fireflies:{configured:firefliesConfigured(),lastFiledAt:commitments?.updated||null,actionCount:commitments?.actions?.length||0,decisionCount:commitments?.decisions?.length||0,liveApiVerified:false},
      emailFollowups:{lastSyncAt:sync?.at||null,importedLastRun:sync?.imported??null,errors:(sync?.errors||[]).map(e=>String(e.error||"Unknown import error").slice(0,180)),storedActions:followups?.actions?.length||0,coverage:"structured cockpit-actions.json self-emails only"},
      opus:{momentsRemembered:Array.isArray(ledger)?ledger.length:0},
      checkedAt:new Date().toISOString()
    });
  }catch(e){return json({error:"Diagnostics unavailable"},500);}
};