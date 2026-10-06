const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'product-3d.js'), 'utf8');
const stylesheet = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
const start = source.indexOf('  async function openViewerById(');
const close = source.indexOf('  function closeViewer() {', start);
const end = source.indexOf('  function closeCapture() {', close);
assert(start >= 0 && close > start && end > close, 'Viewer flow must remain testable');
const viewerSource = source.slice(start, end).replace(
  /await import\("\.\/product-3d-viewer\.js\?v=[^"]+"\)/,
  'await getViewerModule()'
);
assert(!viewerSource.includes('await import('), 'Viewer test must replace only its dynamic import');

function harness({ onRead, onSign, onCreate, onFullscreen } = {}) {
  const state = { productId: 42, kind: 'rebuilt', review: true };
  const calls = { reads: 0, signs: 0, opens: 0, closes: 0, disposes: 0, fullscreenExits: 0, alerts: [] };
  const document = { body: {}, activeElement: null, fullscreenElement: null,
    exitFullscreen() { calls.fullscreenExits++; this.fullscreenElement = null; return Promise.resolve(); } };
  const control = () => ({ isConnected: true, hidden: false, disabled: false,
    attributes: {},
    setAttribute(name, value) { this.attributes[name] = value; },
    focus() { document.activeElement = this; } });
  const trigger = control();
  trigger.focus();
  const classes = new Set();
  const overlay = {
    classList: {
      add: name => { classes.add(name); calls.opens++; },
      remove: name => { classes.delete(name); calls.closes++; },
      contains: name => classes.has(name),
    },
    setAttribute() {},
  };
  const elements = {
    'product-3d-viewer-overlay': overlay,
    'product-3d-viewer-close': control(),
    'product-3d-viewer-zoom-in': control(),
    'product-3d-viewer-zoom-out': control(),
    'product-3d-viewer-reset': control(),
    'product-3d-viewer-autorotate': control(),
    'product-3d-viewer-fullscreen': control(),
    'product-3d-viewer-title': { textContent: '' },
    'product-3d-viewer-loading': { hidden: true, textContent: '' },
    'product-3d-viewer-fullscreen-notice': { hidden: true },
    'product-3d-viewer-stage': {},
    'product-3d-viewer-shell': {},
  };
  const model = { id: 'uploaded:18', product_kind: 'rebuilt', published_model_path: 'uploaded/18.glb' };
  const context = {
    BUCKET: 'product-3d',
    viewerRequestId: 0,
    viewerReturnFocus: null,
    viewerFocusTarget: null,
    sessionModelsEnabled: true,
    viewer: null,
    document,
    elements,
    selectedTarget: () => ({ product: { dkd_shohin_id: state.productId }, kind: state.kind }),
    productId: product => product.dkd_shohin_id,
    canReview3D: () => state.review,
    fetchInternalModels: async () => { calls.reads++; return onRead ? onRead(model) : [model]; },
    fetchPublishedModels: async () => { calls.reads++; return onRead ? onRead(model) : [model]; },
    sb: { storage: { from: () => ({ createSignedUrl: async () => {
      calls.signs++;
      return onSign ? onSign(state) : { data: { signedUrl: 'https://example.test/model.glb' }, error: null };
    } }) } },
    getViewerModule: async () => ({ createProduct3DViewer: async () => {
      calls.opens++;
      if (onCreate) await onCreate(state);
      return { dispose: () => { calls.disposes++; }, fullscreen: () => onFullscreen ? onFullscreen() : Promise.resolve() };
    } }),
    productTitle: () => 'fixture',
    kindLabel: () => 'リビルト',
    friendlyError: error => String(error),
    alert: message => calls.alerts.push(message),
    console: { warn() {} },
  };
  const api = vm.runInNewContext(`${viewerSource}\n({openViewerById, keepViewerFocus, toggleViewerFullscreen, closeViewer})`, context);
  return { api, state, calls, elements, context, document, trigger };
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

test('review permission lost during signed URL request cannot open an internal model', async () => {
  const qa = harness({ onSign: state => {
    state.review = false;
    return { data: { signedUrl: 'https://example.test/model.glb' }, error: null };
  } });
  await qa.api.openViewerById('uploaded:18', 'sales', 42);
  assert.equal(qa.calls.signs, 1);
  assert.equal(qa.calls.opens, 0);
});

test('signed URL transport rejection leaves the product page usable', async () => {
  const qa = harness({ onSign: () => { throw new Error('network unavailable'); } });
  await qa.api.openViewerById('uploaded:18', 'sales', 42);
  assert.equal(qa.calls.signs, 1);
  assert.equal(qa.calls.opens, 0);
  assert.equal(qa.calls.alerts.length, 1);
  assert.match(qa.calls.alerts[0], /network unavailable/);
  assert.equal(qa.elements['product-3d-viewer-overlay'].classList.contains('show'), false);
});

test('empty successful signed URL response fails closed', async () => {
  const qa = harness({ onSign: () => ({ data: {}, error: null }) });
  await qa.api.openViewerById('uploaded:18', 'sales', 42);
  assert.equal(qa.calls.signs, 1);
  assert.equal(qa.calls.opens, 0);
  assert.match(qa.calls.alerts[0], /署名URLを取得できませんでした/);
});

test('signed URL failure after a product switch does not show a stale error', async () => {
  const qa = harness({ onSign: state => {
    state.productId = 43;
    throw new Error('stale network failure');
  } });
  await qa.api.openViewerById('uploaded:18', 'sales', 42);
  assert.equal(qa.calls.opens, 0);
  assert.deepEqual(qa.calls.alerts, []);
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
  assert.equal(qa.document.activeElement, qa.elements['product-3d-viewer-close']);
  qa.api.closeViewer();
  assert.equal(qa.document.activeElement, qa.trigger);
});

test('successful GLB load removes the opaque loading layer', () => {
  assert.match(stylesheet, /\.product-3d-viewer-loading\[hidden\]\s*\{\s*display:\s*none\s*;/);
});

test('fullscreen denial leaves the Viewer open with a nonblocking notice', async () => {
  const qa = harness({ onFullscreen: () => Promise.reject(new Error('not granted')) });
  await qa.api.openViewerById('uploaded:18', 'sales', 42);
  await qa.api.toggleViewerFullscreen();
  assert.equal(qa.calls.closes, 0);
  assert.equal(qa.elements['product-3d-viewer-loading'].hidden, true);
  assert.equal(qa.elements['product-3d-viewer-fullscreen-notice'].hidden, false);
  assert.match(stylesheet, /\.product-3d-viewer-toolbar\s+\[hidden\]\s*\{\s*display:\s*none\s*;/);
});

test('subsequent fullscreen success clears the previous notice', async () => {
  let denied = true;
  const qa = harness({ onFullscreen: () => denied ? Promise.reject(new Error('not granted')) : Promise.resolve() });
  await qa.api.openViewerById('uploaded:18', 'sales', 42);
  await qa.api.toggleViewerFullscreen();
  assert.equal(qa.elements['product-3d-viewer-fullscreen-notice'].hidden, false);
  denied = false;
  await qa.api.toggleViewerFullscreen();
  assert.equal(qa.elements['product-3d-viewer-fullscreen-notice'].hidden, true);
});

test('closing Viewer exits only its own fullscreen shell', async () => {
  const qa = harness();
  await qa.api.openViewerById('uploaded:18', 'sales', 42);
  qa.document.fullscreenElement = qa.elements['product-3d-viewer-shell'];
  qa.api.closeViewer();
  assert.equal(qa.calls.fullscreenExits, 1);
  assert.equal(qa.document.fullscreenElement, null);

  await qa.api.openViewerById('uploaded:18', 'sales', 42);
  const unrelated = {};
  qa.document.fullscreenElement = unrelated;
  qa.api.closeViewer();
  assert.equal(qa.calls.fullscreenExits, 1);
  assert.equal(qa.document.fullscreenElement, unrelated);
});

test('Tab and Shift+Tab stay inside the open Viewer dialog', async () => {
  const qa = harness();
  await qa.api.openViewerById('uploaded:18', 'sales', 42);
  const first = qa.elements['product-3d-viewer-close'];
  const last = qa.elements['product-3d-viewer-fullscreen'];
  let prevented = false;
  qa.api.keepViewerFocus({ key: 'Tab', shiftKey: true, preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(qa.document.activeElement, last);
  prevented = false;
  qa.api.keepViewerFocus({ key: 'Tab', shiftKey: false, preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(qa.document.activeElement, first);
  qa.trigger.focus();
  prevented = false;
  qa.api.keepViewerFocus({ key: 'Tab', shiftKey: false, preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(qa.document.activeElement, first);
});

test('closing after product or account change does not restore stale focus', async () => {
  const qa = harness();
  await qa.api.openViewerById('uploaded:18', 'sales', 42);
  qa.state.productId = 43;
  qa.api.closeViewer();
  assert.equal(qa.document.activeElement, qa.elements['product-3d-viewer-close']);
  qa.state.productId = 42;
  qa.trigger.focus();
  await qa.api.openViewerById('uploaded:18', 'sales', 42);
  qa.context.sessionModelsEnabled = false;
  qa.api.closeViewer();
  assert.equal(qa.document.activeElement, qa.elements['product-3d-viewer-close']);
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
