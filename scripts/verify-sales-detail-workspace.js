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
  'id="sales-product-identity"',
  'data-sales-detail-tab="basic"',
  'data-sales-detail-tab="vehicles"',
  'data-sales-detail-tab="compatible"',
  'data-sales-detail-tab="components"',
  'data-sales-detail-tab="images"',
  'id="detail-customer-wrap"',
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

const searchResultSource = sourceBetween("function render()", "function openPanel");
if (!searchResultSource.includes("renderProductKindPills(kindSummary, { compact: true })")) {
  throw new Error("search result product-kind labels must remain compact");
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

const vehicleSource = sourceBetween("async function loadCatalogVehicleSummary", "function renderGltekPartNumberRow");
if (!vehicleSource.includes('document.getElementById("detail-vehicle-tab-content")') || !vehicleSource.includes('updateSalesDetailTabCount("vehicles"')) {
  throw new Error("vehicle applications must render in the detail tab with a count");
}

const compatibleSource = sourceBetween("function renderKikanPartsList", "async function loadKikan");
if (!compatibleSource.includes('updateSalesDetailTabCount("compatible", parts_list.length)')) {
  throw new Error("compatible parts must update their tab count");
}

[
  "grid-template-columns: minmax(0, 1fr) 340px",
  "#screen-search .sales-conditions-panel",
  "position: sticky",
  "font-variant-numeric: tabular-nums",
  ".detail-customer-price-focus:not(.empty) > strong",
  ".sales-detail-tab-panel[hidden]",
  "@media (max-width: 767px)"
].forEach((fragment) => {
  if (!css.includes(fragment)) throw new Error(`sales workspace styling is missing: ${fragment}`);
});

if (html.includes("見積に追加") || html.includes("受注登録")) {
  throw new Error("sales workspace must not add unsupported quote or order actions");
}

console.log("sales detail workspace guard passed");
