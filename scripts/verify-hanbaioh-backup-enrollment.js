const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const start = source.indexOf("async function issueConciergeBackupEnrollment(record)");
const end = source.indexOf("var CONCIERGE_AI_SCREEN_IDS", start);
assert(start >= 0 && end > start);
const calls = [];
const actor = "00000000-0000-4000-8000-000000000001";
const device = "00000000-0000-4000-8000-000000000002";
const context = {
  window: {}, currentUser: { id: actor }, isSystemAdmin: () => true,
  sb: { functions: { invoke: async (name, options) => {
    calls.push({ name, options });
    return { data: { ok: true }, error: null };
  } } },
};
vm.createContext(context);
vm.runInContext(source.slice(start, end), context);
const record = { actor_id: actor, device_id: device, public_key_spki: "PUBLIC ONLY", public_key_sha256: "a".repeat(64) };
(async () => {
  const issue = context.window.DcatsHanbaiohBackupEnrollmentApi.issue;
  for (const invalid of [null, { ...record, actor_id: device }, { ...record, device_id: "bad" },
    { ...record, password: "SYNTHETIC-DO-NOT-USE" }, { ...record, session_id: actor }]) {
    assert((await issue(invalid)).error);
  }
  context.isSystemAdmin = () => false;
  assert((await issue(record)).error);
  context.isSystemAdmin = () => true;
  context.currentUser = null;
  assert((await issue(record)).error);
  context.currentUser = { id: actor };
  assert.equal(calls.length, 0);
  await issue(record);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, "issue-hanbaioh-backup-enrollment");
  assert.equal(JSON.stringify(calls[0].options.body), JSON.stringify({ device_id: device }));
  console.log("Backup enrollment browser request boundary: OK");
})().catch((error) => { console.error(error); process.exitCode = 1; });
