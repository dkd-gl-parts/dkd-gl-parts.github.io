const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const printCss = fs.readFileSync(path.join(root, "shipment-instruction-print.css"), "utf8");
const contract = fs.readFileSync(path.join(root, "docs", "customer-order-b2-manual-contract.md"), "utf8");

function requireFragment(text, fragment, message) {
  if (!text.includes(fragment)) throw new Error(message || `Missing fulfillment document contract: ${fragment}`);
}

function sourceBetween(startText, endText) {
  const start = source.indexOf(startText);
  const end = source.indexOf(endText, start + startText.length);
  if (start < 0 || end < start) throw new Error(`${startText} could not be isolated`);
  return source.slice(start, end);
}

for (const id of [
  "screen-shipping-document-mgmt",
  "btn-back-shipping-document-mgmt",
  "shipping-document-search",
  "shipping-document-status",
  "shipping-document-reload",
  "shipping-document-list",
  "shipping-document-detail"
]) requireFragment(html, `id="${id}"`);

for (const fragment of [
  'action: "shipping-document-mgmt"',
  'enterShippingDocumentMgmt()',
  'sb.rpc("list_sales_order_b2_exports"',
  'sb.rpc("create_sales_order_b2_export"',
  'sb.rpc("get_sales_order_b2_export_batch"',
  'sb.rpc("save_sales_order_return_waybill"',
  'sb.rpc("queue_sales_order_return_waybill_print"',
  '"yamato_collect"',
  '"sagawa_collect"',
  'ヤマト宅急便　着払い',
  '佐川急便着払い',
  'ドットプリンタで印刷',
  'dcats-print-settings://open',
  'データ破損など同じ内容が必要な場合',
  'reason.length < 5'
]) requireFragment(source, fragment);

const issueSource = sourceBetween("async function issueSalesOrderB2Export", "async function downloadSalesOrderB2Batch");
if (issueSource.includes('sb.rpc("get_sales_order_b2_export"')) {
  throw new Error("B2 initial issue must use the audited issue RPC rather than the legacy preview RPC");
}
for (const fragment of ["target_reissue", "target_reason", "downloadSalesOrderB2Payload"]) {
  requireFragment(issueSource, fragment);
}

const printSource = sourceBetween("function salesOrderPrintItemRows", "async function loadSalesOrderDetail");
for (const fragment of [
  "manufacturing_serial",
  "製造シリアル",
  'dispatch.status !== "shipped"',
  "!order.outbound_tracking_number",
  "shipment-document-table-"
]) requireFragment(printSource, fragment);

for (const fragment of [
  ".shipping-document-workspace",
  ".shipping-document-stages",
  ".shipping-document-waybill-form",
  ".shipping-document-waybill-print-row",
  ".shipping-document-print-actions"
]) requireFragment(css, fragment);
requireFragment(printCss, ".shipment-document-table-warranty th:nth-child(5)");

for (const fragment of [
  "API直接連携は、有料・大口契約向けのため導入を見送る",
  "ヤマト宅急便　着払い",
  "佐川急便着払い",
  "発行済み注文の重複出力は防止",
  "同一データを再ダウンロード"
]) requireFragment(contract, fragment);

for (const fragment of [
  'content="v1.1.740"',
  'styles.css?v=1.1.740',
  'app.js?v=1.1.740'
]) requireFragment(html, fragment);
requireFragment(source, 'var APP_VERSION       = "v1.1.740"');

if (/service[_-]?role|postgres(?:ql)?:\/\//i.test(source)) {
  throw new Error("Browser fulfillment document code must not contain server credentials");
}

console.log("Order fulfillment document UI verification passed.");
