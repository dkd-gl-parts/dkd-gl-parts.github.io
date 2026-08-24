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
  "shipping-document-lookup-message",
  "shipping-document-status",
  "shipping-document-print-state",
  "shipping-document-date-from",
  "shipping-document-date-to",
  "shipping-document-reload",
  "shipping-document-list",
  "shipping-document-check-all",
  "shipping-document-batch-print",
  "shipping-document-batch-message",
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
  'sb.rpc("list_sales_order_fulfillment_documents"',
  'sb.rpc("save_sales_order_outbound_waybill"',
  'sb.rpc("queue_sales_order_outbound_waybill_print"',
  'sb.rpc("queue_sales_order_fulfillment_documents"',
  '"yamato_prepaid"',
  '"sagawa_prepaid"',
  '"yamato_collect"',
  '"sagawa_collect"',
  'ヤマト宅急便　着払い',
  '佐川急便着払い',
  'ドットプリンタで印刷',
  'dcats-print-settings://open',
  'データ破損など同じ内容が必要な場合',
  'reason.length < 5'
]) requireFragment(source, fragment);

const enterSource = sourceBetween("async function enterShippingDocumentMgmt", "function renderShippingDocumentList");
for (const fragment of [
  "options = options || {}",
  "options.order",
  "shippingDocumentDetail = options.order",
  "loadShippingDocumentB2History"
]) requireFragment(enterSource, fragment);
if (enterSource.includes("loadShippingDocumentOrders()")) {
  throw new Error("Shipping document management must wait for an order ID or dispatch scan instead of loading every order on entry");
}

const lookupSource = sourceBetween("async function lookupShippingDocumentOrder", "function shippingDocumentRecentBatchesHtml");
for (const fragment of [
  'sb.rpc("get_sales_order_dispatch"',
  "target_dispatch_number: normalized",
  "shippingDocumentExactOrder",
  "loadShippingDocumentDetail",
  "loadShippingDocumentB2History(resolvedOrder.order_number",
  "shippingDocumentHasSearched = true"
]) requireFragment(lookupSource, fragment);

const requiredDocuments = sourceBetween("function shippingDocumentShipmentDocumentsHtml", "function shippingDocumentReturnWaybillHtml");
for (const fragment of [
  'key: "dispatch"',
  'key: "outbound_waybill"',
  'key: "warranty"',
  'key: "core_return"',
  'key: "return_waybill"',
  "shipping-document-required-list",
  "出荷指示書を印刷・PDF保存",
  "発送用送り状を設定",
  "返却伝票を設定"
]) requireFragment(requiredDocuments, fragment);

const outboundWaybill = sourceBetween("function shippingDocumentOutboundWaybillHtml", "function shippingDocumentShipmentDocumentsHtml");
for (const fragment of [
  "商品発送送り状",
  "ヤマト宅急便　元払い",
  "佐川急便　元払い",
  "B2クラウド",
  "手書き",
  "ドットプリンタ",
  "商品発送用伝票番号"
]) requireFragment(outboundWaybill, fragment);

const outboundSave = sourceBetween("async function saveShippingDocumentOutboundWaybill", "async function queueShippingDocumentOutboundWaybillPrint");
for (const fragment of [
  "tracking.length !== 12",
  'sb.rpc("save_sales_order_outbound_waybill"',
  "target_expected_version"
]) requireFragment(outboundSave, fragment);

const batchQueue = sourceBetween("async function queueSelectedShippingDocuments", "async function loadShippingDocumentOrders");
for (const fragment of [
  "shippingDocumentCheckedIdsState",
  "shippingDocumentSelectedTypes",
  'sb.rpc("queue_sales_order_fulfillment_documents"'
]) requireFragment(batchQueue, fragment);

const salesOrderDispatchUi = sourceBetween("function salesOrderDispatchHtml", "function renderSalesOrderDetail");
requireFragment(salesOrderDispatchUi, 'id=\'sales-order-open-shipping-documents\'');
requireFragment(source, "enterShippingDocumentMgmt({ order: salesOrderDetail })");

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
  ".shipping-document-batch-panel",
  ".shipping-document-row-check",
  ".shipping-document-print-actions",
  ".shipping-document-required-list",
  ".shipping-document-required-row",
  ".shipping-document-lookup-message"
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
  'content="v1.1.746"',
  'styles.css?v=1.1.746',
  'app.js?v=1.1.746'
]) requireFragment(html, fragment);
requireFragment(source, 'var APP_VERSION       = "v1.1.746"');

if (/service[_-]?role|postgres(?:ql)?:\/\//i.test(source)) {
  throw new Error("Browser fulfillment document code must not contain server credentials");
}

console.log("Order fulfillment document UI verification passed.");
