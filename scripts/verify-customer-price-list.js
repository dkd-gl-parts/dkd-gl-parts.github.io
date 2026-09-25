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
expect(report.includes("ご注文前に最新の在庫状況と価格をご確認ください。"), "printed terms must include the stock and price caution");
expect(report.includes("PDF保存時は印刷設定の「ヘッダーとフッター」をオフにしてください。"), "PDF toolbar must explain browser header/footer settings");
expect(!report.includes("document-footer"), "print terms must not be orphaned on a footer-only page");
expect(!report.includes("product_base_prices"), "browser must not calculate a report from base-price rows");
expect(!report.includes("calculateSalesPriceClient"), "browser must not calculate effective sales prices");
expect(!report.includes("price_rank_code"), "customer-facing report must not expose price ranks");
expect(!report.includes("manufacturing_cost"), "customer-facing report must not expose manufacturing cost");
expect(!report.includes("basis_note"), "customer-facing report must not expose price-basis notes");
expect(/@page\s*{[^}]*size:\s*A4\s+portrait/i.test(css), "price report must use A4 portrait printing");
expect(css.includes(".price-list thead { display: table-header-group; }"), "printed page headers must repeat");
expect(css.includes("@media screen and (max-width: 700px)") && css.includes(".print-help { flex: 0 0 100%; }"), "narrow print preview must keep PDF controls visible");
expect(css.includes(".category-section + .category-section { break-before: page; page-break-before: always;"), "each later category must start a new printed page");
expect(/\.price-list \.g-part-number\s*\{[^}]*font-size:\s*9px;[^}]*white-space:\s*nowrap;[^}]*overflow-wrap:\s*normal;/.test(css), "G part numbers must print smaller on one line");
expect(/\.cpr-table \.cpr-g-part-number\s*\{[^}]*font-size:\s*11px;[^}]*white-space:\s*nowrap;/.test(screenCss), "only the preview G part number must be smaller and stay on one line");
expect(screenCss.includes('.cpr-table td:nth-child(2)::before { content: "G品番"; }') && screenCss.includes('.cpr-table td:nth-child(3)::before { content: "純正品番"; }'), "narrow preview must label G and genuine parts separately");
expect(html.includes('<th>G品番</th><th>純正品番</th><th>メーカー品番</th>') && html.includes('colspan="5" class="cpr-empty"'), "preview must have separate G and genuine columns");
expect(html.includes('id="screen-report-hub"') && html.includes('id="screen-customer-price-report"'), "report screens must exist");
expect(html.includes('src="customer-price-report.js?') && html.includes('href="customer-price-report.css?'), "report assets must load");
expect(build.includes('"customer-price-report.js"') && build.includes('"customer-price-report-print.css"'), "report assets must ship");
expect(workflow.includes("run: node scripts/verify-customer-price-list.js"), "CI must verify the report contract");

const elements = {};
const runtime = {
  URL,
  APP_VERSION: "v-test",
  window: { location: { href: "https://example.test/index.html" } },
  document: { getElementById: id => id === "screen-customer-price-report" ? null : (elements[id] ||= { classList: { toggle() {} } }) },
  esc: value => String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char])
};
vm.runInNewContext(report.replace(/\}\)\(\);\s*$/, "globalThis.renderCustomerPriceReport = printHtml;globalThis.renderCustomerPricePreview = renderPreview;globalThis.clearCustomerPricePreview = clearPreview;})();"), runtime);
runtime.renderCustomerPricePreview({
  summary: { candidate_count: 1, included_count: 1 },
  rows: [{ category_code: "alternator", category_label: "オルタネータ", gltek_part_number: "G0102-10001", genuine_part_number: "31100-RV4-004", manufacturer_part_number: "104210-1000", product_kind: "rebuilt", sales_price_jpy: 12000 }]
});
expect(elements["cpr-preview-rows"].innerHTML.includes("<td class='cpr-g-part-number'>G0102-10001</td><td>31100-RV4-004</td>"), "preview must show small G code beside normal-size genuine code");
expect(!elements["cpr-preview-rows"].innerHTML.includes("<small>31100-RV4-004</small>"), "genuine part number must not be the small caption");
runtime.renderCustomerPricePreview({ rows: [], summary: {} });
expect(elements["cpr-preview-rows"].innerHTML.includes("colspan='5'"), "empty preview must span all five columns");
runtime.clearCustomerPricePreview();
expect(elements["cpr-preview-rows"].innerHTML.includes("colspan='5'"), "cleared preview must span all five columns");
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
expect((printed.match(/<tr><td>[123]<\/td>/g) || []).length === 3, "all report rows must retain sequential numbers");
expect(printed.includes("<td class='g-part-number'>G0102-10001</td>"), "G part numbers must use the single-line code cell");
expect(!printed.includes("INTERNAL-ISSUE-ID") && !printed.includes("発行番号："), "internal issue number must not print");
expect(!printed.includes("円表示です。") && !printed.includes("本書に掲載のない"), "removed explanatory phrases must not print");
expect(printed.includes("掲載価格は税抜です。") && printed.includes("最新の在庫状況と価格をご確認ください。"), "tax and inventory cautions must remain");
const singleCategory = runtime.renderCustomerPriceReport({
  customer: { name: "架空得意先" },
  rows: [{ category_code: "starter", category_label: "スタータ", genuine_part_number: "ONLY-1", product_kind: "rebuilt", sales_price_jpy: 5000 }]
});
expect((singleCategory.match(/<section class='category-section'>/g) || []).length === 1 && singleCategory.includes("ONLY-1"), "a single category must print once without a blank category page");

console.log("customer price report guard passed");
