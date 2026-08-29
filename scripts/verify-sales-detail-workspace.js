const fs = require("fs");
const path = require("path");
const vm = require("vm");

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
  'id="sales-product-identity"',
  'data-sales-detail-tab="basic"',
  'data-sales-detail-tab="vehicles"',
  'data-sales-detail-tab="components"',
  'aria-controls="screen-components" data-sales-detail-tab="components"',
  'data-sales-detail-tab="images"',
  'id="sales-basic-compatible-section"',
  'id="sales-basic-compatible-wrap"',
  'id="detail-customer-wrap"',
  'id="sales-shipping-estimate-section"',
  'id="product-kind-wrap"',
  'id="core-return-policy-wrap"',
  'id="ec-mall-price-summary-wrap"',
  'class="panel-right sales-conditions-panel"'
].forEach((fragment) => {
  if (!html.includes(fragment)) throw new Error(`sales workspace markup is missing: ${fragment}`);
});

[
  'data-sales-detail-tab="compatible"',
  'id="sales-detail-compatible"',
  'id="sales-compatible-tab-count"',
  'id="sales-basic-compatible-count"',
  'id="sales-detail-components"',
  'id="btn-open-components"'
].forEach((fragment) => {
  if (html.includes(fragment)) throw new Error(`removed compatibility UI must stay absent: ${fragment}`);
});

const salesTabBindingSource = sourceBetween("function bindSalesDetailTabs", "function configureSalesDetailTabAvailability");
[
  'if (tab === "components")',
  'enterComponentsScreen("search")',
  "activateSalesDetailTab(tab)"
].forEach((fragment) => {
  if (!salesTabBindingSource.includes(fragment)) throw new Error(`direct component-tab navigation is missing: ${fragment}`);
});

const openPanelSource = sourceBetween("function openPanel", "async function openProductByDkdId");
if (!openPanelSource.includes('setCspStyle(document.getElementById("panel-inner"), "display", "grid")')) {
  throw new Error("sales product workspace must open as a grid");
}
if (!openPanelSource.includes("isSalesHiddenDaikoProduct(currentProduct)")) {
  throw new Error("direct sales-detail opening must reject hidden Daiko products");
}

const daikoVisibilitySource = sourceBetween("var salesDaikoVisibilityCache", "function defaultCustomerDisplaySettings");
const daikoSandbox = {
  productDkdId: (product) => product && product.dkd_shohin_id,
  isDksManagedManufacturer: (value) => /^(?:大光|大光サービス|大光電機|DAIKO|DKS)$/i.test(String(value || "")),
  filterVisibleProducts: (products) => products
};
vm.createContext(daikoSandbox);
vm.runInContext(`${daikoVisibilitySource}; this.visibilityApi = { isSalesHiddenDaikoProduct, filterSalesVisibleProducts };`, daikoSandbox);
const visibilityApi = daikoSandbox.visibilityApi;
[
  { row: { dkd_shohin_id: 1, manufacturer: "大光", manufacturer_part_number: "X1" }, hidden: true },
  { row: { dkd_shohin_id: 2, manufacturer: "DENSO", manufacturer_part_number: "STDK87538" }, hidden: true },
  { row: { dkd_shohin_id: 3, manufacturer: "DENSO", manufacturer_part_number: "ALDK00079" }, hidden: true },
  { row: { dkd_shohin_id: 4, manufacturer: "DENSO", manufacturer_part_number: "PREFIXALDK00079", daiko_part_number: "ALDK00079" }, hidden: true },
  { row: { dkd_shohin_id: 5, manufacturer: "DENSO", manufacturer_part_number: "102211-6240", daiko_part_number: "ALDK00079" }, hidden: false }
].forEach(({ row, hidden }) => {
  if (visibilityApi.isSalesHiddenDaikoProduct(row) !== hidden) {
    throw new Error(`Daiko sales visibility classification failed for ${row.manufacturer_part_number}`);
  }
});
if (visibilityApi.filterSalesVisibleProducts([
  { dkd_shohin_id: 6, manufacturer: "大光", manufacturer_part_number: "X2" },
  { dkd_shohin_id: 7, manufacturer: "DENSO", manufacturer_part_number: "102211-6240" }
]).length !== 1) {
  throw new Error("sales results must remove Daiko products without affecting external products");
}

const searchResultSource = sourceBetween("function render()", "function openPanel");
if (!searchResultSource.includes("renderProductKindPills(kindSummary, { compact: true })")) {
  throw new Error("search result product-kind labels must remain compact");
}

const productSearchSource = sourceBetween("async function runProductSearch(options)", "function waitForProductSearchEnrichmentDelay");
if ((productSearchSource.match(/filterSalesVisibleProducts\(rawProducts\)/g) || []).length < 2) {
  throw new Error("sales search must filter both category pages and part-number results");
}
if (searchResultSource.includes("renderProductKindPills(kindSummary, { compact: true, detail: true })")) {
  throw new Error("search result product-kind labels must not repeat stock quantities");
}

const primaryPartSource = sourceBetween("function salesDetailPrimaryPartNumber", "function salesDetailSelectedStock");
if (!primaryPartSource.includes("product.genuine_part_number || product.genuine_part_number_2 || product.manufacturer_part_number")) {
  throw new Error("the genuine part number must remain the primary product heading");
}

const statusBadgeSource = sourceBetween("function updateSalesProductStatusBadges", "function renderSalesProductIdentity");
if (statusBadgeSource.includes("core_charge_unset") || statusBadgeSource.includes("sales-status-badge warning")) {
  throw new Error("sales product status must not show a core-charge-unset warning badge");
}

const panelSource = sourceBetween("function renderPanelStatic", "async function loadProductVariantsForCurrent");
[
  'currentSelectedProductKind = "rebuilt"',
  'updateSalesComponentTabCountForSelectedKind()',
  'renderSalesProductIdentity(p)',
  'renderCatalogVehicleSummaryHtml("", { showButton: false })',
  'loadDetailCustomerInfoForCurrent(detailSeq)',
  'loadEcMallPriceSummaryForCurrent(detailSeq)',
  'loadCatalogVehicleSummary(document.getElementById("panel-body"), p)',
  'loadSalesComponentKindCountsForCurrent(detailSeq)',
  'loadKikanForCurrentProduct(detailSeq)'
].forEach((fragment) => {
  if (!panelSource.includes(fragment)) throw new Error(`sales detail data flow is missing: ${fragment}`);
});

const kindSwitchSource = sourceBetween("function bindProductKindPanelActions", "async function fetchProductVariantSummaryMap");
[
  "updateSalesProductStatusBadges()",
  "updateSalesComponentTabCountForSelectedKind()",
  "loadDetailCustomerInfoForCurrent(detailSecondaryRequestSeq)"
].forEach((fragment) => {
  if (!kindSwitchSource.includes(fragment)) throw new Error(`product-kind switching is incomplete: ${fragment}`);
});
if (kindSwitchSource.includes("renderImagesLoading()") || kindSwitchSource.includes("loadImages(null, detailSecondaryRequestSeq)")) {
  throw new Error("product-kind switching must not hide or reload the combined rebuilt/new image tab");
}

const componentCountSource = sourceBetween("function updateSalesComponentTabCountForSelectedKind", "function activateSalesDetailTab");
[
  'productionComponentKindCount(currentProduct, selectedProductKind())',
  'fetchProductionPartRegistrationCountMap([product])',
  'productionComponentKindCountMap[key]'
].forEach((fragment) => {
  if (!componentCountSource.includes(fragment)) throw new Error(`sales component tab kind count is missing: ${fragment}`);
});
if (componentCountSource.includes("productComponentCount(")) {
  throw new Error("sales component tab must not use the catalog-inclusive total count");
}

const salesImageSource = sourceBetween("function salesImageKinds", "function fillImageKindSelect");
[
  'return ["rebuilt", "aftermarket_new"]',
  'fetchAllCoreProductImagesForContext(dkdId, "sales")',
  "salesImageGroupHtml(kind, salesImagesForKind(kind), false)",
  "data-sales-image-kind"
].forEach((fragment) => {
  if (!salesImageSource.includes(fragment)) throw new Error(`sales image grouping is missing: ${fragment}`);
});
if (salesImageSource.includes("selectedProductKind()")) {
  throw new Error("sales image loading must be independent of the selected product kind");
}
if (!css.includes(".sales-detail-image-group") || !css.includes(".sales-detail-image-kind-grid")) {
  throw new Error("sales image groups need distinct rebuilt/new layouts");
}

const customerPriceSource = sourceBetween("async function fetchDetailCustomerPriceInfo", "async function loadDetailCustomerInfoForCurrent");
if (!customerPriceSource.includes('.select("base_price_jpy,tax_included")') || !customerPriceSource.includes("info.taxIncluded")) {
  throw new Error("customer sales price must preserve the stored tax classification");
}

const customerTermsSource = sourceBetween("async function fetchDetailCustomerDisplaySettings", "async function fetchDetailCustomerPriceInfo");
[
  'select("sales_customer_id,shipping_charge_rule")',
  "detailCustomerShippingRuleHtml",
  'sales_shipping_charge_separate',
  'sales_shipping_charge_free'
].forEach((fragment) => {
  if (!customerTermsSource.includes(fragment)) throw new Error(`customer shipping terms are missing from sales detail: ${fragment}`);
});
[
  "sales_shipping_charge_rule",
  "sales_shipping_charge_separate",
  "sales_shipping_charge_free",
  "customer_access_shipping_rule"
].forEach((key) => {
  const count = (source.match(new RegExp(`${key}:`, "g")) || []).length;
  if (count !== 3) throw new Error(`${key} must be translated for all supported languages`);
});

const vehicleSource = sourceBetween("async function loadCatalogVehicleSummary", "function renderGltekPartNumberRow");
if (!vehicleSource.includes('document.getElementById("detail-vehicle-tab-content")') || !vehicleSource.includes('updateSalesDetailTabCount("vehicles"')) {
  throw new Error("vehicle applications must render in the detail tab with a count");
}

const vehicleLanguageSource = sourceBetween("function vehicleApplicationTextLabel", "function vehicleApplicationPartNameLabel");
const vehicleLanguageSandbox = {
  currentLang: "en",
  normalizeAsciiWidth: (value) => String(value || "")
};
vm.createContext(vehicleLanguageSandbox);
vm.runInContext(`${vehicleLanguageSource}; this.vehicleLanguageApi = { vehicleApplicationTextLabel, romanizeVehicleKatakana };`, vehicleLanguageSandbox);
if (vehicleLanguageSandbox.vehicleLanguageApi.vehicleApplicationTextLabel("ハイゼット / アトレー") !== "Hijet / Atrai") {
  throw new Error("vehicle application names must use their official English labels");
}
if (/[ぁ-んァ-ヶ]/.test(vehicleLanguageSandbox.vehicleLanguageApi.vehicleApplicationTextLabel("テストカー"))) {
  throw new Error("unregistered Katakana vehicle names need a Roman-letter fallback");
}
vehicleLanguageSandbox.currentLang = "zh";
if (vehicleLanguageSandbox.vehicleLanguageApi.vehicleApplicationTextLabel("ハイゼット / アトレー") !== "Hijet / Atrai") {
  throw new Error("vehicle product names must not remain Japanese in Chinese mode");
}
const vehicleTableSource = sourceBetween("function renderVehicleApplicationsTable", "function openVehicleApplicationsDialog");
if (!vehicleTableSource.includes("renderVehicleApplicationText(row.model || row.vehicle_model || \"-\")")) {
  throw new Error("vehicle model values must use the shared language conversion");
}

const compatibleSource = sourceBetween("function renderKikanPartsList", "async function loadKikan");
if (compatibleSource.includes('updateSalesDetailTabCount("compatible"')) {
  throw new Error("compatible parts must not show a count badge");
}
if (compatibleSource.includes('tf("kikan_member_count"')) {
  throw new Error("the lower compatibility list must not show a result count");
}
if (!compatibleSource.includes("filterSalesVisibleProducts(parts_list || [])")) {
  throw new Error("cached compatible rows must not render Daiko products");
}
if (!compatibleSource.includes(".slice().sort(compareKikanParts)")) {
  throw new Error("compatible parts must be sorted after applying sales visibility");
}
if (!compatibleSource.includes("salesKikanTargetWraps(wrap)") ||
    !compatibleSource.includes("targetWraps.forEach(function(targetWrap)")) {
  throw new Error("compatible parts must render in the basic information panel");
}

const compatibleSortSource = sourceBetween("function kikanStockQtyText", "function renderKikanStockHtml");
const compatibleSortSandbox = {
  productVariantSummaryMap: {
    "1": { kinds: { rebuilt: { stockKnown: true, stockQty: 2 }, aftermarket_new: { stockKnown: true, stockQty: 3 } } },
    "2": { kinds: { rebuilt: { stockKnown: true, stockQty: 7 } } },
    "3": { kinds: { aftermarket_new: { stockKnown: true, stockQty: 5 } } }
  },
  productVariantSummaryCache: {},
  productDkdId: (product) => String(product && product.dkd_shohin_id || ""),
  normalizeProductKind: (kind) => kind
};
vm.createContext(compatibleSortSandbox);
vm.runInContext(`${compatibleSortSource}; this.compatibleSortApi = { kikanStockTotal, compareKikanParts };`, compatibleSortSandbox);
const compatibleRows = [
  { dkd_shohin_id: 1, genuine_part_number: "A-10", manufacturer_part_number: "M-1" },
  { dkd_shohin_id: 2, genuine_part_number: "Z-1", manufacturer_part_number: "M-2" },
  { dkd_shohin_id: 3, genuine_part_number: "A-2", manufacturer_part_number: "M-3" },
  { dkd_shohin_id: 4, genuine_part_number: "B-1", manufacturer_part_number: "M-4" }
];
const compatibleOrder = compatibleRows.slice().sort(compatibleSortSandbox.compatibleSortApi.compareKikanParts).map((row) => row.dkd_shohin_id).join(",");
if (compatibleSortSandbox.compatibleSortApi.kikanStockTotal(compatibleRows[0]) !== 5 || compatibleOrder !== "2,3,1,4") {
  throw new Error(`compatible parts sort order is invalid: ${compatibleOrder}`);
}

const compatibleTargetSource = sourceBetween("function salesKikanTargetWraps", "function renderKikanPartsList");
if (!compatibleTargetSource.includes("return primaryWrap ? [primaryWrap] : []") ||
    !compatibleTargetSource.includes("setSalesKikanWrapContent")) {
  throw new Error("compatibility rendering must use only its supplied basic-information target");
}

const compatibleLoadSource = sourceBetween("async function loadKikan(dkdShohinId", "function isImageVisibilitySchemaError");
if (!compatibleLoadSource.includes('document.getElementById("sales-basic-compatible-wrap")') ||
    !compatibleLoadSource.includes("await hydrateSalesDaikoVisibility(parts_list)") ||
    !compatibleLoadSource.includes("parts_list = filterSalesVisibleProducts(parts_list)")) {
  throw new Error("compatible rows must load into basic information and apply Daiko visibility");
}

[
  "grid-template-columns: minmax(0, 1fr) 320px",
  "#screen-search .sales-conditions-panel",
  "position: sticky",
  "justify-self: end",
  "grid-template-columns: 72px minmax(0, 1fr)",
  "grid-template-columns: 92px minmax(0, 1fr)",
  "font-variant-numeric: tabular-nums",
  ".detail-customer-price-focus:not(.empty) > strong",
  ".detail-customer-shipping-rule.separate > strong",
  ".detail-customer-shipping-rule.free > strong",
  "white-space: nowrap; overflow-wrap: normal; word-break: keep-all",
  ".sales-detail-tab-panel[hidden]",
  ".sales-basic-compatible",
  "align-items: stretch",
  "height: 43px",
  ".sales-detail-tab:focus-visible { outline: none; background: #eef4ff; color: #174ea6; }",
  "@media (max-width: 767px)"
].forEach((fragment) => {
  if (!css.includes(fragment)) throw new Error(`sales workspace styling is missing: ${fragment}`);
});
if (css.includes(".sales-basic-compatible-count")) {
  throw new Error("the lower compatibility section must not style a count badge");
}

const salesScreenStart = html.indexOf('<div id="screen-search"');
const nextScreenStart = html.indexOf('<div id="screen-', salesScreenStart + 1);
if (salesScreenStart < 0 || nextScreenStart < 0) {
  throw new Error("sales workspace markup could not be isolated");
}
const salesScreenHtml = html.slice(salesScreenStart, nextScreenStart);
if (salesScreenHtml.includes("見積に追加") || salesScreenHtml.includes("受注登録")) {
  throw new Error("sales workspace must not add unsupported quote or order actions");
}

console.log("sales detail workspace guard passed");
