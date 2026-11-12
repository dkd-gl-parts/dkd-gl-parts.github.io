"use strict";
const fs=require("node:fs"),path=require("node:path"),http=require("node:http"),assert=require("node:assert/strict"),acorn=require("acorn");
const root=path.resolve(__dirname,"..");
function fixtureFiles() {
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8"), page=fs.readFileSync(path.join(root,"index.html"),"utf8");
 const ast=acorn.parse(app,{ecmaVersion:2022});
 const fn=name=>{const n=ast.body.find(n=>n.type==="FunctionDeclaration"&&n.id.name===name);assert(n,name);return app.slice(n.start,n.end);};
 const dictionary=ast.body.find(n=>n.type==="VariableDeclaration"&&n.declarations.some(d=>d.id.name==="TRANSLATIONS"));
 const start=page.indexOf('<div id="screen-production-search"'),end=page.indexOf("\n<!--",start);
 assert(start>0&&end>start);
 const screen=page.slice(start,end).replace('class="screen dcats-ui-screen"','class="screen dcats-ui-screen active"');
 const detail=fn("renderProductionDetail");
 const head=detail.slice(detail.indexOf("  var priorityHtml ="),detail.indexOf('  html += "<div class=\'production-workspace\'>";'));
 assert(head.includes("renderProductionReportRank(row, true)"));
 const script=app.slice(dictionary.start,dictionary.end)+"\n"+[
  "productionReportRankFor","resetProductionReportRanks","loadProductionReportRanks","renderProductionReportRank","renderProductionList"
 ].map(fn).join("\n")+"\n"+String.raw`
var qaLang=new URLSearchParams(location.search).get("lang")||"ja", qaMode="success",qaAllowed=true,qaCalls=0;
var currentUser={id:"synthetic-rank-user"},userProfile={id:"synthetic-rank-user"};
var productionRows=[
 {dkd_shohin_id:1,manufacturer_part_number:"SYN-1001",genuine_part_number:"QA-1001"},
 {dkd_shohin_id:2,manufacturer_part_number:"SYN-1002",genuine_part_number:"QA-1002"},
 {dkd_shohin_id:3,manufacturer_part_number:"SYN-1003",genuine_part_number:"QA-1003"},
 {dkd_shohin_id:9,manufacturer_part_number:"SYN-1009",genuine_part_number:"QA-1009"},
 {dkd_shohin_id:99,manufacturer_part_number:"SYN-1099",genuine_part_number:"QA-1099"}
],productionFilteredRows=[],currentProductionRow=productionRows[0],productionStampSearchActive=false,productionSearchTotalCount=null,productionSearchHasMore=false;
var qaRows=[1,2,9].map((id,i)=>({id:id,dataset_id:"fixture",category_name:"全体集計",category_order:1,source_row_number:i+1,is_aggregate:true,product_code:String(id),manufacturer_part_number:"SYN-"+id,shipment_count:[100,80,50][i],substitute_count:0,master_product_ids:[id],master_checked_at:"checked"}));
var qaMembers=[{id:1,kikan_group_id:1,dkd_gokan_id:1},{id:2,kikan_group_id:1,dkd_gokan_id:2},{id:3,kikan_group_id:1,dkd_gokan_id:3}];
var sb={from:function(table){qaCalls++;return {ids:[],field:"",select:function(){return this},eq:function(){return this},order:function(){return this},limit:function(){return this},in:function(field,ids){this.field=field;this.ids=ids.map(String);return this},
 maybeSingle:async function(){if(qaMode==="held")await new Promise(resolve=>window.qaRelease=resolve);return {data:{id:"fixture",report_year:2025,row_count:3,sheet_manifest:[{name:"全体集計",is_aggregate:true}]}};},
 range:async function(start,end){if(qaMode==="error")return {error:Error("synthetic network failure")};return {data:(table==="manufacturing_report_rows"?qaRows:qaMembers.filter(m=>this.ids.indexOf(String(m[this.field]))>=0)).slice(start,end+1)}}
}}};
function t(k){return TRANSLATIONS[qaLang][k]||TRANSLATIONS.ja[k]||k}
function tf(k,values){return t(k).replace(/\{(\w+)\}/g,(_,key)=>values[key])}
function esc(v){return String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function canViewProductionFeatures(){return qaAllowed}function canViewManufacturingReport(){return qaAllowed}
function productDkdId(row){return String(row.dkd_shohin_id)}
function productionInstructionFor(){return {priority_rank:94}}
function productionMatchesFilter(){return true}
function productionMatchesQuery(row,q){return !q||row.manufacturer_part_number.indexOf(q)>=0}
function setCspStyle(el,property,value){el.hidden=value==="none"}
function productKindSummaryForProduct(){return []}function productHasCatalogData(){return false}
function slPartLabelsForProduct(){return []}function productHasSlPart(){return false}function hasProductKikanCompatible(){return true}
function getProductionImageCount(){return 0}function productionCategoryLabel(){return "オルタネータ"}
function productKindLabel(k){return k==="rebuilt"?"リビルト":"新品"}function productionProductKindStockQty(){return 0}
function renderProductionComponentCountBadges(){return ""}function renderProductionStampMatchHtml(){return ""}
function renderProductKindPills(){return ""}function renderResultBadgeSlots(){return ""}
function canViewFinishedLabelMgmt(){return false}function canEdit(){return false}function canManageAllImages(){return false}function canManageProduct3D(){return false}function canUseProductPhotoTools(){return false}
function renderQaDetail(row){var title=row.manufacturer_part_number;`+head+String.raw`
document.getElementById("production-detail").innerHTML=html;}
window.qaRender=function(){renderProductionList();renderQaDetail(currentProductionRow);}
window.qaLoad=async function(mode){qaMode=mode||"success";qaAllowed=mode!=="denied";resetProductionReportRanks();var promise=loadProductionReportRanks();qaRender();await promise;qaRender();}
document.getElementById("production-q").addEventListener("input",qaRender);
document.getElementById("production-search-btn").addEventListener("click",()=>qaLoad());
document.getElementById("production-list").addEventListener("click",function(event){var card=event.target.closest("[data-dkd-id]");if(card){currentProductionRow=productionRows.find(row=>String(row.dkd_shohin_id)===card.dataset.dkdId);qaRender();}});
window.qaReady=true;qaRender();
`;
 return {
 "/":{type:"text/html",body:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body>'+screen+'<script src="/fixture.js"></script><script src="/report.js"></script><script src="/start.js"></script></body></html>'},
 "/fixture.js":{type:"application/javascript",body:script},
 "/report.js":{type:"application/javascript",body:fs.readFileSync(path.join(root,"manufacturing-ranking-report.js"),"utf8")},
 "/start.js":{type:"application/javascript",body:"qaRender();"},
 "/styles.css":{type:"text/css",body:fs.readFileSync(path.join(root,"styles.css"),"utf8")}
 };
}
async function run(){
 const {chromium}=require(process.env.WARRANTY_PLAYWRIGHT_MODULE||"playwright"),files=fixtureFiles(),results=[];
 const output=process.env.WARRANTY_QA_OUTPUT||path.join(root,".qa-production-ranks");fs.mkdirSync(output,{recursive:true});
 const server=http.createServer((req,res)=>{const f=files[new URL(req.url,"http://fixture").pathname];res.writeHead(f?200:404,{"Content-Type":f?f.type:"text/plain","Content-Security-Policy":"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'none'; img-src 'self' data:"});res.end(f?f.body:"");});
 let browser;
 try{
  await new Promise(r=>server.listen(0,"127.0.0.1",r));browser=await chromium.launch({headless:true});
  for(const width of [1280,390,320])for(const lang of ["ja","en","zh"]){
   const p=await browser.newPage({viewport:{width,height:900}}),errors=[];p.on("pageerror",e=>{errors.push(e.message);console.error("Production QA page error:",e.message);});
   await p.goto("http://127.0.0.1:"+server.address().port+"?lang="+lang);await p.waitForFunction(()=>window.qaReady);
   await p.evaluate(()=>{window.qaPending=qaLoad("held")});await p.waitForFunction(()=>!!window.qaRelease);
   assert.equal(await p.locator(".production-card .production-rank").first().textContent(),await p.evaluate(()=>t("production_report_rank_loading")));
   await p.evaluate(()=>qaRelease());await p.evaluate(()=>qaPending);
   for(const id of [1,2,3])assert.equal(await p.locator('[data-dkd-id="'+id+'"] .production-rank').textContent(),"#1");
   assert.equal(await p.locator('[data-dkd-id="9"] .production-rank').textContent(),"#3");
   assert.equal(await p.locator('[data-dkd-id="99"] .production-rank').count(),0);
   assert((await p.locator(".production-priority").textContent()).includes("#1"));
   assert((await p.locator(".production-priority").getAttribute("title")).includes("2025"));
   assert(!(await p.locator(".production-body").textContent()).includes("#94"));
   if(width<768)await p.evaluate(()=>document.getElementById("production-q").value="");
   await p.locator('[data-dkd-id="2"]').click();assert((await p.locator(".production-priority").textContent()).includes("#1"));
   await p.locator("#production-q").fill("SYN-1009");assert.equal(await p.locator(".production-card .production-rank").textContent(),"#3");
   await p.locator("#production-q").fill("");
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),"no page horizontal overflow");
   await p.screenshot({path:path.join(output,"production-report-rank-"+lang+"-"+width+".png"),fullPage:true});
   for(const mode of ["error","denied"]){await p.evaluate(mode=>qaLoad(mode),mode);assert.equal(await p.locator(".production-card .production-rank").first().textContent(),await p.evaluate(mode=>t("production_report_rank_"+(mode==="error"?"error":"denied")),mode));assert(!(await p.locator(".production-priority").textContent()).includes("#"));}
   await p.evaluate(()=>qaLoad("success"));assert.equal(await p.locator(".production-card .production-rank").first().textContent(),"#1");
   assert.deepEqual(errors,[]);results.push({width,lang,passed:true});await p.close();
  }
  fs.writeFileSync(path.join(output,"production-report-ranks-results.json"),JSON.stringify({passed:true,synthetic:true,productionWrites:0,results},null,2));
  console.log("Production report ranks browser QA passed: "+results.length+" desktop/mobile/language scenarios");
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
}
module.exports={fixtureFiles};
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});
