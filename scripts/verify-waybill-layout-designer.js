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

console.log("Waybill layout designer verification passed.");
