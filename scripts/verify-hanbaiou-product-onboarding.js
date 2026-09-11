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
  "sales-accounting-hanbaiou-product-list",
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
if (master.indexOf("prepareDcatsHanbaiouExportDirectory()") > master.indexOf('sb.rpc("create_hanbaiou_catalog_product_master_export"')) {
  throw new Error("The Sales King folder must be ready before creating a product ledger export");
}

const confirm = functionSource("confirmHanbaiouProductRegistration");
requireFragment(confirm, 'sb.rpc("confirm_hanbaiou_catalog_product_registration"');
requireFragment(confirm, "target_batch_id: batchId");
requireFragment(confirm, 't("hanbaiou_catalog_confirm_prompt")');

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
]) requireFragment(source, fragment);

for (const fragment of [
  ".sales-accounting-hanbaiou-guide",
  ".sales-accounting-hanbaiou-steps",
  ".sales-accounting-hanbaiou-product-list",
  ".sales-accounting-hanbaiou-metric",
  ".sales-accounting-hanbaiou-status.registered",
]) requireFragment(css, fragment);

for (const key of [
  "hanbaiou_catalog_pending_summary",
  "hanbaiou_catalog_issue_button",
  "hanbaiou_catalog_export_button",
  "hanbaiou_catalog_confirm_button",
]) {
  const matches = source.match(new RegExp(`${key}:`, "g")) || [];
  if (matches.length !== 3) throw new Error(`${key} must be translated in Japanese, English, and Chinese`);
}

console.log("Sales King product onboarding UI verification passed.");
