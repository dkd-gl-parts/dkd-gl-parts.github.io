const fs = require("fs");

const app = fs.readFileSync("app.js", "utf8");
const html = fs.readFileSync("index.html", "utf8");
const css = fs.readFileSync("styles.css", "utf8");

for (const fragment of [
  'cancel: "受注取消"',
  'if (action === "cancel" || action === "cancel_after_picking")',
  'action !== salesOrderCancellationAction(order)',
  'button.disabled = salesOrderSaving || !checkbox.checked',
  'target_action: action',
  'target_note: action === "cancel_after_picking" ? "ピッキング後の受注取消（現物確認済み）" : "受注取消"',
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
  "sales-order-in-house-cancel-submit"
]) {
  if (!html.includes(`id="${id}"`)) throw new Error(`In-house cancellation dialog field is missing: ${id}`);
}

if (!app.includes("ピッキングが記録されています。対象商品と照合済みシリアルを現物と確認してください")
    || !app.includes("取消後、在庫とシリアルを戻します")
    || !app.includes("運送会社へ渡した後は、受注取消ではなく返品処理")) {
  throw new Error("The UI must explain when a shipped order may be cancelled");
}
if (!app.includes("sales-order-secondary-actions") || !app.includes("その他の操作")) {
  throw new Error("Cancellation must be separated from routine order actions");
}
if (!app.includes("<summary><span>その他の操作</span></summary>")) {
  throw new Error("The secondary-action label must be independently measurable from its disclosure marker");
}
if (app.includes('action === "cancel" && !confirm(')) {
  throw new Error("Cancellation must not use the one-click browser confirmation flow");
}
if (!html.includes("この受注を取り消す")) {
  throw new Error("The cancellation dialog must require an explicit action");
}
if (html.includes("sales-order-in-house-cancel-reason")
    || app.includes("取消理由を4文字以上")
    || app.includes("対象を確認し、取消理由を記録")) {
  throw new Error("The cancellation dialog must not ask for a cancellation reason");
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
if (!/#screen-sales-order-mgmt \.sales-order-secondary-actions > summary\s*\{[^}]*position:\s*relative;[^}]*padding:\s*7px 32px 7px 11px;/s.test(css)
    || !/#screen-sales-order-mgmt \.sales-order-secondary-actions > summary::after\s*\{[^}]*top:\s*50%;[^}]*right:\s*11px;[^}]*translateY\(-50%\);/s.test(css)) {
  throw new Error("The secondary-action label and disclosure marker must have separate layout space");
}

const assert = require('node:assert/strict');
const vm = require('node:vm');
const acorn = require('acorn');
const ast = acorn.parse(app, {ecmaVersion:'latest'});
const names = ['salesOrderCancellationAction','openSalesOrderInHouseCancelDialog','submitSalesOrderInHouseCancellation'];
const functions = ast.body.filter(n=>n.type==='FunctionDeclaration' && names.includes(n.id.name)).map(n=>app.slice(n.start,n.end)).join('\n');
const elements = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id,{textContent:'',className:'',checked:false,dataset:{},classList:{add(){},remove(){}},focus(){}});
  return elements.get(id);
}
let permission=true;const calls=[];
const context=vm.createContext({console,document:{getElementById:element},salesOrderDetail:null,salesOrderSaving:false,
  canManageSalesOrders:()=>permission,t:k=>k,customerOrderStatusLabel:s=>s,customerOrderCurrency:n=>String(n),
  updateSalesOrderInHouseCancelButton(){},closeSalesOrderInHouseCancelDialog(){},refreshSalesOrderManagement:async()=>{},loadSalesOrderDetail:async()=>{},
  sb:{rpc:async(name,args)=>{calls.push({name,args});return {data:{}};}}
});
vm.runInContext(functions,context);
const ordinary={id:1,version:1,status:'accepted',allowed_actions:['cancel'],cancellation_flow:'before_picking'};
const picked={...ordinary,allowed_actions:['cancel_after_picking'],cancellation_flow:'after_picking'};
const shipped={...picked,status:'shipped'};
assert.equal(context.salesOrderCancellationAction(ordinary),'cancel');
assert.equal(context.salesOrderCancellationAction(picked),'cancel_after_picking');
assert.equal(context.salesOrderCancellationAction(shipped),'cancel_after_picking');
assert.equal(context.salesOrderCancellationAction({...shipped,allowed_actions:['cancel']}),'');
assert.equal(context.salesOrderCancellationAction({...picked,allowed_actions:['cancel']}),'');
assert.equal(context.salesOrderCancellationAction({...picked,allowed_actions:[]}),'');
assert.equal(context.salesOrderCancellationAction(null),'');
async function checkSubmission() {
 context.salesOrderDetail=ordinary;context.openSalesOrderInHouseCancelDialog('cancel');
 const overlay=element('sales-order-in-house-cancel-overlay'),checkbox=element('sales-order-in-house-cancel-confirm');
 assert.equal(overlay.dataset.cancellationAction,'cancel');assert.equal(checkbox.checked,false);
 await context.submitSalesOrderInHouseCancellation();assert.equal(calls.length,0);
 checkbox.checked=true;await context.submitSalesOrderInHouseCancellation();assert.equal(calls[0].args.target_action,'cancel');
 context.salesOrderDetail=picked;context.openSalesOrderInHouseCancelDialog('cancel_after_picking');
 assert.equal(overlay.dataset.cancellationAction,'cancel_after_picking');assert.equal(checkbox.checked,false);
 assert.equal(element('sales-order-in-house-cancel-title').textContent,'sales_order_cancel_after_picking');
 checkbox.checked=true;await context.submitSalesOrderInHouseCancellation();
 assert.equal(calls[1].args.target_action,'cancel_after_picking');assert.equal(calls[1].args.target_expected_version,1);
 assert.equal(calls[1].args.target_note,'ピッキング後の受注取消（現物確認済み）');
 context.salesOrderDetail=ordinary;context.openSalesOrderInHouseCancelDialog('cancel');checkbox.checked=true;
 context.salesOrderDetail=picked;await context.submitSalesOrderInHouseCancellation();assert.equal(calls.length,2);
 context.salesOrderDetail=ordinary;context.openSalesOrderInHouseCancelDialog('cancel');checkbox.checked=true;
 context.salesOrderDetail={...ordinary,id:2};await context.submitSalesOrderInHouseCancellation();assert.equal(calls.length,2);
 context.salesOrderDetail={...ordinary,version:2};await context.submitSalesOrderInHouseCancellation();assert.equal(calls.length,2);
 permission=false;context.salesOrderDetail=ordinary;await context.submitSalesOrderInHouseCancellation();assert.equal(calls.length,2);
 console.log('Customer order cancellation: normal/picking routes, stale state, confirmation, duplicate and permission checks passed.');
}
checkSubmission().catch(error=>{console.error(error);process.exitCode=1;});
