const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function functionSource(name, nextName) {
  const start = app.indexOf(`function ${name}(`);
  const end = nextName ? app.indexOf(`function ${nextName}(`, start + 1) : -1;
  assert(start >= 0, `Missing function: ${name}`);
  return app.slice(start, end > start ? end : app.length);
}

[
  ["system_admin", "システム管理者"],
  ["company_admin", "会社管理者"],
  ["dept_admin", "製造管理者"],
  ["production_editor", "製造スタッフ"],
  ["master_editor", "販売管理者"],
  ["sales_staff", "販売スタッフ"],
  ["sales_editor", "出荷管理者"],
  ["shipping_staff", "出荷スタッフ"],
  ["business_admin", "営業管理者"],
  ["sales_viewer", "営業スタッフ"],
].forEach(([code, label]) => {
  assert(app.includes(`["${code}", "${label}"]`), `Missing base role option: ${label}`);
});

[
  '["all_viewer", "全機能閲覧"]',
  '["core_image_editor", "コア画像登録"]',
  '["internal_viewer", "社内閲覧"]',
  '["external_viewer", "社外閲覧"]',
  '["external", "社外"]',
].forEach((fragment) => assert(!app.includes(fragment), `Retired option remains: ${fragment}`));

assert(!html.includes('id="internal-user-invite-department"'), "Department selector remains in internal invitation UI");
assert(!app.includes('class=\'group-select user-department-select\''), "Department selector remains in internal user cards");
assert(app.includes("class='group-select user-role-select'"), "Internal user cards do not show the base role in place of department");
assert(app.includes('var roleDisabledAttr = canEditUserPermission(u) ? "" : " disabled";'), "Base role changes are not restricted to system administrators");
assert(html.includes("会社と基準権限を指定します"), "Invitation guidance does not describe the simplified model");
assert(html.includes("名前・メール・会社・基準権限で検索"), "Permission search still refers to department");

const departmentMapping = functionSource("departmentCodeForAccessRole", "normalizeAccessRoleForCompany");
[
  'roleCode === "dept_admin" || roleCode === "production_editor"',
  'roleCode === "master_editor" || roleCode === "sales_staff"',
  'roleCode === "sales_editor" || roleCode === "shipping_staff"',
  'roleCode === "business_admin" || roleCode === "sales_viewer"',
].forEach((fragment) => assert(departmentMapping.includes(fragment), `Missing automatic scope mapping: ${fragment}`));

const normalization = functionSource("normalizeAccessRoleForCompany", "legacyRoleFromAccessRole");
assert(normalization.includes('RETIRED_INTERNAL_ACCESS_ROLES.indexOf(role) >= 0'), "Retired roles are not normalized to Sales Staff");
assert(normalization.includes('return "sales_viewer"'), "Retired internal roles do not become Sales Staff");

[
  'dept_admin: ["production_editor"]',
  'master_editor: ["sales_staff"]',
  'sales_editor: ["shipping_staff"]',
  'business_admin: ["sales_viewer"]',
].forEach((fragment) => assert(app.includes(fragment), `Manager-to-staff scope is missing: ${fragment}`));

assert(functionSource("canUseUserManagement", "canAssignUserRole").includes('"business_admin"'), "Sales Manager cannot manage Sales Staff accounts");
const loadUsers = functionSource("loadUsers", "loadUserCustomerLinkOptions");
assert(!loadUsers.includes('.eq("department_code"'), "Internal user loading still depends on the retired department selector");
assert(functionSource("canManageCustomerAccess", "canManageCustomerAccounts").includes('"business_admin"'), "Sales Manager cannot manage customers");
assert(functionSource("canUseRakutenResearch", "canManageEcResearchSchedule").includes('"business_admin"'), "Sales Manager cannot run price research");
assert(functionSource("canEdit", "canIssueGltekPartNumber").includes('"sales_staff"'), "Sales Administration Staff cannot perform daily product updates");
assert(functionSource("canManageSalesOrders", "canViewManagementScreen").includes('"shipping_staff"'), "Shipping Staff cannot perform shipping operations");
assert(app.includes('roleCode !== "customer_viewer" && roleCode !== "service_account"'), "Customer and service accounts are not separated from the internal user list");

console.log("Internal base role organization verified.");
