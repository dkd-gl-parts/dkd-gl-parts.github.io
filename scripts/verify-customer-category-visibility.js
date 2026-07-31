const fs = require("fs");
const path = require("path");
const vm = require("vm");

const source = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");
const html = fs.readFileSync(path.resolve(__dirname, "..", "index.html"), "utf8");
const styles = fs.readFileSync(path.resolve(__dirname, "..", "styles.css"), "utf8");

function functionSource(name, nextName) {
  const start = source.indexOf(`function ${name}`);
  const asyncStart = source.indexOf(`async function ${name}`);
  const actualStart = start >= 0 && asyncStart >= 0 ? Math.min(start, asyncStart) : Math.max(start, asyncStart);
  const end = source.indexOf(nextName, actualStart + 1);
  if (actualStart < 0 || end < actualStart) throw new Error(`${name} could not be isolated`);
  return source.slice(actualStart, end);
}

const helperSource = functionSource("customerCategoryIsVisible", "function isCustomerVisibleProduct");
const expectedDefaultCategories = ["alternator", "generator", "starter", "starter_generator", "distributor", "ac_compressor"];
const defaultCategoryDeclaration = `var DEFAULT_CUSTOMER_VISIBLE_CATEGORY_CODES = ${JSON.stringify(expectedDefaultCategories)};`;
if (!source.replace(/\s+/g, "").includes(defaultCategoryDeclaration.replace(/\s+/g, ""))) {
  throw new Error("the six requested primary categories must remain the customer default");
}
const sandbox = { DEFAULT_CUSTOMER_VISIBLE_CATEGORY_CODES: expectedDefaultCategories };
vm.runInNewContext(`${helperSource}; result = customerCategoryIsVisible;`, sandbox);
const isVisible = sandbox.result;
expectedDefaultCategories.forEach((code) => {
  if (!isVisible(code, [])) throw new Error(`${code} must be visible by default`);
});
if (isVisible("radiator", [])) throw new Error("non-primary categories must be hidden by default");
if (!isVisible("radiator", [{ visibility_scope: "all", is_visible: true }])) throw new Error("an explicit show-all rule must override primary-category defaults");
if (isVisible("starter", [{ visibility_scope: "all", is_visible: false }])) throw new Error("all-scope hidden rule must hide categories by default");
if (!isVisible("starter", [
  { visibility_scope: "all", is_visible: false },
  { visibility_scope: "category", category_code: "starter", is_visible: true }
])) throw new Error("category rule must override the all-scope default");
if (isVisible("starter", [
  { visibility_scope: "all", is_visible: true },
  { visibility_scope: "category", category_code: "starter", is_visible: false }
])) throw new Error("hidden category rule must override the visible all-scope default");

const productVisibilitySource = functionSource("isCustomerVisibleProduct", "async function loadCustomerPortalContextForCustomer");
if (!productVisibilitySource.includes("customerCategoryIsVisible(category, rows)") ||
    productVisibilitySource.includes('visibility_scope === "product"')) {
  throw new Error("customer visibility must be controlled by categories without product exception rules");
}

const categoryUiSource = functionSource("customerAccessCategoryChecksHtml", "function renderCustomerAccessDetail");
if (!categoryUiSource.includes("data-customer-category") ||
    !categoryUiSource.includes("btn-customer-category-all") ||
    !categoryUiSource.includes("btn-customer-category-none")) {
  throw new Error("customer management must provide category checkboxes with select-all controls");
}

const detailSource = functionSource("renderCustomerAccessDetail", "function renderCustomerAccessRuleForm");
if (detailSource.includes("renderCustomerAccessRuleForm") || detailSource.includes("renderCustomerAccessRulesTable")) {
  throw new Error("the obsolete detailed visibility rule interface must not be shown");
}

if (!html.includes('id="customer-access-save-bar"') ||
    !html.includes('id="customer-access-save-state"') ||
    !html.includes('id="customer-access-save-help"') ||
    !html.includes('id="btn-customer-access-save"') ||
    !html.includes("変更を保存して得意先画面へ反映") ||
    !styles.includes(".customer-access-save-bar.unsaved")) {
  throw new Error("customer settings must have a prominent saved/unsaved status and save action");
}

const saveStateSource = functionSource("updateCustomerAccessSaveState", "function resetCustomerAccessSaveState");
if (!saveStateSource.includes("customerAccessHasUnsavedChanges()") ||
    !saveStateSource.includes('classList.toggle("unsaved"') ||
    !saveStateSource.includes("button.disabled = !dirty")) {
  throw new Error("the save action must remain disabled until display settings have unsaved changes");
}

const saveStateBlock = functionSource("customerAccessDisplayDraftSignature", "async function saveCustomerAccessCategoryVisibility");
const saveElements = {
  "customer-access-rank-select": { value: "A" },
  "customer-access-save-bar": { classList: { toggle: (_name, enabled) => { saveElements.unsaved = enabled; } } },
  "customer-access-save-state": { textContent: "" },
  "customer-access-save-help": { textContent: "" },
  "btn-customer-access-save": { textContent: "", disabled: true }
};
const saveSandbox = {
  currentCustomerAccessCustomer: { id: 1, price_rank_code: "A" },
  customerAccessSavedDisplayDraft: null,
  customerAccessSettingsSaving: false,
  draftSetting: false,
  collectCustomerDisplaySettings: () => ({ show_product_images: saveSandbox.draftSetting }),
  collectCustomerAccessCategoryVisibility: () => ({ starter: true }),
  document: { getElementById: (id) => saveElements[id] || null },
  t: (key) => key
};
vm.runInNewContext(`${saveStateBlock}; resetCustomerAccessSaveState(); result = { updateCustomerAccessSaveState, customerAccessHasUnsavedChanges };`, saveSandbox);
if (!saveElements["btn-customer-access-save"].disabled || saveElements.unsaved) {
  throw new Error("saved customer settings must start in a clean state with the save button disabled");
}
saveSandbox.draftSetting = true;
saveSandbox.result.updateCustomerAccessSaveState();
if (saveElements["btn-customer-access-save"].disabled || !saveElements.unsaved || !saveSandbox.result.customerAccessHasUnsavedChanges()) {
  throw new Error("changing a customer display setting must enable the save button and show an unsaved state");
}

const saveSource = functionSource("saveCustomerAccessCategoryVisibility", "async function saveCustomerAccessSettings");
if (!saveSource.includes('from("customer_product_visibility")') ||
    !saveSource.includes('visibility_scope", "category"') ||
    !saveSource.includes("usesDefaultSelection") ||
    !saveSource.includes("showsAllCategories") ||
    !saveSource.includes('visibility_scope: "all"')) {
  throw new Error("category selections must be persisted as customer category visibility rules");
}

const catalogSource = functionSource("populateCustomerCatalogCategories", "function renderCustomerCatalogShell");
if (!catalogSource.includes("customerCategoryIsVisible(code, visibilityRows)")) {
  throw new Error("hidden customer categories must not appear in the catalog category selector");
}

const searchSource = functionSource("runCustomerCatalogSearch", "function customerCatalogFact");
if (!searchSource.includes("if (!query && !category)") ||
    !searchSource.includes("fetchCategoryProducts(category") ||
    !searchSource.includes("filterVisibleProducts") ||
    searchSource.includes("search_text: null")) {
  throw new Error("customer product searches must require a visible category or query and must not load all products");
}

const settingsSaveSource = functionSource("saveCustomerAccessSettings", "async function setCustomerAccessActive");
if (!settingsSaveSource.includes("loadCustomerPortalContextForCustomer(updatedCustomer)") ||
    !settingsSaveSource.includes("customerAccessSettingsSaving = true") ||
    !settingsSaveSource.includes("updateCustomerAccessSaveState()")) {
  throw new Error("saving category visibility must show progress and refresh an active internal customer preview");
}

console.log("customer category visibility guard passed");
