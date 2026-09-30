const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function loadProduct3D(rows) {
  const calls = [];
  const sandbox = {
    window: {},
    document: { readyState: 'loading', addEventListener() {} },
    console,
    sb: {
      from(table) {
        calls.push(table);
        const query = {
          select() { return query; },
          eq() { return query; },
          order() { return Promise.resolve(rows[table]); }
        };
        return query;
      }
    }
  };
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, '..', 'product-3d.js'), 'utf8'),
    sandbox,
    { filename: 'product-3d.js' }
  );
  return { api: sandbox.window.DcatsProduct3D, calls };
}

test('published generated and uploaded GLBs share a viewer-facing record', async () => {
  const { api, calls } = loadProduct3D({
    product_3d_viewer_models: {
      data: [
        { id: '17', model_source: 'generated', published_model_path: 'published/a.glb' },
        { id: 'uploaded:123', model_source: 'uploaded', published_model_path: 'uploaded/b.glb' }
      ],
      error: null
    }
  });
  const models = await api.fetchPublishedModels(42);
  assert.equal(models.length, 2);
  assert.equal(models[0].published_model_path, 'published/a.glb');
  assert.equal(models[1].published_model_path, 'uploaded/b.glb');
  assert.deepEqual(calls, ['product_3d_viewer_models']);
});

test('generated viewer remains available before the additive migration', async () => {
  const { api, calls } = loadProduct3D({
    product_3d_viewer_models: { data: null, error: { message: 'view unavailable' } },
    product_3d_models: { data: [{ id: 17, published_model_path: 'published/a.glb' }], error: null }
  });
  const models = await api.fetchPublishedModels(42);
  assert.equal(models.length, 1);
  assert.equal(models[0].model_source, 'generated');
  assert.deepEqual(calls, ['product_3d_viewer_models', 'product_3d_models']);
});

test('product editor and common viewer controls are wired in the page', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  for (const id of [
    'btn-image-action-upload-glb', 'production-image-action-upload-glb',
    'product-3d-glb-file', 'product-3d-viewer-zoom-in',
    'product-3d-viewer-zoom-out', 'product-3d-viewer-reset',
    'product-3d-viewer-fullscreen'
  ]) {
    assert.match(html, new RegExp('id="' + id + '"'));
  }
});

async function renderAdminModels(rows) {
  const source = fs.readFileSync(path.join(__dirname, '..', 'product-3d.js'), 'utf8');
  const start = source.indexOf('  async function renderMediaPane(context) {');
  const end = source.indexOf('  function modelStatusLabel(status) {', start);
  assert(start >= 0 && end > start, '3D media pane must remain testable');
  const host = { innerHTML: '', isConnected: true };
  const context = {
    sessionModelsEnabled: true,
    modelCacheEpoch: 0,
    selectedTarget: () => ({ product: { dkd_shohin_id: 42 }, kind: 'rebuilt' }),
    productId: product => product.dkd_shohin_id,
    el: id => id === 'sales-product-3d-list' ? host : null,
    canReview3D: () => true,
    canManage3D: () => true,
    canPublish3D: () => false,
    fetchInternalModels: async () => rows,
    fetchPublishedModels: async () => { throw new Error('not a customer pane'); },
    modelStatusLabel: status => status,
    kindLabel: () => 'リビルト',
    esc: value => String(value ?? ''),
  };
  const render = vm.runInNewContext(`${source.slice(start, end)}\nrenderMediaPane`, context);
  await render('sales');
  return host.innerHTML;
}

test('failed generation still offers GLB upload without a ready alternative', async () => {
  const html = await renderAdminModels([
    { id: 17, product_kind: 'rebuilt', model_source: 'generated', status: 'failed' }
  ]);
  assert.match(html, /3Dモデルを生成できませんでした。GLBファイルをアップロードしてください。/);
  assert.match(html, /data-upload-3d='sales'/);
});

test('ready uploaded GLB clears obsolete generation fallback and can open in the common viewer', async () => {
  const html = await renderAdminModels([
    { id: 17, product_kind: 'rebuilt', model_source: 'generated', status: 'failed' },
    { id: 'uploaded:18', product_kind: 'rebuilt', model_source: 'uploaded', status: 'published', published_model_path: 'uploaded/18.glb' }
  ]);
  assert.doesNotMatch(html, /GLBファイルをアップロードしてください/);
  assert.match(html, /data-open-model='uploaded:18'/);
});

test('a ready model for another product kind does not hide this kind’s upload fallback', async () => {
  const html = await renderAdminModels([
    { id: 17, product_kind: 'rebuilt', model_source: 'generated', status: 'failed' },
    { id: 'uploaded:19', product_kind: 'aftermarket_new', model_source: 'uploaded', status: 'published', published_model_path: 'uploaded/19.glb' }
  ]);
  assert.match(html, /GLBファイルをアップロードしてください/);
  assert.doesNotMatch(html, /data-open-model='uploaded:19'/);
});

test('a usable generated model also clears an older generation failure prompt', async () => {
  const html = await renderAdminModels([
    { id: 17, product_kind: 'rebuilt', model_source: 'generated', status: 'failed' },
    { id: 18, product_kind: 'rebuilt', model_source: 'generated', status: 'published', published_model_path: 'published/18.glb' }
  ]);
  assert.doesNotMatch(html, /GLBファイルをアップロードしてください/);
  assert.match(html, /data-open-model='18'/);
});
