"use strict";
const fs = require("node:fs"), path = require("node:path"), http = require("node:http");
const assert = require("node:assert/strict"), acorn = require("acorn");
const root = path.resolve(__dirname, "..");
function fixtureFiles() {
  const app = fs.readFileSync(path.join(root,"app.js"),"utf8");
  const html = fs.readFileSync(path.join(root,"index.html"),"utf8");
  const ast = acorn.parse(app,{ecmaVersion:"latest"});
  const fn = name => {const n=ast.body.find(n=>n.type==="FunctionDeclaration"&&n.id.name===name);assert(n,name);return app.slice(n.start,n.end);};
  const dictionary = ast.body.find(n=>n.type==="VariableDeclaration"&&n.declarations.some(d=>d.id.name==="TRANSLATIONS"));
  const start = html.indexOf('<div id="screen-parts-mgmt"');
  const end = html.indexOf("\n<!--",start);
  assert(start>0&&end>start);
  const screen = html.slice(start,end).replace('class="screen"','class="screen active"');
  const regression = fs.readFileSync(path.join(root,"tests/mitsubishi-master-search.cjs"),"utf8");
  const support = name => {const s=regression.indexOf("function "+name+"("),e=regression.indexOf("\n}",s);assert(s>=0&&e>s);return regression.slice(s,e+2);};
  const script = app.slice(dictionary.start,dictionary.end)+"\n"+
    ["normalizePartQuery","mitsubishiManufacturerSearchAliases","normalizeCoreProductFastRows",
     "fetchCoreProductMasterMatches","setPartsMgmtSearchPending","searchPartsMgmt","loadPartsMgmt",
     "renderPartsMgmt","partsMgmtWeightText"].map(fn).join("\n")+"\n"+
    support("terms")+"\n"+support("matches")+"\n"+String.raw`
var qaLang=new URLSearchParams(location.search).get("lang")||"ja",qaMode="success",qaDaiko=true,qaCalls=[];
var partsMgmtData=[],partsMgmtSearchInFlight=false,partsMgmtSearchFailed=false,partsMgmtWeightLoadFailed=false,partsMgmtWeightSortDirection="";
var CORE_PRODUCT_FAST_SELECT="*",productSearchLimit=200;
var qaRow={dkd_shohin_id:17890,manufacturer:"MITSUBISHI",manufacturer_part_number:"A002TX3081",genuine_part_number:"SH01-18-300",category_code:"alternator",normalized_manufacturer_part_number:"A002TX3081",normalized_genuine_part_number:"SH0118300"};
function assert(value,message){if(!value)throw Error(message)}
function normalizeAsciiWidth(v){return String(v==null?"":v).normalize("NFKC")}
function norm(v){return normalizePartQuery(v).replace(/^([AM])0+([0-9])T/,"$1$2T").toLowerCase()}
function isDaikoGroup(){return qaDaiko}
async function fetchActiveSlLinkedDkdIds(){return []}
async function loadPartsMgmtShippingWeights(){}
function t(k){return TRANSLATIONS[qaLang][k]||TRANSLATIONS.ja[k]||k}
function esc(v){return String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function tCat(){return "オルタネータ"}
function partsMgmtWeightSortOrderLabel(){return ""}
function partsMgmtWeightSortActionLabel(){return "重量順"}
function partsMgmtRowsForDisplay(){return partsMgmtData}
function togglePartsMgmtWeightSort(){}
function canEdit(){return qaMode!=="readonly"}
function openCoreProductForm(mode,row){window.qaEditId=row.dkd_shohin_id}
function openPartForm(){}function deletePart(){throw Error("No mutations in QA")}
var sb={from:function(table){
 var call={table:table};qaCalls.push(call);var filters=[],single=false,limit=200;
 return {select:function(){return this},order:function(){return this},limit:function(v){limit=v;return this},
  or:function(v){filters.push(row=>terms(v).some(term=>matches(row,term)));return this},
  eq:function(k,v){filters.push(row=>String(row[k])===String(v));return this},
  in:function(k,v){filters.push(row=>v.indexOf(row[k])>=0);return this},
  maybeSingle:function(){single=true;return this},
  then:async function(resolve){
   if(table==="core_products"&&qaMode==="held")await new Promise(r=>window.qaRelease=r);
   if(table==="core_products"&&["error","denied","expired"].indexOf(qaMode)>=0)return resolve({data:null,error:{message:qaMode}});
   var rows=table==="parts"?[]:(qaMode==="empty"?[]:[qaRow]);
   var data=rows.filter(row=>filters.every(f=>f(row))).slice(0,limit);
   return resolve({data:single?data[0]||null:data,error:null});
  }};
},rpc:async function(name,args){qaCalls.push({rpc:name});return {data:[],error:null}}};
document.getElementById("parts-mgmt-search-form").addEventListener("submit",function(e){e.preventDefault();window.qaPending=searchPartsMgmt()});
window.qaReset=function(mode){qaMode=mode;qaDaiko=mode!=="restricted";qaCalls=[];window.qaEditId=null;};
window.qaReady=true;renderPartsMgmt();
`;
  return {
    "/":{type:"text/html",body:'<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body>'+screen+'<script src="/fixture.js"></script></body></html>'},
    "/fixture.js":{type:"application/javascript",body:script},
    "/styles.css":{type:"text/css",body:fs.readFileSync(path.join(root,"styles.css"),"utf8")}
  };
}
async function run(){
 const {chromium}=require(process.env.WARRANTY_PLAYWRIGHT_MODULE||"playwright"),files=fixtureFiles(),results=[];
 const output=process.env.WARRANTY_QA_OUTPUT||path.join(root,".qa-mitsubishi-master");
 fs.mkdirSync(output,{recursive:true});
 const server=http.createServer((req,res)=>{const file=files[new URL(req.url,"http://fixture").pathname];res.writeHead(file?200:404,{"Content-Type":file?file.type:"text/plain","Content-Security-Policy":"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'none'; img-src 'self' data:"});res.end(file?file.body:"");});
 let browser;
 try{
  await new Promise(r=>server.listen(0,"127.0.0.1",r));browser=await chromium.launch({headless:true});
  for(const width of [1280,390,320])for(const lang of ["ja","en","zh"]){
   const p=await browser.newPage({viewport:{width,height:900}}),errors=[];
   p.on("pageerror",e=>errors.push(e.message));
   await p.goto("http://127.0.0.1:"+server.address().port+"?lang="+lang);
   await p.waitForFunction(()=>window.qaReady);
   const input=p.locator("#parts-mgmt-search"),button=p.locator("#btn-parts-mgmt-search");
   await p.evaluate(()=>qaReset("held"));
   await input.fill("A2TX3081");await input.press("Enter");
   await p.waitForFunction(()=>!!window.qaRelease);
   assert.equal(await button.isDisabled(),true);
   assert.equal(await p.locator("#parts-mgmt-search-form").getAttribute("aria-busy"),"true");
   await p.evaluate(()=>{qaMode="success";qaRelease()});await p.evaluate(()=>qaPending);
   assert.equal(await button.isDisabled(),false);
   for(const query of ["A2TX3081","A002TX3081","SH01-18-300"]){
    await input.fill(query);await button.click();await p.evaluate(()=>qaPending);
    assert.equal(await p.locator("[data-core-pid='17890']").count(),1);
    assert((await p.locator("#parts-mgmt-list").textContent()).includes("A002TX3081"));
    assert.equal(await p.locator("[data-pid],[data-pdel]").count(),0);
   }
   await p.locator("[data-core-pid='17890']").click();
   assert.equal(await p.evaluate(()=>qaEditId),17890);
   await p.screenshot({path:path.join(output,"mitsubishi-master-"+lang+"-"+width+".png"),fullPage:true});
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),"no page horizontal overflow");
   for(const mode of ["error","denied","expired"]){
    await p.evaluate(mode=>qaReset(mode),mode);await input.fill("A2TX3081");await button.click();await p.evaluate(()=>qaPending);
    assert.equal(await p.locator("#parts-mgmt-list [role='status']").textContent(),await p.evaluate(()=>t("parts_mgmt_search_incomplete")));
    assert.equal(await p.locator("[data-core-pid]").count(),0);assert.equal(await button.isDisabled(),false);
   }
   for(const mode of ["empty","restricted"]){
    await p.evaluate(mode=>qaReset(mode),mode);await button.click();await p.evaluate(()=>qaPending);
    assert.equal(await p.locator("[data-core-pid]").count(),0);
   }
   await p.evaluate(()=>qaReset("readonly"));await button.click();await p.evaluate(()=>qaPending);
   assert((await p.locator("#parts-mgmt-list").textContent()).includes("A002TX3081"));
   assert.equal(await p.locator("[data-core-pid]").count(),0);
   assert.deepEqual(errors,[]);
   results.push({width,lang,passed:true,states:["loading","success","error","denied","expired","empty","restricted","readonly"]});await p.close();
  }
  fs.writeFileSync(path.join(output,"mitsubishi-master-results.json"),JSON.stringify({passed:true,synthetic:true,productionWrites:0,results},null,2));
  console.log("Mitsubishi master browser QA passed: "+results.length+" desktop/mobile/language scenarios");
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
}
module.exports={fixtureFiles};
if(require.main===module)run().catch(error=>{console.error(error);process.exitCode=1});
