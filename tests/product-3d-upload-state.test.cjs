const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "product-3d.js"), "utf8");
const start = source.indexOf("  async function uploadSelectedGlb() {");
const end = source.indexOf("  async function deleteUploadedGlb(", start);
assert(start >= 0 && end > start, "GLB upload function must remain testable");
const uploadSource = source.slice(start, end);
const deleteEnd = source.indexOf("  async function openViewerById(", end);
assert(deleteEnd > end, "GLB delete function must remain testable");
const deleteSource = source.slice(end, deleteEnd);

function harness(invoke, selectedProductId = 123) {
  const alerts = [];
  const calls = { invoke: 0, refresh: 0, viewer: 0, viewerArgs: [] };
  const input = {
    files: [new File([new Uint8Array(20)], "fixture.glb", { type: "model/gltf-binary" })],
    disabled: false,
    value: "selected",
  };
  const state = { selectedProductId, manage: true };
  const context = {
    File, FormData, console,
    elements: { "product-3d-glb-file": input },
    glbUploadTarget: { context: "sales", productId: 123, kind: "rebuilt", replacedId: "" },
    glbMutationBusy: false,
    modelCacheEpoch: 0,
    sessionModelsEnabled: true,
    selectedTarget: () => ({ product: { dkd_shohin_id: state.selectedProductId }, kind: "rebuilt" }),
    productId: product => Number(product?.dkd_shohin_id || 0),
    canManage3D: () => state.manage,
    sb: { functions: { invoke: async (...args) => { calls.invoke++; return invoke(...args); } } },
    alert: message => alerts.push(message),
    edgeErrorMessage: async error => String(error?.message || error || "unknown"),
    friendlyError: error => String(error?.message || error || "unknown"),
    clearModelCaches: () => {},
    renderMediaPane: async () => { calls.refresh++; },
    refreshMediaAvailability: async () => {},
    scheduleBadgeRefresh: () => {},
    openViewerById: async (...args) => { calls.viewer++; calls.viewerArgs.push(Array.from(args)); },
  };
  const upload = vm.runInNewContext(`${uploadSource}\nuploadSelectedGlb`, context);
  return { upload, state, input, alerts, calls, context };
}

test("product switched while file chooser is open never uploads to stale product", async () => {
  const qa = harness(async () => ({ data: { ok: true } }), 124);
  await qa.upload();
  assert.equal(qa.calls.invoke, 0);
  assert.match(qa.alerts[0], /GLBを選び直してください/);
  assert.equal(qa.input.value, "");
});

test("lost response refreshes read-only state and never claims upload failed", async () => {
  const qa = harness(async () => { throw new Error("network lost"); });
  await qa.upload();
  assert.equal(qa.calls.invoke, 1);
  assert.equal(qa.calls.refresh, 1);
  assert.equal(qa.calls.viewer, 0);
  assert.match(qa.alerts[0], /結果を確認できません。再送信せず/);
  assert.doesNotMatch(qa.alerts[0], /登録に失敗しました/);
  assert.equal(qa.input.disabled, false);
});

test("explicit Edge validation rejection does not claim an uncertain upload", async () => {
  const qa = harness(async () => ({
    error: {
      context: {
        status: 400,
        json: async () => ({ error: "Invalid GLB structure" }),
      },
    },
  }));
  await qa.upload();
  assert.equal(qa.calls.invoke, 1);
  assert.equal(qa.calls.viewer, 0);
  assert.equal(qa.calls.refresh, 0);
  assert.match(qa.alerts[0], /GLBは登録されませんでした/);
  assert.match(qa.alerts[0], /Invalid GLB structure/);
  assert.doesNotMatch(qa.alerts[0], /結果を確認できません/);
  assert.equal(qa.input.disabled, false);
});

test("explicit Edge size rejection tells the operator to choose a smaller GLB", async () => {
  const qa = harness(async () => ({
    error: {
      context: {
        status: 413,
        json: async () => ({ error: "Request body exceeds the size limit" }),
      },
    },
  }));
  await qa.upload();
  assert.equal(qa.calls.invoke, 1);
  assert.equal(qa.calls.viewer, 0);
  assert.equal(qa.calls.refresh, 0);
  assert.match(qa.alerts[0], /GLBは登録されませんでした/);
  assert.match(qa.alerts[0], /サイズ/);
});

test("successful upload passes the returned product model to the common Viewer", async () => {
  const qa = harness(async (name, options) => {
    assert.equal(name, "product-3d-glb");
    assert.equal(options.body.get("action"), "upload");
    assert.equal(options.body.get("product_id"), "123");
    assert.equal(options.body.get("product_kind"), "rebuilt");
    assert.equal(options.body.get("file").name, "fixture.glb");
    return { data: { ok: true, model_id: "new-model" } };
  });
  await qa.upload();
  assert.equal(qa.calls.invoke, 1);
  assert.equal(qa.calls.refresh, 1);
  assert.deepEqual(qa.calls.viewerArgs, [["uploaded:new-model", "sales", 123]]);
  assert.deepEqual(qa.alerts, []);
  assert.equal(qa.input.disabled, false);
  assert.equal(qa.input.value, "");
});

test("successful upload remains successful when preview update fails", async () => {
  const qa = harness(async () => ({ data: { ok: true, model_id: "new-model" } }));
  qa.context.openViewerById = async () => { throw new Error("preview offline"); };
  await qa.upload();
  assert.equal(qa.calls.invoke, 1);
  assert.equal(qa.calls.refresh, 1);
  assert.match(qa.alerts[0], /GLBは登録されましたが、プレビューを更新できませんでした/);
  assert.doesNotMatch(qa.alerts[0], /登録に失敗しました/);
});

test("replacement cleanup warning survives a failed preview refresh", async () => {
  const qa = harness(async () => ({ data: { ok: true, model_id: "new-model", cleanup_pending: true } }));
  qa.context.renderMediaPane = async () => { throw new Error("view offline"); };
  await qa.upload();
  assert.equal(qa.calls.invoke, 1);
  assert.match(qa.alerts[0], /旧ファイルの片付けは保留されています/);
  assert.match(qa.alerts[1], /GLBは登録されましたが、プレビューを更新できませんでした/);
  assert.equal(qa.calls.viewer, 0);
});

test("replacement cleanup warning survives product selection change", async () => {
  const qa = harness(async () => {
    qa.state.selectedProductId = 124;
    return { data: { ok: true, model_id: "new-model", cleanup_pending: true } };
  });
  await qa.upload();
  assert.match(qa.alerts[0], /旧ファイルの片付けは保留されています/);
  assert.match(qa.alerts[1], /対象商品を選び直してプレビュー/);
  assert.equal(qa.calls.viewer, 0);
});

test("selection changed during upload does not preview the wrong product", async () => {
  const qa = harness(async () => {
    qa.state.selectedProductId = 124;
    return { data: { ok: true, model_id: "new-model" } };
  });
  await qa.upload();
  assert.equal(qa.calls.invoke, 1);
  assert.equal(qa.calls.viewer, 0);
  assert.match(qa.alerts[0], /対象商品を選び直してプレビュー/);
});

test("lost delete response refreshes the registered model without retrying", async () => {
  const qa = harness(async () => { throw new Error("network lost"); });
  qa.context.canManage3D = () => true;
  qa.context.window = { confirm: () => true };
  const remove = vm.runInNewContext(`${deleteSource}\ndeleteUploadedGlb`, qa.context);
  await remove("sales", "11111111-1111-4111-8111-111111111111");
  assert.equal(qa.calls.invoke, 1);
  assert.equal(qa.calls.refresh, 1);
  assert.match(qa.alerts[0], /状態を確認できません。再実行せず/);
});

test("confirmed delete remains successful when the subsequent screen refresh fails", async () => {
  const qa = harness(async () => ({ data: { ok: true } }));
  qa.context.window = { confirm: () => true };
  qa.context.renderMediaPane = async () => { throw new Error("view offline"); };
  const remove = vm.runInNewContext(`${deleteSource}\ndeleteUploadedGlb`, qa.context);
  await remove("sales", "11111111-1111-4111-8111-111111111111");
  assert.equal(qa.calls.invoke, 1);
  assert.match(qa.alerts[0], /GLBは削除されましたが、画面を更新できませんでした/);
  assert.doesNotMatch(qa.alerts[0], /削除の状態を確認できません/);
});

test("confirmed delete with a refreshed screen needs no failure message", async () => {
  const qa = harness(async () => ({ data: { ok: true } }));
  qa.context.window = { confirm: () => true };
  const remove = vm.runInNewContext(`${deleteSource}\ndeleteUploadedGlb`, qa.context);
  await remove("sales", "11111111-1111-4111-8111-111111111111");
  assert.equal(qa.calls.invoke, 1);
  assert.equal(qa.calls.refresh, 1);
  assert.deepEqual(qa.alerts, []);
});

test("an explicit delete error with failed refresh never claims success", async () => {
  const qa = harness(async () => ({ error: new Error("cleanup pending") }));
  qa.context.window = { confirm: () => true };
  qa.context.renderMediaPane = async () => { throw new Error("view offline"); };
  const remove = vm.runInNewContext(`${deleteSource}\ndeleteUploadedGlb`, qa.context);
  await remove("sales", "11111111-1111-4111-8111-111111111111");
  assert.equal(qa.calls.invoke, 1);
  assert.match(qa.alerts[0], /削除の状態を確認できません。再実行せず/);
  assert.doesNotMatch(qa.alerts[0], /GLBは削除されました/);
});

test("retired model with unconfirmed file removal is reported without retry", async () => {
  const error = new Error("non-2xx response");
  error.context = { json: async () => ({ model_retired: true, cleanup_pending: true,
    storage_removal_confirmed: false, error: "cleanup unconfirmed" }) };
  const qa = harness(async () => ({ error, data: null }));
  qa.context.window = { confirm: () => true };
  const remove = vm.runInNewContext(`${deleteSource}\ndeleteUploadedGlb`, qa.context);
  await remove("sales", "11111111-1111-4111-8111-111111111111");
  assert.equal(qa.calls.invoke, 1);
  assert.match(qa.alerts[0], /表示から外れましたが、ファイル削除の結果は確認できません/);
  assert.match(qa.alerts[0], /再実行せず/);
  assert.doesNotMatch(qa.alerts[0], /ファイルは削除されました/);
});

test("retired model with confirmed file removal keeps metadata warning after failed refresh", async () => {
  const error = new Error("non-2xx response");
  error.context = { json: async () => ({ model_retired: true, cleanup_pending: true,
    storage_removal_confirmed: true, error: "metadata cleanup pending" }) };
  const qa = harness(async () => ({ error, data: null }));
  qa.context.window = { confirm: () => true };
  qa.context.renderMediaPane = async () => { throw new Error("view offline"); };
  const remove = vm.runInNewContext(`${deleteSource}\ndeleteUploadedGlb`, qa.context);
  await remove("sales", "11111111-1111-4111-8111-111111111111");
  assert.equal(qa.calls.invoke, 1);
  assert.match(qa.alerts[0], /ファイルは削除されましたが、管理記録の片付けは保留中/);
  assert.match(qa.alerts[0], /画面も更新できませんでした/);
  assert.doesNotMatch(qa.alerts[0], /削除の状態を確認できません/);
});

test("permission lost in the file chooser cannot submit a GLB", async () => {
  const qa = harness(async () => ({ data: { ok: true } }));
  qa.state.manage = false;
  await qa.upload();
  assert.equal(qa.calls.invoke, 0);
  assert.match(qa.alerts[0], /権限が変わりました/);
});

test("delete cannot run while a GLB upload is in flight", async () => {
  let finish;
  const qa = harness(() => new Promise(resolve => { finish = resolve; }));
  qa.context.window = { confirm: () => true };
  const remove = vm.runInNewContext(`${deleteSource}\ndeleteUploadedGlb`, qa.context);
  const pending = qa.upload();
  assert.equal(qa.calls.invoke, 1);
  assert.equal(qa.context.glbMutationBusy, true);
  await remove("sales", "11111111-1111-4111-8111-111111111111");
  assert.equal(qa.calls.invoke, 1);
  finish({ data: { ok: true, model_id: "new-model" } });
  await pending;
  assert.equal(qa.context.glbMutationBusy, false);
});

test("mock GLB upload response reaches the admin card and customer common Viewer", async () => {
  const modelId = "11111111-1111-4111-8111-111111111111";
  const modelPath = `uploaded/dkd_42/rebuilt/${modelId}.glb`;
  const calls = { uploads: 0, signed: [], viewers: [], alerts: [] };
  const state = { salesId: 42, customerId: 42, row: null };
  const input = {
    files: [new File([new Uint8Array(20)], "fixture.glb", { type: "model/gltf-binary" })],
    disabled: false, value: "selected",
  };
  const hosts = {
    "sales-product-3d-list": { innerHTML: "", isConnected: true },
    "customer-product-3d-list": { innerHTML: "", isConnected: true },
  };
  const shown = new Set();
  const overlay = {
    classList: { add: name => shown.add(name), contains: name => shown.has(name) },
    setAttribute() {},
  };
  const elements = {
    "product-3d-glb-file": input,
    "product-3d-viewer-overlay": overlay,
    "product-3d-viewer-close": { focus() {} },
    "product-3d-viewer-title": { textContent: "" },
    "product-3d-viewer-loading": { textContent: "", hidden: true },
    "product-3d-viewer-fullscreen-notice": { hidden: true },
    "product-3d-viewer-stage": {},
    "product-3d-viewer-shell": {},
  };
  const context = {
    File, FormData, console, elements, document: { body: {}, activeElement: null },
    BUCKET: "product-3d", modelCacheEpoch: 0, sessionModelsEnabled: true,
    mediaPaneRequest: { sales: 0, customer: 0 }, viewerRequestId: 0,
    viewerReturnFocus: null, viewerFocusTarget: null, viewer: null,
    glbUploadTarget: { context: "sales", productId: 42, kind: "rebuilt", replacedId: "" },
    glbMutationBusy: false,
    selectedTarget: channel => ({ product: { dkd_shohin_id: channel === "customer" ? state.customerId : state.salesId }, kind: "rebuilt" }),
    productId: product => product?.dkd_shohin_id || 0,
    canManage3D: () => true, canReview3D: () => true, canPublish3D: () => false,
    el: id => hosts[id],
    esc: value => String(value ?? ""),
    kindLabel: () => "リビルト", productTitle: () => "商品42",
    modelStatusLabel: status => status,
    friendlyError: error => String(error?.message || error),
    edgeErrorMessage: async error => String(error?.message || error),
    clearModelCaches() {}, refreshMediaAvailability: async () => {}, scheduleBadgeRefresh() {},
    alert: message => calls.alerts.push(message),
    sb: {
      functions: { invoke: async (name, options) => {
        calls.uploads++;
        assert.equal(name, "product-3d-glb");
        assert.equal(options.body.get("product_id"), "42");
        assert.equal(options.body.get("product_kind"), "rebuilt");
        state.row = { id: modelId, dkd_shohin_id: 42, product_kind: "rebuilt", status: "ready",
          storage_path: modelPath, model_bytes: 20, created_at: "2026-10-02T00:00:00Z" };
        return { data: { ok: true, model_id: modelId } };
      } },
      storage: { from: bucket => {
        assert.equal(bucket, "product-3d");
        return { createSignedUrl: async path => {
          calls.signed.push(path);
          return { data: { signedUrl: "https://example.test/signed-model.glb" }, error: null };
        } };
      } },
    },
    getViewerModule: async () => ({ createProduct3DViewer: async options => {
      calls.viewers.push(options);
      return { dispose() {} };
    } }),
  };
  const normalizeStart = source.indexOf("  function normalizeUploadedModel(");
  const normalizeEnd = source.indexOf("  async function fetchInternalModels(", normalizeStart);
  const renderStart = source.indexOf("  async function renderMediaPane(");
  const renderEnd = source.indexOf("  function modelStatusLabel(", renderStart);
  const viewerStart = source.indexOf("  async function openViewerById(");
  const viewerEnd = source.indexOf("  function keepViewerFocus(", viewerStart);
  assert(normalizeStart >= 0 && normalizeEnd > normalizeStart && renderStart >= 0 &&
    renderEnd > renderStart && viewerStart >= 0 && viewerEnd > viewerStart);
  const viewerSource = source.slice(viewerStart, viewerEnd).replace(
    /await import\("\.\/product-3d-viewer\.js\?v=[^"]+"\)/,
    "await getViewerModule()"
  );
  assert(!viewerSource.includes("await import("));
  const api = vm.runInNewContext(`${source.slice(normalizeStart, normalizeEnd)}\n${source.slice(renderStart, renderEnd)}\n${uploadSource}\n${viewerSource}\n({ normalizeUploadedModel, renderMediaPane, uploadSelectedGlb, openViewerById })`, context);
  context.fetchInternalModels = async () => state.row ? [api.normalizeUploadedModel(state.row)] : [];
  context.fetchPublishedModels = async () => state.row ? [api.normalizeUploadedModel(state.row)] : [];

  await api.uploadSelectedGlb();
  assert.equal(calls.uploads, 1);
  assert.match(hosts["sales-product-3d-list"].innerHTML, new RegExp(`data-open-model='uploaded:${modelId}'`));
  assert.equal(calls.viewers.length, 1);
  assert.deepEqual(calls.signed, [modelPath]);
  assert.equal(calls.viewers[0].host, elements["product-3d-viewer-stage"]);
  assert.equal(calls.viewers[0].url, "https://example.test/signed-model.glb");
  assert.equal(elements["product-3d-viewer-loading"].hidden, true);
  assert(shown.has("show"));

  await api.renderMediaPane("customer");
  assert.match(hosts["customer-product-3d-list"].innerHTML, new RegExp(`data-open-model='uploaded:${modelId}'`));
  await api.openViewerById(`uploaded:${modelId}`, "customer", 42);
  assert.equal(calls.viewers.length, 2);
  assert.deepEqual(calls.signed, [modelPath, modelPath]);
  assert.deepEqual(calls.alerts, []);
});
