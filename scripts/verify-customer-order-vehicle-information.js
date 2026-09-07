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

[
  "customer-order-vehicle-name",
  "customer-order-vehicle-model-code",
  "customer-order-first-registration",
  "customer-order-chassis-number",
  "customer-order-engine-model",
  "customer-order-model-designation",
  "customer-order-classification"
].forEach((id) => {
  if (!html.includes(`id="${id}"`)) throw new Error(`vehicle input is missing: ${id}`);
  const input = html.match(new RegExp(`<input\\b[^>]*id="${id}"[^>]*>`));
  if (!input || /\brequired\b/.test(input[0])) throw new Error(`vehicle input must remain optional: ${id}`);
});

[
  'id="customer-order-first-registration" type="month"',
  'id="customer-order-vehicle-name" type="text" maxlength="80"',
  'id="customer-order-chassis-number" type="text" maxlength="60"',
  'data-i18n="customer_order_vehicle_title"'
].forEach((fragment) => {
  if (!html.includes(fragment)) throw new Error(`vehicle input contract is missing: ${fragment}`);
});

const payload = sourceBetween("function customerOrderVehicleInformationPayload", "function clearCustomerOrderVehicleInformation");
[
  "vehicle_name",
  "vehicle_model_code",
  "first_registration_month",
  "chassis_number",
  "engine_model",
  "model_designation_number",
  "classification_number",
  '.normalize("NFKC")',
  ".toUpperCase()"
].forEach((fragment) => {
  if (!payload.includes(fragment)) throw new Error(`vehicle payload is missing: ${fragment}`);
});

const addressPayload = sourceBetween("function customerOrderAddressPayload", "function populateCustomerOrderPrefectures");
if (!addressPayload.includes("vehicle_information: customerOrderVehicleInformationPayload()")) {
  throw new Error("vehicle information must travel through the existing server-controlled order RPC payload");
}
const submit = sourceBetween("async function submitCustomerOrder", "function renderCustomerOrderHistory");
if (!submit.includes("clearCustomerOrderVehicleInformation();")) {
  throw new Error("vehicle information must be cleared after a successful order");
}
if (!submit.includes("target_preview_token") || !submit.includes("target_idempotency_key")) {
  throw new Error("vehicle information must preserve the atomic preview and idempotent order workflow");
}
if (source.includes('.from("customer_orders")')) {
  throw new Error("the browser must not write order vehicle information directly to the order table");
}

const history = sourceBetween("function renderCustomerOrderHistory", "async function loadCustomerOrderHistory");
if (!history.includes("customerOrderVehicleInformationInlineHtml(order.vehicle_information)")) {
  throw new Error("customer order history must show saved vehicle information");
}
const internalDetail = sourceBetween("function renderSalesOrderDetail", "async function openSalesOrderSerialWarranty");
if (!internalDetail.includes('customerOrderVehicleInformationHtml(order.vehicle_information, "sales-order-vehicle-information")')) {
  throw new Error("internal order detail must show saved vehicle information");
}

if ((source.match(/customer_order_vehicle_title:/g) || []).length !== 3) {
  throw new Error("vehicle labels must be defined in Japanese, English, and Chinese");
}
for (const title of ["車両情報", "Vehicle Information", "车辆信息"]) {
  if (!source.includes(`customer_order_vehicle_title: "${title}"`)) throw new Error(`vehicle heading must omit optional suffix: ${title}`);
}
if (!html.includes('data-i18n="customer_order_vehicle_title">車両情報</h3>')) {
  throw new Error("entry vehicle heading must omit optional suffix");
}
[
  ".customer-order-vehicle-section",
  ".customer-order-vehicle-grid",
  ".customer-order-vehicle-summary",
  ".customer-order-history-vehicle",
  "grid-template-columns: repeat(2, minmax(0, 1fr))",
  ".customer-order-vehicle-summary dl { grid-template-columns: 1fr; }"
].forEach((fragment) => {
  if (!css.includes(fragment)) throw new Error(`responsive vehicle layout is missing: ${fragment}`);
});

if (!html.includes('content="v1.1.903"') || !source.includes('var APP_VERSION       = "v1.1.903"')) {
  throw new Error("vehicle information release version must be v1.1.903");
}

console.log("Customer order vehicle information UI verified.");
