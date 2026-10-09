"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8"), translations = {};
vm.runInNewContext(source.slice(source.indexOf("var TRANSLATIONS = "), source.indexOf("\nvar currentLang")), translations);
function extract(name) {
  const marker = source.indexOf(`function ${name}(`); assert(marker >= 0, name);
  const start = source.slice(marker - 6, marker) === "async " ? marker - 6 : marker;
  let depth = 0, quote = "", escaped = false;
  for (let i = source.indexOf("{", marker); i < source.length; i++) {
    const ch = source[i];
    if (quote) { if (escaped) escaped = false; else if (ch === "\\") escaped = true; else if (ch === quote) quote = ""; }
    else if ('"\'`'.includes(ch)) quote = ch;
    else if (ch === "{") depth++;
    else if (ch === "}" && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(name);
}
const functions = ["componentMutationStorageKey", "readComponentMutationPending", "performComponentMutation", "componentCompatErrorMessage",
  "componentAlternativeFormCurrent", "componentAlternativeSnapshotFields", "componentAlternativeSnapshotKey", "updateComponentAlternativeSaveState",
  "captureComponentAlternativeSnapshot", "closeComponentAlternativeForm", "openComponentAlternativeForm", "saveComponentAlternativeForm",
  "disableComponentAlternative", "hydrateComponentAlternativeSnapshots", "reconcileComponentAlternativePartNumbers"].map(extract).join("\n");
for (const name of ["saveComponentAlternativeForm", "disableComponentAlternative"]) {
  assert(!extract(name).includes("sb.from")); assert(!extract(name).includes("get_variant_component_alternative_snapshot"));
  assert(!extract(name).includes("await reconcileComponentAlternativePartNumbers"));
}
assert(!source.includes('sb.rpc("add_variant_component_alternative"'));
for (const match of functions.matchAll(/\bt\("([^"]+)"\)/g)) for (const lang of ["ja", "en", "zh"]) assert(translations.TRANSLATIONS[lang][match[1]], lang + match[1]);
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
function fixture() {
  const elements = {}, calls = [], store = new Map(), alerts = [];
  const element = id => elements[id] ||= { value: "", textContent: "", disabled: false, classes: new Set(), focus() {},
    classList: { add(name) { elements[id].classes.add(name); }, remove(name) { elements[id].classes.delete(name); }, contains(name) { return elements[id].classes.has(name); } } };
  const image = { token: "loaded-token", anchor_token: "loaded-anchor", anchor: { base: { dkd_component_id: 10, part_name: "Loaded base", manufacturer_part_number: "BASE" }, link: null }, matches: [], suppliers: [] };
  const c = { console, currentUser: { id: "fixture-user" }, currentProduct: { id: 42 }, kind: "rebuilt", variant: 4201,
    assemblyComponentRows: [{ id: 1, dkd_component_id: 10, component_part_name: "Cached name", quantity: "2" }], componentChildRowsMap: {},
    componentAlternativeBaseRow: null, componentAlternativeSnapshotState: null, componentAlternativeRows: [],
    componentAlternativeFormSeq: 0, componentAlternativeLookupSeq: 0, componentAlternativePartNumberLookupSeq: 0,
    componentAlternativeSaving: false, componentAlternativeHydrateSeq: 0,
    selectedProductKind: () => c.kind, selectedComponentVariantId: () => c.variant, resolveCurrentCoreDkdShohinId: async () => c.currentProduct.id,
    canManageComponentsInCurrentContext: () => true, productDkdId: p => String(p.id), componentCatalogCategoryCode: () => "A",
    componentAlternativeBaseText: row => row.component_part_name || "Base", componentAddValue: id => element(id).value,
    setComponentAddValue: (id, value) => { element(id).value = value; },
    clearComponentAlternativeForm() { for (const id of Object.keys(elements)) if (id.startsWith("component-alt-")) element(id).value = ""; },
    renderComponentAlternativeNameOptions() {}, bindComponentAlternativeNameControls() {}, setComponentAlternativeNameValue: value => { element("component-alt-name").value = value; },
    loadComponentCatalogNameCandidatesForCurrent: async () => {}, normalizeComponentPartNumberElement() {},
    componentPartNumberValidation: value => ({ value, errors: [], warnings: [] }), uniqueTextValues: list => list,
    normalizeComponentManufacturerInput: value => String(value || "").trim().toUpperCase(), normalizeComponentPartNumberInput: value => String(value || "").trim().toUpperCase(),
    validateComponentAlternativePartNumberInputs: (pn, genuine) => ({ manufacturerPartNumber: pn, genuinePartNumber: genuine, errors: [], warnings: [] }),
    updateComponentAlternativePartNumberInputState() {}, confirmComponentPartNumberWarnings: () => true,
    canonicalComponentNameForStorage: value => value, syncComponentAlternativeNameValue: () => element("component-alt-name").value,
    componentNameMasterValidationMessage: () => "", applyComponentAlternativeProcurementRateDefault() {}, normalizeComponentAlternativeReplacementRateElement: () => null,
    nullableIntFromInput: id => element(id).value === "" ? null : Number(element(id).value), componentAlternativeStructuredNote: values => JSON.stringify(values),
    isCurrentCategoryAssyComponentName: () => true, lookupComponentPartNumberPair: async () => c.lookupWait ? c.lookupWait.promise : null,
    componentLookupAutofillValue: (value, suggestion) => value || suggestion,
    document: { getElementById: element }, window: { crypto: { randomUUID: () => "40000000-0000-4000-8000-000000000001" },
      sessionStorage: { getItem: key => store.get(key) || null, setItem: (key, value) => store.set(key, value), removeItem: key => store.delete(key) } },
    t: key => translations.TRANSLATIONS.ja[key] || key, alert: value => alerts.push(value), confirm: () => true,
    reloads: 0, loadAssemblyComponentsForCurrent: async () => { c.reloads++; }, writeLog: async () => { if (c.logFails) throw new Error("log failed"); },
    alternativesForComponent: row => row._ui_alternatives || [],
    snapshotResponse: { data: image }, receiptResponse: { data: null },
    response: { data: { alternative_id: 2, internal_part_id: 1, product_id: 42, variant_id: 4201, catalog_component_id: 10, supplier_id: 9 } },
    sb: { from() { throw new Error("No separate HTTP writes allowed"); }, rpc: async (name, args) => {
      calls.push({ name, args });
      if (name === "get_variant_component_alternative_snapshot") return c.snapshotWait ? c.snapshotWait.promise : c.snapshotResponse;
      if (name === "get_component_mutation_receipt") return c.receiptResponse;
      if (c.loseResponse) throw new Error("lost response"); return c.saveWait ? c.saveWait.promise : c.response;
    } }
  };
  vm.createContext(c); vm.runInContext(functions, c);
  return { c, calls, image, alerts, store, el: suffix => element("component-alt-" + suffix), element };
}
async function ready(f) {
  await f.c.openComponentAlternativeForm(1); f.el("mfr").value = "DENSO"; f.el("pn").value = "A220"; f.el("price").value = "0";
  await f.c.captureComponentAlternativeSnapshot();
}
function disableReady(f) {
  const fields = { action: "disable", product_id: 42, variant_id: 4201, product_kind: "rebuilt", catalog_component_id: 10, link_id: 2 };
  f.c.componentAlternativeRows = [{ id: 2, _disable_snapshot: { fields, image: { token: "delete-loaded", anchor: { link: { id: 2 } } },
    product: f.c.currentProduct, variant: 4201, kind: "rebuilt", userId: "fixture-user" } }];
  f.c.response = { data: { alternative_id: 2, disabled_count: 1 } };
}
(async () => {
  const loaded = fixture(); await ready(loaded); assert.match(loaded.el("base").textContent, /Loaded base/);
  await loaded.c.saveComponentAlternativeForm(); assert.equal(loaded.calls.length, 3);
  assert.equal(loaded.calls[2].name, "save_variant_component_alternative_safely"); assert.equal(loaded.calls[2].args.target_snapshot_token, "loaded-token");
  assert.equal(loaded.calls[2].args.target_fields.reference_price, 0); assert.equal(loaded.c.reloads, 1);
  for (const change of [f => { f.c.currentProduct = { id: 43 }; }, f => { f.c.variant = 4301; }, f => { f.c.kind = "aftermarket_new"; },
    f => { f.c.currentUser = { id: "different" }; }, f => { f.c.componentAlternativeSnapshotState.snapshots = {}; }]) {
    const f = fixture(); await ready(f); change(f); await f.c.saveComponentAlternativeForm(); assert.equal(f.calls.length, 2);
  }
  const stale = fixture(); await ready(stale); stale.c.response = { error: { code: "40001", message: "conflict" } };
  await stale.c.saveComponentAlternativeForm(); assert.equal(stale.el("pn").value, "A220"); assert.equal(stale.c.reloads, 0); assert.equal(stale.store.size, 0);
  assert.match(stale.el("error").textContent, /入力内容は残しています/);
  const cache = fixture(); await ready(cache); cache.c.snapshotResponse = { data: { ...cache.image, token: "new-read" } };
  await cache.c.captureComponentAlternativeSnapshot(); assert.equal(cache.calls.length, 2);
  cache.el("position").value = "X"; await cache.c.captureComponentAlternativeSnapshot(); assert.equal(cache.calls.length, 3);
  cache.el("position").value = ""; await cache.c.captureComponentAlternativeSnapshot(); await cache.c.saveComponentAlternativeForm();
  assert.equal(cache.calls.at(-1).args.target_snapshot_token, "loaded-token");
  for (const code of ["40003", "08006", "XX000"]) {
    const f = fixture(); await ready(f); f.c.response = { error: { code, message: "unknown" } }; await f.c.saveComponentAlternativeForm();
    assert.equal(f.store.size, 1); await f.c.saveComponentAlternativeForm(); assert.equal(f.calls.at(-1).name, "get_component_mutation_receipt");
    assert.equal(f.calls.filter(call => call.name === "save_variant_component_alternative_safely").length, 1);
  }
  const unknown = fixture(); await ready(unknown); unknown.c.loseResponse = true; await unknown.c.saveComponentAlternativeForm();
  vm.runInContext(functions, unknown.c); unknown.c.loseResponse = false; unknown.c.receiptResponse = unknown.c.response;
  await unknown.c.saveComponentAlternativeForm(); assert.equal(unknown.store.size, 0); assert.equal(unknown.calls.at(-1).name, "get_component_mutation_receipt");
  assert.equal(unknown.c.componentAlternativeSnapshotState.anchorToken, ""); await unknown.c.saveComponentAlternativeForm();
  assert.equal(unknown.calls.filter(call => call.name === "save_variant_component_alternative_safely").length, 1);
  const invalid = fixture(); await ready(invalid); invalid.c.response.data.variant_id = 4301; await invalid.c.saveComponentAlternativeForm(); assert.equal(invalid.store.size, 1);
  const logging = fixture(); await ready(logging); logging.c.logFails = true; await logging.c.saveComponentAlternativeForm();
  await logging.c.saveComponentAlternativeForm(); assert.equal(logging.calls.filter(call => call.name === "save_variant_component_alternative_safely").length, 1);
  const double = fixture(); await ready(double); double.c.saveWait = deferred(); const sending = double.c.saveComponentAlternativeForm();
  await double.c.saveComponentAlternativeForm(); await double.c.disableComponentAlternative(2); assert.equal(double.calls.length, 3);
  double.c.saveWait.resolve(double.c.response); await sending;
  const cancelled = fixture(); cancelled.c.snapshotWait = deferred(); const opening = cancelled.c.openComponentAlternativeForm(1);
  await new Promise(resolve => setImmediate(resolve)); cancelled.c.closeComponentAlternativeForm(); cancelled.c.snapshotWait.resolve(cancelled.c.snapshotResponse); await opening;
  assert.equal(cancelled.c.componentAlternativeSnapshotState, null);
  const lookup = fixture(); await ready(lookup); lookup.c.lookupWait = deferred(); const searching = lookup.c.reconcileComponentAlternativePartNumbers();
  lookup.c.closeComponentAlternativeForm(); lookup.c.lookupWait.resolve({ manufacturer: "OTHER", manufacturer_part_number: "B110" }); await searching;
  assert.equal(lookup.el("pn").value, "A220");
  const disabled = fixture(); disableReady(disabled); await disabled.c.disableComponentAlternative(2);
  assert.equal(disabled.calls.length, 1); assert.equal(disabled.calls[0].name, "disable_variant_component_alternative_safely"); assert.equal(disabled.c.reloads, 1);
  const absent = fixture(); await absent.c.disableComponentAlternative(2); assert.equal(absent.calls.length, 0);
  const disableUnknown = fixture(); disableReady(disableUnknown); disableUnknown.c.response = { error: { code: "40003", message: "unknown" } };
  await disableUnknown.c.disableComponentAlternative(2); await disableUnknown.c.disableComponentAlternative(2);
  assert.equal(disableUnknown.store.size, 1); assert.equal(disableUnknown.calls.at(-1).name, "get_component_mutation_receipt"); assert.equal(disableUnknown.calls.length, 2);
  const hydrated = fixture(), alt = { id: 2, catalog_component_id: 10 };
  hydrated.c.snapshotResponse = { data: { token: "loaded-unlink", anchor: { link: { id: 2, catalog_component_id: 10 } }, matches: [{ id: 1, part_name: "Loaded part" }], suppliers: [{ status: "active", reference_price: 10 }] } };
  await hydrated.c.hydrateComponentAlternativeSnapshots([{ _ui_alternatives: [alt] }]);
  assert.equal(alt.internal_component_parts.part_name, "Loaded part"); assert.equal(alt._disable_snapshot.image.token, "loaded-unlink");
  assert.equal(hydrated.c.componentAlternativeRows.length, 1);
  const late = fixture(); disableReady(late); late.c.saveWait = deferred(); const removing = late.c.disableComponentAlternative(2);
  late.c.currentProduct = { id: 43 }; late.c.componentAlternativeSnapshotState = { anchorToken: "new-context" };
  late.c.componentAlternativeRows = [{ _disable_snapshot: { image: { token: "new-context" } } }];
  late.c.saveWait.resolve(late.c.response); await removing;
  assert.equal(late.c.reloads, 0); assert.equal(late.c.componentAlternativeSnapshotState.anchorToken, "new-context");
  assert.equal(late.c.componentAlternativeRows[0]._disable_snapshot.image.token, "new-context");
  for (const change of [f => { f.c.currentUser = { id: "different" }; }, f => { f.c.componentAlternativeSnapshotState = { anchorToken: "new-form" }; }]) {
    const f = fixture(); disableReady(f); f.c.saveWait = deferred(); const removing = f.c.disableComponentAlternative(2);
    change(f); f.c.saveWait.resolve(f.c.response); await removing;
    assert.equal(f.c.reloads, 0);
    if (f.c.componentAlternativeSnapshotState) assert.equal(f.c.componentAlternativeSnapshotState.anchorToken, "new-form");
  }
  console.log("Variant alternative loaded preimages, atomic save boundary, double-click and read-only receipt recovery verified.");
})().catch(error => { console.error(error); process.exit(1); });
