const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

function requireText(source, text, label) {
  if (!source.includes(text)) throw new Error(`${label} is missing: ${text}`);
}

function forbidText(source, text, label) {
  if (source.includes(text)) throw new Error(`${label} must not remain: ${text}`);
}

[
  'id="internal-user-issuance"',
  'id="btn-open-internal-user-invite"',
  'id="internal-user-invite-overlay"',
  'id="internal-user-invite-name"',
  'id="internal-user-invite-email"',
  'id="internal-user-invite-company"',
  'id="internal-user-invite-department"',
  'id="internal-user-invite-role"',
  'id="btn-internal-user-invite-submit"',
].forEach((text) => requireText(html, text, "internal account issuance UI"));

[
  'id="screen-register"',
  'id="btn-to-register"',
  'id="btn-submit-reg"',
  'id="reg-password"',
].forEach((text) => forbidText(html, text, "public signup UI"));

[
  "function openInternalUserInvite()",
  "async function inviteInternalUser()",
  'sb.functions.invoke("invite-internal-user"',
  'option[0] !== "customer_viewer"',
  'option[0] !== "external_viewer"',
  'document.getElementById("btn-open-internal-user-invite").addEventListener',
  'document.getElementById("btn-internal-user-invite-submit").addEventListener',
].forEach((text) => requireText(app, text, "internal account issuance behavior"));

[
  "sb.auth.signUp(",
  "function doRegister()",
  'showScreen("register")',
  'getElementById("reg-password")',
].forEach((text) => forbidText(app, text, "public signup behavior"));

const escapeFunction = app.match(/function esc\(s\) \{[\s\S]*?\r?\n\}/);
const topLevelFunctions = [...app.matchAll(/^(?:async )?function [A-Za-z0-9_]+\([^\r\n]*\) \{/gm)];
const renderUsersIndex = topLevelFunctions.findIndex((match) => match[0] === "function renderUsers(users) {");
const renderUsersSource = renderUsersIndex >= 0 && topLevelFunctions[renderUsersIndex + 1]
  ? app.slice(topLevelFunctions[renderUsersIndex].index, topLevelFunctions[renderUsersIndex + 1].index)
  : "";
const statusBadgeExpressions = renderUsersSource
  ? [...renderUsersSource.matchAll(/var sbadge\s*=\s*(.+);\r?\n/g)]
  : [];
if (!escapeFunction || !renderUsersSource || statusBadgeExpressions.length !== 1) {
  throw new Error("user status badge security contract could not be isolated");
}
const statusBadgeExpression = statusBadgeExpressions[0];

const maliciousStatus = "active'><img src=x onerror=alert(1)><span class='";
const sandbox = {
  status: maliciousStatus,
  t: (key) => key,
};
vm.createContext(sandbox);
vm.runInContext(`${escapeFunction[0]}; this.statusBadge = ${statusBadgeExpression[1]};`, sandbox);
if (sandbox.statusBadge.includes(maliciousStatus) || /<img\b/i.test(sandbox.statusBadge)) {
  throw new Error("DB-derived profile status must not inject markup into the user status badge");
}
if ((sandbox.statusBadge.match(/&lt;img/g) || []).length !== 2 || !sandbox.statusBadge.includes("&#39;")) {
  throw new Error("profile status must be escaped in both the badge class and translated label");
}

[
  ".internal-user-issuance",
  ".internal-user-invite-modal",
  ".internal-user-invite-grid",
  ".internal-user-invite-footer",
].forEach((text) => requireText(css, text, "internal account issuance styling"));

console.log("internal account issuance guard passed");
