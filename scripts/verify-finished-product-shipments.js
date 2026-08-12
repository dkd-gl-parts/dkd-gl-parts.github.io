const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const printCss = fs.readFileSync(path.join(root, "shipment-instruction-print.css"), "utf8");
const staticBuild = fs.readFileSync(path.join(root, "scripts", "build-static-site.js"), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function functionSource(name) {
  const marker = `function ${name}(`;
  const start = app.indexOf(marker);
  assert(start >= 0, `${name} is missing`);
  const brace = app.indexOf("{", start);
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = brace; index < app.length; index += 1) {
    const char = app[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}" && --depth === 0) return app.slice(start, index + 1);
  }
  throw new Error(`${name} could not be parsed`);
}

assert(html.includes('id="screen-finished-product-shipping"'), "shipment screen is missing");
[
  'id="finished-shipment-dispatch-input"',
  'id="btn-finished-shipment-load-dispatch"',
  'id="finished-shipment-serial-input"',
  'id="finished-shipment-candidate-card" hidden',
  'id="finished-shipment-candidate-search"',
  'id="finished-shipment-order-context"',
  'id="finished-shipment-selection-card" hidden',
  'id="finished-shipment-order-form" hidden',
  'id="finished-shipment-shipped-on" type="date"'
].forEach((field) => assert(html.includes(field), `shipment workflow element is missing: ${field}`));
[
  'id="finished-shipment-customer"',
  'id="finished-shipment-order-number"',
  'id="finished-shipment-carrier"',
  'id="finished-shipment-tracking"'
].forEach((field) => assert(!html.includes(field), `duplicate shipment field remains: ${field}`));
assert(html.includes('id="finished-shipment-warranty-months" type="number" min="1" max="120"'), "warranty-month guard is missing");
assert(css.includes(".finished-shipment-shell"), "shipment layout styles are missing");
assert(css.includes(".finished-shipment-candidates"), "manual serial candidate styles are missing");
assert(css.includes(".sales-order-dispatch-summary"), "sales-order dispatch summary styles are missing");
assert(/\.finished-shipment-table\s*\{[^}]*min-width:\s*0[^}]*table-layout:\s*fixed/s.test(css), "shipment table must fit its pane");
assert(/\.finished-shipment-table th:nth-child\(4\)\s*\{[^}]*width:\s*52px[^}]*text-align:\s*center/s.test(css), "shipment action column must remain visible");
assert(printCss.includes("@page") && printCss.includes("A4"), "shipment instruction print layout must target A4");
assert(staticBuild.includes('"shipment-instruction-print.css"'), "static build omits the shipment instruction stylesheet");

assert(app.includes('action: "finished-product-shipping"'), "shipment menu action is missing");
assert(app.includes('"finished_product_shipping.manage"'), "shipment permission key is missing");
assert((app.match(/mi_finished_shipping_title: "出荷照合・保証管理"/g) || []).length === 1, "Japanese dispatch/warranty menu title is missing");
assert((app.match(/\n    finished_shipping_title:/g) || []).length === 3, "dispatch/warranty title must be translated");

const salesDetailSource = functionSource("renderSalesOrderDetail");
assert(salesDetailSource.includes("salesOrderDispatchHtml(order)"), "sales-order detail must render dispatch controls");
assert(salesDetailSource.includes("issueSalesOrderDispatch"), "sales-order detail must bind dispatch issue");
assert(salesDetailSource.includes('printSalesOrderDocument("dispatch")'), "sales-order detail must print shipment instructions");
assert(salesDetailSource.includes('printSalesOrderDocument("core_return")'), "sales-order detail must print core-return sheets");
assert(salesDetailSource.includes("exportSalesOrderIdsB2([order.id])"), "sales-order detail must export the selected order to B2");
assert(salesDetailSource.includes("openSalesOrderSerialWarranty"), "sales-order detail must open dispatch checking");
assert(salesDetailSource.includes("送り状番号の登録だけでは在庫を減らしません"), "B2 label registration must explain that stock is unchanged");
assert(functionSource("issueSalesOrderDispatch").includes('sb.rpc("issue_sales_order_dispatch"'), "dispatch issue RPC is not called");
assert(functionSource("openSalesOrderSerialWarranty").includes("salesOrderDispatch(salesOrderDetail)"), "dispatch checking must require an issued instruction");
assert(functionSource("buildSalesOrderDocumentHtml").includes("shipment-instruction-print.css?dcats_version="), "shipment document stylesheet is not versioned");

const dispatchLoadSource = functionSource("loadFinishedShipmentDispatch");
assert(dispatchLoadSource.includes('sb.rpc("get_sales_order_dispatch"'), "shipment instruction load RPC is not called");
assert(dispatchLoadSource.includes("refreshFinishedShipmentContext(order)"), "loaded dispatch does not refresh the workspace");
const candidateSource = functionSource("loadFinishedShipmentCandidates");
assert(candidateSource.includes('sb.rpc("list_sales_order_serial_candidates"'), "manual fallback candidate RPC is not called");
const assignmentSource = functionSource("assignFinishedShipmentSerial");
assert(assignmentSource.includes('sb.rpc("assign_sales_order_dispatch_serial"'), "serial assignment RPC is not called");

const scanSource = functionSource("addFinishedShipmentSerial");
assert(scanSource.includes('.from("finished_product_units")'), "serial scan does not look up finished units");
assert(scanSource.includes('r.data.status !== "available"'), "unavailable units are not blocked");
assert(scanSource.includes("finishedShipmentOrderItemForUnit"), "scanned serial is not matched to an order line");
assert(scanSource.includes("assignFinishedShipmentSerial"), "scanner input and manual selection do not share assignment logic");
assert(scanSource.includes("if (!dispatch)"), "standalone serial lookup must remain available without a dispatch");

const clearSource = functionSource("clearFinishedShipmentUnits");
assert(clearSource.includes('sb.rpc("release_sales_order_dispatch_serial"'), "clear action must release server-side assignments");
const saveSource = functionSource("saveFinishedProductShipment");
assert(saveSource.includes('sb.rpc("confirm_sales_order_dispatch"'), "atomic dispatch confirmation RPC is not called");
assert(saveSource.includes("target_expected_version"), "dispatch confirmation lacks optimistic concurrency");
assert(saveSource.includes("finished_shipping_tracking_required"), "outbound tracking must be validated before shipment");
assert(saveSource.includes("finished_shipping_return_tracking_required"), "core-return tracking must be validated before shipment");
assert(!saveSource.includes("ship_finished_product_units"), "legacy shipment RPC would double-decrement stock");
assert(!saveSource.includes('.from("finished_product_units").update('), "browser mutates unit lifecycle directly");
assert(!saveSource.includes('.from("core_product_variants").update('), "browser mutates stock directly");

const cancelSource = functionSource("cancelFinishedProductShipment");
assert(cancelSource.includes('sb.rpc("cancel_finished_product_shipment"'), "audited standalone cancellation RPC is not called");
assert(functionSource("renderFinishedShipmentLookup").includes("finishedShipmentWarrantyState"), "serial lookup does not show warranty state");
assert(functionSource("loadFinishedShipmentHistory").includes('.from("finished_product_shipments")'), "shipment history is not loaded");

assert(app.includes('document.getElementById("btn-finished-shipment-load-dispatch").addEventListener("click", loadFinishedShipmentDispatch)'), "dispatch load button is not bound");
assert(app.includes('document.getElementById("btn-finished-shipment-candidate-reload").addEventListener("click", loadFinishedShipmentCandidates)'), "manual candidate search is not bound");

const sandbox = { normalizeAsciiWidth(value) { return String(value); } };
vm.createContext(sandbox);
vm.runInContext(`${functionSource("normalizeFinishedShipmentSerial")}; this.normalizeSerial = normalizeFinishedShipmentSerial;`, sandbox);
assert(sandbox.normalizeSerial(" m2026-0000001 ") === "M2026-0000001", "serial normalization failed");

console.log("Dispatch instruction, manual fallback, stock, serial, and warranty UI checks passed.");
