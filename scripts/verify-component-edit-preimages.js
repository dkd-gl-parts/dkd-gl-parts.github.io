"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
assert.equal((source.match(/componentEditInput\(row, "unit_price_jpy", row.unit_price_jpy == null \? "" : row.unit_price_jpy\)/g) || []).length, 2);
assert.equal((source.match(/componentEditInput\(row, "replacement_rate", row.replacement_rate == null \? "" : row.replacement_rate\)/g) || []).length, 2);
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
const functions = ["normalizeComponentPriceNameInput", "isCoreSourceComponentPartNumber", "componentPriceSnapshotKey",
  "lookupSharedComponentUnitPrice", "startComponentEdit", "cancelComponentEdit", "componentEditPayloadFromRow",
  "setComponentEditFieldValue", "reconcileComponentEditPartNumbers", "saveComponentEdit"].map(extract).join("\n");
function fixture() {
  const fields = {};
  const row = { id: 1, component_manufacturer: "DENSO", component_manufacturer_part_number: "A220", component_name: "Plunger", unit_price_jpy: 1 };
  const image = {
    usage: { id: 1, component_id: 9, component_name: "Plunger", unit_price_jpy: 120, quantity: "1", component_position: "F", effective_start: "2020", effective_end: null },
    part: { dkd_component_id: 9, manufacturer: "DENSO", manufacturer_part_number: "A220", genuine_part_number: null, part_name: "Plunger" },
    token: "row-at-edit", price: { token: "price-at-edit", unit_price_jpy: 120 }
  };
  const calls = [], alerts = [], button = { disabled: false };
  let renders = 0, reloads = 0, logs = 0;
  const tr = {
    querySelector(selector) { if (selector === "[data-component-save]") return button; return fields[selector.match(/field='([^']+)'/)?.[1]] || null; },
    querySelectorAll() { return Object.entries(fields).map(([name, field]) => ({ value: field.value, dataset: { componentEditField: name } })); }
  };
  const c = {
    console, currentProduct: { id: 42 }, assemblyComponentRows: [row], editingComponentUsageId: null,
    componentEditSnapshotSeq: 0, componentEditPartNumberLookupSeq: 0,
    canManageComponentsInCurrentContext: () => true, isCatalogComponentRow: value => !!value?.is_catalog_evidence,
    selectedProductKind: () => "rebuilt", selectedComponentVariantId: () => null,
    resolveManualComponentUsageId: async () => "1",
    normalizedComponentPartKey: value => String(value || "").toUpperCase().replace(/[-\s\u3000]/g, ""),
    normalizeComponentManufacturerInput: value => String(value || "").trim().toUpperCase(),
    normalizeComponentPartNumberInput: value => String(value || "").trim().toUpperCase(),
    normalizeComponentPartNumberElement() {}, isCurrentCategoryAssyComponentName: () => false,
    componentPartNumberValidation: () => ({ errors: [] }), updateComponentEditPartNumberInputStates() {},
    validateComponentPartNumberInputs: (pn, genuine) => ({ manufacturerPartNumber: pn, genuinePartNumber: genuine, errors: [], warnings: [] }),
    confirmComponentPartNumberWarnings: () => true, canonicalComponentNameForStorage: value => value,
    componentNameMasterValidationMessage: () => "", nullableIntFromValue: value => value === "" ? null : parseInt(value, 10),
    recordComponentNameCandidateUsageForCurrent() {}, refreshComponentEditNameCandidates() {},
    t: value => value, alert: value => alerts.push(value),
    document: { querySelector: () => tr },
    renderAssemblyComponentRows() {
      renders++;
      if (!c.editingComponentUsageId) return;
      const values = { component_manufacturer: row.component_manufacturer, component_manufacturer_part_number: row.component_manufacturer_part_number,
        component_genuine_part_number: row.component_genuine_part_number || "", component_part_name: row.component_name,
        unit_price_jpy: String(row.unit_price_jpy), quantity: row.quantity, replacement_rate: "", manufacturing_memo: "", procurement_category: "", component_interchange_code: "" };
      for (const [name, value] of Object.entries(values)) fields[name] = { value };
    },
    loadAssemblyComponentsForCurrent: async () => { reloads++; }, writeLog: async () => { logs++; },
    rpcResult: { data: {}, error: null },
    snapshotResult: { data: image, error: null },
    sb: {
      from: () => ({ select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: { id: 1, is_catalog_evidence: false } }) }),
      rpc: async (name, args) => {
        calls.push({ name, args });
        if (name === "get_manual_component_edit_snapshot") return c.snapshotResult;
        if (name === "get_component_shared_price_snapshot") return { data: { token: "target-price-at-first-lookup", unit_price_jpy: 70 } };
        if (name === "save_manual_component_edit") {
          if (c.throwSave) throw new Error("synthetic lost response");
          return c.rpcResult;
        }
        throw new Error("Unexpected legacy fallback: " + name);
      }
    }
  };
  vm.createContext(c); vm.runInContext(functions, c);
  return { c, row, fields, image, calls, alerts, button, counts: () => ({ renders, reloads, logs }) };
}
(async () => {
  const f = fixture(); await f.c.startComponentEdit("1");
  assert.equal(f.fields.unit_price_jpy.value, "120", "fresh token must be bound to values from the same snapshot");
  assert.equal(f.row._editSnapshotToken, "row-at-edit");
  assert.equal(f.c.componentPriceSnapshotKey({ component_manufacturer: "UNKNOWN", component_manufacturer_part_number: "CORE-D110", component_part_name: " St ator　" }),
    f.c.componentPriceSnapshotKey({ component_manufacturer: "BUHINDORI", component_manufacturer_part_number: "CORE D110", component_part_name: "Stator" }));
  f.fields.unit_price_jpy.value = "130";
  f.c.rpcResult = { error: { code: "40001", message: "DCATS_COMPONENT_CHANGED_RELOAD" } };
  await f.c.saveComponentEdit("1");
  let save = f.calls.find(call => call.name === "save_manual_component_edit");
  assert.equal(save.args.target_snapshot_token, "row-at-edit");
  assert.equal(save.args.target_price_snapshot_token, "price-at-edit");
  assert.equal(save.args.target_fields.unit_price_jpy, 130);
  assert.equal(save.args.target_fields.component_position, "F", "fields absent from this view are retained");
  assert.equal(save.args.target_fields.effective_start, "2020");
  assert.equal(f.fields.unit_price_jpy.value, "130"); assert.equal(f.counts().reloads, 0); assert.equal(f.counts().logs, 0);
  assert.match(f.alerts.at(-1), /入力内容は残しています/); assert.equal(f.button.disabled, false);
  await f.c.saveComponentEdit("1");
  assert.equal(f.calls.filter(call => call.name.includes("snapshot")).length, 1, "saving must not refresh a loaded token");
  f.fields.component_manufacturer_part_number.value = "CORE-D110"; f.fields.component_part_name.value = "Stator";
  const beforeMissing = f.calls.length;
  await f.c.saveComponentEdit("1");
  assert.equal(f.calls.length, beforeMissing, "save refuses an unobserved identity instead of refreshing it at save time");
  await f.c.reconcileComponentEditPartNumbers("1");
  assert.equal(f.fields.unit_price_jpy.value, "70");
  f.fields.unit_price_jpy.value = "90";
  await f.c.reconcileComponentEditPartNumbers("1");
  assert.equal(f.fields.unit_price_jpy.value, "90");
  await f.c.saveComponentEdit("1");
  save = f.calls.filter(call => call.name === "save_manual_component_edit").at(-1);
  assert.equal(save.args.target_price_snapshot_token, "target-price-at-first-lookup");
  assert.equal(f.calls.filter(call => call.name === "get_component_shared_price_snapshot").length, 1);
  f.fields.component_manufacturer_part_number.value = "A220"; f.fields.component_part_name.value = "Plunger";
  await f.c.reconcileComponentEditPartNumbers("1"); assert.equal(f.fields.unit_price_jpy.value, "120");
  f.c.throwSave = true; await f.c.saveComponentEdit("1");
  assert.equal(f.button.disabled, false); assert.equal(f.counts().reloads, 0); assert.match(f.alerts.at(-1), /自動再送は行いません/);
  const cancelled = fixture(); let complete;
  cancelled.c.snapshotResult = new Promise(resolve => { complete = resolve; });
  const loading = cancelled.c.startComponentEdit("1"); await Promise.resolve();
  cancelled.c.cancelComponentEdit(); complete({ data: cancelled.image }); await loading;
  assert.equal(cancelled.c.editingComponentUsageId, null); assert.equal(cancelled.row._editSnapshotToken, undefined);
  const moved = fixture(); let returnImage;
  moved.c.snapshotResult = new Promise(resolve => { returnImage = resolve; });
  const late = moved.c.startComponentEdit("1"); await Promise.resolve();
  moved.c.currentProduct = { id: 43 }; returnImage({ data: moved.image }); await late;
  assert.equal(moved.row._editSnapshotToken, undefined);
  const failed = fixture(); failed.c.snapshotResult = { error: { code: "PGRST202" } };
  await failed.c.startComponentEdit("1"); assert.equal(failed.c.editingComponentUsageId, null);
  assert.equal(failed.calls.length, 1, "no unprotected compatibility fallback");
  const success = fixture(); await success.c.startComponentEdit("1"); await success.c.saveComponentEdit("1");
  assert.equal(success.counts().reloads, 1); assert.equal(success.counts().logs, 1);
  console.log("Component edit preimage guard passed: matched initial values, stable shared tokens, retained conflicts, cancellation and no legacy fallback.");
})().catch(error => { console.error(error); process.exitCode = 1; });
