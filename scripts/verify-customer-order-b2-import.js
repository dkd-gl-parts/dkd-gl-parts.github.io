const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

function between(start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  if (startIndex < 0 || endIndex < 0) throw new Error(`Could not isolate ${start}`);
  return source.slice(startIndex, endIndex);
}

[
  "sales-order-import-b2",
  "sales-order-import-b2-file",
  "sales-order-b2-import",
  "sales-order-b2-import-table",
  "sales-order-import-b2-confirm",
  "sales-order-b2-import-guide-overlay",
  "sales-order-b2-import-guide-title",
  "sales-order-b2-import-guide-yamato",
  "sales-order-b2-import-guide-select-file",
  "sales-order-b2-import-guide-cancel"
].forEach((id) => {
  if (!html.includes(`id="${id}"`)) throw new Error(`B2 issued-data import UI is missing: ${id}`);
});

[
  "発行済データの検索",
  "外部ファイル出力",
  "ダウンロードした発行済データCSVを選択",
  "認証情報を、D-CATSへ入力・送信・保存することはありません。"
].forEach((fragment) => {
  if (!html.includes(fragment)) throw new Error(`B2 download guidance is missing: ${fragment}`);
});
if (!html.includes('href="https://bmypage.kuronekoyamato.co.jp/bmypage/"') ||
    !html.includes('target="_blank" rel="noopener noreferrer"')) {
  throw new Error("B2 download guidance must open the official Yamato page safely in a new tab");
}
if (html.includes("newb2web.kuronekoyamato.co.jp/issue_search.html") ||
    html.includes('id="sales-order-b2-import-guide-issued-search"')) {
  throw new Error("B2 download guidance must not deep-link into Yamato's session-bound screens");
}
[
  "ログイン後のマイページで「送り状発行システム B2クラウド」を押します。",
  "B2クラウドのメインメニューで「発行済データの検索」を押し、対象を検索して「外部ファイル出力」でCSVをダウンロードします。",
  "直接URLでは開けません。ヤマト画面は手順1で開いた同じタブのまま操作してください。"
].forEach((fragment) => {
  if (!html.includes(fragment)) throw new Error(`B2 session-safe navigation guidance is missing: ${fragment}`);
});

const openGuide = between("function openSalesOrderB2ImportGuide", "function closeSalesOrderB2ImportGuide");
if (!openGuide.includes("canManageSalesOrders()") ||
    !openGuide.includes('classList.add("show")') ||
    !openGuide.includes('getElementById("sales-order-b2-import-guide-yamato")') ||
    !openGuide.includes("yamatoLink.focus()")) {
  throw new Error("B2 import action must open and focus the download guide");
}
const closeGuide = between("function closeSalesOrderB2ImportGuide", "function selectSalesOrderB2ImportFile");
if (!closeGuide.includes('classList.remove("show")') || !closeGuide.includes('getElementById("sales-order-import-b2")')) {
  throw new Error("B2 download guide must close and restore focus to its trigger");
}
const selectFile = between("function selectSalesOrderB2ImportFile", "function renderSalesOrderB2Import");
if (!selectFile.includes('getElementById("sales-order-import-b2-file")') || !selectFile.includes("input.click()")) {
  throw new Error("B2 download guide must continue to the existing CSV file picker");
}
[
  'document.getElementById("sales-order-import-b2").addEventListener("click", openSalesOrderB2ImportGuide)',
  'document.getElementById("sales-order-b2-import-guide-select-file").addEventListener("click", selectSalesOrderB2ImportFile)',
  'if (e.key === "Escape") closeSalesOrderB2ImportGuide()',
  "closeSalesOrderB2ImportGuide(false);"
].forEach((fragment) => {
  if (!source.includes(fragment)) throw new Error(`B2 download guide behavior is missing: ${fragment}`);
});

const csvFunctions = between("function parseSalesOrderB2Csv", "async function salesOrderB2FileSha256");
const sandbox = {};
vm.runInNewContext(`${csvFunctions}; result = { parseSalesOrderB2Csv, salesOrderB2RowsFromCsv };`, sandbox);
const parsed = sandbox.result.parseSalesOrderB2Csv(
  'お客様管理番号,送り状種類,クール区分,伝票番号,出荷予定日\r\n' +
  '"DC20260807-000001-O",0,0,490714955706,2026/08/05\r\n'
);
const rows = sandbox.result.salesOrderB2RowsFromCsv(parsed);
if (rows.length !== 1 || rows[0].customer_management_number !== "DC20260807-000001-O" ||
    rows[0].tracking_number !== "490714955706" || rows[0].planned_ship_date !== "2026-08-05" ||
    rows[0].source_row_number !== 2) {
  throw new Error("B2 issued-data CSV must be parsed by Japanese header name and normalized safely");
}
if (!source.includes('new TextDecoder("shift_jis")') || !source.includes('new TextDecoder("utf-8", { fatal: true })')) {
  throw new Error("B2 import must support both Yamato Shift-JIS and D-CATS UTF-8 CSV files");
}
if (!source.includes('window.crypto.subtle.digest("SHA-256", buffer)')) {
  throw new Error("B2 import must calculate a file hash for idempotent imports");
}

const previewImport = between("async function previewSalesOrderB2ImportFile", "async function importSalesOrderB2Shipments");
if (!previewImport.includes('sb.rpc("preview_sales_order_b2_shipments"') ||
    !previewImport.includes("target_rows: parsedRows")) {
  throw new Error("B2 CSV must be matched on the server before the confirm action is enabled");
}
const commitImport = between("async function importSalesOrderB2Shipments", "function returnFromProductSearch");
[
  'sb.rpc("import_sales_order_b2_shipments"',
  "target_file_name",
  "target_file_sha256",
  "target_rows",
  "print_job_count",
  "print_warning_count",
  "コア返却シート・保証書",
  "注文詳細から再送してください"
].forEach((fragment) => {
  if (!commitImport.includes(fragment)) throw new Error(`B2 import mutation is missing: ${fragment}`);
});
if (source.includes('.from("customer_order_b2_imports")') || source.includes('.from("customer_order_shipments")')) {
  throw new Error("The browser must not write shipment or B2 import audit tables directly");
}

const defaults = between("function defaultCustomerDisplaySettings", "function normalizeCustomerShippingChargeRule");
[
  'default_outbound_carrier_name: "ヤマト運輸"',
  'default_outbound_service_name: "宅急便"',
  'default_core_return_carrier_name: "佐川急便"',
  'default_core_return_service_name: "飛脚宅配便"'
].forEach((fragment) => {
  if (!defaults.includes(fragment)) throw new Error(`Customer default shipping setting is missing: ${fragment}`);
});
const accessRender = between("function renderCustomerAccessDetail", "function renderCustomerAccessRuleForm");
if (!accessRender.includes("customer-default-outbound-shipping") ||
    !accessRender.includes("customer-default-core-return-shipping")) {
  throw new Error("Customer settings must expose separate outbound and core-return defaults");
}
const accessCollect = between("function collectCustomerDisplaySettings", "function collectCustomerAccessCategoryVisibility");
if (!accessCollect.includes("default_outbound_carrier_name") ||
    !accessCollect.includes("default_core_return_service_name") ||
    !accessCollect.includes("customerOrderDeliveryServiceFromKey")) {
  throw new Error("Customer default shipping methods must be saved with display settings");
}
const serviceLoad = between("async function loadCustomerOrderDeliveryServices", "function customerOrderCartKey");
if (!serviceLoad.includes('customerOrderDefaultShippingKey("outbound")') ||
    !serviceLoad.includes('customerOrderDefaultShippingKey("core_return")')) {
  throw new Error("The order screen must select the customer's two default services");
}

const detailRender = between("function renderSalesOrderDetail", "async function loadSalesOrderDetail");
if (!detailRender.includes("salesOrderShipmentHistoryHtml(order.shipment_history)")) {
  throw new Error("Order detail must show immutable shipment history");
}

[
  ".sales-order-b2-import",
  ".sales-order-b2-import-row",
  ".sales-order-b2-import-guide-card",
  ".sales-order-b2-import-guide-steps",
  ".sales-order-b2-import-guide-actions",
  ".sales-order-b2-import-guide-warning",
  ".sales-order-shipment-history-row",
  ".customer-default-shipping-grid",
  "@media (max-width: 560px)"
].forEach((fragment) => {
  if (!css.includes(fragment)) throw new Error(`Responsive B2/default-shipping style is missing: ${fragment}`);
});

console.log("Customer order B2 issued-data import verification passed.");
