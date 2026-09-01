const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

function requireFragment(source, fragment, label) {
  if (!source.includes(fragment)) throw new Error(`${label} is missing: ${fragment}`);
}

function sourceBetween(source, startText, endText) {
  const start = source.indexOf(startText);
  const end = source.indexOf(endText, start + startText.length);
  if (start < 0 || end < start) throw new Error(`${startText} could not be isolated`);
  return source.slice(start, end);
}

const productionScreen = sourceBetween(html, 'id="screen-production-search"', 'id="screen-components"');
[
  'id="production-stamp-search-open"',
  'id="production-stamp-search-overlay"',
  'id="production-stamp-f-number"',
  'id="production-stamp-r-number"',
  'id="production-stamp-pulley-number"',
  'id="production-stamp-search-submit"'
].forEach((fragment) => requireFragment(productionScreen, fragment, "manufacturing stamp search UI"));
[
  'id="production-stamp-f-number" type="text" inputmode="text" maxlength="8" autocomplete="off" autocapitalize="characters" spellcheck="false"',
  'id="production-stamp-r-number" type="text" inputmode="text" maxlength="8" autocomplete="off" autocapitalize="characters" spellcheck="false"',
  'id="production-stamp-pulley-number" type="text" inputmode="text" maxlength="12" autocomplete="off" autocapitalize="characters" spellcheck="false"'
].forEach((fragment) => requireFragment(productionScreen, fragment, "alphanumeric manufacturing stamp search input"));

const productForm = sourceBetween(html, 'id="part-form-overlay"', 'id="kikan-form-overlay"');
[
  'id="pf-stamp-pair-fields"',
  'id="pf-stamp-pair-add"',
  'id="pf-stamp-pair-list"'
].forEach((fragment) => requireFragment(productForm, fragment, "shared product form stamp editor"));
requireFragment(productForm, 'data-i18n="stamp_pair_section">フレーム/プーリNo組合せ</div>', "frame/pulley section title");
[
  'id="pf-core-inventory-fields"',
  'id="pf-core-stock-qty"',
  'id="pf-core-pallet-no"'
].forEach((fragment) => {
  if (productForm.includes(fragment)) throw new Error(`core inventory control must not remain in the product form: ${fragment}`);
});

const stampSearch = sourceBetween(app, "async function fetchProductionStampPairMatches", "async function enterSearch");
[
  'sb.from("core_product_stamp_pairs")',
  '.eq("f_number", fNumber)',
  '.eq("r_number", rNumber)',
  '.eq("pulley_number", pulleyNumber)',
  'fetchProductionProductsForStampMatches(ids)',
  'productionStampSearchActive = true',
  'productionStampMatchMap = matchMap'
].forEach((fragment) => requireFragment(stampSearch, fragment, "F/R/pulley stamp search"));

const detail = sourceBetween(app, "async function renderProductionDetail", "async function loadProductionDetailData");
requireFragment(detail, "renderProductionStampPairsHtml(detail.stampPairs)", "manufacturing detail stamp display");

const detailStampPairs = sourceBetween(app, "function renderProductionStampPairsHtml", "function renderProductionCorePolicies");
[
  'pair.pulley_number || "-"',
  "<small>P</small>"
].forEach((fragment) => requireFragment(detailStampPairs, fragment, "manufacturing pulley-number detail"));
if (detailStampPairs.includes("stamp_pair_total") || detailStampPairs.includes("stamp_pair_confirm_required")) {
  throw new Error("manufacturing detail must show only the F/R/pulley set cards without count or confirmation labels");
}

const specSectionIndex = productForm.indexOf('aria-labelledby="product-form-spec-title"');
const corePolicyIndex = productForm.indexOf('id="pf-core-policy-fields"');
const shippingFieldsIndex = productForm.indexOf('id="pf-shipping-fields"');
if (!(specSectionIndex >= 0 && corePolicyIndex > specSectionIndex && shippingFieldsIndex > corePolicyIndex)) {
  throw new Error("core return policy must sit in the right column between nominal output and shipping fields");
}

const detailLoad = sourceBetween(app, "async function loadProductionDetailData", "function renderProductionCoreEntries");
requireFragment(detailLoad, 'sb.from("core_product_stamp_pairs")', "manufacturing detail stamp query");

const productSave = sourceBetween(app, "async function saveCoreProductForm", "async function deletePart");
[
  "coreProductStampPairFormValue()",
  "saveCoreProductStampPairsForDkd(dkd, stampPairFormValue.pairs, errEl)",
  'if (dkdInput && isNaN(dkd))'
].forEach((fragment) => requireFragment(productSave, fragment, "product stamp-pair save flow"));
if (productSave.includes("payload.core_stock_qty") || productSave.includes("payload.core_pallet_no")) {
  throw new Error("product edits must preserve core inventory and pallet values managed outside this form");
}

const productFieldMode = sourceBetween(app, "function setProductFormFieldMode", "function setCoreProductFormFields");
const productFieldValues = sourceBetween(app, "function setCoreProductFormFields", "async function openCoreProductForm");
[productFieldMode, productFieldValues].forEach((block) => {
  if (block.includes("pf-core-inventory-fields") || block.includes("pf-core-stock-qty") || block.includes("pf-core-pallet-no")) {
    throw new Error("removed core inventory controls must not be referenced by the product form");
  }
});

const pairForm = sourceBetween(app, "async function fetchCoreProductStampPairs", "function setProductFormFieldMode");
[
  'sb.rpc("replace_core_product_stamp_pairs"',
  "stamp_number_invalid",
  "stamp_pair_duplicate",
  "pairs.length > 100",
  "data-stamp-pair-field='pulley_number'",
  "f_number: fNumber || null",
  "r_number: rNumber || null",
  "pulley_number: pulleyNumber || null",
  '(fNumber && !isValidStampNumberValue(fNumber))',
  '(rNumber && !isValidStampNumberValue(rNumber))'
].forEach((fragment) => requireFragment(pairForm, fragment, "stamp-pair editor validation"));
if (pairForm.includes("isUnchangedLegacyPair") || pairForm.includes('error = t("stamp_pair_incomplete")')) {
  throw new Error("the editor must allow F-only, R-only, or pulley-only rows");
}
requireFragment(app, 'stamp_pair_form_help: "Fナンバー・Rナンバー・プーリNoは、どれか1つの入力でも登録できます。"', "partial-set help text");

const partialSetContext = {
  normalizeAsciiWidth: (value) => String(value),
  document: null,
  t: (key) => key
};
vm.createContext(partialSetContext);
vm.runInContext(sourceBetween(app, "function normalizeStampNumberValue", "function clearProductionStampSearchState"), partialSetContext);
vm.runInContext(sourceBetween(app, "function coreProductStampPairFormValue", "async function saveCoreProductStampPairsForDkd"), partialSetContext);

function stampRow(values) {
  const inputs = {
    f_number: { value: values.f_number || "" },
    r_number: { value: values.r_number || "" },
    pulley_number: { value: values.pulley_number || "" }
  };
  return {
    querySelector(selector) {
      const match = selector.match(/data-stamp-pair-field='([^']+)'/);
      return match ? inputs[match[1]] : null;
    }
  };
}

function stampFormValue(rows) {
  partialSetContext.document = {
    getElementById() {
      return { querySelectorAll: () => rows.map(stampRow) };
    }
  };
  return partialSetContext.coreProductStampPairFormValue();
}

[
  { input: { f_number: "F12" }, expected: { f_number: "F12", r_number: null, pulley_number: null } },
  { input: { r_number: "R34" }, expected: { f_number: null, r_number: "R34", pulley_number: null } },
  { input: { pulley_number: "P-123" }, expected: { f_number: null, r_number: null, pulley_number: "P-123" } }
].forEach(({ input, expected }) => {
  const result = stampFormValue([input]);
  if (result.error || result.pairs.length !== 1) throw new Error(`partial stamp set was rejected: ${JSON.stringify(input)}`);
  Object.entries(expected).forEach(([key, value]) => {
    if (result.pairs[0][key] !== value) throw new Error(`partial stamp set normalized ${key} incorrectly`);
  });
});
if (stampFormValue([{}]).pairs.length !== 0) throw new Error("a completely empty stamp row must be ignored");
if (stampFormValue([{ f_number: "F" }]).error !== "stamp_number_invalid") throw new Error("an entered partial value must still be validated");
if (stampFormValue([{ pulley_number: "P-123" }, { pulley_number: "P-123" }]).error !== "stamp_pair_duplicate") {
  throw new Error("duplicate partial stamp sets must be rejected");
}
[
  ".trim()",
  ".toUpperCase()",
  "return /^[A-Z0-9-]{3,8}$/.test",
  '.replace(/[\\u2010-\\u2015\\u2212\\u30FC\\uFF0D]/g, "-")',
  "maxlength='8'",
  "maxlength='12'",
  "isValidPulleyNumberValue",
  "autocapitalize='characters'",
  "プーリNoは3～12文字"
].forEach((fragment) => requireFragment(app, fragment, "alphanumeric stamp-pair editor"));
if (app.includes("return /^[0-9]{3,8}$/.test") || /data-stamp-pair-field='[fr]_number'[^>]*inputmode='numeric'/.test(app)) {
  throw new Error("numeric-only stamp-number validation must not remain in the editor");
}

const validatorContext = {};
vm.createContext(validatorContext);
vm.runInContext(sourceBetween(app, "function isValidStampNumberValue", "function stampPairSignature"), validatorContext);
if (!validatorContext.isValidStampNumberValue("FR12-345") || validatorContext.isValidStampNumberValue("FR12-3456")) {
  throw new Error("F/R validation must remain limited to 3-8 characters");
}
if (!validatorContext.isValidPulleyNumberValue("PULLEY-12345") || validatorContext.isValidPulleyNumberValue("PULLEY-123456")) {
  throw new Error("pulley validation must allow 3-12 characters only");
}

[
  ".production-stamp-pair-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 7px; max-height: 157px; overflow-y: auto; padding: 1px 1px 5px;",
  ".production-stamp-pair { display: grid; grid-template-columns: minmax(0, .9fr) minmax(0, .9fr) minmax(0, 1.35fr); min-height: 38px; overflow: hidden; border: 1px solid #cfd9e6; border-left: 3px solid #4f8fea;",
  ".production-stamp-pair > span { display: grid; grid-template-columns: 22px minmax(0, 1fr); align-items: center; min-width: 0; min-height: 36px; padding: 6px 8px; line-height: 1.25;",
  ".production-stamp-pair-grid { grid-template-columns: 1fr; max-height: 157px; }",
  ".product-form-stamp-pair-row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)) 32px; gap: 8px; align-items: end; border: 1px solid #d5dfeb;",
  ".production-stamp-search-fields { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr));",
  ".product-form-header p,",
  ".product-form-section-head p { display: none; }"
].forEach((fragment) => requireFragment(css, fragment, "stamp-pair responsive layout"));

if (sourceBetween(app, "function renderPanelStatic", "async function loadImages").includes("renderProductionStampPairsHtml")) {
  throw new Error("sales detail must not display manufacturing-only stamp pairs");
}

console.log("Production F/R/pulley stamp-set management verified.");
