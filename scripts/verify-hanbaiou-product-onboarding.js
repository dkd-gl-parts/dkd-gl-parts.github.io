const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8").replace(/\r\n/g, "\n");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8").replace(/\r\n/g, "\n");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8").replace(/\r\n/g, "\n");

function requireFragment(target, fragment, message) {
  if (!target.includes(fragment)) throw new Error(message || `Missing Sales King onboarding contract: ${fragment}`);
}

function functionSource(name) {
  const markers = [`function ${name}(`, `async function ${name}(`];
  const start = markers.map((marker) => source.indexOf(marker)).find((index) => index >= 0);
  if (start == null) throw new Error(`Function is missing: ${name}`);
  const stops = [
    source.indexOf("\nfunction ", start + 1),
    source.indexOf("\nasync function ", start + 1),
  ].filter((index) => index >= 0);
  return source.slice(start, stops.length ? Math.min(...stops) : source.length);
}

for (const id of [
  "sales-accounting-hanbaiou-guide",
  "sales-accounting-hanbaiou-guide-summary",
  "sales-accounting-hanbaiou-issue",
  "sales-accounting-hanbaiou-export",
  "sales-accounting-hanbaiou-confirm",
  "sales-accounting-hanbaiou-reset",
  "sales-accounting-hanbaiou-product-list",
  "sales-accounting-hanbaiou-validation",
  "sales-accounting-hanbaiou-validation-rows",
  "sales-accounting-hanbaiou-history",
]) requireFragment(html, `id="${id}"`);

const load = functionSource("loadSalesAccountingExportData");
requireFragment(load, 'sb.rpc("get_hanbaiou_product_catalog_status")');
requireFragment(load, "catalogRequest");
if (/salesAccountingHanbaiouCandidateVariantIds|target_product_variant_ids/.test(load)) {
  throw new Error("Product-master candidates must not be derived from sales-order items");
}

const issue = functionSource("issueHanbaiouProductCodes");
requireFragment(issue, 'sb.rpc("issue_hanbaiou_catalog_product_codes")');
requireFragment(issue, 't("hanbaiou_catalog_issue_progress")');

const master = functionSource("exportHanbaiouProductMaster");
requireFragment(master, 'sb.rpc("create_hanbaiou_catalog_product_master_export")');
requireFragment(master, "prepareDcatsHanbaiouExportDirectory()");
requireFragment(master, "await downloadSalesAccountingExportFile(data, exportDirectory)");
requireFragment(master, "catalog.incomplete_count");
requireFragment(master, 't("hanbaiou_catalog_incomplete_block")');
requireFragment(master, "scrollToSalesAccountingHanbaiouValidation()");
if (master.indexOf("prepareDcatsHanbaiouExportDirectory()") > master.indexOf('sb.rpc("create_hanbaiou_catalog_product_master_export"')) {
  throw new Error("The Sales King folder must be ready before creating a product ledger export");
}
if (master.indexOf("prepareDcatsHanbaiouExportDirectory()") < master.indexOf("catalog.incomplete_count")) {
  throw new Error("Product-key completeness must be checked before opening the export folder picker");
}

const confirm = functionSource("confirmHanbaiouProductRegistration");
requireFragment(confirm, 'sb.rpc("confirm_hanbaiou_catalog_product_registration"');
requireFragment(confirm, "target_batch_id: batchId");
requireFragment(confirm, 't("hanbaiou_catalog_confirm_prompt")');

const reset = functionSource("resetHanbaiouProductMasterState");
requireFragment(reset, 'sb.rpc("reset_hanbaiou_product_master_state"');
requireFragment(reset, "expected_resettable_count: resettableCount");
requireFragment(reset, 'tf("hanbaiou_catalog_reset_prompt"');
requireFragment(reset, 't("hanbaiou_catalog_reset_progress")');

const renderGuide = functionSource("renderSalesAccountingHanbaiouGuide");
for (const fragment of [
  "catalog.incomplete_products",
  "catalog.missing_gltek_count",
  "catalog.missing_genuine_count",
  "catalog.missing_manufacturer_count",
  "product.category_label",
  "product.gltek_part_number",
  "product.genuine_part_number",
  "product.manufacturer_part_number",
  "product.missing_fields",
]) requireFragment(renderGuide, fragment);

requireFragment(html, "台帳は「商品」、ファイルは「区切り文字形式ファイル（*.csv, *.txt）」");
if (html.includes("商品台帳（販売王20～形式）")) {
  throw new Error("The Sales King import guide must match the actual import wizard");
}

const candidates = functionSource("renderSalesAccountingExportCandidates");
requireFragment(candidates, "salesAccountingExportProductCodeHtml(item, profile)");
requireFragment(candidates, "data-sales-accounting-open-onboarding");
requireFragment(candidates, "sales-accounting-export-order-simple");

for (const fragment of [
  'document.getElementById("sales-accounting-hanbaiou-issue").addEventListener("click", issueHanbaiouProductCodes)',
  'document.getElementById("sales-accounting-hanbaiou-export").addEventListener("click", exportHanbaiouProductMaster)',
  'document.getElementById("sales-accounting-hanbaiou-confirm").addEventListener("click", confirmHanbaiouProductRegistration)',
  'document.getElementById("sales-accounting-hanbaiou-reset").addEventListener("click", resetHanbaiouProductMasterState)',
]) requireFragment(source, fragment);

for (const fragment of [
  ".sales-accounting-hanbaiou-guide",
  ".sales-accounting-hanbaiou-steps",
  ".sales-accounting-hanbaiou-product-list",
  ".sales-accounting-hanbaiou-metric",
  ".sales-accounting-hanbaiou-validation",
  ".sales-accounting-hanbaiou-missing-tags",
  ".sales-accounting-hanbaiou-status.registered",
]) requireFragment(css, fragment);

for (const key of [
  "hanbaiou_catalog_pending_summary",
  "hanbaiou_catalog_issue_button",
  "hanbaiou_catalog_export_button",
  "hanbaiou_catalog_confirm_button",
  "hanbaiou_catalog_ready",
  "hanbaiou_catalog_incomplete",
  "hanbaiou_catalog_validation_summary",
  "hanbaiou_catalog_gltek_part",
  "hanbaiou_catalog_genuine_part",
  "hanbaiou_catalog_manufacturer_part",
  "hanbaiou_catalog_reset_button",
  "hanbaiou_catalog_reset_prompt",
  "hanbaiou_catalog_reset_done",
]) {
  const matches = source.match(new RegExp(`${key}:`, "g")) || [];
  if (matches.length !== 3) throw new Error(`${key} must be translated in Japanese, English, and Chinese`);
}

console.log("Sales King product onboarding UI verification passed.");
