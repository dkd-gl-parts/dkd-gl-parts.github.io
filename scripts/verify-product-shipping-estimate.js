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
if (!rateLoad.includes('from("customer_shipping_rates")') || !rateLoad.includes('.eq("is_active", true)')) {
  throw new Error("sales shipping estimates must use active shipping-master rows only");
}

const estimateRender = sourceBetween("function renderSalesShippingEstimate", "async function loadSalesShippingEstimateForCurrent");
[
  'id=\'sales-shipping-prefecture\'',
  'id=\'sales-shipping-carrier\'',
  'id=\'sales-shipping-service\'',
  'id=\'sales-shipping-package-size\'',
  't("sales_shipping_manual_size_note")',
  't("sales_shipping_weight_over")',
  "shippingFeeHtml(selectedRate.standard_fee_jpy, selectedRate.tax_type)",
  "shippingFeeHtml(selectedRate.remote_island_fee_jpy, selectedRate.tax_type)"
].forEach((fragment) => {
  if (!estimateRender.includes(fragment)) throw new Error(`sales shipping estimate is incomplete: ${fragment}`);
});

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

["product_shipping_section", "sales_shipping_estimate_title", "sales_shipping_manual_size_note"].forEach((key) => {
  const count = (source.match(new RegExp(`${key}:`, "g")) || []).length;
  if (count !== 3) throw new Error(`${key} must be translated for all supported languages`);
});

[
  ".product-form-shipping",
  ".sales-shipping-controls",
  ".sales-shipping-result",
  ".sales-shipping-message.warning",
  "@media (max-width: 430px)"
].forEach((fragment) => {
  if (!css.includes(fragment)) throw new Error(`shipping estimate styling is missing: ${fragment}`);
});

const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
if (duplicateIds.length) throw new Error(`duplicate HTML ids: ${[...new Set(duplicateIds)].join(", ")}`);

console.log("product shipping estimate guard passed");
