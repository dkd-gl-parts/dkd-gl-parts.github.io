const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8").replace(/\r\n/g, "\n");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8").replace(/\r\n/g, "\n");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8").replace(/\r\n/g, "\n");

function requireFragment(target, fragment, message) {
  if (!target.includes(fragment)) throw new Error(message || `Missing Sales King customer contract: ${fragment}`);
}

function functionSource(name) {
  const markers = [`function ${name}(`, `async function ${name}(`];
  const starts = markers.map((marker) => source.indexOf(marker)).filter((index) => index >= 0);
  if (!starts.length) throw new Error(`Function is missing: ${name}`);
  const start = Math.min(...starts);
  const stops = [
    source.indexOf("\nfunction ", start + 1),
    source.indexOf("\nasync function ", start + 1),
  ].filter((index) => index >= 0);
  return source.slice(start, stops.length ? Math.min(...stops) : source.length);
}

for (const id of [
  "btn-customer-access-add",
  "customer-register-overlay",
  "customer-register-confirmed",
  "customer-register-code",
  "customer-register-name",
  "customer-register-rank",
  "btn-customer-register-save",
]) requireFragment(html, `id="${id}"`);

requireFragment(html, 'maxlength="13"');
requireFragment(html, 'data-i18n="customer_register_confirm"');
requireFragment(html, 'data-i18n="customer_register_code_help"');

const open = functionSource("openCustomerRegistration");
requireFragment(open, "ensureCustomerAccessPriceRanks()");
requireFragment(open, 'customerAccessRankOptionsHtml("HANBAIOU_URI_1")');

const save = functionSource("registerHanbaiouCustomer");
for (const fragment of [
  'document.getElementById("customer-register-confirmed")',
  "customer_register_confirm_error",
  "/^[!-~]+$/",
  'sb.rpc("register_hanbaiou_customer"',
  "p_hanbaiou_customer_code: code",
  "p_customer_name: name",
  "loadCustomerAccessMgmt()",
  "selectCustomerAccessCustomer(saved.sales_customer_id)",
]) requireFragment(save, fragment);

const codeBlock = functionSource("salesAccountingExportCodeBlockHtml");
for (const fragment of [
  'kind === "customer" && state.targetSystem === "hanbaiou"',
  "customer_register_export_managed",
]) requireFragment(codeBlock, fragment);

for (const fragment of [
  ".form-card.customer-register-card",
  ".customer-register-flow",
  ".customer-register-grid",
  ".customer-register-confirm",
]) requireFragment(css, fragment);

for (const fragment of [
  'document.getElementById("btn-customer-access-add").addEventListener("click", openCustomerRegistration)',
  'document.getElementById("btn-customer-register-save").addEventListener("click", registerHanbaiouCustomer)',
]) requireFragment(source, fragment);

for (const key of [
  "customer_register_title",
  "customer_register_confirm",
  "customer_register_hanbaiou_code",
  "customer_register_export_managed",
]) {
  const matches = source.match(new RegExp(`${key}:`, "g")) || [];
  if (matches.length !== 3) throw new Error(`${key} must be translated in Japanese, English, and Chinese`);
}

console.log("Sales King customer onboarding UI verification passed.");
