const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");

function extractFunction(name) {
  const start = app.indexOf(`function ${name}`);
  if (start < 0) throw new Error(`${name} is missing`);
  const bodyStart = app.indexOf("{", start);
  let depth = 0;
  for (let i = bodyStart; i < app.length; i += 1) {
    if (app[i] === "{") depth += 1;
    if (app[i] === "}") depth -= 1;
    if (depth === 0) return app.slice(start, i + 1);
  }
  throw new Error(`${name} is incomplete`);
}

const helperSource = extractFunction("customerAccessInitialCustomer");
const context = {
  CUSTOMER_ACCESS_DEVELOPMENT_DEFAULT_CODE: "DEV-ORDER-001",
};
vm.runInNewContext(`${helperSource}; this.pick = customerAccessInitialCustomer;`, context);

const rows = [
  { id: 14, source_customer_code: "14", is_active: true },
  { id: 167, source_customer_code: "DEV-ORDER-001", is_active: true },
  { id: 75, source_customer_code: "J75", is_active: true },
];
if (context.pick(rows).id !== 167) {
  throw new Error("the development customer must be selected when it is active and visible");
}
if (context.pick(rows.map((row) => row.id === 167 ? { ...row, is_active: false } : row)).id !== 14) {
  throw new Error("an inactive development customer must fall back to the first visible customer");
}
if (context.pick(rows.filter((row) => row.id !== 167)).id !== 14) {
  throw new Error("a deleted or filtered development customer must fall back to the first visible customer");
}
if (context.pick([]) !== null) {
  throw new Error("an empty customer list must return null");
}

const enterBlock = app.slice(
  app.indexOf("async function enterCustomerAccessMgmt"),
  app.indexOf("async function ensureCustomerAccessShippingServices"),
);
[
  "currentCustomerAccessCustomer = null",
  "customerAccessInitialSelectionPending = true",
  'searchInput.value = ""',
  "includeInactiveInput.checked = false",
].forEach((expected) => {
  if (!enterBlock.includes(expected)) throw new Error(`customer access entry reset is missing: ${expected}`);
});

const loadBlock = app.slice(
  app.indexOf("async function loadCustomerAccessMgmt"),
  app.indexOf("function customerAccessInitialCustomer"),
);
if (!loadBlock.includes("var useDevelopmentDefault = customerAccessInitialSelectionPending") ||
    !loadBlock.includes("customerAccessInitialSelectionPending = false") ||
    !loadBlock.includes("? customerAccessInitialCustomer(customerAccessFilteredRows)") ||
    !loadBlock.includes(": customerAccessFilteredRows[0]")) {
  throw new Error("the development default must only be consumed by the initial customer-management load");
}

console.log("customer access development default guard passed");
