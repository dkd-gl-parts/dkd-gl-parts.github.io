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

// Directory placement is independent of selection and never mutates shared rows.
const list={innerHTML:"",querySelectorAll:()=>[]};
const displayContext={
  CUSTOMER_ACCESS_DEVELOPMENT_DEFAULT_CODE:"DEV-ORDER-001",
  currentCustomerAccessCustomer:rows[1],customerAccessFilteredRows:rows,
  detailSalesCustomerOptions:rows.map(row=>({...row,customer_name:"Customer "+row.id})),
  detailSelectedSalesCustomerId:"167",t:key=>key,esc:value=>String(value),
  document:{getElementById:id=>id==="customer-access-list"?list:null},
};
const displayFunctions=["isDevelopmentSalesCustomer","salesManagementCustomerOptions","renderCustomerAccessList","renderDetailCustomerInfoHtml","detailCustomerOptionLabel"];
vm.createContext(displayContext);vm.runInContext(displayFunctions.map(extractFunction).join("\n"),displayContext);
const expected=[14,75,167];
for(const input of [rows,[rows[1],rows[0],rows[2]],[rows[0],rows[2],rows[1]]]){
  displayContext.customerAccessFilteredRows=input;
  const before=JSON.stringify(input);displayContext.renderCustomerAccessList();
  const actual=[...list.innerHTML.matchAll(/data-customer-id='(\d+)'/g)].map(match=>Number(match[1]));
  if(JSON.stringify(actual)!==JSON.stringify(expected)||JSON.stringify(input)!==before)throw Error("test customer must render last without mutating source or ordinary order");
}
if(!displayContext.isDevelopmentSalesCustomer({source_customer_code:" dev-order-001 ",customer_name:"Renamed"})||displayContext.isDevelopmentSalesCustomer({source_customer_code:"J75",customer_name:"D-CATS開発テスト得意先"}))throw Error("use the dedicated code rather than the display name");
const options=displayContext.salesManagementCustomerOptions();
if(options.length!==2||options.some(row=>row.id===167)||displayContext.detailSalesCustomerOptions.length!==3)throw Error("normal sales choices must exclude test customers without removing test portal data");
const salesHtml=displayContext.renderDetailCustomerInfoHtml(null,null,true,null);
if(salesHtml.includes("value='167'")||!salesHtml.includes("value='14'")||!salesHtml.includes("value='75'"))throw Error("sales selector exposes the development customer or removes ordinary customers");
displayContext.detailSalesCustomerOptions=[rows[1]];
if(!displayContext.renderDetailCustomerInfoHtml(null,null,true,null).includes("detail_customer_no_customers"))throw Error("test-only choices must show the no-customer state");
const currentDetail=extractFunction("loadDetailCustomerInfoForCurrent");
if(!currentDetail.includes("salesManagementCustomerOptions().find")||!currentDetail.includes('if (!customer && detailSelectedSalesCustomerId) detailSelectedSalesCustomerId = ""'))throw Error("stale selected test customers must be cleared before pricing");
console.log("development customer placement and normal sales exclusion guard passed");
