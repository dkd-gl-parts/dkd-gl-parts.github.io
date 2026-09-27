const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const start = app.indexOf("async function submitConciergePendingDevice(record)");
const end = app.indexOf("var CONCIERGE_AI_SCREEN_IDS", start);
assert(start >= 0 && end > start, "pending enrollment API is missing");
const calls = [];
const context = {
  window: {},
  currentUser: { id: "00000000-0000-4000-8000-000000000001" },
  isSystemAdmin: () => true,
  sb: { functions: { invoke: async (name, options) => {
    calls.push({ name, options });
    return { data: { ok: true, status: "pending", device_id: options.body.device_id }, error: null };
  } } },
};
vm.createContext(context);
vm.runInContext(app.slice(start, end), context);

const record = {
  actor_id: context.currentUser.id,
  device_id: "00000000-0000-4000-8000-000000000002",
  public_key_spki: "-----BEGIN PUBLIC KEY-----\n" + "A".repeat(460) + "\n-----END PUBLIC KEY-----\n",
  public_key_sha256: "a".repeat(64),
};

(async () => {
  const submit = context.window.DcatsHanbaiohEnrollmentApi.submitPending;
  context.isSystemAdmin = () => false;
  assert((await submit(record)).error, "non-admin enrollment should fail");
  context.isSystemAdmin = () => true;
  assert((await submit({ ...record, actor_id: "00000000-0000-4000-8000-000000000003" })).error, "another actor should fail");
  assert((await submit({ ...record, private_key: "forbidden" })).error, "private material should fail");
  assert.equal(calls.length, 0, "rejected enrollment must not reach Edge");
  const result = await submit(record);
  assert.equal(result.data.status, "pending");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, "enroll-hanbaioh-pilot-device");
  assert.deepEqual(Object.keys(calls[0].options.body).sort(), ["device_id", "public_key_sha256", "public_key_spki"]);
  assert.equal(calls[0].options.body.device_id, record.device_id);
  console.log("Pending device enrollment browser boundary: OK");
})().catch((error) => { console.error(error); process.exitCode = 1; });
