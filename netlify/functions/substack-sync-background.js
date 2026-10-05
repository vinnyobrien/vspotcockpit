import { requireAuth } from './_auth.js';
import { readJSON, store } from './_blobs.js';
import { extractStats } from './_substack.js';
export default async req => {
  if (requireAuth(req,{allowOpen:false})) return;
  if (req.method !== 'POST' || req.headers.get('origin') !== new URL(req.url).origin) return;
  const vault = store('substack-analytics');
  const previous = await readJSON('substack-analytics','substack-sync');
  if (previous?.state === 'running' && Date.now()-Date.parse(previous.at)<15*60*1000) return;
  const at = new Date().toISOString();
  await vault.setJSON('substack-sync',{ state:'running', at });
  try {
    const credential = await readJSON('secrets','substack-connection');
    const token = credential?.token || Netlify.env.get('SUBSTACK_SESSION_TOKEN');
    if (!token) throw new Error('Connect Substack first.');
    const stats = await extractStats(token);
    await vault.setJSON('substack-stats',stats);
    await vault.setJSON('substack-sync',{ state:'done', at, completedAt:stats.fetchedAt });
  } catch(e) {
    // Never expose upstream bodies or credentials in a log or browser error.
    const known = /^(Substack|Connect Substack)/.test(e.message);
    await vault.setJSON('substack-sync',{ state:'error', at, error:known?e.message:'Substack request failed. Try again or reconnect.' });
  }
};
