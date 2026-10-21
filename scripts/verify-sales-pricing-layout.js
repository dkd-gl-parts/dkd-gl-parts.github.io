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
  currentSalesRank1Row: null,
  canManageSalesPricing: () => true,
  canViewBasePrice: () => true,
  calculateSalesPriceClient: () => 6500,
  salesRankDisplayName: (rank) => rank.rank_name,
  formatYen: (value) => String(value),
  formatYenCurrency: (value) => "\u00a5" + String(value),
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

sandbox.currentSalesRank1Row = { price_jpy: 5800 };
vm.runInNewContext(`${source.slice(start, end)}\nrenderSalesRankPreview();`, sandbox);
requireFragment(sandbox.wrap.innerHTML, "¥6500", "class 1 must follow the single editable price even when an old row exists");
if (sandbox.wrap.innerHTML.includes('¥5800') || html.includes('id="sales-rank1-price"') || html.includes('id="btn-sales-rank1-save"')) throw new Error('Independent class-1 price controls must not remain');
requireFragment(html, 'data-i18n="sales_rank1_price"', 'The single price input must be labelled class 1');

async function verifyReadonlyGNumbers() {
  const assert = require("node:assert/strict");
  for (const id of ["pf-g-part-number", "sales-g-part-number"]) {
    const tag = html.match(new RegExp(`<output\\b[^>]*id="${id}"[^>]*>`));
    assert.ok(tag, `${id} must be a display output, not an editable input`);
    assert.ok(tag[0].includes(`aria-labelledby="${id}-label"`));
    assert.ok(!/\bname=|contenteditable/.test(tag[0]), "G numbers must not become submitted form fields");
  }
  for (const key of ["gltek_part_number_unissued", "gltek_part_number_unavailable"]) {
    assert.equal((source.match(new RegExp(`${key}:`, "g")) || []).length, 3);
  }
  const from = source.indexOf("function resetReadonlyGltekPartNumber(");
  const to = source.indexOf("function renderGltekPartNumberRow(", from);
  assert.ok(from >= 0 && to > from);
  let visible = true;
  let allowed = true;
  const nodes = Object.fromEntries(["pf-g-part-number", "sales-g-part-number"].map(id => [id, {
    textContent: "old number", attributes: {},
    setAttribute(key, value) { this.attributes[key] = value; },
    closest() { return { classList: { contains: () => visible } }; }
  }]));
  const requests = [];
  const context = {
    document: { getElementById: id => nodes[id] },
    currentUser: { id: "test-only" },
    canEdit: () => allowed, canViewSalesPricing: () => allowed,
    t: key => key, productDkdId: p => p && p.dkd_shohin_id,
    sb: { from(table) {
      assert.equal(table, "core_products");
      return { select(columns) {
        assert.equal(columns, "dkd_shohin_id,gltek_part_number");
        return { eq(column, id) {
          assert.equal(column, "dkd_shohin_id");
          return { maybeSingle() { return new Promise((resolve, reject) => requests.push({ id, resolve, reject })); } };
        } };
      } };
    } }
  };
  vm.createContext(context);
  vm.runInContext(source.slice(from, to), context);
  for (const id of Object.keys(nodes)) {
    const node = nodes[id];
    const read = () => context.loadReadonlyGltekPartNumber(id, { dkd_shohin_id: 101, gltek_part_number: "cached-wrong" });
    const first = read();
    assert.equal(node.textContent, "loading");
    assert.equal(node.attributes["aria-busy"], "true");
    requests.shift().resolve({ data: { dkd_shohin_id: 101, gltek_part_number: "G-FRESH" } });
    await first;
    assert.equal(node.textContent, "G-FRESH", "read the authoritative value rather than a stale cached number");
    for (const [response, expected] of [
      [{ data: { dkd_shohin_id: 101, gltek_part_number: null } }, "gltek_part_number_unissued"],
      [{ data: null }, "gltek_part_number_unavailable"],
      [{ error: { message: "denied" } }, "gltek_part_number_unavailable"],
      [{ data: { dkd_shohin_id: 999, gltek_part_number: "G-WRONG" } }, "gltek_part_number_unavailable"]
    ]) {
      const pending = read(); requests.shift().resolve(response); await pending;
      assert.equal(node.textContent, expected);
    }
    const failed = read(); requests.shift().reject(new Error("network")); await failed;
    assert.equal(node.textContent, "gltek_part_number_unavailable");
    const old = read(), oldRequest = requests.shift();
    const newer = context.loadReadonlyGltekPartNumber(id, { dkd_shohin_id: 102 });
    requests.shift().resolve({ data: { dkd_shohin_id: 102, gltek_part_number: "G-NEW" } }); await newer;
    oldRequest.resolve({ data: { dkd_shohin_id: 101, gltek_part_number: "G-OLD" } }); await old;
    assert.equal(node.textContent, "G-NEW", "a delayed previous product must not overwrite the new product");
    const closed = read(); visible = false;
    requests.shift().resolve({ data: { dkd_shohin_id: 101, gltek_part_number: "G-CLOSED" } }); await closed;
    assert.equal(node.textContent, "loading"); visible = true;
    for (const change of [() => { allowed = false; }, () => { context.currentUser = { id: "another-user" }; }]) {
      const pending = read(); change();
      requests.shift().resolve({ data: { dkd_shohin_id: 101, gltek_part_number: "G-PRIVATE" } }); await pending;
      assert.equal(node.textContent, "gltek_part_number_unavailable"); allowed = true;
    }
    allowed = false; await read(); assert.equal(requests.length, 0); allowed = true;
    await context.loadReadonlyGltekPartNumber(id, null);
    assert.equal(node.textContent, "gltek_part_number_unissued", "new forms must not retain the copied base product's G number");
    await context.loadReadonlyGltekPartNumber(id, { dkd_shohin_id: 0 });
    assert.equal(node.textContent, "gltek_part_number_unavailable");
    assert.equal(requests.length, 0, "opening or refreshing a G display must never issue a number");
  }
  requireFragment(source, 'loadReadonlyGltekPartNumber("pf-g-part-number", mode === "edit" ? formProduct : null)', "core edit and add must populate the G display independently");
  requireFragment(source, 'dkd_shohin_id: p.dkd_shohin_id || p.shohin_cd || 0', "legacy parts must use the linked core ID, never their parts row ID");
}
verifyReadonlyGNumbers().then(() => console.log("sales pricing responsive layout and read-only G-number guard passed")).catch(error => { console.error(error); process.exitCode = 1; });
