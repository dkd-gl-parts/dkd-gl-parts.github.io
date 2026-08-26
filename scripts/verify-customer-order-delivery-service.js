const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const contract = fs.readFileSync(path.join(root, "docs", "customer-order-b2-manual-contract.md"), "utf8");

function sourceBetween(startText, endText) {
  const start = source.indexOf(startText);
  const end = source.indexOf(endText, start + startText.length);
  if (start < 0 || end < start) throw new Error(`${startText} could not be isolated`);
  return source.slice(start, end);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const constants = sourceBetween("var CUSTOMER_ORDER_DISPATCH_CUTOFF_HOUR", "var salesOrderRows");
const dateLogic = sourceBetween("function customerOrderDeliveryServiceKey", "function customerOrderDeliverySetMessage");
const context = {};
vm.runInNewContext(`${constants}\n${dateLogic}`, context);

const coreReturnServiceLogic = sourceBetween("function customerOrderDeliveryServiceSortValue", "async function loadCustomerOrderDeliveryServices");
vm.runInNewContext(coreReturnServiceLogic, context);
const outboundServices = [{ carrier_name: "ヤマト運輸", service_name: "宅急便", display_order: 0 }];
const coreReturnServices = context.customerOrderCoreReturnDeliveryServices(outboundServices);
assert(outboundServices.length === 1, "core-return additions must not mutate outbound shipping services");
assert(coreReturnServices.some((row) => row.carrier_name === "佐川急便" && row.service_name === "飛脚宅配便"), "Sagawa Hikyaku delivery must be available for core returns");
assert(!outboundServices.some((row) => row.carrier_name === "佐川急便"), "Sagawa core-return service must not appear in outbound shipping");

const mondayMorning = new Date(2026, 7, 3, 10, 0, 0);
const kansai = context.customerOrderDeliveryEstimate("宅急便", 27, mondayMorning);
assert(kansai.earliest_date === "2026-08-04", "Kansai takkyubin must default to next-day delivery");
assert(kansai.max_requested_date === "2026-08-10", "requested delivery date must stay within the B2 six-day window");
assert(kansai.requested_date && kansai.requested_time, "takkyubin must allow requested date and time");

const hokkaido = context.customerOrderDeliveryEstimate("宅急便", 1, mondayMorning);
assert(hokkaido.earliest_date === "2026-08-05", "far prefectures must add a transit day for takkyubin");

const timeService = context.customerOrderDeliveryEstimate("宅急便タイムサービス", 1, mondayMorning);
assert(timeService.earliest_date === "2026-08-04", "time service must keep next-day delivery for far prefectures");

const fridayAfterCutoff = context.customerOrderDeliveryEstimate("宅急便", 27, new Date(2026, 7, 7, 16, 0, 0));
assert(fridayAfterCutoff.dispatch_date === "2026-08-10" && fridayAfterCutoff.earliest_date === "2026-08-11", "orders after cutoff must move dispatch to the next weekday");

const yuPacket = context.customerOrderDeliveryEstimate("クロネコゆうパケット", 27, mondayMorning);
assert(yuPacket.earliest_date === "2026-08-06" && yuPacket.latest_date === "2026-08-10", "yu-packet must show a three-to-seven-day estimate");
assert(!yuPacket.requested_date && !yuPacket.requested_time, "yu-packet must not accept requested date or time");

const nekopos = context.customerOrderDeliveryEstimate("ネコポス", 27, mondayMorning);
assert(!nekopos.requested_date && !nekopos.requested_time, "Nekopos must be treated as date/time unavailable");

const serviceKey = context.customerOrderDeliveryServiceKey("ヤマト運輸", "宅急便");
const decodedService = context.customerOrderDeliveryServiceFromKey(serviceKey);
assert(decodedService.carrier_name === "ヤマト運輸" && decodedService.service_name === "宅急便", "delivery service keys must round-trip safely");

[
  'id="customer-order-delivery-service"',
  'id="customer-order-core-return-service-field"',
  'id="customer-order-core-return-service"',
  'id="customer-order-delivery-date"',
  'id="customer-order-delivery-time"',
  'id="customer-order-delivery-estimate"'
].forEach((fragment) => assert(html.includes(fragment), `order delivery UI is missing: ${fragment}`));

const previewRequest = sourceBetween("async function previewCustomerOrder", "function customerOrderIdempotencyKey");
const submitRequest = sourceBetween("async function submitCustomerOrder", "function renderCustomerOrderHistory");
assert(previewRequest.includes("target_shipping_method: customerOrderShippingMethodPayload()"), "order preview must send the selected shipping method");
assert(submitRequest.includes("target_shipping_method: customerOrderShippingMethodPayload()"), "order submission must send the selected shipping method");
assert(previewRequest.includes("target_core_return_shipping_method: customerOrderCoreReturnShippingMethodPayload()"), "order preview must send the core-return shipping method separately");
assert(submitRequest.includes("target_core_return_shipping_method: customerOrderCoreReturnShippingMethodPayload()"), "order submission must send the core-return shipping method separately");

const returnMethod = sourceBetween("function customerOrderCoreReturnShippingMethodPayload", "function customerOrderSavedShippingMethod");
assert(returnMethod.includes("customerOrderCartRequiresCoreReturn()") && returnMethod.includes("customer-order-core-return-service"), "core-return shipping must only be sent for orders that require core return");

const customerAccessServices = sourceBetween("function customerAccessShippingServiceOptionsHtml", "function renderCustomerAccessDetail");
assert(customerAccessServices.includes('purpose === "core_return"') && customerAccessServices.includes("customerOrderCoreReturnDeliveryServices(rows)"), "customer defaults must add Sagawa to core-return services only");
const customerAccessDetail = sourceBetween("function renderCustomerAccessDetail", "function renderCustomerAccessRuleForm");
assert(customerAccessDetail.includes('customerAccessShippingServiceOptionsHtml(customerAccessShippingServiceKey(s, "outbound"), "outbound")'), "outbound defaults must keep the rate-master service list");
assert(customerAccessDetail.includes('customerAccessShippingServiceOptionsHtml(customerAccessShippingServiceKey(s, "core_return"), "core_return")'), "core-return defaults must use the dedicated service list");

const returnLogic = sourceBetween("function customerOrderCartRequiresCoreReturn", "function updateCustomerOrderDeliveryEstimate");
const returnContext = {
  customerOrderCart: [{ key: "12011:rebuilt", core_return_required: true }],
  customerOrderPreviewItemMap: () => ({}),
  customerOrderDeliveryServiceFromKey: context.customerOrderDeliveryServiceFromKey,
  customerOrderCoreReturnServiceKeyValue: serviceKey,
  document: { getElementById: (id) => id === "customer-order-core-return-service" ? { value: serviceKey } : null }
};
vm.runInNewContext(returnLogic, returnContext);
assert(returnContext.customerOrderCoreReturnShippingMethodPayload().service_name === "宅急便", "core-return orders must keep their selected return service");
returnContext.customerOrderCart = [{ key: "12011:aftermarket_new", core_return_required: false }];
assert(returnContext.customerOrderCoreReturnShippingMethodPayload() === null, "orders without core return must not send a return service");

const returnServiceEvent = sourceBetween('document.getElementById("customer-order-core-return-service").addEventListener', 'document.getElementById("customer-order-delivery-date").addEventListener');
assert(returnServiceEvent.includes("customerOrderPreview = null") && !returnServiceEvent.includes("updateCustomerOrderDeliveryEstimate"), "changing the return service must invalidate preview without changing the outbound delivery date");

const estimateUi = sourceBetween("function updateCustomerOrderDeliveryEstimate", "function customerOrderDeliveryServiceSortValue");
assert(estimateUi.includes('dateInput.min = estimate.earliest_date') && estimateUi.includes('dateInput.max = estimate.max_requested_date'), "requested dates must be bounded by the service level");
assert(estimateUi.includes('dateInput.disabled = true') && estimateUi.includes('timeInput.disabled = true'), "services without date/time requests must disable both controls");

[
  ".customer-order-shipping-methods",
  ".customer-order-shipping-method.core-return",
  ".customer-order-delivery-estimate.ready",
  ".customer-order-delivery-estimate.restricted"
].forEach((fragment) => assert(css.includes(fragment), `order delivery style is missing: ${fragment}`));

[
  "target_shipping_method jsonb",
  "target_core_return_shipping_method jsonb",
  "outbound_shipping_method",
  "core_return_shipping_method",
  "ブラウザ計算を信用しない",
  "日時指定不可サービス",
  "最短日より前を指定できず"
].forEach((fragment) => assert(contract.includes(fragment), `server handoff contract is missing: ${fragment}`));

if ((source.match(/customer_order_delivery_service:/g) || []).length !== 3 ||
    (source.match(/customer_order_outbound_service:/g) || []).length !== 3 ||
    (source.match(/customer_order_core_return_service:/g) || []).length !== 3 ||
    (source.match(/customer_order_delivery_not_specifiable:/g) || []).length !== 3) {
  throw new Error("delivery service guidance must be translated for all supported languages");
}

console.log("customer order delivery service guard passed");
