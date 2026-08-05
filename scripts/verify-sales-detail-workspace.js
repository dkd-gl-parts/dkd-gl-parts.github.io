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
  'data-sales-detail-tab="compatible"',
  'data-sales-detail-tab="components"',
  'data-sales-detail-tab="images"',
  'id="detail-customer-wrap"',
  'id="sales-shipping-estimate-section"',
  'id="product-kind-wrap"',
  'id="core-return-policy-wrap"',
  'id="ec-mall-price-summary-wrap"',
  'class="panel-right sales-conditions-panel"'
].forEach((fragment) => {
  if (!html.includes(fragment)) throw new Error(`sales workspace markup is missing: ${fragment}`);
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

const panelSource = sourceBetween("function renderPanelStatic", "async function loadProductVariantsForCurrent");
[
  'currentSelectedProductKind = "rebuilt"',
  'renderSalesProductIdentity(p)',
  'renderCatalogVehicleSummaryHtml("", { showButton: false })',
  'loadDetailCustomerInfoForCurrent(detailSeq)',
  'loadEcMallPriceSummaryForCurrent(detailSeq)',
  'loadCatalogVehicleSummary(document.getElementById("panel-body"), p)',
  'loadKikanForCurrentProduct(detailSeq)'
].forEach((fragment) => {
  if (!panelSource.includes(fragment)) throw new Error(`sales detail data flow is missing: ${fragment}`);
});

const kindSwitchSource = sourceBetween("function bindProductKindPanelActions", "async function fetchProductVariantSummaryMap");
[
  "updateSalesProductStatusBadges()",
  "renderImagesLoading()",
  "loadImages(null, detailSecondaryRequestSeq)",
  "loadDetailCustomerInfoForCurrent(detailSecondaryRequestSeq)"
].forEach((fragment) => {
  if (!kindSwitchSource.includes(fragment)) throw new Error(`product-kind switching is incomplete: ${fragment}`);
});

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

const compatibleSource = sourceBetween("function renderKikanPartsList", "async function loadKikan");
if (!compatibleSource.includes('updateSalesDetailTabCount("compatible", parts_list.length)')) {
  throw new Error("compatible parts must update their tab count");
}
if (!compatibleSource.includes("filterSalesVisibleProducts(parts_list || [])")) {
  throw new Error("cached compatible rows must not render Daiko products");
}

const compatibleLoadSource = sourceBetween("async function loadKikan(dkdShohinId", "function isImageVisibilitySchemaError");
if (!compatibleLoadSource.includes("await hydrateSalesDaikoVisibility(parts_list)") ||
    !compatibleLoadSource.includes("parts_list = filterSalesVisibleProducts(parts_list)")) {
  throw new Error("compatible rows must resolve and apply Daiko visibility before rendering");
}

[
  "grid-template-columns: minmax(0, 1fr) 340px",
  "#screen-search .sales-conditions-panel",
  "position: sticky",
  "font-variant-numeric: tabular-nums",
  ".detail-customer-price-focus:not(.empty) > strong",
  ".detail-customer-shipping-rule.separate > strong",
  ".detail-customer-shipping-rule.free > strong",
  "white-space: nowrap; overflow-wrap: normal; word-break: keep-all",
  ".sales-detail-tab-panel[hidden]",
  "align-items: stretch",
  "height: 43px",
  ".sales-detail-tab:focus-visible { outline: none; background: #eef4ff; color: #174ea6; }",
  "@media (max-width: 767px)"
].forEach((fragment) => {
  if (!css.includes(fragment)) throw new Error(`sales workspace styling is missing: ${fragment}`);
});

if (html.includes("見積に追加") || html.includes("受注登録")) {
  throw new Error("sales workspace must not add unsupported quote or order actions");
}

console.log("sales detail workspace guard passed");
