const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const report = fs.readFileSync(path.join(root, "customer-price-report.js"), "utf8");
const css = fs.readFileSync(path.join(root, "customer-price-report-print.css"), "utf8");
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
expect(html.includes('id="screen-report-hub"') && html.includes('id="screen-customer-price-report"'), "report screens must exist");
expect(html.includes('src="customer-price-report.js?') && html.includes('href="customer-price-report.css?'), "report assets must load");
expect(build.includes('"customer-price-report.js"') && build.includes('"customer-price-report-print.css"'), "report assets must ship");
expect(workflow.includes("run: node scripts/verify-customer-price-list.js"), "CI must verify the report contract");

console.log("customer price report guard passed");
