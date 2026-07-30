const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

function sourceBetween(startText, endText) {
  const start = source.indexOf(startText);
  const end = source.indexOf(endText, start + startText.length);
  if (start < 0 || end < start) throw new Error(`${startText} could not be isolated`);
  return source.slice(start, end);
}

[
  "screen-customer-shipping",
  "customer-shipping-prefecture",
  "customer-shipping-carrier",
  "screen-shipping-rate-mgmt",
  "shipping-rate-prefecture-filter",
  "shipping-rate-carrier-filter",
  "shipping-rate-status-filter",
  "shipping-rate-form-overlay",
  "shipping-rate-standard-fee",
  "shipping-rate-island-fee",
  "shipping-rate-island-condition"
].forEach((id) => {
  if (!html.includes(`id="${id}"`)) throw new Error(`shipping UI control is missing: ${id}`);
});

const customerLoad = sourceBetween("async function loadCustomerShippingRates", "function renderCustomerShippingRates");
if (!customerLoad.includes('from("customer_shipping_rates")') || !customerLoad.includes('.eq("is_active", true)')) {
  throw new Error("customer shipping list must load only active master rows");
}

const managementLoad = sourceBetween("async function loadShippingRateMgmt", "function renderShippingRateMgmt");
if (!managementLoad.includes('from("customer_shipping_rates")') || managementLoad.includes('.eq("is_active", true)')) {
  throw new Error("shipping management must load active and inactive master rows");
}

const saveSource = sourceBetween("async function saveShippingRate", "async function toggleShippingRateVisibility");
[
  "carrier_name: carrier",
  "prefecture_code: prefectureCode",
  "standard_fee_jpy: standardFee.value",
  "remote_island_fee_jpy: islandFee.value",
  "remote_island_condition: islandCondition || null",
  "updated_by: currentUser ? currentUser.id : null"
].forEach((fragment) => {
  if (!saveSource.includes(fragment)) throw new Error(`shipping save field is missing: ${fragment}`);
});

if (!source.includes('action: "shipping-rate-mgmt"') || !source.includes("enterShippingRateMgmt()")) {
  throw new Error("shipping master must be reachable from the internal menu");
}
if (!source.includes('document.getElementById("customer-portal-shipping").addEventListener("click", enterCustomerShipping)')) {
  throw new Error("customer shipping list must be reachable from the customer portal");
}
if ((source.match(/customer_shipping_title:/g) || []).length !== 3 || (source.match(/mi_shipping_title:/g) || []).length !== 3) {
  throw new Error("shipping labels must be translated for all supported languages");
}
if ((source.match(/\[47,"沖縄県"/g) || []).length !== 1 || !source.includes('[1,"北海道"')) {
  throw new Error("all 47 prefectures must be available");
}

[
  ".customer-shipping-row",
  ".shipping-rate-mgmt-row",
  "@media(max-width:640px)",
  ".customer-shipping-mobile-label",
  ".shipping-rate-cell-label"
].forEach((fragment) => {
  if (!css.includes(fragment)) throw new Error(`shipping responsive style is missing: ${fragment}`);
});

const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
if (duplicateIds.length) throw new Error(`duplicate HTML ids: ${[...new Set(duplicateIds)].join(", ")}`);

console.log("shipping rate management guard passed");
