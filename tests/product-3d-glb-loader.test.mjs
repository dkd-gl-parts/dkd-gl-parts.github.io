import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from '../vendor/three/build/three.module.min.js';
import { GLTFLoader } from '../vendor/three/examples/jsm/loaders/GLTFLoader.js';

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
  const gltf = await new GLTFLoader().parseAsync(sampleGlb(), '');
  assert.ok(gltf.scene);
  const box = new THREE.Box3().setFromObject(gltf.scene);
  const size = box.getSize(new THREE.Vector3());
  assert.deepEqual([size.x, size.y, size.z], [1, 1, 0]);
  assert.ok(Number.isFinite(size.length()) && size.length() > 0);
});
