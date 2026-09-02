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
requireFragment(load, 'sb.rpc("list_hanbaiou_product_onboarding"');
requireFragment(load, "salesAccountingHanbaiouCandidateVariantIds()");

const issue = functionSource("issueHanbaiouProductCodes");
requireFragment(issue, 'sb.rpc("issue_hanbaiou_product_codes"');
requireFragment(issue, "商品コードを発行しました");

const master = functionSource("exportHanbaiouProductMaster");
requireFragment(master, 'sb.rpc("create_hanbaiou_product_master_export"');
requireFragment(master, "downloadSalesAccountingExportFile(data)");

const confirm = functionSource("confirmHanbaiouProductRegistration");
requireFragment(confirm, 'sb.rpc("confirm_hanbaiou_product_registration"');
requireFragment(confirm, "販売王登録済みにしました");

const candidates = functionSource("renderSalesAccountingExportCandidates");
requireFragment(candidates, "salesAccountingExportProductCodeHtml(item, profile)");
requireFragment(candidates, "data-sales-accounting-open-onboarding");

for (const fragment of [
  'document.getElementById("sales-accounting-hanbaiou-issue").addEventListener("click", issueHanbaiouProductCodes)',
  'document.getElementById("sales-accounting-hanbaiou-export").addEventListener("click", exportHanbaiouProductMaster)',
  'document.getElementById("sales-accounting-hanbaiou-confirm").addEventListener("click", confirmHanbaiouProductRegistration)',
]) requireFragment(source, fragment);

for (const fragment of [
  ".sales-accounting-hanbaiou-guide",
  ".sales-accounting-hanbaiou-steps",
  ".sales-accounting-hanbaiou-product-list",
  ".sales-accounting-hanbaiou-status.registered",
]) requireFragment(css, fragment);

console.log("Sales King product onboarding UI verification passed.");
