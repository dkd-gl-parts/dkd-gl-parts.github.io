"use strict";
const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const {parseHTML} = require("linkedom");
const source = fs.readFileSync("core-valuation.js", "utf8");
let checks = 0;
const eq = (a,b,label) => { assert.deepEqual(a,b,label); checks++; };
const plain = v => JSON.parse(JSON.stringify(v));
const flush = async () => { for(let i=0;i<12;i++) await Promise.resolve(); };
const context = {dependency_hash:"hash",components:[0,40,100,null].map((rate,i)=>({
 id:101+i,part_kind:["ic_regulator","stator","rectifier","rear_cover"][i],name:["IC レギュレータ","ステータ","レクチファイヤアセンブリ","カバー,リヤ・エンド"][i],
 component_position:String(i+1),quantity:"1",replacement_rate:rate
}))};
const settings = {net_weight_kg:"4.3",weight_source:"実測",component_bases:{101:1000,102:1000,103:1000,104:1000}};
function fixture() {
 const {window,document}=parseHTML('<html><body><div id="host"></div></body></html>');
 const runtime={crypto:require('node:crypto').webcrypto};
 const scope={window:runtime,Map,Number,String,Math,JSON,Date,Error,Object,RegExp};
 vm.runInNewContext(source,scope);
 return {window,document,api:runtime.DcatsCoreValuation,host:document.getElementById("host")};
}
(async function(){
 const {api}=fixture();
 let p=api.preview(context,settings);
 eq(p.body_appraisal_jpy,1548,"body weight rule");
 eq(plain(p.components.map(c=>c.appraisal_jpy)),[1000,600,0,null],"recovery direction and missing rate");
 eq(plain(p.components.map(c=>c.recovery_rate)),[100,60,0,null],"rates exactly once");
 eq(api.preview(context,{...settings,component_bases:{101:0}}).components[0].appraisal_jpy,0,"explicit zero");
 for(const v of [null,"",-1,"NaN","1e2","1000.001","1.0001"])
  eq(api.preview(context,{...settings,net_weight_kg:v}).body_appraisal_jpy,null,"invalid mass "+v);
 eq(api.preview({...context,components:[{...context.components[0],quantity:"1.001",replacement_rate:50}]},settings).components[0].appraisal_jpy,501,"integer scaled half-yen rounding");
 const changed={context,settings,saved:{components:plain(context.components)},stale:true};
 changed.context={...context,components:context.components.slice(0,3).map(c=>({...c}))};
 changed.context.components[1].component_position='NEW';
 eq(plain(api.draft(changed).component_bases),{101:1000,102:null,103:1000},'removed and changed identities never inherit base');
 eq(plain(api.draft({context,settings:{net_weight_kg:4.3,weight_source:'explicit'}}).component_bases),{101:null,102:null,103:null,104:null},'RPC settings may omit optional bases');
 for(const qty of [null,"","0","1/2","-1","1001"])
  eq(api.preview({...context,components:[{...context.components[0],quantity:qty}]},settings).components[0].appraisal_jpy,null,"quantity not defaulted");
 for(const rate of [-1,101,"",null])
  eq(api.preview({...context,components:[{...context.components[0],replacement_rate:rate}]},settings).components[0].appraisal_jpy,null,"rate not defaulted");
 const f=fixture(); let requests=[],data={context,can_edit:true,revision:0,settings:null,saved:null,stale:false,history:[]};
 let mode="success",saves=0,alive=true;
 const options={allowed:true,ownerId:"actor",productId:1,variantId:11,generation:1,canEdit:true,isCurrent:()=>alive,
  rpc:async(name,args)=>{
   requests.push(plain(args));eq(name,"manage_core_valuation","isolated RPC only");
   if(args.action==='get') return {data:plain(data)};
   if(args.action==='status') return {data: mode==='not_found'?{state:'not_found'}:{state:'saved',saved:{}}};
   saves++;
   if(mode==='uncertain') throw new Error('network failed');
   if(mode==='changed') return {error:{code:'40001',message:'CORE_CONTEXT_CHANGED'}};
   data={...data,settings:args.payload.settings,revision:data.revision+1,saved:{...api.preview(context,args.payload.settings),saved_at:'2026-10-21T00:00:00Z'},history:[]};
   return {data:{state:'saved',saved:data.saved}};
  }};
 const mount=()=>f.api.mount(f.host,options);
 const open=async()=>{const el=f.host.querySelector('details');el.open=true;el.dispatchEvent(new f.window.Event('toggle'));await flush();};
 const input=(selector,value)=>{const el=f.host.querySelector(selector);el.value=value;el.dispatchEvent(new f.window.Event('input'));};
 mount();eq(requests.length,0,"collapsed panel makes no network request");await open();
 eq(requests.length,1,"one read on opening");
 eq(f.host.querySelector('[data-core-save]').disabled,true,"missing weight cannot save");
 input('[data-core-weight]','4.3');input('[data-core-source]','実測');input('[data-core-base="102"]','1000');
 eq(f.host.querySelector('[data-core-body-value]').textContent,'¥1,548',"body preview");
 eq(f.host.querySelector('[data-core-part-value="102"]').textContent,'¥600',"part preview");
 const save=f.host.querySelector('[data-core-save]');save.click();save.click();await flush();
 eq(saves,1,"double click submitted once");
 eq(data.revision,1,"saved result re-read");
 eq(requests.find(r=>r.action==='save').payload.settings.net_weight_kg,'4.3',"explicit net mass, not packed mass");
 eq(Object.keys(requests.find(r=>r.action==='save').payload).sort(),['dependency_hash','expected_revision','operation_id','settings'],"never sends authoritative total");
 mode='uncertain';f.host.querySelector('[data-core-save]').click();await flush();
 eq(!!f.host.querySelector('[data-core-status]'),true,"unknown result has status action");
 eq(!!f.host.querySelector('[data-core-save]'),false,"unknown result cannot blindly save again");
 mode='not_found';f.host.querySelector('[data-core-status]').click();await flush();
 eq(!!f.host.querySelector('[data-core-save]'),true,"confirmed not saved allows deliberate save");
 eq(saves,2,"status never resubmits");
 mode='changed';f.host.querySelector('[data-core-save]').click();await flush();
 eq(f.host.querySelector('[data-core-message]').textContent.includes('変更'),true,"stale save has visible error");
 options.allowed=false;mount();eq(f.host.hidden,true,"unauthorized hidden and cleared");eq(f.host.textContent,'',"no stale private content");
 options.allowed=true;options.generation++;data.can_edit=false;mount();await open();
 eq(!!f.host.querySelector('[data-core-save]'),false,"read-only no save");
 eq(f.host.querySelector('[data-core-weight]').disabled,true,"read-only fields");
 options.generation++;options.rpc=async()=>({error:{code:'42501',message:'CORE_ACCESS_DENIED'}});mount();await open();
 eq(f.host.textContent.includes('権限がありません'),true,"direct API denial distinct");
 options.generation++;options.rpc=async()=>{throw Error('network')};mount();await open();
 eq(f.host.textContent.includes('取得できません'),true,"transport error not empty success");
 options.generation++;let resolve;options.rpc=()=>new Promise(r=>{resolve=r});mount();const opening=open();await flush();
 alive=false;options.allowed=false;mount();resolve({data});await opening;await flush();eq(f.host.textContent,'',"late response cannot leak after context change");
 const app=fs.readFileSync('app.js','utf8');
 const lastRender=app.slice(app.lastIndexOf('function renderAssemblyComponentRows()'),app.indexOf('async function loadAssemblyComponentsForCurrent()',app.lastIndexOf('function renderAssemblyComponentRows()')));
 eq(lastRender.includes('refreshCoreValuationPanel(false)'),true,'active renderer integrated');
 assert.match(app,/canViewInternalComponents\(\) && canUseManufacturingCost\(userProfile\)/);checks++;
 assert.doesNotMatch(source,/update_manual_assembly_component|set_component_shared_unit_price|unit_price_jpy|shipping_weight_kg/);checks++;
 console.log(JSON.stringify({checks,passed:true}));
})().catch(error=>{console.error(error);process.exitCode=1;});
