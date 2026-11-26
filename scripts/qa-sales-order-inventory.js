"use strict";
const fs=require("node:fs"),path=require("node:path"),http=require("node:http"),assert=require("node:assert/strict"),acorn=require("acorn");
const root=path.resolve(__dirname,"..");

function faxHelpFixtures(fn) {
 const read=file=>fs.readFileSync(path.join(root,file),"utf8");
 const link=read("index.html").match(/<a class="sales-order-help-link" id="sales-order-fax-help"[^>]*>[^<]*<\/a>/);
 assert(link,"The real order toolbar help link is required");
 return {
  "/feature-screens":{type:"text/html",body:read("index.html").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"")},
  "/assets/help/features.html":{type:"text/html",body:read("assets/help/features.html")},
  "/assets/help/features.css":{type:"text/css",body:read("assets/help/features.css")},
  ...Object.fromEntries(fs.readdirSync(path.join(root,"assets/help/screens")).filter(name=>name.endsWith(".jpg")).map(name=>[
    "/assets/help/screens/"+name, {type:"image/jpeg",body:fs.readFileSync(path.join(root,"assets/help/screens",name))}
  ])),
  "/fax-help-test":{type:"text/html",body:'<!doctype html><meta charset="utf-8">'+link[0]+read("index.html").match(/<a [^>]*data-feature-help[^>]*#search"[^>]*>[^<]*<\/a>/)[0]+'<input id="draft" aria-label="Draft"><div id="sales-order-detail"><nav class="sales-order-detail-nav"><button aria-selected="false" data-sales-order-detail-view="accounting">Accounting</button></nav></div><script src="/fax-help-test.js"></script>'},
  "/fax-help-test.js":{type:"application/javascript",body:[
   'var faxOrderHelpWindow = null;',
   fn("faxOrderHelpSection"),fn("openFaxOrderHelp"),
   'document.addEventListener("click", openFaxOrderHelp);',
   'document.querySelector(".sales-order-detail-nav button").addEventListener("click", function () { this.setAttribute("aria-selected", "true"); });'
  ].join("\n")},
  "/assets/help/fax-practice-order.html":{type:"text/html",body:read("assets/help/fax-practice-order.html")},
  "/assets/help/fax-practice-check.html":{type:"text/html",body:read("assets/help/fax-practice-check.html")},
  "/assets/help/fax-practice.css":{type:"text/css",body:read("assets/help/fax-practice.css")},
  "/assets/help/fax-practice.js":{type:"application/javascript",body:read("assets/help/fax-practice.js")},
  "/assets/help/fax-order.html":{type:"text/html",body:read("assets/help/fax-order.html")},
  "/assets/help/fax-order.css":{type:"text/css",body:read("assets/help/fax-order.css")}
 };
}
async function verifyFaxHelpWindow(browser, base) {
 const context=await browser.newContext({viewport:null});
 try {
  const work=await context.newPage();
  await work.goto(base+"/fax-help-test");
  await work.locator("#draft").fill("unsubmitted order text");
  const [help]=await Promise.all([context.waitForEvent("page"),work.locator("#sales-order-fax-help").click()]);
  await help.waitForURL("**/assets/help/fax-order.html?v=1#overview");
  const windowId=async page=>{
   const session=await context.newCDPSession(page);
   try { return (await session.send("Browser.getWindowForTarget")).windowId; }
   finally { await session.detach(); }
  };
  assert.notEqual(await windowId(work),await windowId(help),"Help must be a separate browser window");
  assert.equal(await help.evaluate(()=>window.opener===null),true);
  await work.getByRole("button",{name:"Accounting"}).click();
  await work.locator("#sales-order-fax-help").press("Enter");
  await help.waitForURL("**/assets/help/fax-order.html?v=1#export");
  await work.locator("[data-feature-help]").press("Enter");
  await help.waitForURL("**/assets/help/features.html?v=1#search");
  assert(await help.locator("#search").isVisible());
  assert.equal(context.pages().length,2,"Context changes must reuse the help window");
  assert.equal(await work.locator("#draft").inputValue(),"unsubmitted order text");
  assert.equal(new URL(work.url()).pathname,"/fax-help-test");
  console.log("FAX order context help QA passed: separate Chromium window, chapter reuse, original draft preserved");
 } finally { await context.close(); }
}

async function verifyFaxPractice(browser, base, output) {
 const page = await browser.newPage();
 try {
  for (const [form, expectedPages] of [["order", 1], ["check", 2]]) {
   await page.goto(base + "/assets/help/fax-order.html#intake");
   const name = "fax-practice-" + form;
   await page.locator('#intake a[href="' + name + '.html"]').click();
   const panels = page.locator(".panel");
   const ids = await panels.evaluateAll(nodes => nodes.map(el => el.id));
   for (const viewport of [{width:1440,height:900}, {width:1280,height:600}, {width:390,height:640}, {width:320,height:568}]) {
    await page.setViewportSize(viewport);
    for (const id of ids) {
     await page.evaluate(id => { location.hash = id; }, id);
     assert.equal(await page.locator(".panel:visible").count(), 1);
     const size = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight]);
     assert(size[0] <= viewport.width && size[1] <= viewport.height + 1, name + "#" + id + ": " + size);
    }
   }
   await page.getByRole("link",{name:"前へ",exact:true}).click();
   assert.equal(new URL(page.url()).hash, "#" + ids[ids.length - 2]);
   await page.evaluate(() => { window.print = () => document.body.setAttribute("data-print-called","yes"); });
   await page.getByRole("button",{name:"印刷・PDF保存"}).click();
   assert.equal(await page.locator("body").getAttribute("data-print-called"), "yes");

   await page.emulateMedia({media:"print"});
   await page.setViewportSize({width:680,height:1016});
   assert.equal(await page.locator(".panel:visible").count(), ids.length);
   assert.equal(await page.locator("button:visible, nav:visible").count(), 0);
   const pdfCheck = async suffix => {
    const pdf = await page.pdf({path:path.join(output,name + suffix + ".pdf"), preferCSSPageSize:true, printBackground:true});
    const data = pdf.toString("latin1");
    assert.equal((data.match(/\/Type\s*\/Page\b/g) || []).length, expectedPages, name + suffix + " pages");
    const box = data.match(/\/MediaBox\s*\[0 0 ([\d.]+) ([\d.]+)\]/);
    assert(box && Math.abs(Number(box[1])-595)<2 && Math.abs(Number(box[2])-842)<2, "A4 portrait");
    const widthsFit = await page.locator(".panel, .editable, .item, dl > div, li").evaluateAll(nodes =>
     nodes.every(el => el.scrollWidth <= el.clientWidth + 1 && el.getBoundingClientRect().right <= innerWidth + 1));
    assert(widthsFit, name + suffix + " print content fits");
   };
   await pdfCheck("");
   await page.screenshot({path:path.join(output,name+"-print.png"),fullPage:true});
   if (form === "order") {
    await page.getByRole("textbox",{name:"スターターの品番"}).fill("TR-LONG-PART-" + "0123456789".repeat(6));
    await page.getByRole("textbox",{name:"郵便番号と住所"}).fill("演習用の長い住所・配送部門・建物名".repeat(3));
    await pdfCheck("-long");
   }
   await page.emulateMedia({media:"screen"});
  }
  console.log("FAX practice verified: 9 panels, four viewports, edited long fields, A4 order 1 page and observer checklist 2 pages.");
 } finally { await page.close(); }
}

async function verifyFeatureHelp(browser, base, output) {
 const page = await browser.newPage();
 try {
  await page.goto(base + "/feature-screens");
  const screens = await page.locator('.screen[id^="screen-"]:has(.page-header)').evaluateAll(nodes => nodes.map(node => node.id));
  const guide = await browser.newPage();
  try {
   await guide.goto(base + "/assets/help/features.html");
   const chapters = await guide.locator("article").evaluateAll(nodes => nodes.map(node => node.id));
   for (const viewport of [{width:1440,height:900}, {width:1280,height:600}, {width:390,height:640}, {width:320,height:568}]) {
    await Promise.all([page.setViewportSize(viewport), guide.setViewportSize(viewport)]);
    for (const id of screens) {
     const check = await page.evaluate(screenId => {
      document.querySelector(".screen.active")?.classList.remove("active");
      const screen = document.getElementById(screenId);
      screen.classList.add("active");
      const header = screen.querySelector(".page-header");
      const link = header.querySelector("[data-feature-help]") || screen.querySelector("[data-fax-help-section]");
      if (!link) return {missing:true};
      const featureLink = link.hasAttribute("data-feature-help");
      if (featureLink) {
       const user = header.querySelector(".header-username"), role = header.querySelector(".role-badge");
       if (user) user.textContent = "点検担当者";
       if (role) role.textContent = "業務点検";
      }
      const rect = link.getBoundingClientRect();
      return { hash:link.hash.slice(1), fax:link.hasAttribute("data-fax-help-section"), fits:rect.width > 0 && rect.left >= -1 && rect.right <= innerWidth + 1 };
     }, id);
     assert(!check.missing && check.fits, id + " help must be visible at " + viewport.width + ": " + JSON.stringify(check));
     if (!check.fax) {
      const expected = id === "screen-rakuten-bulk" ? "rakuten-price" : id.slice("screen-".length);
      assert.equal(check.hash,expected,id + " must open its own chapter");
      assert(check.hash === "menu" || chapters.includes(check.hash),id + " guide chapter");
     }
    }
    for (const chapter of chapters) {
     for (let step = 1; step <= 3; step++) {
      const hash = step === 1 ? chapter : chapter + "--" + step;
      await guide.evaluate(target => { location.hash = target; }, hash);
      const current = guide.locator("#" + chapter + "--" + step);
      assert(await current.isVisible(), hash + " opens its own step");
      assert.equal(await guide.locator("article li:visible").count(), 1);
      const shot = current.locator("img");
      await shot.evaluate(image => image.decode());
      assert.equal(await shot.evaluate(image => image.naturalWidth), 600);
      const size = await guide.evaluate(() => ({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }));
      assert(size.width <= viewport.width && size.height <= viewport.height + 1, hash + " at " + JSON.stringify(viewport) + " rendered " + JSON.stringify(size));
     }
    }
    await guide.screenshot({path:path.join(output,"feature-guide-" + viewport.width + ".png")});
   }
   await guide.getByRole("link",{name:"前へ",exact:true}).click();
   assert(await guide.locator("li:target .step-number").innerText() === "手順 2 / 3");
   await guide.getByRole("link",{name:"次へ",exact:true}).click();
   assert(await guide.locator("li:target .step-number").innerText() === "手順 3 / 3");
   await guide.getByRole("link",{name:"機能別の目次へ",exact:true}).click();
   const categories = guide.locator("summary");
   for (const category of await categories.all()) {
    await category.click();
    assert(await guide.evaluate(() => document.documentElement.scrollWidth <= innerWidth && document.documentElement.scrollHeight <= innerHeight + 1), "expanded directory must fit at 320px");
    await category.click();
   }
   await categories.first().click();
   await guide.locator('nav a[href="#search"]').click();
   assert(await guide.locator("article#search").isVisible());
   console.log("Feature help verified across " + screens.length + " screens and " + chapters.length + " chapters at four viewport sizes");
  } finally { await guide.close(); }
 } finally { await page.close(); }
}

function fixtureFiles(){
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8"),ast=acorn.parse(app,{ecmaVersion:"latest"});
 const fn=name=>{const n=ast.body.find(n=>n.type==="FunctionDeclaration"&&n.id.name===name);assert(n,name);return app.slice(n.start,n.end);};
 const dict=ast.body.find(n=>n.type==="VariableDeclaration"&&n.declarations.some(d=>d.id.name==="TRANSLATIONS"));
 const script=app.slice(dict.start,dict.end)+"\n"+["salesOrderInventoryItems","hydrateSalesOrderInventory","salesOrderInventoryItemHtml","salesProductShelfMatchesCurrent","renderSalesProductShelf","loadSalesProductShelfForCurrent","renderProductKindStockHtml","buildSalesOrderDispatchPage"].map(fn).join("\n")+"\n"+fs.readFileSync(path.join(root,"tests/sales-order-inventory-fixture.js"),"utf8");
 return {...faxHelpFixtures(fn),"/":{type:"text/html",body:'<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/shipment-instruction-print.css"><link rel="stylesheet" href="/qa.css"></head><body><main id="root" class="sales-order-detail-section sales-order-billing"></main><script src="/fixture.js"></script></body></html>'},
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
 await verifyFaxHelpWindow(browser,base);
 await verifyFaxPractice(browser,base,output);
 await verifyFeatureHelp(browser,base,output);
 const p=await browser.newPage({viewport:{width:1000,height:1200}});await p.emulateMedia({media:"print"});await p.goto(base+"/?print=1");await p.waitForSelector('html[data-ready="true"]');assert.equal(await p.locator(".dispatch-items .sales-order-inventory-values").count(),4);assert((await p.locator(".dispatch-items").innerText()).includes("GLA-41 (1)"));const fit=await p.locator(".dispatch-sheet").evaluate(e=>({height:e.clientHeight,scroll:e.scrollHeight,bottom:e.getBoundingClientRect().bottom,last:e.lastElementChild.getBoundingClientRect().bottom}));assert(fit.scroll<=fit.height+1&&fit.last<=fit.bottom,"dispatch content fits A4");await p.screenshot({path:path.join(output,"sales-inventory-dispatch.png"),fullPage:true});await p.pdf({path:path.join(output,"sales-inventory-dispatch.pdf"),preferCSSPageSize:true});await p.close();
 fs.writeFileSync(path.join(output,"sales-inventory-results.json"),JSON.stringify({passed:true,synthetic:true,productionWrites:0,results,print:fit},null,2));console.log("Sales inventory browser QA passed: "+results.length+" desktop/mobile/language scenarios and A4 dispatch");
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
}
module.exports={fixtureFiles};if(require.main===module)run().catch(error=>{console.error(error);process.exitCode=1;});
