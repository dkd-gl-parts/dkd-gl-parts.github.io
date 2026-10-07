import { createProduct3DViewer } from '../product-3d-viewer.js';

const result = document.getElementById('result');
document.addEventListener('securitypolicyviolation', event => {
  if (event.blockedURI === 'blob' || event.blockedURI.startsWith('blob:')) document.getElementById('csp-result').textContent =
    'CSP拒否: ' + event.effectiveDirective + ' / blob:';
});
const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR4nGP4z8DwHwwZGP7//w9kAABHygj4/BTyWgAAAABJRU5ErkJggg=='), c => c.charCodeAt(0));
const binaryLength = Math.ceil((92 + png.length) / 4) * 4;
const doc = {
  asset: { version: '2.0' },
  scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
  meshes: [{ primitives: [{ attributes: { POSITION: 0, TEXCOORD_0: 1 }, indices: 2, material: 0 }] }],
  materials: [{ doubleSided: true, pbrMetallicRoughness: {
    baseColorTexture: { index: 0 }, metallicFactor: 0, roughnessFactor: 1
  }, extensions: { KHR_materials_unlit: {} } }],
  extensionsUsed: ['KHR_materials_unlit'],
  textures: [{ source: 0 }], images: [{ bufferView: 3, mimeType: 'image/png' }],
  buffers: [{ byteLength: binaryLength }],
  bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 48 },
    { buffer: 0, byteOffset: 48, byteLength: 32 },
    { buffer: 0, byteOffset: 80, byteLength: 12 },
    { buffer: 0, byteOffset: 92, byteLength: png.length }],
  accessors: [{ bufferView: 0, componentType: 5126, count: 4, type: 'VEC3', min: [-1,-1,0], max: [1,1,0] },
    { bufferView: 1, componentType: 5126, count: 4, type: 'VEC2' },
    { bufferView: 2, componentType: 5123, count: 6, type: 'SCALAR' }]
};
const json = new TextEncoder().encode(JSON.stringify(doc));
const jsonLength = Math.ceil(json.length / 4) * 4;
const bytes = new Uint8Array(28 + jsonLength + binaryLength);
const data = new DataView(bytes.buffer);
data.setUint32(0, 0x46546c67, true); data.setUint32(4, 2, true);
data.setUint32(8, bytes.length, true); data.setUint32(12, jsonLength, true);
data.setUint32(16, 0x4e4f534a, true);
bytes.fill(32, 20, 20 + jsonLength); bytes.set(json, 20);
data.setUint32(20 + jsonLength, binaryLength, true);
data.setUint32(24 + jsonLength, 0x004e4942, true);
const start = 28 + jsonLength;
new Float32Array(bytes.buffer, start, 12).set([-1,-1,0, 1,-1,0, 1,1,0, -1,1,0]);
new Float32Array(bytes.buffer, start + 48, 8).set([0,0, 1,0, 1,1, 0,1]);
new Uint16Array(bytes.buffer, start + 80, 6).set([0,1,2, 0,2,3]);
bytes.set(png, start + 92);
if (new URL(location.href).searchParams.has('invalid')) bytes[start + 92] = 0;
try {
  const viewer = await createProduct3DViewer({ host: document.getElementById('stage'), buffer: bytes.buffer });
  document.getElementById('reset').addEventListener('click', () => viewer.reset());
  result.textContent = '描画完了: 赤・緑・青・黄のテクスチャを確認してください';
} catch (error) {
  result.textContent = '読込失敗: ' + error.message;
}
