const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

function requireFragment(source, fragment, label = fragment) {
  if (!source.includes(fragment)) throw new Error(`Missing Sales King billing-settings UI contract: ${label}`);
}

for (const fragment of [
  'id="customer-register-billing-code"',
  'id="customer-register-closing-code"',
  'data-i18n="customer_register_billing_code"',
  'data-i18n="customer_register_closing_code"',
]) requireFragment(html, fragment);

for (const fragment of [
  "function hanbaiouClosingCodeOptionsHtml",
  'customer_register_billing_error: "販売王 請求得意先コードを、カンマと引用符を除く半角13文字以内で入力してください。"',
  'customer_access_hanbaiou_billing: "販売王 請求設定"',
  'sb.rpc("register_hanbaiou_customer_with_billing"',
  "p_billing_customer_code: billingCode",
  "p_closing_code: closingCode",
  "source_code,source_customer_code",
  "billing_customer_code,closing_code",
  "id='customer-hanbaiou-billing-code'",
  "id='customer-hanbaiou-closing-code'",
  "function collectHanbaiouCustomerBillingSettings",
  "function validateHanbaiouCustomerBillingSettings",
  "hanbaiouBilling: collectHanbaiouCustomerBillingSettings()",
  'sb.rpc("save_hanbaiou_customer_billing_settings"',
  "target_sales_customer_id: customerId",
  "target_billing_customer_code: hanbaiouBilling.billing_customer_code",
  "target_closing_code: hanbaiouBilling.closing_code",
]) requireFragment(app, fragment);

for (const fragment of [
  ".customer-hanbaiou-billing",
  ".customer-hanbaiou-billing-grid",
  ".customer-hanbaiou-billing-field",
  ".customer-hanbaiou-billing-help",
]) requireFragment(css, fragment);

if (!/for \(var day = 1; day <= 30; day \+= 1\)/.test(app)) {
  throw new Error("Closing-code selector must contain fixed days 1 through 30");
}
if (!app.includes('value: "0"') || !app.includes('value: "31"')) {
  throw new Error("Closing-code selector must include on-demand code 0 and month-end code 31");
}

console.log("Sales King customer billing settings UI verification passed.");
