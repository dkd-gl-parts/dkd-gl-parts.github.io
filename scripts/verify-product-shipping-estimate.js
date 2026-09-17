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
  "pf-shipping-fields",
  "pf-shipping-weight",
  "pf-shipping-package-size",
  "sales-shipping-estimate-section",
  "sales-shipping-estimate-wrap"
].forEach((id) => {
  if (!html.includes(`id="${id}"`)) throw new Error(`shipping estimate control is missing: ${id}`);
});

const profileLoad = sourceBetween("async function fetchCoreProductShippingProfile", "function shippingProfileText");
if (!profileLoad.includes('from("core_products")') ||
    !profileLoad.includes("shipping_weight_kg,shipping_size_cm,shipping_package_size_label")) {
  throw new Error("product shipping profile must load all persisted fields from core_products");
}

const managementWeightLoad = sourceBetween("async function loadPartsMgmtShippingWeights", "function partsMgmtWeightText");
[
  'from("core_products")',
  '.select("dkd_shohin_id,shipping_weight_kg")',
  '.in("dkd_shohin_id", dkdIds)',
  "partsMgmtWeightLoadFailed = true",
  "row.shipping_weight_kg ="
].forEach((fragment) => {
  if (!managementWeightLoad.includes(fragment)) throw new Error(`product management weight lookup is incomplete: ${fragment}`);
});

const managementLoad = sourceBetween("async function loadPartsMgmt", "function renderPartsMgmt");
if ((managementLoad.match(/await loadPartsMgmtShippingWeights\(partsMgmtData\)/g) || []).length !== 2) {
  throw new Error("both product-management result paths must load product weights before rendering");
}
const managementEnter = sourceBetween("async function enterPartsMgmt", "async function loadPartsMgmtShippingWeights");
if (!managementEnter.includes('partsMgmtWeightSortDirection = ""')) {
  throw new Error("product management must begin with the existing unsorted result order");
}

const managementRender = sourceBetween("function renderPartsMgmt", "async function openPartForm");
[
  't("product_shipping_weight")',
  "partsMgmtWeightText(p.shipping_weight_kg)",
  "parts-mgmt-weight",
  "partsMgmtWeightLoadFailed",
  't("product_weight_list_load_failed")',
  "role='status'"
].forEach((fragment) => {
  if (!managementRender.includes(fragment)) throw new Error(`product management weight display is incomplete: ${fragment}`);
});

const managementWeightTextSource = sourceBetween("function partsMgmtWeightText", "async function loadPartsMgmt");
const managementWeightText = new Function(`${managementWeightTextSource}\nreturn partsMgmtWeightText;`)();
if (managementWeightText(null) !== "-" || managementWeightText("4.80") !== "4.8" || managementWeightText(-1) !== "-") {
  throw new Error("product management weight formatting must distinguish missing, valid, and invalid values");
}

const managementWeightSortSource = sourceBetween("function partsMgmtWeightNumber", "function partsMgmtWeightSortOrderLabel");
const managementWeightSort = new Function(`
  var partsMgmtData = [];
  var partsMgmtWeightSortDirection = "";
  ${managementWeightSortSource}
  return function(rows, direction) {
    partsMgmtData = rows;
    partsMgmtWeightSortDirection = direction;
    return partsMgmtRowsForDisplay();
  };
`)();
const managementWeightFixtures = [
  { code: "A", shipping_weight_kg: "4.8" },
  { code: "B", shipping_weight_kg: null },
  { code: "C", shipping_weight_kg: "3" },
  { code: "D", shipping_weight_kg: "4.80" },
  { code: "E", shipping_weight_kg: "invalid" }
];
if (managementWeightSort(managementWeightFixtures, "").map((row) => row.code).join("") !== "ABCDE" ||
    managementWeightSort(managementWeightFixtures, "ascending").map((row) => row.code).join("") !== "CADBE" ||
    managementWeightSort(managementWeightFixtures, "descending").map((row) => row.code).join("") !== "ADCBE") {
  throw new Error("product management weight sorting must preserve the default order, remain stable, and keep missing values last");
}
if (managementWeightFixtures.map((row) => row.code).join("") !== "ABCDE") {
  throw new Error("product management weight sorting must not mutate the source rows");
}

[
  "partsMgmtRowsForDisplay().forEach",
  "data-parts-weight-sort",
  "aria-sort='",
  "partsMgmtWeightSortActionLabel()",
  "partsMgmtWeightSortOrderLabel()",
  'weightSortButton.addEventListener("click", togglePartsMgmtWeightSort)'
].forEach((fragment) => {
  if (!managementRender.includes(fragment)) throw new Error(`product management weight sorting is incomplete: ${fragment}`);
});
const managementWeightSortActions = sourceBetween("function partsMgmtWeightSortOrderLabel", "async function loadPartsMgmt");
if (!managementWeightSortActions.includes('partsMgmtWeightSortDirection === "ascending" ? "descending" : "ascending"') ||
    !managementWeightSortActions.includes("renderPartsMgmt();")) {
  throw new Error("product management weight sort toggle is incomplete");
}

const formMode = sourceBetween("function setProductFormFieldMode", "function setCoreProductFormFields");
[
  'document.getElementById("pf-shipping-fields")',
  'document.getElementById("pf-shipping-weight")',
  'document.getElementById("pf-shipping-package-size")',
  'source === "parts" && !isAdd',
  'partFormShippingProfileState === "available"',
  'setCspStyle(shippingFields, "display", showShippingFields ? "" : "none")',
  'input.disabled = !enableShippingFields',
  '"product_shipping_loading"',
  '"product_shipping_unlinked"',
  '"product_shipping_load_failed"'
].forEach((fragment) => {
  if (!formMode.includes(fragment)) throw new Error(`product shipping form mode is incomplete: ${fragment}`);
});

const partFormOpen = sourceBetween("async function openPartForm", "async function savePartForm");
[
  "fetchCoreProductShippingProfile(dkdId)",
  "populateProductShippingSizeSelect(shippingProfile)",
  'if (!shippingSizesLoaded)',
  'partFormShippingProfileState = "available"',
  'setProductFormFieldMode("parts", mode)'
].forEach((fragment) => {
  if (!partFormOpen.includes(fragment)) throw new Error(`parts product edit must load shipping information: ${fragment}`);
});

const partFormSave = sourceBetween("async function savePartForm", "async function enterCoreListMgmt");
[
  'partFormShippingProfileState === "available"',
  'partFormShippingProfileState === "loading"',
  "shipping_weight_kg: shippingFormValue.shipping_weight_kg",
  "shipping_size_cm: shippingFormValue.shipping_size_cm",
  "shipping_package_size_label: shippingFormValue.shipping_package_size_label",
  'from("core_products")',
  '.eq("dkd_shohin_id", dkdId)',
  't("product_shipping_save_failed")'
].forEach((fragment) => {
  if (!partFormSave.includes(fragment)) throw new Error(`parts product edit must save shipping information: ${fragment}`);
});

const formOpen = sourceBetween("async function openCoreProductForm", "async function openCoreProductAddFromSearch");
if (!formOpen.includes("fetchCoreProductShippingProfile") || !formOpen.includes("populateProductShippingSizeSelect")) {
  throw new Error("product edit must load the saved profile and active package sizes");
}

const formSave = sourceBetween("async function saveCoreProductForm", "async function deletePart");
[
  "payload.shipping_weight_kg = shippingFormValue.shipping_weight_kg",
  "payload.shipping_size_cm = shippingFormValue.shipping_size_cm",
  "payload.shipping_package_size_label = shippingFormValue.shipping_package_size_label"
].forEach((fragment) => {
  if (!formSave.includes(fragment)) throw new Error(`product shipping save field is missing: ${fragment}`);
});

const rateLoad = sourceBetween("async function ensureSalesShippingRateRows", "async function fetchCoreProductShippingProfile");
if (!rateLoad.includes("fetchAllShippingRateRows(") || !rateLoad.includes("true")) {
  throw new Error("sales shipping estimates must use active shipping-master rows only");
}
const pagedRateLoad = sourceBetween("async function fetchAllShippingRateRows", "async function ensureSalesShippingRateRows");
if (!pagedRateLoad.includes('.range(from, from + SHIPPING_RATE_PAGE_SIZE - 1)') ||
    !pagedRateLoad.includes('if (activeOnly) query = query.eq("is_active", true)')) {
  throw new Error("sales shipping estimates must fetch every active shipping-master page");
}

const estimateRender = sourceBetween("function renderSalesShippingEstimate", "async function loadSalesShippingEstimateForCurrent");
[
  'id=\'sales-shipping-prefecture\'',
  'id=\'sales-shipping-carrier\'',
  'id=\'sales-shipping-service\'',
  'id=\'sales-shipping-package-size\'',
  't("sales_shipping_manual_size_note")',
  't("sales_shipping_weight_size_note")',
  't("sales_shipping_weight_over")',
  "shippingFeeHtml(selectedRate.standard_fee_jpy, selectedRate.tax_type)",
  "shippingFeeHtml(selectedRate.remote_island_fee_jpy, selectedRate.tax_type)"
].forEach((fragment) => {
  if (!estimateRender.includes(fragment)) throw new Error(`sales shipping estimate is incomplete: ${fragment}`);
});
const destinationControl = estimateRender.indexOf("id='sales-shipping-prefecture'");
const sizeControl = estimateRender.indexOf("id='sales-shipping-package-size'");
const carrierControl = estimateRender.indexOf("id='sales-shipping-carrier'");
if (!(destinationControl >= 0 && sizeControl > destinationControl && carrierControl > sizeControl)) {
  throw new Error("shipping estimate must group destination and package size before carrier details");
}

const estimateVisibility = sourceBetween("function salesShippingEstimateShouldShow", "function bindSalesShippingEstimateActions");
if (!estimateVisibility.includes('detailCustomerShippingChargeRule !== "free"') ||
    !estimateVisibility.includes("updateSalesShippingEstimateVisibility")) {
  throw new Error("free-shipping customers must not be shown a separate shipping estimate");
}

const weightPackageMatch = sourceBetween("function salesShippingPackageFromWeight", "function bindSalesShippingEstimateActions");
[
  "Number(row.max_weight_kg) >= weight",
  "Number(a.max_weight_kg) - Number(b.max_weight_kg)",
  "weightedPackages[weightedPackages.length - 1]"
].forEach((fragment) => {
  if (!weightPackageMatch.includes(fragment)) throw new Error(`weight-based package matching is incomplete: ${fragment}`);
});
const weightPackageFn = new Function(`${weightPackageMatch}\nreturn salesShippingPackageFromWeight;`)();
const weightFixtures = [
  { package_size_label: "100", max_size_cm: 100, max_weight_kg: 10 },
  { package_size_label: "60", max_size_cm: 60, max_weight_kg: 2 },
  { package_size_label: "80", max_size_cm: 80, max_weight_kg: 5 }
];
if (weightPackageFn(weightFixtures, 4.5).package_size_label !== "80" ||
    weightPackageFn(weightFixtures, 1).package_size_label !== "60" ||
    weightPackageFn(weightFixtures, 12).package_size_label !== "100") {
  throw new Error("weight-based package matching must choose the smallest eligible tier and retain the largest tier for the overweight warning");
}
if (!estimateRender.includes("|| savedPackage || weightPackage") ||
    !estimateRender.includes("!profileHasSize && profileWeight != null")) {
  throw new Error("weight-only products must automatically select a compatible service and package size");
}

const panelRender = sourceBetween("function renderPanelStatic", "async function loadProductVariantsForCurrent");
if (!panelRender.includes("loadSalesShippingEstimateForCurrent(detailSeq)")) {
  throw new Error("sales detail must load the shipping estimate with its secondary data");
}

if (!source.includes("Number(salesShippingProfile.shipping_weight_kg) > Number(selectedPackage.max_weight_kg)")) {
  throw new Error("saved package weight must be checked against the shipping-master limit");
}
if (!source.includes("productShippingSizeRows.push(selected)")) {
  throw new Error("saved package sizes must be retained when the current master no longer contains them");
}

["product_shipping_section", "product_shipping_weight", "product_shipping_loading", "product_shipping_unlinked", "product_shipping_load_failed", "product_weight_list_load_failed", "product_weight_sort_ascending", "product_weight_sort_descending", "product_weight_sort_ascending_action", "product_weight_sort_descending_action", "product_shipping_save_failed", "sales_shipping_estimate_title", "sales_shipping_manual_size_note", "sales_shipping_weight_size_note"].forEach((key) => {
  const count = (source.match(new RegExp(`${key}:`, "g")) || []).length;
  if (count !== 3) throw new Error(`${key} must be translated for all supported languages`);
});
if (!source.includes('product_shipping_weight: "商品重量 (kg)"') ||
    !html.includes('data-i18n="product_shipping_weight">商品重量 (kg)</label>') ||
    source.includes('product_shipping_weight: "梱包重量 (kg)"') ||
    html.includes('data-i18n="product_shipping_weight">梱包重量 (kg)</label>')) {
  throw new Error("shipping profile must identify the saved value as product-only weight");
}
if (!source.includes('sales_shipping_estimate_title: "登録済み品番の送料試算"') ||
    !html.includes('data-i18n="sales_shipping_estimate_title">登録済み品番の送料試算</div>')) {
  throw new Error("registered-product shipping estimate must use one clear section title");
}

const customerSectionIndex = html.indexOf('id="detail-customer-section"');
const shippingSectionIndex = html.indexOf('id="sales-shipping-estimate-section"');
const productTermsIndex = html.indexOf('class="detail-sales-terms-panel sales-conditions-terms"');
if (customerSectionIndex < 0 || shippingSectionIndex < customerSectionIndex || productTermsIndex < shippingSectionIndex) {
  throw new Error("shipping estimates must sit directly below the customer price before product and core terms");
}

[
  ".product-form-shipping",
  ".sales-shipping-controls",
  ".sales-shipping-size-control { grid-column: auto; }",
  ".sales-shipping-result",
  ".sales-shipping-message.warning",
  "@media (max-width: 430px)"
].forEach((fragment) => {
  if (!css.includes(fragment)) throw new Error(`shipping estimate styling is missing: ${fragment}`);
});

[
  "#screen-parts-mgmt .mgmt-body { max-width: 1160px; }",
  "#parts-mgmt-list { overflow-x: auto;",
  "#parts-mgmt-list .parts-mgmt-table { min-width: 1040px; }",
  ".parts-mgmt-table .parts-mgmt-weight",
  ".parts-mgmt-weight-sort",
  ".parts-mgmt-weight-sort:focus-visible",
  ".parts-mgmt-weight-sort-order",
  ".parts-mgmt-weight-error",
  "@media (max-width: 760px)"
].forEach((fragment) => {
  if (!css.includes(fragment)) throw new Error(`product management weight layout is missing: ${fragment}`);
});

const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
if (duplicateIds.length) throw new Error(`duplicate HTML ids: ${[...new Set(duplicateIds)].join(", ")}`);

const specSectionIndex = html.indexOf('aria-labelledby="product-form-spec-title"');
const sourceNoteIndex = html.indexOf('id="sf-source-note"', specSectionIndex);
const shippingFieldsIndex = html.indexOf('id="pf-shipping-fields"', specSectionIndex);
if (specSectionIndex < 0 || sourceNoteIndex < 0 || shippingFieldsIndex < sourceNoteIndex) {
  throw new Error("product shipping fields must balance the edit form below the nominal-output fields");
}

[
  "@media(max-height:900px) and (min-width:961px)",
  ".product-form-core-policy,",
  ".product-form-shipping { margin-top: 10px; padding-top: 10px; }",
  ".product-form-shipping-grid { margin-top: 7px; }"
].forEach((fragment) => {
  if (!css.includes(fragment)) throw new Error(`compact product edit layout is missing: ${fragment}`);
});

console.log("product shipping estimate guard passed");
