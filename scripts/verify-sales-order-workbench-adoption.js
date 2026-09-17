const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8").replace(/\r\n/g, "\n");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8").replace(/\r\n/g, "\n");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8").replace(/\r\n/g, "\n");

function requireFragment(target, fragment, message) {
  if (!target.includes(fragment)) throw new Error(message || `Missing adopted workbench contract: ${fragment}`);
}

function functionSource(name) {
  const markers = [`function ${name}(`, `async function ${name}(`];
  const starts = markers.map((marker) => source.indexOf(marker)).filter((index) => index >= 0);
  if (!starts.length) throw new Error(`Function is missing: ${name}`);
  const start = Math.min(...starts);
  const stops = [source.indexOf("\nfunction ", start + 1), source.indexOf("\nasync function ", start + 1)]
    .filter((index) => index >= 0);
  return source.slice(start, stops.length ? Math.min(...stops) : source.length);
}

const queueGroup = functionSource("salesOrderQueueGroup");
const nextOperation = functionSource("salesOrderNextOperationLabel");
const accountingApplies = functionSource("salesOrderAccountingApplies");
const accountingStatus = functionSource("salesOrderAccountingStatus");
const queueContext = {
  salesOrderStatusDetailLabel: () => "シリアル照合待ち",
  customerOrderStatusLabel: (status) => status,
  t: (key) => ({
    sales_order_next_export: "売上CSV出力",
    sales_order_next_registration: "販売王登録確認",
    sales_order_next_sales_complete: "売上処理完了",
    sales_order_next_sales_review: "売上状態を確認",
    sales_order_next_accept: "受注受付",
    sales_order_next_shipping: "出荷指示・準備",
    sales_order_next_picking: "ピッキング・照合",
    sales_order_next_none: "処理不要",
  })[key] || key,
};
vm.createContext(queueContext);
vm.runInContext([accountingApplies, accountingStatus, queueGroup, nextOperation].join("\n"), queueContext);
if (queueContext.salesOrderQueueGroup({ status: "shipped", sales_management_status: "not_exported" }) !== "sales") {
  throw new Error("Shipped orders awaiting sales export must be in the sales-first queue");
}
if (queueContext.salesOrderQueueGroup({ status: "accepted" }) !== "shipping") {
  throw new Error("Accepted orders must remain in the shipping queue");
}
if (queueContext.salesOrderNextOperationLabel({ status: "shipped", sales_management_status: "not_exported" }) !== "売上CSV出力") {
  throw new Error("The order list must identify sales export as the next operation");
}

const list = functionSource("renderSalesOrderList");
for (const fragment of [
  'salesOrderListStatus() === "work_queue"',
  'label: t("sales_order_queue_sales")',
  'label: t("sales_order_queue_shipping")',
  "group.rows.map(salesOrderListRowHtml)",
]) requireFragment(list, fragment);
if (list.indexOf('label: t("sales_order_queue_sales")') > list.indexOf('label: t("sales_order_queue_shipping")')) {
  throw new Error("The daily queue must place sales work before shipping work");
}
const listRow = functionSource("salesOrderListRowHtml");
for (const fragment of ["sales-order-list-next", "次の操作", "salesOrderNextOperationLabel(order)"]) {
  requireFragment(listRow, fragment);
}

const detail = functionSource("renderSalesOrderDetail");
for (const fragment of [
  '{ key: "accounting", label: "売上処理" }',
  "sales-order-detail-panel-accounting",
  "salesOrderAccountingPanelHtml(order)",
  'openSalesAccountingExport({ order: order })',
]) requireFragment(detail, fragment);
for (const obsolete of ["salesOrderStatusSummaryHtml(order)", "salesOrderOperationTracksHtml(order)"]) {
  if (detail.includes(obsolete)) throw new Error(`Selected-order detail repeats progress outside its owning section: ${obsolete}`);
}
if (source.includes("function salesOrderOperationTracksHtml(") || css.includes(".sales-order-operation-track")) {
  throw new Error("The duplicate shipping and sales progress strip must stay removed");
}

const accountingPanel = functionSource("salesOrderAccountingPanelHtml");
for (const fragment of [
  "sales-order-accounting-panel",
  "販売王",
  't("business_workspace_hanbaiou_path")',
  't("sales_accounting_create_default")',
  "data-sales-order-accounting-open",
]) requireFragment(accountingPanel, fragment);
if (/\bsb\.|\.from\(|\.insert\(|\.update\(|\.delete\(/.test(accountingPanel)) {
  throw new Error("The selected-order sales panel must delegate mutations to the existing export workflow");
}

const initialState = functionSource("initialSalesAccountingExportState");
for (const fragment of ["requestedOrderId: null", 'requestedOrderNumber: ""']) requireFragment(initialState, fragment);
const openExport = functionSource("openSalesAccountingExport");
for (const fragment of [
  "options && options.order ? options.order : null",
  "salesAccountingExportState.requestedOrderId",
  "salesAccountingExportState.requestedOrderNumber",
  "salesOrderWarrantyStartDate(requestedOrder)",
]) requireFragment(openExport, fragment);
const loadExport = functionSource("loadSalesAccountingExportData");
for (const fragment of [
  "if (state.requestedOrderId)",
  "parseInt(order.order_id, 10) === parseInt(state.requestedOrderId, 10)",
]) requireFragment(loadExport, fragment);
const loadDetail = functionSource("loadSalesOrderDetail");
for (const fragment of [
  "var selectionChanged",
  'salesOrderDetailView = "accounting"',
  'salesOrderDetailView === "overview"',
  'salesOrderAccountingStatus(salesOrderDetail) !== "registered"',
]) requireFragment(loadDetail, fragment);

requireFragment(html, 'id="sales-accounting-export-order-context"');
for (const fragment of [
  ".sales-order-queue-heading",
  ".sales-order-list-next",
  ".sales-order-accounting-panel",
  ".sales-order-accounting-facts",
  ".sales-accounting-export-order-context",
  "#screen-sales-order-mgmt .sales-order-accounting-facts { grid-template-columns: 1fr; }",
]) requireFragment(css, fragment);

console.log("Adopted sales-order workbench hierarchy and selected-order accounting flow verification passed.");
