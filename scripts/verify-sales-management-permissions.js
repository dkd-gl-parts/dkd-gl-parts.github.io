const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

function functionSource(name) {
  const start = app.indexOf(`function ${name}(`);
  expect(start >= 0, `Missing function: ${name}`);
  const next = app.indexOf("\nfunction ", start + 10);
  return app.slice(start, next >= 0 ? next : app.length);
}

expect(app.includes('access_role_master_editor: "販売管理"'), "Japanese role label is not Sales Management");
expect(app.includes('access_role_master_editor: "Sales Management"'), "English role label is not Sales Management");
expect(app.includes('["master_editor", "販売管理"]'), "Role option is not Sales Management");

expect(functionSource("canEditBasePrice").includes('"master_editor"'), "Sales Management must manage base prices");
expect(functionSource("canManageCustomerAccess").includes('"master_editor"'), "Sales Management must manage customers");
expect(functionSource("canManagePurchaseLinks").includes('"master_editor"'), "Sales Management must manage purchase links");
expect(functionSource("canUseRakutenResearch").includes('"master_editor"'), "Sales Management must run price research");

[
  "canViewProductionFeatures",
  "canViewCoreManagement",
  "canManageProductionRecords",
  "canViewManufacturingReport",
  "canManageCompatibility",
  "canEditCompatibility",
  "canViewInternalComponents",
  "canManageComponentNameMaster",
  "canManageComponentCompatibility",
  "canEditProductKindStockMgmt",
  "canUseUserManagement",
].forEach((name) => {
  expect(!functionSource(name).includes('"master_editor"'), `${name} still grants the Sales Management base role`);
});

expect(functionSource("canManageCustomerAccounts").includes("canManageCustomerAccess()"), "Customer account management is not tied to customer access permission");
[
  "renderCustomerAccountIssuance",
  "loadCustomerAccountUsers",
  "renderCustomerAccountUsers",
  "updateCustomerAccountUserStatus",
  "sendCustomerAccountPasswordReset",
  "transferCustomerAccountAdmin",
  "issueCustomerAccount",
].forEach((name) => {
  const source = functionSource(name);
  expect(source.includes("canManageCustomerAccounts()"), `${name} does not use customer account permission`);
  expect(!source.includes("isSystemAdmin()"), `${name} is still limited to system administrators`);
});

expect(app.includes('case "master_editor": return "商品/画像・販売/基準価格・得意先・仕入/価格調査管理。'), "Permission summary was not updated");
expect(html.includes(">得意先管理権限</span>"), "Customer account section badge was not updated");

console.log("Sales Management permission contract: OK");
