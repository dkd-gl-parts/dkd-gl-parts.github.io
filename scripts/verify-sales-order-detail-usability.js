const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8").replace(/\r\n/g, "\n");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8").replace(/\r\n/g, "\n");

function requireFragment(target, fragment, message) {
  if (!target.includes(fragment)) throw new Error(message || `Missing sales-order usability contract: ${fragment}`);
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

const list = functionSource("renderSalesOrderList");
for (const fragment of [
  "sales-order-list-identity",
  "sales-order-list-customer",
  "sales-order-list-meta",
  "sales-order-list-metrics"
]) requireFragment(list, fragment);

const detail = functionSource("renderSalesOrderDetail");
for (const fragment of [
  "sales-order-detail-next-actions",
  "次の操作",
  "sales-order-detail-nav",
  "role='tablist'",
  "data-sales-order-detail-view='",
  "sales-order-detail-panels",
  "sales-order-detail-overview-grid",
  "data-sales-order-detail-panel='overview'",
  "注文・配送",
  "出荷・帳票",
  "sales-order-detail-products",
  "sales-order-detail-delivery",
  "sales-order-detail-tracking",
  "sales-order-detail-history",
  "処理履歴"
]) requireFragment(detail, fragment);
requireFragment(functionSource("salesOrderDispatchHtml"), "sales-order-detail-fulfillment");
if (detail.includes("href='#sales-order-detail-")) {
  throw new Error("Order detail navigation must switch work panels instead of jumping down a long page");
}
if (detail.includes("sales-order-detail-actions")) {
  throw new Error("Order actions must be shown once in the decision header, not repeated at the bottom");
}

const pricing = functionSource("salesOrderPricingEditorHtml");
for (const fragment of [
  "商品別の金額",
  "値引・調整と送料",
  "値引・調整行を追加",
  "変更後の請求額",
  "sales-order-pricing-lower-grid",
  "sales-order-pricing-mobile-label"
]) requireFragment(pricing, fragment);

for (const fragment of [
  ".sales-order-list-identity",
  ".sales-order-list-metrics",
  ".sales-order-detail-next-actions",
  ".sales-order-detail-nav",
  ".sales-order-detail-nav button[aria-selected=\"true\"]",
  ".sales-order-detail-panel[hidden]",
  ".sales-order-detail-overview-grid",
  ".sales-order-detail-overview { overflow: hidden; }",
  ".sales-order-history-groups",
  ".sales-order-pricing-lower-grid",
  ".sales-order-pricing-item .sales-order-pricing-mobile-label { display: none; }",
  ".sales-order-pricing-item .sales-order-pricing-mobile-label { display: block; }"
]) requireFragment(css, fragment);

console.log("Sales order list, detail, and price-editor usability verification passed.");
