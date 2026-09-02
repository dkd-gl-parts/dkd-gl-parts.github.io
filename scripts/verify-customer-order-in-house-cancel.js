const fs = require("fs");

const app = fs.readFileSync("app.js", "utf8");
const html = fs.readFileSync("index.html", "utf8");
const css = fs.readFileSync("styles.css", "utf8");

for (const fragment of [
  'cancel: "受注取消"',
  'if (action === "cancel")',
  'allowed.indexOf("cancel") < 0',
  'reason.value.trim().length < 4',
  'cleanReason.length < 4',
  'target_action: "cancel"',
  "submitSalesOrderInHouseCancellation",
  "updateSalesOrderInHouseCancelButton"
]) {
  if (!app.includes(fragment)) throw new Error(`In-house cancellation UI contract is missing: ${fragment}`);
}

for (const id of [
  "sales-order-in-house-cancel-overlay",
  "sales-order-in-house-cancel-number",
  "sales-order-in-house-cancel-customer",
  "sales-order-in-house-cancel-status",
  "sales-order-in-house-cancel-total",
  "sales-order-in-house-cancel-confirm",
  "sales-order-in-house-cancel-reason",
  "sales-order-in-house-cancel-submit"
]) {
  if (!html.includes(`id="${id}"`)) throw new Error(`In-house cancellation dialog field is missing: ${id}`);
}

if (!app.includes("この受注は出荷済みです。商品がまだ社内にあることを確認してください")
    || !app.includes("取消後、在庫とシリアルを戻します")
    || !app.includes("運送会社へ渡した後は、受注取消ではなく返品処理")) {
  throw new Error("The UI must explain when a shipped order may be cancelled");
}
if (!app.includes("sales-order-secondary-actions") || !app.includes("その他の操作")) {
  throw new Error("Cancellation must be separated from routine order actions");
}
if (app.includes('action === "cancel" && !confirm(')) {
  throw new Error("Cancellation must not use the one-click browser confirmation flow");
}
if (!html.includes('minlength="4"') || !html.includes("この受注を取り消す")) {
  throw new Error("The cancellation dialog must require a deliberate reason and explicit action");
}
for (const forbidden of [
  "cancel_shipped_in_house",
  "出荷済み受注を取消",
  'complete: "運送会社へ引渡し済み"',
  'action === "complete"',
  "sales-order-handover-boundary",
  "運送会社への引渡し確認"
]) {
  if (app.includes(forbidden) || css.includes(forbidden)) {
    throw new Error(`Carrier handover must not be managed by D-CATS: ${forbidden}`);
  }
}
if (!css.includes(".sales-order-action.cancel")) {
  throw new Error("The shared order cancellation action styling is missing");
}
if (!css.includes(".sales-order-in-house-cancel-card")) {
  throw new Error("The confirmation dialog styling is missing");
}
if (!css.includes(".sales-order-secondary-actions") || !css.includes(".sales-order-in-house-cancel-summary")) {
  throw new Error("The safer cancellation action and order summary styling are missing");
}

console.log("Customer order in-house shipment cancellation UI verification passed.");
