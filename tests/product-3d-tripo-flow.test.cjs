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
    tripoJob: null, tripoBusy: false, tripoRequestId: 1, tripoReturnFocus: null,
    sessionModelsEnabled: true, crypto: { randomUUID: () => "00000000-0000-4000-8000-000000000001" },
    elements: {
      ...controls,
      "product-3d-tripo-status": { textContent: "" },
      "product-3d-tripo-views": { querySelectorAll: () => selections },
    },
    selectedTarget: () => ({ product: { id: 101 }, kind: "rebuilt" }),
    productId: (product) => product.id,
    canManage3D: () => true,
    canPublish3D: () => true,
    friendlyError: (error) => String(error.message || error),
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
  const api = vm.runInNewContext(`${source.slice(start, end)}\n({ selectedTripoImages, startTripo, renderTripoJob, keepTripoFocus, closeTripo })`, context);
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
});
