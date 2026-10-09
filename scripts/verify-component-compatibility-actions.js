"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const translations = {};
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
const names = ["componentMutationStorageKey", "readComponentMutationPending", "performComponentMutation", "componentCompatErrorMessage",
  "loadComponentCompatLinks", "disableComponentCompatLink", "invalidateComponentCompatActionSnapshots",
  "selectedComponentCompatAssistLink", "setComponentCompatAssistSnapshotRows", "runComponentCompatBulkApply"];
const functions = names.map(extract).join("\n");
for (const name of ["disableComponentCompatLink", "runComponentCompatBulkApply"]) {
  assert(!extract(name).includes("sb.from")); assert(!extract(name).includes("get_component_compatibility_action_snapshot"));
}
assert(!extract("runComponentCompatBulkApply").includes('sb.rpc("bulk_apply_component_compatibility"'));
assert(source.includes('addEventListener("change", renderComponentCompatAssist)'));
for (const match of functions.matchAll(/\bt\("([^"]+)"\)/g))
  for (const language of ["ja", "en", "zh"]) assert(translations.TRANSLATIONS[language][match[1]], `${language}/${match[1]}`);
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
function fixture() {
  const elements = {}, calls = [], alerts = [], store = new Map();
  const element = id => elements[id] ||= { value: "", textContent: "Apply", disabled: false, innerHTML: "" };
  const selected = { dkd_component_id: 10 };
  const link = { id: 1, internal_component_part_id: 1, catalog_component_id: 10, product_variant_id: null, status: "active",
    _source_component_id: 1, internal_component_parts: { id: 1, manufacturer: "DENSO", part_number: "A220", part_name: "Cached" } };
  const compatibility = { anchor: { old_part: { ...link.internal_component_parts, part_name: "Loaded name" },
    link: { id: 1, internal_component_part_id: 1, product_variant_id: null, status: "active" } } };
  const unlinkImage = { token: "unlink-loaded", compatibility, group_links: [{ id: 1 }, { id: 3 }] };
  const applyImage = { token: "apply-loaded", compatibility, targets: [
    { variant: { product_variant_id: 4201 }, evidence: { quantity: "2" }, product: { name: "Loaded product" }, existing: false },
    { variant: { product_variant_id: 4301 }, evidence: { quantity: "3" }, product: {}, existing: false },
    { variant: { product_variant_id: 4401 }, evidence: { quantity: "1" }, product: {}, existing: true }
  ] };
  const c = { console, currentUser: { id: "fixture-user" }, componentCompatSelected: selected, componentCompatLinks: [link],
    componentCompatBaseIds: [10, 11], componentCompatLinkLoadSeq: 0, componentCompatAssistSeq: 1,
    componentCompatActionSaving: false, componentCompatSaving: false, componentCompatAssistRows: [], componentCompatAssistSummary: {},
    uniqueTextValues: values => Array.from(new Set(values)), productKindLabel: kind => kind,
    document: { getElementById: element }, window: { crypto: { randomUUID: () => "40000000-0000-4000-8000-000000000001" },
      sessionStorage: { getItem: key => store.get(key) || null, setItem: (key, value) => store.set(key, value), removeItem: key => store.delete(key) } },
    t: key => translations.TRANSLATIONS.ja[key] || key, esc: value => String(value), alert: message => alerts.push(message),
    confirm: () => true, logs: 0, reloads: 0, assists: 0,
    writeLog: async () => { c.logs++; }, renderComponentCompatLinks() {},
    loadComponentCompatAssist: async () => { c.assists++; },
    response: null, receiptResponse: { data: null }, sb: {
      from(table) {
        assert.equal(table, "component_part_alternatives");
        const query = { select() { return query; }, in() { return query; }, eq() { return query; }, order() { return query; },
          limit: async () => c.listWait ? c.listWait.promise : { data: [{ ...link }] } };return query;
      },
      rpc: async (name, args) => {
        calls.push({ name, args });
        if (name === "get_component_compatibility_action_snapshot") return c.snapshotWait ? c.snapshotWait.promise : { data: unlinkImage };
        if (name === "get_component_mutation_receipt") return c.receiptResponse;
        if (c.loseResponse) throw new Error("lost response");
        return c.saveWait ? c.saveWait.promise : c.response || { data: name === "unlink_component_compatibility_safely" ?
          { link_id: 1, unlinked_count: 2 } : { link_id: 1, variant_ids: [4201, 4301], target_count: 2, inserted_count: 2, skipped_count: 0 } };
      }
    }
  };
  link._unlink_snapshot = { fields: { action: "unlink", catalog_component_id: 10, link_id: 1 }, image: unlinkImage, selected };
  link._apply_snapshot = { fields: { action: "apply", catalog_component_id: 10, link_id: 1, source_component_id: 1, product_kind: "rebuilt" }, image: applyImage, selected, seq: 1 };
  element("component-compat-bulk-link").value = "1"; element("component-compat-assist-kind").value = "rebuilt";
  vm.createContext(c); vm.runInContext(functions, c); c.setComponentCompatAssistSnapshotRows();
  const actualLoad = c.loadComponentCompatLinks;
  c.loadComponentCompatLinks = async () => { c.reloads++; };
  return { c, calls, alerts, store, link, selected, element, actualLoad, unlinkImage, applyImage };
}
(async () => {
  const loaded = fixture();
  assert.equal(loaded.c.componentCompatAssistRows.length, 2); assert.equal(loaded.c.componentCompatAssistRows[0].evidence.quantity, "2");
  assert.equal(loaded.c.componentCompatAssistSummary.targetCount, 3); assert.equal(loaded.c.componentCompatAssistSummary.existingCount, 1);
  await loaded.c.runComponentCompatBulkApply([4301, 4201], loaded.element("button"));
  assert.equal(loaded.calls[0].name, "apply_component_compatibility_safely"); assert.equal(loaded.calls[0].args.target_snapshot_token, "apply-loaded");
  assert.equal(loaded.c.logs, 1); assert.equal(loaded.c.assists, 1); assert.equal(loaded.link._apply_snapshot, null);
  const unlink = fixture(); await unlink.c.disableComponentCompatLink(1);
  assert.equal(unlink.calls[0].name, "unlink_component_compatibility_safely"); assert.equal(unlink.calls[0].args.target_snapshot_token, "unlink-loaded");
  assert.equal(unlink.calls[0].args.target_fields.link_id, 1); assert.equal(unlink.c.logs, 1); assert.equal(unlink.c.reloads, 1);
  for (const reason of ["missing", "context", "sequence", "kind", "selection"]) {
    const f = fixture();
    if (reason === "missing") f.link._apply_snapshot = null;
    if (reason === "context") f.c.componentCompatSelected = { dkd_component_id: 11 };
    if (reason === "sequence") f.c.componentCompatAssistSeq++;
    if (reason === "kind") f.element("component-compat-assist-kind").value = "aftermarket_new";
    await f.c.runComponentCompatBulkApply(reason === "selection" ? [999] : [4201]);
    assert.equal(f.calls.length, 0, reason); assert.equal(f.c.assists, 0, reason);
  }
  const stale = fixture(); stale.c.response = { error: { code: "40001", message: "stale" } };
  await stale.c.runComponentCompatBulkApply([4201, 4301]);
  assert.equal(stale.c.componentCompatAssistRows.length, 2); assert.equal(stale.c.assists, 0); assert.equal(stale.store.size, 0);
  const double = fixture(); double.c.saveWait = deferred();
  const saving = double.c.runComponentCompatBulkApply([4201, 4301]); await double.c.runComponentCompatBulkApply([4201, 4301]);
  await double.c.disableComponentCompatLink(1); assert.equal(double.calls.length, 1);
  double.c.saveWait.resolve({ data: { link_id: 1, variant_ids: [4201, 4301], target_count: 2, inserted_count: 2, skipped_count: 0 } });await saving;
  for (const operation of ["apply", "unlink"]) {
    const f = fixture(), invoke = () => operation === "apply" ? f.c.runComponentCompatBulkApply([4201, 4301]) : f.c.disableComponentCompatLink(1);
    f.c.loseResponse = true; await invoke(); assert.equal(f.store.size, 1);
    vm.runInContext(functions, f.c); f.c.loadComponentCompatLinks = async () => { f.c.reloads++; };
    await invoke(); assert.equal(f.calls.at(-1).name, "get_component_mutation_receipt");
    assert.equal(f.calls.at(-1).args.target_operation, "compatibility"); assert.equal(f.store.size, 1);
    f.c.receiptResponse = { data: operation === "apply" ? { link_id: 1, variant_ids: [4201, 4301], target_count: 2, inserted_count: 2, skipped_count: 0 } : { link_id: 1, unlinked_count: 2 } };
    await invoke(); assert.equal(f.store.size, 0); await invoke();
    assert.equal(f.calls.filter(call => call.name === `${operation}_component_compatibility_safely`).length, 1);
  }
  for (const data of [{ link_id: 2, variant_ids: [4201, 4301], target_count: 2, inserted_count: 2, skipped_count: 0 },
    { link_id: 1, variant_ids: [4201], target_count: 1, inserted_count: 1, skipped_count: 0 },
    { link_id: 1, variant_ids: [4201, 4301], target_count: 2, inserted_count: 3, skipped_count: 0 }]) {
    const f = fixture(); f.c.response = { data };await f.c.runComponentCompatBulkApply([4201, 4301]);
    assert.equal(f.store.size, 1); assert.equal(f.c.assists, 0);
  }
  const logging = fixture(); logging.c.writeLog = async () => { throw new Error("logging unavailable"); };
  await logging.c.disableComponentCompatLink(1); await logging.c.disableComponentCompatLink(1); assert.equal(logging.calls.length, 1);
  const otherAction = fixture(); otherAction.c.loseResponse = true; await otherAction.c.disableComponentCompatLink(1);
  otherAction.c.receiptResponse = { data: { link_id: 1, unlinked_count: 2 } };
  await otherAction.c.runComponentCompatBulkApply([4201, 4301]);
  assert.equal(otherAction.calls.at(-1).name, "get_component_mutation_receipt");
  assert.equal(otherAction.calls.filter(call => call.name === "apply_component_compatibility_safely").length, 0);
  assert.equal(otherAction.c.logs, 0); assert.equal(otherAction.c.assists, 0);
  const moved = fixture(); moved.c.saveWait = deferred();const moving = moved.c.runComponentCompatBulkApply([4201, 4301]);
  moved.c.componentCompatSelected = { dkd_component_id: 11 }; moved.c.componentCompatLinks = [{ id: 10, _apply_snapshot: { token: "new" } }];
  moved.c.saveWait.resolve({ data: { link_id: 1, variant_ids: [4201, 4301], target_count: 2, inserted_count: 2, skipped_count: 0 } });await moving;
  assert.equal(moved.c.assists, 0); assert.equal(moved.c.componentCompatLinks[0]._apply_snapshot.token, "new");
  const hydration = fixture(); await hydration.actualLoad();
  assert.equal(hydration.c.componentCompatLinks[0].internal_component_parts.part_name, "Loaded name");
  assert.equal(hydration.c.componentCompatLinks[0]._unlink_snapshot.image.token, "unlink-loaded");
  const late = fixture();late.c.snapshotWait = deferred();const loading = late.actualLoad();
  await new Promise(resolve => setImmediate(resolve));late.c.componentCompatSelected = { dkd_component_id: 11 };
  late.c.componentCompatLinks = [{ id: 10 }];late.c.snapshotWait.resolve({ data: late.unlinkImage });await loading;
  assert.equal(late.c.componentCompatLinks[0].id, 10);assert.equal(late.c.componentCompatLinks[0]._unlink_snapshot, undefined);
  console.log("Compatibility apply/unlink loaded snapshots, duplicate protection and read-only outcome recovery verified.");
})().catch(error => { console.error(error); process.exitCode = 1; });
