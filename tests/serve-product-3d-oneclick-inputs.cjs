// Isolated loopback visual QA: originals are read-only, uploads live only in
// browser memory. No credentials, live Supabase, provider or external network.
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),sourceDir=fs.realpathSync(process.argv[2]);
if(path.basename(sourceDir)!=='end-face-inputs-20261007')throw Error('Unexpected source scope');
const manifest=JSON.parse(fs.readFileSync(process.argv[3],'utf8')),approved=manifest.plan;
if(approved.id!=='end-face-2639-20261007-browser-v2'||approved.product_id!==2639)throw Error('Unexpected reviewed plan');
const originals=new Map();
for(const i of approved.inputs){
  const name=fs.realpathSync(path.join(sourceDir,'image-'+i.id+'.jpg'));
  if(path.dirname(name)!==sourceDir)throw Error('Source escaped scope');
  const bytes=fs.readFileSync(name);
  if(bytes.length!==i.source_bytes||crypto.createHash('sha256').update(bytes).digest('hex')!==i.source_sha256)throw Error('Source changed');
  originals.set('/original/'+i.id+'.jpg',bytes);
}
const page=fs.readFileSync(path.join(root,'index.html'),'utf8'),start=page.indexOf('<section class="product-3d-prepared-inputs"');
const markup=page.slice(start,page.indexOf('</section>',start)+10);
const shared=fs.readFileSync(path.join(root,'product-3d.js'),'utf8');
const sharedInvoke=shared.slice(shared.indexOf('  async function tripoInvoke(payload)'),shared.indexOf('  function tripoPayload(action)'));
const plan={product_id:2639,product_kind:'aftermarket_new',plan_id:approved.id,plan_sha256:manifest.plan_sha256,
  generation_allowed:false,preparation_mode:'browser',ready:false,images:approved.inputs.map(i=>({...i,stored:false}))};
const fixture=`
const initial=${JSON.stringify(plan)},events=[],saved=new Map(),params=new URLSearchParams(location.search);
const nativeFetch=window.fetch.bind(window),imageSrc=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');
Object.defineProperty(HTMLImageElement.prototype,'src',{...imageSrc,set(value){
  if(String(value).startsWith('https://jqoeqximtwfpqwzngutj.supabase.co/')){
    const view=new URL(value).searchParams.get('view'),photo=saved.get(view);if(!photo)throw Error('Missing local preview');
    return imageSrc.set.call(this,URL.createObjectURL(photo));
  }return imageSrc.set.call(this,value);
}});
window.fetch=(value,options)=>{
  const url=new URL(value,location.href);
  if(url.hostname==='jqoeqximtwfpqwzngutj.supabase.co'){
    const image=initial.images.find(i=>url.pathname.endsWith(i.source_path));
    if(!image)throw Error('Unknown isolated source');
    events.push('source:'+image.id);return nativeFetch('/original/'+image.id+'.jpg',options);
  }
  if(url.origin!==location.origin)throw Error('External network prohibited');
  return nativeFetch(value,options);
};
function currentPlan(){const images=initial.images.map(i=>({...i,stored:saved.has(i.view)}));return {...initial,images,ready:images.every(i=>i.stored)};}
const controller=DcatsPreparedInputs.create(document.querySelector('#product-3d-prepared-inputs'));
const options={target:{productId:2639,kind:'aftermarket_new'},isCurrent:()=>params.get('role')!=='staff',
 async invoke(action,body){events.push(action);if(params.get('mode')==='error')throw Error('Synthetic unavailable');
   if(action==='prepared_latest')return {status:'none',start_allowed:false,publish_allowed:false,reject_allowed:false};
   if(action==='input_plan')return currentPlan();
   if(body.plan_sha256!==initial.plan_sha256)throw Error('Stale plan');
   if(action==='input_sources')return {...currentPlan(),images:initial.images.map(i=>({...i,
     source_url:'https://jqoeqximtwfpqwzngutj.supabase.co/storage/v1/object/sign/product-images/'+i.source_path+'?token=synthetic'}))};
   if(action==='input_upload'){
     const image=initial.images.find(i=>i.view===body.view);if(!image)throw Error('Unexpected view');
     return {plan_sha256:initial.plan_sha256,already_present:saved.has(image.view),bucket:'product-3d',
       path:'tripo-input-review/dkd_2639/aftermarket_new/'+initial.plan_id+'/'+image.view+'-'+image.id+'-'+image.sha256+'.jpg',
       token:'synthetic',sha256:image.sha256,bytes:image.bytes,content_type:'image/jpeg'};
   }
   if(['input_preview','input_check','prepared_quote'].includes(action)){
     const preview={...currentPlan(),images:currentPlan().images.map(i=>({...i,
       preview_url:'https://jqoeqximtwfpqwzngutj.supabase.co/storage/v1/object/sign/product-3d/tripo-input-review/'+i.view+'.jpg?view='+i.view}))};
     if(action==='input_preview')return preview;
     const balance=Number(params.get('balance')||70);
     return {...preview,request_key:'5e123f39-434b-4ac7-816c-ff7ea12b3290',estimated_credits:30,balance,
       balance_sufficient:balance>=30,can_start:false,blocked_reason:'prepared_paid_approval_required',checked_at:new Date().toISOString()};
   }
   throw Error('Paid or unknown action prohibited');
 },storage:{from(bucket){if(bucket!=='product-3d')throw Error('Wrong bucket');return {
   async uploadToSignedUrl(p,token,file){
     const bytes=await file.arrayBuffer(),hash=await DcatsPreparedInputs.digest(bytes);
     const image=initial.images.find(i=>i.sha256===hash&&i.bytes===bytes.byteLength&&p.endsWith(i.sha256+'.jpg'));
     if(token!=='synthetic'||!image)throw Error('Output not verified');saved.set(image.view,file);events.push('verified-upload:'+image.view);
     document.querySelector('#fixture-evidence').textContent=JSON.stringify({events,verified:saved.size,external_calls:0});
     return {error:null};
   }};}}};
const route=options.invoke,sb={functions:{async invoke(name,{body}){
  if(name!=='product-3d-tripo')throw Error('Unknown fixture function');
  return {data:await route(body.action,body),error:null};
}}},edgeErrorMessage=async()=> 'Synthetic unavailable';
${sharedInvoke}
options.invoke=(action,body)=>tripoInvoke({action,product_id:2639,product_kind:'aftermarket_new',...body});
controller.open(options);
document.querySelector('#close-fixture').addEventListener('click',()=>controller.close());
`;
const html=`<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>保存済み実写真・非課金整列QA</title><link rel="stylesheet" href="/styles.css"><body><main class="product-3d-tripo-body">
<h2>商品2639・実写真のローカル試験（本番登録なし）</h2>${markup}<button id="close-fixture">閉じる</button>
<output id="fixture-evidence" hidden></output></main><script src="/product-3d-prepared-inputs.js"></script><script type="module" src="/fixture.js"></script></body></html>`;
const csp=fs.readFileSync(path.join(root,'_headers'),'utf8').match(/Content-Security-Policy:\s*([^\r\n]+)/)[1].replace(/; upgrade-insecure-requests\s*$/,'');
const assetNames=new Set(['/styles.css','/product-3d-prepared-inputs.js','/product-3d-input-worker.mjs',
 ...fs.readdirSync(path.join(root,'vendor/product3d-inputs')).filter(n=>/\.(mjs|wasm)$/.test(n)).map(n=>'/vendor/product3d-inputs/'+n)]);
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');let content,type;
 if(url.pathname==='/'){content=html;type='text/html';}
 else if(url.pathname==='/fixture.js'){content=fixture;type='text/javascript';}
 else if(originals.has(url.pathname)){content=originals.get(url.pathname);type='image/jpeg';}
 else if(assetNames.has(url.pathname)){content=fs.readFileSync(path.join(root,url.pathname.slice(1)));
   type=url.pathname.endsWith('.wasm')?'application/wasm':url.pathname.endsWith('.css')?'text/css':'text/javascript';}
 else{res.writeHead(404);res.end();return;}
 res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store','Content-Security-Policy':csp});res.end(content);
});
server.listen(0,'127.0.0.1',()=>process.stdout.write('http://127.0.0.1:'+server.address().port+'/\n'));
