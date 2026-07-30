const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "customer-price-list-print.css"), "utf8");
const workflow = fs.readFileSync(path.join(root, ".github", "workflows", "search-performance-guard.yml"), "utf8");

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

[
  "async function loadCustomerPriceListBaseRows",
  ".range(from, from + pageSize - 1)",
  "async function loadCustomerPriceListProductMap",
  "async function loadCustomerPriceListRows",
  "customerCategoryIsVisible(category, visibilityRows)",
  "calculateSalesPriceClient(price.base_price_jpy, rank)",
  "function buildCustomerPriceListHtml",
  "G品番",
  "純正品番",
  "メーカー品番",
  "販売価格",
  "メモ",
  "送料・消費税は別途となります。",
  "customerAccessHasUnsavedChanges()",
  "window.open(\"\", \"_blank\")",
  "win.print()",
  "id='btn-customer-price-list'"
].forEach((fragment) => expect(app.includes(fragment), `customer price list wiring is missing: ${fragment}`));

expect(!app.includes("esc(price.basis_note"), "internal price-basis notes must not be printed for customers");
expect(!app.includes("<th>大光品番</th>"), "Daiko part numbers must not be printed on customer price lists");
expect(!app.includes("<span>得意先コード</span>"), "customer codes must not be printed on customer price lists");
expect(!app.includes("<span>価格ランク</span>"), "price ranks must not be printed on customer price lists");
expect(!app.includes("<h1>販売価格表</h1><p>Daiko Catalog &amp; Search System</p>"), "the system subtitle must not be printed on customer price lists");
expect(/@page\s*{[^}]*size:\s*A4\s+portrait/i.test(css), "customer price list must use A4 portrait printing");
expect(css.includes(".price-list thead { display: table-header-group; }"), "price list headers must repeat on printed pages");
expect(workflow.includes('run: node scripts/verify-customer-price-list.js'), "GitHub Actions must verify the customer price list");

console.log("customer price list guard passed");
