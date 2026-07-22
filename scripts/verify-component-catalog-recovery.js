const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(path.resolve(__dirname, "..", "app.js"), "utf8");
const recoveryStart = source.indexOf("function catalogComponentRowsNeedDkdRecovery");
const fetchStart = source.indexOf("async function fetchCatalogComponentRowsByDkd", recoveryStart);
const loadStart = source.lastIndexOf("async function loadAssemblyComponentsForCurrent");

if (recoveryStart < 0 || fetchStart < recoveryStart || loadStart < fetchStart) {
  throw new Error("catalog component recovery functions could not be isolated");
}

const recoverySource = source.slice(recoveryStart, fetchStart);
const fetchSource = source.slice(fetchStart, loadStart);
const loadSource = source.slice(loadStart);

if (!recoverySource.includes('selectedKind !== "catalog_spec"') ||
    !recoverySource.includes("rows.length !== 1") ||
    !recoverySource.includes("componentIsCurrentProductSelfReference")) {
  throw new Error("catalog recovery must remain limited to a single catalog self row");
}

if (!fetchSource.includes('.eq("dkd_shohin_id", dkdId)') ||
    !fetchSource.includes('.eq("is_catalog_evidence", true)') ||
    !fetchSource.includes("!genuinePartKey || !genuinePartKeys.length")) {
  throw new Error("catalog recovery must stay scoped to the current DKD product and catalog evidence");
}

const guardIndex = loadSource.indexOf("catalogComponentRowsNeedDkdRecovery(rpcRows, selectedKind)");
const fetchIndex = loadSource.indexOf("await fetchCatalogComponentRowsByDkd(dkdId)", guardIndex);
const replaceIndex = loadSource.indexOf("recovery.rows.length > rpcRows.length", fetchIndex);

if (guardIndex < 0 || fetchIndex < guardIndex || replaceIndex < fetchIndex) {
  throw new Error("catalog recovery must run only after a suspicious RPC result and keep the larger result set");
}

const resolveIndex = loadSource.indexOf("await resolveCurrentCoreDkdShohinId()");
const illustrationIndex = loadSource.indexOf("loadCatalogIllustrationsForCurrent(dkdId, selectedKind)", resolveIndex);
const componentRpcIndex = loadSource.indexOf('sb.rpc("get_variant_catalog_components_for_ui"', illustrationIndex);

if (resolveIndex < 0 || illustrationIndex < resolveIndex || componentRpcIndex < illustrationIndex) {
  throw new Error("catalog illustrations must start immediately after resolving the DKD product");
}
if (loadSource.indexOf("loadCatalogIllustrationsForCurrent(dkdId, selectedKind)", illustrationIndex + 1) >= 0) {
  throw new Error("catalog illustration loading must not be duplicated after component queries");
}

console.log("component catalog recovery guard passed");
