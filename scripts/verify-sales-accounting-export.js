const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8").replace(/\r\n/g, "\n");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8").replace(/\r\n/g, "\n");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8").replace(/\r\n/g, "\n");

function requireFragment(target, fragment, message) {
  if (!target.includes(fragment)) throw new Error(message || `Missing sales-accounting export contract: ${fragment}`);
}

function functionSource(name) {
  const markers = [`function ${name}(`, `async function ${name}(`];
  const starts = markers.map((marker) => source.indexOf(marker)).filter((index) => index >= 0);
  if (!starts.length) throw new Error(`Function is missing: ${name}`);
  const start = Math.min(...starts);
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
  "sales-accounting-export-directory",
  "sales-accounting-export-directory-state",
  "sales-accounting-export-directory-select",
  "sales-accounting-export-candidate-list",
  "sales-accounting-export-history-list",
  "sales-accounting-export-create",
]) requireFragment(html, `id="${id}"`);
if (html.includes('id="sales-accounting-export-check-all"') || html.includes("出力可能な受注をすべて選択")) {
  throw new Error("The redundant select-all option must not be displayed");
}
requireFragment(html, '<option value="hanbaiou">販売王</option><option value="yayoi_sales">弥生販売</option>', "Sales King must be the initial destination");

const initialState = functionSource("initialSalesAccountingExportState");
requireFragment(initialState, 'targetSystem: "hanbaiou"', "Sales King must be the initial state");

const load = functionSource("loadSalesAccountingExportData");
for (const fragment of [
  'sb.rpc("list_sales_accounting_export_candidates"',
  'sb.rpc("list_sales_accounting_export_batches"',
  "target_date_from: state.dateFrom || null",
  "include_exported: state.includeExported",
  "state.orders.filter(salesAccountingExportCanSelect).slice(0, 100)",
]) requireFragment(load, fragment);

const candidates = functionSource("renderSalesAccountingExportCandidates");
for (const fragment of [
  'state.targetSystem === "hanbaiou"',
  "sales-accounting-export-order-simple",
  "sales-accounting-export-order-products",
  't("sales_accounting_product_ledger_check")',
]) requireFragment(candidates, fragment);

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
  "prepareDcatsHanbaiouExportDirectory()",
  "await downloadSalesAccountingExportFile(data, exportDirectory)",
]) requireFragment(create, fragment);
if (create.indexOf("prepareDcatsHanbaiouExportDirectory()") > create.indexOf('sb.rpc("create_sales_accounting_export"')) {
  throw new Error("The save folder must be ready before the export batch is created");
}
if (/\.from\([^)]*(?:customer_orders|customer_order_items|sales_accounting_export_batches)[^)]*\)[\s\S]*?\.(?:insert|update|delete)\(/i.test(create)) {
  throw new Error("The browser must not mutate order or export tables directly");
}

const download = functionSource("downloadSalesAccountingExportFile");
for (const fragment of [
  "window.atob",
  "new Uint8Array",
  'charset=shift_jis',
  "directoryHandle.getFileHandle",
  "fileHandle.createWritable",
  "await writable.write(bytes)",
  "await writable.close()",
  "URL.createObjectURL",
]) requireFragment(download, fragment);

for (const functionName of [
  "resolveDcatsHanbaiouExportDirectory",
  "pickDcatsHanbaiouExportDirectory",
  "prepareDcatsHanbaiouExportDirectory",
  "configureDcatsHanbaiouExportDirectory",
]) functionSource(functionName);
for (const fragment of [
  'var DCATS_HANBAIOU_DIRECTORY_NAME = "\\u8ca9\\u58f2\\u738b"',
  'id: "dcats-hanbaiou-csv-export"',
  "storeDcatsHanbaiouExportDirectory(targetHandle)",
  'selectedHandle.name === DCATS_BUSINESS_WORKSPACE_DIRECTORY_NAME',
  'selectedHandle.name === DCATS_HANBAIOU_DIRECTORY_NAME',
  'selectedHandle.name === DCATS_HANBAIOU_EXPORT_DIRECTORY_NAME',
  'document.getElementById("sales-accounting-export-directory-select").addEventListener("click", configureDcatsHanbaiouExportDirectory)',
]) requireFragment(source, fragment);

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
  ".sales-accounting-export-order-simple",
  ".sales-accounting-export-directory",
  ".sales-accounting-export-history-row",
]) requireFragment(css, fragment);

(async () => {
  let writtenName = "";
  let writtenBytes = null;
  let closed = false;
  const directoryHandle = {
    getFileHandle: async (name, options) => {
      writtenName = name;
      if (!options || options.create !== true) throw new Error("The CSV file must be created when missing");
      return {
        createWritable: async () => ({
          write: async (value) => { writtenBytes = new Uint8Array(value); },
          close: async () => { closed = true; },
        }),
      };
    },
  };
  const context = {
    Uint8Array,
    window: { atob: (value) => Buffer.from(value, "base64").toString("binary") },
  };
  vm.runInNewContext(`${download}; runDownload = downloadSalesAccountingExportFile;`, context);
  const fileName = await context.runDownload({
    content_base64: Buffer.from([0x82, 0xa0, 0x2c, 0x31]).toString("base64"),
    file_name: "D-CATS_販売王.csv",
  }, directoryHandle);
  if (fileName !== "D-CATS_販売王.csv" || writtenName !== fileName || !writtenBytes || !closed) {
    throw new Error("The Sales King CSV was not written to the selected shared folder");
  }
  if (!Buffer.from(writtenBytes).equals(Buffer.from([0x82, 0xa0, 0x2c, 0x31]))) {
    throw new Error("The Shift-JIS CSV bytes changed while writing to the shared folder");
  }
  console.log("Sales-accounting export UI verification passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
