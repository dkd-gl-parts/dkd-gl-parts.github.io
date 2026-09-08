const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
const revision = fs.readFileSync(path.join(root, "sales-order-revision.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

function requireFragment(text, fragment, label) {
  if (!text.includes(fragment)) throw new Error(`Missing ${label}: ${fragment}`);
}

[
  'id="customer-order-destination-type"',
  '<option value="yamato_office">営業所で受け取る</option>',
  'data-customer-order-destination-choice checked><span>通常住所</span>',
  'data-customer-order-destination-choice><span>営業所で受け取る</span>',
  'id="customer-order-yamato-office-code"',
  'value="068721"',
  '〒562-0035 大阪府箕面市船場東',
  'B2 CSV：止置き「1」・営業所コード「068721」',
  '複写伝票：「ヤマト運輸 箕面船場（箕面船場西）営業所止め」と印字'
].forEach((fragment) => requireFragment(html, fragment, "office-pickup entry UI"));

[
  'code: "068721"',
  'name: "箕面船場（箕面船場西）営業所"',
  'postal_code: "562-0035"',
  'address_line_1: "箕面市船場東"',
  'destination_type: destinationType',
  'yamato_office_code: office ? office.code : ""',
  'yamato_office_name: office ? office.name : ""',
  'row.carrier_name === "ヤマト運輸"',
  'address.destination_type !== "yamato_office"',
  '"ヤマト運輸 " + (address.yamato_office_name || "営業所") + "止め"'
].forEach((fragment) => requireFragment(source, fragment, "office-pickup behavior"));

[
  'function syncCustomerOrderDestinationChoices(root, destinationType)',
  'destinationSelect.dispatchEvent(new Event("change", { bubbles: true }))'
].forEach((fragment) => requireFragment(source, fragment, "destination choice behavior"));

[
  '"customer-order-destination-type":"destination_type"',
  '"customer-order-yamato-office-code":"yamato_office_code"',
  'address.destination_type = salesOrderRevisionDestinationType()',
  'address.yamato_office_code = office ? office.code : ""',
  'customerOrderDestinationError(address, outboundMethod)'
].forEach((fragment) => requireFragment(revision, fragment, "office-pickup revision behavior"));

[
  'syncCustomerOrderDestinationChoices(overlay, officePickup ? "yamato_office" : "address")',
  'overlay.querySelectorAll("[data-customer-order-destination-choice]")'
].forEach((fragment) => requireFragment(revision, fragment, "revision destination choice behavior"));

[
  ".customer-order-yamato-office-panel",
  ".customer-order-destination-choice",
  ".customer-order-destination-choice input:checked + span",
  "min-width: 0",
  ".customer-order-yamato-office-panel[hidden] { display: none; }",
  ".sales-order-office-pickup-badge",
  "grid-template-columns: 1fr;"
].forEach((fragment) => requireFragment(css, fragment, "responsive office-pickup layout"));

if (!source.includes('var APP_VERSION       = "v1.1.920"') || !html.includes('content="v1.1.920"')) {
  throw new Error("Yamato office-pickup release version must be v1.1.920");
}

console.log("Yamato office-pickup frontend verified.");
