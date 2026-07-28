const fs = require("fs");
const path = require("path");
const vm = require("vm");

const source = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");

function functionSource(name, nextName) {
  const start = source.indexOf(`function ${name}`);
  const asyncStart = source.indexOf(`async function ${name}`);
  const actualStart = start >= 0 && asyncStart >= 0 ? Math.min(start, asyncStart) : Math.max(start, asyncStart);
  const end = source.indexOf(nextName, actualStart + 1);
  if (actualStart < 0 || end < actualStart) throw new Error(`${name} could not be isolated`);
  return source.slice(actualStart, end);
}

const helperSource = functionSource("customerCategoryIsVisible", "function isCustomerVisibleProduct");
const sandbox = {};
vm.runInNewContext(`${helperSource}; result = customerCategoryIsVisible;`, sandbox);
const isVisible = sandbox.result;
if (!isVisible("starter", [])) throw new Error("categories must be visible when no customer rules exist");
if (isVisible("starter", [{ visibility_scope: "all", is_visible: false }])) throw new Error("all-scope hidden rule must hide categories by default");
if (!isVisible("starter", [
  { visibility_scope: "all", is_visible: false },
  { visibility_scope: "category", category_code: "starter", is_visible: true }
])) throw new Error("category rule must override the all-scope default");
if (isVisible("starter", [
  { visibility_scope: "all", is_visible: true },
  { visibility_scope: "category", category_code: "starter", is_visible: false }
])) throw new Error("hidden category rule must override the visible all-scope default");

const categoryUiSource = functionSource("customerAccessCategoryChecksHtml", "function renderCustomerAccessDetail");
if (!categoryUiSource.includes("data-customer-category") ||
    !categoryUiSource.includes("btn-customer-category-all") ||
    !categoryUiSource.includes("btn-customer-category-none")) {
  throw new Error("customer management must provide category checkboxes with select-all controls");
}

const saveSource = functionSource("saveCustomerAccessCategoryVisibility", "async function saveCustomerAccessSettings");
if (!saveSource.includes('from("customer_product_visibility")') ||
    !saveSource.includes('visibility_scope", "category"') ||
    !saveSource.includes("selectedCodes.length < codes.length") ||
    !saveSource.includes('visibility_scope: "all"')) {
  throw new Error("category selections must be persisted as customer category visibility rules");
}

const catalogSource = functionSource("populateCustomerCatalogCategories", "function renderCustomerCatalogShell");
if (!catalogSource.includes("customerCategoryIsVisible(code, visibilityRows)")) {
  throw new Error("hidden customer categories must not appear in the catalog category selector");
}

const searchSource = functionSource("runCustomerCatalogSearch", "function customerCatalogFact");
if (!searchSource.includes("customerCatalogRestrictedCategoryCodes()") ||
    !searchSource.includes("fetchCustomerCatalogCategoryScopeProducts")) {
  throw new Error("customer product lists must query only the allowed category scope");
}

const settingsSaveSource = functionSource("saveCustomerAccessSettings", "async function setCustomerAccessActive");
if (!settingsSaveSource.includes("loadCustomerPortalContextForCustomer(updatedCustomer)")) {
  throw new Error("saving category visibility must refresh an active internal customer preview");
}

console.log("customer category visibility guard passed");
