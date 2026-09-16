const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const source = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");

function functionSource(name) {
  const marker = `function ${name}(`;
  const markerStart = source.indexOf(marker);
  assert(markerStart >= 0, `${name} is missing`);
  const start = source.slice(Math.max(0, markerStart - 6), markerStart) === "async "
    ? markerStart - 6
    : markerStart;
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let i = bodyStart; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`${name} is incomplete`);
}

const lookupSource = functionSource("lookupSharedComponentUnitPrice");
const addReconcileSource = functionSource("reconcileComponentAddPartNumbers");
const editReconcileSource = functionSource("reconcileComponentEditPartNumbers");
const saveSource = functionSource("saveComponentEdit");

assert(lookupSource.includes('sb.rpc("get_component_shared_unit_price"'));
assert(lookupSource.includes("matching_usage_count"));
assert(lookupSource.includes("distinct_price_count"));
assert(addReconcileSource.includes("lookupSharedComponentUnitPrice"));
assert(addReconcileSource.includes('document.getElementById("component-add-unit-price")'));
assert(addReconcileSource.includes("!String(unitPriceInput.value || \"\").trim()"));
assert(editReconcileSource.includes("identityChanged"));
assert(editReconcileSource.includes("lookupSharedComponentUnitPrice"));
assert(saveSource.includes('sb.rpc("update_manual_assembly_component"'));
assert(saveSource.includes("target_component_unit_price_jpy"));
assert(saveSource.includes("shared_price_updated_count"));
assert(!saveSource.includes('.from("component_parts").insert'));
assert(!saveSource.includes('.from("component_parts").update'));
assert(!saveSource.includes('.from("assembly_component_usages").update'));

const calls = [];
const sandbox = {
  console,
  normalizeComponentPartNumberInput: (value) => String(value || "").trim().toUpperCase(),
  normalizeComponentManufacturerInput: (value) => String(value || "").trim().toUpperCase(),
  sb: {
    rpc: async (name, args) => {
      calls.push({ name, args });
      return {
        data: [{
          unit_price_jpy: 48,
          matching_usage_count: "7",
          priced_usage_count: "7",
          distinct_price_count: "2"
        }],
        error: null
      };
    }
  }
};
vm.runInNewContext(`${lookupSource}; result = lookupSharedComponentUnitPrice("同力汽車", "a220");`, sandbox);

Promise.resolve(sandbox.result).then((result) => {
  assert.deepStrictEqual(JSON.parse(JSON.stringify(result)), {
    unitPrice: 48,
    matchingUsageCount: 7,
    pricedUsageCount: 7,
    distinctPriceCount: 2
  });
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].name, "get_component_shared_unit_price");
  assert.strictEqual(calls[0].args.component_manufacturer, "同力汽車");
  assert.strictEqual(calls[0].args.component_manufacturer_part_number, "A220");
  console.log("component shared unit-price guard passed");
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
