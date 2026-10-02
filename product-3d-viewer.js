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
  const boundingRadius = size.length() * 0.5;
  const homeDirection = new THREE.Vector3(1.35, 0.85, 1.35).normalize();
  let homeView = true;
  controls.addEventListener('start', () => { homeView = false; });

  function resetView() {
    // Fit the bounding sphere within the narrower field of view. A fixed
    // multiple of the longest edge clips deep objects and portrait viewports.
    const verticalHalfFov = THREE.MathUtils.degToRad(camera.fov * 0.5);
    const horizontalHalfFov = Math.atan(Math.tan(verticalHalfFov) * camera.aspect);
    // glTF uses arbitrary model scale. An absolute camera-distance floor makes
    // physically small parts appear tiny even when their own bounds are valid.
    const distance = boundingRadius * 1.12 / Math.sin(Math.min(verticalHalfFov, horizontalHalfFov));
    homeView = true;
    camera.near = Math.max(distance / 1000, 0.000001);
    camera.far = Math.max(distance * 100, camera.near * 1000);
    camera.position.copy(homeDirection).multiplyScalar(distance);
    camera.updateProjectionMatrix();
    controls.target.set(0, 0, 0);
    controls.minDistance = Math.max(radius * 0.35, distance / 1000);
    controls.maxDistance = Math.max(radius * 12, distance * 2);
    controls.update();
  }
  resetView();

  function resize() {
    const width = Math.max(host.clientWidth, 1);
    const height = Math.max(host.clientHeight, 1);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    // Preserve a user-adjusted view; refit only while still in the home view.
    if (homeView) resetView();
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
    zoomIn() {
      homeView = false;
      // This pinned OrbitControls multiplies camera distance by dollyIn's
      // scale, so a value below one moves the camera closer.
      controls.dollyIn(0.8);
    },
    zoomOut() {
      homeView = false;
      controls.dollyOut(0.8);
    },
    setAutoRotate(value) {
      controls.autoRotate = !!value;
    },
    async fullscreen() {
      const target = options.fullscreenElement || host;
      if (document.fullscreenElement === target) await document.exitFullscreen();
      else if (!document.fullscreenElement && target.requestFullscreen) await target.requestFullscreen();
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
