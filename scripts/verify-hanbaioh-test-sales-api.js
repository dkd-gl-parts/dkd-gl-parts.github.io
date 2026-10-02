const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const start = source.indexOf("function validConciergeTestSalesDevice(record)");
const end = source.indexOf("var CONCIERGE_AI_SCREEN_IDS", start);
assert(start >= 0 && end > start);

const actor = "00000000-0000-4000-8000-000000000001";
const device = "00000000-0000-4000-8000-000000000002";
const calls = [];
const context = {
  window: {}, currentUser: { id: actor }, isSystemAdmin: () => true,
  sb: { functions: { invoke: async (name, options) => {
    calls.push({ name, options });
    return { data: { ok: true }, error: null };
  } } },
};
vm.createContext(context);
vm.runInContext(source.slice(start, end), context);

const record = {
  actor_id: actor, device_id: device,
  public_key_sha256: "a".repeat(64), public_key_spki: "P".repeat(200),
};
const api = context.window.DcatsHanbaiohTestSalesApi;
const sha256 = "b".repeat(64);

(async () => {
  for (const bad of [null, { ...record, actor_id: device },
    { ...record, device_id: "bad" }, { ...record, password: "secret" },
    { ...record, public_key_sha256: "wrong" }]) {
    assert((await api.issueBinding(bad)).error);
    assert((await api.claimOnce(bad, "900003", sha256)).error);
  }
  assert((await api.claimOnce(record, "000003", sha256)).error);
  assert((await api.claimOnce(record, "900003", "bad")).error);
  context.isSystemAdmin = () => false;
  assert((await api.issueBinding(record)).error);
  assert((await api.claimOnce(record, "900003", sha256)).error);
  context.isSystemAdmin = () => true;
  context.currentUser = null;
  assert((await api.issueBinding(record)).error);
  context.currentUser = { id: actor };
  assert.equal(calls.length, 0);

  await api.issueBinding(record);
  await api.claimOnce(record, "900003", sha256);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].name, "issue-hanbaioh-test-sales-binding");
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0].options.body)), { device_id: device });
  assert.equal(calls[1].name, "issue-hanbaioh-test-sales-claim");
  assert.deepEqual(JSON.parse(JSON.stringify(calls[1].options.body)), {
    company_name: "D-CATS連携テスト（実データ禁止）", device_id: device,
    slip_number: "900003", csv_sha256: sha256,
  });
  console.log("Test sales ticket browser boundary: OK");
})().catch((error) => { console.error(error); process.exitCode = 1; });
