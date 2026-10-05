const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const acorn = require("acorn");
const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "manufacturing-cost-workspace.css"), "utf8");
const ast = acorn.parse(source, { ecmaVersion: "latest" });
const names = [
  "manufacturingCostConfirmationNotes", "renderManufacturingCostProductDetail",
  "selectManufacturingCostProduct", "renderManufacturingCostRows", "renderManufacturingCostSummary",
  "renderManufacturingCostLoading", "renderManufacturingCostDetailLoading", "openManufacturingCostSettings", "closeManufacturingCostSettings",
  "handleManufacturingCostSettingsKeydown", "closeManufacturingCostCategoryCoreSettings"
];
const declarations = names.map(name => {
  const n = ast.body.find(n => n.type === "FunctionDeclaration" && n.id.name === name);
  assert(n, name);
  return source.slice(n.start, n.end);
});
function element() {
  const classes = new Set();
  return { innerHTML: "", textContent: "", disabled: false, open: false, inert: false,
    classList: { add: v => classes.add(v), remove: v => classes.delete(v), contains: v => classes.has(v), toggle: (v,on) => on ? classes.add(v) : classes.delete(v) },
    querySelector: () => null, querySelectorAll: () => [], focus() { context.document.activeElement = this; },
    scrollIntoView() { this.scrolled = true; }, getClientRects: () => [{}] };
}
const elements = Object.fromEntries([
  "manufacturing-cost-detail", "manufacturing-cost-detail-panel", "manufacturing-cost-detail-heading",
  "manufacturing-cost-list", "manufacturing-cost-count", "manufacturing-cost-summary",
  "btn-manufacturing-cost-remove-open", "manufacturing-cost-settings-overlay",
  "screen-manufacturing-cost-mgmt", "btn-manufacturing-cost-settings-open",
  "manufacturing-cost-category-core-overlay", "btn-manufacturing-cost-category-core-open"
].map(id => [id, element()]));
const escape = v => String(v).replace(/[&<>"']/g,c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const row = id => ({
  productId: id, product: { genuine_part_number: "PART-" + id, manufacturer_part_number: "MFR-" + id, manufacturer: "DENSO", category: "ALT" },
  components: [{}], componentCount: 1, partsCost: 248, coreCost: 2000, laborCost: 1000,
  transportCost: 0, packagingCost: 500, documentsCost: 10, sellingExpense: 510,
  coreReturnShippingCost: 0, gltekSubtotal: 3248, dkdSubtotal: 510, totalCost: 3758
});
let mobile = false, editable = true, permitted = true;
const context = {
  document: { activeElement: null, getElementById: id => elements[id] || null },
  window: { matchMedia: () => ({matches:mobile}) }, alert: () => { context.denied = true; },
  esc: escape, t: key => key, tf: (key,v) => key + " " + Object.values(v).join(" "),
  tCat: key => key, manufacturingCostCategoryLabel: key => key,
  manufacturingCostProductTitle: p => p.genuine_part_number || p.manufacturer_part_number,
  manufacturingCostYen: v => "¥" + Number(v || 0).toLocaleString("en-US"),
  canEditManufacturingCostMgmt: () => editable, canViewManufacturingCostMgmt: () => permitted,
  renderManufacturingCostComponentDetails: (r,i) => "<details data-index='" + i + "'>components</details>",
  bindManufacturingCostComponentDetailToggles: () => {},
  manufacturingCostRows: [row(1), row(2)], manufacturingCostSelectedProductId: null
};
vm.createContext(context);
vm.runInContext(declarations.join("\n"), context);
context.renderManufacturingCostRows();
assert.equal(context.manufacturingCostSelectedProductId, "1");
assert.match(elements["manufacturing-cost-detail"].innerHTML, /PART-1/);
assert.match(elements["manufacturing-cost-detail"].innerHTML, /<div class='manufacturing-cost-detail-product-id'><dt>f_product_id<\/dt><dd>1<\/dd><\/div>/, "Product ID uses a translated label and its own inline metadata row");
assert(!elements["manufacturing-cost-detail"].innerHTML.includes("<dt>DKD</dt>"), "The detail ID label is Product ID, not the company name");
assert.match(elements["manufacturing-cost-list"].innerHTML, /aria-pressed='true'/);
assert(!elements["manufacturing-cost-list"].innerHTML.includes("manufacturing-cost-breakdown"));
assert.match(elements["manufacturing-cost-summary"].innerHTML, /¥7,516/);
context.selectManufacturingCostProduct(2);
assert.equal(context.manufacturingCostSelectedProductId, "2");
assert.match(elements["manufacturing-cost-detail"].innerHTML, /MFR-2/);
assert.match(elements["manufacturing-cost-detail"].innerHTML, /manufacturing-cost-detail-product-id'><dt>f_product_id<\/dt><dd>2<\/dd>/, "Product ID follows the selected product");
context.selectManufacturingCostProduct(999);
assert.equal(context.manufacturingCostSelectedProductId, "2");
context.manufacturingCostRows[1].totalCost = 4000;
context.renderManufacturingCostRows();
assert.equal(context.manufacturingCostSelectedProductId, "2");
assert.match(elements["manufacturing-cost-detail"].innerHTML, /¥4,000/);
const incomplete = {...row(3), componentCount:0, missingUnitCount:3, missingQuantityCount:2, missingReplacementRateCount:1, savedSnapshotUnitPriceDiffers:true };
assert.equal(context.manufacturingCostConfirmationNotes(incomplete).length, 5);
context.manufacturingCostRows = [incomplete];
context.renderManufacturingCostRows();
for (const key of ["no_components","missing_unit","missing_quantity","missing_replacement_rate","snapshot_unit_price_changed"]) {
  assert.match(elements["manufacturing-cost-list"].innerHTML, new RegExp("manufacturing_cost_" + key));
  assert.match(elements["manufacturing-cost-detail"].innerHTML, new RegExp("manufacturing_cost_" + key));
}
context.manufacturingCostRows[0].product.genuine_part_number = '<img src=x onerror="bad">';
context.renderManufacturingCostRows();
assert(!elements["manufacturing-cost-detail"].innerHTML.includes("<img src=x"));
assert.match(elements["manufacturing-cost-detail"].innerHTML, /&lt;img/);
context.manufacturingCostRows = [row(1)];
context.renderManufacturingCostRows();
assert.equal(context.manufacturingCostSelectedProductId, "1");
context.manufacturingCostRows = [];
context.renderManufacturingCostRows();
assert.equal(context.manufacturingCostSelectedProductId, null);
assert(elements["btn-manufacturing-cost-remove-open"].disabled);
assert.match(elements["manufacturing-cost-detail"].innerHTML, /detail_empty/);
context.renderManufacturingCostDetailLoading();
assert(!elements["manufacturing-cost-detail"].innerHTML.includes("PART-1"));
assert.match(elements["manufacturing-cost-detail"].innerHTML, /loading/);
mobile = true;
context.manufacturingCostRows = [row(1),row(2)];
context.renderManufacturingCostRows();
assert.equal(elements["manufacturing-cost-detail-panel"].open, false);
context.selectManufacturingCostProduct(2);
assert.equal(elements["manufacturing-cost-detail-panel"].open, true);
assert(elements["manufacturing-cost-detail-panel"].scrolled);
editable = false;
context.renderManufacturingCostRows();
assert(elements["btn-manufacturing-cost-remove-open"].disabled);
context.openManufacturingCostSettings();
assert(elements["screen-manufacturing-cost-mgmt"].inert);
assert(elements["manufacturing-cost-settings-overlay"].classList.contains("show"));
let prevented = false;
context.handleManufacturingCostSettingsKeydown({ key:"Escape", preventDefault() { prevented = true; } });
assert(prevented);
assert(!elements["screen-manufacturing-cost-mgmt"].inert);
assert.equal(context.document.activeElement, elements["btn-manufacturing-cost-settings-open"]);
context.openManufacturingCostSettings();
const categoryOverlay = elements["manufacturing-cost-category-core-overlay"];
const firstCategoryInput = element(), categoryClose = element();
categoryOverlay.classList.add("show");
categoryOverlay.querySelectorAll = () => [firstCategoryInput, categoryClose];
categoryClose.focus();
context.handleManufacturingCostSettingsKeydown({ key:"Tab", preventDefault() {} });
assert.equal(context.document.activeElement, firstCategoryInput);
context.handleManufacturingCostSettingsKeydown({ key:"Tab", shiftKey:true, preventDefault() {} });
assert.equal(context.document.activeElement, categoryClose);
context.handleManufacturingCostSettingsKeydown({ key:"Escape", preventDefault() {} });
assert(!categoryOverlay.classList.contains("show"));
assert(elements["manufacturing-cost-settings-overlay"].classList.contains("show"));
assert.equal(context.document.activeElement, elements["btn-manufacturing-cost-category-core-open"]);
context.closeManufacturingCostSettings();
permitted = false;
context.openManufacturingCostSettings();
assert(context.denied);
assert(!elements["manufacturing-cost-settings-overlay"].classList.contains("show"));
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(ids.length, new Set(ids).size, "No duplicate IDs after moving existing controls");
assert(html.includes('id="manufacturing-cost-settings-overlay" role="dialog" aria-modal="true"'));
assert(css.includes("@media (max-width: 1100px)") && css.includes("@media (max-width: 700px)"));
assert.match(css, /\.manufacturing-cost-detail-identity\s*\{\s*display:\s*block;/, "Part-number heading must use the full detail width, not share a narrow column with metadata");
assert.match(css, /\.manufacturing-cost-detail-identity h3\s*\{[^}]*font-size:\s*24px/, "Keep the readable part-number heading size");
assert.match(css, /\.manufacturing-cost-detail-identity dl\s*\{[^}]*repeat\(2, minmax\(0, 1fr\)\)/, "Metadata remains below the heading in two columns");
assert.match(css, /\.manufacturing-cost-detail-identity \.manufacturing-cost-detail-product-id\s*\{[^}]*grid-column:\s*1\s*\/\s*-1;[^}]*display:\s*flex;[^}]*align-items:\s*baseline;/, "Product ID label and number share one full-width row");
assert.match(css, /\.manufacturing-cost-detail-product-id dt\s*\{[^}]*margin-bottom:\s*0;[^}]*white-space:\s*nowrap;/, "The ID label no longer leaves vertical label spacing");
assert.match(css, /\.manufacturing-cost-detail-product-id dd\s*\{[^}]*white-space:\s*nowrap;/, "The numeric ID stays on one line");
assert(!/<style\b|\sstyle\s*=|\son\w+\s*=/.test(html));
const version = source.match(/var\s+APP_VERSION\s*=\s*"v([^"]+)"/)[1];
assert(html.includes("manufacturing-cost-workspace.css?v=" + version));
assert(fs.readFileSync(path.join(root,"scripts/build-static-site.js"),"utf8").includes('"manufacturing-cost-workspace.css"'));
for (const icon of ["gear","file-earmark-spreadsheet"]) {
  assert(fs.existsSync(path.join(root,"assets/icons/cost-" + icon + ".svg")));
}
assert(fs.existsSync(path.join(root,"assets/icons/bootstrap-icons-LICENSE.txt")));
console.log("manufacturing cost workspace: selection, warnings, stale/empty, escape, mobile, permissions, assets passed");
