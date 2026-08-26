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

const renderSource = sourceBetween(app, "async function renderProductionDetail", "async function loadProductionDetailData");
[
  "class='production-head-context'",
  "class='production-detail-meta'",
  "class='production-workspace'",
  "class='production-master-column'",
  "production-section production-master-section",
  "renderProductionComponentSummaryShell(currentProductionComponentSummaryKind)",
  "production-section production-kikan-section",
  "class='production-operations-column'",
  "production-section production-core-section",
  "production-section production-image-panel",
  "renderProductionCoreSummary(row, detail)",
  "renderProductionCorePolicies(detail.productVariants)",
  "id='production-kikan-wrap'",
  "id='production-image-groups'"
].forEach((fragment) => requireFragment(renderSource, fragment, "production workspace renderer"));

if (renderSource.includes("normalizeProductionDetailLayout")) {
  throw new Error("production workspace must be rendered in its final structure without post-render DOM rewriting");
}

const vehicleSummarySource = sourceBetween(app, "async function loadCatalogVehicleSummary", "function renderGltekPartNumberRow");
[
  'root.closest("#screen-production-search")',
  "button.textContent = compactProductionButton ? t(\"vehicle_info_button\") : fullLabel",
  'button.setAttribute("aria-label", fullLabel)'
].forEach((fragment) => requireFragment(vehicleSummarySource, fragment, "production compact vehicle action"));

const masterIndex = renderSource.indexOf("production-section production-master-section");
const componentIndex = renderSource.indexOf("renderProductionComponentSummaryShell(currentProductionComponentSummaryKind)");
const kikanIndex = renderSource.indexOf("production-section production-kikan-section");
const operationsIndex = renderSource.indexOf("class='production-operations-column'");
const coreIndex = renderSource.indexOf("production-section production-core-section");
const imageIndex = renderSource.indexOf("production-section production-image-panel");
if (!(masterIndex < componentIndex && componentIndex < kikanIndex && kikanIndex < operationsIndex && operationsIndex < coreIndex && coreIndex < imageIndex)) {
  throw new Error("production workspace section order must keep overview/components/compatibility on the left and operations/images on the right");
}

const searchBlock = sourceBetween(html, '<div class="production-search">', '<div class="production-filter-row"');
const searchRow = sourceBetween(searchBlock, '<div class="search-row">', "</div>");
requireFragment(searchRow, 'id="production-search-btn"', "production search primary action");
requireFragment(searchRow, 'id="production-clear-btn"', "production search clear action");

[
  ".production-right { display: flex; flex-direction: column; min-width: 0; overflow: hidden;",
  ".production-detail { display: flex; flex: 1 1 auto; flex-direction: column; min-height: 0;",
  ".production-workspace { display: grid; flex: 1 1 auto;",
  ".production-master-column { grid-template-rows: minmax(250px, 1.05fr) minmax(165px, .75fr) minmax(90px, .4fr); }",
  ".production-component-summary-section { display: flex; flex-direction: column; min-height: 0; overflow: hidden; }",
  ".production-component-summary-wrap { flex: 1 1 auto; min-height: 0; overflow: auto; }",
  ".production-operations-column { grid-template-rows: auto auto; align-content: start; }",
  "#production-kikan-wrap { flex: 1 1 auto; min-height: 0; overflow: auto; }",
  ".production-core-meta { display: grid; grid-template-columns: minmax(180px, 1fr) minmax(110px, .56fr);",
  ".production-core-meta .production-kv + .production-kv { grid-template-columns: 64px minmax(28px, 1fr); }",
  "#screen-production-search .detail-vehicle-grid:not(.detail-spec-grid) { grid-template-columns: 118px minmax(0, 1fr); }",
  "#screen-production-search .ac-part-row { grid-template-columns: 136px minmax(0, 1fr); }",
  "#screen-production-search .ac-part-label { font-size: 12px; white-space: nowrap; }",
  "#screen-production-search .detail-spec-grid { grid-template-columns: 86px minmax(0, 1fr) 86px minmax(0, 1fr); }",
  "#screen-production-search .production-core-policy-row { grid-template-columns: 70px minmax(0, 1fr);",
  "#screen-production-search .production-core-policy-row .core-return-badge { white-space: nowrap; overflow-wrap: normal; }",
  "@media (min-width: 768px) and (max-width: 1180px)",
  ".production-workspace { display: grid; grid-template-columns: 1fr; overflow: visible; }",
  ".production-master-section, .production-component-summary-section, .production-kikan-section, .production-core-section, #production-kikan-wrap { overflow: visible; }"
].forEach((fragment) => requireFragment(css, fragment, "production workspace CSS"));

console.log("Production management workspace layout verified.");
