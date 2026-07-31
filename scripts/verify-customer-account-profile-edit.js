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

if (!html.includes("Supabase Authの「Invite user」テンプレート") ||
    !html.includes("Supabaseで最終テンプレートを確認") ||
    !html.includes("You've been invited")) {
  throw new Error("the invitation preview must explain the actual Supabase template source and standard subject");
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

console.log("customer account profile edit guard passed");
