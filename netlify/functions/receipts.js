import {getStore} from '@netlify/blobs';
import {requireAuth,json} from './_auth.js';
import {CATEGORIES,MAX_RECEIPT_BYTES,captureMetadata,wranglerConfig,deliverReceipt} from './_receipt-capture.js';

export function createReceiptHandler({getStoreImpl=getStore,env=process.env}={}) {
return async function(req) {
  const denied=requireAuth(req,{allowOpen:false});if(denied)return denied;
  const url=new URL(req.url);
  if(!['GET','POST'].includes(req.method))return json({error:'Method not allowed'},405,{allow:'GET, POST'});
  if(req.method==='POST' && req.headers.get('origin')!==url.origin)return json({error:'Use the cockpit upload form.'},403);
  const context=env.CONTEXT==='production'?'production':`preview-${env.DEPLOY_ID || 'local'}`;
  const store=getStoreImpl({name:'finance-capture-'+context,consistency:'strong'}),config=wranglerConfig(env);
  try {
    if(req.method==='GET') {
      const id=url.searchParams.get('file');
      if(id) {
        if(!/^[a-f0-9]{64}$/.test(id))return json({error:'Invalid receipt'},400);
        const doc=await store.getWithMetadata('documents/'+id,{type:'arrayBuffer'});
        if(!doc)return json({error:'Receipt not found'},404);
        const filename=encodeURIComponent(doc.metadata.filename).replace(/'/g,'%27');
        return new Response(doc.data,{headers:{'content-type':doc.metadata.mime,'cache-control':'no-store',
          'content-disposition':`attachment; filename*=UTF-8''${filename}`,'x-content-type-options':'nosniff'}});
      }
      const receipts=[];
      for await(const page of store.list({prefix:'documents/',paginate:true})) {
        for(const entry of page.blobs) {
          const info=await store.getMetadata(entry.key);
          if(!info)continue;
          const m=info.metadata;
          const delivery=await store.get('delivery/'+m.id,{type:'json'});
          const attempted=!delivery && await store.get('attempts/'+m.id,{type:'json'});
          receipts.push({...m,delivery:delivery || (attempted?{status:'unknown',message:'Delivery attempted; check Receipt Wrangler.'}:{status:'saved'})});
        }
      }
      receipts.sort((a,b)=>b.capturedAt.localeCompare(a.capturedAt));
      return json({receipts,categories:CATEGORIES,wrangler:{configured:config.configured,url:config.url || null,missing:config.missing || []}});
    }
    if(url.searchParams.get('action')==='deliver') {
      const {id}=await req.json();if(!/^[a-f0-9]{64}$/.test(id || ''))return json({error:'Invalid receipt'},400);
      if(!config.configured)return json({error:'Receipt Wrangler is not connected.'},503);
      const delivery=await deliverReceipt(store,id,config);
      return delivery.status==='not_found'?json({error:'Receipt not found'},404):json({delivery});
    }
    const size=Number(req.headers.get('content-length'));
    if(size>MAX_RECEIPT_BYTES+65536)return json({error:'Use a receipt under 3 MB.'},413);
    const form=await req.formData(),file=form.get('file');
    if(!file || typeof file.arrayBuffer!=='function')return json({error:'Choose a receipt file.'},400);
    if(file.size>MAX_RECEIPT_BYTES)return json({error:'Use a receipt under 3 MB.'},413);
    const bytes=Buffer.from(await file.arrayBuffer());
    let m;try{m=captureMetadata(file,bytes,form);}catch(e){return json({error:e.message},400);}
    const saved=await store.set('documents/'+m.id,bytes,{metadata:m,onlyIfNew:true});
    // Saving and forwarding are separate deliberate actions. A failed scan
    // never loses an original and never creates an approved expense.
    return json({id:m.id,duplicate:!saved.modified,status:'saved'},saved.modified?201:200);
  }catch{return json({error:'Receipt service could not finish this request. Your previously saved receipts remain available.'},503);}
};
}
export default createReceiptHandler();
