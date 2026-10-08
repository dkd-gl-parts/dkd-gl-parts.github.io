const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "product-3d.js"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const translations = vm.runInNewContext(app.slice(app.indexOf("var TRANSLATIONS = "), app.indexOf("\nvar currentLang")) + "\nTRANSLATIONS");
function section(first, next) {
  const start = source.indexOf(first), end = source.indexOf(next, start);
  assert(start >= 0 && end > start);
  return source.slice(start, end);
}
const checkSource = section("  async function checkHunyuanReadiness(", "  function sameTripoTarget(");
const renderSource = section("  async function renderMediaPane(", "  function modelStatusLabel(");
const response = (status = "provider_response_received_unverified", configured = true) => ({
  data: { status, configured, generation_enabled: false, authentication_verified: false }
});
function harness(invoke = async () => response()) {
  const calls = [], status = { textContent: "" };
  const button = { disabled: false, isConnected: true, parentElement: { querySelector: () => status } };
  const second = { ...button };
  const state = { id: 2639, kind: "aftermarket_new", allowed: true };
  const host = { innerHTML: "", isConnected: true };
  const scope = {
    sessionModelsEnabled: true, hunyuanReadinessBusy: false, modelCacheEpoch: 1,
    mediaPaneRequest: { sales: 1, production: 1, customer: 1 },
    canManageGlb: () => state.allowed, canManage3D: () => state.allowed,
    canReview3D: () => state.allowed, canPublish3D: () => false,
    selectedTarget: () => ({ product: { id: state.id }, kind: state.kind }),
    productId: product => product.id, el: () => host, esc: value => String(value),
    fetchInternalModels: async () => [], fetchPublishedModels: async () => [],
    deny3D: action => calls.push({ denied: action }),
    t: key => translations.ja[key],
    document: { querySelectorAll: () => [button, second] },
    sb: { functions: { async invoke(name, options) {
      calls.push(JSON.parse(JSON.stringify({ name, ...options })));
      return invoke(name, options);
    } } }
  };
  const api = vm.runInNewContext(`${checkSource}\n${renderSource}\n({ check: checkHunyuanReadiness, render: renderMediaPane })`, scope);
  return { ...api, calls, status, button, second, state, host, scope };
}
test("explicit click invokes only one fixed query-only readiness request", async () => {
  const qa = harness();
  await qa.check("sales", qa.button);
  assert.deepEqual(qa.calls, [{ name: "product-3d-hunyuan-readiness", body: {
    action: "check_connection", consent: "query-only-no-product-data"
  } }]);
  assert.match(qa.status.textContent, /応答を受信/);
  assert.match(qa.status.textContent, /認証・生成権限・無料枠・Model3.1は未確定/);
  assert.equal(qa.scope.hunyuanReadinessBusy, false);
  assert.doesNotMatch(checkSource, /\.from\(|\.rpc\(|fetch\(|console\.|SecretId|SecretKey|DCATS_HUNYUAN|setTimeout|action: "(?:start|quote|publish|submit)"/);
  assert.match(source, /if \(hunyuan\) checkHunyuanReadiness\(hunyuan.dataset.hunyuanReadiness, hunyuan\)/);
});
test("only the approved admin product/kind gets the button; rendering never invokes Tencent", async () => {
  const qa = harness();
  await qa.render("sales");
  assert.match(qa.host.innerHTML, /data-hunyuan-readiness='sales'/);
  assert.equal(qa.calls.length, 0);
  for (const [context, allowed, id, kind] of [
    ["customer", true, 2639, "aftermarket_new"], ["sales", false, 2639, "aftermarket_new"],
    ["sales", true, 2640, "aftermarket_new"], ["production", true, 2639, "rebuilt"]
  ]) {
    qa.state.allowed = allowed; qa.state.id = id; qa.state.kind = kind;
    await qa.render(context);
    assert.doesNotMatch(qa.host.innerHTML, /data-hunyuan-readiness=/);
  }
});
test("direct calls cannot bypass role, product/kind, sign-out or customer boundaries", async () => {
  for (const change of [
    qa => { qa.state.id++; }, qa => { qa.state.kind = "rebuilt"; },
    qa => { qa.scope.sessionModelsEnabled = false; }, qa => { qa.button.isConnected = false; }
  ]) { const qa = harness(); change(qa); await qa.check("sales", qa.button); assert.equal(qa.calls.length, 0); }
  const qa = harness(); qa.state.allowed = false; await qa.check("sales", qa.button);
  assert.deepEqual(qa.calls, [{ denied: "product_3d_hunyuan_readiness" }]);
  const customer = harness(); await customer.check("customer", customer.button); assert.equal(customer.calls.length, 0);
});
test("one global in-flight query prevents same-button and cross-pane duplication", async () => {
  let finish;
  const qa = harness(() => new Promise(resolve => { finish = resolve; }));
  const pending = qa.check("sales", qa.button);
  assert.equal(qa.button.disabled, true); assert.equal(qa.second.disabled, true);
  await qa.check("sales", qa.button); await qa.check("production", qa.second);
  assert.equal(qa.calls.length, 1);
  finish(response()); await pending;
  assert.equal(qa.button.disabled, false); assert.equal(qa.second.disabled, false);
});
test("session, role, product, kind, pane and disconnected-node changes suppress stale responses", async () => {
  for (const change of [
    qa => { qa.scope.modelCacheEpoch++; }, qa => { qa.scope.sessionModelsEnabled = false; },
    qa => { qa.state.allowed = false; }, qa => { qa.state.id++; },
    qa => { qa.state.kind = "rebuilt"; }, qa => { qa.scope.mediaPaneRequest.sales++; },
    qa => { qa.button.isConnected = false; }
  ]) {
    let finish; const qa = harness(() => new Promise(resolve => { finish = resolve; }));
    const pending = qa.check("sales", qa.button); change(qa); finish(response()); await pending;
    assert.doesNotMatch(qa.status.textContent, /応答を受信/);
    assert.equal(qa.scope.hunyuanReadinessBusy, false);
  }
});
test("known safe outcomes remain distinct, without interpreting provider text", async () => {
  for (const [status, configured, expected] of [
    ["not_configured", false, /揃っていません/], ["authentication_rejected", true, /認証を拒否/],
    ["permission_denied", true, /照会権限を拒否/], ["invalid_credentials", true, /保存形式/],
    ["timeout", true, /時間切れ/], ["provider_http_error", true, /完了できません/],
    ["provider_invalid_response", true, /完了できません/], ["provider_unexpected_response", true, /完了できません/],
    ["check_failed", true, /完了できません/]
  ]) {
    const qa = harness(async () => { const value = response(status, configured); value.data.error = "secret-response<script>"; return value; });
    await qa.check("sales", qa.button); assert.match(qa.status.textContent, expected);
    assert.doesNotMatch(qa.status.textContent, /secret-response|script|接続成功(?!は未確認)|生成可能/);
    assert.equal(qa.calls.length, 1);
  }
});
test("untrusted success flags or unknown statuses cannot turn readiness into authorization", async () => {
  for (const data of [
    { ...response().data, generation_enabled: true }, { ...response().data, authentication_verified: true },
    { ...response().data, configured: "true" }, { ...response().data, status: "connected" },
    { ...response().data, configured: false }, { ...response().data, status: "<script>secret</script>" },
    { status: "provider_response_received_unverified" }
  ]) {
    const qa = harness(async () => ({ data })); await qa.check("sales", qa.button);
    assert.match(qa.status.textContent, /完了できません/);
    assert.doesNotMatch(qa.status.textContent, /応答を受信|script|secret/);
  }
});
test("HTTP failures and throws never expose response bodies or exception messages", async () => {
  for (const code of [401, 403, 500, 502]) {
    const qa = harness(async () => ({ error: { message: "secret-error", context: {
      status: code, json() { throw new Error("must not read response"); }
    } } }));
    await qa.check("sales", qa.button);
    assert.match(qa.status.textContent, code === 401 ? /ログイン状態/ : code === 403 ? /管理者権限/ : /完了できません/);
    assert.doesNotMatch(qa.status.textContent, /secret-error|must not read/);
  }
  const qa = harness(async () => { throw new Error("secret-key"); }); await qa.check("sales", qa.button);
  assert.match(qa.status.textContent, /自動再試行/); assert.doesNotMatch(qa.status.textContent, /secret-key/);
});
