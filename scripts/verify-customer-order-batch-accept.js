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

for (const id of ["sales-order-batch-accept", "sales-order-batch-message"]) {
  if (!html.includes(`id="${id}"`)) throw new Error(`Batch acceptance UI is missing: ${id}`);
}
for (const fragment of [
  ".sales-order-accept-button {",
  ".sales-order-accept-button:disabled",
  ".sales-order-batch-message.error"
]) {
  if (!css.includes(fragment)) throw new Error(`Batch acceptance styling is missing: ${fragment}`);
}
if (!source.includes("var salesOrderCheckedIdsState = new Set();")) {
  throw new Error("Checked orders must survive detail-row rendering");
}

const selection = sourceBetween("function updateSalesOrderSelectionButtons", "function salesOrderPrintStationStateLabel");
for (const fragment of [
  'row.status === "submitted"',
  'document.getElementById("sales-order-batch-accept")',
  "acceptButton.disabled",
  "acceptIds.length"
]) {
  if (!selection.includes(fragment)) throw new Error(`Selection guard is missing: ${fragment}`);
}

const batchAccept = sourceBetween("async function acceptCheckedSalesOrders", "function salesOrderItemRowsHtml");
for (const fragment of [
  'order.status === "submitted"',
  'sb.rpc("accept_sales_orders"',
  "target_order_ids: orderIds",
  "accepted_count",
  "failedRows",
  "print_error",
  "await refreshSalesOrderManagement()"
]) {
  if (!batchAccept.includes(fragment)) throw new Error(`Batch acceptance contract is missing: ${fragment}`);
}
if (!source.includes('accept: "受付して出荷指示書を発行"')) {
  throw new Error("Single-order acceptance must describe dispatch issuance");
}
if (!source.includes('document.getElementById("sales-order-batch-accept").addEventListener("click", acceptCheckedSalesOrders)')) {
  throw new Error("Batch acceptance button is not wired");
}

const submitOrder = sourceBetween("async function submitCustomerOrder", "function renderCustomerOrderHistory");
if (submitOrder.includes("print_job_count") || submitOrder.includes("customer_order_submit_print_queued")) {
  throw new Error("Order placement must reserve stock but must not print before acceptance");
}

console.log("Customer order batch acceptance UI verification passed.");
