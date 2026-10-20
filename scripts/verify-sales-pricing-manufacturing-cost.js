const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const styles = fs.readFileSync(path.join(root, "styles.css"), "utf8");

function sourceBetween(startText, endText) {
  const start = source.indexOf(startText);
  const end = source.indexOf(endText, start + startText.length);
  if (start < 0 || end < start) throw new Error(`${startText} could not be isolated`);
  return source.slice(start, end);
}

[
  "var currentSalesPricingManufacturingCost = null",
  "var salesPricingMgmtManufacturingCostMap = {}",
  "async function fetchSalesPricingManufacturingCostMap",
  "function renderSalesPricingManufacturingCostMini",
  "function salesPricingManufacturingCostCellHtml"
].forEach((fragment) => {
  if (!source.includes(fragment)) throw new Error(`sales pricing manufacturing cost wiring is missing: ${fragment}`);
});

if ((source.match(/sales_manufacturing_cost:/g) || []).length !== 3 ||
    (source.match(/sales_manufacturing_cost_none:/g) || []).length !== 3 ||
    (source.match(/sales_manufacturing_cost_loading:/g) || []).length !== 3) {
  throw new Error("sales manufacturing cost labels must be translated for all supported languages");
}

const fetchSource = sourceBetween("async function fetchSalesPricingManufacturingCostMap", "async function fetchSalesPricingManufacturingCost");
[
  "canViewManufacturingCostMgmt()",
  "manufacturing_cost_list_items",
  "manufacturing_cost_lists",
  "total_cost_jpy_snapshot",
  ".eq(\"product_kind\", targetKind)",
  ".eq(\"is_active\", true)"
].forEach((fragment) => {
  if (!fetchSource.includes(fragment)) throw new Error(`manufacturing cost lookup is missing: ${fragment}`);
});

const totalSource = sourceBetween("function parsePriceNumber", "async function fetchSalesPricingManufacturingCostMap");
const totalSandbox = {};
vm.runInNewContext(`${totalSource}
result = salesPricingManufacturingCostTotal({
  total_cost_jpy_snapshot: 3290,
  parts_cost_jpy_snapshot: 780,
  core_cost_jpy_snapshot: 1500,
  labor_cost_jpy_snapshot: 0,
  transport_cost_jpy_snapshot: 200,
  selling_expense_jpy_snapshot: 510,
  core_return_shipping_cost_jpy_snapshot: 300
});
legacyResult = salesPricingManufacturingCostTotal({ total_cost_jpy_snapshot: 2280 });`, totalSandbox);
if (totalSandbox.result !== 3290) {
  throw new Error("sales pricing must display the GLTEK and DKD cost total");
}
if (totalSandbox.legacyResult !== 2280) {
  throw new Error("sales pricing must retain the saved total when legacy breakdown data is incomplete");
}

const openSource = sourceBetween("async function openSalesPricingForCurrent", "async function saveSalesPricing");
if (!openSource.includes("loadSalesPricingCurrentManufacturingCost()")) {
  throw new Error("sales pricing form must load manufacturing cost");
}
if (!openSource.includes("kindSelect.onchange") ||
    !openSource.includes("loadSalesPricingCurrentManufacturingCost()")) {
  throw new Error("sales pricing kind switch must refresh manufacturing cost");
}

const listSource = sourceBetween("async function loadSalesPricingMgmt", "async function openSalesPricingMgmtRow");
[
  "salesPricingMgmtManufacturingCostMap = {}",
  "fetchSalesPricingManufacturingCostMap(ids, \"rebuilt\")",
  "var showManufacturingCost = canViewManufacturingCostMgmt()",
  "salesPricingManufacturingCostCellHtml(manufacturingCost)"
].forEach((fragment) => {
  if (!listSource.includes(fragment)) throw new Error(`sales pricing list manufacturing cost display is missing: ${fragment}`);
});

if (!html.includes('id="sales-pricing-manufacturing-cost"')) {
  throw new Error("sales pricing form must contain the manufacturing cost mini display");
}
if (!styles.includes(".sales-pricing-manufacturing-cost") ||
    !styles.includes(".sales-pricing-manufacturing-cost-cell")) {
  throw new Error("sales pricing manufacturing cost display styles are missing");
}

const renderListSource = sourceBetween("function renderSalesPricingMgmt()", "async function openSalesPricingMgmtRow");
if (renderListSource.includes("salesPricingManufacturingCostMeta(manufacturingCost)") ||
    renderListSource.includes("price.price_basis") ||
    renderListSource.includes("price.effective_start")) {
  throw new Error("sales pricing list must not show explanatory text below manufacturing cost or base price");
}
if (!renderListSource.includes("sales-pricing-dkd-line") || !renderListSource.includes("sales-pricing-category")) {
  throw new Error("DKD and category must be displayed on one line");
}

// Individual product search must work independently of the saved-list preview.
(async () => {
  const assert = require("node:assert/strict");
  const {parseHTML} = require("linkedom");
  const {window} = parseHTML(html);
  const doc = window.document;
  const lookup = doc.getElementById("sales-pricing-product-search");
  assert.ok(lookup.contains(doc.getElementById("sales-pricing-mgmt-search")));
  assert.ok(lookup.contains(doc.getElementById("sales-pricing-mgmt-list")));
  assert.equal(lookup.nextElementSibling.id, "sales-pricing-lists");
  const calls = [], opened = [], alerts = [];
  let allowed = true;
  const product = {dkd_shohin_id:77,manufacturer_part_number:"OUTSIDE-LIST",genuine_part_number:"OEM-77",manufacturer:"DENSO"};
  const ctx = {document:doc, canViewSalesPricing:()=>allowed, alert:x=>alerts.push(x),
    salesPricingMgmtRows:[],salesPricingMgmtPriceMap:{},salesPricingMgmtRank1Map:{},salesPricingMgmtManufacturingCostMap:{},
    CORE_PRODUCT_FAST_SELECT:"fixture", currentProduct:null,currentCoreDkdShohinId:null,
    fetchCoreProductMasterMatches:async q=>{calls.push(q);return q==="ERROR"?{error:{message:"Fixture network failure"}}:{data:q==="NO-HIT"?[]:[product]};},
    fetchSourceAliasProducts:async()=>({data:[]}),
    filterVisibleProducts:x=>x,normalizeCoreProductFastRows:x=>x,
    fetchInternalRank1PriceMap:async()=>({"77|rebuilt":5800}),fetchSalesPricingManufacturingCostMap:async()=>({}),
    canViewBasePrice:()=>true,canViewManufacturingCostMgmt:()=>true,
    formatYenCurrency:x=>"¥"+x,tCat:x=>x||"",t:x=>x,
    salesPricingManufacturingCostCellHtml:()=>"—",esc:x=>String(x==null?"":x).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])),
    openSalesPricingForCurrent:async()=>{opened.push(ctx.currentCoreDkdShohinId);},
    sb:{from:()=>({select(){return this;},in(){return this;},eq(){return this;},limit(){return this;},then(resolve){return Promise.resolve({data:[]}).then(resolve);}})}
  };
  vm.createContext(ctx);
  vm.runInContext(sourceBetween("async function loadSalesPricingMgmt()", "async function openSalesPricingListProduct(")+
    sourceBetween("async function openSalesPricingMgmtRow(", "async function enterPurchaseMgmt("),ctx);
  vm.runInContext(sourceBetween('document.getElementById("btn-sales-pricing-mgmt-search").addEventListener','document.getElementById("btn-purchase-mgmt-search").addEventListener'),ctx);
  const input=doc.getElementById("sales-pricing-mgmt-search");
  input.value="OUTSIDE-LIST";doc.getElementById("btn-sales-pricing-mgmt-search").click();await new Promise(setImmediate);
  assert.deepEqual(calls,["OUTSIDE-LIST"]);assert.ok(doc.querySelector('[data-sales-price-dkd="77"]'));
  assert.match(doc.getElementById("sales-pricing-mgmt-list").textContent,/5800/);
  doc.querySelector('[data-sales-price-dkd="77"]').click();await new Promise(setImmediate);assert.deepEqual(opened,[77]);
  // Loading a saved list must not narrow the independent product search.
  doc.getElementById("sales-pricing-lists").hidden=false;input.value="OUTSIDE-LIST";
  const enter=new window.Event("keydown");enter.key="Enter";input.dispatchEvent(enter);await new Promise(setImmediate);assert.equal(calls.length,2);
  input.value="NO-HIT";await ctx.loadSalesPricingMgmt();assert.match(doc.getElementById("sales-pricing-mgmt-list").textContent,/no_results/);
  input.value="ERROR";await ctx.loadSalesPricingMgmt();assert.match(doc.getElementById("sales-pricing-mgmt-list").textContent,/Fixture network failure/);
  input.value="";await ctx.loadSalesPricingMgmt();assert.match(doc.getElementById("sales-pricing-mgmt-list").textContent,/sales_pricing_mgmt_hint/);
  allowed=false;input.value="OUTSIDE-LIST";const before=calls.length;await ctx.loadSalesPricingMgmt();assert.equal(calls.length,before);assert.equal(alerts.length,1);
  console.log("sales pricing cost and independent product search: click/Enter, saved-list independence, exact individual identity, no match, empty, error and permissions passed");
})().catch(error=>{console.error(error);process.exitCode=1;});
