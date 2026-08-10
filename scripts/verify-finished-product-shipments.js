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

assert(html.includes('id="screen-finished-product-shipping"'), "shipment screen is missing");
assert(html.includes('id="finished-shipment-serial-input"'), "serial scanner input is missing");
assert(html.includes('id="finished-shipment-customer"'), "shipment customer selector is missing");
assert(html.includes('id="finished-shipment-shipped-on" type="date"'), "shipment date input is missing");
assert(html.includes('id="finished-shipment-warranty-months" type="number" min="1" max="120"'), "warranty-month guard is missing");
assert(css.includes(".finished-shipment-shell"), "shipment layout styles are missing");
assert(html.includes('<th data-i18n="actions">操作</th>'), "shipment action column heading is missing");
assert(html.includes('<th data-i18n="gltek_part_number_label">GLTEK品番</th>'), "shipment GLTEK part-number heading must use a translated label");
assert(!html.includes('data-i18n="f_gltek_pn"'), "shipment table must not expose an untranslated legacy key");
assert(/\.finished-shipment-table\s*\{[^}]*min-width:\s*0[^}]*table-layout:\s*fixed/s.test(css), "shipment table must fit its pane without forcing horizontal scrolling");
assert(/\.finished-shipment-table th:nth-child\(4\)\s*\{[^}]*width:\s*52px[^}]*text-align:\s*center/s.test(css), "shipment action column must remain visible at a fixed width");
assert(/\.finished-shipment-table th,\s*\.finished-shipment-table td\s*\{[^}]*overflow-wrap:\s*anywhere/s.test(css), "shipment identifiers must wrap inside their columns");
assert(functionSource("renderFinishedShipmentUnits").includes('aria-label=\'" + esc(t("finished_label_component_remove") + " " + unit.manufacturing_serial)'), "shipment remove action must have a serial-specific accessible name");
assert(app.includes('action: "finished-product-shipping"'), "shipment menu action is missing");
assert(app.includes('"finished_product_shipping.manage"'), "shipment permission key is missing");

const saveSource = functionSource("saveFinishedProductShipment");
assert(saveSource.includes('sb.rpc("ship_finished_product_units"'), "atomic shipment RPC is not called");
assert(!saveSource.includes('.from("finished_product_units").update('), "browser mutates unit lifecycle directly");
assert(!saveSource.includes('.from("core_product_variants").update('), "browser mutates stock directly");

const cancelSource = functionSource("cancelFinishedProductShipment");
assert(cancelSource.includes('sb.rpc("cancel_finished_product_shipment"'), "audited cancellation RPC is not called");
assert(cancelSource.includes("target_reason"), "shipment cancellation reason is not sent");

const scanSource = functionSource("addFinishedShipmentSerial");
assert(scanSource.includes('.from("finished_product_units")'), "serial scan does not look up finished units");
assert(scanSource.includes('r.data.status !== "available"'), "unavailable units are not blocked from shipment");
assert(functionSource("renderFinishedShipmentLookup").includes("finishedShipmentWarrantyState"), "serial lookup does not show warranty state");
assert(functionSource("loadFinishedShipmentHistory").includes('.from("finished_product_shipments")'), "shipment history is not loaded");

const sandbox = {
  normalizeAsciiWidth(value) { return String(value); }
};
vm.createContext(sandbox);
vm.runInContext(`${functionSource("normalizeFinishedShipmentSerial")}; this.normalizeSerial = normalizeFinishedShipmentSerial;`, sandbox);
assert(sandbox.normalizeSerial(" m2026-0000001 ") === "M2026-0000001", "serial normalization failed");

console.log("Finished-product shipment, stock, and warranty UI checks passed.");
