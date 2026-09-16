const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "styles.css"), "utf8");

function sourceBetween(startText, endText) {
  const start = source.indexOf(startText);
  const end = source.indexOf(endText, start + startText.length);
  if (start < 0 || end < start) throw new Error(`${startText} could not be isolated`);
  return source.slice(start, end);
}

const productionOpenSource = sourceBetween("async function openProductionComponents", "async function openProductionFinishedLabel");
if (productionOpenSource.includes("enterSearch")) {
  throw new Error("production component navigation must not wait for full sales-search initialization");
}
[
  "Object.assign({}, currentProductionRow, cached || {})",
  "currentCoreDkdShohinId = productDkdId(row)",
  'await enterComponentsScreen("production-search")'
].forEach((fragment) => {
  if (!productionOpenSource.includes(fragment)) throw new Error(`fast production component navigation is missing: ${fragment}`);
});

const enterSource = sourceBetween("async function enterComponentsScreen", "function enterComponentParallelScreen");
[
  "renderComponentsScreenLoading()",
  'showScreen("components")',
  "await waitForScreenPaint()",
  "await ensureProductVariantsForCurrentDkd",
  "loadAssemblyComponentsForCurrent()"
].forEach((fragment) => {
  if (!enterSource.includes(fragment)) throw new Error(`component transition step is missing: ${fragment}`);
});
if (!(enterSource.indexOf("renderComponentsScreenLoading()") < enterSource.indexOf('showScreen("components")') &&
      enterSource.indexOf('showScreen("components")') < enterSource.indexOf("await waitForScreenPaint()") &&
      enterSource.indexOf("await waitForScreenPaint()") < enterSource.indexOf("await ensureProductVariantsForCurrentDkd"))) {
  throw new Error("the component loading screen must paint before variant and component queries begin");
}

const loadingSource = sourceBetween("function renderComponentsScreenLoading", "function waitForScreenPaint");
if (!loadingSource.includes('document.getElementById("component-wrap")') || !loadingSource.includes('t("loading")')) {
  throw new Error("the component screen must show a loading state immediately");
}

const nominalOutputSource = sourceBetween("function componentTargetNominalOutputText", "function componentTargetSummaryHtml");
[
  'specNumberText(spec.voltage_v, "V")',
  'specNumberText(spec.current_a, "A")',
  'specNumberText(spec.power_kw, "kW")',
  'specNumberText(spec.power_w, "W")',
  'diameter ? "D" + diameter : ""',
  "isAcCategoryKey(key)",
  "isAlternatorCategoryKey(key)",
  "isStarterCategoryKey(key)",
  'String(spec.raw_spec || product.spec || "").trim() || "-"'
].forEach((fragment) => {
  if (!nominalOutputSource.includes(fragment)) throw new Error(`component nominal-output summary is missing: ${fragment}`);
});
const targetSummarySource = sourceBetween("function componentTargetSummaryHtml", "function updateComponentTargetSummary");
if (!targetSummarySource.includes('t("spec_section")') || !targetSummarySource.includes("componentTargetNominalOutputText()")) {
  throw new Error("component target summary must display nominal output");
}
if (!styles.includes(".component-target-summary { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr));") ||
    !styles.includes(".component-target-summary, .component-catalog-target .component-target-summary { grid-template-columns: repeat(3, minmax(0, 1fr));") ||
    !styles.includes(".component-target-controls, .component-target-summary")) {
  throw new Error("component nominal-output summary must remain responsive");
}

const quantityHeader = '<th class=\'component-cell-qty\'>" + t("component_quantity")';
const moneyHeader = '<th class=\'component-cell-money\'>" + t("component_unit_price")';
const rateHeader = '<th class=\'component-cell-rate\'>" + t("component_replacement_rate")';
const countText = (text) => source.split(text).length - 1;
if (countText(quantityHeader) !== 4 || countText(moneyHeader) !== 4 || countText(rateHeader) !== 2) {
  throw new Error("component numeric headers must use the same alignment classes as their values in every table mode");
}
if (countText('catalogMode ? " component-table-catalog" : " component-table-manual"') !== 2 ||
    !styles.includes(".component-table-basic.component-table-manual th:nth-child(9), .component-table-basic.component-table-manual td:nth-child(9) { width: 15%; }") ||
    !styles.includes(".component-table-tree.component-table-manual th:nth-child(10), .component-table-tree.component-table-manual td:nth-child(10) { width: 13%; }")) {
  throw new Error("manual component tables must reserve a wider manufacturing-memo column without changing catalog columns");
}

console.log("component screen transition guard passed");
