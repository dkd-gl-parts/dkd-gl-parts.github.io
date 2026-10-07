const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {Worker}=require('node:worker_threads'),{pathToFileURL}=require('node:url'),{createHash}=require('node:crypto');
const root=path.resolve(__dirname,'..'), hash=b=>createHash('sha256').update(b).digest('hex');
async function modules(){return {encoder:await import(pathToFileURL(path.join(root,'vendor/product3d-inputs/jpeg-encoder-0.4.4-bounded-v1.mjs'))),
  core:await import(pathToFileURL(path.join(root,'vendor/product3d-inputs/alignment-exif-v1.mjs'))),
  raw:await import(pathToFileURL(path.join(root,'vendor/product3d-inputs/jpeg-raw-imagescript-1.3.0.mjs')))};}
async function fixture(){
  const {encoder,core,raw}=await modules();
  const pixels=new Uint8ClampedArray(96*64*4);
  for(let y=0;y<64;y++)for(let x=0;x<96;x++)pixels.set([[220,20,20,255],[20,220,20,255],[20,20,220,255],[220,220,20,255]][(y>=32?2:0)+(x>=48?1:0)],(y*96+x)*4);
  const jpeg=encoder.encode({width:96,height:64,data:pixels},95).data;
  const exif=new Uint8Array(32);exif.set([69,120,105,102,0,0,73,73]);const dv=new DataView(exif.buffer,6);
  dv.setUint16(2,42,true);dv.setUint32(4,8,true);dv.setUint16(8,1,true);dv.setUint16(10,0x112,true);
  dv.setUint16(12,3,true);dv.setUint32(14,1,true);dv.setUint16(18,6,true);
  const original=Uint8Array.from([255,216,255,225,0,34,...exif,...jpeg.subarray(2)]);
  const prior=global.fetch;
  global.fetch=async url=>{assert.equal(String(url),pathToFileURL(path.join(root,'vendor/product3d-inputs/jpeg-imagescript-1.3.0.wasm')).href);
    return new Response(fs.readFileSync(path.join(root,'vendor/product3d-inputs/jpeg-imagescript-1.3.0.wasm')));};
  try{
    const prepared=await core.prepareAlignedJpeg(original,270,{decodeRaw:raw.decodeRaw,async encodeJpeg(r,q){return new Uint8Array(encoder.encode({width:r.width,height:r.height,data:r.pixels},q).data);}});
    return {original,prepared,input:{source_sha256:hash(original),source_bytes:original.length,sha256:hash(prepared.bytes),output_bytes:prepared.bytes.length,width:prepared.width,height:prepared.height,rotation_clockwise:270}};
  }finally{global.fetch=prior;}
}
function run(input,original){
  return new Promise((resolve,reject)=>{
    const code=`const {parentPort}=require('node:worker_threads'),fs=require('node:fs');global.self=global;
      global.crypto=require('node:crypto').webcrypto;self.postMessage=(m,t)=>parentPort.postMessage(m,t);
      global.fetch=async url=>{if(String(url)!==${JSON.stringify(pathToFileURL(path.join(root,'vendor/product3d-inputs/jpeg-imagescript-1.3.0.wasm')).href)})throw Error('Network prohibited');
        return new Response(fs.readFileSync(${JSON.stringify(path.join(root,'vendor/product3d-inputs/jpeg-imagescript-1.3.0.wasm'))}));};
      import(${JSON.stringify(pathToFileURL(path.join(root,'product-3d-input-worker.mjs')).href)}).then(()=>{parentPort.on('message',data=>self.onmessage({data}));parentPort.postMessage({ready:true});});`;
    const worker=new Worker(code,{eval:true});const timer=setTimeout(()=>{worker.terminate();reject(Error('timeout'));},5000);
    worker.on('error',err=>{clearTimeout(timer);worker.terminate();reject(err);});
    worker.on('message',message=>{
      if(message.ready){const bytes=Uint8Array.from(original).buffer;worker.postMessage({...input,bytes},[bytes]);}
      else{clearTimeout(timer);worker.terminate();resolve(message);}
    });
  });
}
test('real worker prepares bounded raw pixels, EXIF exactly once and exact reviewed bytes',async()=>{
  const f=await fixture(),result=await run(f.input,f.original);assert.equal(result.ok,true);
  assert.equal(result.bytes.byteLength,f.prepared.bytes.length);assert.equal(hash(new Uint8Array(result.bytes)),f.input.sha256);
});
test('worker refuses changed source, stale output hash, incorrect dimensions and invalid rotation',async()=>{
  const f=await fixture();
  for(const change of [i=>i.source_sha256='0'.repeat(64),i=>i.sha256='0'.repeat(64),i=>i.width++,i=>i.rotation_clockwise=45]){
    const input={...f.input};change(input);assert.deepEqual(await run(input,f.original),{ok:false});
  }
});
