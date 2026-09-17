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
  "sales-accounting-sales-guide",
  "sales-accounting-troubleshooting-guide",
  "sales-accounting-export-candidate-list",
  "sales-accounting-export-history-list",
  "sales-accounting-export-create",
]) requireFragment(html, `id="${id}"`);
if (html.includes('id="sales-accounting-export-check-all"') || html.includes("出力可能な受注をすべて選択")) {
  throw new Error("The redundant select-all option must not be displayed");
}
requireFragment(html, 'data-i18n="sales_accounting_issue_list_title">情報不足の売上データ</h4>', "Only sales data with missing information should be listed");
if (html.includes('id="sales-accounting-export-candidates-title">出力対象</h4>') || html.includes("選択した受注をCSV出力")) {
  throw new Error("The export-candidate selection UI must not be displayed");
}
requireFragment(html, '<option value="hanbaiou">販売王</option><option value="yayoi_sales">弥生販売</option>', "Sales King must be the initial destination");
requireFragment(html, '<details class="sales-accounting-sales-guide" id="sales-accounting-sales-guide" open>', "The Sales King sales CSV guide must be open by default");
requireFragment(html, '<details class="sales-accounting-troubleshooting-guide" id="sales-accounting-troubleshooting-guide">', "The troubleshooting guide must be closed by default");
requireFragment(html, '<details class="sales-accounting-hanbaiou-guide" id="sales-accounting-hanbaiou-guide" hidden>', "The product-master guide must be closed by default");
for (const fragment of [
  "売上伝票（消費税特例対応形式）",
  "1行目はタイトル行なので無視する",
  "項目数が入出力形式と不一致",
  "3番目：売上伝票区分",
  "3列目に掛売の「2」を引用符なしで出力",
  "同じCSVを再取得",
  "Shift_JIS",
  "販売管理登録を確認",
]) requireFragment(html, fragment);

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
  "var issueOrders = state.orders.filter",
  "salesAccountingExportIssueRows(order).length > 0",
  "host.innerHTML = issueOrders.map",
  'hasReadyOrders ? "sales_accounting_issue_none" : "sales_accounting_issue_no_ready"',
  'state.targetSystem === "hanbaiou"',
  "sales-accounting-export-order-simple",
  "sales-accounting-export-order-products",
  't("sales_accounting_product_ledger_check")',
]) requireFragment(candidates, fragment);
if (candidates.includes("data-sales-accounting-order-check") || candidates.includes("state.orders.map")) {
  throw new Error("Normal CSV candidates and order-selection checkboxes must not be rendered");
}

const guideRender = functionSource("renderSalesAccountingHanbaiouGuide");
for (const fragment of [
  'document.getElementById("sales-accounting-sales-guide")',
  'document.getElementById("sales-accounting-troubleshooting-guide")',
  "salesGuide.hidden = !isHanbaiouTarget",
  "troubleshootingGuide.hidden = !isHanbaiouTarget",
]) requireFragment(guideRender, fragment);
if (guideRender.includes("pendingCount && !guide.open")) {
  throw new Error("Pending product-master work must not open the product guide automatically");
}

const guideDefaults = functionSource("resetSalesAccountingGuideDisclosureState");
for (const fragment of [
  "salesGuide.open = true",
  "troubleshootingGuide.open = false",
  "productGuide.open = false",
]) requireFragment(guideDefaults, fragment);
const openExport = functionSource("openSalesAccountingExport");
requireFragment(openExport, "resetSalesAccountingGuideDisclosureState()");

const selection = functionSource("updateSalesAccountingExportSelection");
requireFragment(selection, 'tf("sales_accounting_issue_count", { count: issueCount })');
requireFragment(selection, 'tf("sales_accounting_create_count", { count: selectedOrders.length })');

for (const key of [
  "sales_accounting_issue_list_title",
  "sales_accounting_issue_count",
  "sales_accounting_issue_count_initial",
  "sales_accounting_create_default",
  "sales_accounting_issue_loading",
  "sales_accounting_issue_search_prompt",
  "sales_accounting_issue_none",
  "sales_accounting_issue_no_ready",
  "sales_accounting_issue_no_orders",
  "business_workspace_hanbaiou_mismatch",
  "business_workspace_hanbaiou_write_error_state",
  "business_workspace_hanbaiou_write_failed",
]) {
  const matches = source.match(new RegExp(`${key}:`, "g")) || [];
  if (matches.length !== 3) throw new Error(`${key} must be translated in Japanese, English, and Chinese`);
}

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
  "await fileHandle.getFile()",
  "Number(savedFile.size) !== bytes.byteLength",
  "URL.createObjectURL",
]) requireFragment(download, fragment);

const refreshDirectoryState = functionSource("refreshDcatsHanbaiouExportDirectoryState");
for (const fragment of [
  "handle.name !== DCATS_HANBAIOU_EXPORT_DIRECTORY_NAME",
  "await forgetDcatsHanbaiouExportDirectory()",
  'setDcatsHanbaiouExportDirectoryState("mismatch", oldDirectoryName)',
]) requireFragment(refreshDirectoryState, fragment);

for (const functionName of [
  "resolveDcatsHanbaiouExportDirectory",
  "pickDcatsHanbaiouExportDirectory",
  "prepareDcatsHanbaiouExportDirectory",
  "configureDcatsHanbaiouExportDirectory",
  "forgetDcatsHanbaiouExportDirectory",
  "resetDcatsHanbaiouExportDirectoryAfterWriteFailure",
]) functionSource(functionName);
for (const fragment of [
  'var DCATS_HANBAIOU_DIRECTORY_NAME = "\\u8ca9\\u58f2\\u738b"',
  'id: "dcats-hanbaiou-csv-export"',
  "storeDcatsHanbaiouExportDirectory(targetHandle)",
  'selectedHandle.name === DCATS_BUSINESS_WORKSPACE_DIRECTORY_NAME',
  'selectedHandle.name === DCATS_HANBAIOU_DIRECTORY_NAME',
  'selectedHandle.name === DCATS_HANBAIOU_EXPORT_DIRECTORY_NAME',
  'handle.name !== DCATS_HANBAIOU_EXPORT_DIRECTORY_NAME',
  "removeStoredDcatsBusinessWorkspaceDirectory(DCATS_HANBAIOU_EXPORT_DIRECTORY_KEY)",
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
  ".sales-accounting-export-body",
  ".sales-accounting-export-workspace",
  ".sales-accounting-export-order",
  ".sales-accounting-export-order-simple",
  ".sales-accounting-export-candidate-empty.is-clear",
  ".sales-accounting-export-directory",
  ".sales-accounting-sales-guide",
  ".sales-accounting-troubleshooting-guide",
  ".sales-accounting-sales-steps",
  ".sales-accounting-troubleshooting-list",
  ".sales-accounting-export-history-row",
]) requireFragment(css, fragment);

for (const fragment of [
  '<div class="sales-accounting-export-body">',
  '<div class="form-footer sales-accounting-export-footer">',
]) requireFragment(html, fragment);

requireFragment(css, ".sales-accounting-export-body { display: flex; flex: 1 1 auto; flex-direction: column; min-height: 0; overflow-y: auto;", "Sales export content must scroll independently so the CSV action remains visible");
requireFragment(css, ".sales-accounting-export-footer { position: relative; z-index: 1; flex: 0 0 auto;", "Sales export footer must remain outside the scrollable content");
requireFragment(css, ".sales-accounting-export-footer { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr);", "Both footer actions must remain visible on narrow screens");

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
        getFile: async () => ({ size: writtenBytes ? writtenBytes.byteLength : 0 }),
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

  const incompleteDirectoryHandle = {
    getFileHandle: async () => ({
      createWritable: async () => ({ write: async () => {}, close: async () => {} }),
      getFile: async () => ({ size: 0 }),
    }),
  };
  let rejectedIncompleteWrite = false;
  try {
    await context.runDownload({
      content_base64: Buffer.from([0x31]).toString("base64"),
      file_name: "incomplete.csv",
    }, incompleteDirectoryHandle);
  } catch (error) {
    rejectedIncompleteWrite = error && error.name === "DcatsCsvWriteVerificationError";
  }
  if (!rejectedIncompleteWrite) throw new Error("An incomplete CSV write must not be reported as saved");

  let forgotOldDirectory = false;
  let reopenedPicker = false;
  const selectedDirectory = { name: "01_D-CATS発行" };
  const prepareContext = {
    DCATS_HANBAIOU_EXPORT_DIRECTORY_NAME: "01_D-CATS発行",
    dcatsHanbaiouExportDirectoryHandle: { name: "商品台帳CSV" },
    loadDcatsHanbaiouExportDirectory: async () => null,
    supportsDcatsB2SharedFolder: () => true,
    forgetDcatsHanbaiouExportDirectory: async () => { forgotOldDirectory = true; },
    pickDcatsHanbaiouExportDirectory: async () => { reopenedPicker = true; return selectedDirectory; },
    t: (key) => key,
  };
  const prepare = functionSource("prepareDcatsHanbaiouExportDirectory");
  vm.runInNewContext(`${prepare}; runPrepare = prepareDcatsHanbaiouExportDirectory;`, prepareContext);
  const preparedDirectory = await prepareContext.runPrepare();
  if (!forgotOldDirectory || !reopenedPicker || preparedDirectory !== selectedDirectory) {
    throw new Error("An old product-ledger folder must be discarded before selecting 01_D-CATS発行");
  }
  console.log("Sales-accounting export UI verification passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
