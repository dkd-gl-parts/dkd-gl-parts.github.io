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
if (!adminItemsSource.includes('titleKey: "mi_shipping_title"') ||
    !source.includes('mi_shipping_title: "運送・送料管理"') ||
    !source.includes('mi_shipping_desc: "運送業者・都道府県別の送料とB2契約情報を管理します。"')) {
  throw new Error("the shipping management menu must identify its B2 contract settings responsibility");
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
  "shipping-service-visibility-title",
  "shipping-service-visibility-count",
  "shipping-service-visibility-list",
  "shipping-rate-b2-settings-open",
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

const shippingMgmtEntry = sourceBetween("async function enterShippingRateMgmt", "async function loadShippingRateMgmt");
if (!shippingMgmtEntry.includes('getElementById("shipping-rate-b2-settings-open")') ||
    !shippingMgmtEntry.includes("b2SettingsButton.hidden = !isSystemAdmin()")) {
  throw new Error("B2 contract settings entry must be visible only to system administrators");
}
if (!source.includes('document.getElementById("shipping-rate-b2-settings-open").addEventListener("click", openSalesOrderB2Settings);')) {
  throw new Error("shipping management must open the existing B2 contract settings dialog");
}

const customerLoad = sourceBetween("async function loadCustomerShippingRates", "function renderCustomerShippingRates");
if (!customerLoad.includes("fetchAllShippingRateRows(") || !customerLoad.includes("true")) {
  throw new Error("customer shipping list must load only active master rows");
}
if ((customerLoad.match(/fetchAllShippingRateRows\(/g) || []).length < 2 ||
    !customerLoad.includes("result.error && requestSeq === shippingRateLoadSeq")) {
  throw new Error("customer shipping list must automatically retry one transient load failure");
}
const customerShippingRender = sourceBetween("function renderCustomerShippingRates", "async function enterShippingRateMgmt");
if (!customerShippingRender.includes('id=\'customer-shipping-retry\'') ||
    !customerShippingRender.includes("bindCustomerShippingRetry()") ||
    !customerLoad.includes('addEventListener("click", loadCustomerShippingRates)')) {
  throw new Error("customer shipping load errors must provide a working reload action");
}

const managementLoad = sourceBetween("async function loadShippingRateMgmt", "function renderShippingRateMgmt");
if (!managementLoad.includes("fetchAllShippingRateRows(") || !managementLoad.includes("false")) {
  throw new Error("shipping management must load active and inactive master rows");
}

const managementRender = sourceBetween("function renderShippingRateMgmt", "function shippingServiceVisibilityKey");
if (!managementRender.includes("renderShippingServiceVisibilityControls(loadError)")) {
  throw new Error("shipping management must render carrier delivery-service visibility controls");
}

const shippingDetailSource = sourceBetween("var SHIPPING_RATE_HIDDEN_NOTES", "function shippingRateCell");
[
  'var SHIPPING_RATE_HIDDEN_NOTES = ["\\u95a2\\u897f\\u767a\\u30fb\\u304a\\u5ba2\\u69d8\\u5411\\u3051\\u904b\\u8cc3\\uff08\\u7a0e\\u629c\\uff09"]',
  "function shippingRateVisibleNote(note)",
  "SHIPPING_RATE_HIDDEN_NOTES.indexOf(value.trim()) === -1",
  "var note = shippingRateVisibleNote(row.note);",
  "if (note)"
].forEach((fragment) => {
  if (!shippingDetailSource.includes(fragment)) throw new Error(`shipping note display rule is missing: ${fragment}`);
});
const salesShippingRender = sourceBetween("function renderSalesShippingEstimate", "async function loadSalesShippingEstimateForCurrent");
if (!salesShippingRender.includes("var note = shippingRateVisibleNote(selectedRate.note);") ||
    !salesShippingRender.includes('if (note) html += "<span><b>" + esc(t("shipping_note"))')) {
  throw new Error("sales shipping estimates must use the same shipping note display rule");
}

const serviceVisibilitySource = sourceBetween("function shippingServiceVisibilityKey", "function shippingRateById");
[
  "function shippingServiceVisibilityGroups()",
  "function renderShippingServiceVisibilityControls(loadError)",
  "role='switch'",
  "input.indeterminate = true",
  "async function setShippingServiceVisibility(group, nextActive)",
  '.from("customer_shipping_rates").update({',
  '.eq("carrier_name", group.carrier_name).eq("service_name", group.service_name)',
  "invalidateSalesShippingRateCache();"
].forEach((fragment) => {
  if (!serviceVisibilitySource.includes(fragment)) throw new Error(`shipping service visibility behavior is missing: ${fragment}`);
});
if (!source.includes('document.getElementById("shipping-service-visibility-list").addEventListener("change"')) {
  throw new Error("shipping service visibility controls must have a change listener");
}
if ((source.match(/shipping_service_visibility_title:/g) || []).length !== 3 ||
    (source.match(/shipping_service_visibility_updated:/g) || []).length !== 3) {
  throw new Error("shipping service visibility labels must be translated for all supported languages");
}

const pagedLoad = sourceBetween("async function fetchAllShippingRateRows", "async function ensureSalesShippingRateRows");
[
  'from("customer_shipping_rates")',
  'if (activeOnly) query = query.eq("is_active", true)',
  '.order("service_name", { ascending: true })',
  '.order("package_size_label", { ascending: true })',
  '.order("shipping_rate_id", { ascending: true })',
  '.range(from, from + SHIPPING_RATE_PAGE_SIZE - 1)',
  'if (pageRows.length < SHIPPING_RATE_PAGE_SIZE) break'
].forEach((fragment) => {
  if (!pagedLoad.includes(fragment)) throw new Error(`shipping pagination is incomplete: ${fragment}`);
});
if (!source.includes("var SHIPPING_RATE_PAGE_SIZE = 1000;") || pagedLoad.includes(".limit(1000)")) {
  throw new Error("shipping rows must be fetched page by page without a fixed total limit");
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

const shippingFormSource = sourceBetween("function openShippingRateForm", "function closeShippingRateForm");
if (!shippingFormSource.includes('row ? (row.tax_type || "unknown") : "excluded"')) {
  throw new Error("new shipping rates must default to tax excluded");
}

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

const backButtonIds = [...html.matchAll(/<button\s+class="[^"]*\bback-btn\b[^"]*"\s+id="([^"]+)"/g)].map((match) => match[1]);
backButtonIds.forEach((id) => {
  if (!source.includes(`document.getElementById("${id}").addEventListener("click"`)) {
    throw new Error(`back button has no click handler: ${id}`);
  }
});
const menuReturnSource = sourceBetween("function returnToMenuFresh()", "async function refreshCustomerOrderFeatureStatus");
if (!menuReturnSource.includes("clearAppRestoreState();") ||
    !menuReturnSource.includes("showAuthenticatedHome();") ||
    menuReturnSource.includes("window.location.reload()")) {
  throw new Error("standard management screens must return directly to the authenticated menu without a page reload");
}
if (!source.includes('document.getElementById("btn-back-report-hub").addEventListener("click", returnToMenuFresh);') ||
    !source.includes('document.getElementById("btn-back-manufacturing-ranking-report").addEventListener("click", function(){ enterReportHub(); });') ||
    !source.includes('document.getElementById("btn-back-customer-price-report").addEventListener("click", function(){ enterReportHub(); });')) {
  throw new Error("report screens must return through the report hub and menu");
}

// Exercise the real change listeners with an Event. Calling render directly
// would miss an Event being mistaken for its optional load-error flag.
const assert = require("node:assert/strict");
const vm = require("node:vm");
const acorn = require("acorn");
const ast = acorn.parse(source, { ecmaVersion: "latest" });
const filterCases = [
  ["shipping-rate-prefecture-filter", "13", 2],
  ["shipping-rate-carrier-filter", "ヤマト運輸", 3],
  ["shipping-rate-service-filter", "宅急便", 3],
  ["shipping-rate-size-filter", "60", 2],
  ["shipping-rate-status-filter", "inactive", 1],
  ["customer-shipping-prefecture", "13", 2],
  ["customer-shipping-carrier", "ヤマト運輸", 2],
  ["customer-shipping-service", "宅急便", 2],
  ["customer-shipping-size", "60", 2]
];
class ShippingElement extends EventTarget {
  constructor() {
    super();
    this.value = "all";
    this.innerHTML = "";
    this.textContent = "";
  }
  querySelectorAll() { return []; }
}
const elements = new Map([
  ...filterCases.map(([id]) => [id, new ShippingElement()]),
  ...["shipping-rate-list", "shipping-rate-count", "shipping-service-visibility-list",
    "shipping-service-visibility-count", "customer-shipping-list", "customer-shipping-count"]
    .map(id => [id, new ShippingElement()])
]);
const fixtureRows = [
  { shipping_rate_id: 1, carrier_name: "ヤマト運輸", service_name: "宅急便", package_size_label: "60", prefecture_code: 13, standard_fee_jpy: 600, is_active: true },
  { shipping_rate_id: 2, carrier_name: "ヤマト運輸", service_name: "宅急便", package_size_label: "80", prefecture_code: 27, standard_fee_jpy: 800, is_active: true },
  { shipping_rate_id: 3, carrier_name: "ヤマト運輸", service_name: "宅急便", package_size_label: "80", prefecture_code: 1, standard_fee_jpy: 900, is_active: false },
  { shipping_rate_id: 4, carrier_name: "佐川急便", service_name: "飛脚宅配便", package_size_label: "60", prefecture_code: 13, standard_fee_jpy: 500, is_active: true }
];
const fixtureSnapshot = JSON.stringify(fixtureRows);
const context = vm.createContext({
  document: { getElementById: id => elements.get(id) || null },
  currentLang: "ja",
  shippingRateRows: fixtureRows,
  shippingServiceVisibilitySavingKey: "",
  t: key => key,
  tf: (key, values) => `${key}:${values.n ?? values.active}`,
  esc: value => String(value).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]),
  sb: { from() { throw new Error("Filtering must not request or mutate shipping data"); } }
});
const shippingRuntime = sourceBetween("function shippingPrefectureLabel", "async function enterProductionSearch");
const prefectures = ast.body.find(node => node.type === "VariableDeclaration" && node.declarations.some(d => d.id.name === "SHIPPING_PREFECTURES"));
vm.runInContext(source.slice(prefectures.start, prefectures.end) + "\n" + shippingRuntime, context);
for (const [id] of filterCases) {
  const listener = ast.body.find(node => node.type === "ExpressionStatement" &&
    source.slice(node.start, node.end).startsWith(`document.getElementById("${id}").addEventListener("change",`));
  assert.ok(listener, `Missing real change listener for ${id}`);
  vm.runInContext(source.slice(listener.start, listener.end), context);
}
context.renderShippingRateMgmt();
assert.equal(elements.get("shipping-rate-count").textContent, "customer_catalog_count:4");
const visibilityBefore = elements.get("shipping-service-visibility-list").innerHTML;
for (const [id, value, expectedCount] of filterCases) {
  for (const [filterId] of filterCases) elements.get(filterId).value = "all";
  const select = elements.get(id);
  select.value = value;
  select.dispatchEvent(new Event("change"));
  const isManagement = id.startsWith("shipping-rate-");
  const listId = isManagement ? "shipping-rate-list" : "customer-shipping-list";
  const countId = isManagement ? "shipping-rate-count" : "customer-shipping-count";
  const markup = elements.get(listId).innerHTML;
  assert.ok(!markup.includes("shipping_load_error"), `${id}: a change Event must not become a load error`);
  assert.equal(elements.get(countId).textContent, `customer_catalog_count:${expectedCount}`, id);
  if (id.includes("carrier")) assert.ok(!markup.includes("佐川急便"), `${id}: filter the selected carrier`);
  assert.equal(elements.get("shipping-service-visibility-list").innerHTML, visibilityBefore, `${id}: keep visibility controls`);
  select.value = "all";
  select.dispatchEvent(new Event("change"));
  assert.equal(elements.get(countId).textContent, `customer_catalog_count:${isManagement ? 4 : 3}`, `${id}: clear filter`);
}
elements.get("shipping-rate-carrier-filter").value = "ヤマト運輸";
elements.get("shipping-rate-prefecture-filter").value = "13";
elements.get("shipping-rate-size-filter").value = "60";
elements.get("shipping-rate-status-filter").value = "active";
elements.get("shipping-rate-size-filter").dispatchEvent(new Event("change"));
assert.equal(elements.get("shipping-rate-count").textContent, "customer_catalog_count:1", "combined filters");
elements.get("shipping-rate-prefecture-filter").value = "47";
elements.get("shipping-rate-prefecture-filter").dispatchEvent(new Event("change"));
assert.ok(elements.get("shipping-rate-list").innerHTML.includes("shipping_no_rates"), "empty results are not load errors");
context.renderShippingRateMgmt(true);
for (const id of ["shipping-rate-list", "shipping-service-visibility-list"]) {
  assert.ok(elements.get(id).innerHTML.includes("shipping_load_error"), `${id}: retain genuine load error`);
}
context.renderCustomerShippingRates(true);
assert.ok(elements.get("customer-shipping-list").innerHTML.includes("shipping_load_error"), "retain preview load error");
assert.ok(elements.get("customer-shipping-list").innerHTML.includes("customer-shipping-retry"), "retain retry action");
assert.equal(JSON.stringify(context.shippingRateRows), fixtureSnapshot, "filtering must not change rate data");

console.log("shipping rate management guard passed (9 real change listeners, combined/empty/error states)");
