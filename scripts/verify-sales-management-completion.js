const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

function requireText(target, value, message) {
  if (!target.includes(value)) throw new Error(message || `Missing sales-management contract: ${value}`);
}

[
  '<option value="work_queue" selected>当日業務</option>',
  '<option value="sales_pending">売上未処理</option>',
  '<option value="sales_registered">売上登録済み</option>',
  'data-sales-order-dashboard-status="work_queue"',
  'data-sales-order-dashboard-status="sales_pending"',
  'data-sales-order-dashboard-status="sales_registered"'
].forEach((value) => requireText(html, value));

[
  'sb.rpc("get_sales_order_accounting_status"',
  'sb.rpc("confirm_sales_accounting_export_registration"',
  "salesOrderAccountingStatusHtml(order)",
  "registrationConfirmBatchId",
  "data-sales-accounting-registration-open",
  "data-sales-accounting-registration-confirm",
  "await refreshSalesOrderManagement()"
].forEach((value) => requireText(app, value));

[
  ".sales-order-accounting-status.not-exported",
  ".sales-order-accounting-status.registration-pending",
  ".sales-order-accounting-status.registered",
  ".sales-accounting-export-registration-confirm",
  "repeat(8, minmax(84px, 1fr))"
].forEach((value) => requireText(css, value));

if (/confirm\([^)]*販売管理/.test(app)) {
  throw new Error("Sales registration confirmation must use the inline confirmation panel, not a native confirm dialog");
}

const helpersStart = app.indexOf("function salesOrderAccountingApplies");
const helpersEnd = app.indexOf("function normalizeCustomerOrderReference", helpersStart);
if (helpersStart < 0 || helpersEnd < 0) throw new Error("Could not isolate sales-management status helpers");
const context = {
  t: (key) => key,
  esc: (value) => String(value)
};
vm.runInNewContext(app.slice(helpersStart, helpersEnd), context);

const shippedUnexported = { status: "shipped", sales_management_status: "not_exported" };
const shippedRegistered = { status: "shipped", sales_management_status: "registered" };
const shippingReady = { status: "shipping_ready", sales_management_status: "not_exported" };

if (!context.salesOrderAccountingApplies(shippedUnexported) || context.salesOrderAccountingApplies(shippingReady)) {
  throw new Error("Sales status must only apply after shipment");
}
if (context.salesOrderAccountingStatus(shippedRegistered) !== "registered") {
  throw new Error("Registered sales status was not preserved");
}
if (!context.salesOrderAccountingStatusHtml(shippedUnexported).includes("not-exported") || context.salesOrderAccountingStatusHtml(shippingReady)) {
  throw new Error("Sales status badge visibility is incorrect");
}

console.log("Sales-management completion UI verification passed.");
