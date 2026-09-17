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

for (const fragment of [
  'id="manufacturing-cost-gltek-title"',
  'id="manufacturing-cost-dkd-title"',
  'id="manufacturing-cost-transport-cost" type="number" min="0" step="1" value="0"',
  'id="manufacturing-cost-packaging-cost" type="number" min="0" step="1" value="500"',
  'id="manufacturing-cost-documents-cost" type="number" min="0" step="1" value="10"',
  'id="manufacturing-cost-selling-expense" type="number" value="510" readonly',
  'id="manufacturing-cost-core-return-shipping-cost" type="number" min="0" step="1" value="0"'
]) {
  if (!html.includes(fragment)) throw new Error(`manufacturing cost company input is missing: ${fragment}`);
}
if (html.includes('id="manufacturing-cost-labor-rate"')) {
  throw new Error("the retired labor-rate input must not be shown");
}

const totalSource = sourceBetween("function manufacturingCostTotals", "function manufacturingCostParseQty");
const sandbox = { manufacturingCostSettings() { return {}; } };
vm.runInNewContext(`${totalSource}; result = manufacturingCostTotals(1200, 1800, {
  laborAmount: 1000,
  transportCost: 600,
  packagingCost: 500,
  documentsCost: 10,
  coreReturnShippingCost: 900
});`, sandbox);

const expected = {
  laborCost: 1000,
  transportCost: 600,
  packagingCost: 500,
  documentsCost: 10,
  sellingExpense: 510,
  coreReturnShippingCost: 900,
  gltekSubtotal: 4600,
  dkdSubtotal: 1410,
  totalCost: 6010
};
for (const [key, value] of Object.entries(expected)) {
  if (sandbox.result[key] !== value) throw new Error(`${key} must be ${value}, got ${sandbox.result[key]}`);
}

const coreSource = sourceBetween("function manufacturingCostCoreCostForProduct", "function manufacturingCostCoreCostForCategory");
if (/core_charge_jpy|coreReturnPolicyForKind|core_product_variants/.test(coreSource)) {
  throw new Error("GLTEK core acquisition cost must not use customer billing settings");
}

const saveSource = sourceBetween("async function saveManufacturingCostList", "async function loadManufacturingCostList");
for (const fragment of [
  "labor_rate_percent: 0",
  "transport_cost_jpy: settings.transportCost",
  "packaging_cost_jpy: settings.packagingCost",
  "included_documents_cost_jpy: settings.documentsCost",
  "core_return_shipping_cost_jpy: settings.coreReturnShippingCost",
  "transport_cost_jpy_snapshot: Math.round(row.transportCost || 0)",
  "packaging_cost_jpy_snapshot: Math.round(row.packagingCost || 0)",
  "included_documents_cost_jpy_snapshot: Math.round(row.documentsCost || 0)",
  "core_return_shipping_cost_jpy_snapshot: Math.round(row.coreReturnShippingCost || 0)"
]) {
  if (!saveSource.includes(fragment)) throw new Error(`manufacturing cost persistence is missing: ${fragment}`);
}

const exportSource = sourceBetween("function exportManufacturingCostRows", "async function searchManufacturingCostCandidates");
for (const heading of [
  "GLTEK_コア代",
  "GLTEK_DKD間輸送コスト",
  "DKD_化粧箱",
  "DKD_同梱帳票類",
  "DKD_コア返送費",
  "総原価"
]) {
  if (!exportSource.includes(heading)) throw new Error(`manufacturing cost CSV is missing: ${heading}`);
}

for (const fragment of [
  ".manufacturing-cost-company-config.gltek",
  ".manufacturing-cost-company-config.dkd",
  ".manufacturing-cost-breakdown",
  ".manufacturing-cost-company-subtotal.gltek",
  ".manufacturing-cost-company-subtotal.dkd"
]) {
  if (!styles.includes(fragment)) throw new Error(`manufacturing cost company style is missing: ${fragment}`);
}

for (const key of [
  "manufacturing_cost_gltek_title:",
  "manufacturing_cost_dkd_title:",
  "manufacturing_cost_transport_cost:",
  "manufacturing_cost_packaging_cost:",
  "manufacturing_cost_documents_cost:",
  "manufacturing_cost_core_return_shipping_cost:"
]) {
  if ((source.match(new RegExp(key, "g")) || []).length !== 3) {
    throw new Error(`${key} must be translated for all supported languages`);
  }
}

console.log("manufacturing cost company breakdown guard passed");
