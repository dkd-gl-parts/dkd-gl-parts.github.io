"use strict";
const assert = require("node:assert/strict");
const vm = require("node:vm");
module.exports = async function verifyInventory(source, acorn) {
  const ast = acorn.parse(source, {ecmaVersion: "latest"});
  const fn = name => { const node = ast.body.find(n=>n.type === "FunctionDeclaration" && n.id.name === name); assert(node,name); return source.slice(node.start,node.end); };
  const dictionary = ast.body.find(n=>n.type === "VariableDeclaration" && n.declarations.some(d=>d.id.name === "TRANSLATIONS"));
  let calls=[], reads=0, allowed=true, mode="success", held;
  const item = {product_variant_id: "2250", dkd_shohin_id: 123, product_kind: "rebuilt", genuine_part_number:"QA-001"};
  const order = () => ({id: 1, items:[{...item},{...item}], dispatch:{items:[{order_item:{...item},quantity:1}]}});
  const ctx = {currentUser:{id:"qa-owner"},currentLang:"ja",console,
    canManageSalesOrders:()=>allowed,salesOrderDispatch:o=>o&&o.dispatch,
    esc:v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])),
    customerProductKindLabel:v=>v,
    sb:{rpc:async(name,args)=>{calls.push({name,args});assert.equal(name,"get_warehouse_stock");reads++;
      if(mode==="held")await new Promise(r=>held=r);
      if(mode==="denied")return {error:{code:"42501"}};
      if(mode==="error")throw Error("Synthetic network failure");
      return {data:{variants:mode==="missing"?[]:[{variant_id:args.p_variant_id,product_id:mode==="wrongProduct"?"other":"123",kind:mode==="wrongKind"?"oem_new":"rebuilt",stock_qty:mode==="zero"?0:mode==="invalid"?null:24,needs_recount:mode==="recount",legacy_location:mode==="legacy"?"OLD-01":""}],positions:[
        {variant_id:args.p_variant_id,location:"GLA-21",quantity:10},
        {variant_id:args.p_variant_id,location:"GLA-32",quantity:mode==="overallocated"?30:13},
        {variant_id:args.p_variant_id,location:"GLA-21",quantity:1},
        {variant_id:"other",location:"SECRET",quantity:99}
      ].filter(()=>!["zero","legacy","unassigned"].includes(mode))}};
    }}
  };
  vm.createContext(ctx);vm.runInContext(source.slice(dictionary.start,dictionary.end),ctx);
  ctx.t=k=>ctx.TRANSLATIONS[ctx.currentLang][k]||ctx.TRANSLATIONS.ja[k]||k;
  vm.runInContext(["salesOrderInventoryItems","hydrateSalesOrderInventory","salesOrderInventoryItemHtml","salesOrderInventorySectionHtml","ensureSalesOrderInventoryDisplay"].map(fn).join("\n"),ctx);
  let checks=0;const check=(value,label)=>{assert(value,label);checks++;};
  let o=order();await ctx.hydrateSalesOrderInventory(o);
  check(calls.length===1,"duplicate variants share one exact read");
  check(calls[0].args.p_variant_id==="2250"&&calls[0].args.p_query==="","variant ID only, no fuzzy lookup");
  let h=ctx.salesOrderInventorySectionHtml(o);check(h.includes("GLA-21 (11) / GLA-32 (13)"),"location aggregation");check(h.includes("24"),"current total");check(!h.includes("SECRET"),"foreign positions excluded");
  for(const lang of ["ja","en","zh"]){ctx.currentLang=lang;h=ctx.salesOrderInventorySectionHtml(o);check(h.includes(ctx.t("sales_inventory_stock")),lang+" label");}ctx.currentLang="ja";
  for(const value of ["zero","missing","error","denied","wrongProduct","wrongKind","invalid","legacy","unassigned","recount","overallocated"]){mode=value;o=order();await ctx.hydrateSalesOrderInventory(o);h=ctx.salesOrderInventorySectionHtml(o);let r=o.inventory_display.rows["2250"];
    if(value==="zero")check(r.status==="ready"&&r.stock===0&&h.includes("場所未登録"),"zero is known stock");
    else if(value==="legacy")check(h.includes("OLD-01")&&h.includes("旧登録"),"legacy shelf is marked");
    else if(value==="unassigned")check(h.includes("場所未登録")&&r.unassigned===24,"unassigned total");
    else if(["recount","overallocated"].includes(value))check(h.includes("要実数確認"),"unsafe location warning");
    else check(r.status===(value==="missing"?"missing":value==="denied"?"denied":"error")&&!h.includes("GLA-"),"fail closed "+value);
  }
  o=order();o.items[0].product_variant_id=null;o.items=o.items.slice(0,1);o.dispatch=null;reads=0;await ctx.hydrateSalesOrderInventory(o);check(reads===0&&ctx.salesOrderInventorySectionHtml(o).includes("在庫区分未登録"),"missing identity never guesses");
  mode="held";o=order();let pending=ctx.hydrateSalesOrderInventory(o);check(ctx.salesOrderInventorySectionHtml(o).includes("取得中"),"loading");ctx.currentUser={id:"other-owner"};held();await pending;check(!ctx.salesOrderInventorySectionHtml(o).includes("GLA-"),"late response after owner change");
  ctx.currentUser={id:"qa-owner"};mode="success";o=order();allowed=false;reads=0;await ctx.hydrateSalesOrderInventory(o);check(reads===0,"unauthorized no reads");allowed=true;
  await ctx.hydrateSalesOrderInventory(o);ctx.currentUser=null;check(!ctx.salesOrderInventorySectionHtml(o).includes("GLA-"),"logout hides snapshot");ctx.currentUser={id:"qa-owner"};
  o=order();mode="held";pending=ctx.hydrateSalesOrderInventory(o);o.inventory_display={owner:"qa-owner",rows:{}};held();await pending;check(!ctx.salesOrderInventorySectionHtml(o).includes("GLA-"),"replaced snapshot ignores old result");
  check(fn("loadSalesOrderDetail").includes("requestSeq !== salesOrderDetailSeq || salesOrderDetail !== inventoryOrder"),"selection changes discard inventory");
  check(fn("printSalesOrderDocument").includes('if (type === "dispatch") await hydrateSalesOrderInventory(order);'),"print refreshes current stock");
  check(fn("buildSalesOrderDispatchPage").includes("salesOrderInventoryItemHtml(order, item)"),"dispatch uses shared view");
  check(fn("renderSalesOrderDetail").includes("salesOrderInventorySectionHtml(order)"),"detail uses shared view");
  mode="success";o=order();let host={outerHTML:""};ctx.document={getElementById:()=>host};ctx.salesOrderDetail=o;
  await ctx.ensureSalesOrderInventoryDisplay(o);check(host.outerHTML.includes("GLA-21"),"replaced order after actions loads inventory");
  reads=0;await ctx.ensureSalesOrderInventoryDisplay(o);check(reads===0,"render does not refetch a loaded snapshot");
  mode="held";o=order();ctx.salesOrderDetail=o;host.outerHTML="new selection";pending=ctx.ensureSalesOrderInventoryDisplay(o);ctx.salesOrderDetail=order();held();await pending;check(host.outerHTML==="new selection","late action inventory preserves new selection");
  return checks;
};
