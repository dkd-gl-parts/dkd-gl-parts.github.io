const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "styles.css"), "utf8");

function functionSource(name, nextName) {
  const start = source.indexOf(`function ${name}`);
  const asyncStart = source.indexOf(`async function ${name}`);
  const actualStart = start >= 0 && asyncStart >= 0 ? Math.min(start, asyncStart) : Math.max(start, asyncStart);
  const end = source.indexOf(nextName, actualStart + 1);
  if (actualStart < 0 || end < actualStart) throw new Error(`${name} could not be isolated`);
  return source.slice(actualStart, end);
}

const loadSource = functionSource("loadManufacturingCostCandidateStatuses", "function renderManufacturingCostCandidateStatusLabels");
if (!loadSource.includes("fetchProductVariantSummaryMap(rows)") ||
    !loadSource.includes("fetchProductionPartRegistrationCountMap(rows)") ||
    !loadSource.includes("productKindSummaryHasKind") ||
    !loadSource.includes("rebuiltComponentCount")) {
  throw new Error("manufacturing cost candidates must load catalog and rebuilt-component status in bulk");
}

const renderSource = functionSource("renderManufacturingCostCandidateStatusLabels", "function renderManufacturingCostCandidates");
const sandbox = {
  manufacturingCostCandidateStatusMap: {
    "1": { hasCatalog: true, rebuiltComponentCount: 3 },
    "2": { hasCatalog: false, rebuiltComponentCount: 0 }
  },
  productDkdId: (product) => product.dkd_shohin_id,
  t: (key) => ({
    manufacturing_cost_candidate_catalog_yes: "カタログあり",
    manufacturing_cost_candidate_catalog_no: "カタログなし",
    manufacturing_cost_candidate_rebuilt_components_none: "リビルト構成なし"
  })[key] || key,
  tf: (_key, values) => `リビルト構成 ${values.n} 件`,
  esc: (value) => String(value)
};
vm.runInNewContext(`${renderSource}; result = renderManufacturingCostCandidateStatusLabels;`, sandbox);
const available = sandbox.result({ dkd_shohin_id: 1 });
const missing = sandbox.result({ dkd_shohin_id: 2 });
if (!available.includes("カタログあり") || !available.includes("リビルト構成 3 件") ||
    !available.includes("catalog available") || !available.includes("rebuilt available")) {
  throw new Error("available catalog and rebuilt-component labels must be rendered with counts");
}
if (!missing.includes("カタログなし") || !missing.includes("リビルト構成なし") ||
    !missing.includes("catalog missing") || !missing.includes("rebuilt missing")) {
  throw new Error("missing catalog and rebuilt-component labels must remain visible");
}

const candidatesSource = functionSource("renderManufacturingCostCandidates", "function selectedManufacturingCostCandidateProducts");
if (!candidatesSource.includes("renderManufacturingCostCandidateStatusLabels(product)")) {
  throw new Error("candidate rows must include catalog and rebuilt-component status labels");
}

const searchSource = functionSource("searchManufacturingCostCandidates", "async function calculateSelectedManufacturingCost");
const statusLoadAt = searchSource.indexOf("await loadManufacturingCostCandidateStatuses(products)");
const renderAt = searchSource.indexOf("renderManufacturingCostCandidates(products");
if (statusLoadAt < 0 || renderAt < 0 || statusLoadAt > renderAt ||
    !searchSource.includes("manufacturingCostCandidateRequestSeq")) {
  throw new Error("candidate statuses must load before rendering and stale searches must be ignored");
}

if (!styles.includes(".manufacturing-cost-candidate-data-label.catalog.available") ||
    !styles.includes(".manufacturing-cost-candidate-data-label.rebuilt.available") ||
    !styles.includes(".manufacturing-cost-candidate-data-label.missing")) {
  throw new Error("candidate status labels must provide distinct available and missing states");
}

console.log("manufacturing cost candidate status guard passed");
