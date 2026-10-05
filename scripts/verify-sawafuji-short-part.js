"use strict";
const fs=require("node:fs"), vm=require("node:vm"), assert=require("node:assert/strict"), acorn=require("acorn");
const source=fs.readFileSync("app.js","utf8"), ast=acorn.parse(source,{ecmaVersion:"latest"});
const names=["sawafujiShortPartKey","sawafujiFamilyPartNumbers","sawafujiFamilyCandidate","fetchSawafujiImportCandidates","fetchManufacturingCostProducts","manufacturingCostBuildImportHistory"];
const code=names.map(name=>{const node=ast.body.find(n=>n.type==="FunctionDeclaration"&&n.id.name===name);assert(node,name);return source.slice(node.start,node.end);}).join("\n");
const products=Array.from({length:10},(_,i)=>({dkd_shohin_id:100+i,category_code:"starter",manufacturer:"SAWAFUJI",manufacturer_part_number:"0355-502-002"+i,genuine_part_number:"OE-"+i}));
const calls=[];
const ctx={console, normalizePartQuery:s=>String(s).normalize("NFKC").toUpperCase().replace(/[－-\s]/g,""), CORE_PRODUCT_FAST_SELECT:"dkd_shohin_id,manufacturer_part_number",
  normalizeCoreProductFastRows:x=>x,filterVisibleProducts:x=>x,productDkdId:x=>x.dkd_shohin_id,
  fetchCoreProductMasterMatches:async()=>({data:[],error:null}),sb:{from(table){assert.equal(table,"core_products");const call={};calls.push(call);return {
    select(){return this;},in(field,values){assert.equal(field,"normalized_manufacturer_part_number");assert.equal(values.length,10);assert(values.every(v=>/^0\d{10}$/.test(v)));call.parts=values;return this;},
    eq(field,value){assert.equal(field,"category_code");call.category=value;return this;},order(){return this;},limit(value){assert(value<=120);return this;},then(resolve){resolve({data:products.concat([{...products[0],dkd_shohin_id:200,manufacturer:"DENSO"},{...products[0],dkd_shohin_id:201,manufacturer_part_number:"035550200299"}]),error:null});}
  };}}};
vm.createContext(ctx);vm.runInContext(code,ctx);
async function verify(){
  assert.equal(ctx.sawafujiShortPartKey("0355 502 002"),"0355502002");
  assert.equal(ctx.sawafujiShortPartKey("０３５５－５０２－００２"),"0355502002");
  assert.equal(ctx.sawafujiShortPartKey("0355-502-0029"),"");
  assert.equal(ctx.sawafujiShortPartKey("355502002"),"");
  for(const p of products) assert(ctx.sawafujiFamilyCandidate("0355 502 002",p));
  for(const p of [{...products[0],manufacturer:"DENSO"},{...products[0],manufacturer_part_number:"0355-502-0030"},{...products[0],manufacturer_part_number:"0355-502-00299"}]) assert(!ctx.sawafujiFamilyCandidate("0355502002",p));
  assert.equal((await ctx.fetchSawafujiImportCandidates("0355 502 002","starter",60)).data.length,10);
  assert.equal(calls[0].category,"starter");
  const n=calls.length;await ctx.fetchSawafujiImportCandidates("M2T42842","starter",60);assert.equal(calls.length,n,"Other part formats never query a digit family");
  const grouped=await ctx.fetchManufacturingCostProducts(["0355502002"],"starter",{exactOnly:true,groupByToken:true});
  assert.equal(grouped.groups[0].token,"0355502002");assert.equal(grouped.groups[0].familyCandidateIds.length,10);
  assert.equal(grouped.groups[0].matchCount,10);
  const history=ctx.manufacturingCostBuildImportHistory(grouped.groups,[{dkd_shohin_id:109,import_part_numbers:["0355-502-002"]}]);
  assert.equal(history.byToken["0355502002"].productId,"109");
  const conflict=ctx.manufacturingCostBuildImportHistory(grouped.groups,[{dkd_shohin_id:109,import_part_numbers:["0355502002"]},{dkd_shohin_id:100,import_part_numbers:["0355502002"]}]);
  assert.equal(conflict.byToken["0355502002"].ambiguous,true);
  ctx.fetchCoreProductMasterMatches=async()=>({data:[products[0]],error:null});
  assert.equal((await ctx.fetchManufacturingCostProducts(["0355502002"],"starter",{exactOnly:true,groupByToken:true})).data.length,10,"Deduplicate exact/family overlaps");
  ctx.fetchSawafujiImportCandidates=async()=>({error:{message:"offline"}});
  assert.equal((await ctx.fetchManufacturingCostProducts(["0355502002"],"starter",{exactOnly:true,groupByToken:true})).error.message,"offline","Failed family lookup must not appear complete");

  const elements={};["results","apply","status","reference","preview","choose","file","file-name","cost-list","cost-list-note","sheets","held-toggle","held-list","new","history","history-toggle","held-panel","held-refresh"].forEach(id=>elements["container-stock-"+id]={value:"",textContent:"",innerHTML:"",disabled:false,classList:{toggle(){}},listeners:{},addEventListener(name,fn){const old=this.listeners[name];this.listeners[name]=old?event=>{old(event);fn(event);}:fn;},querySelector(){return {focus(){}};}});
  let init;
  globalThis.document={readyState:"loading",addEventListener(name,fn){init=fn;},getElementById:id=>elements[id]||null};
  globalThis.normalizePartQuery=ctx.normalizePartQuery;globalThis.manufacturingCostBuildImportHistory=ctx.manufacturingCostBuildImportHistory;
  require("../manufacturing-cost-import.js");require("../container-stock-import.js");
  const api=globalThis.DcatsContainerStockImport,state=api._state;
  let writes=0,lastPayload;
  const candidate={...products[9],variant_active:true,match_type:"sawafuji_family",stock_qty:1};
  globalThis.confirm=()=>true;globalThis.sb={rpc:async(name,args)=>{
    if(name==="preview_container_stock_receipt") return {data:{container_reference:args.p_container_reference,duplicate:null,rows:args.p_rows.map(row=>({...row,candidates:[candidate]}))}};
    if(name==="apply_container_stock_receipt"){writes++;lastPayload=args.p_rows;return {data:{receipt_id:1,line_count:1,total_quantity:4,held_count:0,rows:args.p_rows.map(row=>({...row,line_status:"received"}))}};}
    if(name==="list_container_stock_receipts") return {data:[]};throw Error(name);
  }};
  init();state.fileName="synthetic.xlsx";state.fileSha256="a".repeat(64);state.costListId="none";state.costListReady=true;
  elements["container-stock-reference"].value="SYNTHETIC-SAW";
  state.sheets=[{name:"STA",matrix:[["Parts No","Quantity"],["0355-502-002",4]],category:"starter",included:true,overrides:{}}];
  await api._previewReceipt();const row=state.preview.rows[0],key="starter|"+row.part_number;
  assert.equal(api._automaticTarget(row),"","Sole family candidate is not auto-selected");
  state.costListId="5";state.costProductIds=["109"];assert.equal(api._automaticTarget(row),"","A cost-list ID alone is not historical source binding");
  state.costLinkItems=[{dkd_shohin_id:109,import_part_numbers:[row.part_number]}];assert.equal(api._automaticTarget(row),"109");
  state.costLinkItems=[{dkd_shohin_id:109,import_part_numbers:["OTHER"]}];assert.equal(api._automaticTarget(row),"");state.costListId="none";state.costProductIds=[];state.costLinkItems=[];
  row.previous_family_target_id=109;assert.equal(api._automaticTarget(row),"109");row.previous_family_conflict=true;assert.equal(api._automaticTarget(row),"");
  row.previous_family_conflict=false;row.previous_family_target_id=null;
  state.selections[key]="109";api._renderPreview();assert.equal(elements["container-stock-apply"].disabled,true);
  await api._applyReceipt();assert.equal(writes,0);
  assert.match(elements["container-stock-results"].innerHTML,/0355-502-0029/);assert.match(elements["container-stock-results"].innerHTML,/OE-9/);
  elements["container-stock-results"].listeners.change({target:{matches:s=>s==="[data-container-family-confirm]",dataset:{containerFamilyConfirm:"0"},checked:true}});
  assert.equal(elements["container-stock-apply"].disabled,false);
  elements["container-stock-results"].listeners.change({target:{matches:s=>s==="[data-container-family-confirm]",dataset:{containerFamilyConfirm:"0"},checked:false}});
  assert.equal(elements["container-stock-apply"].disabled,true,"Manual uncheck survives render");
  state.familyConfirmed[key]="109";api._renderPreview();await api._applyReceipt();assert.equal(writes,1,elements["container-stock-status"].textContent);
  assert.equal(lastPayload[0].part_number,row.part_number);assert.equal(lastPayload[0].sawafuji_family_confirmed,true);
  assert.equal(lastPayload[0].family_match_snapshot.manufacturer_part_number,"0355-502-0029");
  assert.equal(lastPayload[0].family_match_snapshot.genuine_part_number,"OE-9");
  for(const k of ["manufacturing_cost_sawafuji_family","manufacturing_cost_sawafuji_note"]) assert.equal((source.match(new RegExp(k+":","g"))||[]).length,3);
  console.log("Sawafuji short-part guard passed: 10 suffixes, maker/category scope, exact dedup, failed search, prior links, explicit confirmation, snapshot, raw source preservation");
}
verify().catch(e=>{console.error(e);process.exitCode=1;});
