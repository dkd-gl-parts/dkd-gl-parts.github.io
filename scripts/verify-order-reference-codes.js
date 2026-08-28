const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "shipment-instruction-print.css"), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function section(source, start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert(startIndex >= 0 && endIndex > startIndex, `Section not found: ${start}`);
  return source.slice(startIndex, endIndex);
}

const search = section(app, "function shippingDocumentExactOrder", "async function loadShippingDocumentDetail");
assert(search.includes("normalizeCustomerOrderReference(order.order_number)"), "Exact lookup must normalize the opaque order reference");
assert(!search.includes("String(order.id"), "Exact lookup must not expose raw internal order IDs");
assert(!search.includes("loadShippingDocumentDetail(parseInt(normalized"), "Numeric input must not be treated as an internal order ID");
assert(search.includes("/^[0-9]{9}$/"), "Shipping lookup must recognize the nine-digit order reference");
assert(!search.includes("/^DC[0-9]{8}-[0-9]{6}$/"), "Legacy date-bearing order references must not remain in lookup logic");
assert(!html.includes("受注ID・注文番号"), "The lookup prompt must not ask operators for an internal ID");

const barcode = section(app, "function salesOrderReferenceBarcodeDataUrl", "function buildSalesOrderCoreReturnPage");
assert(barcode.includes('format: "CODE128"'), "Return references must use Code 128");
assert(barcode.includes('/^[0-9]{9}$/'), "Barcode payload must be the nine-digit return reference");

const corePage = section(app, "function buildSalesOrderCoreReturnPage", "function buildSalesOrderCoreReturnDocumentHtml");
for (const required of ["コア返却シート", "ご返却期限", "返却管理番号", "GLTEK品番", "純正品番", "メーカー品番", "商品名"]) {
  assert(corePage.includes(required), `Core-return layout missing: ${required}`);
}
for (const forbidden of ["D-CATS", "CORE RETURN", "送り状番号", "数量"]) {
  assert(!corePage.includes(forbidden), `Core-return layout must not print: ${forbidden}`);
}
assert(corePage.includes("gltek-logo-print-transparent.png"), "Core-return layout must use the transparent GLTEK logo");

assert(css.includes("@page dcats-core-return { size: A5 portrait; margin: 0; }"), "Core-return print page must be A5 portrait");
assert(css.includes(".core-return-code img"), "Core-return barcode print sizing is missing");
assert(css.includes(".document-core-return { background: transparent; }"), "Core-return print background must remain transparent for colored paper");

console.log("Order and core-return reference frontend verification passed.");
