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
  "sales-order-pricing-adjustment-rows",
  "sales-order-pricing-adjustment-add",
  "sales-order-pricing-shipping",
  "sales-order-pricing-free-shipping",
  "sales-order-pricing-reason",
  "sales-order-pricing-save"
]) requireFragment(html + source, id);

const detail = functionSource("renderSalesOrderDetail");
for (const fragment of [
  "salesOrderCanRevise(order)",
  "受注修正",
  "値引・調整",
  "送料無料",
  "salesOrderAdjustmentRowsHtml(orderAdjustments, orderDiscount)",
  "salesOrderPricingHistoryHtml(order.pricing_adjustments)"
]) requireFragment(detail, fragment);

const editor = functionSource("salesOrderPricingEditorHtml");
for (const fragment of [
  "商品別の金額",
  "値引・調整と送料",
  "値引・調整行を追加",
  "salesOrderPricingAdjustmentRowHtml",
  "送料（実費）",
  "送料を全額値引",
  "変更理由 *"
]) requireFragment(editor, fragment);
for (const forbidden of ["明細値引き", "受注全体の値引き", "sales-order-pricing-order-discount"]) {
  if (editor.includes(forbidden)) throw new Error(`Legacy discount control must be removed: ${forbidden}`);
}

const calculation = functionSource("readSalesOrderPricingEditor");
for (const fragment of [
  "var base = unit * quantity",
  "result.subtotal += base",
  "result.adjustments.push({ adjustment_code: code, amount_jpy: amount, note: note || null })",
  "result.productAdjustment > result.subtotal",
  "result.shippingAdjustment > shipping",
  "Math.floor((result.subtotal - result.productAdjustment) * 0.10)",
  "result.subtotal - result.adjustmentTotal + shipping + result.tax"
]) requireFragment(calculation, fragment);

const fullShippingDiscount = functionSource("setSalesOrderFullShippingDiscount");
for (const fragment of [
  'master.application_scope === "shipping"',
  'option.dataset.adjustmentScope === "shipping"',
  'addSalesOrderPricingAdjustmentRow(shippingMaster.adjustment_code, shippingAmount, "送料サービス")'
]) requireFragment(fullShippingDiscount, fragment);
if (/shippingInput\.value\s*=\s*["']0["']/.test(fullShippingDiscount)) {
  throw new Error("Free shipping must keep the actual shipping fee and add a shipping-discount line");
}

const save = functionSource("saveSalesOrderPricing");
for (const fragment of [
  'sb.rpc("adjust_sales_order_pricing_v2"',
  "target_order_id: salesOrderDetail.id",
  "target_items:",
  "target_adjustments: values.adjustments",
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
  ".sales-order-pricing-adjustment-row",
  ".sales-order-pricing-adjustment-add",
  ".sales-order-adjustment-table",
  ".sales-order-pricing-preview",
  ".sales-order-pricing-history-row",
  ".sales-order-pricing-shipping-input"
]) requireFragment(css, fragment);

console.log("Sales order price-adjustment UI verification passed.");
