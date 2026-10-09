const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const { createCoordinator, holdWindowIdentity, operationFunction, operationRequestId } = require('../account-operation-workspace.js');

const response = (mode = 'write', generation = 1) => ({ data: { mode, generation, window_count: 1, max_windows: 4 } });
function setup(rpc) {
  const calls = [], timers = new Map(); let nextTimer = 0;
  const client = { rpc: async (name, input) => { calls.push({ name, input }); return rpc(name, input); } };
  const coordinator = createCoordinator({
    windowId: 'synthetic-window', randomUUID: () => 'synthetic-request', screen: () => 'search',
    setInterval: cb => { timers.set(++nextTimer, cb); return nextTimer; }, clearInterval: id => timers.delete(id)
  });
  return { client, coordinator, calls, timers };
}
test('registers once and supplies only window and generation headers', async () => {
  const env = setup(() => response());
  await env.coordinator.start(env.client);
  assert.deepEqual(env.coordinator.requestHeaders(), { 'x-dcats-window-id': 'synthetic-window', 'x-dcats-write-generation': '1' });
  assert.equal(env.calls[0].input.target_action, 'register');
  assert.equal(env.calls[0].input.target_screen_name, 'search');
  assert.equal(env.timers.size, 1);
  env.coordinator.stop(); assert.equal(env.timers.size, 0);
});
test('a second device remains read-only and handoff retries retain the request identity', async () => {
  const env = setup(() => response('read'));
  await env.coordinator.start(env.client);
  assert.equal(env.coordinator.getState().mode, 'read');
  await env.coordinator.requestHandoff(); await env.coordinator.requestHandoff();
  assert.equal(env.calls[1].input.target_request_id, env.calls[2].input.target_request_id);
});
test('network loss and malformed responses fail closed', async () => {
  let fail = false;
  const env = setup(() => { if (fail) throw new Error('private network detail'); return response(); });
  await env.coordinator.start(env.client); fail = true;
  await env.coordinator.refresh();
  assert.equal(env.coordinator.getState().mode, 'read');
  assert.equal(env.coordinator.getState().error, 'DCATS_WORKSPACE_UNAVAILABLE');
  const malformed = setup(() => ({ data: { ...response().data, max_windows: 99 } }));
  await malformed.coordinator.start(malformed.client);
  assert.equal(malformed.coordinator.getState().mode, 'read');
});
test('window-limit registration never receives write permission', async () => {
  const env = setup(() => ({ error: { message: 'DCATS_WINDOW_LIMIT' } }));
  await env.coordinator.start(env.client);
  assert.equal(env.coordinator.getState().mode, 'read');
  assert.equal(env.coordinator.getState().generation, null);
});
test('logout ignores an in-flight response from the old lifecycle', async () => {
  let resolve;
  const env = setup(() => new Promise(r => { resolve = r; }));
  const pending = env.coordinator.start(env.client);
  env.coordinator.stop(); resolve(response()); await pending;
  assert.equal(env.coordinator.getState().mode, 'read');
  assert.equal(env.coordinator.getState().generation, null);
  assert.equal(env.timers.size, 0);
});
test('heartbeat calls are coalesced', async () => {
  let release;
  const env = setup((_, input) => input.target_action === 'register' ? response() : new Promise(r => { release = r; }));
  await env.coordinator.start(env.client);
  const first = env.coordinator.refresh(), second = env.coordinator.refresh();
  release(response()); await Promise.all([first, second]);
  assert.equal(env.calls.length, 2);
});
test('per-window restoration and product CAS are integrated without localStorage snapshots', () => {
  const app = fs.readFileSync(new URL('../app.js', `file://${__dirname.replace(/\\/g, '/')}/`), 'utf8');
  assert.match(app, /sessionStorage\.setItem\(window\.DcatsWorkspace/);
  assert.doesNotMatch(app, /localStorage\.setItem\(APP_RESTORE_STATE_KEY/);
  assert.match(app, /\.eq\("edit_version", before\.edit_version\)/);
  assert.match(app, /!r\.error && !r\.data/);
  assert.match(app, /resetAutoLogoutTimer\(fromOtherWindow\)/);
  assert.match(app, /!requestedFinishedLabelPrintStationTarget\(\)\) await window\.DcatsWorkspace\.start/);
});

test('a duplicated window obtains its own identity; a reload can reuse a released identity', async () => {
  const held = new Set(); let generated = 0;
  const options = { randomUUID: () => `generated-${++generated}`, adopt() {}, locks: {
    async request(name, _, callback) {
      if (held.has(name)) return callback(null);
      held.add(name); try { await callback({ name }); } finally { held.delete(name); }
    }
  } };
  const first = holdWindowIdentity('same', options);
  assert.equal(await first.ready, 'same');
  const duplicate = holdWindowIdentity('same', options);
  assert.equal(await duplicate.ready, 'generated-1');
  first.release(); await new Promise(resolve => setImmediate(resolve));
  const reload = holdWindowIdentity('same', options);
  assert.equal(await reload.ready, 'same');
  duplicate.release(); reload.release();
});

test('without Web Locks a document never reuses a potentially cloned identity', async () => {
  const lock = holdWindowIdentity('cloned', { randomUUID: () => 'new-document', adopt() {} });
  assert.equal(await lock.ready, 'new-document');
});

test('only gated write functions receive fence headers; read-only CORS stays unchanged', () => {
  assert.equal(operationFunction('/functions/v1/product-3d-glb'), 'product-3d-glb');
  assert.equal(operationFunction('/functions/v1/rakuten-search'), '');
  assert.equal(operationFunction('/functions/v1/product-3d-hunyuan-readiness'), '');
  assert.equal(operationFunction('/functions/v1/concierge-ai-assist'), '');
  assert.equal(operationFunction('/functions/v1/record-hanbaioh-production-backup-enrollment'), '');
});
test('business retries retain a request ID, but receipt actions stay distinct', async () => {
  const crypto = require('node:crypto').webcrypto;
  const body = JSON.stringify({ action: 'invite', idempotency_key: 'persisted-fixture-key' });
  const first = await operationRequestId('invite-internal-user', body, crypto);
  assert.equal(await operationRequestId('invite-internal-user', body, crypto), first);
  assert.notEqual(await operationRequestId('invite-internal-user', body.replace('invite', 'cancel'), crypto), first);
  assert.notEqual(await operationRequestId('invite-customer-user', body, crypto), first);
  assert.notEqual(await operationRequestId('product-3d-glb', undefined, crypto), await operationRequestId('product-3d-glb', undefined, crypto));
});

test('cart drafts are scoped to both Auth user and work window', () => {
  const app = fs.readFileSync(require('node:path').join(__dirname, '../app.js'), 'utf8');
  const body = app.slice(app.indexOf('function customerOrderCartStorageKey()'), app.indexOf('function persistCustomerOrderCart()'));
  let windowId = 'window-a';
  const context = vm.createContext({ CUSTOMER_ORDER_CART_STORAGE_KEY: 'cart', currentUser: { id: 'user-a' },
    activeCustomerPortalContext: () => ({ sales_customer_id: 'customer' }), canPreviewCustomerPortal: () => false,
    window: { DcatsWorkspace: { storageKey: (name, user) => `${name}:${user}:${windowId}` } } });
  vm.runInContext(body, context);
  assert.equal(context.customerOrderCartStorageKey(), 'cart:customer:user-a:window-a');
  windowId = 'window-b';
  assert.equal(context.customerOrderCartStorageKey(), 'cart:customer:user-a:window-b');
  context.currentUser = { id: 'user-b' };
  assert.equal(context.customerOrderCartStorageKey(), 'cart:customer:user-b:window-b');
  const profile = app.slice(app.indexOf('async function loadProfile()'), app.indexOf('function activityPageUrl()'));
  assert.ok(profile.indexOf('DcatsWorkspace.start') < profile.indexOf('restoreCustomerOrderCart()'));
});

test('restore cannot apply another user draft and logout clears the snapshot', async () => {
  const app = fs.readFileSync(require('node:path').join(__dirname, '../app.js'), 'utf8');
  const start = app.indexOf('async function restoreAppStateAfterRefresh()');
  const guardEnd = app.indexOf('  appRestoreInProgress = true;', start);
  const prefix = app.slice(start, guardEnd) + '\n}';
  const context = vm.createContext({ appRestoreInProgress: false, currentUser: { id: 'new-user' },
    consumeAppRestoreState: () => ({ screen: 'search', userId: 'old-user' }) });
  vm.runInContext(prefix, context);
  await context.restoreAppStateAfterRefresh();
  assert.equal(context.appRestoreInProgress, false);
  assert.match(app, /userId: currentUser \? currentUser\.id : null/);
  assert.match(app, /function resetAuthenticatedAppState\(\) \{\s*stopFinishedLabelPrintStation\(\);\s*clearAppRestoreState\(\);/);
});
