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
  "sales-accounting-hanbaiou-issue",
  "sales-accounting-hanbaiou-export",
  "sales-accounting-hanbaiou-confirm",
  "sales-accounting-hanbaiou-reset",
  "sales-accounting-hanbaiou-history",
  "sales-accounting-hanbaiou-latest-file",
  "sales-accounting-hanbaiou-export-message",
]) requireFragment(html, `id="${id}"`);

for (const key of [
  "hanbaiou_catalog_step_1_description",
  "hanbaiou_catalog_step_2_description",
  "hanbaiou_catalog_step_3_description",
  "hanbaiou_catalog_step_4_description",
  "hanbaiou_catalog_output_folder",
  "hanbaiou_catalog_output_file",
  "business_workspace_hanbaiou_picker_hint",
]) requireFragment(html, `data-i18n="${key}"`);

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
requireFragment(master, "state.hanbaiouLatestFileName = savedFileName");
requireFragment(master, 'tf("sales_accounting_product_master_saved_file"');
requireFragment(master, "catalog.ready_count");
requireFragment(master, 't("hanbaiou_catalog_no_ready")');
requireFragment(master, "scrollToSalesAccountingHanbaiouGuide()");
requireFragment(master, "setSalesAccountingHanbaiouExportMessage");
if (master.includes("scrollToSalesAccountingHanbaiouValidation")) {
  throw new Error("Product-master export errors must return to the compact guide, not a detail table");
}
if (master.indexOf("prepareDcatsHanbaiouExportDirectory()") > master.indexOf('sb.rpc("create_hanbaiou_catalog_product_master_export"')) {
  throw new Error("The Sales King folder must be ready before creating a product ledger export");
}
if (/if\s*\(Number\(catalog\.incomplete_count/.test(master)) {
  throw new Error("Incomplete products must not block export of products that have all three numbers");
}

const prepareDirectory = functionSource("prepareDcatsHanbaiouExportDirectory");
requireFragment(prepareDirectory, "var handle = dcatsHanbaiouExportDirectoryHandle;");
requireFragment(prepareDirectory, "if (!handle) return pickDcatsHanbaiouExportDirectory();");
if (/await loadDcatsHanbaiouExportDirectory/.test(prepareDirectory)) {
  throw new Error("The native folder picker must not lose click activation while loading IndexedDB");
}

const confirm = functionSource("confirmHanbaiouProductRegistration");
requireFragment(confirm, 'sb.rpc("confirm_hanbaiou_catalog_product_registration"');
requireFragment(confirm, "target_batch_id: batchId");
requireFragment(confirm, 't("hanbaiou_catalog_confirm_prompt")');

const reset = functionSource("resetHanbaiouProductMasterState");
requireFragment(reset, 'sb.rpc("reset_hanbaiou_sales_target_product_master_state"');
requireFragment(reset, "target_order_ids: resetTarget.orderIds");
requireFragment(reset, "expected_resettable_count: resettableCount");
requireFragment(reset, 'tf("hanbaiou_catalog_reset_prompt"');
requireFragment(reset, 't("hanbaiou_catalog_reset_progress")');

const resetTarget = functionSource("salesAccountingHanbaiouResetTarget");
requireFragment(resetTarget, "state && state.orders");
requireFragment(resetTarget, 'status === "exported" || status === "registered"');
requireFragment(resetTarget, "productVariantIds.add(productVariantId)");

const renderGuide = functionSource("renderSalesAccountingHanbaiouGuide");
const updateActions = functionSource("updateSalesAccountingHanbaiouActions");
requireFragment(renderGuide, 'document.getElementById("sales-accounting-hanbaiou-latest-file")');
requireFragment(renderGuide, "var latestFileName = state.hanbaiouLatestFileName;");
if (renderGuide.includes("salesAccountingHanbaiouBatchFileName(knownBatches[0])")) {
  throw new Error("Server export history must not be shown as a file saved to this PC");
}
if (/incomplete_products|sales-accounting-hanbaiou-(?:validation|missing-tags|product-list|metric|selected-summary|guide-summary|note)|3品番の不足明細|CSV対象/.test(renderGuide + updateActions + html + css)) {
  throw new Error("Product-master decision metrics and detail lists must not be displayed in the sales-data export screen");
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
  ".sales-accounting-hanbaiou-status.registered",
  ".sales-accounting-hanbaiou-export-message.error",
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
  "hanbaiou_catalog_no_ready",
  "hanbaiou_catalog_step_1_description",
  "hanbaiou_catalog_step_2_description",
  "hanbaiou_catalog_step_3_description",
  "hanbaiou_catalog_step_4_description",
  "hanbaiou_catalog_output_folder",
  "hanbaiou_catalog_output_file",
  "hanbaiou_catalog_output_file_empty",
  "hanbaiou_catalog_reset_description",
  "business_workspace_hanbaiou_picker_hint",
  "business_workspace_hanbaiou_ready_named",
  "sales_accounting_product_master_saved_file",
  "sales_accounting_product_master_resaved_file",
]) {
  const matches = source.match(new RegExp(`${key}:`, "g")) || [];
  if (matches.length !== 3) throw new Error(`${key} must be translated in Japanese, English, and Chinese`);
}

console.log("Sales King product onboarding UI verification passed.");
