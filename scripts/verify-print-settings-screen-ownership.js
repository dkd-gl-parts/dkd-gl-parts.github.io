const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "styles.css"), "utf8");

function sectionBetween(source, start, end, label) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  if (from < 0 || to < from) throw new Error(`${label} could not be isolated`);
  return source.slice(from, to);
}

const orderScreen = sectionBetween(
  html,
  '<div id="screen-sales-order-mgmt"',
  '<div id="screen-shipping-document-mgmt"',
  "Sales order screen"
);
const orderSettings = sectionBetween(
  html,
  '<div class="form-overlay" id="sales-order-print-settings-overlay"',
  '<div class="form-overlay" id="sales-order-pricing-overlay"',
  "Automatic-print settings"
);
const shippingScreen = sectionBetween(
  html,
  '<div id="screen-shipping-document-mgmt"',
  '<div class="form-overlay" id="shipping-waybill-layout-overlay"',
  "Shipping document screen"
);

for (const fragment of [
  "受付時の出荷指示書自動印刷",
  "自動印刷設定",
  'id="sales-order-auto-print-station"',
  'id="sales-order-auto-print-enabled"',
  'id="sales-order-auto-print-save"',
  "自動印刷プリンター"
]) {
  if (!orderScreen.includes(fragment) && !orderSettings.includes(fragment)) {
    throw new Error(`Automatic-print control is missing: ${fragment}`);
  }
}

for (const forbidden of [
  'dcats-print-settings://open',
  "帳票・プリンター設定",
  "印刷位置調整",
  "帳票別プリンター",
  "複写伝票を設定"
]) {
  if (orderSettings.includes(forbidden)) {
    throw new Error(`Order automatic-print settings contain shipment-document configuration: ${forbidden}`);
  }
}

for (const fragment of [
  'id="shipping-document-printer-settings-open"',
  'href="dcats-print-settings://open"',
  "帳票・プリンター設定",
  'id="shipping-waybill-layout-open"',
  "印刷位置調整"
]) {
  if (!shippingScreen.includes(fragment)) {
    throw new Error(`Shipping-document setting entry is missing: ${fragment}`);
  }
}

if (html.includes('id="sales-order-print-settings-launch"') ||
    app.includes('getElementById("sales-order-print-settings-launch")')) {
  throw new Error("The former all-document printer launcher must be removed from order management");
}
if (!app.includes('getElementById("shipping-document-printer-settings-open")') ||
    !app.includes("Windowsの帳票・プリンター設定を開きます")) {
  throw new Error("Shipping document printer-settings guidance is not wired");
}
for (const fragment of [
  ".shipping-document-title-actions",
  ".shipping-document-title-actions a",
  ".sales-order-print-settings-current"
]) {
  if (!styles.includes(fragment)) throw new Error(`Print-setting ownership styling is missing: ${fragment}`);
}

console.log("Print settings screen ownership verification passed.");
