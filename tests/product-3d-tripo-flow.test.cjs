const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "product-3d.js"), "utf8");
const start = source.indexOf("  function sameTripoTarget(");
const end = source.indexOf("  function selectGlbForUpload(", start);
assert.ok(start >= 0 && end > start, "Tripo UI flow must remain testable");

function harness({ balance = 100, confirmed = true, failStart = false } = {}) {
  const events = [];
  const prompts = [];
  const controls = ["start", "poll", "preview", "publish", "reject"]
    .reduce((all, key) => { all[`product-3d-tripo-${key}`] = { hidden: false }; return all; }, {});
  const selections = [
    { dataset: { tripoView: "front" }, value: "11" },
    { dataset: { tripoView: "left" }, value: "12" },
    { dataset: { tripoView: "back" }, value: "" },
    { dataset: { tripoView: "right" }, value: "" },
  ];
  const context = {
    tripoTarget: { context: "sales", productId: 101, kind: "rebuilt" },
    tripoJob: null, tripoBusy: false, tripoHistoryReady: true, tripoRequestId: 1, tripoReturnFocus: null,
    tripoImageRows: { "11": { id: 11 }, "12": { id: 12 } }, tripoImagePreviewRequestId: 0,
    sessionModelsEnabled: true, crypto: { randomUUID: () => "00000000-0000-4000-8000-000000000001" },
    elements: {
      ...controls,
      "product-3d-tripo-status": { textContent: "" },
      "product-3d-tripo-views": { querySelectorAll: () => selections },
    },
    selectedTarget: () => ({ product: { id: 101 }, kind: "rebuilt" }),
    productId: (product) => product.id,
    productTitle: (product) => "商品ID " + product.id,
    kindLabel: (kind) => kind === "aftermarket_new" ? "新品" : "リビルト",
    canManageGlb: () => true,
    canPublish3D: () => true,
    friendlyError: (error) => String(error.message || error),
    signProductImageUrl: async () => "https://example.invalid/signed-original",
    edgeErrorMessage: async () => "uncertain",
    window: { confirm: (message) => { prompts.push(message); return confirmed; } },
    sb: { functions: { async invoke(_name, request) {
      events.push(request.body.action);
      if (request.body.action === "quote") return { data: {
        can_start: balance >= 30, balance, estimated_credits: 30,
      }, error: null };
      if (failStart) return { data: null, error: new Error("lost response") };
      assert.equal(request.body.confirm_paid_generation, true);
      assert.equal(request.body.accepted_estimate_credits, 30);
      assert.deepEqual(JSON.parse(JSON.stringify(request.body.images)), [
        { view: "front", id: 11 }, { view: "left", id: 12 },
      ]);
      return { data: { request_key: request.body.request_key, status: "submitted" }, error: null };
    } } },
    Set, Array, Number, String, Error,
  };
  const api = vm.runInNewContext(`${source.slice(start, end)}\n({ selectedTripoImages, startTripo, pollTripo, publishTripo, tripoInvoke, renderTripoJob, keepTripoFocus, closeTripo, tripoContextLabel, tripoImageLabel, tripoPayload, showTripoImagePreview, clearTripoImagePreview })`, context);
  return { api, context, events, prompts, selections };
}

test("saved-image transfer is disclosed before any paid submission", async () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.match(html, /選択した保存済み画像は、3D作成のため外部サービスTripoへ送信されます。/);
  const qa = harness({ confirmed: false });
  await qa.api.startTripo();
  assert.deepEqual(qa.events, ["quote"]);
  assert.equal(qa.prompts.length, 1);
  assert.match(qa.prompts[0], /保存済み画像を外部サービスTripoへ送信/);
  assert.match(qa.prompts[0], /見積り 30 クレジット/);
});

test("the shared Viewer appears above the Tripo selection dialog", () => {
  const css = fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");
  const tripoLayer = Number(css.match(/\.product-3d-tripo-overlay\s*\{[^}]*z-index:\s*(\d+)/)[1]);
  const viewerLayer = Number(css.match(/(?:^|\n)\.product-3d-viewer-overlay\s*\{[^}]*z-index:\s*(\d+)/)[1]);
  assert.ok(viewerLayer > tripoLayer);
});

function previewHarness() {
  const qa = harness();
  qa.context.tripoJob = { request_key: "00000000-0000-4000-8000-000000000001", status: "review" };
  qa.context.viewerRequestId = 4;
  qa.context.showCommonViewer = async (...args) => { qa.opened = args; };
  qa.context.closeViewer = () => { qa.closed = true; };
  qa.context.sb.functions.invoke = async () => ({ data: {
    ...qa.context.tripoJob, preview_url: "https://example.invalid/private.glb",
  }, error: null });
  qa.preview = vm.runInNewContext(source.slice(source.indexOf("  async function previewTripo("),
    source.indexOf("  async function publishTripo(")) + "\npreviewTripo", qa.context);
  return qa;
}

test("Tripo review reuses the local and registered GLB common Viewer entrypoint", async () => {
  const qa = previewHarness();
  await qa.preview();
  const [options, title, target, requestId, current] = qa.opened;
  assert.equal(options.url, "https://example.invalid/private.glb");
  assert.equal(title, "Tripo生成結果 / 非公開プレビュー");
  assert.deepEqual(JSON.parse(JSON.stringify(target)), { context: "sales", productId: 101, kind: "rebuilt" });
  assert.equal(requestId, 5); assert.equal(current(), true); assert.equal(qa.context.tripoBusy, false);
  assert.equal(qa.opened[5], qa.context.elements['product-3d-tripo-preview']);
  assert.equal((source.match(/await import\("\.\/product-3d-viewer\.js\?v=/g) || []).length, 1);
  assert.doesNotMatch(source, /function getViewerModule\(/);
});

test("late Tripo preview response after product, account or role switch cannot open Viewer", async () => {
  for (const change of [q => { q.context.selectedTarget = () => ({product:{id:102},kind:'rebuilt'}); },
    q => { q.context.sessionModelsEnabled = false; }, q => { q.context.canManageGlb = () => false; }]) {
    const qa = previewHarness(); let finish;
    qa.context.sb.functions.invoke = () => new Promise(resolve => { finish = resolve; });
    const pending = qa.preview(); change(qa);
    finish({ data: { ...qa.context.tripoJob, preview_url: "https://example.invalid/private.glb" } });
    await pending;
    assert.equal(qa.opened, undefined); assert.equal(qa.context.tripoBusy, false);
  }
});

test("Tripo common Viewer predicate invalidates loading on close, product switch or sign-out", async () => {
  for (const change of [q => { q.context.viewerRequestId++; },
    q => { q.context.selectedTarget = () => ({product:{id:102},kind:'rebuilt'}); },
    q => { q.context.sessionModelsEnabled = false; }]) {
    const qa = previewHarness(); await qa.preview();
    change(qa); assert.equal(qa.opened[4](), false);
  }
});

test("failed Tripo preview leaves review state and does not submit or publish again", async () => {
  const qa = previewHarness(); const actions = [];
  qa.context.sb.functions.invoke = async (_name, options) => {
    actions.push(options.body.action); return {error:new Error('unavailable')};
  };
  await qa.preview();
  assert.deepEqual(actions, ['preview']); assert.equal(qa.opened, undefined);
  assert.equal(qa.context.tripoJob.status, 'review');
  assert.match(qa.context.elements['product-3d-tripo-status'].textContent, /プレビューできませんでした/);
});

test("the Tripo dialog uses product identity without the third-party DAIKO number", () => {
  const qa = harness();
  const label = qa.api.tripoContextLabel({ id: 2639, manufacturer_part_number: "104210-1870",
    daiko_part_number: "ALDK30220", genuine_part_number: "27060-30220" },
    { productId: 2639, kind: "aftermarket_new" });
  assert.equal(label, "商品ID 2639 / 新品");
  qa.context.tripoTarget = { context: "sales", productId: 2639, kind: "aftermarket_new" };
  assert.deepEqual(JSON.parse(JSON.stringify(qa.api.tripoPayload("quote"))), {
    action: "quote", product_id: 2639, product_kind: "aftermarket_new", request_key: null,
  });
});

test("capture and Viewer titles fall back to product ID, never the DAIKO number", () => {
  const titleStart = source.indexOf("  function productTitle(");
  const titleEnd = source.indexOf("  function closeImageActionOverlays(", titleStart);
  assert.ok(titleStart >= 0 && titleEnd > titleStart);
  const title = vm.runInNewContext(`${source.slice(titleStart, titleEnd)}\nproductTitle`, {
    productId: (product) => product.id, String, Number,
  });
  assert.equal(title({ id: 2639, manufacturer_part_number: "104210-1870",
    daiko_part_number: "ALDK30220" }), "商品ID 2639 / メーカー品番 104210-1870");
  assert.equal(title({ id: 2639, daiko_part_number: "ALDK30220" }), "商品ID 2639");
});

test("saved images with equal sort order show the newest registration date first", () => {
  const qa = harness();
  assert.match(source, /\.order\("sort_order", \{ ascending: true \}\)\s*\.order\("created_at", \{ ascending: false \}\)\.order\("id", \{ ascending: false \}\)/);
  assert.equal(qa.api.tripoImageLabel({ id: 183, created_at: "2026-09-01T00:00:00Z" }, 0),
    "画像 1 / ID 183（2026/9/1）");
  assert.equal(qa.api.tripoImageLabel({ id: 182, created_at: "not-a-date" }, 1), "画像 2 / ID 182");
});

test("saved-image preview displays the signed thumbnail, then the original only on request", async () => {
  const qa = harness();
  const preview = { hidden: true };
  const image = { src: "", alt: "", removeAttribute(name) { if (name === "src") this.src = ""; } };
  const label = { textContent: "" };
  qa.context.elements["product-3d-tripo-image-preview"] = preview;
  qa.context.elements["product-3d-tripo-image-preview-img"] = image;
  qa.context.elements["product-3d-tripo-image-preview-label"] = label;
  qa.context.tripoImageRows["183"] = { id: 183, storage_path: "2639/photo.jpg" };
  const paths = [];
  qa.context.signProductImageUrl = async (path) => {
    paths.push(path);
    return "https://example.invalid/signed-original";
  };
  const button = { dataset: { tripoLabel: "画像 1 / ID 183（2026/9/1）", tripoImagePreview: "183" },
    getAttribute: () => "画像 1 / ID 183を拡大表示",
    querySelector: () => ({ getAttribute: () => "https://example.invalid/signed-thumbnail" }) };
  const pending = qa.api.showTripoImagePreview(button);
  assert.equal(preview.hidden, false);
  assert.equal(image.src, "https://example.invalid/signed-thumbnail");
  await pending;
  assert.deepEqual(paths, ["2639/photo.jpg"]);
  assert.equal(image.src, "https://example.invalid/signed-original");
  assert.equal(label.textContent, button.dataset.tripoLabel);
  assert.deepEqual(qa.events, []);
  qa.api.clearTripoImagePreview();
  assert.equal(preview.hidden, true);
  assert.equal(image.src, "");
  assert.equal(label.textContent, "");
});

test("closing the image preview rejects a late original image URL", async () => {
  const qa = harness();
  const preview = { hidden: true };
  const image = { src: "", removeAttribute(name) { if (name === "src") this.src = ""; } };
  qa.context.elements["product-3d-tripo-image-preview"] = preview;
  qa.context.elements["product-3d-tripo-image-preview-img"] = image;
  qa.context.elements["product-3d-tripo-image-preview-label"] = { textContent: "" };
  qa.context.tripoImageRows["183"] = { storage_path: "2639/photo.jpg" };
  let finishSigning;
  qa.context.signProductImageUrl = () => new Promise((resolve) => { finishSigning = resolve; });
  const button = { dataset: { tripoLabel: "画像 1", tripoImagePreview: "183" },
    getAttribute: () => "画像 1を拡大表示",
    querySelector: () => ({ getAttribute: () => "https://example.invalid/signed-thumbnail" }) };
  const pending = qa.api.showTripoImagePreview(button);
  qa.api.clearTripoImagePreview();
  finishSigning("https://example.invalid/signed-original");
  await pending;
  assert.equal(preview.hidden, true);
  assert.equal(image.src, "");
});

test("keyboard focus stays in the Tripo dialog unless the Viewer is above it", () => {
  const qa = harness();
  const controls = Array.from({ length: 3 }, () => ({
    isConnected: true, hidden: false, disabled: false, getClientRects: () => [{}],
    focus() { qa.context.document.activeElement = this; },
  }));
  let viewerOpen = false;
  qa.context.document = { activeElement: controls[2] };
  qa.context.elements["product-3d-tripo-overlay"] = {
    classList: { contains: () => true }, querySelectorAll: () => controls,
  };
  qa.context.elements["product-3d-viewer-overlay"] = {
    classList: { contains: () => viewerOpen },
  };
  const event = { key: "Tab", shiftKey: false, prevented: false,
    preventDefault() { this.prevented = true; } };
  qa.api.keepTripoFocus(event);
  assert.equal(qa.context.document.activeElement, controls[0]);
  assert.equal(event.prevented, true);
  event.shiftKey = true;
  qa.api.keepTripoFocus(event);
  assert.equal(qa.context.document.activeElement, controls[2]);
  viewerOpen = true;
  qa.api.keepTripoFocus(event);
  assert.equal(qa.context.document.activeElement, controls[2]);
});

test("closing restores focus only while the same product and account remain active", () => {
  for (const stale of [false, true]) {
    const qa = harness();
    let focused = false;
    const trigger = { isConnected: true, disabled: false, getClientRects: () => [{}],
      focus() { focused = true; } };
    qa.context.tripoReturnFocus = trigger;
    qa.context.selectedTarget = () => ({ product: { id: stale ? 102 : 101 }, kind: "rebuilt" });
    qa.context.document = { getElementById: () => null };
    qa.context.elements["product-3d-tripo-overlay"] = {
      classList: { contains: () => true, remove() {} }, setAttribute() {},
    };
    qa.api.closeTripo();
    assert.equal(focused, !stale);
    assert.equal(qa.context.tripoTarget, null);
  }
});

test("invalid or repeated image choices never call a paid endpoint", async () => {
  const qa = harness();
  qa.selections[1].value = "11";
  await qa.api.startTripo();
  assert.deepEqual(qa.events, []);
  assert.match(qa.context.elements["product-3d-tripo-status"].textContent, /重複/);
});

test("low balance or declined confirmation never calls start", async () => {
  const low = harness({ balance: 20 });
  await low.api.startTripo();
  assert.deepEqual(low.events, ["quote"]);
  const declined = harness({ confirmed: false });
  await declined.api.startTripo();
  assert.deepEqual(declined.events, ["quote"]);
});

test("one explicit confirmation submits exactly once and preserves uncertain state", async () => {
  const happy = harness();
  await happy.api.startTripo();
  assert.deepEqual(happy.events, ["quote", "start"]);
  assert.equal(happy.context.tripoJob.status, "submitted");
  assert.equal(happy.context.elements["product-3d-tripo-start"].hidden, true);
  const lost = harness({ failStart: true });
  await lost.api.startTripo();
  assert.deepEqual(lost.events, ["quote", "start"]);
  assert.equal(lost.context.tripoJob.status, "reserved");
  assert.match(lost.context.elements["product-3d-tripo-status"].textContent, /再実行せず/);
  await happy.api.startTripo();
  await lost.api.startTripo();
  assert.deepEqual(happy.events, ["quote", "start"]);
  assert.deepEqual(lost.events, ["quote", "start"]);
});

test("unchecked history, collection, publication and held states never offer another paid start", async () => {
  const qa = harness();
  qa.context.tripoHistoryReady = false;
  qa.api.renderTripoJob();
  assert.equal(qa.context.elements["product-3d-tripo-start"].hidden, true);
  await qa.api.startTripo();
  assert.deepEqual(qa.events, []);
  qa.context.tripoHistoryReady = true;
  for (const status of ["reserved", "submitted", "processing", "collecting", "publishing", "held"]) {
    qa.context.tripoJob = { request_key: "existing", status };
    qa.api.renderTripoJob();
    assert.equal(qa.context.elements["product-3d-tripo-start"].hidden, true);
    assert.equal(qa.context.elements["product-3d-tripo-poll"].hidden, false);
    assert.equal(qa.context.elements["product-3d-tripo-publish"].hidden, true);
    await qa.api.startTripo();
  }
  assert.deepEqual(qa.events, []);
});

test("system-admin permission and the selected product gate every Tripo action", async () => {
  for (const change of [qa => { qa.context.canManageGlb = () => false; },
    qa => { qa.context.selectedTarget = () => ({ product: { id: 102 }, kind: "rebuilt" }); },
    qa => { qa.context.sessionModelsEnabled = false; }]) {
    const qa = harness();
    change(qa);
    await qa.api.startTripo();
    qa.context.tripoJob = { status: "review", request_key: "existing" };
    await qa.api.pollTripo();
    await qa.api.publishTripo();
    assert.deepEqual(qa.events, []);
  }
});

test("malformed credit quotes never reach confirmation or paid start", async () => {
  for (const quote of [{ can_start: true, balance: "100", estimated_credits: 30 },
    { can_start: true, balance: 100, estimated_credits: 0 },
    { can_start: true, balance: 100, estimated_credits: 101 },
    { can_start: "true", balance: 100, estimated_credits: 30 }]) {
    const qa = harness();
    qa.context.sb.functions.invoke = async () => ({ data: quote });
    await qa.api.startTripo();
    assert.equal(qa.prompts.length, 0);
    assert.equal(qa.context.tripoJob, null);
  }
});

test("uncertain publication remains blocked until read-only reconciliation", async () => {
  const qa = harness();
  qa.context.tripoJob = { status: "review", request_key: "existing" };
  qa.context.sb.from = () => ({ select() { return this; }, eq() { return this; },
    async maybeSingle() { return { data: null, error: null }; } });
  qa.context.sb.functions.invoke = async (_name, options) => {
    qa.events.push(options.body.action);
    return { error: new Error("lost response") };
  };
  await qa.api.publishTripo();
  assert.equal(qa.context.tripoJob.status, "publishing");
  assert.equal(qa.context.elements["product-3d-tripo-publish"].hidden, true);
  await qa.api.publishTripo();
  assert.deepEqual(qa.events, ["publish"]);
});

test("invalid job history or a response for another request is never accepted", async () => {
  for (const data of [{}, { status: "unexpected" }, { status: "review", request_key: "not-a-uuid" }]) {
    const qa = harness();
    qa.context.sb.functions.invoke = async () => ({ data });
    await assert.rejects(() => qa.api.tripoInvoke({ action: "latest" }), /Invalid generation state/);
  }
  const qa = harness();
  qa.context.sb.functions.invoke = async () => ({ data: {
    status: "submitted", request_key: "00000000-0000-4000-8000-000000000002",
  } });
  await assert.rejects(() => qa.api.tripoInvoke({ action: "poll",
    request_key: "00000000-0000-4000-8000-000000000001" }), /Invalid generation state/);
});

test("invalid start acknowledgement preserves the local reservation and blocks a second start", async () => {
  const qa = harness();
  qa.context.sb.functions.invoke = async (_name, options) => {
    qa.events.push(options.body.action);
    return { data: options.body.action === "quote"
      ? { can_start: true, balance: 100, estimated_credits: 30 } : {} };
  };
  await qa.api.startTripo();
  assert.equal(qa.context.tripoJob.status, "reserved");
  await qa.api.startTripo();
  assert.deepEqual(qa.events, ["quote", "start"]);
});
