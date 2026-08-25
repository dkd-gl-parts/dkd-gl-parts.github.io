const fs = require("fs");
const path = require("path");

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
  'id="production-stamp-search-submit"'
].forEach((fragment) => requireFragment(productionScreen, fragment, "manufacturing stamp search UI"));

const productForm = sourceBetween(html, 'id="part-form-overlay"', 'id="kikan-form-overlay"');
[
  'id="pf-stamp-pair-fields"',
  'id="pf-stamp-pair-add"',
  'id="pf-stamp-pair-list"'
].forEach((fragment) => requireFragment(productForm, fragment, "shared product form stamp editor"));

const stampSearch = sourceBetween(app, "async function fetchProductionStampPairMatches", "async function enterSearch");
[
  'sb.from("core_product_stamp_pairs")',
  '.eq("f_number", fNumber)',
  '.eq("r_number", rNumber)',
  'fetchProductionProductsForStampMatches(ids)',
  'productionStampSearchActive = true',
  'productionStampMatchMap = matchMap'
].forEach((fragment) => requireFragment(stampSearch, fragment, "F/R stamp search"));

const detail = sourceBetween(app, "async function renderProductionDetail", "async function loadProductionDetailData");
requireFragment(detail, "renderProductionStampPairsHtml(detail.stampPairs)", "manufacturing detail stamp display");

const detailLoad = sourceBetween(app, "async function loadProductionDetailData", "function renderProductionCoreEntries");
requireFragment(detailLoad, 'sb.from("core_product_stamp_pairs")', "manufacturing detail stamp query");

const productSave = sourceBetween(app, "async function saveCoreProductForm", "async function deletePart");
[
  "coreProductStampPairFormValue()",
  "saveCoreProductStampPairsForDkd(dkd, stampPairFormValue.pairs, errEl)",
  'if (dkdInput && isNaN(dkd))'
].forEach((fragment) => requireFragment(productSave, fragment, "product stamp-pair save flow"));

const pairForm = sourceBetween(app, "async function fetchCoreProductStampPairs", "function setProductFormFieldMode");
[
  'sb.rpc("replace_core_product_stamp_pairs"',
  "stamp_pair_incomplete",
  "stamp_number_invalid",
  "stamp_pair_duplicate",
  "pairs.length > 100"
].forEach((fragment) => requireFragment(pairForm, fragment, "stamp-pair editor validation"));

[
  ".production-stamp-pair-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); max-height: 137px; overflow-y: auto;",
  ".production-stamp-pair-grid { grid-template-columns: 1fr; max-height: 137px; }",
  ".product-form-stamp-pair-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 32px;"
].forEach((fragment) => requireFragment(css, fragment, "stamp-pair responsive layout"));

if (sourceBetween(app, "function renderPanelStatic", "async function loadImages").includes("renderProductionStampPairsHtml")) {
  throw new Error("sales detail must not display manufacturing-only stamp pairs");
}

console.log("Production F/R stamp-pair management verified.");
