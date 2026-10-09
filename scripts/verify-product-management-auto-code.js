const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8").replace(/\r\n/g, "\n");

const productFormHeader = html.slice(
  html.indexOf('<div class="product-form-header">'),
  html.indexOf('<div class="product-form-layout">')
);
if (!productFormHeader.includes('id="part-form-error" role="alert"')) {
  throw new Error("Product form error must be announced directly below the dialog title");
}
if ((html.match(/id="part-form-error"/g) || []).length !== 1) {
  throw new Error("Product form must have exactly one error region");
}
for (const fragment of [
  ".product-form-header {\n  position: sticky;\n  top: 0;",
  ".product-form-error:not(:empty) {",
  "overflow-wrap: anywhere;"
]) {
  if (!css.includes(fragment)) throw new Error(`Product form error visibility is incomplete: ${fragment}`);
}

function sourceBetween(startText, endText) {
  const start = source.indexOf(startText);
  const end = source.indexOf(endText, start + startText.length);
  if (start < 0 || end < start) throw new Error(`${startText} could not be isolated`);
  return source.slice(start, end);
}

const managementOpen = sourceBetween(
  "async function openCoreProductAddFromManagement",
  "async function openCoreProductEditFromSearch"
);
if (!managementOpen.includes('openCoreProductForm("add", null, "management")')) {
  throw new Error("product management add must use the auto-numbered core product form");
}

const salesOpen = sourceBetween("async function openCoreProductAddFromSearch", "async function openCoreProductAddFromProduction");
if (!salesOpen.includes('openCoreProductForm("add", null, "sales")') || salesOpen.includes("currentProduct")) {
  throw new Error("sales search product add must open a blank form, not copy the selected product");
}
const productionOpen = sourceBetween("async function openCoreProductAddFromProduction", "async function openCoreProductAddFromManagement");
if (!productionOpen.includes('openCoreProductForm("add", currentProductionRow || null, "production")')) {
  throw new Error("production product add must retain its explicit base-product behavior");
}

const fieldsSource = sourceBetween("function setCoreProductFormFields", "async function openCoreProductForm");
const fields = new Map();
const fieldSandbox = {
  partFormMode: "add",
  document: { getElementById(id) {
    if (!fields.has(id)) fields.set(id, { value: "old value" });
    return fields.get(id);
  } },
  isDksManagedManufacturer: () => false,
  productDkdId: product => product.dkd_shohin_id,
  formValueFromCategoryCode: code => code || "Alternator",
  initializeCoreProductStampPairForm() {},
  setGltekProductAddPanel() {}
};
require("vm").runInNewContext(fieldsSource, fieldSandbox);
fieldSandbox.setCoreProductFormFields(null);
for (const id of [
  "part-form-id", "pf-gltek-base-product-id", "pf-shohin-cd", "pf-genuine-pn", "pf-genuine-pn2",
  "pf-mfr-pn", "pf-mfr", "pf-vehicle-mfr", "pf-body-type", "pf-compatible", "pf-model",
  "pf-shipping-weight", "pf-gltek-base-code", "pf-gltek-category-code"
]) {
  if (fields.get(id).value !== "") throw new Error(`Blank product add retained ${id}`);
}
if (fields.get("pf-category").value !== "Alternator" || fields.get("pf-part-manufacturer-type").value !== "external") {
  throw new Error("Blank product add retained category or manufacturer mode from the selected record");
}
const formOpen = sourceBetween("async function openCoreProductForm", "async function openCoreProductAddFromSearch");
if (!formOpen.includes('mode === "add" && coreProductFormContext === "sales" ? "rebuilt" : currentSelectedProductKind')) {
  throw new Error("Sales product add must not inherit the selected record's product kind");
}
const policyKinds = sourceBetween("function coreProductPolicyFormKinds", "function setCoreProductPolicyReturnState");
if (!policyKinds.includes('return ["rebuilt", "aftermarket_new"]')) {
  throw new Error("Blank sales product add must allow either product kind");
}
const policySandbox = {
  partFormMode: "add",
  coreProductFormContext: "sales",
  normalizeProductKind: value => value || "rebuilt",
  productKindSortValue: kind => kind === "rebuilt" ? 0 : 1
};
require("vm").runInNewContext(policyKinds, policySandbox);
const salesKinds = policySandbox.coreProductPolicyFormKinds(null, [], "rebuilt");
if (JSON.stringify(Array.from(salesKinds)) !== JSON.stringify(["rebuilt", "aftermarket_new"])) {
  throw new Error("Blank sales product add did not offer both product kinds");
}
policySandbox.coreProductFormContext = "production";
const productionKinds = policySandbox.coreProductPolicyFormKinds(null, [], "rebuilt");
if (JSON.stringify(Array.from(productionKinds)) !== JSON.stringify(["rebuilt"])) {
  throw new Error("Production product add policy kinds changed unexpectedly");
}

if (!source.includes('document.getElementById("btn-add-part").addEventListener("click", openCoreProductAddFromManagement)')) {
  throw new Error("product management add button still uses the legacy parts form");
}

const coreSave = sourceBetween("async function saveCoreProductForm", "async function deletePart");
if (!coreSave.includes('sb.from("core_products").insert(payload).select("dkd_shohin_id,edit_version").single()')) {
  throw new Error("new products must return the database-generated product code");
}
if (!coreSave.includes('currentProduct = Object.assign({}, payload, { dkd_shohin_id: dkd, id: dkd })')) {
  throw new Error("New product state must not inherit fields from the previously selected product");
}
if (!coreSave.includes('formContext === "management"') || !coreSave.includes("await loadPartsMgmt()")) {
  throw new Error("product management must remain visible after an auto-numbered save");
}

const managementLoad = sourceBetween("async function loadPartsMgmt", "function renderPartsMgmt");
if (!managementLoad.includes('.eq("dkd_shohin_id", coreId)') || !managementLoad.includes("coreProduct._coreManaged = true")) {
  throw new Error("a newly issued product code must be searchable from product management");
}

if (html.includes("product-form-required-note")) {
  throw new Error("the detached required-fields badge must not be shown");
}
const eitherRequiredMarkers = html.match(/data-i18n="product_part_number_either_required"/g) || [];
if (eitherRequiredMarkers.length !== 2) {
  throw new Error("genuine and manufacturer part numbers must each show the either-required marker");
}
for (const fieldId of ["pf-genuine-pn", "pf-mfr-pn"]) {
  if (!html.includes(`class="form-label product-form-required-label" for="${fieldId}"`)) {
    throw new Error(`${fieldId} must be directly associated with its required marker`);
  }
}
if (!css.includes(".product-form-either-required") || css.includes(".product-form-required-note")) {
  throw new Error("product form required-marker styling is incomplete");
}
for (const translation of ["いずれか必須", "Either required", "二者选一必填"]) {
  if (!source.includes(`product_part_number_either_required: "${translation}"`)) {
    throw new Error(`required-marker translation is missing: ${translation}`);
  }
}
if (!coreSave.includes("validateProductPartNumberPair(genuine, mfrPart)")) {
  throw new Error("shared part-number validation must remain enforced");
}
if (!coreSave.includes('showDcatsAutoNotice(gltekAutoIssueFailureText(gltekAutoIssueContext, gltekAutoIssueOutcome.error), 2400, "warning")')) {
  throw new Error("a G-number issuance warning must dismiss automatically after the product save succeeds");
}
if (coreSave.includes("alert(gltekAutoIssueFailureText(gltekAutoIssueContext")) {
  throw new Error("a non-blocking G-number issuance warning must not use a browser alert");
}
if (!css.includes(".dcats-auto-notice.warning")) {
  throw new Error("the auto-dismiss G-number issuance warning is not visually distinguished");
}

console.log("Product management automatic product-code issuance verified.");
