const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

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
    if (char === '"' || char === "'" || char === "`") { quote = char; continue; }
    if (char === "{") depth += 1;
    if (char === "}" && --depth === 0) return app.slice(start, index + 1);
  }
  throw new Error(`${name} could not be parsed`);
}

for (const id of [
  "btn-finished-warranty-settings",
  "finished-shipment-warranty-summary",
  "finished-warranty-policy-overlay",
  "finished-warranty-policy-body",
  "finished-warranty-policy-save",
  "finished-shipment-replacement-overlay",
  "finished-shipment-replacement-serial",
  "finished-shipment-replacement-save"
]) assert(html.includes(`id="${id}"`), `Missing category warranty UI: ${id}`);

assert(!html.includes('id="finished-shipment-warranty-months"'), "Manual shipment warranty input remains");
assert(functionSource("loadFinishedWarrantyPolicies").includes('sb.rpc("get_product_warranty_policies"'), "Warranty policy load RPC is missing");
assert(functionSource("saveFinishedWarrantyPolicies").includes('sb.rpc("save_product_warranty_policies"'), "Warranty policy save RPC is missing");
assert(functionSource("updateFinishedShipmentReplacement").includes('sb.rpc("set_sales_order_dispatch_item_replacement"'), "Replacement setting RPC is missing");
assert(functionSource("saveFinishedProductShipment").includes("target_warranty_months: 12"), "Legacy confirmation signature compatibility is missing");
assert(!functionSource("saveFinishedProductShipment").includes("finished-shipment-warranty-months"), "Browser still controls warranty months");
assert(functionSource("salesOrderWarrantyUnits").includes("item.replacement"), "Replacement items are not excluded from warranty certificates");
assert(functionSource("shippingDocumentShipmentDocumentsHtml").includes("対象外（交換品）"), "Replacement-only warranty state is not visible");
assert(functionSource("printSalesOrderDocument").includes("!salesOrderWarrantyDocumentRequired(order)"), "Replacement-only warranty printing is not blocked");

for (const fragment of [
  ".finished-shipment-warranty-summary",
  ".finished-shipment-item-warranty.replacement",
  ".finished-warranty-policy-card",
  ".finished-warranty-policy-table",
  ".finished-shipment-replacement-card"
]) assert(css.includes(fragment), `Missing category warranty styling: ${fragment}`);

assert(html.includes('content="v1.1.856"'), "Release version is not v1.1.856");
assert(app.includes('var APP_VERSION       = "v1.1.856"'), "Runtime version is not v1.1.856");

console.log("Category warranty and replacement shipment UI contract: OK");
