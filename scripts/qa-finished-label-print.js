"use strict";

const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const assert = require("node:assert/strict");
const acorn = require("acorn");
const root = path.resolve(__dirname, "..");

function fixtureFiles() {
  const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  const ast = acorn.parse(app, { ecmaVersion: 2022 });
  const fn = (name) => {
    const n = ast.body.find((n) => n.type === "FunctionDeclaration" && n.id.name === name);
    assert(n, name);
    return app.slice(n.start, n.end);
  };
  const translations = ast.body.find((n) => n.type === "VariableDeclaration" && n.declarations.some((d) => d.id.name === "TRANSLATIONS"));
  const start = html.indexOf('<div id="screen-finished-label-mgmt"');
  const end = html.indexOf("\n<!--", start);
  assert(start > 0 && end > start);
  const screen = html.slice(start, end).replace('id="screen-finished-label-mgmt" class="screen"', 'id="screen-finished-label-mgmt" class="screen active"');
  const script = app.slice(translations.start, translations.end) + "\n" + [
    "saveFinishedLabelIssue", "readFinishedLabelRecord", "finishedLabelValue", "setFinishedLabelValue",
    "resetFinishedLabelForm", "openFinishedLabelPrintPreview", "buildFinishedLabelPrintHtml",
    "buildFinishedLabelMarkup", "finishedLabelOutputText"
  ].map(fn).join("\n") + "\n" + String.raw`
var qaLang = new URLSearchParams(location.search).get('lang') || 'ja';
var currentLang = qaLang, APP_VERSION = 'synthetic', qaMode = 'success', qaCalls = [], qaAlerts = [], qaNotices = [], qaHistory = 0, qaPrints = 0, qaLogs = [];
var finishedLabelComponentsLoading = false, finishedLabelComponentError = '', finishedLabelLastIssuedRecord = null, finishedLabelSelectedHistoryId = null, finishedLabelLastQueuedJob = null;
var finishedLabelSelectedProduct = { dkd_shohin_id: 1, gltek_part_number: 'G0102-10056' };
function t(k) { return TRANSLATIONS[qaLang][k] || TRANSLATIONS.ja[k] || k; }
function tf(k, values) { return t(k).replace(/\{(\w+)\}/g, (_, key) => values[key]); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function canEditFinishedLabelMgmt() { return qaMode !== 'denied'; }
function finishedLabelUsesRemotePrintQueue() { return qaMode.startsWith('remote'); }
function selectedFinishedLabelVariant() { return {product_variant_id: 10, product_kind: 'rebuilt'}; }
function productDkdId(p) { return p.dkd_shohin_id; }
function normalizeProductKind(k) { return k; }
function finishedLabelCategoryForProduct() { return 'starter'; }
function specNumberText() { return ''; }
function readFinishedLabelComponents() { return [{component_id: 21, quantity: 1}]; }
function updateFinishedLabelQrPayload() {}
function updateFinishedLabelSaveButton() { document.getElementById('btn-finished-label-save').disabled = false; }
function renderFinishedLabelLayoutPreview() {}
function renderFinishedBoxLabelLayoutPreview() {}
function renderFinishedLabelIssuedResult(record) { window.qaRendered = record; }
async function writeLog(...args) { qaLogs.push(args); }
async function loadFinishedLabelHistory() { qaHistory++; }
function showDcatsAutoNotice(message) { qaNotices.push(message); }
function finishedLabelMobilePrintErrorText(e) { return e.message; }
function finishedProductSerialQrDataUrl() { return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='; }
function printFinishedLabelWindowWhenReady() { qaPrints++; }
window.alert = message => qaAlerts.push(message);
window.open = () => qaMode === 'blocked' ? null : ({closed:false,qaHtml:'',close(){this.closed=true;},document:{open(){},write(text){window.qaPrintedHtml=text;},close(){}}});
var sb = { async rpc(name, args) {
  qaCalls.push({name,args});
  if (qaMode === 'delayed') await new Promise(resolve => window.qaResolveIssue = resolve);
  if (qaMode === 'issue-error') return {error:{message:'synthetic issuance error'}};
  return {data:{issue_id:91,issue_code:'FB2026-0000091',quantity:args.target_quantity,stock_qty_after:args.target_quantity,units:Array.from({length:args.target_quantity},(_,i)=>({manufacturing_serial:'M2026-'+String(i+1).padStart(7,'0'),gltek_part_number:'G0102-10056'}))}};
}};
async function enqueueAndWaitForFinishedLabelPrint(record,target,eventType,reason) {
  window.qaQueue = {record,target,eventType,reason};
  if (qaMode === 'remote-error' || qaMode === 'remote-pending') { var e = new Error('synthetic print queue error');e.finishedLabelPrintPending=qaMode==='remote-pending';throw e; }
  return {job_id:7,status:'sent'};
}
document.getElementById('finished-label-mode-hub').hidden = true;
document.getElementById('finished-label-workspace').hidden = false;
document.querySelectorAll('[data-finished-label-box-only]').forEach(e=>e.hidden=true);
document.getElementById('finished-label-print-station').hidden = true;
document.querySelectorAll('[data-i18n]').forEach(e=>e.textContent=t(e.dataset.i18n));
document.getElementById('btn-finished-label-save').addEventListener('click',()=>{window.qaSaving=saveFinishedLabelIssue();});
document.getElementById('btn-finished-label-clear').addEventListener('click',()=>resetFinishedLabelForm(finishedLabelSelectedProduct,null));
window.qaReady = true;
`;
  return {
    "/": { type: "text/html; charset=utf-8", body: '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body>' + screen + '<script src="/fixture.js"></script></body></html>' },
    "/fixture.js": { type: "application/javascript; charset=utf-8", body: script },
    "/styles.css": { type: "text/css", body: fs.readFileSync(path.join(root, "styles.css")) },
    "/print.css": { type: "text/css", body: fs.readFileSync(path.join(root, "print.css")) }
  };
}

async function run() {
  const { chromium } = require(process.env.WARRANTY_PLAYWRIGHT_MODULE || "playwright");
  const out = process.env.WARRANTY_QA_OUTPUT || path.join(root, "outputs/finished-label-print-qa");
  fs.mkdirSync(out, { recursive: true });
  const files = fixtureFiles(), results = [];
  const server = http.createServer((req, res) => {
    const file = files[new URL(req.url, "http://localhost").pathname];
    res.writeHead(file ? 200 : 404, { "Content-Type": file ? file.type : "text/plain", "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'none'; img-src 'self' data:" });
    res.end(file ? file.body : "");
  });
  let browser;
  try {
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    browser = await chromium.launch({ headless: true });
    const base = "http://127.0.0.1:" + server.address().port;
    for (const [width, height] of [[1440,900],[1280,720],[1024,768],[390,844],[320,640]]) {
      for (const lang of ["ja", "en", "zh"]) {
        const p = await browser.newPage({ viewport: { width, height } }), errors = [];
        p.on("pageerror", e => errors.push(e.message));
        await p.goto(base + "/?lang=" + lang);
        await p.waitForFunction(() => window.qaReady);
        const quantity = p.locator("#finished-label-quantity");
        assert.equal(await quantity.inputValue(), "1");
        assert.equal(await quantity.count(), 1);
        for (const selector of ["#finished-label-quantity", "#btn-finished-label-save"]) {
          const b = await p.locator(selector).boundingBox();
          assert(b && b.x >= 0 && b.y >= 0 && b.x+b.width <= width && b.y+b.height <= height, `${selector} outside initial viewport ${width}/${lang}: ${JSON.stringify(b)}`);
        }
        assert.equal(await p.evaluate(() => document.getElementById('finished-label-quantity').labels.length), 1);
        await quantity.focus();await quantity.press("ArrowUp");assert.equal(await quantity.inputValue(), "2");
        await quantity.fill("3");await p.locator("#btn-finished-label-save").click();
        await p.evaluate(() => qaSaving);
        assert.equal(await p.evaluate(() => qaCalls.length), 1);
        assert.equal(await p.evaluate(() => qaCalls[0].args.target_quantity), 3);
        assert.equal(await p.evaluate(() => finishedLabelLastIssuedRecord.printCount), 1);
        assert.equal(await p.evaluate(() => finishedLabelLastIssuedRecord.units.length), 3);
        assert.equal(await p.evaluate(() => qaAlerts.length), 0);
        assert.equal(await p.evaluate(() => qaHistory), 1);
        assert.equal(await p.evaluate(() => qaLogs.length), 1);
        assert.equal(await p.evaluate(() => (qaPrintedHtml.match(/class='serial-label'/g)||[]).length), 3);
        await p.locator("#btn-finished-label-clear").click();assert.equal(await quantity.inputValue(), "1");
        assert.deepEqual(errors, []);
        if (lang === "ja") await p.screenshot({path:path.join(out,`finished-label-${width}.png`),fullPage:true});
        results.push({width,height,lang,success:true});await p.close();
      }
    }
    for (const mode of ["denied","loading","component-error","issue-error","blocked","remote-success","remote-error","remote-pending","delayed","invalid"]) {
      const p = await browser.newPage({viewport:{width:1280,height:720}}), errors=[];
      p.on("pageerror",e=>errors.push(e.message));await p.goto(base);await p.waitForFunction(()=>window.qaReady);
      await p.evaluate(mode=>{qaMode=mode;finishedLabelComponentsLoading=mode==='loading';finishedLabelComponentError=mode==='component-error'?'synthetic component error':'';},mode);
      if(mode==='invalid')await p.locator('#finished-label-quantity').fill('0');
      await p.locator('#btn-finished-label-save').click();
      if(mode==='delayed') {
        await p.waitForFunction(()=>!!window.qaResolveIssue);
        assert.equal(await p.locator('#btn-finished-label-save').isDisabled(),true);
        await p.evaluate(()=>document.getElementById('btn-finished-label-save').click());
        assert.equal(await p.evaluate(()=>qaCalls.length),1,'pending issuance must ignore a second activation');
        await p.evaluate(()=>qaResolveIssue());
      }
      await p.evaluate(()=>qaSaving);
      if(mode==='remote-success'||mode==='delayed')assert.equal(await p.evaluate(()=>qaAlerts.length),0);
      else assert.equal(await p.evaluate(()=>qaAlerts.length),1,mode+' must report an error');
      if(['denied','loading','component-error','blocked','invalid'].includes(mode))assert.equal(await p.evaluate(()=>qaCalls.length),0);
      if(mode.startsWith('remote')) {assert.equal(await p.evaluate(()=>qaCalls.length),1);assert.equal(await p.evaluate(()=>qaHistory),1);assert.equal(await p.evaluate(()=>qaQueue.target),'finished_product');}
      if(mode==='remote-pending')assert.equal(await p.locator('#btn-finished-label-preview').isDisabled(),true);
      assert.deepEqual(errors,[]);results.push({mode,success:true});await p.close();
    }
    fs.writeFileSync(path.join(out,"finished-label-print-results.json"),JSON.stringify({passed:true,synthetic:true,productionWrites:0,results},null,2));
    console.log("Finished-label print browser QA passed: "+results.length+" scenarios");
  } finally {
    if(browser)await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
}
module.exports={fixtureFiles};
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});
