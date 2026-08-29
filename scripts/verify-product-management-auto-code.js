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

const managementOpen = sourceBetween(
  "async function openCoreProductAddFromManagement",
  "async function openCoreProductEditFromSearch"
);
if (!managementOpen.includes('openCoreProductForm("add", null, "management")')) {
  throw new Error("product management add must use the auto-numbered core product form");
}

if (!source.includes('document.getElementById("btn-add-part").addEventListener("click", openCoreProductAddFromManagement)')) {
  throw new Error("product management add button still uses the legacy parts form");
}

const coreSave = sourceBetween("async function saveCoreProductForm", "async function deletePart");
if (!coreSave.includes('sb.from("core_products").insert(payload).select("dkd_shohin_id").single()')) {
  throw new Error("new products must return the database-generated product code");
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

console.log("Product management automatic product-code issuance verified.");
