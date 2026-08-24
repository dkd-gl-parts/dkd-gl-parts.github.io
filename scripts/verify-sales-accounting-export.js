const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8").replace(/\r\n/g, "\n");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8").replace(/\r\n/g, "\n");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8").replace(/\r\n/g, "\n");

function requireFragment(target, fragment, message) {
  if (!target.includes(fragment)) throw new Error(message || `Missing sales-accounting export contract: ${fragment}`);
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
  "sales-order-accounting-export",
  "sales-accounting-export-overlay",
  "sales-accounting-export-target",
  "sales-accounting-export-date-from",
  "sales-accounting-export-date-to",
  "sales-accounting-export-include-exported",
  "sales-accounting-export-check-all",
  "sales-accounting-export-candidate-list",
  "sales-accounting-export-history-list",
  "sales-accounting-export-create",
]) requireFragment(html, `id="${id}"`);

const load = functionSource("loadSalesAccountingExportData");
for (const fragment of [
  'sb.rpc("list_sales_accounting_export_candidates"',
  'sb.rpc("list_sales_accounting_export_batches"',
  "target_date_from: state.dateFrom || null",
  "include_exported: state.includeExported",
]) requireFragment(load, fragment);

const saveCode = functionSource("saveSalesAccountingExportCode");
for (const fragment of [
  'sb.rpc("save_sales_accounting_export_code"',
  "mapping_kind: button.dataset.mappingKind",
  "external_code: code",
]) requireFragment(saveCode, fragment);

const create = functionSource("createSalesAccountingExport");
for (const fragment of [
  'sb.rpc("create_sales_accounting_export"',
  "target_order_ids: orderIds",
  "downloadSalesAccountingExportFile(data)",
]) requireFragment(create, fragment);
if (/\.from\([^)]*(?:customer_orders|customer_order_items|sales_accounting_export_batches)[^)]*\)[\s\S]*?\.(?:insert|update|delete)\(/i.test(create)) {
  throw new Error("The browser must not mutate order or export tables directly");
}

const download = functionSource("downloadSalesAccountingExportFile");
for (const fragment of [
  "window.atob",
  "new Uint8Array",
  'charset=shift_jis',
  "URL.createObjectURL",
]) requireFragment(download, fragment);

const redownload = functionSource("redownloadSalesAccountingExport");
for (const fragment of [
  'sb.rpc("get_sales_accounting_export_download"',
  "target_batch_id: batchId",
  "作成時と同一のCSV",
]) requireFragment(redownload, fragment);

for (const fragment of [
  ".sales-accounting-export-card",
  ".sales-accounting-export-workspace",
  ".sales-accounting-export-order",
  ".sales-accounting-export-history-row",
]) requireFragment(css, fragment);

console.log("Sales-accounting export UI verification passed.");
