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

const coreSelectStart = source.indexOf("var CORE_PRODUCT_FAST_SELECT = [");
const coreSelectEnd = source.indexOf('].join(",");', coreSelectStart);
if (coreSelectStart < 0 || coreSelectEnd < coreSelectStart) {
  throw new Error("CORE_PRODUCT_FAST_SELECT could not be isolated");
}
[
  "var SHIPPING_PREFECTURES = [",
  "var shippingRateRows = [];",
  "var shippingRateLoadSeq = 0;",
  "var shippingRateFormSaving = false;"
].forEach((fragment) => {
  if (source.indexOf(fragment) <= coreSelectEnd) {
    throw new Error(`shipping state must be declared after CORE_PRODUCT_FAST_SELECT: ${fragment}`);
  }
});

const logoutSource = sourceBetween("async function doLogout()", "// メニュー（翻訳辞書のキーを使って生成）");
["shippingRateRows = [];", "shippingRateLoadSeq += 1;"].forEach((fragment) => {
  if (!logoutSource.includes(fragment)) throw new Error(`shipping logout reset is missing: ${fragment}`);
});

const renderMenuSource = sourceBetween("function renderMenu()", "function renderCustomerExperienceHeaders");
const adminItemsStart = renderMenuSource.indexOf("var adminItems = [");
const adminItemsEnd = renderMenuSource.indexOf("].filter(function(item) { return item.available; });", adminItemsStart);
if (adminItemsStart < 0 || adminItemsEnd < adminItemsStart) throw new Error("adminItems could not be isolated");
const adminItemsSource = renderMenuSource.slice(adminItemsStart, adminItemsEnd);
if (!adminItemsSource.includes('action: "shipping-rate-mgmt"')) {
  throw new Error("shipping master must be an adminItems entry");
}
if (adminItemsSource.includes("shippingRateRows = [];") || adminItemsSource.includes("shippingRateLoadSeq += 1;")) {
  throw new Error("shipping logout resets must not be inside adminItems");
}
if (!renderMenuSource.includes('else if (card.dataset.action === "shipping-rate-mgmt") enterShippingRateMgmt();')) {
  throw new Error("shipping master click routing must be inside renderMenu");
}

const shippingFunctionsStart = source.indexOf("function shippingPrefectureLabel");
const productionSearchStart = source.indexOf("async function enterProductionSearch");
const shippingFunctionsSource = source.slice(shippingFunctionsStart, productionSearchStart);
if (shippingFunctionsStart < 0 || productionSearchStart < shippingFunctionsStart || !shippingFunctionsSource.includes("async function saveShippingRate")) {
  throw new Error("shipping functions must be global and outside enterProductionSearch");
}

const customerShippingListener = 'document.getElementById("customer-portal-shipping").addEventListener("click", enterCustomerShipping)';
const componentAltInputStart = source.indexOf('componentAltReplacementRateEl.addEventListener("input"');
const componentAltInputEnd = source.indexOf('componentAltReplacementRateEl.addEventListener("change"', componentAltInputStart);
if (source.indexOf(customerShippingListener) < 0 || source.indexOf(customerShippingListener) > componentAltInputStart) {
  throw new Error("customer shipping listeners must be in the normal event registration section");
}
if (source.slice(componentAltInputStart, componentAltInputEnd).includes("customer-shipping")) {
  throw new Error("customer shipping listeners must not be inside the component replacement-rate input handler");
}

const customerShippingAccess = sourceBetween("function canViewCustomerShippingRates()", "function canViewSalesPricing");
if (!customerShippingAccess.includes("canPreviewCustomerPortal()") || customerShippingAccess.includes("isCustomerViewer()")) {
  throw new Error("customer users must not have access to shipping master rates");
}
const customerPortalRender = sourceBetween("function renderCustomerPortal()", "async function loadCustomerPortalPreviewContext");
if (!customerPortalRender.includes('shippingGuide.hidden = !canViewCustomerShippingRates()')) {
  throw new Error("customer portal shipping guide must stay hidden for customer users");
}
if (!html.includes('id="customer-portal-shipping-guide" hidden')) {
  throw new Error("customer portal shipping guide must be hidden before permissions are evaluated");
}

const languageSource = sourceBetween("async function applyLanguage", "function markAppUpdateActivity");
const customerShippingRedraw = languageSource.indexOf('isScreenActive("customer-shipping")');
const shippingMgmtRedraw = languageSource.indexOf('isScreenActive("shipping-rate-mgmt")');
const historyOverlayRedraw = languageSource.indexOf('document.getElementById("ec-price-history-overlay")');
if (customerShippingRedraw < 0 || shippingMgmtRedraw < 0 || historyOverlayRedraw < 0 ||
    customerShippingRedraw > historyOverlayRedraw || shippingMgmtRedraw > historyOverlayRedraw) {
  throw new Error("shipping language redraws must be outside the EC price history overlay condition");
}

[
  "screen-customer-shipping",
  "customer-shipping-prefecture",
  "customer-shipping-carrier",
  "customer-shipping-service",
  "customer-shipping-size",
  "screen-shipping-rate-mgmt",
  "shipping-rate-prefecture-filter",
  "shipping-rate-carrier-filter",
  "shipping-rate-service-filter",
  "shipping-rate-size-filter",
  "shipping-rate-status-filter",
  "shipping-rate-form-overlay",
  "shipping-rate-service",
  "shipping-rate-package-size",
  "shipping-rate-max-size",
  "shipping-rate-max-weight",
  "shipping-rate-origin-region",
  "shipping-rate-tax-type",
  "shipping-rate-standard-fee",
  "shipping-rate-island-fee",
  "shipping-rate-island-condition"
].forEach((id) => {
  if (!html.includes(`id="${id}"`)) throw new Error(`shipping UI control is missing: ${id}`);
});

const customerLoad = sourceBetween("async function loadCustomerShippingRates", "function renderCustomerShippingRates");
if (!customerLoad.includes('from("customer_shipping_rates")') || !customerLoad.includes('.eq("is_active", true)')) {
  throw new Error("customer shipping list must load only active master rows");
}

const managementLoad = sourceBetween("async function loadShippingRateMgmt", "function renderShippingRateMgmt");
if (!managementLoad.includes('from("customer_shipping_rates")') || managementLoad.includes('.eq("is_active", true)')) {
  throw new Error("shipping management must load active and inactive master rows");
}

const saveSource = sourceBetween("async function saveShippingRate", "async function toggleShippingRateVisibility");
[
  "carrier_name: carrier",
  "service_name: serviceName",
  "package_size_label: packageSize",
  "max_size_cm: maxSize.value",
  "max_weight_kg: maxWeight.value",
  "prefecture_code: prefectureCode",
  "standard_fee_jpy: standardFee.value",
  "remote_island_fee_jpy: islandFee.value",
  "remote_island_condition: islandCondition || null",
  "origin_region: originRegion || null",
  "tax_type: taxType",
  "updated_by: currentUser ? currentUser.id : null"
].forEach((fragment) => {
  if (!saveSource.includes(fragment)) throw new Error(`shipping save field is missing: ${fragment}`);
});

if (!source.includes(customerShippingListener)) {
  throw new Error("customer shipping list must remain reachable in the internal customer preview");
}
if ((source.match(/customer_shipping_title:/g) || []).length !== 3 || (source.match(/mi_shipping_title:/g) || []).length !== 3) {
  throw new Error("shipping labels must be translated for all supported languages");
}
if ((source.match(/shipping_all_services:/g) || []).length !== 3 || (source.match(/shipping_tax_excluded:/g) || []).length !== 3) {
  throw new Error("shipping service, size, and tax labels must be translated for all supported languages");
}
if (!customerLoad.includes("service_name,package_size_label,max_size_cm,max_weight_kg") || !managementLoad.includes("origin_region,tax_type")) {
  throw new Error("shipping loads must include service, size, limit, origin, and tax fields");
}
if (!source.includes('filteredShippingRows("customer-shipping-prefecture", "customer-shipping-carrier", "customer-shipping-service", "customer-shipping-size")')) {
  throw new Error("customer shipping list must support service and package-size filters");
}
if ((source.match(/\[47,"沖縄県"/g) || []).length !== 1 || !source.includes('[1,"北海道"')) {
  throw new Error("all 47 prefectures must be available");
}

[
  ".customer-shipping-row",
  ".shipping-rate-mgmt-row",
  "@media(max-width:640px)",
  ".customer-shipping-mobile-label",
  ".shipping-rate-cell-label"
].forEach((fragment) => {
  if (!css.includes(fragment)) throw new Error(`shipping responsive style is missing: ${fragment}`);
});

const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
if (duplicateIds.length) throw new Error(`duplicate HTML ids: ${[...new Set(duplicateIds)].join(", ")}`);

console.log("shipping rate management guard passed");
