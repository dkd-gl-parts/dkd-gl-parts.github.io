const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8").replace(/\r\n/g, "\n");
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
  ".sales-order-detail-summary strong { margin-top: 3px; font-size: 15px;",
  ".sales-order-detail-nav button { min-height: 44px; padding: 8px 14px; font-size: 14px; }",
  ".sales-order-detail-overview-grid { grid-template-columns: minmax(0, 1fr);",
  ".sales-order-item-row { min-height: 64px; font-size: 15px;",
  ".sales-order-item-row > div small { margin-top: 2px; font-size: 12px;",
  "word-break: keep-all; overflow-wrap: anywhere;",
  "@media screen and (min-width: 1081px)",
  "@media screen and (min-width: 1200px)",
  ".sales-order-mgmt-body { grid-template-columns: 330px minmax(0, 1fr); }",
  ".sales-order-workspace { grid-template-columns: 330px minmax(0, 1fr); }",
  ".sales-order-toolbar { display: block; padding: 10px 16px; }",
  ".sales-order-title-block { display: none; }",
  ".sales-order-detail-overview-grid { grid-template-columns: minmax(485px, 1.03fr) minmax(410px, .97fr);",
  ".sales-order-detail-overview-grid .sales-order-item-head,",
  "grid-template-columns: minmax(95px, 1fr) 54px 28px 56px 60px 58px 72px; min-width: 0;",
  ".sales-order-detail-overview-grid .sales-order-address .sales-order-section-heading { grid-column: 1 / -1; grid-row: 1; }",
  ".sales-order-detail-overview-grid .sales-order-address-destination { grid-column: 1; grid-row: 2; }",
  ".sales-order-detail-overview-grid .sales-order-address dl { grid-column: 2; grid-row: 2;",
  ".sales-order-detail-overview-grid .sales-order-shipping-schedule small { display: none; }",
  "@media screen and (max-width: 1199px)",
  "@media screen and (max-width: 820px)",
  ".sales-order-dashboard-metrics { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));",
  ".sales-order-detail-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }",
  ".sales-order-address { grid-template-columns: 1fr; }"
]) requireFragment(fragment);

const undersized = readableCss.match(/font-size:\s*(?:[0-9]|1[01])px/g);
if (undersized) {
  throw new Error(`Readable sales-order override contains undersized type: ${undersized.join(", ")}`);
}

console.log("Sales order readable typography and responsive layout verification passed.");
