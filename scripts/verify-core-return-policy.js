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

const policySource = sourceBetween("function coreReturnRequiredDefault", "function imageProductKindOptions");
const policySandbox = {
  normalizeProductKind(kind) { return String(kind || "rebuilt").toLowerCase(); },
  formatYen(value) { return Number(value).toLocaleString("en-US"); },
  t(key) { return key; },
  esc(value) { return String(value); }
};
vm.runInNewContext(`${policySource}; result = { requiredDefault: coreReturnRequiredDefault, policy: coreReturnPolicyForKind, render: renderCoreReturnPolicyHtml };`, policySandbox);

if (!policySandbox.result.requiredDefault("rebuilt")) throw new Error("rebuilt must require core return by default");
if (policySandbox.result.requiredDefault("aftermarket_new")) throw new Error("aftermarket new must not require core return by default");
if (policySandbox.result.policy("rebuilt", []).required !== true) throw new Error("missing rebuilt policy must keep the rebuilt default");
if (policySandbox.result.policy("aftermarket_new", []).required !== false) throw new Error("missing aftermarket policy must keep the no-return default");
const productionPolicyHtml = policySandbox.result.render("rebuilt", [], { compact: true, vertical: true, showTitle: false, showCharge: false });
if (!productionPolicyHtml.includes("core_return_required_label") || productionPolicyHtml.includes("core_charge_short")) {
  throw new Error("manufacturing core terms must show core return without the core charge");
}
const standardPolicyHtml = policySandbox.result.render("rebuilt", [], { compact: true, vertical: true, showTitle: false });
if (!standardPolicyHtml.includes("core_charge_short")) {
  throw new Error("core charge must remain visible outside manufacturing detail");
}

const costSource = sourceBetween("function manufacturingCostCoreCostForProduct", "function manufacturingCostCoreCostForCategory");
const costSandbox = {
  manufacturingCostCorePolicyMap: {},
  manufacturingCostSettings() { return {}; },
  normalizeProductKind: policySandbox.normalizeProductKind,
  productDkdId(product) { return product.dkd_shohin_id; },
  manufacturingCostProductCategory(product) { return product.category_code || ""; },
  coreReturnPolicyForKind: policySandbox.result.policy
};
vm.runInNewContext(`${costSource}; result = manufacturingCostCoreCostForProduct;`, costSandbox);
const product = { dkd_shohin_id: 100, category_code: "starter" };
const settings = { productKind: "rebuilt", coreCost: 1500, categoryCoreCosts: { starter: 2000 } };

costSandbox.manufacturingCostCorePolicyMap["100"] = { product_kind: "rebuilt", core_return_required: true, core_charge_jpy: 4800 };
let cost = costSandbox.result(product, settings);
if (cost.amount !== 4800 || cost.source !== "product") throw new Error("product core charge must take priority");

costSandbox.manufacturingCostCorePolicyMap["100"] = { product_kind: "rebuilt", core_return_required: true, core_charge_jpy: null };
cost = costSandbox.result(product, settings);
if (cost.amount !== 2000 || cost.source !== "category") throw new Error("an unset product charge must fall back to the category charge");

costSandbox.manufacturingCostCorePolicyMap["100"] = { product_kind: "rebuilt", core_return_required: false, core_charge_jpy: 4800 };
cost = costSandbox.result(product, settings);
if (cost.amount !== 0 || cost.returnRequired !== false) throw new Error("a no-return product must have zero core cost");

delete costSandbox.manufacturingCostCorePolicyMap["100"];
cost = costSandbox.result(product, { productKind: "aftermarket_new", coreCost: 1500, categoryCoreCosts: { starter: 2000 } });
if (cost.amount !== 0 || cost.source !== "kind_default") throw new Error("aftermarket new must default to no return and zero core cost");

[
  "pf-core-policy-kind",
  "pf-core-return-required",
  "pf-core-charge"
].forEach((fragment) => {
  if (!html.includes(fragment)) throw new Error(`core return form control is missing: ${fragment}`);
});

[
  "detail-sales-terms-grid",
  "detail-sales-terms-panel",
  "detail-sales-overview-grid",
  ".detail-sales-overview-grid > .ec-mall-summary-block",
  "width: min(100%, 280px)",
  "grid-template-columns: 132px minmax(0, 1fr)",
  ".detail-sales-terms-panel .core-return-policy-panel.vertical .core-return-policy-item",
  "core-return-badge.required",
  "core-return-badge.not-required",
  "production-core-policy-row",
  ".core-return-policy-panel.vertical .core-return-policy-grid"
].forEach((fragment) => {
  if (!css.includes(fragment)) throw new Error(`core return style is missing: ${fragment}`);
});

const saveSource = sourceBetween("async function saveCoreProductPolicyForDkd", "function setProductFormFieldMode");
[
  '.eq("dkd_shohin_id", dkd)',
  '.eq("product_kind", formValue.kind)',
  "core_return_required: formValue.required",
  "core_charge_jpy: formValue.charge"
].forEach((fragment) => {
  if (!saveSource.includes(fragment)) throw new Error(`product-kind core return save is missing: ${fragment}`);
});

const productionSource = sourceBetween("function renderProductionCorePolicies", "function renderProductionComponents");
if (!productionSource.includes("renderProductionCorePolicies(detail.productVariants)")) {
  throw new Error("manufacturing detail must render core return terms below inventory/core information");
}
const productionLayoutSource = sourceBetween("function normalizeProductionDetailLayout", "function scrollProductionDetailIntoViewOnMobile");
if (!productionLayoutSource.includes('productionKv("状態", productionStatusLabel(row)) +') ||
    !productionLayoutSource.includes("renderProductionCorePolicies(detail.productVariants)")) {
  throw new Error("manufacturing layout normalization must preserve core return terms below inventory/core information");
}
if (!productionSource.includes("vertical: true")) {
  throw new Error("manufacturing core return terms must use the compact vertical layout");
}
if (!productionSource.includes("showCharge: false")) {
  throw new Error("manufacturing detail must hide the core charge and show only core return");
}

const salesDetailSource = sourceBetween("function renderPanelStatic", "async function loadProductVariantsForCurrent");
const salesCoreWrapSource = sourceBetween("function renderCoreReturnPolicyWrapForCurrent", "function bindProductKindPanelActions");
if (!salesCoreWrapSource.includes("compact: true, vertical: true, showTitle: false")) {
  throw new Error("sales core return terms must use the compact vertical layout without a repeated heading");
}
if (!html.includes("sales-conditions-terms") || !html.includes('id="product-kind-wrap"') || !html.includes('id="core-return-policy-wrap"')) {
  throw new Error("sales product kind, stock, core return and core charge must share one compact panel");
}
if (!html.includes("sales-conditions-market") || !css.includes(".sales-conditions-panel")) {
  throw new Error("the EC market summary must remain in the fixed sales conditions panel");
}
if (!salesDetailSource.includes("renderCoreReturnPolicyWrapForCurrent()") || !salesDetailSource.includes("updateSalesProductStatusBadges()")) {
  throw new Error("sales detail must render and summarize the selected product-kind core policy");
}

const productKindPanelSource = sourceBetween("function renderProductKindPanelHtml", "function renderProductKindWrapForCurrent");
if (!productKindPanelSource.includes("selectedMeta.stockQty") || !productKindPanelSource.includes("detail-sales-term-row")) {
  throw new Error("sales product kind and aggregated stock must use part-detail-style rows");
}

if ((source.match(/core_return_policy:/g) || []).length !== 3) {
  throw new Error("core return labels must be translated for all supported languages");
}

console.log("core return policy guard passed");
