// Loopback synthetic QA. No authentication, Supabase, private images or Tripo calls.
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'product-3d.js'), 'utf8');
const page = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const first = page.indexOf('<div class="form-overlay product-3d-viewer-overlay"');
const last = page.indexOf('<input id="product-3d-glb-file"', first);
const markup = page.slice(first, last);
const functions = source.slice(source.indexOf('  function clearViewerComparison('), source.indexOf('  function closeCapture() {'));
const textureFixture = fs.readFileSync(path.join(root, 'tests/product-3d-texture-fixture.js'), 'utf8');
const model = textureFixture.slice(textureFixture.indexOf('const png ='), textureFixture.indexOf("if (new URL(location.href)"));
const script = `
const params = new URLSearchParams(location.search);
var viewer = null, viewerRequestId = 1, viewerReturnFocus = null, viewerFocusTarget = null;
var viewerComparisonTarget = null, viewerComparisonRequestId = 0, sessionModelsEnabled = true;
var viewerExportTarget = null;
var tripoJob = { status: 'review' }, tripoRequestId = 1;
var elements = Object.fromEntries(Array.from(document.querySelectorAll('[id]')).map(node => [node.id, node]));
var current = true;
var sameTripoTarget = id => id === tripoRequestId && current && params.get('role') !== 'staff';
var selectedTarget = () => ({product: {id: 900001}, kind: 'aftermarket_new'});
var productId = product => product.id;
var canManageGlb = () => params.get('role') !== 'staff';
var t = key => key === 'product_3d_review_export_stale'
  ? '保存リンクの期限または対象が変わりました。非公開プレビューを開き直してください。再生成・課金は不要です。' : key;
var cleanKind = kind => ['rebuilt', 'aftermarket_new'].includes(kind) ? kind : '';
var friendlyError = error => error.message;
var esc = value => String(value).replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[char]);
var signProductImageUrl = async file => {
  if (params.get('mode') === 'error') throw new Error('Synthetic missing original');
  return params.get('mode') === 'invalid' ? '/missing-image.png' : file;
};
var tripoImageRows = Object.fromEntries(Array.from({length: 6}, (_, index) => {
  const id = 179 - index;
  return [String(id), {id, selectionIndex: index, selectionLabel: '合成写真 ' + (index + 1) + ' / ' + ['上部', '下部', '正面', '背面', '左側', '右側'][index],
    storage_path: '/photo.svg?view=' + index, previewUrl: '/photo.svg?view=' + index}];
}));
${functions}
${model}
document.getElementById('product-3d-viewer-compare').addEventListener('click', toggleViewerComparison);
document.getElementById('product-3d-viewer-reference-photos').addEventListener('click', event => {
  const button = event.target.closest('[data-viewer-reference]');
  if (button) selectViewerReference(button.dataset.viewerReference);
});
document.getElementById('product-3d-viewer-close').addEventListener('click', closeViewer);
for (const [id, action] of [['zoom-in','zoomIn'],['zoom-out','zoomOut'],['reset','reset']])
  document.getElementById('product-3d-viewer-' + id).addEventListener('click', () => {if(viewer) viewer[action]();});
document.getElementById('product-3d-viewer-autorotate').addEventListener('click', event => {
  const enabled = event.target.getAttribute('aria-pressed') !== 'true';
  viewer.setAutoRotate(enabled); event.target.setAttribute('aria-pressed', String(enabled));
});
document.getElementById('product-3d-viewer-fullscreen').addEventListener('click', toggleViewerFullscreen);
document.addEventListener('keydown', event => {if(event.key === 'Escape') closeViewer(); else keepViewerFocus(event);});
await showCommonViewer({buffer: bytes.buffer}, '合成3D / 元写真比較の試験（実商品ではありません）',
  {context: 'sales', productId: 900001, kind: 'aftermarket_new'}, 1, () => viewerRequestId === 1, null);
prepareViewerComparison(1, 1);
if (params.get('export') === '1') {
  document.getElementById('product-3d-viewer-export').addEventListener('click', guardViewerExport);
  prepareViewerExport({reviewExport: true,
    url: 'https://jqoeqximtwfpqwzngutj.supabase.co/storage/v1/object/sign/product-3d/tripo-review/dkd_900001/aftermarket_new/00000000-0000-4000-8000-000000000001.glb?token=synthetic-not-a-credential'},
    {context: 'sales', productId: 900001, kind: 'aftermarket_new'}, 1, () => current, Date.now());
  // Synthetic QA never downloads from production. Keep the validated filename,
  // then serve a disposable, self-contained GLB from this loopback server only.
  if (viewerExportTarget) {
    document.getElementById('product-3d-viewer-export').href = '/synthetic.glb?download=' +
      encodeURIComponent(document.getElementById('product-3d-viewer-export').download);
    if (params.get('mode') === 'expired') viewerExportTarget.expiresAt = 0;
  }
}
`;
const html = `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>商品3D 元写真比較・合成QA</title><link rel="stylesheet" href="/styles.css"><body>${markup}<script type="module" src="/fixture.js"></script></body></html>`;
const csp = fs.readFileSync(path.join(root, '_headers'), 'utf8').match(/Content-Security-Policy:\s*([^\r\n]+)/)[1]
  .replace(/; upgrade-insecure-requests\s*$/, '');
const server = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://localhost');
  let body, type;
  if (url.pathname === '/') {body = html; type = 'text/html';}
  else if (url.pathname === '/fixture.js') {body = script; type = 'text/javascript';}
  else if (url.pathname === '/synthetic.glb') {
    const doc = {asset: {version: '2.0'}, scenes: [{nodes: [0]}], nodes: [{mesh: 0}],
      meshes: [{primitives: [{attributes: {POSITION: 0}}]}], buffers: [{byteLength: 36}],
      bufferViews: [{buffer: 0, byteLength: 36}], accessors: [{bufferView: 0, componentType: 5126, count: 3, type: 'VEC3'}]};
    const json = Buffer.from(JSON.stringify(doc)), padded = Math.ceil(json.length / 4) * 4;
    body = Buffer.alloc(28 + padded + 36); body.write('glTF'); body.writeUInt32LE(2, 4); body.writeUInt32LE(body.length, 8);
    body.writeUInt32LE(padded, 12); body.writeUInt32LE(0x4e4f534a, 16); body.fill(0x20, 20, 20 + padded); json.copy(body, 20);
    body.writeUInt32LE(36, 20 + padded); body.writeUInt32LE(0x004e4942, 24 + padded);
    [0,0,0,1,0,0,0,1,0].forEach((number, index) => body.writeFloatLE(number, 28 + padded + index * 4));
    type = 'model/gltf-binary';
    response.setHeader('Content-Disposition', 'attachment; filename="synthetic-review.glb"');
  }
  else if (url.pathname === '/photo.svg') {
    const index = Number(url.searchParams.get('view')) || 0;
    body = '<svg xmlns="http://www.w3.org/2000/svg" width="360" height="280" viewBox="0 0 360 280"><rect width="360" height="280" fill="#e1efed"/><circle cx="180" cy="130" r="85" fill="' +
      (index === 0 ? '#17222f' : '#bdc5c8') + '" stroke="#586d79" stroke-width="9"/><circle cx="180" cy="130" r="30" fill="#252d31"/><text x="180" y="252" text-anchor="middle" font-size="18">合成写真 ' + (index + 1) + '</text></svg>';
    type = 'image/svg+xml';
  } else {
    const file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    if (![path.join(root, 'styles.css'), path.join(root, 'product-3d-viewer.js')].includes(file) &&
      !file.startsWith(path.join(root, 'vendor', 'three') + path.sep)) {response.writeHead(404); response.end(); return;}
    if (!fs.existsSync(file)) {response.writeHead(404); response.end(); return;}
    body = fs.readFileSync(file); type = path.extname(file) === '.css' ? 'text/css' : path.extname(file) === '.wasm' ? 'application/wasm' : 'text/javascript';
  }
  response.writeHead(200, {'Content-Type': type, 'Cache-Control': 'no-store', 'Content-Security-Policy': csp});
  response.end(body);
});
server.listen(0, '127.0.0.1', () => process.stdout.write('http://127.0.0.1:' + server.address().port + '/\n'));
