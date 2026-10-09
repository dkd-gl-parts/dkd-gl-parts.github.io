"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const translations = {};
vm.runInNewContext(source.slice(source.indexOf("var TRANSLATIONS = "), source.indexOf("\nvar currentLang")), translations);
function extract(name) {
  const marker = source.indexOf(`function ${name}(`);
  assert(marker >= 0, name);
  const start = source.slice(marker - 6, marker) === "async " ? marker - 6 : marker;
  let depth = 0, quote = "", escaped = false;
  for (let i = source.indexOf("{", marker); i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === quote) quote = "";
    } else if ('"\'`'.includes(ch)) quote = ch;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(name);
}
const names = ["componentMutationStorageKey", "readComponentMutationPending", "componentMutationButtonText", "performComponentMutation",
  "hydrateManualComponentListSnapshots", "deleteComponentUsage", "normalizeComponentPriceNameInput", "isCoreSourceComponentPartNumber",
  "componentPriceSnapshotKey", "lookupSharedComponentUnitPrice", "reconcileComponentAddPartNumbers", "addAssemblyComponentForCurrent"];
const functions = names.map(extract).join("\n");
assert(!extract("deleteComponentUsage").includes(".delete()"));
assert(!extract("deleteComponentUsage").includes("get_manual_component_edit_snapshot"));
assert(!extract("addAssemblyComponentForCurrent").includes('sb.rpc("add_manual_assembly_component"'));
assert(extract("addAssemblyComponentForCurrent").includes("reconcileComponentAddPartNumbers(false)"));
assert.equal((source.match(/await hydrateManualComponentListSnapshots\((?:rpcRows|treeFallbackRows|rows)\)/g) || []).length, 3);
function fixture() {
  const store = new Map(), calls = [], alerts = [], elements = {};
  const image = {
    token: "row-loaded", usage: { id: 1, component_id: 9, dkd_shohin_id: 42, product_kind: "rebuilt", product_variant_id: null,
      component_name: "Plunger", quantity: "1", unit_price_jpy: 120, is_catalog_evidence: false },
    part: { dkd_component_id: 9, manufacturer: "DENSO", manufacturer_part_number: "A220", genuine_part_number: null, part_name: "Plunger" }
  };
  const c = {
    console, currentUser: { id: "fixture-user" }, currentProduct: { dkd_shohin_id: 42 },
    componentAddSaving: false, componentDeleteSaving: false, componentAddSnapshotState: null,
    componentAddPartNumberLookupSeq: 0, assemblyComponentRows: [{ id: 1, component_name: "old" }], editingComponentUsageId: null,
    window: { crypto: { randomUUID: () => "40000000-0000-4000-8000-000000000001" },
      sessionStorage: { getItem: key => store.get(key) || null, setItem: (key,value) => store.set(key,value), removeItem: key => store.delete(key) } },
    selectedProductKind: () => "rebuilt", selectedComponentVariantId: () => null,
    normalizedComponentPartKey: value => String(value || "").toUpperCase().replace(/[-\s\u3000]/g, ""),
    normalizeComponentManufacturerInput: value => String(value || "").trim().toUpperCase(),
    normalizeComponentPartNumberInput: value => String(value || "").trim().toUpperCase(),
    normalizeComponentPartNumberElement() {},
    canManageComponentsInCurrentContext: () => true, isCatalogComponentRow: row => !!row.is_catalog_evidence,
    isCurrentCategoryAssyComponentName: () => false, lookupComponentPartNumberPair: async () => null,
    componentAddValue: id => String(elements[id]?.value || "").trim(),
    setComponentAddValue: (id,value) => { (elements[id] ||= {}).value = value || ""; },
    document: { getElementById: id => elements[id] ||= { value: "", textContent: "", disabled: false } },
    renderComponentAddNameOptions() {}, updateComponentAddPartNumberInputState() {}, renderAssemblyComponentRows() {},
    componentPartNumberValidation: () => ({ errors: [] }),
    validateComponentPartNumberInputs: (pn,genuine) => ({ manufacturerPartNumber: pn, genuinePartNumber: genuine, errors: [], warnings: [] }),
    confirmComponentPartNumberWarnings: () => true, canonicalComponentNameForStorage: value => value,
    componentNameMasterValidationMessage: () => "", applyComponentProcurementRateDefault() {}, normalizeComponentReplacementRateElement: () => 60,
    nullableIntFromInput: id => elements[id]?.value ? parseInt(elements[id].value,10) : null,
    uniqueTextValues: value => value, componentActivityDesc: () => "fixture", recordComponentNameCandidateUsageForCurrent() {},
    clearComponentAddForm: () => { c.clears++; }, closeComponentAddForm: () => { c.closes++; },
    clears: 0, closes: 0, reloads: 0, logs: 0,
    loadAssemblyComponentsForCurrent: async () => { c.reloads++; }, writeLog: async () => { c.logs++; },
    t: key => translations.TRANSLATIONS.ja[key] || key, alert: value => alerts.push(value), confirm: () => true,
    response: { data: { usage_id: 101, shared_price_updated_count: 2 } }, receiptResponse: { data: null },
    sb: { rpc: async (name,args) => {
      calls.push({ name,args });
      if (name === "get_component_mutation_receipt") return c.receiptResponse;
      if (name === "get_manual_component_list_snapshots") return { data: [image] };
      if (name === "get_component_shared_price_snapshot") return { data: { token: "price-first", unit_price_jpy: 120 } };
      if (c.loseResponse) throw new Error("synthetic lost response");
      return c.response;
    } }
  };
  vm.createContext(c); vm.runInContext(functions,c);
  return { c,store,calls,alerts,elements,image };
}
function ready(f) {
  const { c,elements } = f;
  for (const [id,value] of Object.entries({
    "component-add-mfr": "DENSO", "component-add-mfr-pn": "A220", "component-add-name": "Plunger",
    "component-add-qty": "1", "component-add-unit-price": "130", "component-add-replacement-rate": "60"
  })) elements[id] = { value };
  c.componentAddSnapshotState = {
    product: c.currentProduct, kind: "rebuilt", variant: null, targetToken: "target-loaded", prices: {},
    targetFields: { target_dkd_shohin_id: 42, target_manufacturer: "UNKNOWN", target_manufacturer_part_number: "ASSY42", target_genuine_part_number: null }
  };
  const key=c.componentPriceSnapshotKey({ component_manufacturer:"DENSO",component_manufacturer_part_number:"A220",component_part_name:"Plunger" });
  c.componentAddSnapshotState.prices[key] = { token:"price-loaded",unitPrice:120 };
}
(async () => {
  const unknown=fixture(), payload={ target_fields:{ component_quantity:"1" },target_target_snapshot_token:"target",target_price_snapshot_token:"price" };
  unknown.c.loseResponse=true;
  await assert.rejects(()=>unknown.c.performComponentMutation("add",payload),/再送は行いません/);
  assert.equal(unknown.store.size,1);
  await assert.rejects(()=>unknown.c.performComponentMutation("add",payload),/再送は行いません/);
  assert.deepEqual(unknown.calls.map(call=>call.name),["add_manual_component_safely","get_component_mutation_receipt"]);
  // Simulate reloading the script: the pending request survives in this window's sessionStorage.
  vm.runInContext(functions,unknown.c);
  unknown.c.receiptResponse={ data:{ usage_id:101,shared_price_updated_count:2 } };
  const recovered=await unknown.c.performComponentMutation("delete",{ target_usage_id:2,target_snapshot_token:"different" });
  assert.equal(recovered.operation,"add"); assert.equal(recovered.recovered,true); assert.equal(unknown.store.size,0);
  assert.equal(unknown.calls.filter(call=>call.name==="add_manual_component_safely").length,1);
  const rejected=fixture(); rejected.c.response={ error:{ code:"40001",message:"conflict" } };
  await assert.rejects(()=>rejected.c.performComponentMutation("add",payload),e=>e.code==="40001"); assert.equal(rejected.store.size,0);
  const denied=fixture(); denied.c.window.sessionStorage.setItem=()=>{ throw new Error("storage blocked"); };
  await assert.rejects(()=>denied.c.performComponentMutation("add",payload),/実行していません/); assert.equal(denied.calls.length,0);
  const corrupt=fixture(); corrupt.store.set("dcats:component-pending:fixture-user","corrupt");
  await assert.rejects(()=>corrupt.c.performComponentMutation("add",payload),/実行していません/); assert.equal(corrupt.calls.length,0);
  const switched=fixture(); switched.c.loseResponse=true; await assert.rejects(()=>switched.c.performComponentMutation("add",payload));
  switched.c.currentUser={ id:"different-user" }; assert.equal(switched.c.readComponentMutationPending(),null);
  switched.c.currentUser={ id:"fixture-user" }; assert.equal(switched.c.readComponentMutationPending().operation,"add");
  const add=fixture(); ready(add); await add.c.addAssemblyComponentForCurrent();
  const call=add.calls.find(call=>call.name==="add_manual_component_safely");
  assert.equal(call.args.target_target_snapshot_token,"target-loaded"); assert.equal(call.args.target_price_snapshot_token,"price-loaded");
  assert.equal(call.args.target_fields.component_unit_price_jpy,130); assert.equal(call.args.target_fields.component_replacement_rate,60);
  assert.equal(add.c.reloads,1); assert.equal(add.c.clears,1);
  const stale=fixture(); ready(stale); stale.c.response={ error:{ code:"40001",message:"stale" } };
  await stale.c.addAssemblyComponentForCurrent(); assert.equal(stale.elements["component-add-unit-price"].value,"130");
  assert.equal(stale.c.reloads,0); assert.equal(stale.c.clears,0); assert.match(stale.elements["component-add-error"].textContent,/入力内容は残しています/);
  const missing=fixture(); ready(missing); missing.c.componentAddSnapshotState.prices={}; await missing.c.addAssemblyComponentForCurrent();
  assert.equal(missing.calls.length,0); assert.match(missing.elements["component-add-error"].textContent,/共通単価/);
  const lostAdd=fixture(); ready(lostAdd); lostAdd.c.loseResponse=true; await lostAdd.c.addAssemblyComponentForCurrent();
  assert.equal(lostAdd.c.clears,0); assert.equal(lostAdd.c.reloads,0);
  lostAdd.c.receiptResponse={ data:{ usage_id:101 } }; await lostAdd.c.addAssemblyComponentForCurrent();
  assert.equal(lostAdd.calls.filter(call=>call.name==="add_manual_component_safely").length,1);
  assert.equal(lostAdd.c.componentAddSnapshotState.targetToken,""); // A third click cannot add the retained input again.
  await lostAdd.c.addAssemblyComponentForCurrent(); assert.equal(lostAdd.calls.filter(call=>call.name==="add_manual_component_safely").length,1);
  const price=fixture(); ready(price); price.c.componentAddSnapshotState.prices={}; price.elements["component-add-unit-price"].value="";
  await price.c.reconcileComponentAddPartNumbers(); assert.equal(price.elements["component-add-unit-price"].value,"120");
  price.elements["component-add-unit-price"].value="140"; await price.c.reconcileComponentAddPartNumbers(); await price.c.reconcileComponentAddPartNumbers(false);
  assert.equal(price.elements["component-add-unit-price"].value,"140");
  assert.equal(price.calls.filter(call=>call.name==="get_component_shared_price_snapshot").length,1);
  const deleted=fixture(); await deleted.c.hydrateManualComponentListSnapshots(deleted.c.assemblyComponentRows);
  assert.equal(deleted.c.assemblyComponentRows[0].unit_price_jpy,120);
  assert.equal(deleted.c.assemblyComponentRows[0]._deleteSnapshotToken,"row-loaded");
  deleted.c.response={ error:{ code:"40001",message:"changed" } }; await deleted.c.deleteComponentUsage("1");
  assert.equal(deleted.calls.at(-1).args.target_snapshot_token,"row-loaded"); assert.equal(deleted.c.reloads,0);
  assert.match(deleted.alerts.at(-1),/入力内容は残しています/); assert.equal(deleted.c.componentDeleteSaving,false);
  deleted.c.response={ data:{ usage_id:1,deleted_count:1 } }; await deleted.c.deleteComponentUsage("1"); assert.equal(deleted.c.reloads,1);
  const noImage=fixture(); await noImage.c.deleteComponentUsage("1"); assert.equal(noImage.calls.length,0);
  console.log("Component add/delete guard passed: loaded preimages, stable price cache, durable pending results, read-only recovery and retained conflicts.");
})().catch(error=>{ console.error(error); process.exitCode=1; });
