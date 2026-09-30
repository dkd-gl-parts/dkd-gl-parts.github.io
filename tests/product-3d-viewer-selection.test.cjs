const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'product-3d.js'), 'utf8');
const start = source.indexOf('  async function openViewerById(');
const close = source.indexOf('  function closeViewer() {', start);
const end = source.indexOf('  function closeCapture() {', close);
assert(start >= 0 && close > start && end > close, 'Viewer flow must remain testable');
const viewerSource = source.slice(start, end).replace(
  'await import("./product-3d-viewer.js?v=1.1.1078")',
  'await getViewerModule()'
);
assert(!viewerSource.includes('await import('), 'Viewer test must replace only its dynamic import');

function harness({ onRead, onSign, onCreate } = {}) {
  const state = { productId: 42, kind: 'rebuilt' };
  const calls = { reads: 0, signs: 0, opens: 0, closes: 0, disposes: 0, alerts: [] };
  const overlay = {
    classList: {
      add: () => { calls.opens++; },
      remove: () => { calls.closes++; },
    },
    setAttribute() {},
  };
  const elements = {
    'product-3d-viewer-overlay': overlay,
    'product-3d-viewer-title': { textContent: '' },
    'product-3d-viewer-loading': { hidden: true, textContent: '' },
    'product-3d-viewer-stage': {},
    'product-3d-viewer-shell': {},
  };
  const model = { id: 'uploaded:18', product_kind: 'rebuilt', published_model_path: 'uploaded/18.glb' };
  const context = {
    BUCKET: 'product-3d',
    viewerRequestId: 0,
    sessionModelsEnabled: true,
    viewer: null,
    elements,
    selectedTarget: () => ({ product: { dkd_shohin_id: state.productId }, kind: state.kind }),
    productId: product => product.dkd_shohin_id,
    canReview3D: () => true,
    fetchInternalModels: async () => { calls.reads++; return onRead ? onRead(model) : [model]; },
    fetchPublishedModels: async () => { calls.reads++; return onRead ? onRead(model) : [model]; },
    sb: { storage: { from: () => ({ createSignedUrl: async () => {
      calls.signs++;
      return onSign ? onSign(state) : { data: { signedUrl: 'https://example.test/model.glb' }, error: null };
    } }) } },
    getViewerModule: async () => ({ createProduct3DViewer: async () => {
      calls.opens++;
      if (onCreate) await onCreate(state);
      return { dispose: () => { calls.disposes++; } };
    } }),
    productTitle: () => 'fixture',
    kindLabel: () => 'リビルト',
    friendlyError: error => String(error),
    alert: message => calls.alerts.push(message),
  };
  const api = vm.runInNewContext(`${viewerSource}\n({openViewerById, closeViewer})`, context);
  return { api, state, calls, elements, context };
}

test('stale card product ID never reads or opens another product', async () => {
  const qa = harness();
  qa.state.productId = 43;
  await qa.api.openViewerById('uploaded:18', 'sales', 42);
  assert.equal(qa.calls.reads, 0);
  assert.equal(qa.calls.signs, 0);
  assert.equal(qa.calls.opens, 0);
});

test('product switch during model lookup cannot sign or open the stale model', async () => {
  let finishRead;
  const qa = harness({ onRead: () => new Promise(resolve => { finishRead = resolve; }) });
  const pending = qa.api.openViewerById('uploaded:18', 'sales', 42);
  qa.state.productId = 43;
  finishRead([{ id: 'uploaded:18', product_kind: 'rebuilt', published_model_path: 'uploaded/18.glb' }]);
  await pending;
  assert.equal(qa.calls.signs, 0);
  assert.equal(qa.calls.opens, 0);
});

test('kind switch during signed URL request cannot open the old kind', async () => {
  const qa = harness({ onSign: state => {
    state.kind = 'aftermarket_new';
    return { data: { signedUrl: 'https://example.test/model.glb' }, error: null };
  } });
  await qa.api.openViewerById('uploaded:18', 'sales', 42);
  assert.equal(qa.calls.signs, 1);
  assert.equal(qa.calls.opens, 0);
});

test('product switch while the Viewer initializes disposes the stale result', async () => {
  const qa = harness({ onCreate: state => { state.productId = 43; } });
  await qa.api.openViewerById('uploaded:18', 'sales', 42);
  assert.equal(qa.calls.disposes, 1);
  assert.equal(qa.calls.closes, 1);
});

test('unchanged product opens its uploaded GLB normally', async () => {
  const qa = harness();
  await qa.api.openViewerById('uploaded:18', 'sales', 42);
  assert.equal(qa.calls.reads, 1);
  assert.equal(qa.calls.signs, 1);
  assert.equal(qa.calls.opens, 2);
  assert.equal(qa.calls.closes, 0);
  assert.equal(qa.elements['product-3d-viewer-loading'].hidden, true);
});

test('reopening after a load error restores the loading message before success', async () => {
  let fail = true;
  let finishSecond;
  const qa = harness({ onCreate: () => {
    if (fail) throw new Error('fixture offline');
    return new Promise(resolve => { finishSecond = resolve; });
  } });
  await qa.api.openViewerById('uploaded:18', 'sales', 42);
  assert.match(qa.elements['product-3d-viewer-loading'].textContent, /読込に失敗/);
  assert.equal(qa.elements['product-3d-viewer-loading'].hidden, false);
  fail = false;
  const pending = qa.api.openViewerById('uploaded:18', 'sales', 42);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(typeof finishSecond, 'function');
  assert.equal(qa.elements['product-3d-viewer-loading'].textContent, '3Dモデルを読み込んでいます...');
  assert.equal(qa.elements['product-3d-viewer-loading'].hidden, false);
  finishSecond();
  await pending;
  assert.equal(qa.elements['product-3d-viewer-loading'].hidden, true);
});

test('customer viewer uses published data and is not tied to the admin kind selector', async () => {
  const qa = harness({ onSign: state => {
    state.kind = 'aftermarket_new';
    return { data: { signedUrl: 'https://example.test/model.glb' }, error: null };
  } });
  await qa.api.openViewerById('uploaded:18', 'customer', 42);
  assert.equal(qa.calls.reads, 1);
  assert.equal(qa.calls.opens, 2);
  assert.equal(qa.calls.closes, 0);
});

test('sign-out during signed URL request cannot open a model', async () => {
  let qa;
  qa = harness({ onSign: () => {
    qa.context.sessionModelsEnabled = false;
    return { data: { signedUrl: 'https://example.test/model.glb' }, error: null };
  } });
  await qa.api.openViewerById('uploaded:18', 'sales', 42);
  assert.equal(qa.calls.opens, 0);
});
