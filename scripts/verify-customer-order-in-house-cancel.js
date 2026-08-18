const fs = require("fs");

const app = fs.readFileSync("app.js", "utf8");
const html = fs.readFileSync("index.html", "utf8");
const css = fs.readFileSync("styles.css", "utf8");

for (const fragment of [
  'cancel_shipped_in_house: "出荷済み受注を取消"',
  'action === "cancel_shipped_in_house"',
  'target_action: "cancel_shipped_in_house"',
  "submitSalesOrderInHouseCancellation",
  "updateSalesOrderInHouseCancelButton"
]) {
  if (!app.includes(fragment)) throw new Error(`In-house cancellation UI contract is missing: ${fragment}`);
}

for (const id of [
  "sales-order-in-house-cancel-overlay",
  "sales-order-in-house-cancel-confirm",
  "sales-order-in-house-cancel-reason",
  "sales-order-in-house-cancel-submit"
]) {
  if (!html.includes(`id="${id}"`)) throw new Error(`In-house cancellation dialog field is missing: ${id}`);
}

if (!html.includes("出荷済みですが、商品がまだ社内にある場合だけ実行できます")
    || !html.includes("すでに発送されている場合は返品処理の対象です")) {
  throw new Error("The UI must explain when a shipped order may be cancelled");
}
for (const forbidden of [
  'complete: "運送会社へ引渡し済み"',
  'action === "complete"',
  "sales-order-handover-boundary",
  "運送会社への引渡し確認"
]) {
  if (app.includes(forbidden) || css.includes(forbidden)) {
    throw new Error(`Carrier handover must not be managed by D-CATS: ${forbidden}`);
  }
}
if (!css.includes(".sales-order-action.cancel_shipped_in_house")) {
  throw new Error("The high-risk in-house cancellation action needs distinct styling");
}
if (!css.includes(".sales-order-in-house-cancel-card")) {
  throw new Error("The confirmation dialog styling is missing");
}

console.log("Customer order in-house shipment cancellation UI verification passed.");
