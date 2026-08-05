const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8").replace(/\r\n/g, "\n");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8").replace(/\r\n/g, "\n");

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

const overviewStart = app.indexOf('title: "ログイン・パスワード"');
const overviewEnd = app.indexOf('title: "操作ログ"', overviewStart);
expect(overviewStart >= 0 && overviewEnd > overviewStart, "Password permission overview section is missing");

const passwordOverview = app.slice(overviewStart, overviewEnd);
expect(
  passwordOverview.includes('{ label: "トップ画面のPW再発行（社内・得意先共通）", state: permissionOverviewAllowed("登録済みメールで利用可") }'),
  "Password reset default is missing from the permission overview"
);
expect(passwordOverview.includes('{ label: "自分のパスワード変更", state: permissionOverviewAllowed("利用可") }'), "Signed-in password change is missing");
expect(!passwordOverview.includes("permissionKey"), "Password reset default must not be individually overridden");
expect(html.includes('id="btn-to-forgot"'), "Login screen password reset button is missing");
expect(app.includes("async function doForgotPassword()"), "Password reset handler is missing");
expect(app.includes("sb.auth.resetPasswordForEmail(email"), "Supabase password reset request is missing");

console.log("Password reset permission overview contract: OK");
