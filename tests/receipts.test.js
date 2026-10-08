import test from 'node:test';
import assert from 'node:assert/strict';
import {captureMetadata,wranglerConfig,deliverReceipt,MAX_RECEIPT_BYTES} from '../netlify/functions/_receipt-capture.js';
import {requireAuth,mintCookie} from '../netlify/functions/_auth.js';
import {createReceiptHandler} from '../netlify/functions/receipts.js';

const pdf=Buffer.from('%PDF-1.7\nfixture'),form=new FormData();
test('receipt validation uses contents, preserves notes and produces stable duplicate IDs',()=>{
  form.set('category','travel');form.set('purpose','Sponsor meeting');form.set('businessPercent','70');
  const a=captureMetadata({name:'train.pdf'},pdf,form),b=captureMetadata({name:'renamed.pdf'},pdf,form);
  assert.equal(a.id,b.id);assert.equal(a.mime,'application/pdf');assert.equal(a.businessPercent,70);assert.equal(a.reviewState,'unreviewed');
  assert.throws(()=>captureMetadata({name:'fake.jpg'},Buffer.from('<script>evil</script>'),form));
  assert.throws(()=>captureMetadata({name:'huge.pdf'},Buffer.alloc(MAX_RECEIPT_BYTES+1),form));
  form.set('businessPercent','101');assert.throws(()=>captureMetadata({name:'x'},pdf,form));form.set('businessPercent','70');
});
test('finance always requires a signed session',()=>{
  const saved=process.env.SESSION_SECRET;process.env.SESSION_SECRET='test-secret';
  try{assert.equal(requireAuth(new Request('https://test/api/receipts'),{allowOpen:false}).status,401);
  assert.equal(requireAuth(new Request('https://test/api/receipts',{headers:{cookie:mintCookie('test-secret').split(';')[0]}}),{allowOpen:false}),null);}finally{if(saved===undefined)delete process.env.SESSION_SECRET;else process.env.SESSION_SECRET=saved;}
});
test('Receipt Wrangler settings do not assume a server or expose a malformed URL',()=>{
  assert.equal(wranglerConfig({}).configured,false);
  assert.equal(wranglerConfig({RECEIPT_WRANGLER_URL:'http://unsafe',RECEIPT_WRANGLER_API_KEY:'secret',RECEIPT_WRANGLER_GROUP_ID:'1',RECEIPT_WRANGLER_PAID_BY_USER_ID:'1'}).configured,false);
});
function fakeStore(){const items=new Map();const m=captureMetadata({name:'train.pdf'},pdf,form);return {m,items,
  getWithMetadata:async()=>({data:pdf,metadata:m}),get:async key=>items.get(key)||null,
  setJSON:async(key,value,{onlyIfNew}={})=>{if(onlyIfNew&&items.has(key))return {modified:false};items.set(key,value);return {modified:true};}};}
const config={configured:true,url:'https://receipts.example',key:'v1.secret',group:'1',paidBy:'2'};
test('concurrent delivery is sent once with API-key auth and DRAFT status',async()=>{
  const s=fakeStore();let count=0;
  const fetcher=async(url,init)=>{count++;assert.equal(url,'https://receipts.example/api/receipt/quickScan');assert.equal(init.headers.Authorization,'v1.secret');assert.equal(init.body.get('statuses'),'DRAFT');assert.equal(init.body.get('groupIds'),'1');assert.equal(init.body.get('files').name,'train.pdf');return new Response('',{status:200});};
  await Promise.all([deliverReceipt(s,s.m.id,config,fetcher),deliverReceipt(s,s.m.id,config,fetcher)]);
  assert.equal(count,1);assert.equal(s.items.get('delivery/'+s.m.id).status,'accepted');
});
test('ambiguous and rejected scans keep the original and never retry automatically',async()=>{
  for(const fetcher of [async()=>{throw Error('timeout');},async()=>new Response('',{status:503})]){
    const s=fakeStore();const r=await deliverReceipt(s,s.m.id,config,fetcher);assert.ok(['unknown','attention'].includes(r.status));
    let sent=false;await deliverReceipt(s,s.m.id,config,async()=>{sent=true;});assert.equal(sent,false);
  }
});
test('HTTP upload, duplicate, paginated list and private original download',async()=>{
  const previous=process.env.SESSION_SECRET;process.env.SESSION_SECRET='http-test';
  const headers={cookie:mintCookie('http-test').split(';')[0],origin:'https://cockpit.example'};
  const docs=new Map();let selectedStore;
  const store={
    set:async(key,data,{metadata,onlyIfNew})=>{if(onlyIfNew&&docs.has(key))return {modified:false};docs.set(key,{data,metadata});return {modified:true};},
    getWithMetadata:async key=>docs.get(key)||null,getMetadata:async key=>({metadata:docs.get(key).metadata}),get:async()=>null,
    list:async function*(){for(const key of docs.keys())yield {blobs:[{key}]};},
  };
  const handler=createReceiptHandler({getStoreImpl:settings=>{selectedStore=settings.name;return store;},env:{CONTEXT:'deploy-preview',DEPLOY_ID:'test-preview'}});
  try{
    assert.equal((await handler(new Request('https://cockpit.example/api/receipts'))).status,401);
    const body=new FormData();body.append('file',new Blob([pdf],{type:'application/pdf'}),'receipt.pdf');
    const cross=await handler(new Request('https://cockpit.example/api/receipts',{method:'POST',headers:{...headers,origin:'https://evil.example'},body}));assert.equal(cross.status,403);assert.equal(docs.size,0);
    const first=await handler(new Request('https://cockpit.example/api/receipts',{method:'POST',headers,body}));assert.equal(first.status,201);const {id}=await first.json();
    const repeated=await handler(new Request('https://cockpit.example/api/receipts',{method:'POST',headers,body}));assert.equal((await repeated.json()).duplicate,true);assert.equal(docs.size,1);
    const listing=await (await handler(new Request('https://cockpit.example/api/receipts',{headers}))).json();assert.equal(listing.receipts.length,1);assert.equal(listing.wrangler.configured,false);assert.equal(selectedStore,'finance-capture-preview-test-preview');
    const download=await handler(new Request('https://cockpit.example/api/receipts?file='+id,{headers}));assert.equal(await download.text(),pdf.toString());assert.equal(download.headers.get('cache-control'),'no-store');
    const bad=new FormData();bad.append('file',new Blob(['not an image']),'fake.jpg');assert.equal((await handler(new Request('https://cockpit.example/api/receipts',{method:'POST',headers,body:bad}))).status,400);
  }finally{if(previous===undefined)delete process.env.SESSION_SECRET;else process.env.SESSION_SECRET=previous;}
});
