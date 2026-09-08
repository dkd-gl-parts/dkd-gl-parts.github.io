const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "styles.css"), "utf8");

function functionSource(name, nextName) {
  const plainStart = source.indexOf(`function ${name}`);
  const asyncStart = source.indexOf(`async function ${name}`);
  const start = plainStart >= 0 && asyncStart >= 0 ? Math.min(plainStart, asyncStart) : Math.max(plainStart, asyncStart);
  const end = source.indexOf(nextName, start + 1);
  if (start < 0 || end < start) throw new Error(`${name} could not be isolated`);
  return source.slice(start, end);
}

const stockLookup = functionSource("fetchCustomerOrderStockAvailabilityMap", "function customerCatalogAvailabilityKindHtml");
[
  'sb.rpc("get_customer_order_stock_availability"',
  "target_products: payload",
  "Math.floor(100 / requestedKinds.length)",
  '"rebuilt", "aftermarket_new"',
  "normalizedCustomerOrderStockAvailability(row)"
].forEach((fragment) => {
  if (!stockLookup.includes(fragment)) throw new Error(`reservation-aware stock lookup is missing: ${fragment}`);
});
if (stockLookup.includes('from("core_product_variants")')) {
  throw new Error("order availability must come from the server-authoritative reservation-aware RPC");
}

const detailLoad = functionSource("loadCustomerCatalogAvailability", "async function loadCustomerCatalogVehicles");
if (!detailLoad.includes("fetchCustomerOrderStockAvailabilityMap([product], kinds)") ||
    !detailLoad.includes('select("product_kind,stock_qty,core_return_required,core_charge_jpy")')) {
  throw new Error("catalog detail must separate order availability from exact-product core policy data");
}
if (!detailLoad.includes("stockMap[button.dataset.customerOrderAdd]")) {
  throw new Error("catalog order buttons must pass exact/compatible availability into the cart");
}

const availabilityHtml = functionSource("customerCatalogAvailabilityKindHtml", "function renderCustomerCatalogDetailBase");
[
  "availability.total_available_qty",
  "availability.exact_available_qty",
  "availability.compatible_available_qty",
  'tf("customer_catalog_stock_breakdown"',
  "var hasStock = stockQty != null && Number(stockQty) > 0"
].forEach((fragment) => {
  if (!availabilityHtml.includes(fragment)) throw new Error(`catalog availability UI is missing: ${fragment}`);
});

const compatibleLookup = functionSource("fetchCustomerCatalogCompatibleStockMap", "async function loadCustomerCatalogCompatible");
if (!compatibleLookup.includes('fetchCustomerOrderStockAvailabilityMap(rows, ["rebuilt", "aftermarket_new"])') ||
    !compatibleLookup.includes("stock.exact_available_qty") ||
    compatibleLookup.includes('from("core_product_variants")')) {
  throw new Error("compatible-part cards must show each physical part's remaining exact stock without duplicating the group total");
}

const addToCart = functionSource("addCustomerCatalogProductToOrder", "function customerOrderPayloadItems");
[
  "display_stock_qty: availability == null ? null : Number(availability.total_available_qty)",
  "display_exact_stock_qty: availability == null ? null : Number(availability.exact_available_qty)",
  "display_compatible_stock_qty: availability == null ? null : Number(availability.compatible_available_qty)"
].forEach((fragment) => {
  if (!addToCart.includes(fragment)) throw new Error(`cart availability snapshot is missing: ${fragment}`);
});

const cart = functionSource("renderCustomerOrderCart", "function renderCustomerOrderHistory");
[
  "confirmed.exact_available_stock_qty",
  "confirmed.compatible_available_stock_qty",
  "confirmed.uses_compatible_stock === true",
  'tf("customer_order_stock_summary"',
  't("customer_order_compatible_stock_allocated")'
].forEach((fragment) => {
  if (!cart.includes(fragment)) throw new Error(`cart compatible-stock confirmation is missing: ${fragment}`);
});

const customerSearch = functionSource("runCustomerCatalogSearch", "function customerCatalogFact");
if (!customerSearch.includes("await fetchCustomerOrderAvailableStockMap(products)")) {
  throw new Error("customer search results must prioritize products using reservation-aware compatible stock");
}
const customerPriority = functionSource("fetchCustomerOrderAvailableStockMap", "function sortProductsByAvailableStock");
if (!customerPriority.includes("total_available_qty") || !customerPriority.includes("fetchCustomerOrderStockAvailabilityMap")) {
  throw new Error("customer search stock priority must include compatible available stock");
}

[
  "customer_catalog_stock_breakdown:",
  "customer_order_stock_summary:",
  "customer_order_compatible_stock_allocated:"
].forEach((key) => {
  if ((source.match(new RegExp(key, "g")) || []).length !== 3) {
    throw new Error(`${key} must be localized in Japanese, English, and Chinese`);
  }
});
if (!styles.includes(".customer-catalog-stock-breakdown") ||
    !styles.includes(".customer-order-line-metric small.compatible-stock")) {
  throw new Error("compatible-stock detail styles are missing");
}

console.log("customer compatible-order stock guard passed");
