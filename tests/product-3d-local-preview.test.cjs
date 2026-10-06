const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const validatorContext = { window: {}, ArrayBuffer, DataView, Uint8Array, TextDecoder };
vm.runInNewContext(fs.readFileSync(path.join(root, 'product-3d-local-glb.js'), 'utf8'), validatorContext);
const validator = validatorContext.window.Product3DLocalGlb;
function glb(extra = {}) {
  const json = Buffer.from(JSON.stringify({asset:{version:'2.0'}, scenes:[{nodes:[0]}], nodes:[{mesh:0}],
    meshes:[{}], buffers:[{byteLength:4}], ...extra}));
  const length = Math.ceil(json.length / 4) * 4;
  const bytes = new Uint8Array(28 + length + 4);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, bytes.length, true);
  view.setUint32(12, length, true); view.setUint32(16, 0x4e4f534a, true);
  bytes.fill(32, 20, 20 + length); bytes.set(json, 20);
  view.setUint32(20 + length, 4, true); view.setUint32(24 + length, 0x004e4942, true);
  return bytes.buffer;
}
test('local preflight accepts self-contained GLB 2.0 and allowed MIME only', () => {
  const buffer = glb();
  assert.equal(validator.validateBytes(buffer), buffer);
  for (const type of ['', 'model/gltf-binary', 'application/octet-stream']) validator.validateFile({name:'Part.GLB',size:buffer.byteLength,type});
  for (const file of [{name:'a.exe.glb',size:40,type:'application/x-msdownload'}, {name:'a.gltf',size:40,type:''},
    {name:'a.glb',size:31*1024*1024,type:''}, {name:'a.glb',size:19,type:''}]) assert.throws(() => validator.validateFile(file));
});
test('spoofed header, version, length, chunk, JSON and binary bounds fail closed', () => {
  for (const [offset, value] of [[0,0],[4,1],[8,40],[12,3],[16,0]]) {
    const bytes = glb(); new DataView(bytes).setUint32(offset, value, true);
    assert.throws(() => validator.validateBytes(bytes));
  }
  assert.throws(() => validator.validateBytes(glb({buffers:[{byteLength:999}]})));
  assert.throws(() => validator.validateBytes(glb({bufferViews:[{buffer:0,byteOffset:4,byteLength:4}]})));
  const malformed = glb(); new Uint8Array(malformed)[20] = 0xff;
  assert.throws(() => validator.validateBytes(malformed));
});
test('external, relative, data and extension URIs are rejected before rendering', () => {
  for (const uri of ['https://example.test/private', '//example.test/a', '../a.bin', 'file:///secret', 'data:image/svg+xml,<svg/>']) {
    assert.throws(() => validator.validateBytes(glb({images:[{uri}]})), /外部参照/);
    assert.throws(() => validator.validateBytes(glb({extensions:{custom:{nested:{uri}}}})), /外部参照/);
  }
  assert.throws(() => validator.validateBytes(glb({images:[{mimeType:'image/svg+xml',bufferView:0}]})), /テクスチャ/);
});
test('cyclic or out-of-range node hierarchy fails without loader recursion', () => {
  assert.throws(() => validator.validateBytes(glb({nodes:[{children:[0]}]})), /循環/);
  assert.throws(() => validator.validateBytes(glb({nodes:[{children:[1]},{children:[0]}]})), /循環/);
  assert.throws(() => validator.validateBytes(glb({nodes:[{children:[9]}]})), /参照/);
});
const source = fs.readFileSync(path.join(root, 'product-3d.js'), 'utf8');
const start = source.indexOf('  function selectLocalGlb(');
const end = source.indexOf('  async function showCommonViewer(', start);
function harness(read = async () => glb()) {
  const calls = { reads:0, opens:0, picked:0, alerts:[] };
  const state = { productId:42, kind:'rebuilt', admin:true };
  const input = { files:[], value:'', click(){calls.picked++;} };
  const context = { modelCacheEpoch:0, viewerRequestId:0, sessionModelsEnabled:true, localGlbTarget:null,
    window:{Product3DLocalGlb:validator}, elements:{'product-3d-local-glb-file':input},
    selectedTarget:()=>({product:{id:state.productId},kind:state.kind}), productId:p=>p?.id,
    canManageGlb:()=>state.admin, friendlyError:String, alert:m=>calls.alerts.push(m),
    showCommonViewer:async (options,title,target,id,current)=>{ assert.ok(current()); assert.ok(options.buffer); assert.match(title,/未登録/); calls.opens++; },
    sb:new Proxy({}, {get(){throw new Error('Local preview must never access Supabase');}}),
  };
  const api = vm.runInNewContext(source.slice(start,end)+'\n({selectLocalGlb,previewLocalGlb})', context);
  function choose(){input.files=[{name:'part.glb',type:'model/gltf-binary',size:100,arrayBuffer:async()=>{calls.reads++;return read();}}];}
  return {api,context,state,calls,input,choose};
}
test('local selection uses the common Viewer without storage, RPC, upload or paid calls', async () => {
  const qa = harness(); qa.api.selectLocalGlb('sales'); qa.choose(); await qa.api.previewLocalGlb();
  assert.equal(qa.calls.opens,1); assert.equal(qa.calls.reads,1); assert.equal(qa.input.value,'');
});
test('customer and non-admin cannot select a local preview from a stale button', () => {
  const qa = harness(); qa.api.selectLocalGlb('customer'); qa.state.admin=false; qa.api.selectLocalGlb('sales');
  assert.equal(qa.calls.picked,0);
});
test('product, kind and permission switches in the picker cannot preview the wrong target', async () => {
  for (const change of [q=>q.state.productId++, q=>q.state.kind='aftermarket_new', q=>q.state.admin=false]) {
    const qa=harness(); qa.api.selectLocalGlb('sales'); qa.choose(); change(qa); await qa.api.previewLocalGlb();
    assert.equal(qa.calls.reads,0); assert.equal(qa.calls.opens,0);
  }
});
test('sign-out, Escape, selection changes or permission loss during file read suppress a stale preview', async () => {
  for (const change of [q=>q.context.sessionModelsEnabled=false, q=>q.context.viewerRequestId++,
    q=>q.context.modelCacheEpoch++, q=>q.state.productId++, q=>q.state.admin=false]) {
    let finish; const qa=harness(()=>new Promise(resolve=>{finish=resolve;}));
    qa.api.selectLocalGlb('sales'); qa.choose(); const pending=qa.api.previewLocalGlb();
    change(qa); finish(glb()); await pending;
    assert.equal(qa.calls.opens,0); assert.equal(qa.calls.alerts.length,0);
  }
});
test('invalid local GLB never opens a renderer and a later valid file still works', async () => {
  let invalid=true; const qa=harness(async()=>invalid?glb({asset:{version:'1.0'}}):glb());
  qa.api.selectLocalGlb('sales'); qa.choose(); await qa.api.previewLocalGlb();
  assert.equal(qa.calls.opens,0); assert.equal(qa.calls.alerts.length,1);
  invalid=false; qa.api.selectLocalGlb('sales'); qa.choose(); await qa.api.previewLocalGlb(); assert.equal(qa.calls.opens,1);
});
