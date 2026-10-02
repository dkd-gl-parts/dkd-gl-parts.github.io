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
    productId: product => product?.dkd_shohin_id || 0,
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

test('clearing a customer product hides the 3D shell when photos are disabled', async () => {
  const modelTab = { hidden: false, classList: { remove() {} }, setAttribute() {} };
  const shell = { hidden: false, dataset: { noPhotos: 'true' } };
  const switcher = {
    querySelector: selector => selector.includes("='model'") ? modelTab : null,
    closest: () => shell,
  };
  const pane = {
    hidden: false,
    parentElement: { querySelector: selector => selector === '.product-media-switch' ? switcher : null },
  };
  const host = { textContent: 'previous-product-card' };
  const scope = {
    sessionModelsEnabled: true, mediaAvailabilityRequest: { customer: 0 },
    selectedTarget: () => ({ product: null, kind: '' }),
    productId: product => product?.dkd_shohin_id || 0,
    document: { querySelector: () => pane }, el: () => host,
  };
  const refresh = vm.runInNewContext(`${availabilitySource}\nrefreshMediaAvailability`, scope);
  await refresh('customer');
  assert.equal(shell.hidden, true);
  assert.equal(modelTab.hidden, true);
  assert.equal(pane.hidden, true);
  assert.equal(host.textContent, '');
});

test('a permission downgrade hides an existing internal model tab and cards', async () => {
  let finish;
  let review = true;
  const modelTab = { hidden: false, classList: { remove() {} }, setAttribute() {} };
  const photosTab = { classList: { add() {} }, setAttribute() {} };
  const photosPane = { hidden: true };
  const switcher = { querySelector: selector => selector.includes("='model'") ? modelTab : photosTab, closest: () => null };
  const pane = { isConnected: true, hidden: false, parentElement: {
    querySelector: selector => selector === '.product-media-switch' ? switcher : photosPane,
  } };
  const host = { textContent: 'internal-only' };
  const scope = {
    sessionModelsEnabled: true, mediaAvailabilityRequest: { sales: 0 },
    selectedTarget: () => ({ product: { dkd_shohin_id: 42 }, kind: 'rebuilt' }),
    productId: product => product?.dkd_shohin_id || 0,
    canReview3D: () => review, canManage3D: () => true,
    fetchInternalModels: () => new Promise(resolve => { finish = resolve; }),
    document: { querySelector: () => pane }, el: () => host,
  };
  const refresh = vm.runInNewContext(`${availabilitySource}\nrefreshMediaAvailability`, scope);
  const pending = refresh('sales');
  review = false;
  finish([{ id: 'internal-only', product_kind: 'rebuilt' }]);
  await pending;
  assert.equal(modelTab.hidden, true);
  assert.equal(pane.hidden, true);
  assert.equal(photosPane.hidden, false);
  assert.equal(host.textContent, '');
  review = true;
  scope.selectedTarget = () => ({ product: null, kind: 'rebuilt' });
  host.textContent = 'previous-product-card';
  modelTab.hidden = false;
  pane.hidden = false;
  photosPane.hidden = true;
  await refresh('sales');
  assert.equal(modelTab.hidden, true);
  assert.equal(pane.hidden, true);
  assert.equal(host.textContent, '');
});

test('a delayed old-kind card cannot replace the current kind card', async () => {
  let finishOld;
  const oldRows = new Promise(resolve => { finishOld = resolve; });
  const state = { kind: 'rebuilt', first: true, review: true, manage: true };
  const host = { innerHTML: '', isConnected: true };
  const scope = {
    sessionModelsEnabled: true,
    modelCacheEpoch: 0,
    mediaPaneRequest: { sales: 0 },
    selectedTarget: () => ({ product: { dkd_shohin_id: 42 }, kind: state.kind }),
    productId: product => product.dkd_shohin_id,
    el: () => host,
    canReview3D: () => state.review,
    canManage3D: () => state.manage,
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

test('an older response for the same product cannot overwrite a newer card', async () => {
  let finishOld;
  const host = { innerHTML: '', isConnected: true };
  let calls = 0;
  const scope = {
    sessionModelsEnabled: true, modelCacheEpoch: 0, mediaPaneRequest: { sales: 0 },
    selectedTarget: () => ({ product: { dkd_shohin_id: 42 }, kind: 'rebuilt' }),
    productId: product => product?.dkd_shohin_id || 0, el: () => host,
    canReview3D: () => true, canManage3D: () => true, canPublish3D: () => false,
    fetchInternalModels: () => ++calls === 1
      ? new Promise(resolve => { finishOld = resolve; })
      : Promise.resolve([{ id: 'new-card', product_kind: 'rebuilt', model_source: 'uploaded', status: 'published', published_model_path: 'new.glb' }]),
    modelStatusLabel: status => status, kindLabel: kind => kind, esc: value => String(value ?? ''),
  };
  const render = vm.runInNewContext(`${renderSource}\nrenderMediaPane`, scope);
  const old = render('sales');
  await render('sales');
  finishOld([{ id: 'old-card', product_kind: 'rebuilt', model_source: 'uploaded', status: 'published', published_model_path: 'old.glb' }]);
  await old;
  assert.match(host.innerHTML, /new-card/);
  assert.doesNotMatch(host.innerHTML, /old-card/);
});

test('a delayed internal response is not displayed after review permission is lost', async () => {
  let finish;
  let review = true;
  const host = { innerHTML: '', textContent: '', isConnected: true };
  const scope = {
    sessionModelsEnabled: true, modelCacheEpoch: 0, mediaPaneRequest: { sales: 0 },
    selectedTarget: () => ({ product: { dkd_shohin_id: 42 }, kind: 'rebuilt' }),
    productId: product => product?.dkd_shohin_id || 0, el: () => host,
    canReview3D: () => review, canManage3D: () => true, canPublish3D: () => false,
    fetchInternalModels: () => new Promise(resolve => { finish = resolve; }),
    modelStatusLabel: status => status, kindLabel: kind => kind, esc: value => String(value ?? ''),
  };
  const render = vm.runInNewContext(`${renderSource}\nrenderMediaPane`, scope);
  const pending = render('sales');
  review = false;
  finish([{ id: 'internal-only', product_kind: 'rebuilt', model_source: 'generated', status: 'review', published_model_path: 'internal.glb' }]);
  await pending;
  assert.doesNotMatch(host.innerHTML, /internal-only/);
  assert.match(host.textContent, /表示条件が変わりました/);
  scope.selectedTarget = () => ({ product: null, kind: 'rebuilt' });
  await render('sales');
  assert.equal(host.textContent, '');
});
