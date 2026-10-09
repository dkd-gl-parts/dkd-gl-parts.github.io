const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const root = path.resolve(__dirname, '..'), source = fs.readFileSync(path.join(root, 'assets/concierge-pet/company-bridge.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8'), app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const actor = '00000000-0000-4000-8000-000000000001', device = '00000000-0000-4000-8000-000000000002';
const record = { actor_id: actor, device_id: device };
const bytes = new TextEncoder().encode('SYNTHETIC CSV ONLY\n');
const file = { name: 'input.csv', size: bytes.length, arrayBuffer: async () => bytes.slice().buffer };
let checks = 0;
function harness(config = {}) {
  const messages = new Set(), page = new Set(), posts = [], issued = [], storage = config.storage || new Map(); let current = true;
  const readiness = { status: 'production_backup_prerequisites', ready: false, actorId: actor, deviceId: device,
    targetSha256: '975d8e446b7dd638ef46ba90dcf3baf4fa9f77c4f22ae9187fbb7913a0029a37', backupPolicy: 'password_protected_google_drive', folderId: '1JLtJIHpZS5SdDAusy4yc0RijxN0YwoSQ',
    checks: { identity: 'available', syncFolder: 'available', driveConfiguration: 'available', driveAuthorization: 'available', backupPassword: 'local_only', recovery: 'unverified', backupAdapter: 'unavailable' } };
  const win = { location: { origin: 'https://dcats.daiko-denki.co.jp' }, crypto: webcrypto,
    setTimeout: (fn, ms) => setTimeout(fn, config.shortTimers ? 15 : ms), clearTimeout, setInterval, clearInterval,
    sessionStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => { if (config.storageFailure) throw Error('PRIVATE'); storage.set(key, value); }, removeItem: key => storage.delete(key) },
    addEventListener: (type, fn) => (type === 'message' ? messages : page).add(fn), removeEventListener: (type, fn) => (type === 'message' ? messages : page).delete(fn),
    postMessage(m, origin) {
      assert.equal(origin, win.location.origin); if (!m.request) return; const req = structuredClone(m.request); posts.push(req);
      queueMicrotask(() => {
        const opened = { channel: m.channel, type: 'company_backup_setup_opened', id: req.id };
        const reply = data => ({ channel: m.channel, type: 'response', response: { id: req.id, ok: true, command: req.command, data } });
        const send = data => { for (const fn of messages) fn({ source: win, origin, data }); };
        let data = { category: req.category, status: config.status || 'completed' };
        if (data.status === 'completed') data.receipt = { schemaVersion: 1, prepareRequestId: req.id, category: req.category, status: 'production_preimport_backup_verified', backupRequestId: webcrypto.randomUUID(), jobId: 'a'.repeat(64), sha256: 'b'.repeat(64), size: 100 };
        if (data.status === 'checkpoint' && req.command === 'open_hanbaioh_company_import_result') {
          const stage=config.checkpointStage||'completion_observed',time=Date.now()-5000,empty=['no_reservation_record','reservation_incomplete'].includes(stage);
          data.retryPermitted=false;data.importVerified=false;data.checkpoint={stage,requestId:empty?null:webcrypto.randomUUID(),reservedAt:empty?null:time,
            observedStartedAt:stage==='completion_observed'?time+1000:null,observedCompletedAt:stage==='completion_observed'?time+2000:null};
        } else if (data.status === 'checkpoint') {
          const stage=config.checkpointStage||'delivery_recorded',startedAt=Date.now()-5000;
          data.checkpoint={stage,backupRequestId:stage==='not_started'?null:webcrypto.randomUUID(),startedAt:stage==='not_started'?null:startedAt,finishedAt:['not_started','attempt_recorded'].includes(stage)?null:startedAt+1000};
        }
        if (data.status === 'blocked') data.readiness = { ...readiness, ...config.readiness };
        if (data.status === 'stopped') data.receipt = { schemaVersion: 1, prepareRequestId: req.id, category: req.category, status: 'stopped', code: 'production_preimport_backup_unverified', phase: 'create', attemptRecorded: true, backupMayHaveStarted: true, ...config.receipt };
        if (config.patch) data = config.patch(data);
        for (const fn of messages) fn({ source: {}, origin, data: opened });
        for (const fn of messages) fn({ source: win, origin: 'https://other.invalid', data: reply(data) });
        if (!config.noOpened) send(opened);
        if (config.repeatOpened) send(opened);
        if (config.noReply) return;
        if (config.leave) current = false;
        send(reply(data));
      });
    },
    DcatsHanbaiohCompanyApi: { issue: async (_record, req) => {
      issued.push(structuredClone(req)); if (config.pendingIssue) await config.pendingIssue;
      if (config.changedDuringIssue) current = false;
      return { data: { ok: true, request_id: req.request_id, device_id: device, expires_at: new Date(Date.now() + (config.expiry || 170000)).toISOString(), capability: 'v2.c3ludGhldGlj.' + 'A'.repeat(86) } };
    } },
  };
  vm.runInNewContext(source, { window: win, Uint8Array, Date, Object, Set, Map, Array, Number, Promise, Error });
  return { bridge: win.DcatsHanbaiohCompanyBridge, options: { record, category: 'products', file, isCurrent: () => current }, posts, issued, storage, messages, page };
}
async function scenario(name, action) { await action(); checks++; }
(async () => {
  for(const category of ['products','customers','sales'])for(const checkpointStage of ['no_reservation_record','reservation_incomplete','reservation_recorded','completion_observation_unknown','completion_observed'])await scenario('import record '+category+' '+checkpointStage,async()=>{
    const storage=new Map([['existing-operation','original-request']]),h=harness({storage,status:'checkpoint',checkpointStage});let opened=0;
    const r=await h.bridge.readImportCheckpointFromPc({...h.options,category,onStage:()=>opened++});
    assert.equal(r.checkpoint.stage,checkpointStage);assert.equal(r.category,category);assert.equal(r.retryPermitted,false);assert.equal(r.importVerified,false);assert.equal(opened,1);
    assert.equal(h.posts[0].command,'open_hanbaioh_company_import_result');assert.equal(h.issued[0].command,'prepare_hanbaioh_'+category);
    assert.deepEqual([...storage],[['existing-operation','original-request']]);assert.equal(h.messages.size,0);assert.equal(h.page.size,0);
    assert.doesNotMatch(JSON.stringify(r),/token|password|capability|filePath|SYNTHETIC/);
    await h.bridge.readImportCheckpointFromPc({...h.options,category});assert.equal(h.posts.length,2);assert.equal(storage.size,1);
  });
  for(const config of [{status:'completed'},{status:'blocked'},{status:'outcome_unknown'},{status:'checkpoint',noOpened:true},{status:'checkpoint',repeatOpened:true},{status:'checkpoint',leave:true},
    {status:'checkpoint',patch:r=>({...r,retryPermitted:true})},{status:'checkpoint',patch:r=>({...r,importVerified:true})},
    {status:'checkpoint',patch:r=>({...r,password:'PRIVATE'})},{status:'checkpoint',patch:r=>({...r,category:'sales'})},
    {status:'checkpoint',patch:r=>({...r,checkpoint:{...r.checkpoint,observedCompletedAt:Date.now()+10000}})},
    {status:'checkpoint',patch:r=>({...r,checkpoint:{...r.checkpoint,stage:'no_reservation_record'}})}])await scenario('import record refuses forged result',async()=>{
    const h=harness(config);await assert.rejects(h.bridge.readImportCheckpointFromPc(h.options),e=>!e.message.includes('PRIVATE'));assert.equal(h.storage.size,0);assert.equal(h.posts.length,1);assert.equal(h.messages.size,0);assert.equal(h.page.size,0);
  });
  for(const status of ['failed','expired','cancelled'])await scenario('readonly terminal '+status,async()=>{const h=harness({status});assert.equal((await h.bridge.readImportCheckpointFromPc(h.options)).status,status);assert.equal(h.storage.size,0);});
  for(const category of ['products','customers','sales'])assert(html.includes('data-company-import-result="'+category+'"'));
  for(const key of ['hint','working','opened','no_reservation_record','reservation_incomplete','reservation_recorded','completion_observation_unknown','completion_observed','failed','cancelled'])
    assert.equal((app.match(new RegExp('business_workspace_company_import_result_'+key+':','g'))||[]).length,3);
  for (const category of ['products', 'customers', 'sales']) await scenario(category, async () => {
    const h = harness(); let opened = 0; const result = await h.bridge.backupBeforePrepare({ ...h.options, category, onStage: () => opened++ });
    assert.equal(result.status, 'completed'); assert.equal(result.category, category); assert.equal(opened, 1);
    assert.equal(h.issued[0].command, 'prepare_hanbaioh_' + category); assert.equal(Object.keys(h.issued[0]).sort().join(','), 'command,device_id,file_name,request_id,source_sha256');
    assert.equal(h.posts[0].command, 'open_hanbaioh_preimport_backup'); assert.equal(Object.keys(h.posts[0]).sort().join(','), 'capability,category,command,confirmStartup,deviceId,fileName,id');
    assert.equal(h.posts[0].confirmStartup, true); assert.equal(h.messages.size, 0); assert.equal(h.page.size, 0);
    assert.doesNotMatch(JSON.stringify([...h.storage]) + JSON.stringify(result), /capability|password|SYNTHETIC|remoteFileId|filePath/);
    await assert.rejects(h.bridge.backupBeforePrepare({ ...h.options, category }), /company_backup_already_attempted/); assert.equal(h.posts.length, 1);
    const reload = harness({ storage: h.storage }); await assert.rejects(reload.bridge.backupBeforePrepare({ ...reload.options, category }), /company_backup_already_attempted/); assert.equal(reload.posts.length, 0);
  });
  for (const status of ['blocked', 'cancelled', 'failed', 'expired']) await scenario(status, async () => {
    const h = harness({ status }); assert.equal((await h.bridge.backupBeforePrepare(h.options)).status, status); assert.equal(h.storage.size, 0);
    if (status === 'blocked') assert.equal(h.posts.length, 1);
  });
  for (const config of [{ status: 'outcome_unknown' }, { status: 'stopped' }, { noOpened: true }, { repeatOpened: true }, { leave: true },
    { patch: r => ({ ...r, password: 'PRIVATE' }) }, { patch: r => ({ ...r, category: 'sales' }) },
    { patch: r => ({ ...r, receipt: { ...r.receipt, prepareRequestId: actor } }) }, { patch: r => ({ ...r, receipt: { ...r.receipt, token: 'PRIVATE' } }) },
    { status: 'blocked', readiness: { actorId: device } }]) await scenario('unknown or forged', async () => {
    const h = harness(config);
    if (config.status === 'outcome_unknown' || config.status === 'stopped') await h.bridge.backupBeforePrepare(h.options);
    else await assert.rejects(h.bridge.backupBeforePrepare(h.options), error => !error.message.includes('PRIVATE'));
    assert.equal(h.storage.size, 1); const reload = harness({ storage: h.storage }); await assert.rejects(reload.bridge.backupBeforePrepare(reload.options), /company_backup_already_attempted/); assert.equal(reload.posts.length, 0);
    assert.equal(h.messages.size, 0); assert.equal(h.page.size, 0);
  });
  await scenario('confirmed no attempt allows setup repair', async () => {
    const h = harness({ status: 'stopped', receipt: { phase: 'preflight', attemptRecorded: false, backupMayHaveStarted: false } });
    assert.equal((await h.bridge.backupBeforePrepare(h.options)).status, 'stopped'); assert.equal(h.storage.size, 0);
  });
  await scenario('bounded late permit cannot open a window', async () => {
    let release; const pendingIssue = new Promise(r => release = r), h = harness({ pendingIssue, shortTimers: true });
    await assert.rejects(h.bridge.backupBeforePrepare(h.options), /company_issuer_unavailable/); release(); await new Promise(r => setImmediate(r));
    assert.equal(h.posts.length, 0); assert.equal(h.storage.size, 0); assert.equal(h.page.size, 0);
  });
  for (const config of [{ changedDuringIssue: true }, { expiry: 181000 }, { storageFailure: true }]) await scenario('preflight refusal', async () => {
    const h = harness(config); await assert.rejects(h.bridge.backupBeforePrepare(h.options)); assert.equal(h.posts.length, 0);
  });
  await scenario('path rejected and selected CSV bytes cleared', async () => {
    const h = harness(); await assert.rejects(h.bridge.backupBeforePrepare({ ...h.options, file: { ...file, name: '../input.csv' } })); assert.equal(h.issued.length, 0);
    const raw = bytes.slice(); await h.bridge.backupBeforePrepare({ ...h.options, file: { ...file, arrayBuffer: async () => raw.buffer } }); assert(raw.every(b => b === 0));
  });
  for (const category of ['products', 'customers', 'sales']) {
    assert(html.includes('data-company-backup-result="' + category + '"')); assert(html.includes('data-company-backup="' + category + '"')); assert(html.includes('data-company-backup-file="' + category + '"'));
  }
  assert(html.indexOf('data-company-backup="products"') < html.indexOf('id="dcats-business-workspace-settings-overlay"'));
  for (const key of ['hint', 'csv', 'working', 'opened', 'completed', 'blocked', 'cancelled', 'stopped', 'unknown', 'csv_invalid']) assert.equal((app.match(new RegExp('business_workspace_company_backup_' + key + ':', 'g')) || []).length, 3);
  assert(app.includes('else if(button.dataset.companyBackup||button.dataset.companyBackupResult||button.dataset.companyImportResult)')); assert(app.includes('!["connect","login","export","result","backup","backup_result","import_result"].includes(action)'));
  assert(app.includes('!currentUser||!isSystemAdmin()')); assert(!source.includes('refreshToken'));
  for(const category of ['products','customers','sales'])for(const checkpointStage of ['not_started','attempt_recorded','local_backup_verified','delivery_recorded'])await scenario('read-only '+category+' '+checkpointStage,async()=>{
    const started=harness();await started.bridge.backupBeforePrepare({...started.options,category});const original=[...started.storage];
    const h=harness({status:'checkpoint',checkpointStage,storage:started.storage});let opened=0;
    const r=await h.bridge.readBackupCheckpointFromPc({...h.options,category,onStage:()=>opened++});
    assert.equal(r.status,'checkpoint');assert.equal(r.checkpoint.stage,checkpointStage);assert.equal(r.category,category);assert.equal(opened,1);
    assert.equal(h.posts[0].command,'open_hanbaioh_preimport_backup_result');assert.equal(h.issued[0].command,'prepare_hanbaioh_'+category);
    assert.deepEqual([...h.storage],original);assert.equal(h.messages.size,0);assert.equal(h.page.size,0);
    assert.doesNotMatch(JSON.stringify(r),/password|token|capability|remoteFileId|filePath/);
    await h.bridge.readBackupCheckpointFromPc({...h.options,category});assert.deepEqual([...h.storage],original);assert.equal(h.posts.length,2);
    await assert.rejects(h.bridge.backupBeforePrepare({...h.options,category}),/company_backup_already_attempted/);assert.equal(h.posts.length,2);
  });
  await scenario('read absent record without creating any browser marker',async()=>{const h=harness({status:'checkpoint',checkpointStage:'not_started'});await h.bridge.readBackupCheckpointFromPc(h.options);assert.equal(h.storage.size,0);});
  for(const config of [{status:'completed'},{status:'blocked'},{status:'stopped'},{status:'checkpoint',noOpened:true},{status:'checkpoint',repeatOpened:true},{status:'checkpoint',leave:true},
    {status:'checkpoint',patch:r=>({...r,password:'PRIVATE'})},{status:'checkpoint',patch:r=>({...r,category:'sales'})},
    {status:'checkpoint',patch:r=>({...r,checkpoint:{...r.checkpoint,stage:'unknown'}})},{status:'checkpoint',patch:r=>({...r,checkpoint:{...r.checkpoint,token:'PRIVATE'}})},
    {status:'checkpoint',patch:r=>({...r,checkpoint:{...r.checkpoint,startedAt:Date.now()+100000}})},{status:'checkpoint',patch:r=>({...r,checkpoint:{...r.checkpoint,finishedAt:1}})},
    {status:'checkpoint',checkpointStage:'not_started',patch:r=>({...r,checkpoint:{...r.checkpoint,backupRequestId:actor}})}])await scenario('reject forged checkpoint',async()=>{
      const seed=harness();await seed.bridge.backupBeforePrepare(seed.options);const original=[...seed.storage],h=harness({...config,storage:seed.storage});
      await assert.rejects(h.bridge.readBackupCheckpointFromPc(h.options),e=>!e.message.includes('PRIVATE'));assert.deepEqual([...h.storage],original);assert.equal(h.messages.size,0);assert.equal(h.page.size,0);
  });
  for(const status of ['cancelled','failed','expired','outcome_unknown'])await scenario('read-only '+status,async()=>{const storage=new Map([['dcats-company-preimport:synthetic','original']]),h=harness({status,storage});assert.equal((await h.bridge.readBackupCheckpointFromPc(h.options)).status,status);assert.equal(storage.size,1);});
  for(const key of ['result','result_hint','result_working','result_opened','result_not_started','result_attempt_recorded','result_local_backup_verified','result_delivery_recorded','result_failed','result_cancelled'])assert.equal((app.match(new RegExp('business_workspace_company_backup_'+key+':','g'))||[]).length,3);
  console.log('Preimport backup: ' + checks + ' scenarios; isolated categories, dedicated window, explicit startup, readiness only, safe projection, timeout, owner change, no repeat after reload, no browser secrets: OK');
})().catch(error => { console.error(error); process.exitCode = 1; });
