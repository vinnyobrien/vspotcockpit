import crypto from 'node:crypto';

export const MAX_RECEIPT_BYTES = 3 * 1024 * 1024;
export const CATEGORIES = [
  ['software','Software & subscriptions','143'], ['advertising','Advertising & marketing','143'],
  ['professional','Accountant & professional fees','137'], ['contractors','Freelancers & production','136'],
  ['travel','Business travel & subsistence','138'], ['motor','Motor expenses','138'],
  ['phone','Phone & internet','143'], ['rent','Workspace rent','140'],
  ['repairs','Repairs & maintenance','139'], ['insurance','Business insurance','143'],
  ['office','Office supplies & other costs','143'], ['entertainment','Entertainment — tax review','143'],
  ['asset','Equipment / capital asset',null], ['personal','Personal / drawings',null],
  ['unclassified','Needs classification',null],
].map(([code,label,form11Box])=>({code,label,form11Box,mappingYear:2025}));

export function receiptMime(bytes) {
  if(bytes.subarray(0,5).toString()==='%PDF-') return 'application/pdf';
  if(bytes[0]===0xff && bytes[1]===0xd8 && bytes[2]===0xff) return 'image/jpeg';
  if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'image/png';
  if(bytes.subarray(0,4).toString()==='RIFF' && bytes.subarray(8,12).toString()==='WEBP') return 'image/webp';
  return null;
}
export function captureMetadata(file,bytes,form,now=new Date()) {
  if(!bytes.length || bytes.length>MAX_RECEIPT_BYTES) throw new Error('Use a receipt under 3 MB.');
  const mime=receiptMime(bytes);
  if(!mime) throw new Error('Use a JPG, PNG, WebP or PDF receipt.');
  const category=String(form.get('category') || 'unclassified');
  if(!CATEGORIES.some(c=>c.code===category)) throw new Error('Choose a valid expense category.');
  const purpose=String(form.get('purpose') || '').trim();
  if(purpose.length>400) throw new Error('Keep the business purpose under 400 characters.');
  const share=Number(form.get('businessPercent') ?? 100);
  if(!Number.isFinite(share)||share<0||share>100) throw new Error('Business use must be between 0 and 100%.');
  return {id:crypto.createHash('sha256').update(bytes).digest('hex'),
    filename:String(file.name || 'receipt').replace(/[\r\n\x00-\x1f]/g,'').slice(0,180),
    mime,size:bytes.length,capturedAt:now.toISOString(),owner:'Vinny O’Brien',
    entity:'Irish sole trader',category,purpose,businessPercent:share,reviewState:'unreviewed'};
}
export function wranglerConfig(env=process.env) {
  const keys=['RECEIPT_WRANGLER_URL','RECEIPT_WRANGLER_API_KEY','RECEIPT_WRANGLER_GROUP_ID','RECEIPT_WRANGLER_PAID_BY_USER_ID'];
  const missing=keys.filter(k=>!env[k]);
  if(missing.length)return {configured:false,missing};
  try {
    const url=new URL(env.RECEIPT_WRANGLER_URL);
    if(url.protocol!=='https:' || url.username || url.password || url.search || url.hash)throw new Error();
    if(![env.RECEIPT_WRANGLER_GROUP_ID,env.RECEIPT_WRANGLER_PAID_BY_USER_ID].every(v=>/^[1-9]\d*$/.test(v)))throw new Error();
    return {configured:true,url:url.toString().replace(/\/$/,''),key:env.RECEIPT_WRANGLER_API_KEY,
      group:env.RECEIPT_WRANGLER_GROUP_ID,paidBy:env.RECEIPT_WRANGLER_PAID_BY_USER_ID};
  }catch{return {configured:false,missing:['Valid HTTPS Receipt Wrangler URL and positive group/user IDs']};}
}
export async function deliverReceipt(store,id,config,fetcher=fetch) {
  if(!config.configured)return {status:'not_connected'};
  const original=await store.getWithMetadata('documents/'+id,{type:'arrayBuffer'});
  if(!original)return {status:'not_found'};
  // An immutable attempt marker prevents concurrent/double sends. Never retry an
  // ambiguous delivery: quickScan has no documented idempotency key.
  const claim=await store.setJSON('attempts/'+id,{at:new Date().toISOString()},{onlyIfNew:true});
  if(!claim.modified)return await store.get('delivery/'+id,{type:'json'}) || {status:'unknown',message:'Delivery already attempted. Check Receipt Wrangler before sending again.'};
  const m=original.metadata,form=new FormData();
  form.append('files',new Blob([original.data],{type:m.mime}),m.filename);
  form.append('groupIds',config.group);form.append('paidByUserIds',config.paidBy);form.append('statuses','DRAFT');
  form.append('comments',`Cockpit ${id}; category: ${m.category}; business use: ${m.businessPercent}%; ${m.purpose}`.slice(0,500));
  let result;
  try {
    const response=await fetcher(config.url+'/api/receipt/quickScan',{method:'POST',headers:{Authorization:config.key},body:form,redirect:'error',signal:AbortSignal.timeout(20000)});
    result=response.ok?{status:'accepted',message:'Accepted for scanning. Review extraction and tax treatment in Receipt Wrangler.'}:
      {status:'attention',httpStatus:response.status,message:'Receipt Wrangler did not confirm acceptance. Check its processing queue before resending.'};
  }catch{result={status:'unknown',message:'No delivery confirmation. Check Receipt Wrangler before resending.'};}
  result.at=new Date().toISOString();
  await store.setJSON('delivery/'+id,result,{onlyIfNew:true});
  return result;
}
