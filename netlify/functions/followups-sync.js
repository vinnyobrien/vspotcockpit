import { importFollowups } from './_followup-import.js';
import { store } from './_blobs.js';
// Import the structured action attachment after either self-email arrives.
export default async()=>{try{const r=await importFollowups();console.log(`Follow-ups imported: ${r.imported}; errors: ${r.errors.length}`);}catch(e){await store('vault').setJSON('daily-followups-import-status',{at:new Date().toISOString(),error:e.message});console.error('Follow-ups import failed:',e.message);}};
export const config={schedule:'*/15 * * * *'};
