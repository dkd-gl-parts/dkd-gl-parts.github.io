const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

function requireSource(fragment, message) {
  if (!source.includes(fragment)) throw new Error(message);
}

if (!/<option value="multiple" data-i18n="purchase_link_filter_multiple">/.test(html)) {
  throw new Error("purchase management multiple-link filter is missing");
}

requireSource('if (linkStatusFilter === "multiple") return linkCount > 1;', "multiple-link filtering must require at least two active linked products");
requireSource("purchaseMgmtMatchesLinkFilter(row, linkStatusFilter, true)", "Stronghold catalog rows must use the multiple-link filter");
requireSource("purchaseMgmtMatchesLinkFilter(row, linkStatusFilter, false)", "SL rows must use the multiple-link filter");
requireSource("data-purchase-record-kind='catalog'", "Stronghold rows need a stable record anchor");
requireSource("data-purchase-record-kind='sl'", "SL rows need a stable record anchor");
requireSource("applyPurchaseMgmtUnlinkLocally(affectedRow, id, true, anchor)", "Stronghold unlink must update the current row in place");
requireSource("applyPurchaseMgmtUnlinkLocally(affectedRow, id, false, anchor)", "SL unlink must update the current row in place");
requireSource("restorePurchaseMgmtRecordAnchor(anchor);", "unlink rendering must restore the edited record position");
requireSource("purchase-multiple-link-badge", "multiple-link records need a visible count badge");

function readFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`${name} is missing`);
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  for (let i = bodyStart; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`${name} is incomplete`);
}

const context = {};
vm.runInNewContext([
  readFunction("purchaseCatalogRowStatus"),
  readFunction("purchaseMgmtLinkCount"),
  readFunction("purchaseMgmtMatchesLinkFilter")
].join("\n"), context);

const row = (count, supplierPn = "SL-1") => ({
  catalogItem: { supplier_pn: supplierPn },
  products: Array.from({ length: count }, (_, index) => ({ id: index + 1 }))
});
if (context.purchaseMgmtMatchesLinkFilter(row(1), "multiple", false)) {
  throw new Error("a single link must not match the multiple-link filter");
}
if (!context.purchaseMgmtMatchesLinkFilter(row(2), "multiple", false) ||
    !context.purchaseMgmtMatchesLinkFilter(row(3), "multiple", true)) {
  throw new Error("two or more links must match in both purchase data modes");
}
if (!context.purchaseMgmtMatchesLinkFilter(row(0), "unlinked", false) ||
    !context.purchaseMgmtMatchesLinkFilter(row(1), "linked", false)) {
  throw new Error("existing SL link filters must keep their behavior");
}
if (!context.purchaseMgmtMatchesLinkFilter(row(1, ""), "unlinked", true)) {
  throw new Error("Stronghold rows with a missing SL number must remain in the unlinked filter");
}

const unlinkEvents = { catalogRendered: false, anchorRestored: false };
const unlinkContext = {
  purchaseMgmtSummary: { total: 1, linked: 1, coreUnlinked: 0, multiple: 1 },
  purchaseMgmtProductMap: {},
  purchaseMgmtLinkMap: {},
  renderStrongholdCatalogMgmt() { unlinkEvents.catalogRendered = true; },
  renderPurchaseMgmt() {},
  restorePurchaseMgmtRecordAnchor() { unlinkEvents.anchorRestored = true; }
};
vm.runInNewContext([
  readFunction("purchaseMgmtLinkCount"),
  readFunction("applyPurchaseMgmtUnlinkLocally")
].join("\n"), unlinkContext);
const unlinkRow = {
  catalogItem: { id: 10, supplier_pn: "SL-10" },
  products: [
    { link: { id: 100 }, product: { dkd_shohin_id: 1 } },
    { link: { id: 200 }, product: { dkd_shohin_id: 2 } }
  ],
  links: [{ id: 100 }, { id: 200 }]
};
if (!unlinkContext.applyPurchaseMgmtUnlinkLocally(unlinkRow, 100, true, {})) {
  throw new Error("a successful unlink must update the current purchase row locally");
}
if (unlinkRow.products.length !== 1 || unlinkRow.links.length !== 1 || unlinkContext.purchaseMgmtSummary.multiple !== 0) {
  throw new Error("the locally retained row must reflect the link removal and resolved multiple-link count");
}
if (!unlinkEvents.catalogRendered || !unlinkEvents.anchorRestored) {
  throw new Error("the edited row must be rendered and restored without returning to the first row");
}

console.log("purchase multiple-link management guard passed");
