import * as THREE from './vendor/three/build/three.module.min.js';
import { OrbitControls } from './vendor/three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from './vendor/three/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from './vendor/three/examples/jsm/loaders/KTX2Loader.js';
import { DRACOLoader } from './vendor/three/examples/jsm/loaders/DRACOLoader.js';
import { MeshoptDecoder } from './vendor/three/examples/jsm/libs/meshopt_decoder.module.js';

const DECODER_ROOT = './vendor/three/examples/jsm/libs/';

export async function createProduct3DViewer(options) {
  const host = options.host;
  if (!host) throw new Error('3D viewer host is missing.');

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf4f7fb);
  const camera = new THREE.PerspectiveCamera(36, 1, 0.01, 2000);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  host.replaceChildren(renderer.domElement);
  renderer.domElement.className = 'product-3d-canvas';

  scene.add(new THREE.HemisphereLight(0xffffff, 0x5c6470, 2.2));
  const keyLight = new THREE.DirectionalLight(0xffffff, 3.2);
  keyLight.position.set(4, 6, 5);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xbcd7ff, 1.8);
  fillLight.position.set(-5, 2, -3);
  scene.add(fillLight);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.screenSpacePanning = true;
  controls.minDistance = 0.01;
  controls.maxDistance = 1000;
  controls.autoRotate = !!options.autoRotate;
  controls.autoRotateSpeed = 1.4;
  controls.touches.ONE = THREE.TOUCH.ROTATE;
  controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;

  const draco = new DRACOLoader();
  draco.setDecoderPath(DECODER_ROOT + 'draco/gltf/');
  const ktx2 = new KTX2Loader();
  ktx2.setTranscoderPath(DECODER_ROOT + 'basis/');
  ktx2.detectSupport(renderer);
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  loader.setKTX2Loader(ktx2);
  loader.setMeshoptDecoder(MeshoptDecoder);

  let gltf;
  try {
    gltf = await loader.loadAsync(options.url);
  } catch (error) {
    controls.dispose();
    draco.dispose();
    ktx2.dispose();
    renderer.dispose();
    renderer.domElement.remove();
    throw error;
  }
  const root = gltf.scene || gltf.scenes[0];
  if (!root) {
    controls.dispose(); draco.dispose(); ktx2.dispose(); renderer.dispose(); renderer.domElement.remove();
    throw new Error('GLB does not contain a scene.');
  }
  scene.add(root);

  const initialBox = new THREE.Box3().setFromObject(root);
  const initialSize = initialBox.getSize(new THREE.Vector3());
  if (!Number.isFinite(initialSize.length()) || initialSize.length() <= 0) {
    disposeObject(root);
    controls.dispose(); draco.dispose(); ktx2.dispose(); renderer.dispose(); renderer.domElement.remove();
    throw new Error('GLB bounds are invalid.');
  }
  const center = initialBox.getCenter(new THREE.Vector3());
  root.position.sub(center);
  const bounds = new THREE.Box3().setFromObject(root);
  const size = bounds.getSize(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z) * 0.5;
  const homeDirection = new THREE.Vector3(1.35, 0.85, 1.35).normalize();

  function resetView() {
    const distance = Math.max(radius * 3.2, 0.5);
    camera.near = Math.max(distance / 1000, 0.001);
    camera.far = Math.max(distance * 100, 100);
    camera.position.copy(homeDirection).multiplyScalar(distance);
    camera.updateProjectionMatrix();
    controls.target.set(0, 0, 0);
    controls.minDistance = Math.max(radius * 0.35, 0.01);
    controls.maxDistance = Math.max(radius * 12, 10);
    controls.update();
  }
  resetView();

  function resize() {
    const width = Math.max(host.clientWidth, 1);
    const height = Math.max(host.clientHeight, 1);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  resize();

  let disposed = false;
  let animationFrame = 0;
  function animate() {
    if (disposed) return;
    controls.update();
    renderer.render(scene, camera);
    animationFrame = requestAnimationFrame(animate);
  }
  animate();

  function disposeObject(object) {
    object.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      const materials = Array.isArray(child.material) ? child.material : (child.material ? [child.material] : []);
      materials.forEach((material) => {
        Object.keys(material).forEach((key) => {
          const value = material[key];
          if (value && value.isTexture) value.dispose();
        });
        material.dispose();
      });
    });
  }

  return {
    reset: resetView,
    setAutoRotate(value) {
      controls.autoRotate = !!value;
    },
    async fullscreen() {
      const target = options.fullscreenElement || host;
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (target.requestFullscreen) await target.requestFullscreen();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      controls.dispose();
      draco.dispose();
      ktx2.dispose();
      disposeObject(root);
      renderer.dispose();
      renderer.domElement.remove();
    }
  };
}
