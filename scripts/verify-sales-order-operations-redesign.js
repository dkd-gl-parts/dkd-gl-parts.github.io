const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8").replace(/\r\n/g, "\n");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8").replace(/\r\n/g, "\n");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8").replace(/\r\n/g, "\n");

function requireFragment(target, fragment, message) {
  if (!target.includes(fragment)) throw new Error(message || `Missing order-operations redesign contract: ${fragment}`);
}

function functionSource(name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`Function is missing: ${name}`);
  const next = source.indexOf("\nfunction ", start + 1);
  const nextAsync = source.indexOf("\nasync function ", start + 1);
  const stops = [next, nextAsync].filter((index) => index >= 0);
  return source.slice(start, stops.length ? Math.min(...stops) : source.length);
}

for (const fragment of [
  "sales-order-search-controls",
  "sales-order-selection-controls",
  "sales-order-selection-summary",
  "sales-order-data-actions",
  "選択した受注の処理",
  "データ連携"
]) requireFragment(html, fragment);

for (const id of [
  "sales-order-search",
  "sales-order-status",
  "sales-order-reload",
  "sales-order-batch-accept",
  "sales-order-export-b2",
  "sales-order-import-b2",
  "sales-order-accounting-export",
  "sales-order-business-workspace-open"
]) {
  const count = (html.match(new RegExp(`id=["']${id}["']`, "g")) || []).length;
  if (count !== 1) throw new Error(`${id} must remain unique after toolbar regrouping; found ${count}`);
}
if (html.includes('id="sales-order-b2-settings-open"')) {
  throw new Error("B2 contract settings must not remain in the sales-order data actions");
}

const selection = functionSource("updateSalesOrderSelectionButtons");
for (const fragment of [
  'getElementById("sales-order-selection-summary")',
  'checkedIds.length + "件選択"',
  'classList.toggle("active", checkedIds.length > 0)',
  '"B2 CSV発行"'
]) requireFragment(selection, fragment);

const lifecycleSource = functionSource("salesOrderLifecycleHtml");
for (const fragment of [
  "受付待ち",
  "受付済み",
  "出荷処理中",
  "出荷済み",
  "完了",
  "受注取消",
  "aria-current='step'"
]) requireFragment(lifecycleSource, fragment);

const lifecycleContext = { esc: (value) => String(value) };
vm.createContext(lifecycleContext);
vm.runInContext(lifecycleSource, lifecycleContext);
const readyProgress = lifecycleContext.salesOrderLifecycleHtml("shipping_ready");
if (!readyProgress.includes("sales-order-progress-step done") || !readyProgress.includes("sales-order-progress-step current")) {
  throw new Error("Shipping-ready lifecycle must distinguish completed and current steps");
}
if (!lifecycleContext.salesOrderLifecycleHtml("cancelled").includes("受注取消")) {
  throw new Error("Cancelled orders must have an explicit terminal lifecycle state");
}

const detail = functionSource("renderSalesOrderDetail");
for (const fragment of [
  "salesOrderLifecycleHtml(order.status)",
  "salesOrderStatusSummaryHtml(order)",
  "salesOrderDispatchHtml(order) + salesOrderTrackingEditorHtml(order)",
  'class=\'sales-order-detail-head\'',
  'class=\'sales-order-detail-state\'',
  "sales-order-empty-guidance"
]) requireFragment(detail, fragment);
if (detail.includes('{ key: "tracking"') || detail.includes("data-sales-order-detail-panel='tracking'")) {
  throw new Error("Waybill progress must be integrated into the fulfillment tab instead of using a separate tracking tab");
}

const setDetailView = functionSource("setSalesOrderDetailView");
for (const fragment of [
  'if (view === "tracking") view = "fulfillment"',
  'var allowedViews = ["overview", "fulfillment", "history"]'
]) requireFragment(setDetailView, fragment);

const statusDetailSource = functionSource("salesOrderStatusDetailLabel");
const statusSummarySource = functionSource("salesOrderStatusSummaryHtml");
const statusContext = {
  salesOrderDispatch: (order) => order && order.dispatch || null,
  salesOrderDispatchStatusLabel: (status) => ({ preparing: "シリアル照合待ち", ready: "照合完了・出荷確定待ち" })[status] || "未発行",
  salesOrderWaybillProgress: () => ({ trackingNumber: "", status: "B2取込待ち" }),
  customerOrderStatusLabel: (status) => status === "shipping_ready" ? "出荷処理中" : status,
  esc: (value) => String(value == null ? "" : value)
};
vm.createContext(statusContext);
vm.runInContext(statusDetailSource + "\n" + statusSummarySource, statusContext);
const activeSummary = statusContext.salesOrderStatusSummaryHtml({ status: "shipping_ready", dispatch: { status: "preparing" } });
if (!activeSummary.includes("出荷処理中") || !activeSummary.includes("シリアル照合待ち")) {
  throw new Error("Shipping progress must show both the broad order state and the current operational step");
}
const b2PendingSummary = statusContext.salesOrderStatusSummaryHtml({ status: "shipping_ready", dispatch: { status: "shipped" } });
if (!b2PendingSummary.includes("B2取込待ち")) {
  throw new Error("A shipping-ready order that completed serial matching must surface the remaining waybill step");
}
if (statusContext.salesOrderStatusSummaryHtml({ status: "shipped" }).includes("<small>")) {
  throw new Error("Terminal order states must not show a stale shipping sub-state");
}

const waybillProgressSource = functionSource("salesOrderWaybillProgress");
const waybillProgressHtmlSource = functionSource("salesOrderWaybillProgressHtml");
const waybillContext = {
  salesOrderWaybillRecord: (order, purpose) => purpose === "core_return" ? (order.return_waybill || {}) : (order.outbound_waybill || {}),
  shippingDocumentPrintJob: (order, type) => (order.print_jobs || []).find((job) => job.document_type === type) || null,
  salesOrderPrintJobStatusLabel: (status) => ({ queued: "印刷待ち", claimed: "印刷中", printed: "印刷済み", error: "印刷エラー" })[status] || "未登録",
  salesOrderWaybillCarrierLabel: (order, purpose) => purpose === "core_return" ? "佐川急便 / 飛脚宅配便 着払い" : "ヤマト運輸 / 宅急便 元払い",
  shippingDocumentWaybillNumberFormat: (value) => String(value),
  esc: (value) => String(value == null ? "" : value)
};
vm.createContext(waybillContext);
vm.runInContext(waybillProgressSource + "\n" + waybillProgressHtmlSource, waybillContext);
const b2Pending = waybillContext.salesOrderWaybillProgress({
  outbound_waybill: { handling_method: "b2_cloud" },
  b2_exports: [{ created_at: "2026-09-10T00:00:00Z" }]
}, "outbound");
if (b2Pending.status !== "B2取込待ち") {
  throw new Error("Issued B2 data without a tracking number must be labeled B2 import pending");
}
const multipartMissing = waybillContext.salesOrderWaybillProgress({
  core_return_required: true,
  return_waybill: { handling_method: "dot_matrix" }
}, "core_return");
if (multipartMissing.status !== "複写送り状番号未登録") {
  throw new Error("A multipart waybill without a number must not be labeled as B2 import pending");
}
const progressHtml = waybillContext.salesOrderWaybillProgressHtml({
  core_return_required: true,
  outbound_waybill: { handling_method: "b2_cloud" },
  return_waybill: { handling_method: "dot_matrix" },
  b2_exports: [{ created_at: "2026-09-10T00:00:00Z" }]
});
for (const fragment of [
  "data-waybill-purpose='outbound'",
  "data-waybill-purpose='core_return'",
  "ヤマト運輸 / 宅急便 元払い",
  "佐川急便 / 飛脚宅配便 着払い",
  "B2取込待ち",
  "複写送り状番号未登録"
]) requireFragment(progressHtml, fragment);

for (const fragment of [
  ".sales-order-search-controls {",
  ".sales-order-selection-controls {",
  ".sales-order-selection-summary.active {",
  ".sales-order-data-actions > summary {",
  ".sales-order-data-actions > div {",
  ".sales-order-detail-head { display: grid;",
  ".sales-order-status-summary {",
  ".sales-order-status-summary > small {",
  ".sales-order-progress {",
  ".sales-order-progress-step.current {",
  ".sales-order-waybill-progress-grid {",
  ".sales-order-waybill-progress-status.warning {",
  ".sales-order-empty-guidance {",
  ".sales-order-search-controls { grid-template-columns: 1fr 1fr;"
]) requireFragment(css, fragment);

console.log("Sales order operations information architecture and responsive layout verification passed.");
