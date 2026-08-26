const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

function requireFragment(source, fragment, label) {
  if (!source.includes(fragment)) throw new Error(`${label} is missing: ${fragment}`);
}

function sourceBetween(source, startText, endText) {
  const start = source.indexOf(startText);
  const end = source.indexOf(endText, start + startText.length);
  if (start < 0 || end < start) throw new Error(`${startText} could not be isolated`);
  return source.slice(start, end);
}

requireFragment(app, 'var currentProductionComponentSummaryKind = "rebuilt";', "rebuilt summary default");

[
  'production_component_part_number: "部品品番"',
  'production_component_part_number: "Part No."',
  'production_component_part_number: "零件品号"',
  'production_component_interchange_procurement: "互・調達区分"',
  'production_component_interchange_procurement: "Int. / Procurement"',
  'production_component_interchange_procurement: "互・采购区分"'
].forEach((fragment) => requireFragment(app, fragment, "production component translations"));

const languageSource = sourceBetween(app, "async function applyLanguage", "function markAppUpdateActivity");
[
  'if (isScreenActive("production-search"))',
  "renderProductionList();",
  "await renderProductionDetail(currentProductionRow || null);"
].forEach((fragment) => requireFragment(languageSource, fragment, "production language refresh"));

const detailSource = sourceBetween(app, "async function renderProductionDetail", "async function loadProductionDetailData");
[
  'currentProductionComponentSummaryKind = "rebuilt"',
  "renderProductionComponentSummaryShell(currentProductionComponentSummaryKind)",
  "loadProductionComponentSummaryForRow(row, currentProductionComponentSummaryKind, seq)",
  "data-production-component-summary-kind",
  "production-component-summary-open"
].forEach((fragment) => requireFragment(detailSource, fragment, "production detail component summary"));

if (detailSource.includes("production-open-components") || detailSource.includes("componentButtonHtml")) {
  throw new Error("product overview must not contain a duplicate component-management button");
}

const masterIndex = detailSource.indexOf("production-section production-master-section");
const componentIndex = detailSource.indexOf("renderProductionComponentSummaryShell(currentProductionComponentSummaryKind)");
const compatibilityIndex = detailSource.indexOf("production-section production-kikan-section");
if (!(masterIndex < componentIndex && componentIndex < compatibilityIndex)) {
  throw new Error("component summary must appear below the product overview and above compatibility");
}

const summarySource = sourceBetween(app, "function renderProductionComponentSummaryShell", "async function openProductionComponents");
[
  'var kinds = ["rebuilt", "aftermarket_new"]',
  "production-component-kind-switch",
  "btn-component-action detail-inline-action",
  "component-icon",
  "production-component-summary-table",
  't("production_component_part_number")',
  't("component_name")',
  't("component_quantity")',
  't("production_component_interchange_procurement")',
  't("component_replacement_rate")',
  "component_manufacturer_part_number",
  "component_genuine_part_number",
  "component_name",
  "component_part_name",
  "manufacturing_memo",
  't("component_manufacturing_memo")',
  "production-component-summary-memo",
  "quantity",
  "formatComponentInterchange(row)",
  "componentProcurementCategoryLabel(row.procurement_category)",
  "formatComponentRate(row.replacement_rate)",
  'sb.from("assembly_component_usage_details")',
  '.eq("dkd_shohin_id", dkdId)',
  '.eq("product_kind", kind)',
  '.eq("is_catalog_evidence", false)'
].forEach((fragment) => requireFragment(summarySource, fragment, "production component summary contract"));

if (summarySource.includes("<th>部品品番</th>") || summarySource.includes("<th>互・調達区分</th>")) {
  throw new Error("production component summary headings must follow the active language");
}

const procurementSource = sourceBetween(app, "function componentProcurementCategoryLabel", "function componentProcurementOptionsHtml");
[
  '"新品交換": "component_procurement_new_replacement"',
  '"New Replacement": "component_procurement_new_replacement"',
  '"新品更换": "component_procurement_new_replacement"',
  '"new_replacement": "component_procurement_new_replacement"'
].forEach((fragment) => requireFragment(procurementSource, fragment, "localized procurement aliases"));

if (summarySource.includes("unit_price_jpy") || summarySource.includes("formatComponentYen")) {
  throw new Error("production component summary must not select or render component unit prices");
}

[
  ".production-component-summary-section { display: flex; flex-direction: column; min-height: 0; overflow: hidden; }",
  ".production-component-kind-switch { display: grid; grid-template-columns: repeat(2, minmax(64px, 1fr));",
  ".production-component-summary-wrap { flex: 1 1 auto; min-height: 0; overflow: auto; }",
  ".production-component-summary-table { width: 100%; border-collapse: collapse; table-layout: fixed;",
  ".production-component-summary-table th { position: sticky; top: 0;",
  ".production-component-summary-table td.production-component-summary-memo { line-height: 1.4; white-space: pre-wrap; }",
  ".production-component-summary-table { min-width: 680px; }"
].forEach((fragment) => requireFragment(css, fragment, "production component summary CSS"));

console.log("Production component summary verified.");
