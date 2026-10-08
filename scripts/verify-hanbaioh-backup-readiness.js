const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const { webcrypto } = require("node:crypto");
const root = path.join(__dirname, ".."), source = fs.readFileSync(path.join(root, "assets/concierge-pet/company-bridge.js"), "utf8");
const actor = "00000000-0000-4000-8000-000000000001", device = "00000000-0000-4000-8000-000000000002";
function fixture(mode = {}) {
  const listeners = new Map(), posts = [], issues = []; let current = true;
  const data = { status: "production_backup_prerequisites", ready: false, actorId: actor, deviceId: device,
    targetSha256: "975d8e446b7dd638ef46ba90dcf3baf4fa9f77c4f22ae9187fbb7913a0029a37", backupPolicy: "password_protected_google_drive", folderId: "1JLtJIHpZS5SdDAusy4yc0RijxN0YwoSQ",
    checks: { identity: "available", syncFolder: "available", driveConfiguration: "configuration_required", driveAuthorization: "unverified", backupPassword: "registration_required", recovery: "unverified", backupAdapter: "unavailable" } };
  const record = { actor_id: actor, device_id: device, public_key_sha256: "a".repeat(64), public_key_spki: "-----BEGIN PUBLIC KEY-----\n" + "A".repeat(300) };
  function emit(response) { queueMicrotask(() => { for (const fn of listeners.get("message") || []) fn({ source: win, origin: win.location.origin, data: { channel: "dcats-hanbaioh25-bridge-v1", type: "response", response } }); }); }
  const win = { location: { origin: "https://dcats.daiko-denki.co.jp" }, crypto: webcrypto,
    setTimeout: (fn, ms) => setTimeout(fn, mode.timeout && [20000,610000].includes(ms) ? 5 : ms), clearTimeout, setInterval, clearInterval,
    addEventListener(n, f) { if (!listeners.has(n)) listeners.set(n, new Set()); listeners.get(n).add(f); }, removeEventListener(n, f) { listeners.get(n)?.delete(f); },
    postMessage(m) {
      posts.push(structuredClone(m)); const q = m.request; if (!q) return;
      if (q.command === "read_hanbaioh_company_device") { emit({ id: q.id, ok: true, command: q.command, data: record }); return; }
      assert.equal(q.command, mode.authenticated?"open_hanbaioh_company_backup_setup":"read_hanbaioh_company_backup_readiness");
      if(mode.authenticated) {
        assert.equal(Object.keys(q).sort().join(","),"capability,checkReadiness,command,confirmStartup,deviceId,id");
        assert.equal(q.checkReadiness,true);
        queueMicrotask(()=>{for(const fn of listeners.get("message")||[])fn({source:win,origin:win.location.origin,data:{channel:"dcats-hanbaioh25-bridge-v1",type:"company_backup_setup_opened",id:q.id}});});
      }
      if (mode.timeout) return;
      if (mode.close) { for (const fn of [...listeners.get("pagehide")]) fn(); return; }
      if (mode.cancel) { win.DcatsHanbaiohCompanyBridge.cancelCurrent(); return; }
      if (mode.stale) current = false;
      let result = structuredClone(data);
      if (mode.ready) { Object.keys(result.checks).forEach(k => result.checks[k] = "available"); result.ready = true; }
      if (mode.malformed === "ready") result.ready = true;
      if (mode.malformed === "actor") result.actorId = device;
      if (mode.malformed === "device") result.deviceId = actor;
      if (mode.malformed === "secret") result.password = "PRIVATE";
      if (mode.malformed === "status") result.checks.backupAdapter = "approved-by-browser";
      if (mode.malformed === "extraCheck") result.checks.privateKey = "PRIVATE";
      if(mode.localOnly){result.checks.backupPassword="local_only";result.checks.driveConfiguration="unverified";}
      if (mode.malformed === "folder") result.folderId = "other";
      emit({ id: q.id, ok: !mode.failed, command: q.command, data: mode.authenticated?{status:"readiness_closed",readiness:result,...(mode.outerSecret?{password:"PRIVATE"}:{})}:result, ...(mode.failed ? { error: { code: "REQUEST_REJECTED", message: "DO-NOT-ECHO" } } : {}) });
    },
    DcatsHanbaiohCompanyApi: { issue: async (r, q) => {
      assert.equal(r.actor_id, actor); assert.equal(q.command, "enroll_hanbaioh_company_account"); issues.push(q);
      if (mode.httpStatus) return { error: { context: { status: mode.httpStatus }, message: "DO-NOT-ECHO" } };
      return { data: { ok: true, request_id: q.request_id, device_id: device, expires_at: new Date(Date.now() + 170000).toISOString(), capability: "v2.c3ludGhldGlj." + "A".repeat(86) } };
    } },
  };
  vm.runInNewContext(source, { window: win, Date, Object, Set, Map, Promise, Error, Number, Array, Uint8Array });
  return { posts, issues, listeners, run: () => (mode.authenticated?win.DcatsHanbaiohCompanyBridge.checkBackupReadinessFromPc:win.DcatsHanbaiohCompanyBridge.readBackupReadinessFromPc)({ actorId: actor, isCurrent: () => current }) };
}
(async () => {
  for (const ready of [false, true]) {
    const f = fixture({ ready }), result = await f.run(); assert.equal(result.ready, ready); assert.equal(f.issues.length, 1);
    assert.deepEqual(f.posts.filter(m => m.request).map(m => m.request.command), ["read_hanbaioh_company_device", "read_hanbaioh_company_backup_readiness"]);
    assert(f.posts.some(m => m.type === "company_export_cancel")); assert([...f.listeners.values()].every(s => s.size === 0));
    assert.doesNotMatch(JSON.stringify(f.posts), /password_entry|privateKey|login_hanbaioh_company/);
  }
  for(const ready of [false,true]) {
    const f=fixture({authenticated:true,ready}),r=await f.run();assert.equal(r.ready,ready);
    assert.deepEqual(f.posts.filter(m=>m.request).map(m=>m.request.command),["read_hanbaioh_company_device","open_hanbaioh_company_backup_setup"]);
    assert(f.posts.some(m=>m.type==="company_backup_setup_cancel"));assert([...f.listeners.values()].every(s=>s.size===0));
  }
  const local=await fixture({authenticated:true,localOnly:true}).run();assert.equal(local.checks.backupPassword,"local_only");assert.equal(local.ready,false);
  await assert.rejects(fixture({authenticated:true,outerSecret:true}).run(),/company_backup_readiness_unverified/);
  for(const malformed of ["ready","actor","device","secret","status","extraCheck","folder"])await assert.rejects(fixture({authenticated:true,malformed}).run(),/company_backup_readiness_unverified/);
  for(const key of ["timeout","close","cancel","stale","failed"]) {const f=fixture({authenticated:true,[key]:true});await assert.rejects(f.run());assert([...f.listeners.values()].every(s=>s.size===0));}
  for (const malformed of ["ready", "actor", "device", "secret", "status", "extraCheck", "folder"]) await assert.rejects(fixture({ malformed }).run(), /company_backup_readiness_unverified/);
  for (const key of ["timeout", "close", "cancel", "stale", "failed"]) { const f = fixture({ [key]: true }); await assert.rejects(f.run()); assert([...f.listeners.values()].every(s => s.size === 0)); }
  for (const [status, code] of [[401,"company_authentication_required"],[403,"company_not_authorized"],[409,"company_binding_unavailable"],[503,"company_issuer_unavailable"]]) {
    const f = fixture({ httpStatus: status }); await assert.rejects(f.run(), e => e.message === code); assert.equal(f.posts.filter(m => m.request).length, 1);
  }
  const html = fs.readFileSync(path.join(root,"index.html"),"utf8"), app = fs.readFileSync(path.join(root,"app.js"),"utf8");
  const card = html.slice(html.indexOf('<section class="dcats-business-workspace-backup"'), html.indexOf('</section>', html.indexOf('<section class="dcats-business-workspace-backup"')));
  assert(card.includes(" hidden>")); assert(!card.includes("<input")); assert.equal((card.match(/data-backup-check=/g)||[]).length,7);
  assert(card.includes('id="dcats-business-workspace-backup-check"')); assert(card.includes('role="status"'));
  const names = [...new Set([...card.matchAll(/data-i18n="(business_workspace_backup_[^"]+)"/g)].map(m=>m[1]))];
  for (const name of [...names, ...["local_only","available","registration_required","configuration_required","unavailable","working","ready","pending","failed"].map(k=>"business_workspace_backup_"+k)])
    assert.equal((app.match(new RegExp(name+":","g"))||[]).length,3,name);
  const handler=app.slice(app.indexOf("async function checkDcatsCompanyBackupReadiness()"),app.indexOf("function downloadDcatsBusinessWorkspaceShortcut()"));
  assert(handler.includes("checkBackupReadinessFromPc"));assert(!handler.includes("readBackupReadinessFromPc"));assert(handler.includes("isCurrent()"));assert(handler.includes("result.status"));
  console.log("Backup readiness: signed same-owner read, fixed states, no vendor start/enrollment, errors/cancellation/stale sessions and three-language UI: OK");
})().catch(error => { console.error(error); process.exitCode = 1; });
