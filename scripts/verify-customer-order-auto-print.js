const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const printCss = fs.readFileSync(path.join(root, "shipment-instruction-print.css"), "utf8");

function sourceBetween(startText, endText) {
  const start = source.indexOf(startText);
  const end = source.indexOf(endText, start + startText.length);
  if (start < 0 || end < start) throw new Error(`${startText} could not be isolated`);
  return source.slice(start, end);
}

for (const id of [
  "sales-order-auto-print",
  "sales-order-auto-print-state",
  "sales-order-auto-print-station",
  "sales-order-auto-print-enabled",
  "sales-order-auto-print-save",
  "sales-order-auto-print-message",
  "sales-order-print-settings-open",
  "sales-order-print-settings-overlay",
  "sales-order-print-settings-current",
  "sales-order-print-settings-refresh"
]) {
  if (!html.includes(`id="${id}"`)) throw new Error(`Auto-print setting UI is missing: ${id}`);
}
for (const fragment of [
  ".sales-order-auto-print {",
  ".sales-order-auto-print-state.ready",
  ".sales-order-print-settings-card",
  ".sales-order-print-settings-current",
  ".sales-order-print-job-status.printed",
  ".sales-order-print-job-status.error"
]) {
  if (!css.includes(fragment)) throw new Error(`Auto-print styling is missing: ${fragment}`);
}

const summaryStart = html.indexOf('<section class="sales-order-auto-print" id="sales-order-auto-print">');
const summaryEnd = html.indexOf('<section class="sales-order-workspace">', summaryStart);
if (summaryStart < 0 || summaryEnd < summaryStart) {
  throw new Error("Compact automatic-print summary could not be isolated");
}
const summaryHtml = html.slice(summaryStart, summaryEnd);
for (const required of ["sales-order-auto-print-state", "sales-order-print-settings-open"]) {
  if (!summaryHtml.includes(required)) throw new Error(`Automatic-print summary is missing: ${required}`);
}
for (const movedControl of [
  "sales-order-auto-print-station",
  "sales-order-auto-print-enabled",
  "sales-order-auto-print-save"
]) {
  if (summaryHtml.includes(movedControl)) {
    throw new Error(`Automatic-print setting must stay out of the order list screen: ${movedControl}`);
  }
}
const setupStart = html.indexOf('id="sales-order-print-settings-overlay"');
const setupEnd = html.indexOf('id="sales-order-in-house-cancel-overlay"', setupStart);
if (setupStart < 0 || setupEnd < setupStart) {
  throw new Error("Automatic-print settings overlay could not be isolated");
}
const setupHtml = html.slice(setupStart, setupEnd);
for (const movedControl of [
  "sales-order-auto-print-station",
  "sales-order-auto-print-enabled",
  "sales-order-auto-print-save"
]) {
  if (!setupHtml.includes(movedControl)) {
    throw new Error(`Automatic-print setting must be available in the settings overlay: ${movedControl}`);
  }
}
if (!css.includes(".sales-order-workspace { display: grid; flex: 1;") ||
    !css.includes(".sales-order-list { height: calc(100% - 44px);")) {
  throw new Error("Order list must use the remaining viewport height");
}

const loadSettings = sourceBetween("async function loadSalesOrderPrintSettings", "async function saveSalesOrderPrintSettings");
if (!loadSettings.includes('sb.rpc("get_customer_order_print_settings")')) {
  throw new Error("Order management must load printer station state through an RPC");
}
const saveSettings = sourceBetween("async function saveSalesOrderPrintSettings", "async function enterSalesOrderMgmt");
for (const fragment of [
  "canManageSharedSettings()",
  'station.state !== "ready"',
  "var targetAutoPrintEnabled = enabledInput.checked",
  "var targetStationCode = stationSelect.value || null",
  'sb.rpc("update_customer_order_print_settings"',
  "target_auto_print_enabled: targetAutoPrintEnabled",
  "target_station_code: targetStationCode"
]) {
  if (!saveSettings.includes(fragment)) throw new Error(`Auto-print save guard is missing: ${fragment}`);
}
const enterManagement = sourceBetween("async function enterSalesOrderMgmt", "function renderSalesOrderList");
if (!enterManagement.includes("Promise.all([refreshSalesOrderManagement(), loadSalesOrderPrintSettings()])")) {
  throw new Error("Orders and print-station state must load together");
}
const printerSetup = sourceBetween("function renderSalesOrderPrinterSetup", "async function enterSalesOrderMgmt");
for (const fragment of [
  "config.printer_name",
  "salesOrderPrintStationStateLabel(config.station_state)",
  "async function openSalesOrderPrinterSetup",
  "async function refreshSalesOrderPrinterSetup",
  "loadSalesOrderPrintSettings()"
]) {
  if (!printerSetup.includes(fragment)) throw new Error(`Self-service printer setup is missing: ${fragment}`);
}
if (setupHtml.includes('href="dcats-print-settings://open"') ||
    setupHtml.includes("帳票別プリンター") ||
    setupHtml.includes("複写伝票")) {
  throw new Error("Order management automatic-print settings must not contain other document settings");
}

const submitOrder = sourceBetween("async function submitCustomerOrder", "function renderCustomerOrderHistory");
if (submitOrder.includes("print_job_count") || submitOrder.includes("customer_order_submit_print_queued")) {
  throw new Error("Order submission must not issue or report shipment-document printing");
}
if (!submitOrder.includes('customerOrderSetStatus(t("customer_order_submit_success"), false)')) {
  throw new Error("Order submission must finish as a submitted order awaiting staff acceptance");
}
if (/window\.print\s*\(/.test(submitOrder)) {
  throw new Error("Order submission must not depend on browser window.print");
}
if (!html.includes("受付時の自動印刷設定") ||
    !html.includes("注文受付時にA4出荷指示書を自動印刷する端末とプリンターを設定します") ||
    !html.includes("その他の帳票設定は「出荷帳票発行」で管理します") ||
    !html.includes("自動印刷プリンター")) {
  throw new Error("Automatic-print settings must be limited to the acceptance-time dispatch sheet");
}

const printHistory = sourceBetween("function salesOrderPrintJobsHtml", "function salesOrderDispatchHtml");
for (const fragment of [
  '"dispatch"',
  '"core_return"',
  '"warranty"',
  "station_name",
  "printer_name",
  "sales-order-print-job-status",
  "sales-order-requeue-print"
]) {
  if (!printHistory.includes(fragment)) throw new Error(`Order print history is missing: ${fragment}`);
}
const requeue = sourceBetween("async function requeueSalesOrderPrintJobs", "function salesOrderPrintItemRows");
if (!requeue.includes('sb.rpc("requeue_customer_order_print_jobs"') || !requeue.includes("target_order_id")) {
  throw new Error("Failed or completed documents must be requeueable through the reviewed RPC");
}
const printDocument = sourceBetween("function salesOrderPrintItemRows", "function printSalesOrderDocument");
for (const fragment of [
  'type === "core_return"',
  'type === "warranty"',
  "buildSalesOrderCoreReturnDocumentHtml",
  "salesOrderReferenceBarcodeDataUrl",
  "返却管理番号",
  "warranty_document_required === false",
  "この注文に発行が必要な保証書はありません",
  "buildSalesOrderWarrantyDocumentHtml",
  "本書に記載された保証期間",
  "GLTEK品番",
  "salesOrderWarrantyUnits"
]) {
  if (!printDocument.includes(fragment)) throw new Error(`Manual shipment document rendering is missing: ${fragment}`);
}
for (const fragment of [
  "@page dcats-a5 { size: A5 portrait",
  ".document-a5 .shipment-document { page: dcats-a5; }",
  ".shipment-document-a5",
  "@page dcats-core-return { size: A5 landscape; margin: 0; }",
  ".core-return-sheet",
  "@page dcats-warranty-a4 { size: A4 landscape; margin: 0; }",
  "width: 148mm; height: 210mm;",
  ".warranty-certificate"
]) {
  if (!printCss.includes(fragment)) throw new Error(`A5 shipment document styling is missing: ${fragment}`);
}

for (const versionFragment of [
  'content="v1.1.835"',
  'styles.css?v=1.1.835',
  'app.js?v=1.1.835',
  'var APP_VERSION       = "v1.1.835"'
]) {
  const versionSource = versionFragment.startsWith("var ") ? source : html;
  if (!versionSource.includes(versionFragment)) throw new Error(`Release version is inconsistent: ${versionFragment}`);
}

if (/service[_-]?role|postgres(?:ql)?:\/\//i.test(source)) {
  throw new Error("Browser auto-print code must not contain server credentials");
}

console.log("Customer order automatic print UI verification passed.");
