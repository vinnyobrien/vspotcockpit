import { requireAuth, json } from './_auth.js';
import { readJSON, store } from './_blobs.js';
import { PUBLICATION } from './_substack.js';
export default async req => {
  const denied = requireAuth(req, { allowOpen: false });
  if (denied) return denied;
  if (req.method === 'GET') {
    const credential = await readJSON('secrets','substack-connection');
    return json({ publication: PUBLICATION, social: await readJSON('substack-analytics','social-snapshot'), connected: Boolean(credential?.token || Netlify.env.get('SUBSTACK_SESSION_TOKEN')), data: await readJSON('substack-analytics','substack-stats'), sync: await readJSON('substack-analytics','substack-sync') });
  }
  if (req.headers.get('origin') !== new URL(req.url).origin) return json({ error:'Use the Cockpit page to manage this connection.' },403);
  if (req.method === 'PUT') {
    const body = await req.json().catch(()=>({}));
    if (body.social) {
      const s = body.social;
      if (JSON.stringify(s).length > 20000 || s.source !== 'Metricool' || !/^\d{4}-\d{2}-\d{2}$/.test(s.asOf) || !s.tiktok || !s.youtube) return json({error:'Invalid Metricool snapshot.'},400);
      await store('substack-analytics').setJSON('social-snapshot',s);
      return json({imported:true});
    }
    const token = typeof body.token === 'string' ? body.token.trim() : '';
    if (!token || token.length > 8192 || /[\s;\r\n]/.test(token)) return json({ error:'Enter only the value of the substack.sid cookie.' },400);
    await store('secrets').setJSON('substack-connection',{ token });
    return json({ connected:true });
  }
  if (req.method === 'DELETE') {
    await store('secrets').delete('substack-connection');
    await store('substack-analytics').delete('substack-stats');
    await store('substack-analytics').delete('substack-sync');
    return json({ connected: Boolean(Netlify.env.get('SUBSTACK_SESSION_TOKEN')) });
  }
  return json({ error:'Method not allowed' },405);
};
