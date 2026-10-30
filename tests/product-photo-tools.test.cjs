const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto');
const {parseHTML}=require('linkedom');
const acorn=require('acorn');
const path=require('node:path');
const root=path.join(__dirname,'..');
const source=fs.readFileSync(path.join(root,'product-photo-tools.js'),'utf8');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const nodes=acorn.parse(app,{ecmaVersion:'latest'}).body;
const declaration=nodes.find(n=>n.type==='FunctionDeclaration'&&n.id.name==='canUseProductPhotoTools');
const gate=app.slice(declaration.start,declaration.end);
const actor='00000000-0000-4000-8000-000000000001';
const product={dkd_shohin_id:1,genuine_part_number:'31400-58J10',manufacturer_part_number:'102211-5961',manufacturer:'DENSO'};
function setup(role='master_editor') {
  const {window,document}=parseHTML('<html><body><button id="before">before</button></body></html>');
  Object.defineProperty(window.HTMLSelectElement.prototype,'value',{configurable:true,get(){const option=this.querySelector('option[selected]')||this.querySelector('option');return option?option.value:'';},set(value){this.querySelectorAll('option').forEach(option=>{option.selected=option.value===String(value);});}});
  const calls=[],uploads=new Map(),receipts=new Map(),saved=[],revoked=[];let id=1,tick,stopCount=0;
  const context={window,document,console,Blob,Uint8Array,Map,Set,Promise,URL:{createObjectURL:()=>`blob:fixture-${id++}`,revokeObjectURL:u=>revoked.push(u)},crypto:crypto.webcrypto,
    userProfile:{id:actor,role_code:role},currentLang:'ja',setInterval:fn=>(tick=fn,1),clearInterval(){},setTimeout(){},
    isExternalViewer:()=>context.userProfile.role_code==='customer_viewer',isCustomerPortalSearchMode:()=>false,
    hasAccessRole:(p,rs)=>rs.includes(p.role_code),userPermissionAllowed:()=>true,
    navigator:{mediaDevices:{getUserMedia:async()=>({getTracks:()=>[{stop:()=>stopCount++}]})}},
    createImageBitmap:async()=>({width:1200,height:800,close(){}}),
    CustomEvent:window.CustomEvent,
    sb:{rpc:async(name,args)=>{
      calls.push([args.action,JSON.parse(JSON.stringify(args.payload))]);
      const p=args.payload;
      if(!['master_editor','dept_admin'].includes(context.userProfile.role_code))return {error:{code:'42501',message:'権限'}};
      if(context.fail&&context.fail(args.action,p))return context.fail(args.action,p);
      let data;
      if(args.action==='access')data={allowed:true,actor_id:actor};
      if(args.action==='search')data=[product];
      if(args.action==='images')data={product:{...product,dkd_shohin_id:p.product_id},variants:[],images:structuredClone(saved)};
      if(args.action==='upload')data={bucket:'product-images',path:'photo-tools/'+p.request_id+'.jpg',uploaded:uploads.has('photo-tools/'+p.request_id+'.jpg')};
      if(args.action==='register') {data={id:id++,revision:'a'.repeat(32),dkd_shohin_id:p.product_id,product_kind:p.product_kind,show_in_customer:p.show_in_customer,caption:p.caption,storage_path:'photo-tools/'+p.request_id+'.jpg',updated_at:new Date().toISOString(),sort_order:0};saved.push(data);receipts.set(p.request_id,data);}
      if(args.action==='receipt')data=receipts.has(p.request_id)?{saved:true,result:receipts.get(p.request_id)}:{saved:false};
      if(args.action==='cancel'){data=receipts.has(p.request_id)?{saved:true,result:receipts.get(p.request_id)}:{saved:false,cancelled:true};}
      if(args.action==='download')data=p.rows.map(r=>({id:r.id,path:saved.find(i=>i.id===r.id).storage_path,kind:'rebuilt'}));
      if(args.action==='update'){data=p.rows;saved.splice(0,saved.length,...structuredClone(data));receipts.set(p.request_id,data);}
      if(args.action==='delete'){data=p.rows.map(i=>i.id);for(const r of p.rows){const index=saved.findIndex(i=>i.id===r.id);if(index>=0)saved.splice(index,1);}receipts.set(p.request_id,data);}
      return {data};
    },storage:{from:()=>({upload:async(p,b)=>{uploads.set(p,b);return {data:{path:p}};},createSignedUrls:async paths=>({data:paths.map(p=>({path:p,signedUrl:'https://fixture.invalid/'+p}))}),download:async p=>({data:uploads.get(p)||new Blob(['photo'],{type:'image/jpeg'})})})}},
  };
  const session=new Map();window.sessionStorage={setItem:(k,v)=>session.set(k,v),getItem:k=>session.get(k)||null,removeItem:k=>session.delete(k)};
  window.confirm=()=>true;window.isSecureContext=true;window.fflate=require('../vendor/fflate-0.8.2.js');
  window.setTimeout=context.setTimeout;window.URL=context.URL;
  document.hasFocus=()=>true;document.contains=n=>!!n;
  const original=document.createElement.bind(document);
  document.createElement=function(tag){const n=original(tag);if(tag==='canvas'){n.getContext=()=>({fillRect(){},drawImage(){}});n.toBlob=cb=>cb(new Blob(['fixture'],{type:'image/jpeg'}));}return n;};
  vm.createContext(context);vm.runInContext(gate,context);
  // Expose only observations/helpers in the isolated synthetic VM, not in shipped code.
  const observed=source.replace('root.DcatsProductPhotoTools=Object.freeze','root.__test={get active(){return active;},addPhoto,register,mutate,download,receipt,cancelPending,finishUpload,selectProduct,startCamera,stopCamera,renderQueue,renderGallery,updateControls,safeName};\nroot.DcatsProductPhotoTools=Object.freeze');
  vm.runInContext(observed,context);
  return {context,window,document,calls,uploads,receipts,saved,revoked,test:window.__test,api:window.DcatsProductPhotoTools,tick:()=>tick&&tick(),stopCount:()=>stopCount};
}
function e(f,id){return f.document.getElementById('photo-tools-'+id);}
async function pending(f,kind='rebuilt') {
  await f.test.addPhoto(f.test.active,new Blob(['jpeg'],{type:'image/jpeg'}),'正面',{id:1,kind,origin:'sales',variant:null});
}
test('exact two manager roles and explicit image denial, no administrator bypass',()=>{
  for(const role of ['master_editor','dept_admin','system_admin','company_admin','sales_staff','production_editor','customer_viewer','shipping_staff','']){
    const f=setup(role);assert.equal(f.context.canUseProductPhotoTools(),['master_editor','dept_admin'].includes(role));
    f.context.userPermissionAllowed=()=>false;assert.equal(f.context.canUseProductPhotoTools(),false);
  }
});
test('default-hidden entry controls and no 3D reactivation',()=>{
  const {document}=parseHTML(html);
  for(const id of ['btn-image-action-photo-tools','btn-image-action-download','production-image-action-photo-tools','production-image-action-download'])assert.equal(document.getElementById(id).hidden,true);
  assert.match(fs.readFileSync(path.join(root,'product-photo-tools.css'),'utf8'),/\[data-product-photo-control\]\[hidden\]\s*\{\s*display:none!important/);
  assert.match(app,/PRODUCT_3D_DEVELOPMENT_PAUSED = true/);
  assert(!source.includes('DcatsProduct3D'));assert(!source.includes('getPublicUrl'));
});
test('unauthorized open does not mount or request a camera/service',async()=>{
  const f=setup('sales_staff');await f.api.open();assert.equal(f.test.active,null);assert.equal(f.calls.length,0);
});
test('authorized open, explicit product binding and default customer OFF',async()=>{
  const f=setup();await f.api.open(product);await pending(f);
  assert.equal(f.test.active.product.dkd_shohin_id,1);assert.equal(f.test.active.queue[0].publish,false);
  assert.equal(f.test.active.stream,null);assert.equal(f.calls.filter(c=>c[0]==='register').length,0);
  await f.test.register(f.test.active);assert.equal(f.saved.length,1);assert.equal(f.saved[0].show_in_customer,false);assert.equal(f.test.active.queue.length,0);
  f.api.forceClose();assert.equal(f.test.active,null);
});
test('multiple photos register once each, queue URLs are released',async()=>{
  const f=setup('dept_admin');await f.api.open(product,'production');await pending(f);await pending(f);
  await f.test.register(f.test.active);assert.equal(f.saved.length,2);assert.equal(f.calls.filter(c=>c[0]==='register').length,2);assert.equal(f.revoked.length,2);
});
test('CORE public flags remain disabled across selection/state updates',async()=>{
  const f=setup();await f.api.open(product);await pending(f,'used_core');f.test.updateControls();
  assert.equal(f.document.querySelector('[data-photo-queue-public]').disabled,true);assert.equal(f.test.active.queue[0].publish,false);
});
test('transport failure blocks changes and writes until read-only receipt',async()=>{
  const f=setup();await f.api.open(product);await pending(f);
  f.context.fail=a=>a==='register'?{error:{message:'transport unavailable'}}:null;
  await f.test.register(f.test.active);assert.equal(f.test.active.uncertain.action,'register');
  assert.equal(e(f,'receipt').hidden,false);
  const before=f.calls.filter(c=>c[0]==='register').length;await f.test.register(f.test.active);assert.equal(f.calls.filter(c=>c[0]==='register').length,before);
  f.context.fail=null;await f.test.receipt(f.test.active);assert.equal(f.test.active.uncertain.action,'register');assert.equal(f.test.active.queue[0].uploaded,true);
});
test('known validation failure is retained for correction, not auto-retried',async()=>{
  const f=setup();await f.api.open(product);await pending(f);f.context.fail=a=>a==='register'?{error:{message:'invalid',code:'22023'}}:null;
  await f.test.register(f.test.active);assert.equal(f.test.active.uncertain,null);assert.equal(f.test.active.queue.length,1);assert.equal(f.calls.filter(c=>c[0]==='register').length,1);
});
test('unknown upload outcome is checked before retry, no second upload',async()=>{
  const f=setup();await f.api.open(product);await pending(f);let uploads=0;
  f.context.sb.storage.from=()=>({upload:async(p,b)=>{uploads++;f.uploads.set(p,b);return {error:{message:'lost response'}};},createSignedUrls:async()=>({data:[]})});
  await f.test.register(f.test.active);assert.equal(f.test.active.uncertain.action,'upload');
  await f.test.receipt(f.test.active);assert.equal(f.test.active.queue[0].uploaded,true);
  await f.test.finishUpload(f.test.active);assert.equal(uploads,1);assert.equal(f.saved.length,1);
});
test('role/owner changes wipe pending photos and close the tool',async()=>{
  for(const change of ['role','owner']){
    const f=setup();await f.api.open(product);await pending(f);
    if(change==='role')f.context.userProfile.role_code='sales_staff';else f.context.userProfile.id=crypto.randomUUID();
    f.tick();assert.equal(f.test.active,null);assert.equal(f.document.querySelector('.product-photo-tools'),null);assert(f.revoked.length>0);
  }
});
test('late camera stream after close is stopped',async()=>{
  const f=setup();await f.api.open(product);let resolve;let stopped=0;
  f.context.navigator.mediaDevices.getUserMedia=()=>new Promise(r=>resolve=r);
  const promise=f.test.startCamera(f.test.active);f.api.forceClose();resolve({getTracks:()=>[{stop:()=>stopped++}]});await promise;assert.equal(stopped,1);
});
test('late product response cannot restore prior selection',async()=>{
  const f=setup();await f.api.open(product);const previous=f.context.sb.rpc;let resolve;
  f.context.sb.rpc=async(n,a)=>a.action==='images'&&a.payload.product_id===2?new Promise(r=>resolve=r):previous(n,a);
  const old=f.test.selectProduct(f.test.active,2);await f.test.selectProduct(f.test.active,1);
  resolve({data:{product:{...product,dkd_shohin_id:2},images:[],variants:[]}});await old;
  assert.equal(f.test.active.product.dkd_shohin_id,1);
});
test('filename sanitizer prevents path traversal and reserved characters',()=>{
  const f=setup();assert.equal(f.test.safeName('../test:photo?.jpg'),'.._test_photo_.jpg');assert.equal(f.test.safeName('...'),'photo');
});
test('registered image editing and atomic selected deletion use snapshot versions',async()=>{
  const f=setup();await f.api.open(product);await pending(f);await f.test.register(f.test.active);const image=f.saved[0];
  await f.test.mutate(f.test.active,'update',[{id:image.id,revision:image.revision,product_kind:'aftermarket_new',show_in_customer:false,caption:'背面',sort_order:3}]);
  const update=f.calls.find(c=>c[0]==='update');assert.equal(update[1].rows[0].revision,image.revision);
  const deletion=f.test.mutate(f.test.active,'delete',[{id:image.id,revision:image.revision}]);f.document.querySelector('[data-photo-confirm="yes"]').click();await deletion;assert.equal(f.saved.length,0);
});
test('force close preserves an actor-bound pending operation and original product',async()=>{
  const f=setup();await f.api.open(product);await pending(f);f.context.fail=a=>a==='register'?{error:{message:'transport unavailable'}}:null;
  await f.test.register(f.test.active);const request=f.test.active.uncertain.payload.request_id;
  f.api.forceClose();f.context.fail=null;await f.api.open({...product,dkd_shohin_id:2});
  assert.equal(f.test.active.product.dkd_shohin_id,1);assert.equal(f.test.active.uncertain.payload.request_id,request);
  await f.test.receipt(f.test.active);assert.equal(f.test.active.uncertain.payload.request_id,request);
  const cancellation=f.test.cancelPending(f.test.active);f.document.querySelector('[data-photo-confirm="yes"]').click();await cancellation;assert.equal(f.test.active.uncertain,null);
  assert.equal(f.calls.filter(c=>c[0]==='register').length,1);
});
test('unknown upload absence stays unresolved; closing does not lose recovery',async()=>{
  const f=setup();await f.api.open(product);await pending(f);
  f.context.sb.storage.from=()=>({upload:async()=>({error:{message:'transport'}}),createSignedUrls:async()=>({data:[]})});
  await f.test.register(f.test.active);await f.test.receipt(f.test.active);
  assert.equal(f.test.active.uncertain.action,'upload');assert.equal(e(f,'finish-upload').hidden,true);
  const request=f.test.active.uncertain.payload.request_id;f.api.forceClose();await f.api.open(product);
  assert.equal(f.test.active.uncertain.payload.request_id,request);
});
test('storage refusal prevents mutation or file transmission',async()=>{
  const f=setup();await f.api.open(product);await pending(f);
  f.window.sessionStorage.setItem=()=>{throw Error('denied');};await f.test.register(f.test.active);
  assert.equal(f.uploads.size,0);assert.equal(f.calls.filter(c=>c[0]==='register').length,0);
});
test('delayed recovery cannot enable new operations or overwrite the held request',async()=>{
  const f=setup();await f.api.open(product);await pending(f);f.context.fail=a=>a==='register'?{error:{message:'transport unavailable'}}:null;
  await f.test.register(f.test.active);const request=f.test.active.uncertain.payload.request_id;f.api.forceClose();f.context.fail=null;
  f.saved.push({id:20,revision:'a'.repeat(32),dkd_shohin_id:1,storage_path:'old.jpg',product_kind:'rebuilt',updated_at:new Date().toISOString()});
  let resolve;f.context.sb.storage.from=()=>({createSignedUrls:()=>new Promise(r=>resolve=r)});
  const opening=f.api.open({...product,dkd_shohin_id:2});await new Promise(r=>setImmediate(r));
  assert.equal(f.test.active.initializing,true);assert.equal(f.test.active.uncertain.payload.request_id,request);assert.equal(e(f,'query').disabled,true);
  await pending(f);await f.test.register(f.test.active);await f.test.selectProduct(f.test.active,2);
  assert.equal(f.calls.filter(c=>c[0]==='register').length,1);assert.equal(f.test.active.product.dkd_shohin_id,1);
  assert.equal(JSON.parse(f.window.sessionStorage.getItem('dcats-product-photo-pending:'+actor)).operation.payload.request_id,request);
  resolve({data:[]});await opening;assert.equal(f.test.active.uncertain.payload.request_id,request);assert.equal(e(f,'query').disabled,true);
});
test('partial batch success refreshes registered photos without resending successful files',async()=>{
  const f=setup();await f.api.open(product);await pending(f);await pending(f);f.test.active.queue[1].caption='失敗';
  f.context.fail=(a,p)=>a==='register'&&p.caption==='失敗'?{error:{message:'invalid fixture variant',code:'22023'}}:null;
  await f.test.register(f.test.active);
  assert.equal(f.saved.length,1);assert.equal(f.test.active.images.length,1);assert.equal(f.test.active.queue.length,1);
  assert.equal(f.test.active.queue[0].caption,'失敗');assert.match(e(f,'status').textContent,/登録済み 1 \/ 2/);
  assert.equal(f.calls.filter(c=>c[0]==='register'&&c[1].caption==='正面').length,1);
});
test('partial batch refresh retains the uncertain request and blocks further registration',async()=>{
  const f=setup();await f.api.open(product);await pending(f);await pending(f);f.test.active.queue[1].caption='不明';
  f.context.fail=(a,p)=>a==='register'&&p.caption==='不明'?{error:{message:'lost response'}}:null;
  await f.test.register(f.test.active);const op=f.test.active.uncertain;
  assert.equal(f.saved.length,1);assert.equal(f.test.active.images.length,1);assert.equal(f.test.active.queue.length,1);
  assert.equal(JSON.parse(f.window.sessionStorage.getItem('dcats-product-photo-pending:'+actor)).operation.payload.request_id,op.payload.request_id);
  const before=f.calls.filter(c=>c[0]==='register').length;await f.test.register(f.test.active);assert.equal(f.calls.filter(c=>c[0]==='register').length,before);
  assert.match(e(f,'status').textContent,/登録済み 1 \/ 2/);
});
