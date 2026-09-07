const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

function requireFragment(source, fragment, label = fragment) {
  if (!source.includes(fragment)) throw new Error(`Missing customer activity history contract: ${label}`);
}

for (const fragment of [
  'customer_activity_history_button: "ログイン・検索履歴"',
  'customer_activity_history_title: "得意先ログイン・検索履歴"',
  'openUserAuthHistory(customerAccountUserById(button.dataset.uid), { customerAccount: true })',
  'function canOpenUserAuthHistory(user, options)',
  'canManageCustomerAccounts() && !!customerAccountUserById(user.id)',
  '.eq("event_type", "search").eq("action", "customer_product_search")',
  'customer_activity_history_search_query',
  'meta.category_filter ? t("customer_activity_history_category") + ": " + tCat(meta.category_filter)',
  'meta.result_count',
]) {
  requireFragment(app, fragment);
}

requireFragment(html, 'id="user-auth-history-title"', "dynamic history title");
requireFragment(css, ".customer-activity-overview", "customer activity summary layout");
requireFragment(css, ".user-auth-history-list .log-table { min-width: 620px; }", "mobile history table wrapping guard");

for (const forbidden of [
  'sb.from("user_auth_events").insert',
  'sb.from("user_activity_events").insert',
  "ensureActivitySessionId(",
  "p_user_email:",
  "p_user_name:",
  "p_session_id:",
]) {
  if (app.includes(forbidden)) throw new Error(`Browser must not provide or directly insert audit identity: ${forbidden}`);
}

console.log("Customer login and search history verification passed.");
