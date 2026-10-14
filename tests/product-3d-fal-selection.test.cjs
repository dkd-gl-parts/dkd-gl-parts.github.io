const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto').webcrypto;
const source = fs.readFileSync(path.join(__dirname, '../product-3d-fal-selection.js'), 'utf8');
const shared = fs.readFileSync(path.join(__dirname, '../product-3d.js'), 'utf8');
const views = ['front','rear','left','right','upper','bottom'];
class Element {
  constructor(tag='div') { this.tag=tag; this.children=[]; this.attrs={}; this.dataset={}; this.listeners={}; this.hidden=false; }
  set textContent(value) { this.text=value; this.children=[]; } get textContent() { return this.text||''; }
  appendChild(node) { node.parent=this; this.children.push(node); return node; }
  setAttribute(key,value) { this.attrs[key]=value; if(key.startsWith('data-')) this.dataset[key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=value; }
  hasAttribute(key) { return Object.hasOwn(this.attrs,key)||key.startsWith('data-')&&Object.hasOwn(this.dataset,key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())); }
  removeAttribute(key) { delete this.attrs[key]; if(key==='src')delete this.src; }
  addEventListener(key,fn) { this.listeners[key]=fn; }
  contains(node) { return node===this||this.children.some(n=>n.contains(node)); }
  closest(tag) { return this.tag===tag?this:this.parent?.closest(tag); }
  remove() { if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this); }
  click() { if(this.tag==='a') this.saved?.(this); }
  querySelectorAll(selector) {
    const match=selector.match(/^\[data-([\w-]+)(?:='([^']+)')?\]$/);
    const key=match?.[1].replace(/-([a-z])/g,(_,c)=>c.toUpperCase());
    return this.children.flatMap(n=>[(key&&Object.hasOwn(n.dataset,key)&&(!match[2]||n.dataset[key]===match[2]))?n:null,...n.querySelectorAll(selector)]).filter(Boolean);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0]||null; }
}
function fixture(options={}) {
  const root=new Element(), nodes={};
  for(const name of ['gallery','preview','status','export','large']) { const el=new Element(name==='export'?'button':'div');el.setAttribute('data-fal-'+name,'');root.appendChild(el);nodes[name]=el; }
  for(const name of ['image','label','directions']) { const el=new Element();el.setAttribute('data-fal-large-'+name,'');nodes.large.appendChild(el); }
  const packages=[], revoked=[], downloads=[], reads=[];let current=true, pendingResolve;
  const ctx={window:{},document:{documentElement:{lang:options.lang||'ja'},createElement(tag){
    const el=new Element(tag); if(tag==='a')el.saved=link=>downloads.push(link.download);
    if(tag==='canvas') { el.getContext=()=>({drawImage(bitmap){el.input=bitmap.bytes;}}); el.toBlob=fn=>fn(new Blob([el.input],{type:'image/jpeg'})); }
    return el;
  }},crypto,Blob,Uint8Array,DataView,TextEncoder,Set,Number,Error,
    URL:{createObjectURL(blob){packages.push(blob);return 'blob:synthetic-'+packages.length;},revokeObjectURL(url){revoked.push(url);}},
    setTimeout:options.timeout?(fn)=>setTimeout(fn,5):setTimeout,clearTimeout,
    createImageBitmap:async blob=>({width:options.badDimensions?20:256,height:256,bytes:await blob.arrayBuffer(),close(){}})};
  vm.runInNewContext(source,ctx);const api=ctx.window.DcatsFalPhotoSelection, controller=api.create(root);
  const target={productId:2639,kind:'aftermarket_new'};
  const rows=Array.from({length:6},(_,i)=>({id:19+i,product_variant_id:15825,storage_path:'sl_42/photo_'+i+'.jpg'}));
  const setup={target,isCurrent:()=>current,async readPhoto(row){
    reads.push(row.id); if(options.deferred)await new Promise(resolve=>pendingResolve=resolve);
    if(options.failure)throw Error('secret-token');
    const bytes=new Uint8Array(20).fill(options.duplicate?1:row.id);return new Blob([bytes],{type:options.badMime?'text/html':'image/jpeg'});
  }};
  function click(button) { root.listeners.click({target:button}); }
  function selectAll() { views.forEach((view,i)=>click(root.querySelectorAll('[data-fal-assign]').find(b=>b.dataset.falAssign===view&&b.dataset.falImageId===String(rows[i].id)))); }
  controller.open(setup);controller.setRows(rows);rows.forEach(row=>controller.updatePreview(row.id,'blob:synthetic-preview-'+row.id));
  return {api,controller,root,nodes,rows,setup,packages,downloads,revoked,reads,click,selectAll,setCurrent(value){current=value;},resolve(){pendingResolve();}};
}
function unzipStored(bytes) {
  const result={};let offset=0;
  while(new DataView(bytes.buffer,bytes.byteOffset+offset).getUint32(0,true)===0x04034b50) {
    const v=new DataView(bytes.buffer,bytes.byteOffset+offset),size=v.getUint32(18,true),length=v.getUint16(26,true);
    assert.equal(v.getUint16(8,true),0);assert.equal(v.getUint16(28,true),0);
    const name=new TextDecoder().decode(bytes.slice(offset+30,offset+30+length));
    const body=bytes.slice(offset+30+length,offset+30+length+size);result[name]=body;offset+=30+length+size;
  }
  const end=new DataView(bytes.buffer,bytes.byteOffset+bytes.length-22);assert.equal(end.getUint32(0,true),0x06054b50);assert.equal(end.getUint16(10,true),7);assert.equal(end.getUint32(16,true),offset);
  return result;
}
test('only the exact product/kind and actual SL variant photos qualify',()=>{
  const f=fixture();assert.equal(f.api.eligible(f.setup.target),true);
  for(const target of [{productId:2640,kind:'aftermarket_new'},{productId:2639,kind:'rebuilt'}]){f.controller.open({...f.setup,target});assert.equal(f.root.hidden,true);}
  f.controller.open({...f.setup,isCurrent:()=>false});assert.equal(f.root.hidden,true);
  assert.equal(f.api.validRow(f.rows[0]),true);
  for(const change of [{id:'19'},{id:0},{product_variant_id:8708},{storage_path:'sl_43/x.jpg'},{storage_path:'sl_42/../x.jpg'},{storage_path:'https://example.invalid/x.jpg'}])assert.equal(f.api.validRow({...f.rows[0],...change}),false);
  f.controller.open(f.setup);f.controller.setRows([{...f.rows[0],id:171,product_variant_id:8708}]);assert.equal(f.nodes.gallery.children.length,0);assert.match(f.nodes.status.textContent,/写真がありません/);
});
test('six distinct directions move duplicates, clear, refuse unknown rows and require previews',()=>{
  const f=fixture();assert.equal(f.nodes.export.disabled,true);f.selectAll();assert.equal(f.nodes.export.disabled,false);
  f.click(f.root.querySelectorAll('[data-fal-assign]').find(b=>b.dataset.falAssign==='rear'&&b.dataset.falImageId==='19'));
  assert.equal(f.nodes.export.disabled,true);assert.match(f.nodes.status.textContent,/5 \/ 6/);
  f.click(f.root.querySelectorAll('[data-fal-clear]')[0]);assert.match(f.nodes.status.textContent,/4 \/ 6/);
  const selection={},rows=Object.fromEntries(f.rows.map(r=>[String(r.id),r]));assert.equal(f.api.choose(selection,'unknown','19',rows),false);assert.equal(f.api.choose(selection,'front','999',rows),false);
  views.forEach((v,i)=>f.api.choose(selection,v,String(19+i),rows));assert.equal(f.api.ready(selection,rows),false);
  f.controller.setRows(f.rows);assert.equal(f.nodes.export.disabled,true);
});
test('successful export contains exactly six bound photos plus non-authorizing manifest, no source URL or credential',async()=>{
  const f=fixture();f.selectAll();const first=f.controller.exportPhotos(),second=f.controller.exportPhotos();await Promise.all([first,second]);
  assert.equal(f.reads.length,6);assert.equal(f.packages.length,1);assert.deepEqual(f.downloads,['D-CATS_27060-30220_6views.zip']);assert.match(f.nodes.status.textContent,/ZIPをダウンロード/);
  const files=unzipStored(new Uint8Array(await f.packages[0].arrayBuffer()));assert.deepEqual(Object.keys(files),views.map(v=>v+'.jpg').concat('manifest.json'));
  const manifest=JSON.parse(new TextDecoder().decode(files['manifest.json']));assert.equal(manifest.product_id,2639);assert.equal(manifest.product_variant_id,15825);assert.equal(manifest.generation_allowed,false);assert.equal(manifest.metadata_stripped,true);
  assert.equal(/https?:|token|storage_path|FAL_KEY/.test(JSON.stringify(manifest)),false);
  for(const image of manifest.images){assert.equal(image.sha256,Buffer.from(await crypto.subtle.digest('SHA-256',files[image.file])).toString('hex'));assert.equal(image.width,256);}
  f.controller.close();assert.equal(f.root.hidden,true);assert.equal(f.nodes.gallery.children.length,0);assert.equal(f.revoked.length,1);
});
test('failure, duplicate bytes, invalid MIME/dimensions and stalled read never download a package',async()=>{
  for(const options of [{failure:true},{duplicate:true},{badMime:true},{badDimensions:true},{deferred:true,timeout:true}]){
    const f=fixture(options);f.selectAll();await f.controller.exportPhotos();assert.equal(f.packages.length,0);assert.equal(f.downloads.length,0);assert.equal(f.nodes.export.disabled,false);assert.match(f.nodes.status.textContent,/準備できません/);assert.equal(f.nodes.status.textContent.includes('secret'),false);
  }
});
test('target/session invalidation and closing discard pending work without download or next read',async()=>{
  for(const close of [false,true]) { const f=fixture({deferred:true});f.selectAll();const pending=f.controller.exportPhotos();assert.equal(f.reads.length,1);if(close)f.controller.close();else f.setCurrent(false);f.resolve();await pending;assert.equal(f.reads.length,1);assert.equal(f.packages.length,0); }
});
test('expanded photo directions share selection, and load errors stay safe',()=>{
  const f=fixture();f.click(f.root.querySelector('[data-fal-expand]'));assert.equal(f.nodes.large.hidden,false);assert.match(f.nodes.large.querySelector('[data-fal-large-label]').textContent,/19/);
  const b=f.nodes.large.querySelector('[data-fal-assign]');f.click(b);assert.equal(b.attrs['aria-pressed'],'true');f.controller.fail();assert.match(f.nodes.status.textContent,/取得できません/);assert.equal(f.nodes.export.disabled,true);
});
test('Japanese, English and Chinese have the same complete copy keys and localized direction actions',()=>{
  for(const [lang,label] of [['ja','正面'],['en','Front'],['zh-CN','正面']]){const f=fixture({lang});assert.equal(f.api.copy('front'),label);assert.equal(f.nodes.gallery.querySelector('[data-fal-assign]').textContent,label);f.selectAll();assert.equal(f.nodes.export.disabled,false);}
  const copySource=source.slice(source.indexOf('var COPY = ')+11,source.indexOf(';\n  function copy'));
  const dictionaries=vm.runInNewContext('('+copySource+')');assert.deepEqual(Object.keys(dictionaries.ja).sort(),Object.keys(dictionaries.en).sort());assert.deepEqual(Object.keys(dictionaries.ja).sort(),Object.keys(dictionaries.zh).sort());
});
test('CRC and ZIP whitelist, duplicates, missing files, and size bounds are enforced',()=>{
  const f=fixture();assert.equal(f.api.crc32(new TextEncoder().encode('123456789')),0xcbf43926);
  const files=views.map(v=>({name:v+'.jpg',bytes:new Uint8Array(20).fill(1)})).concat({name:'manifest.json',bytes:new TextEncoder().encode('{}')});
  assert.throws(()=>f.api.zip(files.slice(0,6)));assert.throws(()=>f.api.zip(files.map((x,i)=>i===0?{...x,name:'../front.jpg'}:x)));assert.throws(()=>f.api.zip(files.map((x,i)=>i===0?{...x,name:'rear.jpg'}:x)));assert.throws(()=>f.api.zip(files.map((x,i)=>i===0?{...x,bytes:new Uint8Array(8*1024*1024+1)}:x)));assert.throws(()=>f.api.zip(files.map(x=>({...x,bytes:new Uint8Array(6*1024*1024)}))));
});
test('existing authenticated modal uses only bound read-only Storage access, clears on close, and ships the helper',()=>{
  assert.match(shared,/\.select\("id,storage_path,product_variant_id,sort_order,created_at"\)/);
  const integration=shared.slice(shared.indexOf('if (falSelectionController) falSelectionController.open'),shared.indexOf('elements["product-3d-tripo-overlay"].classList.add("show")'));
  assert.match(integration,/sameTripoTarget\(requestId\).*validRow\(row\)/);assert.match(integration,/sb\.storage\.from\("product-images"\)\.download\(row.storage_path\)/);assert.equal(/upload|functions|tripoInvoke|FAL_KEY/.test(integration),false);
  assert.match(shared,/if \(falSelectionController\) falSelectionController.close\(\)/);
  assert.equal(/fetch\(|\.upload\(|FAL_KEY|fal\.ai|tripoInvoke/.test(source),false);
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');assert.match(html,/id="product-3d-fal-selection"[^>]*hidden/);assert.ok(html.indexOf('src="product-3d-fal-selection.js')<html.indexOf('src="product-3d.js'));
  assert.match(fs.readFileSync(path.join(__dirname,'../scripts/build-static-site.js'),'utf8'),/"product-3d-fal-selection.js"/);
});
