const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'product-3d.js'), 'utf8');
function extract(first, next) {
  const start = source.indexOf(`  ${first}`);
  const end = source.indexOf(`  ${next}`, start);
  assert(start >= 0 && end > start, `${first} must remain testable`);
  return source.slice(start, end);
}

const availabilitySource = extract('async function refreshMediaAvailability(', 'function visibleProductNodes(');
const renderSource = extract('async function renderMediaPane(', 'function modelStatusLabel(');

function availabilityHarness(context) {
  let finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const state = { kind: 'rebuilt' };
  const calls = { tabs: 0 };
  const switcher = {
    querySelector: () => null,
    appendChild: () => { calls.tabs++; },
    closest: () => null,
  };
  const pane = {
    parentElement: { querySelector: () => switcher },
    isConnected: true,
    hidden: true,
  };
  const scope = {
    sessionModelsEnabled: true,
    mediaAvailabilityRequest: { sales: 0, customer: 0 },
    selectedTarget: () => ({ product: { dkd_shohin_id: 42 }, kind: state.kind }),
    productId: product => product.dkd_shohin_id,
    canReview3D: () => true,
    canManage3D: () => true,
    fetchInternalModels: () => pending,
    fetchPublishedModels: () => pending,
    document: {
      querySelector: () => pane,
      createElement: () => ({ className: '', dataset: {}, setAttribute() {} }),
    },
  };
  const refresh = vm.runInNewContext(`${availabilitySource}\nrefreshMediaAvailability`, scope);
  return { refresh: () => refresh(context), state, finish, calls };
}

test('an old admin kind cannot reveal a 3D tab after the kind changes', async () => {
  const qa = availabilityHarness('sales');
  const oldRead = qa.refresh();
  qa.state.kind = 'aftermarket_new';
  qa.finish([{ product_kind: 'rebuilt' }]);
  await oldRead;
  assert.equal(qa.calls.tabs, 0);
});

test('customer model availability remains independent of the admin kind', async () => {
  const qa = availabilityHarness('customer');
  const read = qa.refresh();
  qa.state.kind = 'aftermarket_new';
  qa.finish([{ product_kind: 'rebuilt' }]);
  await read;
  assert.equal(qa.calls.tabs, 1);
});

test('a delayed old-kind card cannot replace the current kind card', async () => {
  let finishOld;
  const oldRows = new Promise(resolve => { finishOld = resolve; });
  const state = { kind: 'rebuilt', first: true };
  const host = { innerHTML: '', isConnected: true };
  const scope = {
    sessionModelsEnabled: true,
    modelCacheEpoch: 0,
    selectedTarget: () => ({ product: { dkd_shohin_id: 42 }, kind: state.kind }),
    productId: product => product.dkd_shohin_id,
    el: () => host,
    canReview3D: () => true,
    canManage3D: () => true,
    canPublish3D: () => false,
    fetchInternalModels: () => state.first ? oldRows : Promise.resolve([
      { id: 'new-kind', product_kind: 'aftermarket_new', model_source: 'uploaded', status: 'published', published_model_path: 'uploaded/new.glb' },
    ]),
    fetchPublishedModels: () => { throw new Error('admin should use internal models'); },
    modelStatusLabel: status => status,
    kindLabel: kind => kind,
    esc: value => String(value ?? ''),
  };
  const render = vm.runInNewContext(`${renderSource}\nrenderMediaPane`, scope);
  const stale = render('sales');
  state.kind = 'aftermarket_new';
  state.first = false;
  await render('sales');
  assert.match(host.innerHTML, /new-kind/);
  finishOld([{ id: 'old-kind', product_kind: 'rebuilt', model_source: 'uploaded', status: 'published', published_model_path: 'uploaded/old.glb' }]);
  await stale;
  assert.match(host.innerHTML, /new-kind/);
  assert.doesNotMatch(host.innerHTML, /old-kind/);
});
