const fs = require("fs");
const path = require("path");
const vm = require("vm");

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
  "shipping-document-batch-default-note",
  "shipping-document-detail",
  "shipping-document-settings-overlay",
  "shipping-document-settings-title",
  "shipping-document-settings-content",
  "shipping-document-settings-close",
  "shipping-document-settings-cancel"
]) requireFragment(html, `id="${id}"`);

for (const fragment of [
  'action: "shipping-document-mgmt"',
  'enterShippingDocumentMgmt()',
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
  'ドットプリンタ',
  'dcats-print-settings://open',
  'データ破損など同じ内容が必要な場合',
  'reason.length < 5'
]) requireFragment(source, fragment);

const enterSource = sourceBetween("async function enterShippingDocumentMgmt", "function renderShippingDocumentList");
for (const fragment of [
  "options = options || {}",
  "options.order",
  "shippingDocumentDetail = options.order",
  'shippingDocumentOverlayMode = ""'
]) requireFragment(enterSource, fragment);
for (const fragment of [
  "loadSalesOrderPrintSettings()",
  "shippingDocumentBatchSelectionDirty",
  "syncShippingDocumentBatchDefaults"
]) requireFragment(enterSource, fragment);
if (enterSource.includes("loadShippingDocumentOrders()")) {
  throw new Error("Shipping document management must wait for an order ID or dispatch scan instead of loading every order on entry");
}
if (enterSource.includes("list_sales_order_b2_exports") || enterSource.includes("loadShippingDocumentB2History")) {
  throw new Error("Shipping document management must not load B2 history on entry");
}

const batchDefaultsSource = sourceBetween("function salesOrderAutoPrintIsEnabled", "async function enterShippingDocumentMgmt");
for (const fragment of [
  'input.value === "dispatch" ? !autoPrintEnabled : true',
  "受付時自動印刷：有効 / 出荷指示書は初期選択から除外",
  "受付時自動印刷：無効 / 出荷指示書を初期選択に含めます",
  "受付時自動印刷を確認できないため、出荷指示書を初期選択に含めます"
]) requireFragment(batchDefaultsSource, fragment);

function evaluateBatchDefaults(autoPrintEnabled, state) {
  const inputs = [{ value: "dispatch", checked: true }, { value: "warranty", checked: false }];
  const note = { textContent: "", className: "" };
  vm.runInNewContext(`${batchDefaultsSource}\nsyncShippingDocumentBatchDefaults(${JSON.stringify(state)});`, {
    salesOrderPrintSettings: { config: { auto_print_enabled: autoPrintEnabled } },
    document: {
      querySelectorAll: () => inputs,
      getElementById: () => note
    },
    updateShippingDocumentBatchControls: () => {}
  });
  return { inputs, note };
}
const autoDefaults = evaluateBatchDefaults(true, "loaded");
const manualDefaults = evaluateBatchDefaults(false, "loaded");
const errorDefaults = evaluateBatchDefaults(true, "error");
if (autoDefaults.inputs[0].checked || !autoDefaults.inputs[1].checked || !autoDefaults.note.textContent.includes("初期選択から除外")) {
  throw new Error("Enabled acceptance auto-print must exclude only the dispatch instruction from batch defaults");
}
if (!manualDefaults.inputs.every((input) => input.checked) || !manualDefaults.note.textContent.includes("初期選択に含めます")) {
  throw new Error("Disabled acceptance auto-print must include the dispatch instruction in batch defaults");
}
if (!errorDefaults.inputs.every((input) => input.checked) || !errorDefaults.note.textContent.includes("確認できないため")) {
  throw new Error("Unknown auto-print state must fail safe by including the dispatch instruction");
}

const lookupSource = sourceBetween("async function lookupShippingDocumentOrder", "async function loadShippingDocumentDetail");
for (const fragment of [
  'sb.rpc("get_sales_order_dispatch"',
  "target_dispatch_number: normalized",
  "shippingDocumentExactOrder",
  "loadShippingDocumentDetail",
  "shippingDocumentHasSearched = true"
]) requireFragment(lookupSource, fragment);
if (lookupSource.includes("loadShippingDocumentB2History")) {
  throw new Error("Order lookup must not issue a second B2-history search");
}

const defaultDocuments = sourceBetween("function shippingDocumentDefaultStateHtml", "function shippingDocumentOutboundWaybillHtml");
for (const fragment of [
  "帳票の標準設定",
  "A4 / 受付時に自動発行",
  "B2クラウド / ヤマト宅急便 元払い",
  "A5 / 注文単位",
  "A5 / コア返却必要時",
  "手書き / ヤマト宅急便 着払い"
]) requireFragment(defaultDocuments, fragment);

const requiredDocuments = sourceBetween("function shippingDocumentShipmentDocumentsHtml", "function shippingDocumentReturnWaybillHtml");
for (const fragment of [
  'key: "dispatch"',
  'key: "outbound_waybill"',
  'key: "warranty"',
  'key: "core_return"',
  'key: "return_waybill"',
  "shipping-document-required-list",
  "shipping-document-required-head",
  "標準設定",
  "現在の状態",
  "発行操作",
  "data-shipping-document-open-settings='outbound'",
  "data-shipping-document-open-settings='return'"
]) requireFragment(requiredDocuments, fragment);

const detailSource = sourceBetween("function renderShippingDocumentDetail", "function bindShippingDocumentDetailActions");
for (const fragment of [
  "shippingDocumentDefaultStateHtml()",
  "shippingDocumentStageHtml(order)",
  "shippingDocumentShipmentDocumentsHtml(order)",
  "B2発行履歴",
  "受注詳細"
]) requireFragment(detailSource, fragment);
for (const forbidden of ["salesOrderItemRowsHtml(order.items)", "対象商品", "shippingDocumentOutboundWaybillHtml(order)", "shippingDocumentReturnWaybillHtml(order)"]) {
  if (detailSource.includes(forbidden)) throw new Error(`Shipping document initial detail must not include order contents or inline settings: ${forbidden}`);
}

const overlaySource = sourceBetween("function openShippingDocumentSettings", "function syncShippingDocumentOutboundWaybillFields");
for (const fragment of [
  'shippingDocumentOverlayMode = mode',
  'mode === "outbound"',
  'mode === "return"',
  "shippingDocumentOutboundWaybillHtml(order)",
  "shippingDocumentReturnWaybillHtml(order)",
  "shippingDocumentOrderB2HistoryHtml(order)"
]) requireFragment(overlaySource, fragment);
requireFragment(source, 'openShippingDocumentSettings("history")');

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
  ".shipping-document-batch-default-note",
  ".shipping-document-row-check",
  ".shipping-document-print-actions",
  ".shipping-document-required-list",
  ".shipping-document-required-head",
  ".shipping-document-required-row",
  ".shipping-document-defaults",
  ".shipping-document-default-row",
  ".shipping-document-settings-card",
  ".shipping-document-settings-heading",
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
  'content="v1.1.748"',
  'styles.css?v=1.1.748',
  'app.js?v=1.1.748'
]) requireFragment(html, fragment);
requireFragment(source, 'var APP_VERSION       = "v1.1.748"');

if (/service[_-]?role|postgres(?:ql)?:\/\//i.test(source)) {
  throw new Error("Browser fulfillment document code must not contain server credentials");
}

console.log("Order fulfillment document UI verification passed.");
