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

const formMode = sourceBetween("function setProductFormFieldMode", "function setCoreProductFormFields");
[
  'document.getElementById("pf-shipping-fields")',
  'document.getElementById("pf-shipping-weight")',
  'document.getElementById("pf-shipping-package-size")',
  't(isAdd ? "product_shipping_add_help" : "product_shipping_help")'
].forEach((fragment) => {
  if (!formMode.includes(fragment)) throw new Error(`product shipping form mode is incomplete: ${fragment}`);
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

["product_shipping_section", "sales_shipping_estimate_title", "sales_shipping_manual_size_note", "sales_shipping_weight_size_note"].forEach((key) => {
  const count = (source.match(new RegExp(`${key}:`, "g")) || []).length;
  if (count !== 3) throw new Error(`${key} must be translated for all supported languages`);
});

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
