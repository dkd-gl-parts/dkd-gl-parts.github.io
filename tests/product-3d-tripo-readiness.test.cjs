const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "product-3d.js"), "utf8");
const start = source.indexOf("  async function checkTripoReadiness(");
const end = source.indexOf("  function selectGlbForUpload(", start);
assert(start >= 0 && end > start);
const checkSource = source.slice(start, end);

function harness(invoke = async () => ({ data: {
  configured: true, connection_status: "connected", balance: 100,
  generation_enabled: false, has_sufficient_credits: true,
} })) {
  const calls = [];
  const status = { textContent: "" };
  const button = { disabled: false, isConnected: true,
    parentElement: { querySelector: () => status } };
  const state = { productId: 2639, kind: "aftermarket_new", allowed: true };
  const context = {
    sessionModelsEnabled: true, modelCacheEpoch: 1, mediaPaneRequest: { sales: 1, production: 1 },
    canManageGlb: () => state.allowed,
    selectedTarget: () => ({ product: { id: state.productId }, kind: state.kind }),
    productId: product => product.id,
    deny3D: action => calls.push({ denied: action }),
    sb: { functions: { async invoke(name, options) {
      calls.push(JSON.parse(JSON.stringify({ name, ...options })));
      return invoke(name, options);
    } } }, Number, Error,
  };
  const check = vm.runInNewContext(`${checkSource}\ncheckTripoReadiness`, context);
  return { check, calls, status, button, state, context };
}

test("a click only invokes readiness and displays verified balance with generation still disabled", async () => {
  const qa = harness();
  await qa.check("sales", qa.button);
  assert.deepEqual(qa.calls, [{ name: "product-3d-tripo-readiness", body: {
    action: "readiness", product_id: 2639, product_kind: "aftermarket_new",
  } }]);
  assert.match(qa.status.textContent, /残高 100 クレジット/);
  assert.match(qa.status.textContent, /3D生成はまだ無効/);
  assert.equal(qa.button.disabled, false);
  assert.doesNotMatch(checkSource, /action: "(?:start|quote|publish|poll)"|TRIPO_API_KEY|\.from\(|\.rpc\(/);
});

test("system-admin GLB permission is mandatory; customer contexts never query the provider", async () => {
  const denied = harness();
  denied.state.allowed = false;
  await denied.check("sales", denied.button);
  assert.deepEqual(denied.calls, [{ denied: "product_3d_tripo_readiness" }]);
  const customer = harness();
  await customer.check("customer", customer.button);
  assert.deepEqual(customer.calls, []);
  assert.match(source, /var tripoConnection = glbManageable/);
});

test("double-clicks do not issue a second connection request", async () => {
  let finish;
  const qa = harness(() => new Promise(resolve => { finish = resolve; }));
  const pending = qa.check("sales", qa.button);
  assert.equal(qa.button.disabled, true);
  await qa.check("sales", qa.button);
  assert.equal(qa.calls.length, 1);
  finish({ data: { configured: false, connection_status: "not_configured" } });
  await pending;
  assert.match(qa.status.textContent, /APIキーが未設定/);
  assert.equal(qa.button.disabled, false);
});

test("product/kind/session/permission/pane changes suppress stale connection responses", async () => {
  for (const change of [
    qa => { qa.state.productId++; }, qa => { qa.state.kind = "rebuilt"; },
    qa => { qa.context.modelCacheEpoch++; }, qa => { qa.context.sessionModelsEnabled = false; },
    qa => { qa.state.allowed = false; }, qa => { qa.context.mediaPaneRequest.sales++; },
    qa => { qa.button.isConnected = false; },
  ]) {
    let finish;
    const qa = harness(() => new Promise(resolve => { finish = resolve; }));
    const pending = qa.check("sales", qa.button);
    change(qa);
    finish({ data: { configured: true, connection_status: "connected", balance: 100 } });
    await pending;
    assert.doesNotMatch(qa.status.textContent, /接続済み|残高 100/);
  }
});

test("failure/untrusted values remain safe text and never claim authenticated or billable success", async () => {
  for (const invoke of [
    async () => { throw new Error("sensitive provider response"); },
    async () => ({ error: new Error("sensitive provider response") }),
    async () => ({ data: { configured: true, connection_status: "connected", balance: "<script>bad</script>" } }),
  ]) {
    const qa = harness(invoke);
    await qa.check("sales", qa.button);
    assert.match(qa.status.textContent, /確認できませんでした/);
    assert.match(qa.status.textContent, /画像送信・生成は開始していません/);
    assert.doesNotMatch(qa.status.textContent, /sensitive|script|接続済み/);
    assert.equal(qa.calls.length, 1);
    assert.equal(qa.button.disabled, false);
  }
});
