const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "styles.css"), "utf8");

function requireFragment(source, fragment, message) {
  if (!source.includes(fragment)) throw new Error(message || `Missing waybill layout contract: ${fragment}`);
}

for (const id of [
  "shipping-waybill-layout-open",
  "shipping-waybill-layout-overlay",
  "shipping-waybill-layout-content",
  "shipping-waybill-layout-canvas",
  "shipping-waybill-layout-message",
  "shipping-waybill-layout-save"
]) requireFragment(html + app, id, `Waybill layout UI is missing ${id}`);

for (const fragment of [
  "var SHIPPING_WAYBILL_FIELD_META",
  "function shippingWaybillPreviewData(",
  'if (!outbound) contentsText += " コア返却分";',
  "var SHIPPING_WAYBILL_BACKGROUND_ASSETS",
  "function shippingWaybillBackgroundAsset(",
  "function drawShippingWaybillBackground(",
  "function shippingWaybillPurpose(",
  "function enforceShippingWaybillPurposeRules(",
  "function drawShippingWaybillLayoutCanvas(",
  "function bindShippingWaybillLayoutCanvas(",
  "function openShippingWaybillLayoutDesigner(",
  "function saveShippingWaybillLayout(",
  'sb.rpc("get_sales_order_waybill_layouts")',
  'sb.rpc("save_sales_order_waybill_layout"',
  "target_expected_version: Number(draft.base_version)",
  "選択した版を下書きへ",
  "伝票背景とガイド線は位置合わせ用で印刷されません",
  "新しい印刷依頼から反映されます"
]) requireFragment(app, fragment);

for (const fragment of [
  "shipping-waybill-layout-purpose",
  "商品発送送り状",
  "コア返却用複写伝票",
  "送り先は大光電機です。送り主は印字しません。",
  "ご依頼主（記入・印字なし）",
  'sender_postal: outbound ? daiko.postal : ""',
  "shippingWaybillIsReturnSenderField(draft, field)"
]) requireFragment(app, fragment, `Waybill purpose contract is missing: ${fragment}`);

for (const fragment of [
  'yamato_collect: "assets/waybills/yamato-takkyubin-collect.webp"',
  'sagawa_collect: "assets/waybills/sagawa-hikyaku-collect.webp"',
  "実物伝票背景",
  "伝票背景とガイド線は位置合わせ用で印刷されません"
]) requireFragment(app, fragment, `Waybill background contract is missing: ${fragment}`);

for (const asset of [
  "assets/waybills/yamato-takkyubin-collect.webp",
  "assets/waybills/sagawa-hikyaku-collect.webp"
]) {
  const assetPath = path.join(root, asset);
  if (!fs.existsSync(assetPath)) throw new Error(`Waybill background asset is missing: ${asset}`);
  if (fs.statSync(assetPath).size < 100000) throw new Error(`Waybill background asset is unexpectedly small: ${asset}`);
}

for (const field of [
  "recipient_postal", "recipient_phone", "recipient_address", "recipient_name",
  "sender_postal", "sender_phone", "sender_address", "sender_name", "contents",
  "order_number", "tracking_number", "desired_date", "package_count"
]) requireFragment(app, field, `Waybill layout field is missing: ${field}`);

for (const fragment of [
  "data-waybill-field-property='x_mm'",
  "data-waybill-field-property='y_mm'",
  "data-waybill-field-property='font_size_pt'",
  "data-waybill-field-property='max_lines'",
  "data-waybill-field-property='align'",
  "data-waybill-field-property='bold'",
  "data-waybill-field-property='visible'",
  "setPointerCapture",
  'event.key === "ArrowLeft"',
  "event.shiftKey ? 1 : 0.5"
]) requireFragment(app, fragment);

requireFragment(html, 'href="dcats-print-calibration://open"', "Terminal-wide correction must open from the print-position workflow");
requireFragment(html, 'id="shipping-waybill-calibration-open"', "Print-position workflow must expose the local calibration action");
requireFragment(app, "このPCの用紙・全体補正とテスト印刷を開きます", "Local calibration guidance must be wired");
if (/on(?:click|change|input|keydown)\s*=/i.test(html.match(/id="shipping-waybill-layout-overlay"[\s\S]*?id="shipping-document-settings-overlay"/)?.[0] || "")) {
  throw new Error("Waybill layout modal must not use inline event handlers");
}

for (const fragment of [
  ".shipping-waybill-layout-card",
  ".shipping-waybill-layout-workspace",
  ".shipping-waybill-purpose-note",
  ".shipping-waybill-field-list",
  ".shipping-waybill-preview",
  "#shipping-waybill-layout-canvas",
  ".shipping-waybill-inspector",
  "@media (max-width: 760px)"
]) requireFragment(styles, fragment);


// Size changes must include disabled return-sender boxes and unchecked fields.
const assert = require("node:assert/strict");
const vm = require("node:vm");
const resizeSource = app.slice(app.indexOf("function resizeShippingWaybillPaper("), app.indexOf("function bindShippingWaybillLayoutDesignerActions("));
const resize = vm.runInNewContext(resizeSource + "\nresizeShippingWaybillPaper");
const draft = {paper_width_mm: 228.6, paper_height_mm: 127, fields: [
  {key: "recipient_phone", x_mm: 30, y_mm: 90.1, width_mm: 75, height_mm: 6, font_size_pt: 12, visible: true},
  {key: "sender_phone", x_mm: 25, y_mm: 114, width_mm: 75, height_mm: 6, visible: false},
  {key: "package_count", x_mm: 226.6, y_mm: 125, width_mm: 2, height_mm: 2, visible: false}
]};
resize(draft, "paper_width_mm", 190);
assert.equal(draft.fields[0].y_mm, 90.1);
resize(draft, "paper_height_mm", 101);
assert.deepEqual(draft.fields[0], {key: "recipient_phone", x_mm: 24.9, y_mm: 71.7, width_mm: 62.3, height_mm: 4.8, font_size_pt: 12, visible: true});
assert.deepEqual(draft.fields[2], {key: "package_count", x_mm: 188, y_mm: 99, width_mm: 2, height_mm: 2, visible: false});
for (const [width, height] of [[190, 101], [350, 250], [100, 70]]) {
  resize(draft, "paper_width_mm", width);
  resize(draft, "paper_height_mm", height);
  for (const field of draft.fields) {
    assert.ok(field.width_mm >= 2 && field.height_mm >= 2);
    assert.ok(Math.round((field.x_mm + field.width_mm) * 10) <= width * 10);
    assert.ok(Math.round((field.y_mm + field.height_mm) * 10) <= height * 10);
  }
}


// A suppressed return-sender field can cover the recipient's name on a saved form.
const hitSource = app.slice(app.indexOf("function shippingWaybillFieldAtPoint("), app.indexOf("function bindShippingWaybillLayoutCanvas("));
const hitContext = {shippingWaybillLayoutSelectedField: "recipient_phone", shippingWaybillSelectableFields: layout => layout.fields.filter(field => !field.suppressed)};
const hitTest = vm.runInNewContext(hitSource + "\nshippingWaybillFieldAtPoint", hitContext);
const overlap = ["recipient_name", "contents", "tracking_number", "sender_address"].map(key => ({
  key, x_mm: 20, y_mm: 30, width_mm: 60, height_mm: 8, visible: key !== "tracking_number", suppressed: key === "sender_address"
}));
const point = {x: 48, y: 34};
assert.equal(hitTest({fields: overlap}, point).key, "contents");
hitContext.shippingWaybillLayoutSelectedField = "recipient_name";
assert.equal(hitTest({fields: overlap}, point).key, "recipient_name");
assert.equal(hitTest({fields: overlap.slice(-1)}, point), undefined);
assert.equal(hitTest({fields: overlap}, {x: 0, y: 0}), undefined);

console.log("Waybill layout designer verification passed.");
