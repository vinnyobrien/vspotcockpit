import { requireAuth, json } from './_auth.js';
import { store } from './_blobs.js';
import { seedCalendar, reviseItem, transition } from '../../src/lib/editorial-calendar.js';

export default async (req) => {
  const denied = requireAuth(req); if (denied) return denied;
  if (!['GET','POST'].includes(req.method)) return json({error:'Method not allowed'},405);
  try {
    // Commercial deadlines stay in the private vault, outside the mirrorable ledger.
    const db = store('vault');
    const saved = await db.get('editorial-calendar-v1',{type:'json'});
    const current = saved || seedCalendar();
    if (req.method === 'GET') return json(current);
    const input = await req.json();
    if (input.revision !== current.revision) return json({error:'The calendar changed in another session. Reload before saving.'},409);
    const index = current.items.findIndex(i=>i.id===input.item?.id || i.id===input.id);
    let next;
    if (input.action==='save') {
      const item = input.item;
      if (!item || typeof item.title!=='string' || !item.title.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(item.date) || !item.id || JSON.stringify(item).length>25000) return json({error:'A title and release date are required.'},400);
      for (const key of ['show','format','owner','channels','notes','sponsor','sponsorNeeds','sponsorEvidence','finalLink','time','ideaDate','briefDate','draftDate','reviewDate','signoffDate','sponsorDate']) if (typeof item[key]!=='string') return json({error:'Invalid calendar field.'},400);
      if (!item.checks || typeof item.checks!=='object') return json({error:'Missing preparation checklist.'},400);
      for (const key of ['ideas','brief','draft','review','sponsor']) if (typeof item.checks[key]!=='boolean') return json({error:'Invalid preparation checklist.'},400);
      if (!Number.isFinite(item.ideaMinutes) || item.ideaMinutes<=0) return json({error:'Reserve a positive number of minutes for thinking.'},400);
      const sequence = [item.ideaDate,item.briefDate,item.draftDate,item.reviewDate,item.signoffDate,item.date];
      if (sequence.some(d=>!/^\d{4}-\d{2}-\d{2}$/.test(d)) || sequence.some((d,i)=>i>0 && d<sequence[i-1])) return json({error:'Set thinking, brief, draft, review and sign-off dates in order before release.'},400);
      if (item.sponsor && (!/^\d{4}-\d{2}-\d{2}$/.test(item.sponsorDate) || item.sponsorDate>item.signoffDate)) return json({error:'Set sponsor approval on or before Vinny’s sign-off deadline.'},400);
      next = index<0 ? {...item,status:'planned',approval:null,history:[]} : reviseItem(current.items[index],item);
    } else {
      if (index<0) return json({error:'Item not found'},404);
      next = transition(current.items[index],input.action);
    }
    const items = [...current.items]; if (index<0) items.push(next); else items[index]=next;
    const result = {revision:current.revision+1,items};
    await db.setJSON('editorial-calendar-v1',result);
    return json(result);
  } catch(e) { return json({error:e.message || 'Could not load or save the calendar'},400); }
};
