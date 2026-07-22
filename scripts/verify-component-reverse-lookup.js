const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");
const hydrateStart = source.indexOf("async function hydrateComponentReverseAssyProducts");
const kindStart = source.indexOf("function componentReverseKindLabel", hydrateStart);
const lookupStart = source.indexOf("async function runComponentReverseLookup");
const lookupEnd = source.indexOf("async function openComponentReverseAssy", lookupStart);

if (hydrateStart < 0 || kindStart < hydrateStart || lookupStart < kindStart || lookupEnd < lookupStart) {
  throw new Error("component reverse lookup functions could not be isolated");
}

const hydrateSource = source.slice(hydrateStart, kindStart);
const lookupSource = source.slice(lookupStart, lookupEnd);

if (!hydrateSource.includes('.in("normalized_manufacturer_part_number", chunks[i])') ||
    !hydrateSource.includes("componentReverseExpandRowWithMasters") ||
    !source.includes("assy_genuine_part_number: row.assy_genuine_part_number || product.genuine_part_number")) {
  throw new Error("reverse lookup must enrich blank ASSY genuine numbers from exact master products");
}
if (hydrateSource.includes(".like(") || hydrateSource.includes(".ilike(")) {
  throw new Error("reverse ASSY enrichment must use indexed exact lookups");
}

const hydrateCall = lookupSource.indexOf("await hydrateComponentReverseAssyProducts(r.data || [])");
const dedupeCall = lookupSource.indexOf("componentReverseDedupRows(hydratedRows)", hydrateCall);
if (hydrateCall < 0 || dedupeCall < hydrateCall) {
  throw new Error("reverse lookup rows must be enriched before deduplication and rendering");
}

console.log("component reverse lookup guard passed");
