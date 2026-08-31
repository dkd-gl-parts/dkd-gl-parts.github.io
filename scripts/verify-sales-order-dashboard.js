const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8").replace(/\r\n/g, "\n");

function requireFragment(input, fragment, label) {
  if (!input.includes(fragment)) throw new Error(`${label} is missing: ${fragment}`);
}

function sourceBetween(startText, endText) {
  const start = source.indexOf(startText);
  const end = source.indexOf(endText, start + startText.length);
  if (start < 0 || end < start) throw new Error(`${startText} could not be isolated`);
  return source.slice(start, end);
}

const statuses = ["all", "submitted", "accepted", "shipping_ready", "shipped", "completed", "cancelled"];
for (const status of statuses) {
  requireFragment(html, `data-sales-order-dashboard-status="${status}"`, "dashboard status action");
  requireFragment(html, `data-sales-order-dashboard-count="${status}"`, "dashboard status count");
}

const dashboardStart = html.indexOf('id="sales-order-dashboard"');
const workspaceStart = html.indexOf('class="sales-order-workspace"');
if (dashboardStart < 0 || workspaceStart < 0 || dashboardStart > workspaceStart) {
  throw new Error("dashboard must appear before the order workspace");
}

const countsSource = sourceBetween("function salesOrderDashboardCounts", "function renderSalesOrderDashboard");
const counts = vm.runInNewContext(
  `var salesOrderDashboardRows = [
    { status: "submitted" }, { status: "submitted" }, { status: "accepted" },
    { status: "shipping_ready" }, { status: "shipped" }, { status: "completed" }, { status: "cancelled" }
  ];\n${countsSource}\nsalesOrderDashboardCounts();`
);
if (counts.all !== 7 || counts.submitted !== 2 || statuses.slice(2).some((status) => counts[status] !== 1)) {
  throw new Error(`dashboard status counts are incorrect: ${JSON.stringify(counts)}`);
}

const loader = sourceBetween("async function loadSalesOrderDashboard", "async function refreshSalesOrderManagement");
for (const fragment of [
  'sb.rpc("list_sales_orders"',
  "target_status: null",
  "target_search: null",
  "target_limit: 300",
  "salesOrderDashboardLoading = false",
  "salesOrderDashboardError"
]) requireFragment(loader, fragment, "dashboard loader");

const refresh = sourceBetween("async function refreshSalesOrderManagement", "function selectSalesOrderDashboardStatus");
requireFragment(refresh, "Promise.all([loadSalesOrders(), loadSalesOrderDashboard()])", "dashboard refresh");

const selection = sourceBetween("function selectSalesOrderDashboardStatus", "function salesOrderCheckedIds");
for (const fragment of [
  "select.value = status",
  'search.value = ""',
  "renderSalesOrderDashboard()",
  "loadSalesOrders()"
]) requireFragment(selection, fragment, "dashboard filter selection");

for (const fragment of [
  ".sales-order-dashboard {",
  ".sales-order-dashboard-metrics {",
  ".sales-order-dashboard-metric.active {",
  ".sales-order-dashboard-metric:focus-visible {",
  ".sales-order-dashboard-metrics { display: flex; overflow-x: auto;",
  ".sales-order-dashboard-metric { flex: 0 0 104px;",
  ".sales-order-status { display: inline-flex; align-items: center; justify-content: center; min-width: 60px; height: 24px;",
  "line-height: 1; letter-spacing: 0; white-space: nowrap;",
  ".sales-order-list-identity .sales-order-status {",
  "display: inline-flex;",
  "flex: 0 0 64px;",
  "width: 64px;",
  "height: 26px;",
  "padding: 0;",
  "text-align: center;"
]) requireFragment(css, fragment, "dashboard responsive style");

for (const fragment of [
  "#screen-sales-order-mgmt.active {",
  "height: 100dvh;",
  "grid-template-rows: 80px 54px minmax(0, 1fr);",
  ".sales-order-auto-print {\n    grid-column: 1;\n    grid-row: 2;",
  ".sales-order-dashboard {\n    grid-column: 2;\n    grid-row: 2;",
  ".sales-order-workspace {\n    grid-column: 1 / -1;\n    grid-row: 3;",
  ".sales-order-list { flex: 1 1 auto; height: auto; min-height: 0;",
  ".sales-order-detail-pane {\n    min-height: 0;"
]) requireFragment(css, fragment, "desktop order workstation style");

requireFragment(source, 'document.querySelectorAll("[data-sales-order-dashboard-status]")', "dashboard event registration");
if (source.includes('.from("customer_orders")') || source.includes('.from("customer_order_items")')) {
  throw new Error("dashboard must use reviewed order RPCs instead of direct table access");
}

console.log("Sales order operations dashboard verification passed.");
