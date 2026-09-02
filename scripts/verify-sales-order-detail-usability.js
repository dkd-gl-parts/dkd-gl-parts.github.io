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
  "注文・配送",
  "出荷・帳票",
  "sales-order-detail-products",
  "sales-order-detail-delivery",
  "salesOrderWaybillCarrierLabel(order, \"outbound\")",
  "salesOrderWaybillDetailLabel(order, \"outbound\")",
  "salesOrderWaybillCarrierLabel(order, \"core_return\")",
  "salesOrderWaybillDetailLabel(order, \"core_return\")",
  "sales-order-waybill-detail",
  "sales-order-detail-tracking",
  "sales-order-detail-history",
  "処理履歴"
]) requireFragment(detail, fragment);
requireFragment(functionSource("salesOrderDispatchHtml"), "sales-order-detail-fulfillment");
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
  ".sales-order-detail-nav",
  ".sales-order-detail-nav button[aria-selected=\"true\"]",
  ".sales-order-detail-panel[hidden]",
  ".sales-order-detail-overview-grid",
  ".sales-order-waybill-detail",
  ".sales-order-detail-overview { overflow: hidden; }",
  ".sales-order-history-groups",
  ".sales-order-pricing-lower-grid",
  ".sales-order-pricing-item .sales-order-pricing-mobile-label { display: none; }",
  ".sales-order-pricing-item .sales-order-pricing-mobile-label { display: block; }"
]) requireFragment(css, fragment);

console.log("Sales order list, detail, and price-editor usability verification passed.");
