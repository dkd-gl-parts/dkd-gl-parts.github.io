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
  "大光品番",
  "純正品番",
  "メーカー品番",
  "販売価格",
  "メモ",
  "customerAccessHasUnsavedChanges()",
  "window.open(\"\", \"_blank\")",
  "win.print()",
  "id='btn-customer-price-list'"
].forEach((fragment) => expect(app.includes(fragment), `customer price list wiring is missing: ${fragment}`));

expect(!app.includes("esc(price.basis_note"), "internal price-basis notes must not be printed for customers");
expect(/@page\s*{[^}]*size:\s*A4\s+landscape/i.test(css), "customer price list must use A4 landscape printing");
expect(css.includes(".price-list thead { display: table-header-group; }"), "price list headers must repeat on printed pages");
expect(workflow.includes('run: node scripts/verify-customer-price-list.js'), "GitHub Actions must verify the customer price list");

console.log("customer price list guard passed");
