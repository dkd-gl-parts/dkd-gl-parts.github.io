const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const { webcrypto } = require("node:crypto");
const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
const client = fs.readFileSync(path.join(root, "assets/concierge-pet/company-bridge.js"), "utf8");
const actor = "00000000-0000-4000-8000-000000000001", device = "00000000-0000-4000-8000-000000000002";
const record = { actor_id: actor, device_id: device, public_key_sha256: "a".repeat(64), public_key_spki: "-----BEGIN PUBLIC KEY-----\n" + "A".repeat(300) };
const calls = [], context = { window: {}, currentUser: { id: actor }, isSystemAdmin: () => true,
  sb: { functions: { invoke: async (name, options) => { calls.push({ name, options: structuredClone(options) }); return { data: { ok: true } }; } } } };
vm.createContext(context);
vm.runInContext(source.slice(source.indexOf("async function issueConciergeCompanyOperation("), source.indexOf("function validConciergeTestSalesDevice(")), context);
function harness(options = {}) {
  const listeners = new Set(), posts = [], issued = []; let current = true;
  const win = { location: { origin: "https://dcats.daiko-denki.co.jp" }, crypto: webcrypto, setTimeout, clearTimeout,
    addEventListener: (name, cb) => { if (name === "message") listeners.add(cb); }, removeEventListener: (name, cb) => listeners.delete(cb),
    postMessage(message, origin) {
      assert.equal(origin, win.location.origin); const req = structuredClone(message.request); posts.push(req);
      if (options.noReply) return;
      const data = req.command === "login_hanbaioh_company" ? { status: "ui_login_verified", code: "HANBAIOH_CONTROLLED_UI_LOGIN_VERIFIED", sessionRecorded: true } :
        { reused: false, job: { status: "validated_waiting_for_backup", actorId: actor, deviceId: device, category: req.command.split("_").at(-1),
          direction: "import", sourceSha256: issued.at(-1).source_sha256, fileName: req.fileName, jobId: "a".repeat(64) } };
      const response = { id: req.id, command: req.command, ok: true, data: options.badResult ? { status: "import_verified", secret: "DO-NOT-ECHO" } : data };
      queueMicrotask(() => {
        for (const cb of listeners) cb({ source: {}, origin, data: { channel: message.channel, type: "response", response } });
        for (const cb of listeners) cb({ source: win, origin: "https://other.example", data: { channel: message.channel, type: "response", response } });
        for (const cb of listeners) cb({ source: win, origin, data: { channel: message.channel, type: "response", response } });
      });
    },
    DcatsHanbaiohCompanyApi: { issue: async (r, body) => {
      issued.push(structuredClone(body));
      if (options.changedDuringIssue) current = false;
      return { data: { ok: true, request_id: body.request_id, device_id: device,
        expires_at: new Date(Date.now() + (options.expiry ?? 170000)).toISOString(), capability: "v2.c3ludGhldGlj." + "A".repeat(86) } };
    } }
  };
  const ctx = { window: win, Uint8Array, Object, Date, Set, Array, Number, Promise, Error };
  vm.createContext(ctx); vm.runInContext(client, ctx);
  return { bridge: win.DcatsHanbaiohCompanyBridge, posts, issued, listeners, options: { record, isCurrent: () => current }, leave: () => { current = false; } };
}
(async () => {
  const issue = context.window.DcatsHanbaiohCompanyApi.issue;
  const login = { command: "login_hanbaioh_company", request_id: webcrypto.randomUUID(), device_id: device };
  for (const r of [null, { ...record, actor_id: device }, { ...record, password: "DO-NOT-ECHO" }]) assert((await issue(r, login)).error);
  for (const req of [{ ...login, password: "DO-NOT-ECHO" }, { ...login, connectionName: "other" }, { ...login, command: "export_hanbaioh_sales" }, { ...login, command: "toString" }, { ...login, device_id: actor }]) assert((await issue(record, req)).error);
  context.isSystemAdmin = () => false; assert((await issue(record, login)).error); context.isSystemAdmin = () => true;
  assert.equal(calls.length, 0); await issue(record, login);
  assert.equal(calls[0].name, "issue-hanbaioh-company-operation"); assert.deepEqual(calls[0].options.body, login);
  const bytes = new TextEncoder().encode("synthetic CSV,not vendor data\n");
  const file = { name: "synthetic.csv", size: bytes.length, arrayBuffer: async () => bytes.slice().buffer };
  for (const category of ["products", "customers", "sales"]) {
    const h = harness();
    const result = await h.bridge.prepareCsv({ ...h.options, category, file });
    assert.equal(result.status, "prepared"); assert.equal(result.category, category);
    assert.equal(h.posts[0].command, "prepare_hanbaioh_" + category);
    assert.equal(h.posts[0].fileName, file.name); assert.equal(h.issued[0].source_sha256.length, 64);
    assert.equal(Object.keys(h.posts[0]).sort().join(","), "capability,command,deviceId,fileName,id");
    assert.equal(h.listeners.size, 0);
  }
  const good = harness(); assert.equal((await good.bridge.loginOnce(good.options)).status, "login_verified");
  assert(good.bridge.wasLoginAttempted(record)); await assert.rejects(good.bridge.loginOnce(good.options)); assert.equal(good.posts.length, 1);
  for (const settings of [{ expiry: -1 }, { expiry: 181000 }, { changedDuringIssue: true }]) {
    const h = harness(settings); await assert.rejects(h.bridge.loginOnce(h.options)); assert.equal(h.posts.length, 0);
  }
  const bad = harness({ badResult: true }); await assert.rejects(bad.bridge.loginOnce(bad.options)); assert(bad.bridge.wasLoginAttempted(record));
  const pending = harness({ noReply: true }); const result = pending.bridge.loginOnce(pending.options);
  await new Promise(resolve => setImmediate(resolve)); pending.leave(); pending.bridge.cancelCurrent(); await assert.rejects(result);
  assert.equal(pending.listeners.size, 0); assert(pending.bridge.wasLoginAttempted(record));
  const invalid = harness(); await assert.rejects(invalid.bridge.prepareCsv({ ...invalid.options, category: "sales", file: { ...file, name: "../other.csv" } }));
  assert.equal(invalid.posts.length, 0); assert.equal(invalid.issued.length, 0);
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert(html.indexOf("company-bridge.js?") < html.indexOf("concierge-pet.js?"));
  console.log("Company bridge: owner/admin/exact requests, 180 seconds, three isolated preparations, same-origin results, single login, cancellation, no secrets or vendor writes: OK");
})().catch(error => { console.error(error); process.exitCode = 1; });
