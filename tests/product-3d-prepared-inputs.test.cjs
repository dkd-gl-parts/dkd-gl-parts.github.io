const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto').webcrypto;
const source = fs.readFileSync(require('node:path').join(__dirname,'../product-3d-prepared-inputs.js'),'utf8');
class Element {
  constructor(){this.children=[];this.listeners={};this.hidden=false;this.value='';this.files=[];}
  set textContent(value){this.text=value;this.children=[];} get textContent(){return this.text||'';}
  appendChild(node){this.children.push(node);}
  addEventListener(name,fn){this.listeners[name]=fn;}
  async click(){await this.listeners.click?.();}
}
async function fixture({ready=false,storageFailure=false,deferred=false,workerFailure=false,workerStalled=false,badSource=false}={}) {
  const nodes=Object.fromEntries(['status','gallery','check','file','upload','auto','manual'].map(name=>[name,new Element()]));
  const root=new Element();root.querySelector=selector=>nodes[selector.match(/prepared-(\w+)/)[1]];
  const window={};const ctx={window,document:{createElement:()=>new Element()},crypto,Uint8Array,ArrayBuffer,URL,Set,Map,Array,Number,Error,
    File,AbortController,setTimeout,clearTimeout,setInterval,clearInterval};
  vm.runInNewContext(source,ctx);
  const api=window.DcatsPreparedInputs;
  const files=Array.from({length:4},(_,i)=>({name:'not-a-binding-'+i+'.jpg',type:'image/jpeg',size:20,
    async arrayBuffer(){return new Uint8Array(20).fill(i+1).buffer;}}));
  const images=await Promise.all(['front','left','back','right'].map(async(view,i)=>({
    view,id:[171,175,179,172][i],rotation_clockwise:[0,270,0,90][i],sha256:await api.digest(await files[i].arrayBuffer()),
    bytes:20,width:3,height:2,stored:ready,
  })));
  const plan={product_id:2639,product_kind:'aftermarket_new',plan_id:'test-plan',plan_sha256:'a'.repeat(64),
    ready,generation_allowed:false,preparation_mode:'browser',images};
  const target={productId:2639,kind:'aftermarket_new'};
  const events=[];let current=true,resolveDeferred;
  ctx.Worker=class {
    constructor(){this.stopped=false;}
    terminate(){this.stopped=true;events.push('worker-stop');}
    postMessage(input){events.push('worker-start');if(workerStalled)return;
      queueMicrotask(()=>{if(!this.stopped)this.onmessage({data:workerFailure?{ok:false}:{ok:true,bytes:input.bytes}});});}
  };
  ctx.fetch=async url=>{
    events.push('source-download');const image=images.find(i=>url.includes('/'+i.view+'.jpg'));
    return new Response(await files[images.indexOf(image)].arrayBuffer(),{headers:{'content-type':'image/jpeg'}});
  };
  const controller=api.create(root);
  const options={target,isCurrent:()=>current,async invoke(action,body){
    events.push(action);
    if(deferred&&action==='input_plan') return new Promise(resolve=>{resolveDeferred=resolve;});
    if(action==='input_plan')return plan;
    if(action==='input_sources')return {...plan,ready:false,images:images.map(i=>({...i,stored:false,
      source_url:(badSource?'https://evil.invalid':'https://jqoeqximtwfpqwzngutj.supabase.co')+'/storage/v1/object/sign/product-images/dkd_2639/aftermarket_new/'+i.view+'.jpg',
      source_bytes:i.bytes,source_sha256:i.sha256}))};
    if(action==='input_preview')return {...plan,images:images.map(i=>({...i,
      preview_url:`https://jqoeqximtwfpqwzngutj.supabase.co/storage/v1/object/sign/product-3d/tripo-input-review/${i.view}.jpg?token=synthetic`}))};
    assert.equal(action,'input_upload');assert.equal(body.plan_sha256,plan.plan_sha256);
    const image=images.find(i=>i.view===body.view);
    return {plan_sha256:plan.plan_sha256,already_present:false,bucket:'product-3d',
      path:`tripo-input-review/dkd_2639/aftermarket_new/test-plan/${image.view}-${image.id}-${image.sha256}.jpg`,
      token:'synthetic',bytes:image.bytes,sha256:image.sha256,content_type:'image/jpeg'};
  },storage:{from(bucket){assert.equal(bucket,'product-3d');return {async uploadToSignedUrl(path,token,file,config){
    events.push('storage-upload');assert.equal(config.contentType,'image/jpeg');assert.equal('upsert' in config,false);
    const input=images.find(i=>path.includes('/'+i.view+'-'));assert.equal(await api.digest(await file.arrayBuffer()),input.sha256);
    if(storageFailure)return {error:{message:'unconfirmed-secret-detail'}};
    input.stored=true;plan.ready=images.every(i=>i.stored);return {error:null};
  }};}}};
  controller.open(options);
  return {api,plan,files,nodes,root,events,controller,options,
    setCurrent(value){current=value;},resolve(value){resolveDeferred(value);}};
}
test('only exact prepared target can expose the panel, without any automatic provider or Storage access',async()=>{
  const f=await fixture();assert.equal(f.root.hidden,false);assert.deepEqual(f.events,[]);
  for(const target of [{productId:2640,kind:'aftermarket_new'},{productId:2639,kind:'rebuilt'}]){
    f.controller.open({...f.options,target});assert.equal(f.root.hidden,true);
  }
  f.controller.open({...f.options,isCurrent:()=>false});assert.equal(f.root.hidden,true);
});
test('plan validation refuses paid capability, wrong target, duplicates, oversized and incomplete ready claims',async()=>{
  const f=await fixture();assert.equal(f.api.validPlan(f.plan,f.options.target),true);
  for(const change of [p=>p.generation_allowed=true,p=>p.product_id=2640,p=>p.ready=true,
    p=>p.images[0].bytes=21000000,p=>p.images[1].id=p.images[0].id,p=>p.images[0].view='top']){
    const p=structuredClone(f.plan);change(p);assert.equal(f.api.validPlan(p,f.options.target),false);
  }
});
test('verified preview displays all stored actual image URLs, not CSS rotated originals',async()=>{
  const f=await fixture({ready:true});await f.nodes.check.click();
  assert.deepEqual(f.events,['input_plan','input_preview']);assert.equal(f.nodes.gallery.children.length,4);
  assert.ok(f.nodes.gallery.children.every(figure=>figure.children[1].src.includes('tripo-input-review')));
  assert.match(f.nodes.status.textContent,/有料再生成はまだ開始できません/);
});
test('file names are not trusted; all four exact content hashes are matched before any upload',async()=>{
  const f=await fixture();await f.nodes.check.click();f.nodes.file.files=f.files.slice().reverse();await f.nodes.upload.click();
  assert.equal(f.events.filter(e=>e==='storage-upload').length,4);assert.equal(f.events.filter(e=>e==='input_upload').length,4);
  assert.equal(f.plan.ready,true);assert.match(f.nodes.status.textContent,/4枚の実ファイル/);
  assert.equal(f.events.some(e=>['start','quote','publish','reject'].includes(e)),false);
});
test('incorrect files or duplicate content stop before upload grants and any transmission',async()=>{
  for(const change of [f=>f.nodes.file.files=[...f.files.slice(0,3),f.files[0]],
    f=>f.nodes.file.files=[...f.files.slice(0,3),{...f.files[3],async arrayBuffer(){return new Uint8Array(20).fill(77).buffer;}}]]){
    const f=await fixture();await f.nodes.check.click();change(f);await f.nodes.upload.click();
    assert.deepEqual(f.events,['input_plan']);assert.match(f.nodes.status.textContent,/登録を停止/);
  }
});
test('lost upload acknowledgement stops immediately with no retry or cleanup',async()=>{
  const f=await fixture({storageFailure:true});await f.nodes.check.click();f.nodes.file.files=f.files;await f.nodes.upload.click();
  assert.deepEqual(f.events,['input_plan','input_upload','storage-upload']);
  assert.match(f.nodes.status.textContent,/部分登録は保持/);assert.doesNotMatch(f.nodes.status.textContent,/secret/);
});
test('close and changed role/product suppress late previews and clear private URLs',async()=>{
  const f=await fixture({deferred:true});const pending=f.nodes.check.click();f.controller.close();f.resolve(f.plan);await pending;
  assert.equal(f.root.hidden,true);assert.equal(f.nodes.gallery.children.length,0);
  const g=await fixture({deferred:true});const delayed=g.nodes.check.click();g.setCurrent(false);g.resolve(g.plan);await delayed;
  assert.equal(g.nodes.gallery.children.length,0);
});
test('one click prepares sequentially and verifies all four outputs before any upload grant',async()=>{
  const f=await fixture();await f.nodes.auto.click();
  assert.equal(f.events.filter(e=>e==='worker-start').length,4);
  assert.equal(f.events.filter(e=>e==='worker-stop').length,4);
  const grant=f.events.indexOf('input_upload');assert.ok(grant>f.events.lastIndexOf('worker-start'));
  assert.equal(f.events.filter(e=>e==='storage-upload').length,4);
  assert.equal(f.plan.ready,true);assert.equal(f.events.includes('start'),false);
});
test('source URL or Worker failure cannot create any upload capability',async()=>{
  for(const config of [{badSource:true},{workerFailure:true}]){
    const f=await fixture(config);await f.nodes.auto.click();
    assert.equal(f.events.includes('input_upload'),false);assert.equal(f.events.includes('storage-upload'),false);
    assert.match(f.nodes.status.textContent,/画像準備を停止/);
  }
});
test('closing during preparation terminates the worker without registration or stale text',async()=>{
  const f=await fixture({workerStalled:true});const pending=f.nodes.auto.click();
  for(let i=0;i<30&&!f.events.includes('worker-start');i++)await new Promise(setImmediate);
  assert.equal(f.events.includes('worker-start'),true);f.controller.close();await pending;
  assert.equal(f.events.includes('worker-stop'),true);assert.equal(f.root.hidden,true);
  assert.equal(f.events.includes('input_upload'),false);assert.equal(f.nodes.status.textContent,'');
});
test('permission loss while worker is stalled cancels it and hides the private panel',async()=>{
  const f=await fixture({workerStalled:true});const pending=f.nodes.auto.click();
  for(let i=0;i<30&&!f.events.includes('worker-start');i++)await new Promise(setImmediate);
  f.setCurrent(false);await pending;
  assert.equal(f.events.includes('worker-stop'),true);assert.equal(f.root.hidden,true);assert.equal(f.events.includes('input_upload'),false);
});
test('ready browser inputs are read back rather than prepared or transmitted again',async()=>{
  const f=await fixture({ready:true});await f.nodes.auto.click();
  assert.equal(f.events.includes('source-download'),false);assert.equal(f.events.includes('input_upload'),false);
  assert.equal(f.events.includes('input_preview'),true);
});
test('manual fallback remains opt-in and never invokes a preparation worker',async()=>{
  const f=await fixture();await f.nodes.manual.click();f.nodes.file.files=f.files;await f.nodes.upload.click();
  assert.equal(f.events.includes('worker-start'),false);assert.equal(f.events.filter(e=>e==='storage-upload').length,4);
});
