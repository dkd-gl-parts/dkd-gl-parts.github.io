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
  const calls = { invoke: 0, refresh: 0, viewer: 0 };
  const input = {
    files: [new File([new Uint8Array(20)], "fixture.glb", { type: "model/gltf-binary" })],
    disabled: false,
    value: "selected",
  };
  const state = { selectedProductId };
  const context = {
    File, FormData, console,
    elements: { "product-3d-glb-file": input },
    glbUploadTarget: { context: "sales", productId: 123, kind: "rebuilt", replacedId: "" },
    modelCacheEpoch: 0,
    sessionModelsEnabled: true,
    selectedTarget: () => ({ product: { dkd_shohin_id: state.selectedProductId }, kind: "rebuilt" }),
    productId: product => Number(product?.dkd_shohin_id || 0),
    sb: { functions: { invoke: async (...args) => { calls.invoke++; return invoke(...args); } } },
    alert: message => alerts.push(message),
    edgeErrorMessage: async error => String(error?.message || error || "unknown"),
    friendlyError: error => String(error?.message || error || "unknown"),
    clearModelCaches: () => {},
    renderMediaPane: async () => { calls.refresh++; },
    refreshMediaAvailability: async () => {},
    scheduleBadgeRefresh: () => {},
    openViewerById: async () => { calls.viewer++; },
  };
  const upload = vm.runInNewContext(`${uploadSource}\nuploadSelectedGlb`, context);
  return { upload, state, input, alerts, calls, context };
}

test("product switched while file chooser is open never uploads to stale product", async () => {
  const qa = harness(async () => ({ data: { ok: true } }), 124);
  await qa.upload();
  assert.equal(qa.calls.invoke, 0);
  assert.match(qa.alerts[0], /登録は開始していません/);
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

test("successful upload remains successful when preview update fails", async () => {
  const qa = harness(async () => ({ data: { ok: true, model_id: "new-model" } }));
  qa.context.openViewerById = async () => { throw new Error("preview offline"); };
  await qa.upload();
  assert.equal(qa.calls.invoke, 1);
  assert.equal(qa.calls.refresh, 1);
  assert.match(qa.alerts[0], /GLBは登録されましたが、プレビューを更新できませんでした/);
  assert.doesNotMatch(qa.alerts[0], /登録に失敗しました/);
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
