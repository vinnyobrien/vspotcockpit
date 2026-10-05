import test from 'node:test';
import assert from 'node:assert/strict';
import { extractStats, requestSubstack, yearStats } from '../netlify/functions/_substack.js';
import { requireAuth, mintCookie } from '../netlify/functions/_auth.js';

test('HTML access errors cannot be presented as zero analytics',async()=>{
  await assert.rejects(requestSubstack('/api/v1/archive','',async()=>new Response('<html>Site unavailable</html>',{headers:{'content-type':'text/html'}})),/page instead/);
});
test('expired authentication produces a reconnect message without upstream content',async()=>{
  await assert.rejects(requestSubstack('/api/v1/archive','test-only',async()=>new Response('secret body',{status:403})),/connection expired/);
});
test('pagination fetches all posts and discards unexpected private fields',async()=>{
  const urls=[];
  const result=await extractStats('test-only',{pause:async()=>{},fetcher:async url=>{
    urls.push(url);
    const body=url.includes('summary')?{subscribers:100,email:'private'}:url.includes('offset=0')?{rows:Array.from({length:10},(_,i)=>({post_id:i,title:'test',post_date:'2026-01-01',delivered:10,opens:5,email:'private'}))}:{rows:[{post_id:10,delivered:20,opens:3}]};
    return Response.json(body);
  }});
  assert.equal(result.posts.length,11);assert.equal(result.complete,true);assert.ok(urls[2].endsWith('offset=10'));
  assert.equal(result.summary.email,undefined);assert.equal(result.posts[0].email,undefined);
});
test('repeating pages fail instead of doubling totals',async()=>{
  await assert.rejects(extractStats('test-only',{pause:async()=>{},fetcher:async url=>Response.json(url.includes('summary')?{subscribers:1}:{rows:Array.from({length:10},(_,i)=>({post_id:i}))})}),/repeated a page/);
});
test('year selection counts missing data separately and weights only paired metrics',()=>{
  const d=yearStats([{post_id:1,post_date:'2026-02-01',delivered:100,opens:10},{post_id:2,post_date:'2026-02-02',delivered:10,opens:5},{post_id:3,post_date:'2026-02-03',delivered:100},{post_id:4,post_date:'2025-02-01',delivered:500,opens:400}],2026);
  assert.equal(d.posts.length,3);assert.equal(d.delivered,210);assert.equal(d.opens,15);assert.equal(d.openRate,15/110);assert.equal(d.downloads,null);assert.equal(d.coverage.opens,2);
});
test('analytics auth requires an actual signed session',()=>{
  process.env.SESSION_SECRET='test-secret';
  assert.equal(requireAuth(new Request('https://example.com'),{allowOpen:false}).status,401);
  const cookie=mintCookie('test-secret').split(';')[0];
  assert.equal(requireAuth(new Request('https://example.com',{headers:{cookie}}),{allowOpen:false}),null);
});
