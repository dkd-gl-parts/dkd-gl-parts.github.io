const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const fixture = path.join(root, 'tests', 'product-3d-viewer-fixture.html');
const viewer = path.join(root, 'product-3d-viewer.js');
const vendorRoot = path.join(root, 'vendor', 'three');
const textureFiles = ['html', 'css', 'js'].map(extension =>
  path.join(root, 'tests', 'product-3d-texture-fixture.' + extension));
const productionCsp = fs.readFileSync(path.join(root, '_headers'), 'utf8')
  .match(/Content-Security-Policy:\s*([^\r\n]+)/)[1]
  .replace(/; upgrade-insecure-requests\s*$/, ''); // HTTP loopback only; all access restrictions remain.
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.wasm': 'application/wasm'
};
const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const fullPath = path.resolve(root, '.' + pathname);
  if (fullPath !== fixture && fullPath !== viewer && !textureFiles.includes(fullPath) &&
      !fullPath.startsWith(vendorRoot + path.sep)) {
    response.writeHead(403); response.end(); return;
  }
  fs.readFile(fullPath, (error, content) => {
    if (error) { response.writeHead(404); response.end(); return; }
    response.writeHead(200, {
      'Content-Type': mime[path.extname(fullPath)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      ...(fullPath === textureFiles[0] ? { 'Content-Security-Policy': productionCsp } : {})
    });
    response.end(content);
  });
});
server.listen(0, '127.0.0.1', () => {
  process.stdout.write('http://127.0.0.1:' + server.address().port + '/tests/product-3d-viewer-fixture.html\n');
});
