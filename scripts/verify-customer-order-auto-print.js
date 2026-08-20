const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

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
  "sales-order-auto-print-message"
]) {
  if (!html.includes(`id="${id}"`)) throw new Error(`Auto-print setting UI is missing: ${id}`);
}
for (const fragment of [
  ".sales-order-auto-print {",
  ".sales-order-auto-print-state.ready",
  ".sales-order-print-job-status.printed",
  ".sales-order-print-job-status.error"
]) {
  if (!css.includes(fragment)) throw new Error(`Auto-print styling is missing: ${fragment}`);
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
if (!enterManagement.includes("Promise.all([loadSalesOrders(), loadSalesOrderPrintSettings()])")) {
  throw new Error("Orders and print-station state must load together");
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
if (!html.includes("受付時の自動印刷") || !html.includes("注文を受付した時に出荷指示書を印刷待ちへ登録します")) {
  throw new Error("Automatic-print settings must describe the acceptance-time trigger");
}

const printHistory = sourceBetween("function salesOrderPrintJobsHtml", "function salesOrderDispatchHtml");
for (const fragment of [
  '"dispatch"',
  '"core_return"',
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

for (const versionFragment of [
  'content="v1.1.734"',
  'styles.css?v=1.1.734',
  'app.js?v=1.1.734',
  'var APP_VERSION       = "v1.1.734"'
]) {
  const versionSource = versionFragment.startsWith("var ") ? source : html;
  if (!versionSource.includes(versionFragment)) throw new Error(`Release version is inconsistent: ${versionFragment}`);
}

if (/service[_-]?role|postgres(?:ql)?:\/\//i.test(source)) {
  throw new Error("Browser auto-print code must not contain server credentials");
}

console.log("Customer order automatic print UI verification passed.");
