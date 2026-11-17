"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
const start = source.indexOf("/* Registered-component input master.");
const end = source.indexOf("/* End registered-component input master. */", start);
assert(start > 0 && end > start);
assert(source.includes("bindComponentInputMasterAssist(null);"));
assert(source.includes('wrap.querySelectorAll("[data-component-edit-row]").forEach'));
const helper = source.slice(start, end);
class Element {
  constructor() {
    this.value = ""; this.dataset = {}; this.children = []; this.events = {};
    this.parentNode = this; this.isConnected = true;
    this.classList = { contains: () => true };
  }
  appendChild(child) { this.children.push(child); if (child.id) elements[child.id] = child; }
  replaceChildren() { this.children = []; }
  setAttribute(key, value) { this[key] = value; }
  addEventListener(event, handler) { this.events[event] = handler; }
}
let elements;
function fixture() {
  elements = {};
  for (const id of ["component-add-overlay", "component-add-name", "component-add-mfr", "component-add-mfr-pn"]) elements[id] = new Element();
  elements["component-add-name"].value = "ブラシ";
  elements["component-add-mfr"].value = "STRONG HOLD";
  elements["component-add-mfr-pn"].value = "existing";
  const calls = [];
  let response = { data: { manufacturers: [{ manufacturer: "STRONG HOLD" }], parts: [{ part_number: "JNDX-37", genuine_part_number: "123" }], total_parts: 1, has_more: false } };
  const sandbox = {
    document: { getElementById: id => elements[id] || null, createElement: () => new Element() },
    currentLang: "ja", currentUser: { id: "test-user" }, currentProduct: { id: 1 },
    currentSelectedComponentVariantId: "10",
    productDkdId: p => p.id, selectedProductKind: () => "rebuilt", componentCatalogCategoryCode: () => "alternator",
    canonicalComponentNameForStorage: name => name, canManageComponentsInCurrentContext: () => true,
    clearTimeout, setTimeout, console: { warn() {} },
    sb: { rpc: async (name, args) => { calls.push({ name, args }); return typeof response === "function" ? response() : response; } }
  };
  vm.createContext(sandbox);
  vm.runInContext(helper, sandbox);
  return { sandbox, calls, get: id => elements[id], setResponse: value => { response = value; } };
}
(async () => {
  let f = fixture();
  await f.sandbox.refreshComponentInputMasterAssist(null);
  assert.equal(f.calls[0].name, "get_component_input_master_choices");
  assert.equal(f.calls[0].args.target_component_name, "ブラシ");
  assert.equal(f.calls[0].args.target_manufacturer, "STRONG HOLD");
  assert.equal(f.calls[0].args.part_search_text, null, "selecting name/maker must show all choices even with an existing number");
  assert.equal(f.get("component-add-mfr-pn").value, "existing", "reading choices must preserve entered part numbers");
  assert.equal(f.get("component-input-master-add-parts").children[0].value, "JNDX-37");
  assert.equal(f.get("component-input-master-add-makers").children[0].value, "STRONG HOLD");
  await f.sandbox.refreshComponentInputMasterAssist(null, true);
  assert.equal(f.calls[1].args.part_search_text, "existing");
  f.setResponse({ data: { manufacturers: [], parts: [{ part_number: "X" }, { part_number: "X", genuine_part_number: "Y" }], total_parts: 1, has_more: false } });
  await f.sandbox.refreshComponentInputMasterAssist(null);
  assert.equal(f.get("component-input-master-add-parts").children.length, 1);
  f.setResponse({ error: { message: "network failure" } });
  await f.sandbox.refreshComponentInputMasterAssist(null);
  assert.equal(f.get("component-add-mfr-pn").value, "existing");
  assert.equal(f.get("component-add-mfr-pn").dataset.masterAssistError, "1");
  assert.match(f.get("component-add-mfr-pn").title, /取得できません/);
  f.setResponse({ data: { manufacturers: [], parts: [], total_parts: 0, has_more: false } });
  await f.sandbox.refreshComponentInputMasterAssist(null);
  assert.equal(f.get("component-add-mfr-pn").dataset.masterAssistError, undefined);
  assert.match(f.get("component-add-mfr-pn").title, /候補なし/);
  f.get("component-add-name").value = "";
  const previousCalls = f.calls.length;
  await f.sandbox.refreshComponentInputMasterAssist(null);
  assert.equal(f.calls.length, previousCalls);
  assert.equal(f.get("component-input-master-add-makers").children.length, 0);

  for (const change of [
    f => { f.sandbox.currentProduct = { id: 2 }; },
    f => { f.sandbox.currentUser = { id: "other-user" }; },
    f => { f.get("component-add-mfr").value = "OTHER"; },
    f => { f.get("component-add-name").value = "レバー"; },
    f => { f.sandbox.currentSelectedComponentVariantId = "20"; },
    f => { f.sandbox.currentLang = "en"; },
    f => { f.get("component-add-overlay").classList.contains = () => false; }
  ]) {
    f = fixture();
    let resolve;
    f.setResponse(() => new Promise(r => { resolve = r; }));
    const pending = f.sandbox.refreshComponentInputMasterAssist(null);
    change(f);
    resolve({ data: { manufacturers: [{ manufacturer: "STALE" }], parts: [{ part_number: "STALE" }], total_parts: 1 } });
    await pending;
    assert.equal(f.get("component-input-master-add-parts").children.length, 0, "a stale result must not populate a new context");
  }
  f = fixture();
  f.sandbox.canManageComponentsInCurrentContext = () => false;
  await f.sandbox.refreshComponentInputMasterAssist(null);
  assert.equal(f.calls.length, 0);

  f = fixture();
  f.setResponse({ data: { manufacturers: [{ manufacturer: "<img src=x>" }], parts: [{ part_number: "<script>" }], total_parts: 1000, has_more: true } });
  await f.sandbox.refreshComponentInputMasterAssist(null);
  assert.equal(f.get("component-input-master-add-parts").children[0].value, "<script>");
  assert.equal(f.get("component-input-master-add-parts").children[0].innerHTML, undefined, "source labels must never be injected as HTML");
  assert.equal(f.get("component-add-mfr-pn").dataset.masterCandidateCount, "1000");
  assert.equal(f.get("component-add-mfr-pn").dataset.masterHasMore, "1");
  const edit = new Element();
  edit.dataset.componentEditRow = "44";
  const editFields = { component_part_name: new Element(), component_manufacturer: new Element(), component_manufacturer_part_number: new Element() };
  editFields.component_part_name.value = "ブラシ";
  editFields.component_manufacturer.value = "OEC";
  editFields.component_manufacturer_part_number.value = "FY545A-1";
  edit.querySelector = selector => editFields[selector.match(/='([^']+)'/)[1]];
  await f.sandbox.refreshComponentInputMasterAssist(edit);
  assert.equal(editFields.component_manufacturer_part_number.value, "FY545A-1");
  assert.equal(f.calls.at(-1).args.target_manufacturer, "OEC");
  for (const lang of ["ja", "en", "zh"]) {
    f.sandbox.currentLang = lang;
    assert(f.sandbox.componentInputMasterText("count", 60).includes("60"));
  }
  console.log("Component input master assist behavioral checks passed");
})().catch(error => { console.error(error); process.exitCode = 1; });
