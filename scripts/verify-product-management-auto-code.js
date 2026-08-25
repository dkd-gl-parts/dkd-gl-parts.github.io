const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");

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

console.log("Product management automatic product-code issuance verified.");
