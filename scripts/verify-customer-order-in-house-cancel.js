const fs = require("fs");

const app = fs.readFileSync("app.js", "utf8");
const html = fs.readFileSync("index.html", "utf8");
const css = fs.readFileSync("styles.css", "utf8");

for (const fragment of [
  'cancel_shipped_in_house: "社内在庫へ戻して受注取消"',
  'complete: "運送会社へ引渡し済み"',
  'action === "cancel_shipped_in_house"',
  'target_action: "cancel_shipped_in_house"',
  "submitSalesOrderInHouseCancellation",
  "updateSalesOrderInHouseCancelButton",
  "運送会社へ引渡し済みとして確定します",
  "商品が社内にある間は受注取消"
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

if (!html.includes("引渡し後は返品処理の対象です")) {
  throw new Error("The UI must separate in-house cancellation from post-handover returns");
}
if (!css.includes(".sales-order-action.cancel_shipped_in_house")) {
  throw new Error("The high-risk in-house cancellation action needs distinct styling");
}
if (!css.includes(".sales-order-in-house-cancel-card")) {
  throw new Error("The confirmation dialog styling is missing");
}

console.log("Customer order in-house shipment cancellation UI verification passed.");
