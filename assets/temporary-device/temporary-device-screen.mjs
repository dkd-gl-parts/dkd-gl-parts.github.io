import { createTemporaryDeviceClient } from "./browser-device-client.mjs";

const endpoint = "https://jqoeqximtwfpqwzngutj.supabase.co/functions/v1/temporary-device-access";
const key = document.documentElement.dataset.supabasePublishableKey;
const client = key ? createTemporaryDeviceClient({ endpoint, publishableKey: key }) : null;
const panel = document.querySelector("#panel");
const notice = document.querySelector("#notice");
const homeButton = document.querySelector("#home");
const featureNames = {part_label:"品番シール",shipping:"ピッキング・出荷確定",core_return:"コア返却管理"};
let busy = false;
let approved = null;
let pollId = null;
const labelRequestStorageKey = "dcats.temporary-device.pending-label";

function pendingLabelRequest() {
  return localStorage.getItem(labelRequestStorageKey);
}

function showLabelResult(result) {
  if (!result?.job_id) throw new Error("発行結果はまだ確認できません。管理者と確認してください。");
  localStorage.removeItem(labelRequestStorageKey);
  show("品番シールの発行を受け付けました", [
    add("p", result.issue_code ? "発行番号 "+result.issue_code : ""),
    action("印刷状況を確認", async () => {
      const current = await call("get_finished_label_print_job_status", { target_job_id:result.job_id });
      const status = {queued:"印刷待ち",claimed:"処理中",sending:"送信中",sent:"プリンターへ送信済み",
        failed:"送信失敗。管理者に連絡してください。"};
      notice.textContent = status[current.status] || "プリンターの状態を管理者と確認してください。";
    })
  ]);
}

async function recoverLabelRequest() {
  const key = pendingLabelRequest();
  if (!key) return;
  const result = await call("get_part_label_request_result", { target_request_key:key });
  showLabelResult(result);
}

function add(tag, text, options = {}) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (options.className) element.className = options.className;
  if (options.id) element.id = options.id;
  return element;
}
function show(title, content) {
  panel.replaceChildren(add("h1", title, {id:"panel-title"}), ...content);
  notice.textContent = "";
}
function action(title, run, asPrimary = false) {
  const button = add("button",title,asPrimary ? {className:"primary"} : {});
  button.type = "button";
  button.addEventListener("click", () => safeRun(run));
  return button;
}
async function safeRun(run) {
  if (busy) return;
  busy = true;
  try { await run(); } catch (error) { notice.textContent = error.message || "処理結果を確認できませんでした。"; }
  finally { busy = false; }
}
function input(label, name, options = {}) {
  const box = add("label",label);
  const field = add("input");
  field.name = name;
  field.type = options.type || "text";
  field.value = options.value ?? "";
  field.required = options.required === true;
  field.maxLength = options.maxLength || 128;
  box.append(field);
  return box;
}
function picker(label, name, values) {
  const box = add("label",label);
  const field = add("select");
  field.name = name;
  for (const [value, title] of values) {
    const option = add("option",title);
    option.value = value;
    field.append(option);
  }
  box.append(field);
  return box;
}
function form(fields, title, submit) {
  const root = add("form");
  const grid = add("div",undefined,{className:"grid"});
  grid.append(...fields);
  const button = add("button",title,{className:"primary"});
  button.type = "submit";
  root.append(grid,button);
  root.addEventListener("submit", event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(root));
    void safeRun(() => submit(values));
  });
  return root;
}
function rows(items, label, open, limit = 3) {
  const box = add("div",undefined,{className:"results"});
  if (!items.length) { box.append(add("p","対象がありません。")); return box; }
  let index = 0;
  const display = () => {
    box.replaceChildren(...items.slice(index,index+limit).map(x=>action(label(x),()=>open(x))));
    if (items.length <= limit) return;
    const pager = add("div",undefined,{className:"actions"});
    const prev = action("前へ",()=>{index-=limit;display();});
    prev.disabled = index === 0;
    const next = action("次へ",()=>{index+=limit;display();});
    next.disabled = index+limit >= items.length;
    pager.append(prev,next);
    box.append(pager);
  };
  display();
  return box;
}
async function call(name, args) {
  const reply = await client.perform(name,args);
  if (!reply.ok) {
    const message = reply.status === 403 ? "利用できない操作です。対象と管理者の許可を確認してください。"
      : reply.status === 422 ? "登録できませんでした。入力内容と対象の状態を確認してください。"
      : "処理結果を確認できませんでした。登録済みか確認してから操作してください。";
    const error = new Error(message);
    error.status = reply.status;
    throw error;
  }
  return reply.data.result;
}
function menu() {
  homeButton.hidden = true;
  const shortcuts = add("div",undefined,{className:"shortcuts"});
  for (const feature of approved.features) {
    if (!Object.hasOwn(featureNames,feature)) continue;
    shortcuts.append(action(featureNames[feature],features[feature],true));
  }
  show("使う機能を選んでください",[
    shortcuts, add("p","利用期限 "+new Intl.DateTimeFormat("ja-JP",{dateStyle:"long",timeZone:"Asia/Tokyo"}).format(new Date(approved.expiresAt)),
      {className:"instruction"})
  ]);
}
homeButton.addEventListener("click",()=>{if (!busy && approved) menu();});

async function updateApproval() {
  const state = await client.status();
  if (!state.ok) return false;
  approved = state.data.result;
  if(pollId!==null) { clearInterval(pollId);pollId=null; }
  menu();
  return true;
}
async function begin() {
  if (await updateApproval()) return;
  const request = await client.requestDevice();
  if (!request.ok) {notice.textContent="申請できませんでした。";return;}
  const end = Date.now()+5*60000;
  show("管理者の承認を待っています",[
    add("p","この申請番号と確認コードを管理者に見せてください。"),
    add("p",request.data.grantId,{className:"instruction"}),
    add("p",request.data.pairingCode,{className:"pairing"}),
    action("承認状況を確認",updateApproval,true),
    action("新しく申請する",async()=>{
      if (!window.confirm("管理者から再申請を指示された場合に進んでください。")) return;
      if(pollId!==null) {clearInterval(pollId);pollId=null;}
      await client.removeLocalRegistration();
      await begin();
    })
  ]);
  if (pollId !== null) clearInterval(pollId);
  pollId=setInterval(()=>{
    if (Date.now()>=end) {clearInterval(pollId);pollId=null;return;}
    void safeRun(updateApproval);
  },4000);
}

function componentData(row,index) {
  return {
    no:index+1,usageId:row.id,componentId:row.dkd_component_id,type:row.component_name || row.component_name_ja || "",
    maker:row.component_manufacturer || "",partNo:row.component_manufacturer_part_number || row.component_genuine_part_number || "",
    genuinePartNo:row.component_genuine_part_number || "",quantity: row.quantity || "1",usageRate:row.replacement_rate,
    procurementCategory:row.procurement_category || "",memo:row.manufacturing_memo || ""
  };
}
async function labelEdit(product) {
  const ids={target_dkd_shohin_id:product.dkd_shohin_id,target_product_variant_id:product.product_variant_id};
  const station=await call("list_finished_label_print_stations",{});
  if (!station) throw new Error("管理者に印刷先の設定を依頼してください。");
  const candidates=await call("list_finished_label_component_candidates",ids);
  const data=Array.isArray(candidates)?candidates:candidates.rows||[];
  const selection= new Set(data.filter(row=>Number(row.replacement_rate)===100).map(row=>row.id));
  const componentList=rows(data,row=>[selection.has(row.id)?"使用":"未使用",componentData(row,0).partNo || componentData(row,0).type].filter(Boolean).join(" "),async row=>{
    if (selection.has(row.id)) selection.delete(row.id);
    else selection.add(row.id);
    notice.textContent=(selection.has(row.id)?"使用する部品に追加しました。":"使用する部品から外しました。")+" 選択 "+selection.size+"件";
  });
  const save = form([
    input("組立担当","assembly"), input("検査担当","inspection"),
    input("棚番","shelf"), input("メモ","memo",{maxLength:500})
  ], "品番シールを発行", async values => {
    if (pendingLabelRequest()) {
      await recoverLabelRequest();
      return;
    }
    if (!window.confirm("品番 "+product.gltek_part_number+" を1台登録して印刷しますか？")) return;
    const requestKey = crypto.randomUUID();
    localStorage.setItem(labelRequestStorageKey,requestKey);
    try {
      const result = await call("issue_and_print_part_label", {
        ...ids, target_request_key:requestKey, target_product_category:product.category_code,
        target_assembly_staff:values.assembly, target_inspection_staff:values.inspection,
        target_shelf_no:values.shelf, target_memo:values.memo,
        target_components:data.filter(row=>selection.has(row.id)).map(componentData)
      });
      showLabelResult(result);
    } catch (error) {
      if ([400,403,422,429].includes(error.status)) {
        localStorage.removeItem(labelRequestStorageKey);
        throw error;
      }
      show("品番シールの発行結果を確認", [
        add("p","印刷を再送する前に、発行結果を確認してください。"),
        action("発行結果を確認",recoverLabelRequest,true)
      ]);
    }
  });
  show(product.gltek_part_number,[add("p","印刷先 "+station.name+"、選択部品 "+selection.size+"件"),componentList,save]);
}

async function pickingDetail(row) {
  const id=row.dispatch_id;
  const details=await call("get_picking_order",{target_dispatch_id:id});
  const options=details.items.map(item=>[String(item.order_item_id),[item.manufacturer_part_number||item.genuine_part_number,item.assignments?.length||0,"/",item.quantity].join(" ")]);
  const items=rows(details.items,item=>(item.manufacturer_part_number||item.genuine_part_number)+"  "+(item.assignments?.length||0)+" / "+item.quantity,item=>{
    show("登録済みシリアル",[rows(item.assignments||[],assignment=>assignment.manufacturing_serial,async assignment=>{
      const reason=window.prompt("割当を解除する理由");
      if (!reason?.trim()) return;
      await call("release_sales_order_dispatch_serial",{target_assignment_id:assignment.assignment_id,target_reason:reason});
      await pickingDetail(row);
    }),action("出荷指示へ戻る",()=>pickingDetail(row))]);
  });
  const assign=form([picker("明細","item",options),input("製造シリアル","serial",{required:true})],"ピッキング登録",async values=>{
    await call("assign_sales_order_dispatch_serial",{target_dispatch_id:id,target_order_item_id:Number(values.item),target_manufacturing_serial:values.serial});
    await pickingDetail(row);
  });
  const confirm=form([input("出荷日","shippedOn",{type:"date", required:true})],"出荷を確定",async values=>{
    if (!window.confirm(details.dispatch_number+" の出荷を確定しますか？")) return;
    try {
      await call("confirm_sales_order_dispatch",{target_dispatch_id:id,target_shipped_on:values.shippedOn,target_expected_version:details.version});
    } catch (error) {
      const readback = await call("get_picking_order",{target_dispatch_id:id});
      if (readback.dispatch_status !== "shipped") throw error;
    }
    show("出荷確定が完了しました",[add("p",details.dispatch_number),action("出荷一覧に戻る",features.shipping)]);
  });
  show(details.dispatch_number,[items,assign,...(details.dispatch_status==="ready"?[confirm]:[])]);
}

const receiptOptions=[["return_sheet","返却シート"],["return_waybill","返却送り状"],["manual_identification","受注・得意先から照合"]];
const reasonOptions=[["normal_core","通常のコア返却"],["claim_return","クレーム対象品"],["replacement_return","代替品"],["order_cancellation","受注取消品"],["customer_return","返品"]];
const conditionOptions=[["accepted","正常"],["wrong_item","異なるコア"],["damaged","破損"],["not_our_product","当社商品ではない"],["other","その他"]];
const resolutionOptions=[["pending","対応未決定"],["accepted_as_core","コアとして受入"],["customer_contact","得意先へ確認"]];
async function returnDetail(row, view="receipt") {
  const item=await call("get_core_return_management_detail",{target_unit_id:row.id});
  const common={target_unit_id:item.id,target_expected_version:item.version};
  const tabs=add("div",undefined,{className:"actions"});
  tabs.append(action("返却受付",()=>returnDetail(row,"receipt")),action("検品・対応",()=>returnDetail(row,"inspect")));
  const receipt=form([picker("照合方法","source",receiptOptions),picker("返却区分","reason",reasonOptions),
    input("送り状番号","number",{value:item.return_waybill_tracking_number}),input("製造シリアル","serial",{value:item.returned_serial}),
    input("受付メモ","note",{value:item.receipt_note,maxLength:1000})],"受付を保存",async v=>{
      await call("register_core_return_receipt",{...common,target_receipt_source:v.source,target_return_reason:v.reason,
        target_return_tracking_number:v.number,target_returned_serial:v.serial,target_note:v.note});
      await returnDetail(row,"inspect");
      notice.textContent="受付を保存しました。";
  });
  const inspection=form([picker("検品結果","condition",conditionOptions),picker("対応","resolution",resolutionOptions),input("検品メモ","note",{maxLength:1000})],
    "検品を保存",async v=>{
      await call("inspect_core_return",{...common,target_condition_status:v.condition,target_resolution_status:v.resolution,target_note:v.note});
      await returnDetail(row,"inspect");
      notice.textContent="検品結果を保存しました。";
  });
  const showInspection=view==="inspect";
  show(item.return_code_display||item.order_number,[add("p",item.customer_name||""),tabs, showInspection
    ? item.status==="awaiting_return" ? add("p","先に返却受付を保存してください。") : inspection
    : receipt]);
}

const features = {
  async part_label() {
    homeButton.hidden=false;
    if (pendingLabelRequest()) {
      show("品番シールの発行結果を確認", [
        action("発行結果を確認",recoverLabelRequest,true)
      ]);
      return;
    }
    show("品番シール",[form([input("品番","part",{required:true})],"検索",async v=>{
      const result=await call("search_part_label_products",{part_number:v.part});
      show("品番を選択",[rows(result, x=>[x.gltek_part_number,x.display_label].filter(Boolean).join("　"),labelEdit),
      action("検索に戻る",features.part_label)]);
    })]);
  },
  async shipping() {
    homeButton.hidden=false;
    const summary=await call("list_picking_orders",{});
    const query=form([input("受注番号・出荷指示番号","search")],"検索",async v=>{
      const result=await call("list_picking_orders",{search:v.search});
      panel.querySelector(".results")?.replaceWith(rows(result.dispatches,row=>row.dispatch_number+"　"+row.order_number,pickingDetail));
    });
    show("ピッキング・出荷確定",[query,rows(summary.dispatches,row=>row.dispatch_number+"　"+row.order_number,pickingDetail)]);
  },
  async core_return() {
    homeButton.hidden=false;
    const query=form([input("返却番号・送り状番号","search"),
      picker("状態","status",[["awaiting_return","返却待ち"],["received","受付済み"],["all","すべて"]])],"検索",async v=>{
      const result=await call("list_core_return_management",{target_search:v.search,target_status:v.status});
      show("コア返却管理",[query,rows(result.rows,row=>[row.return_code_display,row.customer_name].filter(Boolean).join("　"),returnDetail)]);
    });
    show("コア返却管理",[query]);
  }
};

if (client) show("期限付き利用",[action("利用を開始",begin,true)]);
else show("期限付き利用",[add("p","現在は利用できません。")]);
