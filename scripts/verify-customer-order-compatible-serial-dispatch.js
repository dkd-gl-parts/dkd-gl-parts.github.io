const fs = require("fs");
const path = require("path");
const vm = require("vm");

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
assert(scan.includes("assignFinishedShipmentSerial(null, serial, r.data)"), "scanner must delegate exact-or-compatible matching to the server with the scanned unit");
assert(!scan.includes("finishedShipmentOrderItemForUnit"), "scanner still contains the exact-only order-line gate");
assert(scan.indexOf("var dispatch = finishedShipmentDispatch()") < scan.indexOf("renderFinishedShipmentLookup(r.data)"), "order picking must not show generic availability before server matching");

const assign = functionSource("assignFinishedShipmentSerial");
assert(assign.includes("target_order_item_id: orderItemId || null"), "assignment must permit automatic server-side order-line selection");
assert(assign.includes('renderFinishedShipmentLookup(unit, { status: "ng" })'), "server rejection must render a picking NG result");
assert(assign.includes('status: "ok"') && assign.includes("assignedRow.match_type"), "server acceptance must render exact or compatible picking OK");
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
assert(css.includes(".finished-shipment-lookup.picking-ng") && css.includes(".finished-shipment-status.picking-ng"), "picking NG must be visually prominent");

const presentation = functionSource("finishedShipmentPickingPresentation");
assert(presentation.includes('className: "picking-ok"') && presentation.includes('className: "picking-ng"'), "picking presentation must distinguish OK and NG");
assert(presentation.includes("finished_shipping_picking_exact") && presentation.includes("finished_shipping_picking_compatible"), "picking OK must distinguish exact and compatible matches");
const presentationContext = {};
vm.runInNewContext(`${presentation}; this.ng = finishedShipmentPickingPresentation({ status: "ng" }); this.exact = finishedShipmentPickingPresentation({ status: "ok", matchType: "exact" }); this.compatible = finishedShipmentPickingPresentation({ status: "ok", matchType: "compatible" });`, presentationContext);
assert(presentationContext.ng.className === "picking-ng" && presentationContext.ng.badgeKey === "finished_shipping_picking_ng", "a rejected server match must evaluate as picking NG");
assert(presentationContext.exact.detailKey === "finished_shipping_picking_exact", "an exact server match must identify the ordered part");
assert(presentationContext.compatible.detailKey === "finished_shipping_picking_compatible", "a compatible server match must identify a registered compatible part");

for (const key of [
  "finished_shipping_compatible_badge",
  "finished_shipping_compatible_assigned",
  "finished_shipping_all_verified",
  "finished_shipping_picking_ok",
  "finished_shipping_picking_ng",
  "finished_shipping_picking_exact",
  "finished_shipping_picking_compatible",
  "finished_shipping_picking_ng_reason"
]) {
  assert((app.match(new RegExp(`\\n    ${key}:`, "g")) || []).length === 3, `${key} must be translated in all supported languages`);
}

console.log("Customer-order compatible serial dispatch UI verification passed.");
