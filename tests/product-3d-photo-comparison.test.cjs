const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'product-3d.js'), 'utf8');
const start = source.indexOf('  function clearViewerComparison(');
const end = source.indexOf('  async function showCommonViewer(', start);
assert(start >= 0 && end > start);
function harness({ sign } = {}) {
  const signed = [];
  const buttons = [179, 171].map(id => ({ dataset: { viewerReference: String(id) },
    attributes: {}, setAttribute(name, value) { this.attributes[name] = value; } }));
  const element = () => ({ hidden: true, textContent: '', innerHTML: '', attributes: {},
    setAttribute(name, value) { this.attributes[name] = value; },
    removeAttribute(name) { delete this[name]; } });
  const elements = Object.fromEntries(['compare', 'reference', 'reference-image', 'reference-label', 'reference-photos']
    .map(id => ['product-3d-viewer-' + id, element()]));
  const classes = new Set();
  elements['product-3d-viewer-shell'] = { classList: {
    remove: name => classes.delete(name), toggle(name, enabled) { enabled ? classes.add(name) : classes.delete(name); } } };
  elements['product-3d-viewer-reference-photos'].querySelectorAll = () => buttons;
  const context = { elements, viewerRequestId: 4, viewerComparisonRequestId: 0, viewerComparisonTarget: null,
    tripoJob: { status: 'review' }, tripoRequestId: 2, current: true,
    sameTripoTarget: id => id === context.tripoRequestId && context.current,
    tripoImageRows: {
      '179': { id: 179, selectionIndex: 0, storage_path: 'same-product/top.jpg', previewUrl: '/top-thumb.png', selectionLabel: '画像 5 / ID 179' },
      '171': { id: 171, selectionIndex: 1, storage_path: 'same-product/bottom.jpg', previewUrl: '/bottom-thumb.png', selectionLabel: '画像 13 / ID 171' },
    },
    esc: value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]),
    signProductImageUrl: async file => { signed.push(file); return sign ? sign(file) : '/original.png'; },
  };
  const api = vm.runInNewContext(source.slice(start, end) + '\n({ clearViewerComparison, prepareViewerComparison, toggleViewerComparison, selectViewerReference })', context);
  return { api, context, elements, signed, buttons, classes };
}
test('photo comparison is opt-in and uses saved original photos, including top and bottom', async () => {
  const qa = harness();
  qa.api.prepareViewerComparison(2, 4);
  assert.equal(qa.elements['product-3d-viewer-compare'].hidden, false);
  assert.equal(qa.elements['product-3d-viewer-reference'].hidden, true);
  assert.deepEqual(qa.signed, []);
  qa.api.toggleViewerComparison();
  const gallery = qa.elements['product-3d-viewer-reference-photos'].innerHTML;
  assert(gallery.indexOf("data-viewer-reference='179'") < gallery.indexOf("data-viewer-reference='171'"));
  await qa.api.selectViewerReference(171);
  const image = qa.elements['product-3d-viewer-reference-image'];
  assert.deepEqual(qa.signed, ['same-product/bottom.jpg']);
  assert.equal(image.src, '/original.png');
  image.onload();
  assert.match(qa.elements['product-3d-viewer-reference-label'].textContent, /画像 13.*元画像.*照合専用/);
  assert.equal(qa.buttons[1].attributes['aria-pressed'], 'true');
});
test('a closed, different or non-review target cannot open private references', () => {
  for (const change of [q => q.context.current = false, q => q.context.viewerRequestId++,
    q => q.context.tripoJob.status = 'published']) {
    const qa = harness(); qa.api.prepareViewerComparison(2, 4); change(qa);
    qa.api.toggleViewerComparison();
    assert.equal(qa.elements['product-3d-viewer-reference'].hidden, true);
    assert.equal(qa.elements['product-3d-viewer-compare'].hidden, true);
    assert.deepEqual(qa.signed, []);
  }
});
test('fast photo switching cannot restore an older signed original', async () => {
  const completions = [];
  const qa = harness({ sign: () => new Promise(resolve => completions.push(resolve)) });
  qa.api.prepareViewerComparison(2, 4); qa.api.toggleViewerComparison();
  const old = qa.api.selectViewerReference(179);
  const latest = qa.api.selectViewerReference(171);
  completions[1]('/latest.png'); await latest;
  completions[0]('/stale.png'); await old;
  assert.equal(qa.elements['product-3d-viewer-reference-image'].src, '/latest.png');
});
test('pending signed originals are discarded on close, collapse, target or permission loss', async () => {
  for (const change of [q => q.api.clearViewerComparison(), q => q.api.toggleViewerComparison(),
    q => q.context.current = false, q => q.context.viewerRequestId++]) {
    let finish;
    const qa = harness({ sign: () => new Promise(resolve => { finish = resolve; }) });
    qa.api.prepareViewerComparison(2, 4); qa.api.toggleViewerComparison();
    const pending = qa.api.selectViewerReference(179); change(qa);
    finish('/late-secret.png'); await pending;
    assert.equal(qa.elements['product-3d-viewer-reference-image'].src, undefined);
    assert.equal(qa.elements['product-3d-viewer-reference'].hidden, true);
  }
});
test('missing originals and failed image decoding do not claim a successful quality review', async () => {
  const failed = harness({ sign: async () => { throw new Error('unavailable'); } });
  failed.api.prepareViewerComparison(2, 4); failed.api.toggleViewerComparison();
  await failed.api.selectViewerReference(179);
  assert.match(failed.elements['product-3d-viewer-reference-label'].textContent, /取得できません.*縮小写真のみ/);
  const qa = harness(); qa.api.prepareViewerComparison(2, 4); qa.api.toggleViewerComparison();
  await qa.api.selectViewerReference(179);
  qa.elements['product-3d-viewer-reference-image'].onerror();
  assert.equal(qa.elements['product-3d-viewer-reference-image'].hidden, true);
  assert.match(qa.elements['product-3d-viewer-reference-label'].textContent, /未完了/);
});
test('unavailable or injected references are inert and captions are escaped', async () => {
  const qa = harness();
  qa.context.tripoImageRows['179'].previewUrl = null;
  qa.context.tripoImageRows['171'].selectionLabel = "<img onerror='bad'>";
  qa.api.prepareViewerComparison(2, 4); qa.api.toggleViewerComparison();
  assert.match(qa.elements['product-3d-viewer-reference-photos'].innerHTML, /disabled/);
  assert.doesNotMatch(qa.elements['product-3d-viewer-reference-photos'].innerHTML, /src=''|<img onerror=/);
  await qa.api.selectViewerReference(179); await qa.api.selectViewerReference(9999);
  assert.deepEqual(qa.signed, []);
});
test('comparison never mutates the generation inputs, publishes or uploads data', () => {
  const comparison = source.slice(start, end);
  assert.doesNotMatch(comparison, /tripoInvoke|selectedTripoImages|sb\.|\.upload\(|\.insert\(|\.update\(|\.rpc\(|confirm\(/);
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(html, /上下の元写真も選べます。Tripoへの追加送信・課金・3D形状の補正は行いません/);
  assert.match(source, /function closeViewer\(\) \{\s*viewerRequestId \+= 1;\s*clearViewerComparison\(\)/);
  assert.match(source, /function closeTripo\(\) \{\s*clearViewerComparison\(\)/);
});
