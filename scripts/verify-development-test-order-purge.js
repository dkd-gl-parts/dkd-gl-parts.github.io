const fs = require("fs");

const app = fs.readFileSync("app.js", "utf8");
const html = fs.readFileSync("index.html", "utf8");
const css = fs.readFileSync("styles.css", "utf8");

for (const fragment of [
  'isSystemAdmin() && purgeStatus.is_development_test_order',
  'sb.rpc("get_development_test_order_purge_status"',
  'sb.rpc("purge_development_test_order"',
  'input.value !== String(overlay.dataset.orderNumber || "")',
  'target_confirmation_order_number: input.value',
  'target_expected_version: expectedVersion',
  'salesOrderCheckedIdsState.delete(orderId)',
  'clearSalesOrderDetailSelection()',
  'テスト受注を完全削除'
]) {
  if (!app.includes(fragment)) throw new Error(`Development-test purge UI contract is missing: ${fragment}`);
}

for (const id of [
  "development-test-order-purge-overlay",
  "development-test-order-purge-number",
  "development-test-order-purge-customer",
  "development-test-order-purge-status",
  "development-test-order-purge-total",
  "development-test-order-purge-confirmation",
  "development-test-order-purge-submit"
]) {
  if (!html.includes(`id="${id}"`)) throw new Error(`Development-test purge dialog field is missing: ${id}`);
}

if (!html.includes("この操作は元に戻せません")) {
  throw new Error("The destructive-action warning is missing");
}
if (!html.includes("画面に表示されている受注番号と完全に一致した場合だけ削除できます")) {
  throw new Error("The exact order-number confirmation guidance is missing");
}
if (!css.includes(".development-test-order-purge-card")) {
  throw new Error("Development-test purge dialog styling is missing");
}
if (!app.includes('var APP_VERSION       = "v1.1.1052"')) {
  throw new Error("Expected D-CATS v1.1.1052");
}

console.log("Development-test order purge UI verification passed.");
