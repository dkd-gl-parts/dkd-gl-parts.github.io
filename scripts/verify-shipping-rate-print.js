const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const acorn = require("acorn");
const root = path.resolve(__dirname, "..");
const api = require(path.join(root, "shipping-rate-print.js"));
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
const ast = acorn.parse(source, { ecmaVersion: "latest" });
function declaration(name) {
  const node = ast.body.find(n => n.type === "FunctionDeclaration" && n.id.name === name || n.type === "VariableDeclaration" && n.declarations.some(d => d.id.name === name));
  assert(node, name);
  return source.slice(node.start, node.end);
}
const prefectures = Object.fromEntries(Array.from({ length: 47 }, (_, i) => [i + 1, `Prefecture ${i + 1}`]));
const rows = [];
for (let pref = 1; pref <= 47; pref++) {
  for (const service of ["宅急便", "宅急便タイムサービス", "宅急便コンパクト", "ネコポス"]) {
    const sizes = service === "宅急便コンパクト" ? ["専用BOX"] : service === "ネコポス" ? ["規定サイズ"] : [60, 80, 100, 120, 140, 160, 180, 200].map(n => `${n}サイズ`);
    for (const size of sizes) rows.push({ prefecture_code: pref, carrier_name: "Carrier", service_name: service, package_size_label: size, max_weight_kg: null, origin_region: "Origin", tax_type: "excluded", standard_fee_jpy: 500 + (pref % 12) * 10 + sizes.indexOf(size), remote_island_fee_jpy: null, remote_island_condition: "Confirm", note: service, is_active: true });
  }
}
const snapshot = JSON.stringify(rows);
const model = api.buildModel(rows, prefectures);
assert.equal(model.sourceCount, 846);
assert.equal(model.destinationCount, 47);
assert.equal(model.columns.length, 18);
assert.equal(model.lines.length, 12);
assert.deepEqual(model.columns.slice(0, 8).map(c => c.size), [60, 80, 100, 120, 140, 160, 180, 200].map(n => `${n}サイズ`));
let represented = 0;
for (const line of model.lines) for (const pref of line.prefectures) model.columns.forEach((column, i) => {
  const original = rows.find(r => r.prefecture_code === pref.code && r.service_name === column.service && r.package_size_label === column.size);
  assert.equal(line.cells[i].fee, original.standard_fee_jpy);
  assert.equal(model.notes[line.cells[i].noteId - 1].text, original.note);
  represented++;
});
assert.equal(represented, 846, "grouped table represents every input rate exactly");
assert.equal(JSON.stringify(rows), snapshot, "printing never changes master rows");
const regionCases = [
  ["北海道", "Hokkaido", "北海道", [1]],
  ["北東北", "Northern Tohoku", "北东北", [2, 3, 5]],
  ["南東北", "Southern Tohoku", "南东北", [4, 6, 7]],
  ["関東", "Kanto", "关东", [8, 9, 10, 11, 12, 13, 14, 19]],
  ["信越", "Shinetsu", "信越", [15, 20]],
  ["北陸", "Hokuriku", "北陆", [16, 17, 18]],
  ["中部", "Chubu", "中部", [21, 22, 23, 24]],
  ["関西", "Kansai", "关西", [25, 26, 27, 28, 29, 30]],
  ["中国", "Chugoku", "中国地方", [31, 32, 33, 34, 35]],
  ["四国", "Shikoku", "四国", [36, 37, 38, 39]],
  ["九州", "Kyushu", "九州", [40, 41, 42, 43, 44, 45, 46]],
  ["沖縄", "Okinawa", "冲绳", [47]]
];
const uniformModel = api.buildModel(rows.map(row => ({ ...row, standard_fee_jpy: 1000 })), prefectures);
assert.equal(uniformModel.lines.length, 1, "source model remains unchanged; regions are separated when printing");
for (const [languageIndex, lang] of ["ja", "en", "zh"].entries()) {
  const grouped = api.documentHtml(uniformModel, { baseUrl: "https://dcats.example/", version: "test", lang });
  const regions = [...grouped.matchAll(/<span class='destination-region'><strong class='region-heading'>([^<]+)<\/strong><span class='region-prefectures'>(.*?)<\/span><\/span>/g)];
  assert.equal(regions.length, 12, `${lang}: all twelve region headings`);
  const printedRows = grouped.match(/<tr><th scope='row'.*?<\/tr>/g) || [];
  assert.equal(printedRows.length, 12, `${lang}: identical fees still print one row per region`);
  printedRows.forEach(row => assert.equal((row.match(/class='region-heading'/g) || []).length, 1, `${lang}: regions never share a printed row`));
  regions.forEach((region, index) => {
    assert.equal(region[1], regionCases[index][languageIndex]);
    assert.deepEqual([...region[2].matchAll(/Prefecture (\d+)/g)].map(match => Number(match[1])), regionCases[index][3], `${lang}: prefectures under the correct region`);
  });
  assert.equal((grouped.match(/class='prefecture'/g) || []).length, 47, `${lang}: each prefecture appears once`);
}
const splitRegionHtml = api.documentHtml(model, { baseUrl: "https://dcats.example/", version: "test", lang: "ja" });
assert.equal((splitRegionHtml.match(/class='prefecture'/g) || []).length, 47, "different rates retain every prefecture under its own region heading");
const differentRateRows = splitRegionHtml.match(/<tr><th scope='row'.*?<\/tr>/g) || [];
assert.equal(differentRateRows.length, 47, "different rates within a region remain separate");
differentRateRows.forEach(row => assert.equal((row.match(/class='region-heading'/g) || []).length, 1, "different rates never merge regions"));
const inactive = { ...rows[0], is_active: false, standard_fee_jpy: 999999 };
assert.equal(api.buildModel([...rows, inactive], prefectures).sourceCount, 846);
assert.throws(() => api.buildModel([inactive], prefectures), /EMPTY/);
assert.throws(() => api.buildModel([...rows, rows[0]], prefectures), /DUPLICATE/);
assert.throws(() => api.buildModel([{ ...rows[0], standard_fee_jpy: -1 }], prefectures), /INVALID/);
assert.throws(() => api.buildModel([{ ...rows[0], prefecture_code: 48 }], prefectures), /INVALID/);
const changed = rows.map(r => ({ ...r }));
changed[0].remote_island_fee_jpy = 123;
assert.equal(api.buildModel(changed, prefectures).lines.length, 13, "different island conditions must not be merged");
const edgeRows = [
  { ...rows[0], carrier_name: "<img src=x onerror=alert(1)>", note: "<script>bad()</script>", standard_fee_jpy: 0 },
  { ...rows[0], prefecture_code: 2, standard_fee_jpy: null, tax_type: "included" },
  { ...rows[0], prefecture_code: 3, tax_type: "unknown" }
];
const html = api.documentHtml(api.buildModel(edgeRows, prefectures), { baseUrl: "https://dcats.example/", version: "test", lang: "ja", createdAt: "2026-10-15T00:00:00Z" });
assert(html.includes("&lt;script&gt;bad()&lt;/script&gt;"));
assert(!html.includes("<img src=x"));
const unsafePrefectures = { ...prefectures, 16: "<img src=x onerror=alert(1)>" };
const unsafeDestinationHtml = api.documentHtml(api.buildModel(rows, unsafePrefectures), { baseUrl: "https://dcats.example/", version: "test", lang: "ja" });
assert(unsafeDestinationHtml.includes("&lt;img src=x onerror=alert(1)&gt;"));
assert(!unsafeDestinationHtml.includes("<img src=x"));
assert(html.includes("<td>0</td>"));
assert(html.includes("要確認") && html.includes("設定なし（無料ではありません）"));
for (const tax of ["税抜", "税込", "税区分未設定"]) assert(html.includes(tax));
assert(!/\sstyle=|\sonclick=|<script>/.test(html), "print page preserves strict CSP");
for (const lang of ["en", "zh"]) assert(api.documentHtml(model, { baseUrl: "https://dcats.example/", version: "test", lang }).includes(`<html lang='${lang}'>`));

const button = new EventTarget();
const messages = [], documents = [];
let allowed = true, denied = 0, opened = 0, blocked = false;
const context = vm.createContext({
  window: { DcatsShippingRatePrint: api, location: { href: "https://dcats.example/" }, open() {
    opened++;
    if (blocked) return null;
    return { opener: {}, document: { open() {}, write(value) { documents.push(value); }, close() {} }, close() {} };
  } },
  document: { getElementById: id => id === "shipping-rate-print" ? button : null },
  APP_VERSION: "test", currentLang: "ja", shippingRateRows: rows, shippingRatePrintReady: true,
  t: key => key, alert: message => messages.push(message),
  canManageShippingRates: () => allowed, showPermissionDenied: () => denied++
});
vm.runInContext(declaration("SHIPPING_PREFECTURES") + declaration("shippingPrefectureLabel") + declaration("printShippingRateList"), context);
const listener = ast.body.find(n => n.type === "ExpressionStatement" && source.slice(n.start, n.end).startsWith('document.getElementById("shipping-rate-print").addEventListener('));
assert(listener);
vm.runInContext(source.slice(listener.start, listener.end), context);
button.dispatchEvent(new Event("click"));
assert.equal(opened, 1);
assert.equal(documents.length, 1);
assert(documents[0].includes("北海道") && documents[0].includes("沖縄県"), "print all prefectures independently of screen filters");
allowed = false;
button.dispatchEvent(new Event("click"));
assert.equal(denied, 1); assert.equal(opened, 1);
allowed = true; context.shippingRatePrintReady = false;
button.dispatchEvent(new Event("click"));
assert.equal(opened, 1); assert.equal(messages.at(-1), "shipping_print_unavailable");
context.shippingRatePrintReady = true; blocked = true;
button.dispatchEvent(new Event("click"));
assert.equal(messages.at(-1), "shipping_print_popup_blocked");
context.shippingRateRows = [rows[0], rows[0]];
button.dispatchEvent(new Event("click"));
assert.equal(opened, 2); assert.equal(messages.at(-1), "shipping_print_invalid");

const css = fs.readFileSync(path.join(root, "shipping-rate-print.css"), "utf8");
assert(/@page\s*\{\s*size:\s*A4 landscape;/.test(css));
assert(css.includes("width: 281mm; height: 194mm"));
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
assert(/id="shipping-rate-print"[^>]*disabled/.test(index));
for (const asset of ["shipping-rate-print.js", "shipping-rate-print.css"]) assert(fs.readFileSync(path.join(root, "scripts/build-static-site.js"), "utf8").includes(`"${asset}"`));
assert.equal((source.match(/shipping_print_scope:/g) || []).length, 3);
console.log("shipping rate print passed: 846 exact rates, 12 region headings and 47 prefecture mappings in 3 languages, grouping, size order, tax/conditions, missing/zero fees, escaping, permission/loading/popup guards and A4 assets");
