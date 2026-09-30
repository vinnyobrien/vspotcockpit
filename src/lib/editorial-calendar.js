export const TONE = 'Mock-authoritative news delivery; topical commerce satire; self-deprecation; knowingly silly slang; a candid production aside. Reference: Vinny’s LinkedIn PSA, 30 September 2026. The V Spot is a satirical news site.';
export function dateInDublin(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Dublin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function shiftDate(date, days) {
  const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10);
}
export function newItem(date = dateInDublin()) {
  return { id: crypto.randomUUID(), title: '', show: 'The V Spot News', format: 'Satirical news', date, time: '', owner: 'Vinny', channels: 'LinkedIn, Substack, YouTube, TikTok', ideaDate: shiftDate(date,-7), ideaMinutes: 60, briefDate: shiftDate(date,-4), draftDate: shiftDate(date,-3), reviewDate: shiftDate(date,-2), signoffDate: shiftDate(date,-1), sponsor: '', sponsorDate: '', sponsorNeeds: '', sponsorEvidence: '', finalLink: '', notes: '', checks: {ideas:false, brief:false, draft:false, review:false, sponsor:false}, status:'planned', approval:null, history:[] };
}
export function seedCalendar() {
  const dates = ['2026-10-09','2026-10-16','2026-10-23','2026-10-30'];
  return { revision:0, items:dates.map((date,i)=>({...newItem(date), id:`vspot-return-${date}`, title:i ? 'The V Spot News — topic to develop' : 'The V Spot News returns', notes:i ? 'Proposed Friday slot. Topic and commercial commitments awaiting confirmation.' : 'Confirmed return date from published LinkedIn PSA. Agree release time; develop the first rundown. Sponsors welcome is an invitation, not a confirmed booking.'})) };
}
export function blockers(item) {
  const missing = ['ideas','brief','draft','review'].filter(k=>!item.checks[k]);
  if (!item.title.trim()) missing.push('title');
  if (!item.time) missing.push('release time');
  if (!item.finalLink.trim()) missing.push('final asset / copy link');
  if (item.sponsor && (!item.sponsorDate || !item.sponsorNeeds.trim() || !item.checks.sponsor || !item.sponsorEvidence.trim())) missing.push('sponsor deadline, requirements and approval evidence');
  return missing;
}
export function transition(item, action, now = new Date().toISOString()) {
  if (action === 'approve') {
    if (item.status !== 'review' || blockers(item).length) throw new Error('Complete the preparation, review and sponsor requirements before signing off.');
    return {...item, status:'approved', approval:{by:'Vinny',at:now}, history:[...item.history,{action:'Vinny signed off',at:now}]};
  }
  if (action === 'published') {
    if (item.status !== 'approved' || !item.approval || blockers(item).length) throw new Error('Vinny’s sign-off is required before recording publication.');
    return {...item,status:'published',history:[...item.history,{action:'Publication confirmed manually',at:now}]};
  }
  if (action === 'review') return {...item,status:'review',approval:null,history:[...item.history,{action:'Submitted for sign-off',at:now}]};
  throw new Error('Unknown action');
}
export function reviseItem(old, updated, now = new Date().toISOString()) {
  return {...updated,id:old.id,status:'planned',approval:null,history:[...old.history,{action:'Edited; fresh sign-off required',at:now}]};
}
export function deadlines(item) {
  if (item.status === 'published') return [];
  return [['ideas',item.ideaDate,'Thinking / ideas'],['brief',item.briefDate,'Brief'],['draft',item.draftDate,'Draft / edit'],['review',item.reviewDate,'Sub-Editor review'],...(item.sponsor ? [['sponsor',item.sponsorDate,'Sponsor approval']] : []),['signoff',item.signoffDate,'Vinny sign-off'],['release',item.date,'Release']].filter(([k,d])=>d && !(k==='signoff' ? item.approval : item.checks[k])).map(([key,date,label])=>({key,date,label,item}));
}
