const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const client = fs.readFileSync(path.join(root, "product-3d.js"), "utf8");
const viewer = fs.readFileSync(path.join(root, "product-3d-viewer.js"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const headers = fs.readFileSync(path.join(root, "_headers"), "utf8");
const build = fs.readFileSync(path.join(root, "scripts", "build-static-site.js"), "utf8");

function requireText(source, fragment, label) {
  if (!source.includes(fragment)) throw new Error(`${label} is missing: ${fragment}`);
}

[
  "btn-image-action-create-3d",
  "production-image-action-create-3d",
  "product-3d-capture-overlay",
  "product-3d-camera-video",
  "product-3d-guide-canvas",
  "product-3d-video-supplement",
  "product-3d-viewer-overlay",
  "data-product-media=\"model\"",
  "product-3d.js?v=1.1.775"
].forEach((fragment) => requireText(html, fragment, "3D UI contract"));

[
  "open_product_3d_workspace",
  "register_product_3d_capture",
  "contentSha256(loaded.blob)",
  "contentSha256(blob)",
  "metadata: { sha256: blobSha256 }",
  "signProductImageUrl(imageRow.storage_path)",
  "perceptual_hash: analysis.hash",
  "orphan product 3D source cleanup failed",
  "if (duplicateRemoval.error) throw duplicateRemoval.error",
  "customer: \"customer-product-3d-list\"",
  "context === \"customer\" ? \"\"",
  "product-3d-kind-group",
  "[\"rebuilt\", \"aftermarket_new\"]",
  "submit_product_3d_model",
  "source/dkd_",
  "VIDEO_PROPOSAL_DELAY_MS = 30000",
  "VIDEO_SAMPLE_INTERVAL_MS = 1250",
  "navigator.mediaDevices.getUserMedia",
  "sharpness < 95",
  "金属反射が強すぎます",
  "前の画像との重なり不足",
  "同じ方向を撮りすぎています",
  "商品が枠に対して傾きすぎています",
  "product_3d_models",
  "publish_product_3d_model",
  "確認待ち",
  "data-publish-model",
  "createSignedUrl(model.published_model_path, 600)",
  "import(\"./product-3d-viewer.js?v=1.1.763\")",
  "if (viewer) { viewer.dispose(); viewer = null; }",
  "if (requestId !== viewerRequestId) { createdViewer.dispose(); return; }"
].forEach((fragment) => requireText(client, fragment, "3D capture contract"));

if (client.includes("analysisDigest")) throw new Error("Capture dedupe must hash source bytes, not analysis metadata");
if (client.includes('signProductImageUrl(imageRow.storage_path, { width:')) throw new Error("Existing capture SHA must cover the original stored image bytes");
if (client.includes('context === "customer" ? "rebuilt"')) throw new Error("Customer 3D models must not collapse both product kinds into rebuilt");

[
  "customer-product-3d-list",
  "production-product-3d-list",
  "data-product-media='model'",
  "data-dkd-id='"
].forEach((fragment) => requireText(app, fragment, "3D application integration"));

[
  "OrbitControls",
  "GLTFLoader",
  "KTX2Loader",
  "DRACOLoader",
  "setMeshoptDecoder",
  "requestFullscreen",
  "cancelAnimationFrame(animationFrame)",
  "renderer.domElement.remove()"
].forEach((fragment) => requireText(viewer, fragment, "3D viewer contract"));

requireText(css, "@media (max-width: 820px)", "mobile capture layout");
requireText(css, ".product-3d-kind-group.aftermarket_new", "customer product-kind grouping");
requireText(headers, "Permissions-Policy: camera=(self)", "same-origin camera policy");
requireText(build, '"product-3d.js"', "3D deployment asset");
requireText(build, '"product-3d-viewer.js"', "3D viewer deployment asset");

const vendorRoot = path.join(root, "vendor", "three");
[
  "LICENSE.txt",
  "README.md",
  "build/three.module.min.js",
  "build/three.core.min.js",
  "examples/jsm/controls/OrbitControls.js",
  "examples/jsm/loaders/GLTFLoader.js",
  "examples/jsm/loaders/KTX2Loader.js",
  "examples/jsm/loaders/DRACOLoader.js",
  "examples/jsm/libs/meshopt_decoder.module.js",
  "examples/jsm/libs/basis/basis_transcoder.wasm",
  "examples/jsm/libs/draco/gltf/draco_decoder.wasm"
].forEach((relative) => {
  if (!fs.existsSync(path.join(vendorRoot, relative))) throw new Error(`Missing local Three.js asset: ${relative}`);
});

for (const relative of [
  "examples/jsm/controls/OrbitControls.js",
  "examples/jsm/loaders/GLTFLoader.js",
  "examples/jsm/loaders/KTX2Loader.js",
  "examples/jsm/loaders/DRACOLoader.js"
]) {
  const source = fs.readFileSync(path.join(vendorRoot, relative), "utf8");
  if (/from\s+['\"]three['\"]/.test(source)) throw new Error(`Bare Three.js import remains in ${relative}`);
}

console.log("product 3D pilot workflow contract: OK");
