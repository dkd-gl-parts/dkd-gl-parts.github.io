const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8").replace(/\r\n/g, "\n");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8").replace(/\r\n/g, "\n");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8").replace(/\r\n/g, "\n");

function requireFragment(target, fragment, message) {
  if (!target.includes(fragment)) throw new Error(message || `Missing order-operations redesign contract: ${fragment}`);
}

function functionSource(name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`Function is missing: ${name}`);
  const next = source.indexOf("\nfunction ", start + 1);
  const nextAsync = source.indexOf("\nasync function ", start + 1);
  const stops = [next, nextAsync].filter((index) => index >= 0);
  return source.slice(start, stops.length ? Math.min(...stops) : source.length);
}

for (const fragment of [
  "sales-order-search-controls",
  "sales-order-selection-controls",
  "sales-order-selection-summary",
  "sales-order-data-actions",
  "選択した受注の処理",
  "データ連携"
]) requireFragment(html, fragment);

for (const id of [
  "sales-order-search",
  "sales-order-status",
  "sales-order-reload",
  "sales-order-batch-accept",
  "sales-order-export-b2",
  "sales-order-b2-settings-open",
  "sales-order-import-b2",
  "sales-order-accounting-export",
  "sales-order-business-workspace-open"
]) {
  const count = (html.match(new RegExp(`id=["']${id}["']`, "g")) || []).length;
  if (count !== 1) throw new Error(`${id} must remain unique after toolbar regrouping; found ${count}`);
}

const selection = functionSource("updateSalesOrderSelectionButtons");
for (const fragment of [
  'getElementById("sales-order-selection-summary")',
  'checkedIds.length + "件選択"',
  'classList.toggle("active", checkedIds.length > 0)',
  '"B2 CSV発行"'
]) requireFragment(selection, fragment);

const lifecycleSource = functionSource("salesOrderLifecycleHtml");
for (const fragment of [
  "受付待ち",
  "受付済み",
  "出荷準備",
  "出荷済み",
  "完了",
  "受注取消",
  "aria-current='step'"
]) requireFragment(lifecycleSource, fragment);

const lifecycleContext = { esc: (value) => String(value) };
vm.createContext(lifecycleContext);
vm.runInContext(lifecycleSource, lifecycleContext);
const readyProgress = lifecycleContext.salesOrderLifecycleHtml("shipping_ready");
if (!readyProgress.includes("sales-order-progress-step done") || !readyProgress.includes("sales-order-progress-step current")) {
  throw new Error("Shipping-ready lifecycle must distinguish completed and current steps");
}
if (!lifecycleContext.salesOrderLifecycleHtml("cancelled").includes("受注取消")) {
  throw new Error("Cancelled orders must have an explicit terminal lifecycle state");
}

const detail = functionSource("renderSalesOrderDetail");
for (const fragment of [
  "salesOrderLifecycleHtml(order.status)",
  'class=\'sales-order-detail-head\'',
  'class=\'sales-order-detail-state\'',
  "sales-order-empty-guidance"
]) requireFragment(detail, fragment);

for (const fragment of [
  ".sales-order-search-controls {",
  ".sales-order-selection-controls {",
  ".sales-order-selection-summary.active {",
  ".sales-order-data-actions > summary {",
  ".sales-order-data-actions > div {",
  ".sales-order-detail-head { display: grid;",
  ".sales-order-progress {",
  ".sales-order-progress-step.current {",
  ".sales-order-empty-guidance {",
  ".sales-order-search-controls { grid-template-columns: 1fr 1fr;"
]) requireFragment(css, fragment);

console.log("Sales order operations information architecture and responsive layout verification passed.");
