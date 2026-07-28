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
  productKindLabel: (kind) => kind === "rebuilt" ? "リビルト" : kind,
  t: (key) => ({
    product_kind_catalog_spec: "カタログ",
    product_kind_component_count: "構成部品"
  })[key] || key,
  esc: (value) => String(value)
};
vm.runInNewContext(`${renderSource}; result = renderManufacturingCostCandidateStatusLabels;`, sandbox);
const available = sandbox.result({ dkd_shohin_id: 1 });
const missing = sandbox.result({ dkd_shohin_id: 2 });
if (!available.includes("class='badge-catalog'") || !available.includes(">カタログ</span>") ||
    !available.includes("class='badge-component'") || !available.includes("&#x1F9E9; 3") ||
    !available.includes("title='リビルト 構成部品'")) {
  throw new Error("catalog and rebuilt-component labels must reuse sales result badges and icons");
}
if (missing !== "") {
  throw new Error("missing statuses must be omitted like sales result badges");
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

if (!styles.includes(".badge-catalog") || !styles.includes(".badge-component") ||
    styles.includes(".manufacturing-cost-candidate-data-label.catalog.available")) {
  throw new Error("candidate status labels must reuse sales result badge styles without dedicated colors");
}

console.log("manufacturing cost candidate status guard passed");
