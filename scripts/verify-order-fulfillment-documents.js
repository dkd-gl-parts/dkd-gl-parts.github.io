const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const printCss = fs.readFileSync(path.join(root, "shipment-instruction-print.css"), "utf8");
const contract = fs.readFileSync(path.join(root, "docs", "customer-order-b2-manual-contract.md"), "utf8");
const carrierAssets = [
  path.join(root, "assets", "carriers", "yamato-transport.png"),
  path.join(root, "assets", "carriers", "sagawa-express.png")
];

for (const asset of carrierAssets) {
  if (!fs.existsSync(asset) || fs.statSync(asset).size === 0) {
    throw new Error(`Missing carrier branding asset: ${path.relative(root, asset)}`);
  }
}

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
  "shipping-document-settings-cancel",
  "shipping-handwritten-waybill-overlay",
  "shipping-handwritten-waybill-title",
  "shipping-handwritten-waybill-description",
  "shipping-handwritten-waybill-progress",
  "shipping-handwritten-waybill-content",
  "shipping-handwritten-waybill-cancel",
  "shipping-handwritten-waybill-complete"
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
  'sb.rpc("complete_sales_order_handwritten_waybill"',
  '"yamato_prepaid"',
  '"sagawa_prepaid"',
  '"yamato_collect"',
  '"sagawa_collect"',
  'ヤマト宅急便　着払い',
  '佐川急便着払い',
  'ドットプリンタ',
  'SHIPPING_CARRIER_BRANDS',
  'assets/carriers/yamato-transport.png',
  'assets/carriers/sagawa-express.png',
  'shippingCarrierBrandHtml',
  'syncShippingDocumentCarrierBrand',
  'dcats-print-settings://open',
  'データ破損など同じ内容が必要な場合',
  'reason.length < 5'
]) requireFragment(source, fragment);
requireFragment(html, 'dcats-print-calibration://open');

const enterSource = sourceBetween("async function enterShippingDocumentMgmt", "function renderShippingDocumentList");
for (const fragment of [
  "options = options || {}",
  "options.order",
  "shippingDocumentDetail = options.order",
  "await loadShippingDocumentDetail(options.order.id)",
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

const pendingCountSource = sourceBetween("function shippingDocumentPendingCount", "function renderShippingDocumentList");
for (const fragment of [
  "pending_document_count",
  'var requiredTypes = ["dispatch"]',
  'salesOrderWarrantyDocumentRequired(order)',
  'requiredTypes.push("core_return")',
  '["dot_matrix", "handwritten"].indexOf(order.outbound_waybill_method)',
  '["dot_matrix", "handwritten"].indexOf(order.return_waybill_method)'
]) requireFragment(pendingCountSource, fragment);
const pendingCountContext = { salesOrderWarrantyDocumentRequired: (order) => order.warranty_document_required !== false };
vm.runInNewContext(pendingCountSource, pendingCountContext);
if (pendingCountContext.shippingDocumentPendingCount({ pending_document_count: 1 }) !== 1) {
  throw new Error("The server-calculated pending document count must drive the order list");
}
if (pendingCountContext.shippingDocumentPendingCount({
  core_return_required: true,
  document_statuses: { dispatch: "printed", warranty: "unissued", core_return: "printed" }
}) !== 1) {
  throw new Error("One remaining warranty must keep the order in the unprinted state");
}
if (pendingCountContext.shippingDocumentPendingCount({
  core_return_required: false,
  document_statuses: { dispatch: "printed", warranty: "printed", core_return: "unissued", return_waybill: "unissued" }
}) !== 0) {
  throw new Error("Core-return documents must not count for an order that does not require a core return");
}
if (pendingCountContext.shippingDocumentPendingCount({
  warranty_document_required: false,
  core_return_required: false,
  document_statuses: { dispatch: "printed", warranty: "unissued" }
}) !== 0) {
  throw new Error("Replacement-only orders must not count a warranty certificate as pending");
}

const shippingDocumentListSource = sourceBetween("function renderShippingDocumentList", "function shippingDocumentSelectedTypes");
for (const fragment of [
  "shipping-document-order-id-label",
  't("sales_order_id_label")',
  "order.order_number"
]) requireFragment(shippingDocumentListSource, fragment, `Shipping document list order ID label is missing: ${fragment}`);

const shippingDocumentDetailSource = sourceBetween("function renderShippingDocumentDetail", "function bindShippingDocumentDetailActions");
for (const fragment of [
  "shipping-document-order-id-label",
  't("sales_order_id_label")',
  "shipping-document-detail-target",
  "order.order_number",
  "shippingDocumentOrderContentsHtml(order)"
]) requireFragment(shippingDocumentDetailSource, fragment, `Shipping document detail order ID label is missing: ${fragment}`);

const shippingDocumentOrderContents = sourceBetween("function shippingDocumentOrderContentsHtml", "function renderShippingDocumentDetail");
for (const fragment of [
  "受注内容",
  "shipping-document-order-items",
  "genuine_part_number",
  "manufacturer_part_number",
  "customerProductKindLabel(orderItem.product_kind)",
  't("customer_order_quantity")',
  't("core_return_required_label")',
  '"core_return_required" : "core_return_not_required"',
  'tf("customer_catalog_count"'
]) requireFragment(shippingDocumentOrderContents, fragment, `Shipping document order contents contract is missing: ${fragment}`);

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
  "A5 / 商品数量分 / 端末印刷",
  "A5 / コア返却必要時 / 端末印刷",
  "対象商品1個につき1枚 / 佐川急便 着払い",
  'carrierCode: "yamato_prepaid"',
  'carrierCode: "sagawa_collect"',
  "shipping-document-name-cell"
]) requireFragment(defaultDocuments, fragment);

const carrierBrand = sourceBetween("function shippingCarrierBrandHtml", "function syncShippingDocumentCarrierBrand");
for (const fragment of [
  "shipping-carrier-logo",
  "shipping-carrier-brand-copy",
  "<strong>"
]) requireFragment(carrierBrand, fragment);
if (carrierBrand.includes("<small>") || carrierBrand.includes("purpose")) {
  throw new Error("Carrier labels must contain only the logo and carrier name");
}

const temporaryOutput = sourceBetween("function shippingDocumentLocalOutputType", "function shippingDocumentDefaultStateHtml");
for (const fragment of [
  'return ["dispatch", "warranty", "core_return"].indexOf(type) >= 0',
  "shippingDocumentTemporaryOutputs",
  'mode === "browser" ? "表示・PDF" : "端末印刷"',
  "この画面でこの受注を開いている間だけ有効です",
  "自動印刷や保存済みの標準プリンターは変更しません",
  "端末印刷（保存済みの標準プリンター）",
  "表示・PDF（印刷画面でプリンターを選択）",
  "標準プリンターを変更",
  "shippingDocumentManualOutputActions"
]) requireFragment(temporaryOutput, fragment);
if (temporaryOutput.includes("sb.rpc(")) {
  throw new Error("Temporary output selection must not persist or mutate server-side print settings");
}

const printState = sourceBetween("function shippingDocumentPrintStateLabel", "function shippingDocumentStageHtml");
const stateViewContext = {};
vm.runInNewContext(sourceBetween("function salesOrderPrintJobStatusLabel", "function salesOrderDocumentTypeLabel"), stateViewContext);
vm.runInNewContext(sourceBetween("function shippingDocumentPrintStateView", "function stopShippingDocumentPrintStatusPolling"), stateViewContext);
for (const [status, label, tone] of [
  ["printed", "印刷済み", "success"], ["queued", "印刷待ち", "processing"],
  ["claimed", "印刷中", "processing"], ["error", "印刷エラー", "danger"],
  ["cancelled", "取消", "warning"], ["unknown", "未登録", "neutral"]
]) {
  const view = stateViewContext.shippingDocumentPrintStateView({ status, source: "accept_auto" });
  if (view.label !== label || view.tone !== tone || view.note !== "受付時自動発行") {
    throw new Error(`Print state presentation/source must remain distinct: ${status}`);
  }
}
if (stateViewContext.shippingDocumentPrintStateView(null).tone !== "warning"
  || stateViewContext.shippingDocumentPrintStateView(null).label !== "未発行"
  || stateViewContext.shippingDocumentPrintStateView({ status: "printed", source: "shipment_auto" }).note !== "出荷完了時自動発行") {
  throw new Error("Unissued documents must not look completed and automatic print sources must remain visible");
}
for (const fragment of [
  'job.source === "accept_auto"',
  'job.source === "shipment_auto"',
  "受付時自動発行",
  "出荷完了時自動発行",
  "未発行"
]) requireFragment(printState, fragment);
for (const fragment of [
  "function stopShippingDocumentPrintStatusPolling",
  "function shippingDocumentHasActivePrintJob",
  "function scheduleShippingDocumentPrintStatusRefresh",
  "function refreshShippingDocumentPrintStatus",
  'activeScreenId() !== "shipping-document-mgmt"',
  'sb.rpc("get_sales_order_detail"',
  'renderShippingDocumentList()',
  'renderShippingDocumentDetail()',
  "コア返却用複写伝票の印刷が完了しました。",
  "必要な場合は「再印刷」",
  "印刷端末を確認して「再送」"
]) requireFragment(printState, fragment);

const requiredDocuments = sourceBetween("function shippingDocumentShipmentDocumentsHtml", "function shippingDocumentReturnWaybillHtml");
for (const fragment of [
  'key: "dispatch"',
  'key: "outbound_waybill"',
  'key: "warranty"',
  'key: "core_return"',
  'key: "return_waybill"',
  "shipping-document-required-list",
  "shipping-document-required-head",
  "用紙・発行方法",
  "shipping-document-standard-detail",
  "shipping-document-state-cell",
  "shipping-document-state-badge",
  "data-document-type=",
  "data-state=",
  "role='table'",
  'esc(row.state.label)',
  'esc(row.state.note)',
  'standard: outboundModeLabel, detail: outboundCarrierLabel',
  'shippingCarrierBrandKey(waybill.carrier_code || "sagawa_collect")',
  "標準設定",
  "現在の状態",
  "発行操作",
  "data-shipping-document-open-settings='outbound'",
  "data-shipping-document-open-settings='return'",
  'shippingDocumentManualOutputActions(order, "dispatch"',
  'warrantyRequired ? shippingDocumentManualOutputActions(order, "warranty"',
  'shippingDocumentManualOutputActions(order, "core_return"',
  'var coreReturnReady = !!dispatch && !!order.core_return_required',
  'shippingDocumentManualOutputActions(order, "core_return", coreReturnReady)',
  'ready: coreReturnReady',
  '保証書・コア返却シートは発行できます。',
  'warrantyRequired ? shippingDocumentPrintStateView(warrantyJob, "未発行")',
  'label: "対象外", tone: "neutral", note: "交換品"',
  'shippingDocumentPrintStateView(coreJob, "未発行")',
  "今回のみ:",
  'carrierCode: outboundWaybill.carrier_code || "yamato_prepaid"',
  'carrierCode: waybill.carrier_code || "sagawa_collect"',
  'waybill.handling_method || order.return_waybill_method || "handwritten"',
  'shippingDocumentReturnWaybillCopyCount(order)',
  'shippingDocumentWaybillNumberIsValid(outboundWaybill.tracking_number)',
  'shippingDocumentWaybillNumberIsValid(waybill.tracking_number)',
  'returnWaybillCopyCount + "枚", detail: returnCarrierLabel + " / 1商品1枚"',
  'var returnCanPrint = !!(dispatch && order.core_return_required && returnWaybillCopyCount > 0 && returnMethod === "dot_matrix"',
  'var returnCanHandwrite = !!(dispatch && order.core_return_required && returnWaybillCopyCount > 0 && returnMethod === "handwritten"',
  'returnJob.status === "printed" ? "再印刷"',
  'returnJob.status === "error" ? "再送" : "端末印刷"',
  'esc(returnPrintActionLabel) + "（" + returnWaybillCopyCount + "枚）',
  '手書き内容を表示（" + returnWaybillCopyCount + "枚）',
  "shippingCarrierBrandHtml(row.carrierCode, true)"
]) requireFragment(requiredDocuments, fragment);
if (requiredDocuments.includes('var returnCanPrint = !!(ready &&')) {
  throw new Error("Core-return multipart waybill printing must be available before shipment completion");
}
if (requiredDocuments.includes('var returnCanHandwrite = !!(ready &&')) {
  throw new Error("Core-return handwritten content must be available before shipment completion");
}
if (requiredDocuments.includes("待機中")) {
  throw new Error("Unissued shipment documents must be labeled as unissued, not as an active print wait state");
}
if (requiredDocuments.includes('shippingDocumentManualOutputActions(order, "core_return", shipmentReady)')) {
  throw new Error("Core-return sheet printing must not wait for shipment completion");
}

const salesOrderDocumentPrint = sourceBetween("async function printSalesOrderDocument", "async function loadSalesOrderDetail");
for (const forbidden of [
  'type === "core_return" && (dispatch.status !== "shipped"',
  "商品・製造シリアル照合とB2発行済データ取込の両方が完了してから"
]) {
  if (salesOrderDocumentPrint.includes(forbidden)) {
    throw new Error(`Core-return sheet browser printing must be available before shipment completion: ${forbidden}`);
  }
}
requireFragment(salesOrderDocumentPrint, 'type === "core_return" && !order.core_return_required');

const detailSource = sourceBetween("function renderShippingDocumentDetail", "function bindShippingDocumentDetailActions");
for (const fragment of [
  "shippingDocumentDefaultStateHtml()",
  "shippingDocumentStageHtml(order)",
  "shippingDocumentOrderContentsHtml(order)",
  "shippingDocumentShipmentDocumentsHtml(order)",
  "scheduleShippingDocumentPrintStatusRefresh()",
  "B2発行履歴",
  "受注詳細"
]) requireFragment(detailSource, fragment);
for (const forbidden of ["salesOrderItemRowsHtml(order.items)", "shippingDocumentOutboundWaybillHtml(order)", "shippingDocumentReturnWaybillHtml(order)"]) {
  if (detailSource.includes(forbidden)) throw new Error(`Shipping document initial detail must not include the sales screen row renderer or inline waybill settings: ${forbidden}`);
}

const overlaySource = sourceBetween("function openShippingDocumentSettings", "function syncShippingDocumentOutboundWaybillFields");
for (const fragment of [
  'shippingDocumentOverlayMode = mode',
  'mode === "outbound"',
  'mode === "return"',
  "shippingDocumentLocalOutputType(mode)",
  "shippingDocumentTemporaryOutputHtml(order, mode)",
  "applyShippingDocumentTemporaryOutput",
  "resetShippingDocumentTemporaryOutput",
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
  "手書き運用",
  "ドットプリンタ",
  "商品発送用伝票番号",
  "shipping-document-outbound-carrier-brand",
  "shippingCarrierBrandHtml(carrier, false)"
]) requireFragment(outboundWaybill, fragment);

const returnWaybill = sourceBetween("function shippingDocumentReturnWaybillHtml", "function renderShippingDocumentDetail");
for (const fragment of [
  "var dispatchReady = !!dispatch",
  "出荷指示書を発行してから印刷できます。",
  "3-4-4（11桁）または4-4-4（12桁）",
  "shippingDocumentWaybillNumberFormat(waybill.tracking_number"
]) requireFragment(returnWaybill, fragment);
for (const forbidden of [
  'dispatch.status === "shipped"',
  "order.outbound_tracking_number",
  "B2発行済データ取込の完了後"
]) {
  if (returnWaybill.includes(forbidden)) {
    throw new Error(`Core-return multipart waybill printing must not wait for shipment completion: ${forbidden}`);
  }
}

const returnWaybillPrint = sourceBetween("async function queueShippingDocumentReturnWaybillPrint", "function renderSalesOrderList");
requireFragment(returnWaybillPrint, 'waybill.handling_method !== "dot_matrix"');
requireFragment(returnWaybillPrint, "shippingDocumentWaybillNumberIsValid(waybill.tracking_number)");
requireFragment(returnWaybillPrint, "queued.copy_count");

const returnWaybillCountSource = sourceBetween(
  "function shippingDocumentReturnWaybillCopyCount",
  "function shippingDocumentShipmentDocumentsHtml"
);
const returnWaybillCountContext = {};
vm.createContext(returnWaybillCountContext);
vm.runInContext(returnWaybillCountSource, returnWaybillCountContext);
const returnWaybillCopyCount = returnWaybillCountContext.shippingDocumentReturnWaybillCopyCount;
for (const [order, expected] of [
  [{ core_return_required: true, core_return_units: [
    { order_item: { core_return_required: true } },
    { order_item: { core_return_required: true } }
  ] }, 2],
  [{ core_return_required: true, items: [
    { core_return_required: true, quantity: 3 },
    { core_return_required: false, quantity: 5 }
  ] }, 3],
  [{ core_return_required: false, items: [{ core_return_required: true, quantity: 2 }] }, 0]
]) {
  const actual = returnWaybillCopyCount(order);
  if (actual !== expected) throw new Error(`Return-waybill copy count expected ${expected}, got ${actual}`);
}

const outboundSave = sourceBetween("async function saveShippingDocumentOutboundWaybill", "async function queueShippingDocumentOutboundWaybillPrint");
for (const fragment of [
  "shippingDocumentWaybillDigits",
  "shippingDocumentWaybillNumberIsValid(tracking)",
  "3-4-4（11桁）または4-4-4（12桁）",
  'sb.rpc("save_sales_order_outbound_waybill"',
  "target_expected_version"
]) requireFragment(outboundSave, fragment);

const batchQueue = sourceBetween("async function queueSelectedShippingDocuments", "async function loadShippingDocumentOrders");
for (const fragment of [
  "shippingDocumentCheckedIdsState",
  "shippingDocumentSelectedTypes",
  'sb.rpc("queue_sales_order_fulfillment_documents"',
  "shippingDocumentHandwrittenTasks",
  "shippingDocumentDotMatrixOrderIds",
  "shippingDocumentSkippedSummary(skipped)",
  "shippingDocumentPrintStationWarning(queuedCount)",
  "await loadSalesOrderPrintSettings()",
  't("shipping_document_batch_skipped")',
  "openShippingHandwrittenWaybillFlow"
]) requireFragment(batchQueue, fragment);

const batchMessageHelpers = sourceBetween("function shippingDocumentSkippedSummary", "function updateShippingDocumentBatchControls");
for (const fragment of [
  "salesOrderDocumentTypeLabel(row.document_type)",
  'row.reason || t("shipping_document_batch_not_eligible")',
  'config.station_state === "ready"',
  'tf("shipping_document_batch_station_warning"'
]) requireFragment(batchMessageHelpers, fragment);

const waybillNumberHelpers = sourceBetween(
  "function shippingDocumentWaybillDigits",
  "function shippingDocumentDotMatrixOrderIds"
);
const waybillNumberContext = {};
vm.createContext(waybillNumberContext);
vm.runInContext(waybillNumberHelpers, waybillNumberContext);
for (const [value, valid, formatted] of [
  ["123-4567-8901", true, "123-4567-8901"],
  ["1234-5678-9012", true, "1234-5678-9012"],
  ["1234567890", false, "1234567890"],
  ["12345-6789-0123", false, "1234567890123"]
]) {
  const actualValid = waybillNumberContext.shippingDocumentWaybillNumberIsValid(value);
  const actualFormatted = waybillNumberContext.shippingDocumentWaybillNumberFormat(value);
  if (actualValid !== valid || actualFormatted !== formatted) {
    throw new Error(`Waybill helper mismatch for ${value}: ${actualValid} / ${actualFormatted}`);
  }
}

const handwrittenReadiness = sourceBetween("function shippingDocumentHandwrittenTaskReady", "function shippingDocumentHandwrittenTasks");
for (const fragment of [
  "!order.dispatch_id",
  'documentType === "outbound_waybill"',
  "return !!order.core_return_required"
]) requireFragment(handwrittenReadiness, fragment);
for (const forbidden of ["dispatch_status", "outbound_registered"]) {
  if (handwrittenReadiness.includes(forbidden)) {
    throw new Error(`Handwritten content preview must not wait for shipment completion: ${forbidden}`);
  }
}

const handwrittenFlow = sourceBetween("function shippingHandwrittenWaybillTask", "function shippingDocumentStatusValue");
for (const fragment of [
  "shippingWaybillPreviewData(layout, order, task.unit)",
  "shippingHandwrittenWaybillOrder.core_return_units",
  "returnUnits.map",
  "copyNumber: index + 1",
  'task.documentType === "return_waybill" && nextTask',
  "shipping-handwritten-waybill-canvas",
  "黄色の欄を複写伝票へ手書きしてください",
  "手書き完了・次へ",
  'sb.rpc("complete_sales_order_handwritten_waybill"',
  "shippingHandwrittenWaybillIndex += 1",
  "await prepareShippingHandwrittenWaybill()",
  "shipping-handwritten-waybill-brand",
  "shippingCarrierBrandHtml(layout.carrier_code || layout.layout_code, false)"
]) requireFragment(handwrittenFlow, fragment);

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
  "shipment-document-table-",
  "buildSalesOrderWarrantyDocumentHtml",
  "hydrateSalesOrderWarrantyPrintData",
  'sb.rpc("get_product_warranty_policies")',
  "gltek_part_number",
  "salesOrderWarrantyUnits",
  "製 品 保 証 書",
  "保証期間",
  "製造シリアル",
  "販売店・取付店",
  "印鑑欄（任意）"
]) requireFragment(printSource, fragment);
const warrantyPageSource = sourceBetween("function buildSalesOrderWarrantyCertificatePage", "function buildSalesOrderWarrantyDocumentHtml");
for (const fragment of ["unit.manufacturingSerial", "識別情報", "購入者／会社名", "車両型式", "販売店印", "取付店印"]) {
  requireFragment(warrantyPageSource, fragment, `Final warranty certificate field is missing: ${fragment}`);
}
const warrantyUnitsSource = sourceBetween("function salesOrderWarrantyUnits", "function salesOrderCoreReturnUnits");
for (const fragment of ["item.serials", "serials[index]", "manufacturingSerial"]) {
  requireFragment(warrantyUnitsSource, fragment, `Warranty serial mapping is missing: ${fragment}`);
}
for (const fragment of ["gltek-logo-print-transparent.png", "order.vehicle_information", "vehicle.vehicle_name", "vehicle.vehicle_model_code", "vehicle.engine_model"]) requireFragment(warrantyPageSource, fragment);
for (const forbidden of ["D-CATS", "STARTER / ALTERNATOR", "保証発行者", "order.customer_name", "order.shipping_address"] ) {
  if (warrantyPageSource.includes(forbidden)) throw new Error(`Warranty certificate must not print: ${forbidden}`);
}

for (const fragment of [
  ".shipping-document-workspace",
  ".shipping-document-stages",
  ".shipping-document-waybill-form",
  ".shipping-document-waybill-print-row",
  ".shipping-document-batch-panel",
  ".shipping-document-batch-default-note",
  ".shipping-document-row-check",
  ".shipping-document-order-id-label",
  ".shipping-document-detail-target",
  ".shipping-document-order-contents",
  ".shipping-document-order-item",
  ".shipping-document-order-core.required",
  ".shipping-document-print-actions",
  ".shipping-document-required-list",
  ".shipping-document-required-head",
  ".shipping-document-required-row",
  ".shipping-document-temporary-setting",
  ".shipping-document-temporary-setting-actions",
  ".shipping-document-defaults",
  ".shipping-document-default-row",
  ".shipping-document-name-cell",
  ".shipping-carrier-brand",
  ".shipping-carrier-logo",
  ".shipping-document-carrier-context",
  ".shipping-document-settings-card",
  ".shipping-document-settings-heading",
  ".shipping-document-lookup-message",
  ".shipping-handwritten-waybill-card",
  ".shipping-handwritten-waybill-content",
  ".shipping-handwritten-waybill-brand",
  ".shipping-handwritten-waybill-canvas-wrap",
  ".shipping-handwritten-waybill-values"
]) requireFragment(css, fragment);
for (const fragment of [
  "@media (min-width: 1081px)",
  "#screen-shipping-document-mgmt.active {",
  "height: 100dvh;",
  "overflow: hidden;",
  ".shipping-document-toolbar {",
  "min-height: 86px;",
  "grid-template-areas:",
  '"kicker actions"',
  "#screen-shipping-document-mgmt .shipping-document-title-actions {",
  ".shipping-document-list { flex: 1; min-height: 120px; overflow-y: auto; }",
  ".shipping-document-batch-panel { flex: 0 0 auto;",
  ".shipping-document-detail-pane { overflow-y: auto; padding: 11px 18px 14px; }",
  ".shipping-document-required-row { min-height: 52px; padding: 4px 8px; }",
  ".shipping-document-required-documents .shipping-document-section-head p { display: none; }"
]) requireFragment(css, fragment, `Desktop shipping-document workspace contract is missing: ${fragment}`);
for (const fragment of [
  '@media screen {',
  '#screen-shipping-document-mgmt { font-size: 14px; line-height: 1.5; }',
  '#screen-shipping-document-mgmt .shipping-document-filter-row :is(input, select, button) { height: 40px; font-size: 14px; }',
  '#screen-shipping-document-mgmt .shipping-document-date-filter > span { font-size: 12px; }',
  '#screen-shipping-document-mgmt .shipping-document-name-cell > strong { font-size: 15px; word-break: keep-all; overflow-wrap: anywhere; }',
  '#screen-shipping-document-mgmt .shipping-document-standard { font-size: 14px; line-height: 1.6; word-break: keep-all; overflow-wrap: anywhere; }',
  '#screen-shipping-document-mgmt .shipping-document-row-actions { flex-wrap: wrap; gap: 8px; }',
  '@media screen and (max-width: 1120px)',
  '@media screen and (max-width: 820px)',
  'grid-template-areas: "name state" "standard standard" "actions actions";'
]) requireFragment(css, fragment, `Shipping-document readability contract is missing: ${fragment}`);
for (const fragment of [
  '@media screen and (min-width: 1121px)',
  'grid-template-areas: "label number customer" "target target target";',
  '#screen-shipping-document-mgmt #shipping-document-message:empty { display: none; }',
  '#screen-shipping-document-mgmt .shipping-document-order-items { max-height: 100px; overflow-y: auto; }',
  '#screen-shipping-document-mgmt .shipping-document-required-row { min-height: 56px; padding: 6px 8px; }',
  'minmax(248px, 1.4fr);'
]) requireFragment(css, fragment, `Shipping-document compact desktop contract is missing: ${fragment}`);
for (const fragment of [
  ".shipping-document-name-cell { display: grid;",
  "flex: 0 0 132px;",
  "width: 132px;",
  "height: 42px;",
  ".shipping-carrier-brand.compact { flex: 0 0 104px; width: 104px; height: 30px;",
  ".shipping-carrier-brand.yamato .shipping-carrier-logo img { top: -36%; left: -24%; width: 147%; }",
  ".shipping-carrier-brand.sagawa .shipping-carrier-logo img { top: -50%; left: -30%; width: 160%; }",
  "place-items: center; min-width: 0;",
  "text-align: center; white-space: nowrap;"
]) requireFragment(css, fragment, `Carrier label size contract is missing: ${fragment}`);
if (css.includes(".shipping-carrier-brand-copy small")) {
  throw new Error("Carrier label purpose styling must be removed");
}
for (const fragment of [
  "@page dcats-warranty-a4 { size: A4 landscape; margin: 0; }",
  ".warranty-print-sheet",
  "width: 297mm; height: 210mm;",
  ".warranty-certificate",
  "width: 210mm; height: 148mm;",
  ".warranty-header h1",
  ".warranty-identification",
  ".warranty-stamp-box",
  ".warranty-dealer",
  ".document-warranty { background: transparent; }",
  ".warranty-print-sheet { margin: 0; background: transparent; }"
]) requireFragment(printCss, fragment);

for (const fragment of [
  "API直接連携は、有料・大口契約向けのため導入を見送る",
  "ヤマト宅急便　着払い",
  "佐川急便着払い",
  "発行済み注文の重複出力は防止",
  "同一データを再ダウンロード"
]) requireFragment(contract, fragment);

for (const fragment of [
  'content="v1.1.900"',
  'styles.css?v=1.1.900',
  'app.js?v=1.1.900'
]) requireFragment(html, fragment);
requireFragment(source, 'var APP_VERSION       = "v1.1.900"');

if (/service[_-]?role|postgres(?:ql)?:\/\//i.test(source)) {
  throw new Error("Browser fulfillment document code must not contain server credentials");
}

console.log("Order fulfillment document UI verification passed.");
