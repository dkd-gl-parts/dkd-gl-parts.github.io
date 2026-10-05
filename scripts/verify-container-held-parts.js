const assert = require("assert");
const fs = require("fs");
require("../manufacturing-cost-import.js");
const elements = {};
["results","apply","status","reference","preview","choose","file","file-name","cost-list","cost-list-note","sheets","held-toggle","held-list","new","history","history-toggle","held-panel","held-refresh"].forEach(id => {
  elements["container-stock-" + id] = {value:"",textContent:"",innerHTML:"",disabled:false,hidden:id==="history",classList:{toggle(){}},listeners:{},addEventListener(name,fn){this.listeners[name]=fn;}};
});
let ready;
globalThis.document={readyState:"loading",addEventListener(name,fn){ready=fn;},getElementById(id){return elements[id]||null;}};
require("../container-stock-import.js");
const api=globalThis.DcatsContainerStockImport, state=api._state;
let calls=[], confirmation="", applyError=null, stored=null;
globalThis.confirm=text=>{confirmation=text;return true;};
globalThis.sb={async rpc(name,args){
  calls.push({name,args});
  if(name==="get_container_stock_held_receipts") return {data:{total_receipts:1,total_held_count:1,total_held_quantity:3,receipts:[{id:7,container_reference:"TEST-PALLET",source_file_name:"test.xlsx",held_count:1,held_quantity:3,part_numbers:"TEST-9999"}],receipt:stored}};
  if(name==="list_container_stock_receipts") return {data:[]};
  if(name==="preview_container_stock_receipt") return {data:{container_reference:args.p_container_reference,total_quantity:5,duplicate:null,resume_receipt_id:stored?7:null,rows:args.p_rows.map(row=>{
    const old=stored && stored.lines.find(x=>x.part_number===row.part_number);
    return {...row,...(old && old.line_status==="received" ? old : {}),line_status:old?old.line_status:"pending",stored_hold_reason:old&&old.hold_reason,candidates:row.part_number==="TEST-1001"||stored ? [{dkd_shohin_id:row.part_number==="TEST-1001"?1:2,variant_active:true,stock_qty:4}]:[]};
  })}};
  if(name==="apply_container_stock_receipt") {
    if(applyError) return {error:{message:applyError}};
    const rows=args.p_rows, ready=rows.filter(r=>!r.held && r.part_number!=="TEST-1001" || !stored && !r.held);
    return {data:{receipt_id:7,line_count:ready.length,total_quantity:ready.reduce((n,r)=>n+r.quantity,0),held_count:rows.filter(r=>r.held).length,rows:rows.map(r=>({...r,line_status:r.held?"held":"received"}))}};
  }
  throw Error("Unexpected RPC "+name);
}};
async function main(){
  ready();
  state.fileName="test.xlsx";state.fileSha256="a".repeat(64);state.costListId="none";state.costListReady=true;
  elements["container-stock-reference"].value="TEST-PALLET";
  state.sheets=[{name:"STA",matrix:[["Parts No","Quantity"],["TEST-1001",2],["TEST-9999",3]],category:"starter",included:true,overrides:{}}];
  await api._previewReceipt();
  assert.equal(elements["container-stock-apply"].disabled,true);
  await api._applyReceipt(); assert.equal(calls.filter(c=>c.name==="apply_container_stock_receipt").length,0,"unresolved must not register");
  api._toggleHold(1);assert.equal(elements["container-stock-apply"].disabled,false);
  const inputReason=value=>elements["container-stock-results"].listeners.input({target:{matches:selector=>selector==="[data-container-hold-reason]",dataset:{containerHoldReason:"1"},value}});
  inputReason("短い");assert.equal(elements["container-stock-apply"].disabled,true);
  inputReason("メーカー品番の確認待ち");assert.equal(elements["container-stock-apply"].disabled,false,"valid reason immediately re-enables submit without a blur event");
  assert.match(elements["container-stock-results"].innerHTML,/加算しません/);
  state.holds["starter|TEST-9999"]="短い";api._renderPreview();assert.equal(elements["container-stock-apply"].disabled,true);
  await api._applyReceipt();assert.equal(calls.filter(c=>c.name==="apply_container_stock_receipt").length,0);
  state.holds["starter|TEST-9999"]="<img onerror='x'>情報不足";api._renderPreview();
  assert.match(elements["container-stock-results"].innerHTML,/&lt;img/);assert.doesNotMatch(elements["container-stock-results"].innerHTML,/<img/);
  await api._applyReceipt();
  const first=calls.find(c=>c.name==="apply_container_stock_receipt");
  assert.equal(first.args.p_rows[1].held,true);assert.equal(first.args.p_rows[1].target_dkd_shohin_id,null);assert.equal(first.args.p_rows[1].quantity,3);
  assert.match(confirmation,/登録可能 1品番・2台/);assert.match(confirmation,/保留 1品番/);
  assert.match(elements["container-stock-status"].textContent,/保留 1品番は在庫未反映/);
  assert.match(elements["container-stock-results"].innerHTML,/登録完了・保留あり/);
  const count=calls.length;await api._applyReceipt();assert.equal(calls.length,count,"applied UI cannot apply twice");
  stored={id:7,container_reference:"TEST-PALLET",source_file_name:"test.xlsx",source_sha256:"a".repeat(64),lines:first.args.p_rows.map(r=>({...r,line_status:r.held?"held":"received"}))};
  await api._resumeReceipt(7);
  assert.ok(state.resumeRows);assert.equal(elements["container-stock-reference"].disabled,true);
  assert.equal(elements["container-stock-choose"].disabled,true);
  assert.match(elements["container-stock-results"].innerHTML,/登録済み · DKD 1/);
  assert.match(elements["container-stock-results"].innerHTML,/保留を解除して入庫先を確認/);
  assert.equal(state.holds["starter|TEST-9999"],first.args.p_rows[1].hold_reason,"saved reasons survive reload");
  api._toggleHold(0);assert.equal(state.holds["starter|TEST-1001"],undefined,"received row cannot be held");
  api._toggleHold(1);assert.equal(state.holds["starter|TEST-9999"],null);
  await api._previewReceipt();assert.equal(state.holds["starter|TEST-9999"],null,"explicit release survives recheck");
  await api._applyReceipt();const resumed=calls.filter(c=>c.name==="apply_container_stock_receipt").at(-1);
  assert.equal(resumed.args.p_rows[0].target_dkd_shohin_id,1,"received target kept immutable");
  assert.equal(resumed.args.p_rows[0].held,false);assert.equal(resumed.args.p_rows[1].held,false);
  assert.match(confirmation,/登録可能 1品番・3台/);
  assert.doesNotMatch(confirmation,/登録可能 2品番・5台/);
  await api._resumeReceipt(7);applyError="通信エラー";await api._applyReceipt();assert.equal(state.preview,null);assert.match(elements["container-stock-status"].textContent,/再照合/);
  applyError=null;await api._previewReceipt();assert.equal(state.holds["starter|TEST-9999"],first.args.p_rows[1].hold_reason);
  state.working=true;const previous=state.holds["starter|TEST-9999"];api._toggleHold(1);assert.equal(state.holds["starter|TEST-9999"],previous);state.working=false;
  await api._loadHeld();assert.match(elements["container-stock-held-list"].innerHTML,/保留品番を確認・再開/);
  api._resetReceipt();assert.equal(state.resumeRows,null);assert.equal(elements["container-stock-reference"].disabled,false);assert.deepEqual(state.holds,{});
  // All-held works without selecting an unknown target; master creation is never implicit.
  stored=null;state.sheets=[{name:"STA",matrix:[["Parts No","Quantity"],["TEST-9999",3]],category:"starter",included:true,overrides:{}}];
  state.fileName="all.xlsx";state.fileSha256="b".repeat(64);elements["container-stock-reference"].value="ALL-HELD";
  await api._previewReceipt();api._toggleHold(0);assert.match(elements["container-stock-apply"].textContent,/保留だけ保存/);
  await api._applyReceipt();assert.match(confirmation,/登録可能 0品番・0台/);
  assert.ok(calls.every(c=>!/(?:create|insert|master|stock_update)/.test(c.name)),"no synthetic master or direct stock writes");
  const html=fs.readFileSync(require("path").join(__dirname,"../index.html"),"utf8");
  for(const id of ["held-panel","held-list","held-toggle","held-refresh","new"]) assert.match(html,new RegExp('id="container-stock-'+id+'"'));
  console.log("Container held-part UI guards passed: explicit hold, reasons, partial/all-held, reload/resume, immutable received rows, retry, escaping");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
