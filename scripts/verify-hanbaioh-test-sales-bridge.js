const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const source = fs.readFileSync(path.join(__dirname, "../assets/concierge-pet/test-sales-bridge.js"), "utf8");
const channel = "dcats-hanbaioh25-bridge-v1";
const id = "11111111-1111-4111-8111-111111111111";
const challengeId = "22222222-2222-4222-8222-222222222222";
const fileName = "hanbaioh-sales-test-900009-aaaaaaaaaaaa-55.csv";
const flush = () => new Promise(resolve => setImmediate(resolve));
const response = () => ({ data: { ok: true, capability: "v2.synthetic.signature" } });
function setup(overrides = {}) {
  const listeners = new Set(), posts = [], calls = [], timers = new Map();
  let timerId = 0, current = true;
  const window = {
    location: { origin: "https://dcats.daiko-denki.co.jp" }, crypto: { randomUUID: () => id },
    addEventListener: (_name, handler) => listeners.add(handler),
    removeEventListener: (_name, handler) => listeners.delete(handler),
    setTimeout: handler => { timers.set(++timerId, handler); return timerId; },
    clearTimeout: value => timers.delete(value),
    postMessage: value => posts.push(JSON.parse(JSON.stringify(value))),
    DcatsHanbaiohTestSalesApi: {
      issueBinding: async () => { calls.push("binding"); return response(); },
      claimOnce: async (_record, slip, hash) => { calls.push(["claim", slip, hash]); return response(); },
      ...overrides,
    },
  };
  vm.runInNewContext(source, { window, Set });
  const options = { record: { actor_id: "actor", device_id: "device" }, fileName, isCurrent: () => current };
  const emit = (value, origin = window.location.origin) => {
    for (const handler of listeners) handler({ source: window, origin, data: { channel, ...value } });
  };
  return { window, options, posts, calls, timers, emit,
    bridge: window.DcatsHanbaiohTestSalesBridge, leave: () => { current = false; } };
}
function challenge(kind, fields = {}) {
  return { type: "sales_ticket_request", id, challengeId, kind, ...fields };
}
test("browser requests initial/fresh bindings and only one matching claim, then returns verified readback", async () => {
  const f = setup(); const waiting = f.bridge.importOnce(f.options); await flush();
  assert.equal(f.posts[0].request.command, "import_dev_order_test_sale");
  assert.deepEqual(Object.keys(f.posts[0].request).sort(), ["capability", "command", "deviceId", "fileName", "id"]);
  f.emit(challenge("binding")); await flush();
  f.emit(challenge("claim", { slipNumber: "900009", csvSha256: "a".repeat(64) })); await flush();
  f.emit({ type: "response", response: { id, ok: true, command: "import_dev_order_test_sale",
    data: { status: "import_verified", slipNumber: "900009", backupSha256: "b".repeat(64) } } });
  assert.equal((await waiting).status, "import_verified");
  assert.equal(f.calls.filter(x => Array.isArray(x)).length, 1);
  assert.equal(f.calls.filter(x => x === "binding").length, 2);
  assert.equal(f.timers.size, 0);
  await assert.rejects(f.bridge.importOnce(f.options), /already_attempted/);
});
test("claim with wrong slip/hash or before fresh binding is rejected without touching the claim API", async () => {
  for (const [fresh, fields] of [[false, {}], [true, { slipNumber: "900010", csvSha256: "a".repeat(64) }],
    [true, { slipNumber: "900009", csvSha256: "b".repeat(64) }]]) {
    const f = setup(); const waiting = f.bridge.importOnce(f.options); await flush();
    if (fresh) { f.emit(challenge("binding")); await flush(); }
    f.emit(challenge("claim", fields));
    await assert.rejects(waiting, /unverified/);
    assert.equal(f.calls.some(x => Array.isArray(x)), false);
    assert.equal(f.posts.at(-1).type, "sales_cancel");
  }
});
test("lost claim response is never retried and the same CSV remains consumed", async () => {
  let claimCalls = 0;
  const f = setup({ claimOnce: async () => { claimCalls++; throw new Error("lost response"); } });
  const waiting = f.bridge.importOnce(f.options); await flush();
  f.emit(challenge("binding")); await flush();
  f.emit(challenge("claim", { slipNumber: "900009", csvSha256: "a".repeat(64) }));
  await assert.rejects(waiting, /unverified/);
  await assert.rejects(f.bridge.importOnce(f.options), /already_attempted/);
  assert.equal(claimCalls, 1);
});
test("logout or owner change cancels the native operation and discards a late signed reply", async () => {
  let resolveBinding, count = 0;
  const f = setup({ issueBinding: async () => ++count === 1 ? response() :
    new Promise(resolve => { resolveBinding = resolve; }) });
  const waiting = f.bridge.importOnce(f.options); await flush();
  f.emit(challenge("binding")); await flush();
  f.leave(); f.bridge.cancelCurrent();
  await assert.rejects(waiting);
  resolveBinding(response()); await flush();
  assert.equal(f.posts.filter(x => x.type === "sales_ticket_reply").length, 0);
  assert.equal(f.posts.at(-1).type, "sales_cancel");
});
test("spoofed origins are ignored; timeout cancels once and blocks automatic replay", async () => {
  const f = setup(); const waiting = f.bridge.importOnce(f.options); await flush();
  f.emit(challenge("claim"), "https://example.invalid"); await flush();
  assert.equal(f.posts.length, 1);
  [...f.timers.values()][0]();
  await assert.rejects(waiting);
  await assert.rejects(f.bridge.importOnce(f.options), /already_attempted/);
  assert.equal(f.posts.filter(x => x.type === "sales_cancel").length, 1);
});
test("unknown response cannot be reported as verified import", async () => {
  const f = setup(); const waiting = f.bridge.importOnce(f.options); await flush();
  f.emit({ type: "response", response: { id, ok: false, error: { code: "unknown" } } });
  await assert.rejects(waiting);
});

const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
const runtime = fs.readFileSync(path.join(__dirname, "../assets/concierge-pet/concierge-pet.js"), "utf8");
assert(html.indexOf("test-sales-bridge.js?") < html.indexOf("concierge-pet.js?"));
assert(runtime.includes('bridgeCard.appendChild(salesCard)'));
assert(runtime.includes('if (bridgeCard.parentElement) bridgeCard.parentElement.removeChild(bridgeCard)'));
assert(runtime.includes('window.DcatsHanbaiohTestSalesBridge.cancelCurrent()'));
assert(!/access_token|service_role|localStorage|sessionStorage|clipboard|innerHTML/.test(source));
