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
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}" && --depth === 0) return app.slice(start, index + 1);
  }
  throw new Error(`${name} could not be parsed`);
}

const scan = functionSource("addFinishedShipmentSerial");
assert(scan.includes("assignFinishedShipmentSerial(null, serial)"), "scanner must delegate exact-or-compatible matching to the server");
assert(!scan.includes("finishedShipmentOrderItemForUnit"), "scanner still contains the exact-only order-line gate");

const assign = functionSource("assignFinishedShipmentSerial");
assert(assign.includes("target_order_item_id: orderItemId || null"), "assignment must permit automatic server-side order-line selection");
assert(assign.includes("finished_shipping_compatible_assigned"), "compatible assignment feedback is missing");
assert(assign.includes("finished_shipping_all_verified"), "completed-check feedback is missing");

const flatten = functionSource("finishedShipmentFlattenAssignments");
assert(flatten.includes('match_type: finishedShipmentUnitMatchesItem(serial, orderItem) ? "exact" : "compatible"'), "assigned serial match type is not preserved");
assert(functionSource("renderFinishedShipmentUnits").includes("finished-shipment-match-badge"), "assigned compatible serial badge is missing");
assert(functionSource("renderFinishedShipmentCandidates").includes("finished-shipment-match-badge"), "compatible candidate badge is missing");

const context = functionSource("renderFinishedShipmentOrderContext");
assert(context.includes('saveButton.disabled = !active || dispatch.status !== "ready"'), "shipment completion must remain disabled until all required serials are verified");
assert(context.includes("finished_shipping_all_verified"), "ready-state guidance is missing");

assert(html.includes('data-i18n="finished_shipping_register">照合を完了して出荷済みにする</button>'), "shipment completion button wording is unclear");
assert(css.includes(".finished-shipment-match-badge"), "compatible badge styling is missing");
assert(css.includes(".finished-shipment-order-note.ready"), "completed-check guidance styling is missing");

for (const key of [
  "finished_shipping_compatible_badge",
  "finished_shipping_compatible_assigned",
  "finished_shipping_all_verified"
]) {
  assert((app.match(new RegExp(`\\n    ${key}:`, "g")) || []).length === 3, `${key} must be translated in all supported languages`);
}

console.log("Customer-order compatible serial dispatch UI verification passed.");
