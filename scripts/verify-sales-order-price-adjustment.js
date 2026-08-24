const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8").replace(/\r\n/g, "\n");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8").replace(/\r\n/g, "\n");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8").replace(/\r\n/g, "\n");

function requireFragment(target, fragment, message) {
  if (!target.includes(fragment)) throw new Error(message || `Missing sales-order price-adjustment contract: ${fragment}`);
}

function functionSource(name) {
  const marker = `function ${name}(`;
  const asyncMarker = `async function ${name}(`;
  let start = source.indexOf(marker);
  if (start < 0) start = source.indexOf(asyncMarker);
  if (start < 0) throw new Error(`Function is missing: ${name}`);
  const next = source.indexOf("\nfunction ", start + 1);
  const nextAsync = source.indexOf("\nasync function ", start + 1);
  const stops = [next, nextAsync].filter((index) => index >= 0);
  return source.slice(start, stops.length ? Math.min(...stops) : source.length);
}

for (const id of [
  "sales-order-pricing-overlay",
  "sales-order-pricing-content",
  "sales-order-pricing-order-discount",
  "sales-order-pricing-shipping",
  "sales-order-pricing-free-shipping",
  "sales-order-pricing-reason",
  "sales-order-pricing-save"
]) requireFragment(html + source, id);

const detail = functionSource("renderSalesOrderDetail");
for (const fragment of [
  "order.pricing_editable",
  "金額を修正",
  "商品計（明細値引後）",
  "受注値引き",
  "送料無料",
  "salesOrderPricingHistoryHtml(order.pricing_adjustments)"
]) requireFragment(detail, fragment);

const editor = functionSource("salesOrderPricingEditorHtml");
for (const fragment of ["単価", "明細値引き", "受注全体の値引き", "送料", "変更理由 *"]) requireFragment(editor, fragment);

const calculation = functionSource("readSalesOrderPricingEditor");
for (const fragment of [
  "var base = unit * quantity",
  "discount > base",
  "result.subtotal += lineTotal",
  "orderDiscount > result.subtotal",
  "Math.floor((result.subtotal - orderDiscount) * 0.10) + Math.floor(shipping * 0.10)",
  "result.subtotal - orderDiscount + shipping + result.tax"
]) requireFragment(calculation, fragment);

const save = functionSource("saveSalesOrderPricing");
for (const fragment of [
  'sb.rpc("adjust_sales_order_pricing"',
  "target_order_id: salesOrderDetail.id",
  "target_items:",
  "target_order_discount_jpy: values.orderDiscount",
  "target_shipping_fee_jpy: values.shipping",
  "target_reason: reason",
  "target_expected_version: salesOrderDetail.version",
  "reason.length < 2",
  "refreshSalesOrderManagement()"
]) requireFragment(save, fragment);
if (/\.from\([^)]*customer_order(?:s|_items)[^)]*\)[\s\S]*?\.update\(/i.test(save)) {
  throw new Error("The browser must not update financial order tables directly");
}

for (const fragment of [
  ".sales-order-pricing-card",
  ".sales-order-pricing-item",
  ".sales-order-pricing-preview",
  ".sales-order-pricing-history-row",
  ".sales-order-pricing-shipping-input"
]) requireFragment(css, fragment);

console.log("Sales order price-adjustment UI verification passed.");
