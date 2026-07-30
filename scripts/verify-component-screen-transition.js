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

console.log("component screen transition guard passed");
