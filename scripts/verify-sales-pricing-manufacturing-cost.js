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
  total_cost_jpy_snapshot: 2280,
  parts_cost_jpy_snapshot: 780,
  core_cost_jpy_snapshot: 1500,
  labor_cost_jpy_snapshot: 0,
  selling_expense_jpy_snapshot: 510
});
legacyResult = salesPricingManufacturingCostTotal({ total_cost_jpy_snapshot: 2280 });`, totalSandbox);
if (totalSandbox.result !== 2790) {
  throw new Error("sales pricing must display the sum of parts, core, labor, and selling expense");
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

console.log("sales pricing manufacturing cost guard passed");
