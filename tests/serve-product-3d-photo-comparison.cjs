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
var tripoJob = { status: 'review' }, tripoRequestId = 1;
var elements = Object.fromEntries(Array.from(document.querySelectorAll('[id]')).map(node => [node.id, node]));
var current = true;
var sameTripoTarget = id => id === tripoRequestId && current && params.get('role') !== 'staff';
var selectedTarget = () => ({product: {id: 900001}, kind: 'aftermarket_new'});
var productId = product => product.id;
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
