const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8").replace(/\r\n/g, "\n");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8").replace(/\r\n/g, "\n");
const revision = fs.readFileSync(path.join(root, "sales-order-revision.js"), "utf8").replace(/\r\n/g, "\n");
const marker = "/* Match order operations to the readable type scale used by shipping documents. */";
const markerIndex = css.indexOf(marker);

if (markerIndex < 0) throw new Error("Readable sales-order layout override is missing");
const readableCss = css.slice(markerIndex);

function requireFragment(fragment, message) {
  if (!readableCss.includes(fragment)) throw new Error(message || `Missing readable sales-order layout contract: ${fragment}`);
}

for (const fragment of [
  "#screen-sales-order-mgmt { font-size: 14px; line-height: 1.5; }",
  ".sales-order-mgmt-body :where(div, span, strong, small, p, em, label, a, button, input, select, summary, dt, dd, time) { font-size: inherit; }",
  ".sales-order-toolbar h1 { margin-top: 0; font-size: 24px; line-height: 1.3; }",
  ".sales-order-filter-row :is(input, select, button)",
  "height: 40px; min-height: 40px;",
  ".sales-order-dashboard-metric span { overflow: visible; font-size: 12px;",
  ".sales-order-dashboard-metric strong { font-size: 20px; }",
  ".sales-order-list-identity > strong { font-size: 16px;",
  ".sales-order-list-row { grid-template-columns: 22px minmax(0, 1fr);",
  ".sales-order-detail-head h2 { margin-top: 2px; font-size: 24px;",
  ".sales-order-progress-step > strong { overflow: visible; font-size: 12px;",
  ".sales-order-detail-total strong { font-size: 18px;",
  ".sales-order-detail-nav button { min-height: 44px; padding: 8px 14px; font-size: 14px; }",
  ".sales-order-detail-overview-grid { grid-template-columns: minmax(0, 1fr);",
  ".sales-order-item-row { min-height: 64px; font-size: 15px;",
  ".sales-order-item-row > div small { margin-top: 2px; font-size: 12px;",
  ".sales-order-core-charge-row { min-height: 52px; }",
  ".sales-order-total-row > strong:nth-child(5) { font-size: 18px; }",
  "word-break: keep-all; overflow-wrap: anywhere;",
  "@media screen and (min-width: 1081px)",
  "@media screen and (min-width: 1200px)",
  ".sales-order-mgmt-body { grid-template-columns: 330px minmax(0, 1fr); }",
  ".sales-order-workspace { grid-template-columns: 330px minmax(0, 1fr); }",
  ".sales-order-toolbar { display: block; padding: 10px 16px; }",
  ".sales-order-title-block { display: none; }",
  ".sales-order-detail-overview-grid { grid-template-columns: minmax(0, 1fr); align-items: start;",
  ".sales-order-detail-overview-grid .sales-order-item-table { overflow-x: auto; }",
  ".sales-order-detail-overview-grid .sales-order-item-head,",
  "grid-template-columns: minmax(240px, 1.75fr) minmax(120px, .75fr) 72px 120px 128px; min-width: 740px;",
  ".sales-order-detail-overview-grid .sales-order-address .sales-order-section-heading { grid-column: 1 / -1; grid-row: 1; }",
  ".sales-order-detail-overview-grid .sales-order-address-destination { grid-column: 1; grid-row: 2; }",
  ".sales-order-detail-overview-grid .sales-order-address dl { grid-column: 2; grid-row: 2;",
  ".sales-order-detail-overview-grid .sales-order-shipping-schedule { grid-column: 3; grid-row: 2;",
  ".sales-order-detail-overview-grid .sales-order-vehicle-information { grid-column: 1 / -1; grid-row: 3; }",
  ".sales-order-detail-overview-grid .sales-order-shipping-schedule small { display: none; }",
  "@media screen and (max-width: 1199px)",
  "@media screen and (max-width: 820px)",
  ".sales-order-dashboard-metrics { display: flex; overflow-x: auto;",
  ".sales-order-address { grid-template-columns: 1fr; }"
]) requireFragment(fragment);

for (const fragment of [
  "sales-order-history-group sales-order-pricing-history",
  "sales-order-history-row sales-order-pricing-history-row",
  "sales-order-history-kind pricing'>金額変更",
  "sales-order-history-list sales-order-shipment-history",
  "sales-order-history-kind-cell",
  "sales-order-history-file",
  "sales-order-history-group'><h4>発送履歴"
]) {
  if (!app.includes(fragment)) throw new Error(`Missing aligned sales-order history markup: ${fragment}`);
}

for (const fragment of [
  "sales-order-history-group sales-order-revision-history",
  "sales-order-history-row sales-order-revision-history-row",
  "sales-order-history-kind revision'>受注修正",
  "帳票・送り状 再発行要",
  "反映済み"
]) {
  if (!revision.includes(fragment)) throw new Error(`Missing aligned revision history markup: ${fragment}`);
}

for (const fragment of [
  ".sales-order-history-row { grid-template-columns: 142px 112px minmax(220px, 1fr) minmax(190px, .82fr);",
  ".sales-order-history-file { word-break: normal; overflow-wrap: anywhere; }",
  "grid-template-areas:",
  '"time kind"',
  '"content content"',
  '"result result"'
]) requireFragment(fragment);

for (const fragment of [
  "/* Product Design audit: clarify hierarchy in the order operations workspace. */",
  ".sales-order-dashboard-metrics { gap: 0; overflow: hidden; border: 1px solid #cfd7dd;",
  ".sales-order-dashboard-metric.active { border-color: #dde3e7; box-shadow: inset 0 -3px 0 #287356;",
  ".sales-order-detail-navigation { display: flex;",
  ".sales-order-waybill-progress-grid { display: grid; grid-template-columns: minmax(0, 1fr); }",
  ".sales-order-print-jobs > summary { display: flex;",
  ".sales-order-dashboard-metric { flex: 0 0 118px; min-width: 118px;"
]) requireFragment(fragment);

for (const [label, pattern] of [
  ["stacked dashboard label and count", /#screen-sales-order-mgmt \.sales-order-dashboard-metric\s*\{[^}]*flex-direction:\s*column;[^}]*gap:\s*2px;/s],
  ["wrapping dashboard label", /#screen-sales-order-mgmt \.sales-order-dashboard-metric span\s*\{[^}]*overflow-wrap:\s*anywhere;[^}]*white-space:\s*normal;/s],
  ["separated dashboard count", /#screen-sales-order-mgmt \.sales-order-dashboard-metric strong\s*\{[^}]*align-self:\s*flex-end;[^}]*margin-left:\s*0;/s]
]) {
  if (!pattern.test(readableCss)) throw new Error(`Missing overlap guard: ${label}`);
}

for (const fragment of [
  ".sales-order-item-head > :nth-child(n + 3),",
  ".sales-order-item-row > :nth-child(n + 3) { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }",
  ".sales-order-core-charge-row { background: transparent; }",
  ".sales-order-charge-row { background: #fbfcfc; }",
  ".sales-order-shipping-row { border-top: 2px solid #cdd8d2; }",
  ".sales-order-total-row { border-top: 2px solid #8bb19e;"
]) {
  if (!css.includes(fragment)) throw new Error(`Missing billing-detail row style: ${fragment}`);
}

for (const obsolete of [
  ".sales-order-product-row.has-core-charge",
  ".sales-order-core-charge-row { border-left: 3px solid #d2a543;",
  ".sales-order-core.required",
  ".sales-order-core.charged"
]) {
  if (css.includes(obsolete)) throw new Error(`Obsolete billing-detail emphasis remains: ${obsolete}`);
}

if (css.includes(".sales-order-billing-summary")) {
  throw new Error("Detached billing summary styles must be removed");
}

const undersized = readableCss.match(/font-size:\s*(?:[0-9]|1[01])px/g);
if (undersized) {
  throw new Error(`Readable sales-order override contains undersized type: ${undersized.join(", ")}`);
}

console.log("Sales order readable typography and responsive layout verification passed.");
