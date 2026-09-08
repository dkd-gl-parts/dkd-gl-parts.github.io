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

const dateLogic = sourceBetween("function customerOrderDeliveryServiceKey", "function customerOrderDeliverySetMessage");
const context = {};
const coreReturnConstant = sourceBetween("var CUSTOMER_ORDER_CORE_RETURN_ADDITIONAL_SERVICES", "var SHIPPING_CARRIER_BRANDS");
vm.runInNewContext(`${coreReturnConstant}\n${dateLogic}`, context);

const coreReturnServiceLogic = sourceBetween("function customerOrderDeliveryServiceSortValue", "async function loadCustomerOrderDeliveryServices");
vm.runInNewContext(coreReturnServiceLogic, context);
const outboundServices = [{ carrier_name: "ヤマト運輸", service_name: "宅急便", display_order: 0 }];
const coreReturnServices = context.customerOrderCoreReturnDeliveryServices(outboundServices);
assert(outboundServices.length === 1, "core-return additions must not mutate outbound shipping services");
assert(coreReturnServices.some((row) => row.carrier_name === "佐川急便" && row.service_name === "飛脚宅配便"), "Sagawa Hikyaku delivery must be available for core returns");
assert(!outboundServices.some((row) => row.carrier_name === "佐川急便"), "Sagawa core-return service must not appear in outbound shipping");

const displayDefaultsLogic = sourceBetween("function defaultCustomerDisplaySettings", "function normalizeCustomerShippingChargeRule");
vm.runInNewContext(displayDefaultsLogic, context);
const displayDefaults = context.defaultCustomerDisplaySettings();
assert(displayDefaults.default_outbound_carrier_name === "ヤマト運輸" && displayDefaults.default_outbound_service_name === "宅急便", "new customers must keep Yamato Takkyubin as the outbound default");
assert(displayDefaults.default_core_return_carrier_name === "佐川急便" && displayDefaults.default_core_return_service_name === "飛脚宅配便", "new customers must default core returns to Sagawa Hikyaku delivery");

const defaultServiceContext = {
  activeCustomerPortalContext: () => ({ settings: {} }),
  customerOrderDeliveryServiceKey: context.customerOrderDeliveryServiceKey
};
vm.runInNewContext(sourceBetween("function customerOrderDefaultShippingKey", "function customerOrderSavedShippingMethod"), defaultServiceContext);
const defaultOutbound = context.customerOrderDeliveryServiceFromKey(defaultServiceContext.customerOrderDefaultShippingKey("outbound"));
const defaultCoreReturn = context.customerOrderDeliveryServiceFromKey(defaultServiceContext.customerOrderDefaultShippingKey("core_return"));
assert(defaultOutbound.carrier_name === "ヤマト運輸" && defaultOutbound.service_name === "宅急便", "outbound fallback must remain Yamato Takkyubin");
assert(defaultCoreReturn.carrier_name === "佐川急便" && defaultCoreReturn.service_name === "飛脚宅配便", "core-return fallback must default to Sagawa Hikyaku delivery");

const serviceKey = context.customerOrderDeliveryServiceKey("ヤマト運輸", "宅急便");
const decodedService = context.customerOrderDeliveryServiceFromKey(serviceKey);
assert(decodedService.carrier_name === "ヤマト運輸" && decodedService.service_name === "宅急便", "delivery service keys must round-trip safely");

[
  'id="customer-order-delivery-service"',
  'id="customer-order-core-return-service-field"',
  'id="customer-order-core-return-service"',
  'id="customer-order-shipping-date"',
  'id="customer-order-delivery-date"',
  'id="customer-order-delivery-time"',
  'id="customer-order-delivery-estimate"'
].forEach((fragment) => assert(html.includes(fragment), `order delivery UI is missing: ${fragment}`));
assert(html.indexOf('id="customer-order-shipping-date"') < html.indexOf('id="customer-order-delivery-date"'), "the shipping date must appear above the requested delivery date");
assert(html.includes('id="customer-order-shipping-date" type="date" disabled aria-readonly="true"'), "the calculated shipping date must be read-only");

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
const customerAccessSave = sourceBetween("function collectCustomerDisplaySettings", "function collectCustomerAccessCategoryVisibility");
assert(customerAccessSave.includes('default_core_return_carrier_name = (returnMethod && returnMethod.carrier_name) || "佐川急便"'), "customer registration must save Sagawa as the fallback core-return carrier");
assert(customerAccessSave.includes('default_core_return_service_name = (returnMethod && returnMethod.service_name) || "飛脚宅配便"'), "customer registration must save Hikyaku delivery as the fallback core-return service");

const returnLogic = sourceBetween("function customerOrderCartRequiresCoreReturn", "function applyCustomerOrderDeliveryQuote");
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

const estimateUi = sourceBetween("function applyCustomerOrderDeliveryQuote", "function customerOrderDeliveryServiceSortValue");
assert(estimateUi.includes('shippingDateInput.value = quote && quote.available === true ? (quote.shipping_date || "") : ""'), "the dedicated shipping-date field must use the server quote");
assert(estimateUi.includes('shippingDateInput.value = ""') && estimateUi.includes('customer_order_delivery_checking'), "stale shipping dates must be cleared while recalculating");
assert(estimateUi.includes('dateInput.min = quote.earliest_delivery_date') && estimateUi.includes('dateInput.max = quote.max_requested_delivery_date'), "requested dates must be bounded by the server quote");
assert(estimateUi.includes('quote.allowed_time_codes') && estimateUi.includes('option.disabled = !allowed'), "postal time-window rules must control the selectable options");
assert(estimateUi.includes('dateInput.disabled = true') && estimateUi.includes('timeInput.disabled = true'), "unresolved and non-requestable routes must disable both controls");
assert(estimateUi.includes('sb.rpc("get_customer_order_delivery_quote"') && estimateUi.includes('target_shipping_date: null'), "delivery constraints must come from the server RPC");
assert(estimateUi.includes('target_postal_code:') && estimateUi.includes('target_address:'), "delivery lookup must support postal code and address resolution");
assert(estimateUi.includes('ship: customerOrderDeliveryDateLabel(quote.shipping_date)'), "the server-calculated shipping date must be shown in delivery guidance");
assert(source.includes('customer_order_delivery_auto: "発送予定日は {ship} です。'), "Japanese guidance must identify the effective shipping date");
assert(!source.includes("CUSTOMER_ORDER_DELIVERY_SERVICE_LEVELS") && !source.includes("CUSTOMER_ORDER_DELIVERY_FAR_PREFECTURE_CODES"), "the browser must not retain a heuristic delivery calendar");

const salesOrderScheduleUi = sourceBetween("function salesOrderTokyoTodayValue", "function renderSalesOrderDetail");
assert(salesOrderScheduleUi.includes('timeZone: "Asia/Tokyo"'), "sales-order shipping-date minimum must use the Japan calendar date");
assert(salesOrderScheduleUi.includes("order.scheduled_shipping_date"), "sales-order shipping date must come from the persisted order schedule");
assert(salesOrderScheduleUi.includes("id='sales-order-scheduled-shipping-date'"), "sales-order detail must provide a dedicated shipping-date control");
assert(salesOrderScheduleUi.includes("min='\" + esc(salesOrderTokyoTodayValue())"), "sales-order shipping-date control must prevent past dates");
assert(salesOrderScheduleUi.includes("salesOrderCanRevise(order)"), "only revisable orders may enable the shipping-date control");
assert(salesOrderScheduleUi.includes('typeof salesOrderCanRevise !== "function" || !salesOrderCanRevise(order)'), "the shipping-date save action must repeat the revisable-order gate");
assert(salesOrderScheduleUi.includes('sb.rpc("update_sales_order_scheduled_shipping_date"'), "shipping-date changes must use the guarded server RPC");
assert(salesOrderScheduleUi.includes("target_scheduled_shipping_date: shippingDate") && salesOrderScheduleUi.includes("target_expected_version: order.version"), "shipping-date updates must send the date and optimistic-lock version");
assert(salesOrderScheduleUi.includes("shippingDate < today"), "the frontend must reject past shipping dates before calling the server");
assert(salesOrderScheduleUi.includes('t("sales_order_shipping_date_updated")'), "shipping-date changes must show the translated reissue warning");
assert(source.includes('sales_order_shipping_date_updated: "発送予定日を変更しました。B2 CSVと帳票は変更後の日付で再発行してください。"'), "Japanese shipping-date confirmation must require outbound artifact reissue");
assert(source.includes("salesOrderShippingScheduleHtml(order)"), "sales-order detail must render the shipping-date editor above delivery details");
assert(source.includes('shippingDateButton.addEventListener("click", saveSalesOrderScheduledShippingDate)'), "sales-order shipping-date save action must be wired");

[
  ".customer-order-shipping-methods",
  ".customer-order-shipping-method.core-return",
  ".customer-order-shipping-date-field",
  ".customer-order-delivery-estimate.ready",
  ".customer-order-delivery-estimate.restricted",
  ".sales-order-shipping-schedule",
  ".sales-order-shipping-schedule input"
].forEach((fragment) => assert(css.includes(fragment), `order delivery style is missing: ${fragment}`));

[
  "target_shipping_method jsonb",
  "target_core_return_shipping_method jsonb",
  "outbound_shipping_method",
  "core_return_shipping_method",
  "ブラウザ計算を信用しない",
  "日時指定不可サービス",
  "最短日より前を指定できず",
  "発送日から13日後",
  "17:00:00以降",
  "16:59:59までは受注日の暦日",
  "scheduled_shipping_date",
  "update_sales_order_scheduled_shipping_date",
  "当日または未来日",
  "B2 CSV",
  "get_customer_order_delivery_quote"
].forEach((fragment) => assert(contract.includes(fragment), `server handoff contract is missing: ${fragment}`));

if ((source.match(/customer_order_delivery_service:/g) || []).length !== 3 ||
    (source.match(/customer_order_outbound_service:/g) || []).length !== 3 ||
    (source.match(/customer_order_core_return_service:/g) || []).length !== 3 ||
    (source.match(/customer_order_delivery_not_specifiable:/g) || []).length !== 3 ||
    (source.match(/customer_order_delivery_checking:/g) || []).length !== 3) {
  throw new Error("delivery service guidance must be translated for all supported languages");
}

console.log("customer order delivery service guard passed");
