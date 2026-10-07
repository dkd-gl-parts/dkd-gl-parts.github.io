const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "product-3d.js"), "utf8");
const start = source.indexOf("  function sameTripoTarget(");
const end = source.indexOf("  function selectGlbForUpload(", start);
assert.ok(start >= 0 && end > start, "Tripo UI flow must remain testable");

function harness({ balance = 100, confirmed = true, failStart = false, quoteKey, canStart, blockedReason } = {}) {
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
    preparedInputsController: null,
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
    clearViewerComparison: () => {},
    canPublish3D: () => true,
    friendlyError: (error) => String(error.message || error),
    signProductImageUrl: async () => "https://example.invalid/signed-original",
    edgeErrorMessage: async () => "uncertain",
    window: { confirm: (message) => { prompts.push(message); return confirmed; } },
    sb: { functions: { async invoke(_name, request) {
      events.push(request.body.action);
      if (request.body.action === "quote") return { data: {
        can_start: canStart == null ? balance >= 30 : canStart, balance, estimated_credits: 30,
        ...(quoteKey == null ? {} : { request_key: quoteKey }), start_blocked_reason: blockedReason,
      }, error: null };
      if (failStart) return { data: null, error: new Error("lost response") };
      assert.equal(request.body.confirm_paid_generation, true);
      assert.equal(request.body.accepted_estimate_credits, 30);
      assert.equal(request.body.request_key, quoteKey || "00000000-0000-4000-8000-000000000001");
      assert.deepEqual(JSON.parse(JSON.stringify(request.body.images)), [
        { view: "front", id: 11 }, { view: "left", id: 12 },
      ]);
      return { data: { request_key: request.body.request_key, status: "submitted" }, error: null };
    } } },
    Set, Array, Number, String, Error,
  };
  const api = vm.runInNewContext(`${source.slice(start, end)}\n({ selectedTripoImages, startTripo, pollTripo, publishTripo, tripoInvoke, openTripo, renderTripoJob, keepTripoFocus, closeTripo, tripoContextLabel, tripoImageLabel, tripoPayload, showTripoImagePreview, clearTripoImagePreview, assignTripoImage, renderTripoSelection, changeTripoKind, sameTripoTarget })`, context);
  return { api, context, events, prompts, selections };
}

function preparationHarness({ status = 503, message = "Tripo generation is not configured", rows } = {}) {
  const qa = harness();
  const ctx = qa.context;
  ctx.document = { activeElement: null };
  ctx.closeImageActionOverlays = () => {};
  ctx.esc = String;
  ctx.deny3D = () => { qa.denied = true; };
  ctx.elements["product-3d-tripo-overlay"] = { classList: { add() {} }, setAttribute() {} };
  ctx.elements["product-3d-tripo-close"] = { focus() {} };
  ctx.elements["product-3d-tripo-context"] = { textContent: "" };
  ctx.elements["product-3d-tripo-images"] = { textContent: "", innerHTML: "", querySelector: () => null, querySelectorAll: () => [] };
  ctx.elements["product-3d-tripo-kind"] = { value: "rebuilt", focus() {} };
  ctx.elements["product-3d-tripo-selection"] = { innerHTML: "" };
  ctx.elements["product-3d-tripo-selection-status"] = { textContent: "" };
  ctx.elements["product-3d-tripo-image-directions"] = { innerHTML: "", textContent: "", querySelectorAll: () => [] };
  ctx.elements["product-3d-tripo-views"].innerHTML = "";
  ctx.sb.from = () => {
    const query = { select() { return query; }, eq() { return query; }, not() { return query; },
      order() { return query; }, async limit() { return { data: rows || [
        { id: 11, storage_path: "synthetic/front.jpg" }, { id: 12, storage_path: "synthetic/left.jpg" },
      ] }; } };
    return query;
  };
  ctx.edgeErrorMessage = async (error) => error.message;
  ctx.sb.functions.invoke = async (_name, options) => {
    qa.events.push(options.body.action);
    return { error: { message, context: { status } } };
  };
  return qa;
}

test("explicit disabled generation keeps the image preparation screen usable without mutations", async () => {
  const qa = preparationHarness();
  await qa.api.openTripo("sales");
  assert.match(qa.context.elements["product-3d-tripo-images"].innerHTML, /data-tripo-image-preview='11'/);
  assert.equal(qa.selections.length, 4);
  assert.ok(qa.selections.every(node => !node.disabled && node.innerHTML.includes("value='11'")));
  assert.match(qa.context.elements["product-3d-tripo-status"].textContent, /方向選択ができます.*まだ無効.*課金/);
  qa.selections[0].value = "11";
  qa.selections[1].value = "12";
  assert.equal(qa.api.selectedTripoImages().length, 2);
  assert.equal(qa.context.tripoHistoryReady, false);
  for (const action of ["start", "poll", "preview", "publish", "reject"])
    assert.equal(qa.context.elements[`product-3d-tripo-${action}`].hidden, true);
  await qa.api.startTripo();
  await qa.api.publishTripo();
  assert.deepEqual(qa.events, ["latest"]);
  assert.deepEqual(qa.prompts, []);
});

test("server pilot quote key is used once and malformed keys stop before confirmation", async () => {
  const qa = harness({ quoteKey: "9e98c930-17c7-4198-b85e-5ca29fcba3f6" });
  await qa.api.startTripo();
  await qa.api.startTripo();
  assert.deepEqual(qa.events, ["quote", "start"]);
  assert.equal(qa.context.tripoJob.request_key, "9e98c930-17c7-4198-b85e-5ca29fcba3f6");
  for (const quoteKey of ["bad", 123, {}, "javascript:alert(1)"]) {
    const invalid = harness({ quoteKey });
    await invalid.api.startTripo();
    assert.deepEqual(invalid.events, ["quote"]);
    assert.deepEqual(invalid.prompts, []);
  }
});
test("pilot terminal states never rearm start and private review hides publication controls", async () => {
  const qa = harness();
  for (const status of ["failed", "cancelled", "rejected", "published", "review"]) {
    qa.context.tripoJob = { status, start_allowed: false, publish_allowed: false, reject_allowed: false };
    qa.api.renderTripoJob();
    for (const action of ["start", "publish", "reject"]) assert.equal(qa.context.elements[`product-3d-tripo-${action}`].hidden, true);
    await qa.api.startTripo(); await qa.api.publishTripo();
  }
  assert.deepEqual(qa.events, []);
  assert.deepEqual(qa.prompts, []);
});
test("already-reserved pilot quote explains single use, not low balance", async () => {
  const qa = harness({ canStart: false, blockedReason: "pilot_already_reserved" });
  await qa.api.startTripo();
  assert.match(qa.context.elements["product-3d-tripo-status"].textContent, /初回1回.*再作成せず/);
  assert.deepEqual(qa.events, ["quote"]);
  assert.deepEqual(qa.prompts, []);
});

test("auth, network, malformed and unrelated 503 failures are not disabled-generation notices", async () => {
  for (const [status, message] of [[401, "Tripo generation is not configured"],
    [403, "Forbidden"], [503, "Service unavailable"], [undefined, "network error"], [503, "Invalid JSON"]]) {
    const qa = preparationHarness({ status, message });
    await qa.api.openTripo("sales");
    assert.match(qa.context.elements["product-3d-tripo-status"].textContent, /画像または作成履歴を確認できませんでした/);
    assert.equal(qa.context.tripoHistoryReady, false);
    assert.equal(qa.context.elements["product-3d-tripo-start"].hidden, true);
    assert.equal(qa.context.elements["product-3d-tripo-publish"].hidden, true);
  }
});

test("late disabled response cannot update a different product, role or session", async () => {
  for (const change of [ctx => { ctx.selectedTarget = () => ({ product: { id: 102 }, kind: "rebuilt" }); },
    ctx => { ctx.canManageGlb = () => false; }, ctx => { ctx.sessionModelsEnabled = false; }]) {
    const qa = preparationHarness();
    let finish;
    qa.context.sb.functions.invoke = (_name, options) => {
      qa.events.push(options.body.action);
      return new Promise(resolve => { finish = resolve; });
    };
    const pending = qa.api.openTripo("sales");
    await new Promise(resolve => setImmediate(resolve));
    change(qa.context);
    finish({ error: { message: "Tripo generation is not configured", context: { status: 503 } } });
    await pending;
    assert.equal(qa.context.elements["product-3d-tripo-status"].textContent, "確認中…");
    assert.equal(qa.context.tripoHistoryReady, false);
    assert.deepEqual(qa.events, ["latest"]);
  }
});

test("no saved photos directs users to existing photo registration without paid generation", async () => {
  const qa = preparationHarness({ rows: [] });
  await qa.api.openTripo("sales");
  assert.match(qa.context.elements["product-3d-tripo-images"].innerHTML, /先に商品画像を登録してください/);
  assert.ok(qa.selections.every(node => node.disabled && node.innerHTML.includes("保存済み画像なし")));
  assert.doesNotMatch(qa.context.elements["product-3d-tripo-status"].textContent, /方向選択ができます/);
  await qa.api.startTripo();
  assert.deepEqual(qa.events, ["latest"]);
});

test("four selection controls exist above photos even before any image response", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const choices = html.slice(html.indexOf('id="product-3d-tripo-views"'), html.indexOf('id="product-3d-tripo-images"'));
  for (const view of ["front", "left", "back", "right"])
    assert.match(choices, new RegExp(`data-tripo-view="${view}" disabled`));
  assert.match(choices, /保存済み画像を読み込んでいます…/);
  assert.ok(html.indexOf('id="product-3d-tripo-views"') < html.indexOf('id="product-3d-tripo-image-preview"'));
});

test("pending image query shows loading controls and cannot send or publish", async () => {
  const qa = preparationHarness();
  let finish;
  qa.context.sb.from = () => {
    const query = { select() { return query; }, eq() { return query; }, not() { return query; },
      order() { return query; }, limit() { return new Promise(resolve => { finish = resolve; }); } };
    return query;
  };
  const pending = qa.api.openTripo("sales");
  assert.ok(qa.selections.every(node => node.disabled && node.value === "" && node.innerHTML.includes("読み込んでいます")));
  await qa.api.startTripo();
  await qa.api.publishTripo();
  assert.deepEqual(qa.events, []);
  finish({ data: [{ id: 11, storage_path: "synthetic/front.jpg" }] });
  await pending;
  assert.ok(qa.selections.every(node => !node.disabled && node.innerHTML.includes("value='11'")));
  assert.deepEqual(qa.events, ["latest"]);
});

test("image query failure retains four controls with a reason and never reads generation history", async () => {
  const qa = preparationHarness();
  qa.context.sb.from = () => {
    const query = { select() { return query; }, eq() { return query; }, not() { return query; },
      order() { return query; }, async limit() { return { error: new Error("synthetic image query rejected") }; } };
    return query;
  };
  await qa.api.openTripo("sales");
  assert.ok(qa.selections.every(node => node.disabled && node.innerHTML.includes("画像を読み込めませんでした")));
  assert.match(qa.context.elements["product-3d-tripo-images"].textContent, /対象商品・区分とログイン状態/);
  assert.doesNotMatch(qa.context.elements["product-3d-tripo-status"].textContent, /方向選択ができます/);
  await qa.api.startTripo();
  await qa.api.publishTripo();
  assert.deepEqual(qa.events, []);
});

test("stale image response does not enable choices for a changed account or product", async () => {
  const qa = preparationHarness();
  let finish;
  qa.context.sb.from = () => {
    const query = { select() { return query; }, eq() { return query; }, not() { return query; },
      order() { return query; }, limit() { return new Promise(resolve => { finish = resolve; }); } };
    return query;
  };
  const pending = qa.api.openTripo("sales");
  qa.context.selectedTarget = () => ({ product: { id: 102 }, kind: "rebuilt" });
  finish({ data: [{ id: 11, storage_path: "synthetic/front.jpg" }] });
  await pending;
  assert.ok(qa.selections.every(node => node.disabled && node.value === ""));
  assert.deepEqual(qa.events, []);
});

test("customer and non-admin accounts cannot open the image preparation dialog", async () => {
  const customer = preparationHarness();
  await customer.api.openTripo("customer");
  assert.deepEqual(customer.events, []);
  const sales = preparationHarness();
  sales.context.canManageGlb = () => false;
  await sales.api.openTripo("sales");
  assert.equal(sales.denied, true);
  assert.deepEqual(sales.events, []);
});

test("photo direction assignment updates all four previews and moves a reused photo", async () => {
  const qa = preparationHarness();
  await qa.api.openTripo("sales");
  assert.equal(qa.api.assignTripoImage("front", "11"), true);
  assert.equal(qa.api.assignTripoImage("back", "12"), true);
  const html = qa.context.elements["product-3d-tripo-selection"].innerHTML;
  assert.match(html, /data-tripo-selected-view='front'[\s\S]*signed-original/);
  assert.match(html, /data-tripo-selected-view='back'[\s\S]*画像 2/);
  assert.match(qa.context.elements["product-3d-tripo-selection-status"].textContent, /選択済み 2.*未選択: 左側・右側/);
  assert.equal(qa.api.assignTripoImage("right", "11"), true);
  assert.equal(qa.selections[0].value, "");
  assert.equal(qa.selections[3].value, "11");
  assert.match(qa.context.elements["product-3d-tripo-selection-status"].textContent, /複数枚では正面/);
  assert.equal(qa.api.assignTripoImage("right", ""), true);
  assert.equal(qa.selections[3].value, "");
  assert.deepEqual(qa.events, ["latest"]);
});

test("unknown photos, invalid directions, busy and stale permissions cannot alter assignments", async () => {
  for (const mutate of [q => { q.context.tripoBusy = true; },
    q => { q.context.canManageGlb = () => false; }, q => { q.context.sessionModelsEnabled = false; },
    q => { q.context.selectedTarget = () => ({ product:{id:102},kind:"rebuilt" }); }]) {
    const qa = preparationHarness(); await qa.api.openTripo("sales");
    assert.equal(qa.api.assignTripoImage("other", "11"), false);
    assert.equal(qa.api.assignTripoImage("front", "999"), false);
    mutate(qa);
    assert.equal(qa.api.assignTripoImage("front", "11"), false);
    assert.ok(qa.selections.every(node => node.value === ""));
    assert.deepEqual(qa.events, ["latest"]);
  }
});

test("dialog kind changes reload that kind, clear assignments and keep outer product unchanged", async () => {
  const qa = preparationHarness();
  const queries = [], requests = [];
  qa.context.sb.from = () => {
    let kind;
    const query = { select(){return query;},eq(key,value){if(key==="product_kind")kind=value;return query;},
      not(){return query;},order(){return query;},async limit(){queries.push(kind);return {data:[{id:kind==="rebuilt"?11:21,storage_path:kind+".jpg"}]};}};
    return query;
  };
  qa.context.sb.functions.invoke = async (_name, options) => { requests.push(options.body); return {data:{status:"none"}}; };
  await qa.api.openTripo("sales");
  qa.api.assignTripoImage("front", "11");
  qa.context.elements["product-3d-tripo-kind"].value = "aftermarket_new";
  await qa.api.changeTripoKind();
  assert.deepEqual(queries, ["rebuilt","aftermarket_new"]);
  assert.deepEqual(requests.map(r=>r.product_kind), ["rebuilt","aftermarket_new"]);
  assert.ok(requests.every(r=>r.action==="latest" && r.product_id===101));
  assert.ok(qa.selections.every(node=>node.value===""));
  assert.deepEqual(Object.keys(qa.context.tripoImageRows), ["21"]);
  assert.equal(qa.context.tripoTarget.originKind, "rebuilt");
  assert.equal(qa.context.tripoTarget.kind, "aftermarket_new");
  assert.equal(qa.context.selectedTarget().kind, "rebuilt");
  assert.equal(qa.api.sameTripoTarget(qa.context.tripoRequestId), true);
  qa.context.selectedTarget = () => ({product:{id:101},kind:"aftermarket_new"});
  assert.equal(qa.api.sameTripoTarget(qa.context.tripoRequestId), false);
});

test("late old-kind photos cannot overwrite the freshly selected kind", async () => {
  const qa = preparationHarness(); const pendingQueries=[];
  qa.context.sb.from = () => {
    let kind;
    const query = { select(){return query;},eq(key,value){if(key==="product_kind")kind=value;return query;},
      not(){return query;},order(){return query;},limit(){return new Promise(resolve=>pendingQueries.push({kind,resolve}));}};
    return query;
  };
  const old = qa.api.openTripo("sales");
  qa.context.elements["product-3d-tripo-kind"].value="aftermarket_new";
  const fresh = qa.api.changeTripoKind();
  pendingQueries[1].resolve({data:[{id:21,storage_path:"new.jpg"}]}); await fresh;
  qa.api.assignTripoImage("front","21");
  pendingQueries[0].resolve({data:[{id:11,storage_path:"old.jpg"}]}); await old;
  assert.equal(qa.selections[0].value,"21");
  assert.deepEqual(Object.keys(qa.context.tripoImageRows),["21"]);
  assert.doesNotMatch(qa.context.elements["product-3d-tripo-images"].innerHTML,/data-tripo-image-preview='11'/);
  assert.deepEqual(qa.events,["latest"]);
});

test("late old-kind history cannot authorize the new kind", async () => {
  const qa = preparationHarness(); const histories=[];
  qa.context.sb.functions.invoke = (_name,options) => new Promise(resolve=>histories.push({kind:options.body.product_kind,resolve}));
  const old = qa.api.openTripo("sales"); await new Promise(setImmediate);
  qa.context.elements["product-3d-tripo-kind"].value="aftermarket_new";
  const fresh=qa.api.changeTripoKind(); await new Promise(setImmediate);
  histories[0].resolve({data:{status:"none"}}); await old;
  assert.equal(qa.context.tripoHistoryReady,false);
  histories[1].resolve({error:{message:"Tripo generation is not configured",context:{status:503}}}); await fresh;
  assert.equal(qa.context.tripoHistoryReady,false);
  assert.equal(qa.context.tripoTarget.kind,"aftermarket_new");
  await qa.api.startTripo(); assert.equal(histories.length,2);
});

test("kind switching never drops busy or uncertain generation state", async () => {
  for(const status of ["reserved","submitted","processing","collecting","publishing","held"]) {
    const qa=preparationHarness(); await qa.api.openTripo("sales");
    qa.context.tripoJob={status,request_key:"00000000-0000-4000-8000-000000000001"};
    qa.context.elements["product-3d-tripo-kind"].value="aftermarket_new";
    await qa.api.changeTripoKind();
    assert.equal(qa.context.tripoJob.status,status);
    assert.equal(qa.context.tripoTarget.kind,"rebuilt");
    assert.equal(qa.context.elements["product-3d-tripo-kind"].value,"rebuilt");
    assert.deepEqual(qa.events,["latest"]);
  }
});

test("photo cards and enlarged preview have direction actions and accessible selected previews", () => {
  const html=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
  assert.match(html,/id="product-3d-tripo-kind"/);
  assert.match(html,/id="product-3d-tripo-selection" aria-label="方向別の選択プレビュー"/);
  assert.match(html,/id="product-3d-tripo-selection-status" role="status" aria-live="polite"/);
  assert.match(html,/id="product-3d-tripo-image-directions"/);
  assert.match(source,/tripoDirectionButtons\(row.id, false\)/);
  assert.match(source,/tripoDirectionButtons\(imageId, true\)/);
});

test("busy, invalid, changed-account or changed-product kind requests never reload photos", async () => {
  for (const mutate of [q=>{q.context.tripoBusy=true;},q=>{q.context.sessionModelsEnabled=false;},
    q=>{q.context.canManageGlb=()=>false;},q=>{q.context.selectedTarget=()=>({product:{id:102},kind:"rebuilt"});},
    q=>{q.context.elements["product-3d-tripo-kind"].value="other";}]) {
    const qa=preparationHarness();await qa.api.openTripo("sales");
    qa.context.elements["product-3d-tripo-kind"].value="aftermarket_new";mutate(qa);
    await qa.api.changeTripoKind();
    assert.equal(qa.context.tripoTarget.kind,"rebuilt");
    assert.deepEqual(qa.events,["latest"]);
  }
});

test("local dialog kind is sent to preview API while common Viewer focus keeps the outer kind", async () => {
  const qa=previewHarness();
  qa.context.tripoTarget={context:"sales",productId:101,kind:"aftermarket_new",originKind:"rebuilt"};
  const requests=[];
  qa.context.sb.functions.invoke=async(_name,options)=>{requests.push(options.body);return {data:{...qa.context.tripoJob,preview_url:"https://example.invalid/private.glb"}};};
  await qa.preview();
  assert.equal(requests[0].product_kind,"aftermarket_new");
  assert.equal(qa.opened[2].kind,"rebuilt");
  assert.equal(qa.opened[4](),true);
});

test("the screen explains preparation, private review and explicit product registration", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.match(html, /方向選択だけでは、Tripoへの送信やクレジット消費はありません/);
  assert.match(html, /選択内容はこの画面を閉じると解除されます/);
  assert.match(html, /完成したGLBを非公開でプレビュー/);
  assert.match(html, /問題がなければ「確認して商品へ登録」で公開/);
});

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
  qa.context.viewer = {};
  qa.context.prepareViewerComparison = (...args) => { qa.comparison = args; };
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
  assert.deepEqual(qa.comparison, [1, 5]);
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
