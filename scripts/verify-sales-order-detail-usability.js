const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8").replace(/\r\n/g, "\n");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8").replace(/\r\n/g, "\n");

function requireFragment(target, fragment, message) {
  if (!target.includes(fragment)) throw new Error(message || `Missing sales-order usability contract: ${fragment}`);
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

const clearSelection = functionSource("clearSalesOrderDetailSelection");
for (const fragment of [
  "salesOrderSelectedId = null",
  "salesOrderDetail = null",
  'salesOrderDetailView = "overview"',
  "salesOrderDetailSeq += 1",
  "renderSalesOrderDetail()"
]) requireFragment(clearSelection, fragment, "Clearing a filtered-out order must reset its stale detail state");

let clearRenderCount = 0;
const clearContext = {
  salesOrderSelectedId: 427285820,
  salesOrderDetail: { id: 427285820 },
  salesOrderDetailView: "fulfillment",
  salesOrderDetailSeq: 4,
  renderSalesOrderDetail() { clearRenderCount += 1; }
};
vm.createContext(clearContext);
vm.runInContext(clearSelection, clearContext);
clearContext.clearSalesOrderDetailSelection();
if (clearContext.salesOrderSelectedId !== null || clearContext.salesOrderDetail !== null || clearContext.salesOrderDetailView !== "overview" || clearContext.salesOrderDetailSeq !== 5 || clearRenderCount !== 1) {
  throw new Error("Filtered-out order selection did not clear the detail state and pending detail request");
}

const listLoader = functionSource("loadSalesOrders");
for (const fragment of [
  "salesOrderRows.some(function(order)",
  "String(order.id) === String(salesOrderSelectedId)",
  "(salesOrderSelectedId != null || salesOrderDetail) && !selectedOrderVisible",
  "clearSalesOrderDetailSelection()"
]) requireFragment(listLoader, fragment, "Search results must clear details that are no longer in the list");

const list = functionSource("renderSalesOrderList");
for (const fragment of [
  "sales-order-list-identity",
  "sales-order-list-customer",
  "sales-order-list-meta",
  "sales-order-list-metrics"
]) requireFragment(list, fragment);

const detail = functionSource("renderSalesOrderDetail");
for (const fragment of [
  "sales-order-detail-next-actions",
  "次の操作",
  "sales-order-detail-nav",
  "role='tablist'",
  "data-sales-order-detail-view='",
  "sales-order-detail-panels",
  "sales-order-detail-overview-grid",
  "data-sales-order-detail-panel='overview'",
  "請求・配送",
  "出荷・帳票",
  "sales-order-detail-products",
  "sales-order-detail-delivery",
  "salesOrderWaybillCarrierLabel(order, \"outbound\")",
  "salesOrderWaybillDetailLabel(order, \"outbound\")",
  "salesOrderCoreReturnSummary(order)",
  "salesOrderDeliveryPreferenceLabel(order)",
  "salesOrderDestinationHtml(address)",
  "salesOrderWaybillSummaryHtml(\"商品発送便\"",
  "customerNote ?",
  "salesOrderBillingDetailsHtml(order, orderAdjustments, orderDiscount)",
  "sales-order-detail-total",
  "請求明細",
  "sales-order-detail-history",
  "処理履歴"
]) requireFragment(detail, fragment);
if (detail.includes("sales-order-detail-summary")) {
  throw new Error("Order-level charges must be attached to the billing detail instead of a detached header strip");
}
requireFragment(functionSource("salesOrderWaybillSummaryHtml"), "sales-order-waybill-detail");
if (detail.includes('order.customer_note || "-"')) {
  throw new Error("An empty order note must not occupy a delivery-summary row");
}
const itemRows = functionSource("salesOrderItemRowsHtml");
for (const fragment of [
  "sales-order-product-row",
  "sales-order-core-charge-row",
  "customer_order_core_not_returned_short",
  "customer_order_core_charge_billed_short",
  "customer_order_core_charge_kind",
  "customer_order_part_charge_reference",
  "coreChargeTotal <= 0",
  "sales-order-core-charge-row"
]) requireFragment(itemRows, fragment);
if (itemRows.includes('<span>" + esc(t("customer_order_core_charge_total")) + "</span>')) {
  throw new Error("Core charge must be rendered as its own detail row, not as a product-row column");
}
const itemRowsContext = {
  t: (key) => ({
    customer_order_core_not_returned_short: "返却なし",
    customer_order_core_charge_total: "コア代金",
    customer_order_core_charge_no_return_status: "コア代金請求済み",
    customer_order_core_charge_billed_short: "請求済み",
    customer_order_core_charge_kind: "コア代"
  })[key] || key,
  tf: (key, values) => key === "customer_order_part_charge_reference" ? `${values.part} 分` : key,
  esc: (value) => String(value),
  customerOrderCoreHandlingValue: (item) => item.core_return_handling,
  customerOrderBilledCoreChargePerUnit: (item) => item.core_return_handling === "charge_no_return" ? (Number(item.core_charge_jpy) || 0) : 0,
  customerOrderCoreHandlingLabel: (item) => item.core_return_handling === "charge_no_return" ? "コア代金 ¥2,000 計上" : "返却必要",
  customerProductKindLabel: () => "リビルト品",
  customerOrderCurrency: (value) => `¥${Number(value).toLocaleString("ja-JP")}`,
  customerOrderProductUnitPrice: (item) => Number(item.product_unit_price_jpy) || 0,
  customerOrderProductLineTotal: (item) => Number(item.product_line_total_jpy) || 0
};
vm.createContext(itemRowsContext);
vm.runInContext(itemRows, itemRowsContext);
const separatedRows = itemRowsContext.salesOrderItemRowsHtml([{
  genuine_part_number: "27060-B2021",
  manufacturer: "DENSO",
  manufacturer_part_number: "102211-7140",
  product_kind: "rebuilt",
  quantity: 1,
  product_unit_price_jpy: 7500,
  product_line_total_jpy: 7500,
  core_return_handling: "charge_no_return",
  core_charge_jpy: 0,
  core_charge_line_total_jpy: 2000
}]);
if ((separatedRows.match(/sales-order-item-row/g) || []).length !== 2) {
  throw new Error("A billed core charge must add exactly one detail row below the product row");
}
for (const fragment of ["27060-B2021", "¥7,500", "コア代金", "コア代", "¥2,000", "請求済み"]) {
  requireFragment(separatedRows, fragment, `Separated core-charge row is missing: ${fragment}`);
}
if ((separatedRows.match(/>請求済み<\/span>/g) || []).length !== 2 || separatedRows.includes("返却なし")) {
  throw new Error("A billed core charge must mark both the rebuilt product and its core-charge line as billed");
}
if (separatedRows.includes("別明細")) {
  throw new Error("The billed core-charge line must use the concise core-charge kind label");
}
const unbilledNoReturnRows = itemRowsContext.salesOrderItemRowsHtml([{
  genuine_part_number: "27060-B2021",
  quantity: 1,
  product_unit_price_jpy: 7500,
  product_line_total_jpy: 7500,
  core_return_handling: "charge_no_return",
  core_charge_jpy: 0,
  core_charge_line_total_jpy: 0
}]);
if (!unbilledNoReturnRows.includes("返却なし") || unbilledNoReturnRows.includes("請求済み")) {
  throw new Error("A zero-value no-return selection must not be shown as billed");
}
const standardRows = itemRowsContext.salesOrderItemRowsHtml([{
  genuine_part_number: "27060-B2021",
  quantity: 1,
  product_unit_price_jpy: 7500,
  product_line_total_jpy: 7500,
  core_return_handling: "return_required",
  core_charge_jpy: 2000
}]);
if (standardRows.includes("sales-order-core-charge-row")) {
  throw new Error("A standard core-return order must not show a billed core-charge detail row");
}
const adjustmentRows = functionSource("salesOrderAdjustmentRowsHtml");
for (const fragment of [
  "sales-order-item-row sales-order-charge-row sales-order-adjustment-row",
  "値引・調整",
  "customerOrderCurrency(row.amount_jpy)"
]) requireFragment(adjustmentRows, fragment);
const billingDetailRows = functionSource("salesOrderBillingDetailRowsHtml");
for (const fragment of [
  "salesOrderWaybillCarrierLabel(order, \"outbound\")",
  "sales-order-shipping-row",
  "sales-order-tax-row",
  "sales-order-total-row",
  "送料",
  "消費税",
  "請求合計"
]) requireFragment(billingDetailRows, fragment);
const billingDetails = functionSource("salesOrderBillingDetailsHtml");
for (const fragment of [
  "sales-order-billing-detail-table",
  "salesOrderItemRowsHtml(order.items)",
  "salesOrderAdjustmentRowsHtml(adjustments, fallbackDiscount)",
  "salesOrderBillingDetailRowsHtml(order)"
]) requireFragment(billingDetails, fragment);
for (const obsolete of ["受注単位の請求内訳", "sales-order-billing-summary", "商品以外の金額も、この受注の明細としてまとめて表示しています。", "商品、コア代金、値引・調整、送料、税を明細行で確認します。", "送り状へ反映する配送情報です。", "発送と金額修正の記録を確認できます。"]){
  if (source.includes(obsolete)) throw new Error(`Obsolete detached billing summary remains: ${obsolete}`);
}
const billingContext = {
  esc: (value) => String(value),
  customerOrderCurrency: (value) => `¥${Number(value).toLocaleString("ja-JP")}`,
  salesOrderWaybillCarrierLabel: () => "ヤマト運輸 / 宅急便 元払い"
};
vm.createContext(billingContext);
vm.runInContext(billingDetailRows, billingContext);
const billingHtml = billingContext.salesOrderBillingDetailRowsHtml({
  shipping_fee_jpy: 700,
  tax_jpy: 1020,
  total_jpy: 11220
});
for (const fragment of ["sales-order-shipping-row", "送料", "ヤマト運輸 / 宅急便 元払い", "¥700", "sales-order-tax-row", "消費税", "¥1,020", "sales-order-total-row", "請求合計", "¥11,220"]) {
  requireFragment(billingHtml, fragment, `Billing detail row is missing: ${fragment}`);
}
const fulfillment = functionSource("salesOrderDispatchHtml");
requireFragment(fulfillment, "sales-order-detail-fulfillment");
requireFragment(fulfillment, "salesOrderWaybillProgressHtml(order)");
requireFragment(fulfillment, "salesOrderDispatchSerialsHtml(dispatch)", "The rebuilt picking summary must show its verified serial numbers");
const rebuiltSerials = functionSource("salesOrderDispatchRebuiltSerials");
for (const fragment of ["orderItem.product_kind", '!== "rebuilt"', "row.manufacturing_serial"]) {
  requireFragment(rebuiltSerials, fragment, `Rebuilt serial extraction is missing: ${fragment}`);
}
const rebuiltSerialContext = {
  normalizeProductKind: (value) => String(value || "").toLowerCase()
};
vm.createContext(rebuiltSerialContext);
vm.runInContext(rebuiltSerials, rebuiltSerialContext);
const verifiedSerials = rebuiltSerialContext.salesOrderDispatchRebuiltSerials({
  items: [
    { order_item: { product_kind: "rebuilt" }, serials: [{ manufacturing_serial: "M2026-0000042" }, { manufacturing_serial: "M2026-0000043" }] },
    { order_item: { product_kind: "new" }, serials: [{ manufacturing_serial: "M2026-9999999" }] }
  ]
});
if (verifiedSerials.join("|") !== "M2026-0000042|M2026-0000043") {
  throw new Error("The picking result did not preserve only the verified rebuilt-product serial numbers");
}
const dispatchSerials = functionSource("salesOrderDispatchSerialsHtml");
for (const fragment of ["sales-order-dispatch-serials", "sales-order-dispatch-serial-list", "sales_order_dispatch_serials", "sales_order_dispatch_serials_empty"]) {
  requireFragment(dispatchSerials, fragment, `Picking serial summary is missing: ${fragment}`);
}
Object.assign(rebuiltSerialContext, {
  esc: (value) => String(value),
  t: (key) => ({
    sales_order_dispatch_serials: "照合済みシリアル番号",
    sales_order_dispatch_serials_empty: "未照合"
  })[key] || key
});
vm.runInContext(dispatchSerials, rebuiltSerialContext);
const serialSummaryHtml = rebuiltSerialContext.salesOrderDispatchSerialsHtml({
  items: [{
    order_item: { product_kind: "rebuilt" },
    serials: [{ manufacturing_serial: "M2026-0000042" }, { manufacturing_serial: "M2026-0000043" }]
  }]
});
for (const fragment of ["照合済みシリアル番号", "M2026-0000042", "M2026-0000043"]) {
  requireFragment(serialSummaryHtml, fragment, `Rendered picking serial summary is missing: ${fragment}`);
}
const emptySerialSummaryHtml = rebuiltSerialContext.salesOrderDispatchSerialsHtml({
  items: [{ order_item: { product_kind: "rebuilt" }, serials: [] }]
});
requireFragment(emptySerialSummaryHtml, "未照合", "Empty picking result must be explicit");
for (const fragment of [
  ".sales-order-dispatch-serials",
  ".sales-order-dispatch-serial-list",
  ".sales-order-dispatch-serial-list code",
  ".sales-order-dispatch-serial-empty"
]) requireFragment(css, fragment, `Picking serial summary style is missing: ${fragment}`);
const printJobs = functionSource("salesOrderPrintJobsHtml");
for (const fragment of [
  "<details class='sales-order-print-jobs'>",
  "<summary><strong>印刷端末への送信</strong></summary>",
  "sales-order-print-jobs-content",
  "sales-order-print-jobs-actions"
]) requireFragment(printJobs, fragment, "Print terminal history must stay available in a compact disclosure");
if (printJobs.includes("sales-order-print-jobs-head")) {
  throw new Error("Print terminal history must not remain permanently expanded");
}
const waybillProgress = functionSource("salesOrderWaybillProgressHtml");
for (const fragment of [
  "sales-order-waybill-progress-editor",
  "id='sales-order-outbound-tracking'",
  "id='sales-order-shipped-on'",
  "id='sales-order-edit-tracking'",
  "id='sales-order-save-tracking'",
  "id='sales-order-cancel-tracking'",
  "trackingLockAttributes",
  "shippingDateLockAttributes",
  "送り状番号を登録"
]) requireFragment(waybillProgress, fragment);
const trackingEditMode = functionSource("setSalesOrderTrackingEditMode");
for (const fragment of [
  "input.readOnly = !editing",
  "shippedOn.disabled = !editing",
  "editButton.hidden = editing",
  "saveButton.hidden = !editing",
  "cancelButton.hidden = !editing",
  "input.focus()",
  "input.select()"
]) requireFragment(trackingEditMode, fragment, "Registered waybill numbers must require an explicit edit action");
if (source.includes("送り状番号の登録だけでは在庫を減らしません")) {
  throw new Error("The obsolete stock notice must not be shown beside waybill registration");
}
if (source.includes("複写送り状に記載された番号を確認・登録できます。")) {
  throw new Error("The redundant manual-waybill description must not be shown");
}
requireFragment(waybillProgress, '(description ? "<p>" + esc(description) + "</p>" : "")');
const carrierLabel = functionSource("salesOrderWaybillCarrierLabel");
for (const fragment of [
  "yamato_prepaid",
  "sagawa_prepaid",
  "yamato_collect",
  "sagawa_collect",
  "ヤマト運輸 / 宅急便 元払い",
  "佐川急便 / 飛脚宅配便 元払い",
  "ヤマト運輸 / 宅急便 着払い",
  "佐川急便 / 飛脚宅配便 着払い",
  "customerOrderSavedShippingMethod"
]) requireFragment(carrierLabel, fragment);
const waybillDetail = functionSource("salesOrderWaybillDetailLabel");
for (const fragment of [
  "B2クラウド",
  "ドットプリンタ",
  "手書き運用",
  "B2 CSV発行済み",
  "shippingDocumentReturnWaybillCopyCount(order)",
  "伝票番号未登録"
]) requireFragment(waybillDetail, fragment);
const waybillContext = {
  customerOrderSavedShippingMethod: (order, purpose) => purpose === "core_return" ? order.core_return_shipping_method : order.outbound_shipping_method,
  customerOrderShippingMethodLabel: (method, fallback) => method ? [method.carrier_name, method.service_name].filter(Boolean).join(" / ") : fallback,
  shippingDocumentReturnWaybillCopyCount: (order) => order.copy_count || 0
};
vm.createContext(waybillContext);
vm.runInContext([
  functionSource("salesOrderWaybillRecord"),
  carrierLabel,
  waybillDetail
].join("\n"), waybillContext);
if (waybillContext.salesOrderWaybillCarrierLabel({ outbound_waybill: { carrier_code: "sagawa_prepaid" } }, "outbound") !== "佐川急便 / 飛脚宅配便 元払い") {
  throw new Error("The accepted-order view must prefer the finalized Sagawa outbound waybill");
}
const returnOrder = {
  core_return_required: true,
  copy_count: 2,
  return_waybill: { carrier_code: "yamato_collect", handling_method: "dot_matrix", tracking_number: "123456789012" }
};
if (waybillContext.salesOrderWaybillCarrierLabel(returnOrder, "core_return") !== "ヤマト運輸 / 宅急便 着払い") {
  throw new Error("The accepted-order view must prefer the finalized Yamato return waybill");
}
if (waybillContext.salesOrderWaybillDetailLabel(returnOrder, "core_return") !== "ドットプリンタ / 2枚 / 伝票番号 123456789012") {
  throw new Error("The accepted-order view must show return-waybill output method, copy count, and tracking number together");
}

const compactContext = {
  esc: (value) => String(value),
  t: (key) => ({
    customer_order_core_charge_no_return_status: "コア代金請求済み",
    customer_order_yamato_office_pickup_short: "ヤマト営業所受取"
  })[key] || key,
  customerOrderHasBilledCoreCharge: (order) => !!order.billed,
  salesOrderWaybillCarrierLabel: waybillContext.salesOrderWaybillCarrierLabel,
  salesOrderWaybillDetailLabel: waybillContext.salesOrderWaybillDetailLabel
};
vm.createContext(compactContext);
vm.runInContext([
  functionSource("salesOrderWaybillSummaryHtml"),
  functionSource("salesOrderCoreReturnSummary"),
  functionSource("salesOrderDeliveryPreferenceLabel"),
  functionSource("salesOrderDestinationHtml")
].join("\n"), compactContext);
const billedSummary = compactContext.salesOrderCoreReturnSummary({ billed: true, core_return_required: false });
const billedHtml = compactContext.salesOrderWaybillSummaryHtml(billedSummary.label, billedSummary.primary, billedSummary.secondary);
if (billedSummary.primary !== "返却不要" || (billedHtml.match(/コア代金請求済み/g) || []).length !== 1) {
  throw new Error("A billed core charge must be explained once as a no-return condition");
}
if (compactContext.salesOrderDeliveryPreferenceLabel({ requested_delivery_date: "2026-09-10" }) !== "2026-09-10") {
  throw new Error("A missing delivery time must not add a redundant unspecified value");
}
if (compactContext.salesOrderDeliveryPreferenceLabel({}) !== "指定なし") {
  throw new Error("An entirely unspecified delivery preference must remain understandable");
}
const officeHtml = compactContext.salesOrderDestinationHtml({
  destination_type: "yamato_office",
  yamato_office_name: "箕面船場（箕面船場西）営業所",
  yamato_office_code: "068721",
  company_name: "有限会社ストレイン",
  recipient_name: "坂口",
  postal_code: "562-0035",
  prefecture_name: "大阪府",
  address_line_1: "箕面市船場東",
  phone_number: "072-734-8077"
});
for (const fragment of ["ヤマト営業所受取　068721", "箕面船場（箕面船場西）営業所", "受取人　有限会社ストレイン 坂口"]) {
  requireFragment(officeHtml, fragment, `Compact office-pickup summary is missing: ${fragment}`);
}
if ((officeHtml.match(/068721/g) || []).length !== 1 || officeHtml.includes("営業所止め / コード")) {
  throw new Error("Office-pickup name and code must not be repeated");
}
if (detail.includes("href='#sales-order-detail-")) {
  throw new Error("Order detail navigation must switch work panels instead of jumping down a long page");
}
if (detail.includes("sales-order-detail-actions")) {
  throw new Error("Order actions must be shown once in the decision header, not repeated at the bottom");
}

const pricing = functionSource("salesOrderPricingEditorHtml");
for (const fragment of [
  "商品別の金額",
  "値引・調整と送料",
  "値引・調整行を追加",
  "変更後の請求額",
  "sales-order-pricing-lower-grid",
  "sales-order-pricing-mobile-label"
]) requireFragment(pricing, fragment);

for (const fragment of [
  ".sales-order-list-identity",
  ".sales-order-list-metrics",
  ".sales-order-detail-next-actions",
  ".sales-order-detail-navigation",
  ".sales-order-detail-nav",
  ".sales-order-detail-nav button[aria-selected=\"true\"]",
  ".sales-order-detail-panel[hidden]",
  ".sales-order-detail-overview-grid",
  ".sales-order-core-charge-row",
  ".sales-order-charge-row",
  ".sales-order-adjustment-row",
  ".sales-order-shipping-row",
  ".sales-order-tax-row",
  ".sales-order-total-row",
  ".sales-order-detail-total",
  ".sales-order-waybill-detail",
  ".sales-order-waybill-progress-editor .sales-order-tracking-grid { grid-template-columns: minmax(0, 1fr) minmax(125px, 145px) minmax(136px, max-content); gap: 7px; margin-top: 0;",
  ".sales-order-waybill-progress-editor > p + .sales-order-tracking-grid { margin-top: 7px; }",
  ".sales-order-waybill-progress-editor .sales-order-tracking-grid > * { min-width: 0; }",
  ".sales-order-waybill-progress-editor .sales-order-tracking-grid button { width: 100%;",
  ".sales-order-tracking-actions { display: flex;",
  ".sales-order-tracking-grid input[readonly]",
  ".sales-order-detail-overview { overflow: hidden; }",
  ".sales-order-history-groups",
  ".sales-order-pricing-lower-grid",
  ".sales-order-pricing-item .sales-order-pricing-mobile-label { display: none; }",
  ".sales-order-pricing-item .sales-order-pricing-mobile-label { display: block; }"
]) requireFragment(css, fragment);

console.log("Sales order list, detail, and price-editor usability verification passed.");
