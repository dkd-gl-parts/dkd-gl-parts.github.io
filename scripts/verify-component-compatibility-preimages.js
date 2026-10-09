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
const names = ["componentMutationStorageKey", "readComponentMutationPending", "performComponentMutation",
  "selectComponentCompatExistingPart", "openComponentCompatForm", "componentCompatFormCurrent", "componentCompatSnapshotFields",
  "componentCompatSnapshotKey", "componentCompatErrorMessage", "updateComponentCompatSaveState", "captureComponentCompatSnapshot", "closeComponentCompatForm", "saveComponentCompatForm"];
const functions = names.map(extract).join("\n");
assert(!extract("saveComponentCompatForm").includes("sb.from"));
assert(!extract("saveComponentCompatForm").includes("get_component_compatibility_snapshot"));
assert(!source.includes("function syncComponentCompatManualParts("));
assert(source.includes('addEventListener("input", captureComponentCompatSnapshot)'));
for (const match of functions.matchAll(/t\("([^"]+)"\)/g)) {
  for (const language of ["ja", "en", "zh"]) assert(translations.TRANSLATIONS[language][match[1]], `${language}/${match[1]}`);
}
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
function fixture() {
  const elements = {}, calls = [], alerts = [], store = new Map();
  const element = id => elements[id] ||= { value: "", textContent: "", checked: false, hidden: false, disabled: false,
    classes: new Set(), classList: { add(name) { elements[id].classes.add(name); }, remove(name) { elements[id].classes.delete(name); } } };
  const image = { token: "loaded-token", anchor_token: "loaded-anchor", source_part: null,
    anchor: { base: { dkd_component_id: 10, part_name: "Loaded base" },
      old_part: { id: 1, manufacturer: "DENSO", part_number: "A220", part_name: "Loaded name" },
      link: { id: 1, relation_type: "reference", note: "Loaded note" }, manual_parts: [{ id: 1 }, { id: 2 }] } };
  const c = {
    console, currentUser: { id: "fixture-user" }, componentCompatSelected: { dkd_component_id: 10, part_name: "Cached base" },
    componentCompatLinks: [{ id: 1, internal_component_parts: { id: 1, manufacturer: "DENSO", part_number: "A220", part_name: "Cached name" } }],
    componentCompatExistingRows: [], componentCompatSourceComponentMap: {}, componentCompatExistingProductKind: "rebuilt",
    componentCompatFormSeq: 0, componentCompatLookupSeq: 0, componentCompatSnapshotState: null, componentCompatSaving: false, componentCompatActionSaving: false,
    componentCompatSourceMapKey: link => String(link.internal_component_parts.id), componentCompatBaseLabel: base => base.part_name,
    renderComponentCompatExistingRows() {}, canManageComponentCompatibility: () => true, componentCompatIsAssySelfRow: () => false,
    normalizeComponentManufacturerInput: value => String(value || "").trim().toUpperCase(),
    normalizeComponentPartNumberInput: value => String(value || "").trim().toUpperCase(),
    normalizedPartKey: value => String(value || "").toUpperCase().replace(/[^0-9A-Z]/g, ""),
    canonicalComponentNameForStorage: value => String(value || "").trim(),
    document: { getElementById: element }, window: { crypto: { randomUUID: () => "40000000-0000-4000-8000-000000000001" },
      sessionStorage: { getItem: key => store.get(key) || null, setItem: (key, value) => store.set(key, value), removeItem: key => store.delete(key) } },
    t: key => translations.TRANSLATIONS.ja[key] || key, alert: value => alerts.push(value),
    reloads: 0, logs: 0, renders: 0, assists: 0,
    loadComponentCompatLinks: async () => { c.reloads++; }, renderComponentCompatLinks: () => { c.renders++; },
    loadComponentCompatAssist: async () => { c.assists++; }, writeLog: async () => { c.logs++; },
    snapshotResponse: { data: image }, response: { data: { internal_part_id: 1, link_id: 1, synced_manual_parts: 2, synced_manual_usages: 2 } },
    receiptResponse: { data: null }, sb: { from() { throw new Error("No separate HTTP writes allowed"); }, rpc: async (name, args) => {
      calls.push({ name, args });
      if (name === "get_component_compatibility_snapshot") return c.snapshotWait ? c.snapshotWait.promise : c.snapshotResponse;
      if (name === "get_component_mutation_receipt") return c.receiptResponse;
      if (c.loseResponse) throw new Error("lost response");
      return c.saveWait ? c.saveWait.promise : c.response;
    } }
  };
  vm.createContext(c); vm.runInContext(functions, c);
  return { c, elements, calls, alerts, store, image, el: suffix => element("component-compat-form-" + suffix) };
}
(async () => {
  const loaded = fixture(); await loaded.c.openComponentCompatForm(1);
  assert.equal(loaded.el("part-name").value, "Loaded name"); assert.equal(loaded.el("note").value, "Loaded note");
  assert.equal(loaded.el("relation").value, "reference"); assert.match(loaded.el("base").textContent, /Loaded base/);
  assert.match(loaded.elements["component-compat-sync-label"].textContent, /2件/);
  assert.equal(loaded.calls.length, 1); loaded.el("part-name").value = "User edit";
  await loaded.c.saveComponentCompatForm();
  assert.equal(loaded.calls.length, 2); assert.equal(loaded.calls[1].name, "save_component_compatibility_safely");
  assert.equal(loaded.calls[1].args.target_snapshot_token, "loaded-token"); assert.equal(loaded.calls[1].args.target_fields.part_name, "User edit");
  assert.equal(loaded.calls[1].args.target_fields.sync_manual, true); assert.equal(loaded.c.reloads, 1); assert.equal(loaded.c.logs, 1);
  const stale = fixture(); await stale.c.openComponentCompatForm(1); stale.el("part-name").value = "Retain edit";
  stale.c.response = { error: { code: "40001", message: "stale" } }; await stale.c.saveComponentCompatForm();
  assert.equal(stale.el("part-name").value, "Retain edit"); assert.equal(stale.c.reloads, 0); assert.equal(stale.store.size, 0);
  assert(stale.elements["component-compat-form-overlay"].classes.has("show")); assert.match(stale.el("error").textContent, /入力内容は残しています/);
  const missing = fixture(); await missing.c.openComponentCompatForm(1); missing.c.componentCompatSnapshotState.snapshots = {};
  await missing.c.saveComponentCompatForm(); assert.equal(missing.calls.length, 1); assert.equal(missing.c.reloads, 0);
  const cache = fixture(); await cache.c.openComponentCompatForm(1);
  cache.el("part-number").value = "A221"; cache.c.snapshotResponse = { data: { ...cache.image, token: "first-new-token" } };
  await cache.c.captureComponentCompatSnapshot(); cache.c.snapshotResponse = { data: { ...cache.image, token: "later-new-token" } };
  await cache.c.captureComponentCompatSnapshot(); assert.equal(cache.calls.length, 2);
  await cache.c.saveComponentCompatForm(); assert.equal(cache.calls[2].args.target_snapshot_token, "first-new-token");
  const changed = fixture(); await changed.c.openComponentCompatForm(1); changed.el("part-number").value = "A221";
  changed.c.snapshotResponse = { data: { ...changed.image, anchor_token: "changed-anchor" } };
  await changed.c.captureComponentCompatSnapshot(); await changed.c.saveComponentCompatForm();
  assert.equal(changed.calls.length, 2); assert.equal(changed.el("part-number").value, "A221"); assert.equal(changed.c.reloads, 0);
  const canceled = fixture(); canceled.c.snapshotWait = deferred(); const opening = canceled.c.openComponentCompatForm(1);
  canceled.c.closeComponentCompatForm(); canceled.el("part-name").value = "After cancel";
  canceled.c.snapshotWait.resolve({ data: canceled.image }); await opening;
  assert.equal(canceled.el("part-name").value, "After cancel"); assert.equal(canceled.c.componentCompatSnapshotState, null);
  const moved = fixture(); moved.c.snapshotWait = deferred(); const moving = moved.c.openComponentCompatForm(1);
  moved.c.componentCompatSelected = { dkd_component_id: 11 }; moved.el("part-name").value = "Another selection";
  moved.c.snapshotWait.resolve({ data: moved.image }); await moving; assert.equal(moved.el("part-name").value, "Another selection");
  await moved.c.saveComponentCompatForm(); assert.equal(moved.calls.length, 1);
  const typing = fixture(); typing.c.snapshotWait = deferred(); const typingOpen = typing.c.openComponentCompatForm(1);
  typing.el("part-name").value = "Typed during load"; typing.c.snapshotWait.resolve({ data: typing.image }); await typingOpen;
  assert.equal(typing.el("part-name").value, "Typed during load"); assert.equal(typing.c.componentCompatSnapshotState.anchorToken, "");
  assert.match(typing.el("error").textContent, /入力内容は残しています/);
  const duplicate = fixture(); await duplicate.c.openComponentCompatForm(1); duplicate.c.saveWait = deferred();
  const saving = duplicate.c.saveComponentCompatForm(); await duplicate.c.saveComponentCompatForm();
  assert.equal(duplicate.calls.length, 2); duplicate.c.saveWait.resolve(duplicate.c.response); await saving;
  const lost = fixture(); await lost.c.openComponentCompatForm(1); lost.el("part-name").value = "Unknown result";
  lost.c.loseResponse = true; await lost.c.saveComponentCompatForm(); assert.equal(lost.store.size, 1); assert.equal(lost.c.reloads, 0);
  assert.equal(lost.el("part-name").value, "Unknown result"); assert.match(lost.el("error").textContent, /再送は行いません/);
  vm.runInContext(functions, lost.c); await lost.c.saveComponentCompatForm();
  assert.equal(lost.calls.at(-1).name, "get_component_mutation_receipt"); assert.equal(lost.store.size, 1);
  lost.c.receiptResponse = lost.c.response; await lost.c.saveComponentCompatForm();
  assert.equal(lost.store.size, 0); assert.equal(lost.c.componentCompatSnapshotState.anchorToken, "");
  await lost.c.saveComponentCompatForm(); assert.equal(lost.calls.filter(call => call.name === "save_component_compatibility_safely").length, 1);
  const sourcePart = fixture(); await sourcePart.c.openComponentCompatForm(1);
  const uncertain = fixture(); await uncertain.c.openComponentCompatForm(1);
  uncertain.c.response = { error: { code: "08006", message: "connection lost at commit" } };
  await uncertain.c.saveComponentCompatForm(); assert.equal(uncertain.store.size, 1);
  await uncertain.c.saveComponentCompatForm();
  assert.equal(uncertain.calls.at(-1).name, "get_component_mutation_receipt");
  assert.equal(uncertain.calls.filter(call => call.name === "save_component_compatibility_safely").length, 1);
  const completionUnknown = fixture(); await completionUnknown.c.openComponentCompatForm(1);
  completionUnknown.c.response = { error: { code: "40003", message: "statement completion unknown" } };
  await completionUnknown.c.saveComponentCompatForm(); assert.equal(completionUnknown.store.size, 1);
  await completionUnknown.c.saveComponentCompatForm();
  assert.equal(completionUnknown.calls.at(-1).name, "get_component_mutation_receipt");
  assert.equal(completionUnknown.calls.filter(call => call.name === "save_component_compatibility_safely").length, 1);
  sourcePart.c.componentCompatExistingRows = [{ dkd_component_id: 3, manufacturer: "OTHER", manufacturer_part_number: "B110", part_name: "Existing" }];
  sourcePart.c.selectComponentCompatExistingPart(3); await new Promise(resolve => setImmediate(resolve));
  assert.equal(sourcePart.calls.at(-1).args.target_fields.source_component_id, 3);
  assert.equal(sourcePart.calls.at(-1).args.target_fields.manufacturer, "OTHER"); assert.equal(sourcePart.el("part-name").value, "Existing");
  const later = fixture(); await later.c.openComponentCompatForm(1); later.c.snapshotWait = deferred();
  later.el("part-number").value = "A221"; const targetLoading = later.c.captureComponentCompatSnapshot();
  later.el("part-number").value = "A220"; await later.c.captureComponentCompatSnapshot();
  later.c.snapshotWait.resolve({ data: { ...later.image, token: "obsolete-target" } }); await targetLoading;
  assert.equal(Object.keys(later.c.componentCompatSnapshotState.snapshots).length, 1);
  const logging = fixture(); await logging.c.openComponentCompatForm(1); logging.c.writeLog = async () => { throw new Error("audit unavailable"); };
  await logging.c.saveComponentCompatForm(); await logging.c.saveComponentCompatForm();
  assert.equal(logging.calls.length, 2); assert.equal(logging.c.componentCompatSnapshotState.anchorToken, "");
  for (const [message, key] of Object.entries({
    DCATS_COMPONENT_COMPATIBILITY_SELF_REFERENCE: "component_compat_self",
    DCATS_COMPONENT_COMPATIBILITY_SOURCE_MISMATCH: "component_compat_source_mismatch",
    DCATS_COMPONENT_COMPATIBILITY_DUPLICATE: "component_compat_duplicate",
    DCATS_COMPONENT_COMPATIBILITY_AMBIGUOUS: "component_compat_ambiguous",
    DCATS_COMPONENT_COMPATIBILITY_LINK_AMBIGUOUS: "component_compat_ambiguous",
    DCATS_COMPONENT_COMPATIBILITY_FIELDS_INVALID: "component_compat_fields_invalid"
  })) {
    for (const language of ["ja", "en", "zh"]) {
      assert(translations.TRANSLATIONS[language][key]);
      logging.c.t = requested => translations.TRANSLATIONS[language][requested];
      assert.equal(logging.c.componentCompatErrorMessage({ code: "22023", message }), translations.TRANSLATIONS[language][key]);
      assert.equal(logging.c.componentCompatErrorMessage({ code: "42501" }), translations.TRANSLATIONS[language].component_compat_permission);
      assert.equal(logging.c.componentCompatErrorMessage({ code: "40001" }), translations.TRANSLATIONS[language].component_compat_conflict);
    }
  }
  console.log("Component compatibility aggregate preimages, retained input and read-only receipt recovery verified.");
})().catch(error => { console.error(error); process.exitCode = 1; });
