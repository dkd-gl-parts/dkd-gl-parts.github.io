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
  "sales-order-import-b2",
  "sales-order-accounting-export",
  "sales-order-business-workspace-open"
]) {
  const count = (html.match(new RegExp(`id=["']${id}["']`, "g")) || []).length;
  if (count !== 1) throw new Error(`${id} must remain unique after toolbar regrouping; found ${count}`);
}
if (html.includes('id="sales-order-export-b2"')) {
  throw new Error("B2 CSV issuance must not remain in the order-management toolbar");
}
if (html.includes('id="sales-order-b2-settings-open"')) {
  throw new Error("B2 contract settings must not remain in the sales-order data actions");
}

const selection = functionSource("updateSalesOrderSelectionButtons");
for (const fragment of [
  'getElementById("sales-order-selection-summary")',
  'checkedIds.length + "件選択"',
  'classList.toggle("active", checkedIds.length > 0)'
]) requireFragment(selection, fragment);
if (selection.includes("B2 CSV発行") || selection.includes("sales-order-export-b2")) {
  throw new Error("Selected-order controls must not issue B2 CSV files");
}

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
  "salesOrderDispatchHtml(order)",
  'class=\'sales-order-detail-head\'',
  'class=\'sales-order-detail-state\'',
  "sales-order-empty-guidance"
]) requireFragment(detail, fragment);
if (detail.includes("salesOrderTrackingEditorHtml(order)")) {
  throw new Error("The outbound tracking editor must stay inside the waybill progress card");
}
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
  salesOrderWaybillProgress: () => ({ trackingNumber: "", status: "発送データ未取込" }),
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
if (!b2PendingSummary.includes("発送データ未取込")) {
  throw new Error("A shipping-ready order that completed serial matching must surface the remaining waybill step");
}
if (statusContext.salesOrderStatusSummaryHtml({ status: "shipped" }).includes("<small>")) {
  throw new Error("Terminal order states must not show a stale shipping sub-state");
}

const waybillProgressSource = functionSource("salesOrderWaybillProgress");
const waybillProgressHtmlSource = functionSource("salesOrderWaybillProgressHtml");
const dispatchSource = functionSource("salesOrderDispatchHtml");
if (dispatchSource.includes("<span>商品発送送り状</span>") || dispatchSource.includes("<span>返送用送り状</span>")) {
  throw new Error("Waybill numbers must be consolidated in the waybill progress cards");
}
if (dispatchSource.includes("sales-order-export-single-b2") || dispatchSource.includes("B2 CSV発行")) {
  throw new Error("Order fulfillment must open Shipping Documents instead of issuing B2 CSV directly");
}
const waybillContext = {
  salesOrderWaybillRecord: (order, purpose) => purpose === "core_return" ? (order.return_waybill || {}) : (order.outbound_waybill || {}),
  shippingDocumentPrintJob: (order, type) => (order.print_jobs || []).find((job) => job.document_type === type) || null,
  salesOrderPrintJobStatusLabel: (status) => ({ queued: "印刷待ち", claimed: "印刷中", printed: "印刷済み", error: "印刷エラー" })[status] || "未登録",
  salesOrderWaybillCarrierLabel: (order, purpose) => purpose === "core_return" ? "佐川急便 / 飛脚宅配便 着払い" : "ヤマト運輸 / 宅急便 元払い",
  shippingDocumentWaybillNumberFormat: (value) => String(value),
  t: (key) => ({ purchase_link_change: "変更", product_kind_stock_save_all: "変更を保存", component_cancel: "取消" })[key] || key,
  esc: (value) => String(value == null ? "" : value)
};
vm.createContext(waybillContext);
vm.runInContext(waybillProgressSource + "\n" + waybillProgressHtmlSource, waybillContext);
const b2Pending = waybillContext.salesOrderWaybillProgress({
  outbound_waybill: {},
  b2_exports: [{ created_at: "2026-09-10T00:00:00Z" }]
}, "outbound");
if (b2Pending.method !== "B2クラウド" || b2Pending.status !== "発送データ未取込") {
  throw new Error("Issued B2 data must infer B2 Cloud and show that shipment data has not been imported");
}
if (b2Pending.purpose !== "outbound" || b2Pending.label !== "発送用送り状") {
  throw new Error("Outbound waybill progress must use a stable purpose key and the requested label");
}
const multipartMissing = waybillContext.salesOrderWaybillProgress({
  core_return_required: true,
  return_waybill: { handling_method: "dot_matrix" }
}, "core_return");
if (multipartMissing.status !== "複写送り状番号未登録") {
  throw new Error("A multipart waybill without a number must not be labeled as B2 import pending");
}
if (multipartMissing.purpose !== "core_return" || multipartMissing.label !== "返却用送り状") {
  throw new Error("Return waybill progress must use a stable purpose key and the requested label");
}
const progressHtml = waybillContext.salesOrderWaybillProgressHtml({
  core_return_required: true,
  outbound_waybill: {},
  return_waybill: { handling_method: "dot_matrix" },
  b2_exports: [{ created_at: "2026-09-10T00:00:00Z" }]
});
for (const fragment of [
  "data-waybill-purpose='outbound'",
  "data-waybill-purpose='core_return'",
  "ヤマト運輸 / 宅急便 元払い",
  "佐川急便 / 飛脚宅配便 着払い",
  "発送データ未取込",
  "複写送り状番号未登録",
  "発送用送り状",
  "返却用送り状",
  "sales-order-waybill-progress-editor",
  "id='sales-order-outbound-tracking'",
  "id='sales-order-shipped-on'",
  "id='sales-order-save-tracking'"
]) requireFragment(progressHtml, fragment);
const notApplicableHtml = waybillContext.salesOrderWaybillProgressHtml({
  core_return_required: false,
  outbound_waybill: { handling_method: "b2_cloud" }
});
if (notApplicableHtml.includes("data-waybill-purpose='core_return'")) {
  throw new Error("A return waybill that is not required must not consume a full work card");
}
for (const fragment of ["sales-order-waybill-progress-grid outbound-only", "sales-order-waybill-not-applicable", "返却用送り状", "対象外"]) {
  requireFragment(notApplicableHtml, fragment, `Compact non-applicable return state is missing: ${fragment}`);
}
if (notApplicableHtml.includes("番号の登録・変更")) {
  throw new Error("A non-applicable return waybill must not show registration guidance");
}
const savedNumberHtml = waybillContext.salesOrderWaybillProgressHtml({
  core_return_required: false,
  outbound_waybill: { handling_method: "b2_cloud", tracking_number: "123456789012" }
});
if (!savedNumberHtml.includes("value='123456789012'")) {
  throw new Error("The consolidated outbound editor must show the authoritative waybill number");
}
for (const fragment of [
  "id='sales-order-outbound-tracking' type='text' inputmode='numeric' maxlength='12' value='123456789012' readonly aria-readonly='true'",
  "id='sales-order-shipped-on' type='date'",
  "disabled aria-readonly='true'",
  "id='sales-order-edit-tracking'",
  ">変更</button>",
  "id='sales-order-save-tracking' hidden>変更を保存</button>",
  "id='sales-order-cancel-tracking' hidden>取消</button>"
]) requireFragment(savedNumberHtml, fragment, `Registered waybill edit guard is missing: ${fragment}`);
if (progressHtml.includes("id='sales-order-edit-tracking'") || progressHtml.includes("readonly aria-readonly='true'")) {
  throw new Error("An unregistered waybill must remain directly editable for its first registration");
}

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
requireFragment(css, "#screen-sales-order-mgmt .sales-order-selection-controls { display: grid; grid-template-columns: 1fr;", "Mobile order selection must not reserve a removed B2 action column");

console.log("Sales order operations information architecture and responsive layout verification passed.");
