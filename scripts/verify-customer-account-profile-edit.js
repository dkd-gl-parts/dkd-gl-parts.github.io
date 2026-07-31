const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const styles = fs.readFileSync(path.join(root, "styles.css"), "utf8");

[
  'id="btn-customer-account-email-preview"',
  'id="customer-account-email-preview-overlay"',
  'id="customer-account-edit-overlay"',
  'id="customer-account-edit-name"',
  'id="customer-account-edit-email"',
  'id="customer-account-edit-fax"',
  'id="btn-customer-account-edit-save"',
].forEach((expected) => {
  if (!html.includes(expected)) throw new Error(`customer account control is missing: ${expected}`);
});

[
  "customer-account-edit-button",
  'action: "update_details"',
  "updateCustomerAccountFaxCache(result.data.fax)",
  "openCustomerAccountEmailPreview",
  "saveCustomerAccountEdit",
  "customer_user_edit_forbidden",
  "email_already_registered",
].forEach((expected) => {
  if (!app.includes(expected)) throw new Error(`customer account behavior is missing: ${expected}`);
});

[
  ".customer-account-preview-button",
  ".customer-account-edit-modal",
  ".customer-account-email-preview-modal",
].forEach((expected) => {
  if (!styles.includes(expected)) throw new Error(`customer account styling is missing: ${expected}`);
});

if (!html.includes("【D-CATS】アカウント登録のご案内") ||
    !html.includes("平素より大光電機株式会社をご愛顧いただき") ||
    !html.includes("D-CATSの利用を開始する") ||
    !html.includes("本メールにお心当たりがない場合") ||
    !html.includes("Supabaseで最終テンプレートを確認")) {
  throw new Error("the invitation preview must match the approved Japanese business email template");
}

const editAction = app.slice(
  app.indexOf("async function saveCustomerAccountEdit"),
  app.indexOf("function bindCustomerAccountUserEvents"),
);
if (!editAction.includes("name: name") ||
    !editAction.includes("email: email") ||
    !editAction.includes("fax: fax") ||
    !editAction.includes("await loadCustomerAccountUsers(customerId)")) {
  throw new Error("saving account details must send all editable fields and refresh the registered account list");
}

[
  'id="customer-portal-customer-code"',
  'id="customer-portal-price-state"',
  'id="customer-portal-scope-state"',
].forEach((removed) => {
  if (html.includes(removed)) throw new Error(`unnecessary customer portal field is still rendered: ${removed}`);
});

const customerHeader = app.slice(
  app.indexOf("function renderCustomerExperienceHeaders"),
  app.indexOf("function configureCustomerSearchShell"),
);
if (!customerHeader.includes("var name = isCustomerViewer()") ||
    !customerHeader.includes("? fallbackName")) {
  throw new Error("customer login headers must show the registered profile name");
}

const customerPortal = app.slice(
  app.indexOf("function renderCustomerPortal()"),
  app.indexOf("async function loadCustomerManagedUsers"),
);
[
  'customerPortalValue("customer-portal-customer-code"',
  'customerPortalValue("customer-portal-price-state"',
  'customerPortalValue("customer-portal-scope-state"',
].forEach((removed) => {
  if (customerPortal.includes(removed)) throw new Error(`removed customer portal field is still updated: ${removed}`);
});

const transferAction = app.slice(
  app.indexOf("async function transferCustomerAccountAdmin"),
  app.indexOf("function customerAccountInviteErrorMessage"),
);
if (!transferAction.includes('action: "transfer_admin"') ||
    !transferAction.includes("await loadCustomerAccountUsers(customerId)") ||
    !transferAction.includes('customer_users_transfer_confirm_detail') ||
    !transferAction.includes('customer_users_transfer_done_detail')) {
  throw new Error("customer administrator transfer must use the protected server action and refresh the account list");
}

const customerManagedTransfer = app.slice(
  app.indexOf("async function transferCustomerManagedAdmin"),
  app.indexOf("async function openCustomerPortalSearch"),
);
if (!customerManagedTransfer.includes('action: "transfer_admin"') ||
    !customerManagedTransfer.includes("await loadCustomerViewerContext()") ||
    !customerManagedTransfer.includes('customer_users_transfer_confirm_detail') ||
    !customerManagedTransfer.includes('customer_users_transfer_done_detail')) {
  throw new Error("customer-side administrator transfer must identify the target and refresh portal permissions");
}

console.log("customer account profile edit guard passed");
