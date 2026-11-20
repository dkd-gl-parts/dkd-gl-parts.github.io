"use strict";
const fs=require("node:fs"),path=require("node:path"),http=require("node:http"),assert=require("node:assert/strict"),acorn=require("acorn");
const root=path.resolve(__dirname,"..");
function fixtureFiles(){
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8"),ast=acorn.parse(app,{ecmaVersion:"latest"});
 const fn=name=>{const n=ast.body.find(n=>n.type==="FunctionDeclaration"&&n.id.name===name);assert(n,name);return app.slice(n.start,n.end);};
 const dict=ast.body.find(n=>n.type==="VariableDeclaration"&&n.declarations.some(d=>d.id.name==="TRANSLATIONS"));
 const script=app.slice(dict.start,dict.end)+"\n"+["salesOrderInventoryItems","hydrateSalesOrderInventory","salesOrderInventoryItemHtml","salesProductShelfMatchesCurrent","renderSalesProductShelf","loadSalesProductShelfForCurrent","renderProductKindStockHtml","buildSalesOrderDispatchPage"].map(fn).join("\n")+"\n"+fs.readFileSync(path.join(root,"tests/sales-order-inventory-fixture.js"),"utf8");
 return {"/":{type:"text/html",body:'<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/shipment-instruction-print.css"><link rel="stylesheet" href="/qa.css"></head><body><main id="root" class="sales-order-detail-section sales-order-billing"></main><script src="/fixture.js"></script></body></html>'},
 "/fixture.js":{type:"application/javascript",body:script},
 "/styles.css":{type:"text/css",body:fs.readFileSync(path.join(root,"styles.css"),"utf8")},
 "/shipment-instruction-print.css":{type:"text/css",body:fs.readFileSync(path.join(root,"shipment-instruction-print.css"),"utf8")},
 "/qa.css":{type:"text/css",body:'body:not(.document-dispatch){background:#f5f7fb;padding:24px;}body:not(.document-dispatch) #root{max-width:960px;margin:auto;padding:20px;background:white;border:1px solid #dce4ec;border-radius:12px;}.sales-order-inventory{margin-top:0;border-top:0;padding-top:0;}@media(max-width:600px){body:not(.document-dispatch){padding:12px;}body:not(.document-dispatch) #root{padding:12px;}}'}};
}
async function run(){
 const {chromium}=require(process.env.WARRANTY_PLAYWRIGHT_MODULE||"playwright"),files=fixtureFiles(),results=[];
 const output=process.env.WARRANTY_QA_OUTPUT||path.join(root,".qa-sales-inventory");fs.mkdirSync(output,{recursive:true});
 const server=http.createServer((req,res)=>{const f=files[new URL(req.url,"http://qa").pathname];res.writeHead(f?200:404,{"Content-Type":f?f.type+"; charset=utf-8":"text/plain","Content-Security-Policy":"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'none'; img-src 'self' data:"});res.end(f?f.body:"");});
 let browser;
 try{
 await new Promise(r=>server.listen(0,"127.0.0.1",r));browser=await chromium.launch({headless:true});const base="http://127.0.0.1:"+server.address().port;
 for(const width of [1280,390,320])for(const lang of ["ja","en","zh"]){const p=await browser.newPage({viewport:{width,height:900}}),errors=[];p.on("pageerror",e=>errors.push(e.message));
 await p.goto(base+"/?lang="+lang);await p.waitForSelector('html[data-ready="true"]');assert((await p.locator("#root").innerText()).includes("GLA-21 (10) / GLA-32 (13) / GLA-41 (1)"));assert.equal(await p.locator("#sales-product-shelf").count(),1);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await p.screenshot({path:path.join(output,"sales-inventory-"+lang+"-"+width+".png"),fullPage:true});
 await p.locator("#qa-kind").selectOption("aftermarket_new");await p.evaluate(()=>qaPending);assert(!(await p.locator("#sales-product-shelf").innerText()).includes("GLA-21"));await p.locator("#qa-kind").selectOption("rebuilt");await p.evaluate(()=>qaPending);assert((await p.locator("#sales-product-shelf").innerText()).includes("GLA-21"));
 for(const mode of ["loading","error","denied","expired","missing","unauthorized","recount"]){await p.goto(base+"/?lang="+lang+"&mode="+mode);if(mode!=="loading")await p.waitForSelector('html[data-ready="true"]');const text=await p.locator("#root").innerText();assert.equal(text.includes("GLA-21"),mode==="recount");assert(!text.includes("undefined"));assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
 assert.deepEqual(errors,[]);results.push({width,lang,states:8,passed:true});await p.close();}
 const p=await browser.newPage({viewport:{width:1000,height:1200}});await p.emulateMedia({media:"print"});await p.goto(base+"/?print=1");await p.waitForSelector('html[data-ready="true"]');assert.equal(await p.locator(".dispatch-items .sales-order-inventory-values").count(),4);assert((await p.locator(".dispatch-items").innerText()).includes("GLA-41 (1)"));const fit=await p.locator(".dispatch-sheet").evaluate(e=>({height:e.clientHeight,scroll:e.scrollHeight,bottom:e.getBoundingClientRect().bottom,last:e.lastElementChild.getBoundingClientRect().bottom}));assert(fit.scroll<=fit.height+1&&fit.last<=fit.bottom,"dispatch content fits A4");await p.screenshot({path:path.join(output,"sales-inventory-dispatch.png"),fullPage:true});await p.pdf({path:path.join(output,"sales-inventory-dispatch.pdf"),preferCSSPageSize:true});await p.close();
 fs.writeFileSync(path.join(output,"sales-inventory-results.json"),JSON.stringify({passed:true,synthetic:true,productionWrites:0,results,print:fit},null,2));console.log("Sales inventory browser QA passed: "+results.length+" desktop/mobile/language scenarios and A4 dispatch");
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
}
module.exports={fixtureFiles};if(require.main===module)run().catch(error=>{console.error(error);process.exitCode=1;});
