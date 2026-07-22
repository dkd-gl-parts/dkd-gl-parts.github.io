const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const source = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");

function functionSource(name) {
  const start = source.indexOf(`function ${name}`);
  if (start < 0) throw new Error(`${name} could not be found`);
  const braceStart = source.indexOf("{", start);
  let depth = 0;
  for (let i = braceStart; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`${name} could not be isolated`);
}

const loaderStart = source.indexOf("async function loadComponentReverseUsageRows");
const kindStart = source.indexOf("function componentReverseKindLabel", loaderStart);
const lookupStart = source.indexOf("async function runComponentReverseLookup");
const lookupEnd = source.indexOf("async function openComponentReverseAssy", lookupStart);

if (loaderStart < 0 || kindStart < loaderStart || lookupStart < kindStart || lookupEnd < lookupStart) {
  throw new Error("component reverse lookup functions could not be isolated");
}

const catalogSource = source.slice(loaderStart, kindStart);
const lookupSource = source.slice(lookupStart, lookupEnd);

if (catalogSource.includes('from("core_products")') || lookupSource.includes('from("core_products")')) {
  throw new Error("reverse lookup must be completed from catalog usage rows without product master enrichment");
}
if (!catalogSource.includes('from("assembly_component_usage_details")') ||
    !catalogSource.includes('.eq("product_kind", "catalog_spec")') ||
    !catalogSource.includes('.order("id", { ascending: true })') ||
    !catalogSource.includes(".range(from, to)")) {
  throw new Error("catalog reverse lookup must page through catalog rows in a stable order");
}
if (!lookupSource.includes("await loadComponentReverseUsageRows(componentIds, scope, selectColumns)")) {
  throw new Error("reverse lookup must use the catalog-aware row loader");
}

const context = {
  normalizedPartKey(value) {
    return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  }
};
vm.createContext(context);
vm.runInContext(functionSource("componentReverseCatalogAssyKey"), context);
vm.runInContext(functionSource("componentReverseHasCatalogAssyNumbers"), context);
vm.runInContext(functionSource("componentReversePreferCatalogAssyRows"), context);
context.uniqueTextValues = values => Array.from(new Set((values || []).filter(Boolean)));
vm.runInContext(functionSource("componentReverseRowsForVehicleMakerMaps"), context);

const rows = [
  { id: 1, assy_manufacturer: "DENSO", assy_manufacturer_part_number: "101211-1120", assy_genuine_part_number: null },
  { id: 2, assy_manufacturer: "DENSO", assy_manufacturer_part_number: "101211-1120", assy_genuine_part_number: "12905-27720-1" },
  { id: 3, assy_manufacturer: "DENSO", assy_manufacturer_part_number: "101211-1120", assy_genuine_part_number: "12905-27720-2" },
  { id: 4, assy_manufacturer: "DENSO", assy_manufacturer_part_number: "101211-9999", assy_genuine_part_number: null }
];
const preferred = context.componentReversePreferCatalogAssyRows(rows);

assert.deepStrictEqual(Array.from(preferred, row => row.id), [2, 3, 4]);
assert(!preferred.some(row => row.id === 1), "blank catalog row must be removed when the same ASSY has genuine-number rows");
assert(preferred.some(row => row.id === 4), "blank catalog row must remain when the ASSY has no genuine-number row");

const vehicleRows = context.componentReverseRowsForVehicleMakerMaps(rows, {
  "1012111120": ["Toyota"]
}, {});
assert.deepStrictEqual(Array.from(vehicleRows, row => row.id), [1, 2, 3]);
assert(vehicleRows.every(row => Array.from(row.component_reverse_vehicle_makers).join(",") === "Toyota"));

const vehicleLoaderStart = source.indexOf("async function loadComponentReverseVehicleMakerMap");
const vehicleLoaderEnd = source.indexOf("function componentReverseRowsForVehicleMakerMaps", vehicleLoaderStart);
const vehicleLoaderSource = source.slice(vehicleLoaderStart, vehicleLoaderEnd);
if (vehicleLoaderStart < 0 || vehicleLoaderEnd < vehicleLoaderStart ||
    !vehicleLoaderSource.includes('from("catalog_vehicle_applications")') ||
    !vehicleLoaderSource.includes('.in("vehicle_manufacturer", makerGroup.aliases)') ||
    !vehicleLoaderSource.includes(".in(field, chunk)")) {
  throw new Error("vehicle maker filtering must use indexed exact catalog application lookups");
}
if (vehicleLoaderSource.includes(".like(") || vehicleLoaderSource.includes(".ilike(")) {
  throw new Error("vehicle maker filtering must not use partial catalog scans");
}
if (!source.includes("component-reverse-assy component-reverse-assy-genuine")) {
  throw new Error("genuine ASSY part numbers must use the same primary font class as manufacturer ASSY part numbers");
}

console.log("component reverse lookup guard passed");
