const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const report = fs.readFileSync(path.join(root, "customer-price-report.js"), "utf8");
const css = fs.readFileSync(path.join(root, "customer-price-report-print.css"), "utf8");
const screenCss = fs.readFileSync(path.join(root, "customer-price-report.css"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const build = fs.readFileSync(path.join(root, "scripts", "build-static-site.js"), "utf8");
const workflow = fs.readFileSync(path.join(root, ".github", "workflows", "search-performance-guard.yml"), "utf8");

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

expect(/async function openCustomerPriceList\(\)\s*{[\s\S]*?await enterCustomerPriceReport\(currentCustomerAccessCustomer\.id\);\s*}/.test(app),
  "existing customer-price-list action must open the new report flow");
expect(app.includes('action: "report-hub"'), "reports menu must open its hub");
[
  'sb.rpc("get_customer_price_report_preview"',
  'sb.rpc("issue_customer_price_report"',
  'sb.rpc("list_customer_price_report_issues"',
  'sb.rpc("get_customer_price_report_issue"',
  "p_preview_hash: state.preview.preview_hash",
  "p_request_id: state.requestId",
  'window.open("", "_blank")',
  "!Array.isArray(result.data.rows)",
  "win.print()",
  'new URL("customer-price-report-print.css", window.location.href)',
  "safe(yen(row.sales_price_jpy))",
  "safe(customer.name",
  "categoryLabel(row.category_code)",
  "G品番",
  "純正品番",
  "メーカー品番",
  "販売価格"
].forEach((fragment) => expect(report.includes(fragment), `price report contract is missing: ${fragment}`));
expect(report.includes("ご注文前に最新の価格と在庫状況をご確認ください。"), "printed guidance must include the stock and price check");
expect(report.includes('sb.from("customer_product_visibility")') && report.includes('customerCategoryIsVisible(code, rows)'), "category choices must follow the selected customer's saved visibility rules");
expect(report.includes("PDF保存時は印刷設定の「ヘッダーとフッター」をオフにしてください。"), "PDF toolbar must explain browser header/footer settings");
expect(!report.includes("document-footer"), "print guidance must not be orphaned on a footer-only page");
expect(!report.includes("product_base_prices"), "browser must not calculate a report from base-price rows");
expect(!report.includes("calculateSalesPriceClient"), "browser must not calculate effective sales prices");
expect(!report.includes("price_rank_code"), "customer-facing report must not expose price ranks");
expect(!report.includes("manufacturing_cost"), "customer-facing report must not expose manufacturing cost");
expect(!report.includes("basis_note"), "customer-facing report must not expose price-basis notes");
expect(/@page\s*{[^}]*size:\s*A4\s+portrait/i.test(css), "price report must use A4 portrait printing");
expect(css.includes(".price-list thead { display: table-header-group; }"), "printed page headers must repeat");
expect(css.includes(".report-notes") && css.includes("break-inside: avoid"), "price guidance must stay together on the first page");
expect(css.includes("@media screen and (max-width: 700px)") && css.includes(".print-help { flex: 0 0 100%; }"), "narrow print preview must keep PDF controls visible");
expect(css.includes(".category-section + .category-section { break-before: page; page-break-before: always;"), "each later category must start a new printed page");
expect(/\.price-list \.g-part-number\s*\{[^}]*font-size:\s*9px;[^}]*white-space:\s*nowrap;[^}]*overflow-wrap:\s*normal;/.test(css), "G part numbers must print smaller on one line");
expect(/\.cpr-table \.cpr-g-part-number\s*\{[^}]*font-size:\s*11px;[^}]*white-space:\s*nowrap;/.test(screenCss), "only the preview G part number must be smaller and stay on one line");
expect(screenCss.includes('.cpr-table td:nth-child(2)::before { content: "G品番"; }') && screenCss.includes('.cpr-table td:nth-child(3)::before { content: "純正品番"; }'), "narrow preview must label G and genuine parts separately");
expect(screenCss.includes('.cpr-summary button[aria-pressed="true"]') && screenCss.includes('.cpr-table[data-cpr-view="excluded"]'), "detail switches and narrow exclusion labels must be styled");
expect(html.includes('<th>G品番</th><th>純正品番</th><th>メーカー品番</th>') && html.includes('colspan="7" class="cpr-empty"'), "preview must have separate G and genuine columns");
expect(html.includes('id="cpr-detail-heading"') && html.includes('id="cpr-preview-table"'), "price report detail heading and table must exist");
expect(html.includes('id="screen-report-hub"') && html.includes('id="screen-customer-price-report"'), "report screens must exist");
expect(html.includes('src="customer-price-report.js?') && html.includes('href="customer-price-report.css?'), "report assets must load");
expect(build.includes('"customer-price-report.js"') && build.includes('"customer-price-report-print.css"'), "report assets must ship");
expect(workflow.includes("run: node scripts/verify-customer-price-list.js"), "CI must verify the report contract");

const elements = {};
const listeners = {};
const runtime = {
  URL,
  APP_VERSION: "v-test",
  canManageCustomerAccess: () => true,
  isScreenActive: () => true,
  doLogout: () => {},
  enterManufacturingRankingReport: () => {},
  window: { location: { href: "https://example.test/index.html" } },
  document: { getElementById: id => (elements[id] ||= { classList: { toggle() {} }, dataset: {}, querySelectorAll: () => [],
    addEventListener: (name, fn) => { (listeners[id] ||= {})[name] = fn; } }) },
  esc: value => String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char])
};
vm.runInNewContext(report.replace(/\}\)\(\);\s*$/, "globalThis.renderCustomerPriceReport = printHtml;globalThis.renderCustomerPricePreview = renderPreview;globalThis.renderCustomerPriceDetail = renderDetail;globalThis.customerPriceState = state;globalThis.clearCustomerPricePreview = clearPreview;globalThis.loadVisibleCustomerPriceCategories = loadVisibleCategories;globalThis.reopenCustomerPriceReport = reopen;})();"), runtime);
runtime.renderCustomerPricePreview({
  summary: { candidate_count: 1, included_count: 1 },
  rows: [{ category_code: "alternator", category_label: "オルタネータ", gltek_part_number: "G0102-10001", genuine_part_number: "31100-RV4-004", manufacturer_part_number: "104210-1000", product_kind: "rebuilt", sales_price_jpy: 12000 }]
});
expect(elements["cpr-preview-rows"].innerHTML.includes("<td class='cpr-g-part-number'>G0102-10001</td><td>31100-RV4-004</td>"), "preview must show small G code beside normal-size genuine code");
expect(!elements["cpr-preview-rows"].innerHTML.includes("<small>31100-RV4-004</small>"), "genuine part number must not be the small caption");
expect(elements["cpr-summary"].innerHTML.includes("data-cpr-view='candidate'") && elements["cpr-summary"].innerHTML.includes("data-cpr-view='excluded'"), "all three counts must be detail switches");
runtime.renderCustomerPricePreview({
  summary: { candidate_count: 3, included_count: 1, excluded_hidden: 1, excluded_no_price: 1 },
  rows: [{ category_code: "alternator", gltek_part_number: "G-1", genuine_part_number: "IN-1", sales_price_jpy: 12000 }],
  excluded_rows: [
    { category_code: "alternator", gltek_part_number: "G-2", genuine_part_number: "OUT-1", exclusion_reason: "hidden" },
    { category_code: "starter", gltek_part_number: "G-3", genuine_part_number: "OUT-2", exclusion_reason: "no_price" }
  ]
});
listeners["cpr-summary"].click({ target: { closest: () => ({ dataset: { cprView: "excluded" } }) } });
expect(runtime.customerPriceState.view === "excluded", "clicking excluded count must switch the detail view");
expect(elements["cpr-detail-heading"].textContent === "除外品番 2件", "excluded detail count must match summary");
expect(elements["cpr-preview-rows"].innerHTML.includes("OUT-1") && elements["cpr-preview-rows"].innerHTML.includes("非公開") && elements["cpr-preview-rows"].innerHTML.includes("価格未設定"), "excluded detail must show part numbers and reasons");
expect(!elements["cpr-preview-rows"].innerHTML.includes("12,000円"), "excluded detail must not reveal included prices");
listeners["cpr-summary"].click({ target: { closest: () => ({ dataset: { cprView: "candidate" } }) } });
expect(elements["cpr-detail-heading"].textContent === "候補品番 3件" && elements["cpr-preview-rows"].innerHTML.includes("IN-1") && elements["cpr-preview-rows"].innerHTML.includes("OUT-2"), "candidate detail must include priced and excluded rows");
runtime.renderCustomerPricePreview({ rows: [], summary: {} });
expect(elements["cpr-preview-rows"].innerHTML.includes("colspan='7'"), "empty preview must span all seven columns");
runtime.clearCustomerPricePreview();
expect(elements["cpr-preview-rows"].innerHTML.includes("colspan='7'"), "cleared preview must span all seven columns");
expect(elements["cpr-summary"].hidden && elements["cpr-detail-heading"].hidden && runtime.customerPriceState.view === "included", "filter changes must clear old detail");
const printed = runtime.renderCustomerPriceReport({
  issue_id: "INTERNAL-ISSUE-ID",
  issued_at: "2026-09-25T00:00:00Z",
  issued_by_name: "検証用",
  customer: { name: "架空得意先", shipping_charge_rule: "separate" },
  rows: [
    { category_code: "alternator", category_label: "オルタネータ", gltek_part_number: "G0102-10001", genuine_part_number: "ALT-1", product_kind: "rebuilt", sales_price_jpy: 5000 },
    { category_code: "starter", category_label: "スタータ", genuine_part_number: "STA-1", product_kind: "rebuilt", sales_price_jpy: 6000 },
    { category_code: "alternator", category_label: "オルタネータ", genuine_part_number: "ALT-2", product_kind: "rebuilt", sales_price_jpy: 7000 }
  ]
});
expect((printed.match(/<section class='category-section'>/g) || []).length === 2, "report rows must be grouped into one section per category");
expect(printed.indexOf("ALT-1") < printed.indexOf("ALT-2") && printed.indexOf("ALT-2") < printed.indexOf("STA-1"), "category rows must stay grouped in first-seen order");
expect((printed.match(/<tr><td>/g) || []).length === 3, "all report rows must print without a number cell");
expect(!printed.includes("<th>No.</th>") && !/<tr><td>\d+<\/td>/.test(printed), "customer-facing report must not show a No. column or row number");
expect(printed.includes("<tr><td>オルタネータ"), "the first printed cell must contain the category, not a number");
expect((printed.match(/<th>/g) || []).length === 14, "each category must use a seven-column table");
expect(printed.includes("<td class='g-part-number'>G0102-10001</td>"), "G part numbers must use the single-line code cell");
expect(!printed.includes("INTERNAL-ISSUE-ID") && !printed.includes("発行番号："), "internal issue number must not print");
expect(!printed.includes("円表示です。") && !printed.includes("本書に掲載のない"), "removed explanatory phrases must not print");
expect(printed.includes("<strong>価格・送料</strong>") && printed.includes("<strong>ご注文前の確認</strong>"), "price conditions and pre-order check must have separate labels");
expect(printed.includes("本書の価格は発行日時点の税抜価格です。送料・消費税は別途申し受けます。"), "separate-shipping report must explain tax-exclusive price and charges");
expect(printed.includes("価格・在庫状況は変動する場合があります。ご注文前に最新の価格と在庫状況をご確認ください。"), "pre-order check must state what may change");
expect(printed.includes("<title>販売価格表 架空得意先様_2026-09-25</title>"), "PDF filename must include the customer honorific and saved issue date");
[
  ["2026-10-19T14:59:59Z", "2026-10-19"],
  ["2026-10-19T15:00:00Z", "2026-10-20"],
  ["2026-12-31T15:00:00Z", "2027-01-01"],
  ["2026-10-20T01:00:00+10:00", "2026-10-20"],
  ["2020-02-28T15:00:00Z", "2020-02-29"]
].forEach(([issuedAt, expectedDate]) => {
  const savedIssue = { issued_at: issuedAt, customer: { name: "架空得意先" }, rows: [] };
  const firstTitle = runtime.renderCustomerPriceReport(savedIssue).match(/<title>(.*?)<\/title>/)[1];
  expect(firstTitle === "販売価格表 架空得意先様_" + expectedDate, "PDF filename must use the Japan issue date: " + issuedAt);
  const reopenedTitle = runtime.renderCustomerPriceReport(JSON.parse(JSON.stringify(savedIssue))).match(/<title>(.*?)<\/title>/)[1];
  expect(reopenedTitle === firstTitle, "reopening saved history must retain the original issue date");
});
[undefined, null, "", "invalid-date"].forEach(issuedAt => {
  const oldSnapshot = runtime.renderCustomerPriceReport({ issued_at: issuedAt, customer: { name: "架空得意先" }, rows: [] });
  expect(oldSnapshot.includes("<title>販売価格表 架空得意先様</title>"), "missing or invalid issue dates must not invent a filename date");
});
const escapedTitle = runtime.renderCustomerPriceReport({ issued_at: "2026-10-19T15:00:00Z", customer: { name: "A&B</title><script>" }, rows: [] });
expect(escapedTitle.includes("<title>販売価格表 A&amp;B&lt;/title&gt;&lt;script&gt;様_2026-10-20</title>"), "dated filename must preserve HTML escaping");
[
  ["有限会社サンプル", "有限会社サンプル様"],
  ["有限会社サンプル様", "有限会社サンプル様"],
  ["　有限会社サンプル様　", "有限会社サンプル様"],
  ["", ""],
  [undefined, ""]
].forEach(([name, expectedName]) => {
  const savedIssue = { issued_at: "2026-10-29T00:00:00Z", customer: { name }, rows: [] };
  const before = JSON.stringify(savedIssue);
  const output = runtime.renderCustomerPriceReport(savedIssue);
  expect(output.includes("<title>販売価格表 " + expectedName + "_2026-10-29</title>"), "PDF filename must append 様 once for a nonempty customer name");
  expect(output.includes("<strong>" + runtime.esc(name || "—") + "</strong>"), "printed customer name must retain its saved spelling");
  expect(JSON.stringify(savedIssue) === before, "filename honorific must not modify the saved issue");
});
const freeShipping = runtime.renderCustomerPriceReport({ customer: { name: "架空得意先", shipping_charge_rule: "free" }, rows: [] });
expect(freeShipping.includes("送料は無料です。消費税は別途申し受けます。") && !freeShipping.includes("送料・消費税は別途申し受けます。"), "free-shipping customer must retain its shipping rule");

expect(/id="cpr-part-number-format"[^>]*aria-describedby="cpr-part-number-format-help"/.test(html) &&
  html.includes('<option value="short" selected>三菱品番の00を省略</option>') &&
  html.includes('<option value="original">登録どおり</option>'), "output format must default to abbreviation and offer the original spelling with help");
const partCases = [
  ["MITSUBISHI", "A000T25271", "A0T25271"],
  ["MITSUBISHI", "A001TA3891", "A1TA3891"],
  ["MITSUBISHI", "M000T46071ZT", "M0T46071ZT"],
  ["MITSUBISHI", "A007TG0391A", "A7TG0391A"],
  ["MITSUBISHI", "T002T12300", "T2T12300"],
  [" mitsubishi ", "A005T00100", "A5T00100"],
  ["MITSUBISHI", "a001ta3891", "a1ta3891"],
  ["MITSUBISHI", "A1TA3891", "A1TA3891"],
  ["MITSUBISHI", "A010T00100", "A010T00100"],
  ["MITSUBISHI", "A001X00100", "A001X00100"],
  ["MITSUBISHI", "XA001T00100", "XA001T00100"],
  ["MITSUBISHI", "A0000T00100", "A0000T00100"],
  ["DENSO", "A001TA3891", "A001TA3891"],
  ["MITSUBA", "M000T46071ZT", "M000T46071ZT"],
  [undefined, "A001TA3891", "A001TA3891"],
  ["MITSUBISHI", "", "—"],
  ["MITSUBISHI", "A001T<&00", "A1T<&00"]
];
for (const [manufacturer, part, shortened] of partCases) {
  const row = Object.freeze({ manufacturer, manufacturer_part_number: part, genuine_part_number: "A001T-OEM",
    genuine_part_number_2: "M000T-OEM2", gltek_part_number: "A001T-G", sales_price_jpy: 12345 });
  const payload = Object.freeze({ rows: Object.freeze([row]), summary: { candidate_count: 1, included_count: 1 } });
  const before = JSON.stringify(payload);
  for (const short of [true, false]) {
    const expected = runtime.esc(short ? shortened : part || "—");
    elements["cpr-part-number-format"].value = short ? "short" : "original";
    runtime.renderCustomerPricePreview(payload);
    const output = runtime.renderCustomerPriceReport(payload, { abbreviateMitsubishi: short });
    expect(output.includes("<td>" + expected + "</td>") && elements["cpr-preview-rows"].innerHTML.includes("<td>" + expected + "</td>"),
      "preview and PDF must agree for manufacturer/part/option: " + [manufacturer, part, short]);
    expect(output.includes("A001T-OEM") && output.includes("M000T-OEM2") && output.includes("A001T-G") && output.includes("12,345円"),
      "genuine numbers, G numbers and server price must remain unchanged");
    expect(JSON.stringify(payload) === before, "display abbreviation must never mutate server rows or snapshots");
  }
}
const sameDisplay = { rows: [
  { dkd_shohin_id: 1, manufacturer: "MITSUBISHI", manufacturer_part_number: "A001TA3891", sales_price_jpy: 1000 },
  { dkd_shohin_id: 2, manufacturer: "MITSUBISHI", manufacturer_part_number: "A1TA3891", sales_price_jpy: 2000 }
], summary: { candidate_count: 2, included_count: 2 } };
elements["cpr-part-number-format"].value = "short";
runtime.renderCustomerPricePreview(sameDisplay);
expect((elements["cpr-preview-rows"].innerHTML.match(/<td>A1TA3891<\/td>/g) || []).length === 2,
  "matching display spellings must not merge distinct products or remove prices");
const savedPreview = runtime.customerPriceState.preview;
elements["cpr-part-number-format"].value = "original";
listeners["cpr-part-number-format"].change();
expect(runtime.customerPriceState.preview === savedPreview && elements["cpr-preview-rows"].innerHTML.includes("A001TA3891"),
  "changing presentation must update existing preview without replacing the server snapshot");
const singleCategory = runtime.renderCustomerPriceReport({
  customer: { name: "架空得意先" },
  rows: [{ category_code: "starter", category_label: "スタータ", genuine_part_number: "ONLY-1", product_kind: "rebuilt", sales_price_jpy: 5000 }]
});
expect((singleCategory.match(/<section class='category-section'>/g) || []).length === 1 && singleCategory.includes("ONLY-1"), "a single category must print once without a blank category page");


// Selected vehicles are server values. Old snapshots and missing fields stay empty.
const vehicleReport = runtime.renderCustomerPriceReport({
  customer: { name: "架空得意先" },
  rows: [
    { category_code: "starter", genuine_part_number: "VEHICLE-1", sales_price_jpy: 12000,
      representative_vehicle_name: "タント", representative_vehicle_model: "L375S" },
    { category_code: "starter", genuine_part_number: "EMPTY-1", sales_price_jpy: 13000 },
    { category_code: "starter", genuine_part_number: "ESCAPE-1", sales_price_jpy: 14000,
      representative_vehicle_name: "<img src=x onerror=alert(1)>", representative_vehicle_model: "<script>x</script>" }
  ]
});
expect(vehicleReport.includes("<th>代表車名</th><th>型式</th>"), "PDF must label the representative pair");
expect(vehicleReport.includes("<td class='vehicle-name'>タント</td><td class='vehicle-model'>L375S</td>"),
  "PDF must show exactly the saved pair");
expect(vehicleReport.includes("<td class='vehicle-name'></td><td class='vehicle-model'></td>"),
  "old snapshots and missing data must have blank cells without dashes");
expect(vehicleReport.includes("&lt;img") && vehicleReport.includes("&lt;script&gt;") && !vehicleReport.includes("<img"),
  "vehicle fields must be escaped");
runtime.renderCustomerPricePreview({
  summary: { candidate_count: 2, included_count: 2 },
  rows: [
    { category_code: "starter", sales_price_jpy: 12000, representative_vehicle_name: "タント", representative_vehicle_model: "L375S" },
    { category_code: "starter", sales_price_jpy: 13000 }
  ]
});
expect(elements["cpr-preview-rows"].innerHTML.includes("<td class='cpr-vehicle-name'>タント</td><td class='cpr-vehicle-model'>L375S</td>"),
  "preview must show the same server pair");
expect(elements["cpr-preview-rows"].innerHTML.includes("<td class='cpr-vehicle-name'></td><td class='cpr-vehicle-model'></td>"),
  "preview must preserve blank vehicle fields");
expect(screenCss.includes('.cpr-table td:nth-child(5)::before { content: "代表車名"; }')
  && screenCss.includes('.cpr-table td:nth-child(6)::before { content: "型式"; }'),
  "mobile cards must label the representative pair");
expect(/\.cpr-table\s*\{[^}]*table-layout:\s*fixed/.test(screenCss), "preview columns must not expand based on a row's content");
const previewColumnWidths = [...screenCss.matchAll(/\.cpr-table th:nth-child\((\d)\)\s*\{\s*width:\s*(\d+)%;/g)];
expect(previewColumnWidths.length === 7 && previewColumnWidths.reduce((sum, match) => sum + Number(match[2]), 0) === 100,
  "the seven semantic column widths must fill the preview without overflow");
expect(!/\.cpr-vehicle-name\s*\{[^}]*min-width:\s*180px/.test(screenCss), "vehicle names must not force other preview columns aside");
expect(screenCss.includes("container: cpr-preview / inline-size") && screenCss.includes("@container cpr-preview (max-width: 740px)"),
  "compact layout must follow the actual preview width, including a narrow desktop panel");
expect(/\.cpr-table th:nth-child\(7\)\s*\{[^}]*text-align:\s*right/.test(screenCss), "price headings and amounts must share the right edge");

const defaults = app.match(/var DEFAULT_CUSTOMER_VISIBLE_CATEGORY_CODES = \[[^\]]+\];/);
const categoryVisible = app.match(/function customerCategoryIsVisible\(categoryCode, visibilityRows\) \{[\s\S]*?\n\}/);
expect(defaults && categoryVisible, "shared customer category visibility helper must exist");
vm.runInNewContext(defaults[0] + "\n" + categoryVisible[0], runtime);
runtime.customerPriceState.categoryOptions = ["alternator", "starter", "injector"];
runtime.customerPriceState.categories = { alternator: "オルタネータ", starter: "スタータ", injector: "インジェクター" };
elements["cpr-customer"].value = "13";
let visibilityResult = { data: [] };
runtime.sb = { from(table) {
  expect(table === "customer_product_visibility", "only saved customer visibility is read for category choices");
  return { select() { return this; }, eq() { return this; }, in() { return this; }, limit() { return Promise.resolve(visibilityResult); } };
} };

(async () => {
  elements["cpr-category"].value = "injector";
  await runtime.loadVisibleCustomerPriceCategories();
  expect(!elements["cpr-category"].innerHTML.includes("インジェクター") && elements["cpr-category"].value === "", "default six-category rule must remove injector and reset a hidden selection");
  visibilityResult = { data: [
    { visibility_scope: "all", is_visible: false },
    { visibility_scope: "category", category_code: "alternator", is_visible: true }
  ] };
  await runtime.loadVisibleCustomerPriceCategories();
  expect(elements["cpr-category"].innerHTML.includes("オルタネータ") && !elements["cpr-category"].innerHTML.includes("スタータ"), "saved category allow-list must drive report choices");
  visibilityResult = { data: [
    { visibility_scope: "all", is_visible: true },
    { visibility_scope: "category", category_code: "injector", is_visible: false }
  ] };
  await runtime.loadVisibleCustomerPriceCategories();
  expect(!elements["cpr-category"].innerHTML.includes("インジェクター") && elements["cpr-category"].innerHTML.includes("スタータ"), "category-specific hide must override show-all");
  visibilityResult = { data: [
    { visibility_scope: "all", is_visible: false },
    { visibility_scope: "category", category_code: "injector", is_visible: true }
  ] };
  await runtime.loadVisibleCustomerPriceCategories();
  expect(elements["cpr-category"].innerHTML.includes("インジェクター"), "an explicitly enabled injector category must remain selectable");
  visibilityResult = { data: null, error: new Error("visibility unavailable") };
  await runtime.loadVisibleCustomerPriceCategories();
  expect(elements["cpr-category"].disabled && elements["cpr-preview-button"].disabled && elements["cpr-status"].classList, "visibility read errors must fail closed");

  // Presentation is captured before each server wait; no formatting option enters the pricing RPC.
  const issuedSnapshot = { issue_id: 42, customer: { id: 13, name: "架空得意先" }, filters: {},
    rows: [{ manufacturer: "MITSUBISHI", manufacturer_part_number: "A001TA3891", sales_price_jpy: 12000 }] };
  const savedSnapshot = JSON.stringify(issuedSnapshot);
  const windows = [];
  runtime.window.open = () => {
    const win = { closed: false, document: { body: {}, open() {}, write(value) { win.output = value; }, close() {},
      getElementById() { return { addEventListener() {} }; } }, close() { this.closed = true; } };
    windows.push(win);
    return win;
  };
  elements["cpr-category"].value = "";
  elements["cpr-kind"].value = "";
  elements["cpr-part-number"].value = "";
  runtime.customerPriceState.preview = Object.assign({ preview_hash: "server-hash" }, issuedSnapshot);
  runtime.customerPriceState.requestId = "same-request";
  let completeRequest;
  const calls = [];
  runtime.sb.rpc = (name, args) => {
    calls.push({ name, args });
    return name === "list_customer_price_report_issues" ? Promise.resolve({ data: [] }) :
      new Promise(resolve => { completeRequest = resolve; });
  };
  elements["cpr-part-number-format"].value = "short";
  const issuing = listeners["cpr-issue-button"].click();
  elements["cpr-part-number-format"].value = "original";
  listeners["cpr-part-number-format"].change();
  completeRequest({ data: issuedSnapshot });
  await issuing;
  expect(windows[0].output.includes("<td>A1TA3891</td>"), "issuance must use the format selected before its server request");
  expect(calls[0].name === "issue_customer_price_report" && calls[0].args.p_preview_hash === "server-hash" &&
    calls[0].args.p_request_id === "same-request" && Object.keys(calls[0].args).length === 6,
    "issuance must preserve the server hash, idempotency key and existing RPC arguments");
  for (const short of [false, true]) {
    elements["cpr-part-number-format"].value = short ? "short" : "original";
    const reopening = runtime.reopenCustomerPriceReport(42);
    elements["cpr-part-number-format"].value = short ? "original" : "short";
    completeRequest({ data: issuedSnapshot });
    await reopening;
    expect(windows[windows.length - 1].output.includes("<td>" + (short ? "A1TA3891" : "A001TA3891") + "</td>"),
      "history must render saved original rows using the format selected before the read");
  }
  expect(JSON.stringify(issuedSnapshot) === savedSnapshot, "issue and history rendering must retain the original snapshot");
  console.log("customer price report guard passed");
})().catch(error => { console.error(error); process.exitCode = 1; });
