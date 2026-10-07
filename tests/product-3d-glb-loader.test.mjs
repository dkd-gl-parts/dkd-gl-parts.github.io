import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from '../vendor/three/build/three.module.min.js';
import { GLTFLoader } from '../vendor/three/examples/jsm/loaders/GLTFLoader.js';
import { configureProduct3DTextureLoader } from '../product-3d-viewer.js';
import fs from 'node:fs';

function sampleGlb() {
  const document = {
    asset: { version: '2.0' },
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }],
    buffers: [{ byteLength: 36 }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3',
      min: [0, 0, 0], max: [1, 1, 0] }],
  };
  const json = new TextEncoder().encode(JSON.stringify(document));
  const paddedJsonLength = Math.ceil(json.length / 4) * 4;
  const bytes = new Uint8Array(20 + paddedJsonLength + 8 + 36);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, bytes.length, true);
  view.setUint32(12, paddedJsonLength, true);
  view.setUint32(16, 0x4e4f534a, true);
  bytes.fill(0x20, 20);
  bytes.set(json, 20);
  view.setUint32(20 + paddedJsonLength, 36, true);
  view.setUint32(24 + paddedJsonLength, 0x004e4942, true);
  new Float32Array(bytes.buffer, 28 + paddedJsonLength, 9).set([
    0, 0, 0, 1, 0, 0, 0, 1, 0,
  ]);
  return bytes.buffer;
}

test('pinned product Viewer loader parses a self-contained GLB into finite bounds', async () => {
  const gltf = await configureProduct3DTextureLoader(new GLTFLoader()).parseAsync(sampleGlb(), '');
  assert.ok(gltf.scene);
  const box = new THREE.Box3().setFromObject(gltf.scene);
  const size = box.getSize(new THREE.Vector3());
  assert.deepEqual([size.x, size.y, size.z], [1, 1, 0]);
  assert.ok(Number.isFinite(size.length()) && size.length() > 0);
});

test('Viewer uses image decoding without widening blob network or script permissions', () => {
  let callback;
  const loader = { register(plugin) { callback = plugin; } };
  assert.equal(configureProduct3DTextureLoader(loader), loader);
  const manager = new THREE.LoadingManager();
  const parser = { textureLoader: { isImageBitmapLoader: true },
    options: { manager, crossOrigin: 'anonymous', requestHeader: {} } };
  assert.equal(callback(parser).name, 'DCATS_ImageTextureDecode');
  assert.ok(parser.textureLoader instanceof THREE.TextureLoader);
  assert.equal(parser.textureLoader.manager, manager);
  assert.equal(parser.textureLoader.crossOrigin, 'anonymous');
  assert.equal(parser.textureLoader.isImageBitmapLoader, undefined);
  const existing = new THREE.TextureLoader(manager);
  parser.textureLoader = existing;
  callback(parser);
  assert.equal(parser.textureLoader, existing, 'native image loader is retained');
  const headers = fs.readFileSync(new URL('../_headers', import.meta.url), 'utf8');
  assert.match(headers, /img-src[^;]*blob:/);
  assert.doesNotMatch(headers.match(/connect-src[^;]*/)[0], /blob:|data:|\*/);
  assert.doesNotMatch(headers, /'unsafe-inline'|'unsafe-eval'/);
});

test('pinned parser uses the configured loader for embedded and image-extension textures', () => {
  const pinned = fs.readFileSync(new URL('../vendor/three/examples/jsm/loaders/GLTFLoader.js', import.meta.url), 'utf8');
  assert.match(pinned, /const plugin = this\.pluginCallbacks\[ i \]\( parser \);/);
  assert.match(pinned, /let loader = this\.textureLoader;/);
  assert.match(pinned, /loadTextureImage\( textureIndex, sourceIndex, loader \)/);
  assert.match(pinned, /loadImageSource\( sourceIndex, loader \)/);
  assert.match(pinned, /texture\.flipY = false;/);
  // BasisU remains on its specialized loader rather than our image decoder.
  assert.match(pinned, /const loader = parser\.options\.ktx2Loader;/);
});

test('Viewer rejects silently dropped textures and disposes partially loaded models', () => {
  const viewer = fs.readFileSync(new URL('../product-3d-viewer.js', import.meta.url), 'utf8');
  assert.match(viewer, /manager\.onError = \(\) => \{ assetLoadFailed = true; \};/);
  assert.match(viewer, /if \(assetLoadFailed\) \{[\s\S]*?\.forEach\(disposeObject\);[\s\S]*?throw new Error\('GLB texture could not be loaded\.'/);
});
