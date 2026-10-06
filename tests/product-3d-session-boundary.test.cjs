const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "product-3d.js"), "utf8");
function between(first, next) {
  const start = source.indexOf(`  ${first}`);
  const end = source.indexOf(`  ${next}`, start);
  assert(start >= 0 && end > start, `${first} must remain testable`);
  return source.slice(start, end);
}
const selectedSource = [
  between("async function fetchPublishedModels(", "function normalizeUploadedModel("),
  between("async function uploadSelectedGlb(", "async function deleteUploadedGlb("),
  between("async function deleteUploadedGlb(", "async function openViewerById("),
  between("function resetSessionModels(", "function bindSessionBoundary("),
  between("function bindSessionBoundary(", "function init("),
].join("\n");

function harness(query, invoke = async () => ({ data: { ok: true }, error: null })) {
  const events = { callback: null, reads: 0, closed: 0, refreshes: 0, renders: 0, alerts: [], timers: [] };
  const input = { files: [], disabled: false, value: "" };
  const context = {
    console,
    FormData: class { append() {} },
    alert: message => { events.alerts.push(message); },
    elements: { "product-3d-glb-file": input },
    modelCache: Object.create(null),
    internalModelCache: Object.create(null),
    modelBadgeCache: Object.create(null),
    modelCacheEpoch: 0,
    modelAuthUserId: null,
    sessionModelsEnabled: true,
    mediaAvailabilityRequest: { sales: 0, production: 0, customer: 0 },
    mediaPaneRequest: { sales: 0, production: 0, customer: 0 },
    badgeRefreshTimer: null,
    glbUploadTarget: null,
    glbMutationBusy: false,
    state: {},
    freshState: () => ({}),
    closeCapture: () => { events.closed++; },
    closeViewer: () => { events.closed++; },
    canManage3D: () => true,
    canManageGlb: () => true,
    selectedTarget: () => ({ product: { id: 123 }, kind: "rebuilt" }),
    productId: product => product && product.id,
    clearModelCaches: () => { events.refreshes++; },
    renderMediaPane: async () => { events.renders++; },
    edgeErrorMessage: async () => "error",
    friendlyError: error => String(error),
    openViewerById: async () => { events.renders++; },
    document: { querySelectorAll: () => [] },
    el: () => null,
    window: {
      clearTimeout: () => {},
      confirm: () => true,
      setTimeout: callback => { events.timers.push(callback); return 1; },
    },
    refreshMediaAvailability: () => { events.refreshes++; },
    scheduleBadgeRefresh: () => { events.refreshes++; },
    sb: {
      auth: { onAuthStateChange: callback => { events.callback = callback; } },
      functions: { invoke },
      from: () => ({
        select() { return this; },
        eq() { return this; },
        order() { events.reads++; return query(); },
      }),
    },
  };
  const api = vm.runInNewContext(`${selectedSource}\n({ fetchPublishedModels, uploadSelectedGlb, deleteUploadedGlb, resetSessionModels, bindSessionBoundary })`, context);
  return { api, context, events, input };
}

test("sign-out clears cached model rows and prevents new reads", async () => {
  let rows = [{ id: "old-user-model" }];
  const qa = harness(async () => ({ data: rows, error: null }));
  qa.api.bindSessionBoundary();
  qa.events.callback("INITIAL_SESSION", { user: { id: "user-a" } });
  await qa.api.fetchPublishedModels(123);
  assert.equal(qa.events.reads, 1);
  rows = [{ id: "new-user-model" }];
  assert.equal((await qa.api.fetchPublishedModels(123))[0].id, "old-user-model");
  qa.events.callback("SIGNED_OUT", null);
  assert.equal((await qa.api.fetchPublishedModels(123)).length, 0);
  assert.equal(qa.events.reads, 1);
  assert.equal(Object.keys(qa.context.modelCache).length, 0);
  qa.events.callback("SIGNED_IN", { user: { id: "user-b" } });
  assert.equal((await qa.api.fetchPublishedModels(123))[0].id, "new-user-model");
  assert.equal(qa.events.reads, 2);
});

test("a response from a previous session cannot repopulate the cache", async () => {
  let finish;
  const delayed = new Promise(resolve => { finish = resolve; });
  const qa = harness(() => delayed);
  const pending = qa.api.fetchPublishedModels(123);
  qa.api.resetSessionModels();
  finish({ data: [{ id: "stale" }], error: null });
  assert.equal((await pending).length, 0);
  assert.equal(Object.keys(qa.context.modelCache).length, 0);
});

test("repeat sign-in for the same account does not close an active viewer", () => {
  const qa = harness(async () => ({ data: [], error: null }));
  qa.api.bindSessionBoundary();
  qa.events.callback("SIGNED_IN", { user: { id: "user-a" } });
  const closed = qa.events.closed;
  qa.events.callback("SIGNED_IN", { user: { id: "user-a" } });
  assert.equal(qa.events.closed, closed);
});

test("old-session upload response does not change a new session's UI or file selection", async () => {
  let finish;
  const qa = harness(async () => ({ data: [], error: null }), () => new Promise(resolve => { finish = resolve; }));
  qa.context.glbUploadTarget = { context: "sales", productId: 123, kind: "rebuilt", replacedId: "" };
  qa.input.files = [{ name: "fixture.glb", size: 256, type: "model/gltf-binary" }];
  const pending = qa.api.uploadSelectedGlb();
  assert.equal(qa.input.disabled, true);
  qa.api.resetSessionModels();
  qa.input.value = "new-session-file";
  finish({ data: { ok: true, model_id: "old-session" }, error: null });
  await pending;
  assert.equal(qa.input.value, "new-session-file");
  assert.equal(qa.events.renders, 0);
  assert.deepEqual(qa.events.alerts, []);
});

test("old-session delete response cannot refresh the new user's model list", async () => {
  let finish;
  const qa = harness(async () => ({ data: [], error: null }), () => new Promise(resolve => { finish = resolve; }));
  const pending = qa.api.deleteUploadedGlb("sales", "uploaded:1");
  qa.api.resetSessionModels();
  finish({ data: { ok: true }, error: null });
  await pending;
  assert.equal(qa.events.renders, 0);
  assert.deepEqual(qa.events.alerts, []);
});
