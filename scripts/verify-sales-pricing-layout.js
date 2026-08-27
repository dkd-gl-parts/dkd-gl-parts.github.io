const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const styles = fs.readFileSync(path.join(root, "styles.css"), "utf8");

function requireFragment(content, fragment, message) {
  if (!content.includes(fragment)) throw new Error(message);
}

[
  'class="form-card sales-pricing-card" role="dialog" aria-modal="true"',
  'class="sales-pricing-body"',
  'class="sales-pricing-context"',
  'class="sales-pricing-preview-head"',
  'class="form-footer sales-pricing-footer"'
].forEach((fragment) => requireFragment(html, fragment, `sales pricing dialog structure is missing: ${fragment}`));

const previewHeadStart = html.indexOf('<div class="sales-pricing-preview-head">');
const previewHeadEnd = html.indexOf('<div id="sales-rank-preview">', previewHeadStart);
const previewHead = previewHeadStart >= 0 && previewHeadEnd > previewHeadStart
  ? html.slice(previewHeadStart, previewHeadEnd)
  : "";
if (!previewHead.includes('id="btn-sales-rank-save"')) {
  throw new Error("rank settings save action must remain visible beside the rank section title");
}

[
  ".form-card.sales-pricing-card",
  "width: min(1120px, calc(100vw - 32px))",
  "max-height: calc(100dvh - 24px)",
  ".sales-pricing-footer { flex: 0 0 auto",
  ".sales-rank-table { width: 100%; min-width: 930px",
  "@media(max-width:900px)",
  ".sales-rank-table td::before { content: attr(data-label)",
  "@media(max-width:560px)"
].forEach((fragment) => requireFragment(styles, fragment, `sales pricing responsive layout is missing: ${fragment}`));

["round", "ceil", "floor"].forEach((method) => {
  const key = `sales_rounding_${method}:`;
  if ((source.match(new RegExp(key, "g")) || []).length !== 3) {
    throw new Error(`rounding method label must be translated for all languages: ${method}`);
  }
});
if ((source.match(/sales_rate_multiplier:/g) || []).length !== 3) {
  throw new Error("rate multiplier label must be translated for all languages");
}

const start = source.indexOf("function renderSalesRankPreview()");
const end = source.indexOf("function collectSalesRankSettingsFromForm()", start);
if (start < 0 || end < start) throw new Error("sales rank preview renderer could not be isolated");

const sandbox = {
  document: {
    getElementById(id) {
      if (id === "sales-rank-preview") return sandbox.wrap;
      if (id === "sales-base-price") return { value: "6500" };
      return null;
    }
  },
  wrap: { innerHTML: "" },
  salesPricingRanks: [{
    rank_code: "HANBAIOU_URI_1",
    rank_name: "売値区分1",
    rate_multiplier: 1,
    amount_adjustment_jpy: 0,
    rounding_unit_jpy: 10,
    rounding_method: "round"
  }],
  salesPricingCustomerCounts: { HANBAIOU_URI_1: 2 },
  canManageSalesPricing: () => true,
  canViewBasePrice: () => true,
  calculateSalesPriceClient: () => 6500,
  salesRankDisplayName: (rank) => rank.rank_name,
  formatYen: (value) => String(value),
  esc: (value) => String(value),
  t: (key) => ({
    sales_rank: "ランク",
    sales_result_price: "販売価格",
    sales_customer_count: "得意先数",
    sales_rate_adjust: "掛率 / 調整 / 丸め",
    sales_rate_multiplier: "掛率",
    sales_amount_adjustment: "金額調整",
    sales_rounding_unit: "丸め単位",
    sales_rounding_method: "丸め方法",
    sales_rounding_round: "四捨五入",
    sales_rounding_ceil: "切り上げ",
    sales_rounding_floor: "切り捨て"
  }[key] || key)
};

vm.runInNewContext(`${source.slice(start, end)}\nrenderSalesRankPreview();`, sandbox);
requireFragment(sandbox.wrap.innerHTML, "data-label='販売価格'", "mobile rank rows must include field labels");
requireFragment(sandbox.wrap.innerHTML, ">四捨五入</option>", "rounding method must use a readable business label");
if (sandbox.wrap.innerHTML.includes(">round</option>")) {
  throw new Error("raw rounding method codes must not be shown to users");
}

console.log("sales pricing responsive layout guard passed");
