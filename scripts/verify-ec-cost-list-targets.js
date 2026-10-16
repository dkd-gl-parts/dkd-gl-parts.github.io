"use strict";
const assert = require("assert/strict"), fs = require("fs"), path = require("path"), vm = require("vm");
const root = path.resolve(__dirname,".."), source = fs.readFileSync(path.join(root,"ec-cost-list-targets.js"),"utf8");
const markup = fs.readFileSync(path.join(root,"index.html"),"utf8");
assert.ok(markup.includes('<dialog id="ec-cost-dialog"'));
assert.ok(markup.includes('src="ec-cost-list-targets.js?v='));
assert.ok(fs.readFileSync(path.join(root,"scripts/build-static-site.js"),"utf8").includes('"ec-cost-list-targets.js"'));
function fixture() {
  const elements = new Map();
  function element(id) {
    if(!elements.has(id)) elements.set(id, {id,value:"",innerHTML:"",textContent:"",disabled:false,open:false,isConnected:true,events:{},options:[{},{}],classList:{toggle(){}},setAttribute(){},focus(){},showModal(){this.open=true;},close(){this.open=false;},addEventListener(name,fn){this.events[name]=fn;}});
    return elements.get(id);
  }
  let permission=true, calls=[], mode="success", deferred;
  const data={list:{id:1,list_name:'<img src=x onerror=1>'},token:'a'.repeat(32),counts:{total:3,add:1,duplicate:1,review:1},rows:[{dkd_shohin_id:1,search_number:'<img src=x onerror=1>',status:'add',reason:'new',import_part_numbers:['<script>bad</script>']},{dkd_shohin_id:2,status:'duplicate',reason:'disabled_target'},{dkd_shohin_id:3,status:'review',reason:'number_collision'}]};
  const sandbox = {window:null,document:{getElementById:element,querySelectorAll:()=>[],activeElement:element("entry")},currentLang:"ja",TRANSLATIONS:{ja:{},en:{},zh:{}},currentUser:{id:'synthetic'},canUseRakutenResearch:()=>permission,canViewManufacturingCostMgmt:()=>permission,getEcMallSelectedProviders:()=>['rakuten'],getEcMallSellerIds:()=>[],getEcMallIncludeUsed:()=>false,rakutenTargets:[{id:9,target_key:'dkd:9',dkd_shohin_id:9,provider_keys:['yahoo_shopping'],search_number:'KEEP'}],setRakutenStatus:(message,error)=>{sandbox.message={message,error};},renderRakutenTargets(){},ecMallTargetFromDb:row=>row,sb:{from(){return{select(){return this;},eq(){return this;},order(){return this;},range:async()=>({data:[{id:1,list_name:'合成リスト'}]})};},async rpc(name,args){calls.push({name,args});if(mode==='deferred')return new Promise(resolve=>{deferred=resolve;});if(mode==='error')return{error:{message:'connection interrupted'}};if(mode==='stale')return{error:{code:'40001',message:'EC_COST_STALE_PREVIEW'}};return{data:args.p_commit?{inserted:1,targets:[{id:10,target_key:'dkd:1',dkd_shohin_id:1,search_number:'NEW'}]}:JSON.parse(JSON.stringify(data))};}}};
  sandbox.window=sandbox; vm.runInNewContext(source,sandbox);
  return{sandbox,el:name=>element('ec-cost-'+name),entry:()=>element('btn-ec-cost-list-targets').events.click(),change:()=>element('ec-cost-list').events.change(),commit:()=>element('ec-cost-add').events.click(),close:()=>element('ec-cost-close').events.click(),permission:value=>{permission=value;},mode:value=>{mode=value;},resolve:value=>deferred(value),calls,data};
}
(async()=>{
  let f=fixture(); await f.entry(); assert.equal(f.el('dialog').open,true);assert.equal(f.calls.length,0,'opening never writes');
  f.el('list').value='1'; await f.change();assert.equal(f.el('add').disabled,false);assert.equal(f.calls[0].args.p_commit,false);
  assert.ok(!f.el('results').innerHTML.includes('<img'));assert.ok(f.el('results').innerHTML.includes('&lt;img'));
  assert.ok(f.el('results').innerHTML.includes('自動復活しません'));
  const keep=JSON.stringify(f.sandbox.rakutenTargets[0]);
  await f.commit();assert.equal(f.calls.filter(c=>c.args.p_commit).length,1);assert.equal(f.sandbox.rakutenTargets.length,2);
  assert.equal(JSON.stringify(f.sandbox.rakutenTargets.find(row=>row.id===9)),keep,'existing local conditions remain unchanged');
  assert.equal(f.sandbox.rakutenTargets[0].id,10,'new targets stay visible within the existing 200-row display limit');
  assert.equal(f.el('dialog').open,false);await f.commit();assert.equal(f.calls.length,2,'completed preview cannot replay');
  f=fixture();f.permission(false);await f.entry();assert.equal(f.el('dialog').open,false);assert.equal(f.calls.length,0);
  f=fixture();f.sandbox.rakutenTargets.push({search_number:'UNSAVED'});await f.entry();assert.equal(f.el('dialog').open,false);assert.equal(f.calls.length,0);
  f=fixture();await f.entry();f.el('list').value='1';f.mode('deferred');const pending=f.change();f.close();f.resolve({data:f.data});await pending;assert.equal(f.el('dialog').open,false);assert.equal(f.el('results').innerHTML,'','late preview cannot reopen or restore closed content');
  for(const mutate of [f=>{f.sandbox.currentUser={id:'other'};},f=>{f.sandbox.getEcMallIncludeUsed=()=>true;},f=>{f.permission(false);},f=>{f.el('list').value='2';},f=>{f.sandbox.rakutenTargets.push({id:11,target_key:'dkd:11'});}]){
    f=fixture();await f.entry();f.el('list').value='1';await f.change();mutate(f);await f.commit();assert.equal(f.calls.length,1,'changed context prevents a commit');assert.equal(f.el('add').disabled,true);
  }
  f=fixture();await f.entry();f.el('list').value='1';await f.change();f.mode('deferred');const saving=f.commit();await f.commit();assert.equal(f.calls.filter(c=>c.args.p_commit).length,1,'double-click sends one commit');f.close();assert.equal(f.el('dialog').open,true,'commit prevents accidental dialog cancellation');f.resolve({error:{message:'network'}});await saving;assert.equal(f.el('add').disabled,true);await f.commit();assert.equal(f.calls.length,2,'unknown outcome does not retry');assert.ok(f.el('status').textContent.includes('自動再送はしません'));
  f=fixture();await f.entry();f.el('list').value='1';await f.change();f.mode('stale');await f.commit();assert.ok(f.el('status').textContent.includes('再確認'));assert.equal(f.el('add').disabled,true);
  for(const lang of ['en','zh']){f=fixture();f.sandbox.currentLang=lang;f.sandbox.DcatsEcCostListTargets.refresh();await f.entry();f.el('list').value='1';await f.change();assert.ok(!/[ぁ-んァ-ン]/.test(f.el('results').innerHTML));}
  console.log('EC cost list UI: preview-only, escaping, permissions, unsaved targets, close/late responses, stale context, single commit, unknown outcome, settings preservation and translations passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
