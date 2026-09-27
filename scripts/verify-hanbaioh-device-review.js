const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const start = app.indexOf("async function approveConciergePendingDevice(record)");
const end = app.indexOf("var CONCIERGE_AI_SCREEN_IDS", start);
assert(start >= 0 && end > start, "device review API is missing");

const calls = [];
const context = {
  window: {},
  currentUser: { id: "00000000-0000-4000-8000-000000000001" },
  isSystemAdmin: () => true,
  sb: { functions: { invoke: async (name, options) => {
    calls.push({ name, options });
    return { data: { ok: true, device_id: options.body.device_id, status: "approved" }, error: null };
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
  const approve = context.window.DcatsHanbaiohReviewApi.approvePending;
  context.isSystemAdmin = () => false;
  assert((await approve(record)).error, "non-admin review should fail");
  context.isSystemAdmin = () => true;
  assert((await approve({ ...record, actor_id: "00000000-0000-4000-8000-000000000003" })).error,
    "another owner should fail");
  assert((await approve({ ...record, private_key: "forbidden" })).error,
    "private material should fail");
  assert.equal(calls.length, 0, "rejected review must not reach Edge");
  const result = await approve(record);
  assert.equal(result.data.status, "approved");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].name, "review-hanbaioh-pilot-device");
  assert.deepEqual(Object.keys(calls[0].options.body).sort(),
    ["action", "device_id", "expected_status", "public_key_sha256", "user_id"]);
  assert.equal(calls[0].options.body.action, "approve");
  assert.equal(calls[0].options.body.expected_status, "pending");
  assert.equal(calls[0].options.body.user_id, record.actor_id);
  assert(!JSON.stringify(calls[0].options.body).includes("PRIVATE KEY"));
  console.log("Audited device review browser boundary: OK");
})().catch((error) => { console.error(error); process.exitCode = 1; });
