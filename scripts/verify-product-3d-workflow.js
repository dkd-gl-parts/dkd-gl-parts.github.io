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
  "product-3d.js?v=1.1.839"
].forEach((fragment) => requireText(html, fragment, "3D UI contract"));

[
  "open_product_3d_workspace",
  "register_product_3d_capture",
  "contentSha256(loaded.blob)",
  "contentSha256(blob)",
  "metadata: { sha256: blobSha256 }",
  "signProductImageUrl(imageRow.storage_path)",
  "createImageBitmap(blob)",
  "perceptual_hash: analysis.hash",
  "orphan product 3D source cleanup failed",
  "if (duplicateRemoval.error) throw duplicateRemoval.error",
  "customer: \"customer-product-3d-list\"",
  "var createAction = manageable",
  "product-3d-kind-group",
  "[\"rebuilt\", \"aftermarket_new\"]",
  "submit_product_3d_model",
  "source/dkd_",
  "VIDEO_PROPOSAL_DELAY_MS = 30000",
  "VIDEO_SAMPLE_INTERVAL_MS = 1250",
  "LIVE_ANALYZE_INTERVAL_MS = 250",
  "timestamp - state.lastPreviewAnalyzedAt >= LIVE_ANALYZE_INTERVAL_MS",
  "navigator.mediaDevices.getUserMedia",
  "sharpness < 95",
  "borderPalette(pixels, w, h)",
  "borderTransitionRatio(pixels, w, h) > 0.12",
  "neutralBrightRatio > 0.72",
  "neutral_bright_ratio: analysis.neutralBrightRatio",
  "source_width: analysis.sourceWidth",
  "商品ではない画像の可能性があります",
  "画像解像度が不足しています",
  'browser_analyzer_version: "pilot-2"',
  "金属反射が強すぎます",
  "前の画像との重なり不足",
  "同じ方向を撮りすぎています",
  "商品が枠に対して傾きすぎています",
  'analysis.sourceKind === "existing_image" ? null : accepted[0]',
  "product_3d_models",
  "publish_product_3d_model",
  "確認待ち",
  "data-publish-model",
  "createSignedUrl(model.published_model_path, 600)",
  "import(\"./product-3d-viewer.js?v=1.1.776\")",
  "if (!canManage3D()) { deny3D(\"open_product_3d_capture\"); return; }",
  "if (!canManage3D()) { deny3D(\"submit_product_3d_model\"); return; }",
  "if (!canPublish3D()) { deny3D(\"publish_product_3d_model\"); return; }",
  "var internal = context !== \"customer\" && canReview3D();",
  "var manageable = context !== \"customer\" && !!target.kind && canManage3D();",
  "var batch = missing.slice(0, 300);",
  ".in(\"dkd_shohin_id\", batch)",
  "batch.forEach(function (id) { modelBadgeCache[String(id)] = false; });",
  "if (missing.length > batch.length) scheduleBadgeRefresh();",
  "publishable && model.status === \"review\"",
  "manageable && [\"draft\", \"needs_capture\", \"failed\"].indexOf(model.status) >= 0",
  "draft: \"撮影途中\"",
  "3Dモデルを作成できる商品区分は「リビルト」と「新品」です。",
  "if (viewer) { viewer.dispose(); viewer = null; }",
  "if (requestId !== viewerRequestId) { createdViewer.dispose(); return; }"
].forEach((fragment) => requireText(client, fragment, "3D capture contract"));

if (client.includes("analysisDigest")) throw new Error("Capture dedupe must hash source bytes, not analysis metadata");
if (client.includes("URL.createObjectURL(blob)")) throw new Error("Existing-image analysis must not depend on CSP-blocked blob image URLs");
if (client.includes('signProductImageUrl(imageRow.storage_path, { width:')) throw new Error("Existing capture SHA must cover the original stored image bytes");
if (client.includes('context === "customer" ? "rebuilt"')) throw new Error("Customer 3D models must not collapse both product kinds into rebuilt");
if (client.includes("canManageAllImages")) throw new Error("Product 3D authorization must not be coupled to image.manage");
if (client.includes('return kind === "aftermarket_new" ? kind : "rebuilt"')) throw new Error("Unsupported product kinds must not be silently converted to rebuilt");

[
  "customer-product-3d-list",
  "production-product-3d-list",
  "data-product-media='model'",
  "data-dkd-id='",
  "function canManageProduct3D()",
  "function canPublishProduct3D()",
  "function canReviewProduct3D()",
  '"product_3d.manage"',
  '"product_3d.publish"',
  "商品3D管理（高権限）",
  "Windows workerの登録・停止・engine変更",
  "canManageAllImages() || canManageProduct3D()",
  "syncProductMediaActionAccess(\"sales\")",
  "syncProductMediaActionAccess(\"production\")"
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

const silhouetteStart = client.indexOf("  function borderPalette");
const silhouetteEnd = client.indexOf("  function perceptualHash", silhouetteStart);
if (silhouetteStart < 0 || silhouetteEnd <= silhouetteStart) throw new Error("Silhouette helpers could not be isolated for regression checks");
const silhouetteHelpers = new Function(
  `${client.slice(silhouetteStart, silhouetteEnd)}; return { borderPalette, borderTransitionRatio, boundingSilhouette, neutralBrightRatioInBox };`
)();

function syntheticFrame(width, height, paint) {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const color = paint(x, y);
      const offset = (y * width + x) * 4;
      pixels[offset] = color[0]; pixels[offset + 1] = color[1]; pixels[offset + 2] = color[2]; pixels[offset + 3] = 255;
    }
  }
  return pixels;
}

const testWidth = 240, testHeight = 320;
function twoToneBackground(x, y) {
  return y < 180 ? [232 + (x % 5), 229 + (x % 4), 222 + (x % 3)] : [55 + (x % 7), 88 + (x % 5), 72 + (x % 4)];
}
const centeredPixels = syntheticFrame(testWidth, testHeight, (x, y) => {
  const nx = (x - 120) / 78, ny = (y - 165) / 92;
  if (nx * nx + ny * ny < 1 || (x > 30 && x < 210 && y > 135 && y < 185)) {
    return ((Math.floor(x / 15) + Math.floor(y / 13)) % 3) ? [52, 55, 58] : [174, 168, 158];
  }
  return twoToneBackground(x, y);
});
const centeredBox = silhouetteHelpers.boundingSilhouette(
  centeredPixels, testWidth, testHeight, silhouetteHelpers.borderPalette(centeredPixels, testWidth, testHeight)
);
const centeredFill = centeredBox.width * centeredBox.height;
if (centeredBox.clipped || centeredFill < 0.15 || centeredFill > 0.82) throw new Error("Centered product silhouette regression failed");

const closePixels = syntheticFrame(testWidth, testHeight, (x, y) => {
  if (y < 220 && x > 8 && x < 232) return (Math.floor(x / 6) % 2) ? [35, 38, 42] : [186, 181, 172];
  return twoToneBackground(x, y);
});
const closeBox = silhouetteHelpers.boundingSilhouette(
  closePixels, testWidth, testHeight, silhouetteHelpers.borderPalette(closePixels, testWidth, testHeight)
);
if (!closeBox.clipped) throw new Error(`Edge-touching close product must be rejected as clipped (transition=${silhouetteHelpers.borderTransitionRatio(closePixels, testWidth, testHeight)})`);

const documentPixels = syntheticFrame(testWidth, testHeight, (x, y) => {
  if (x > 15 && x < 225 && y > 18 && y < 302) {
    const ink = y % 17 === 0 && x > 35 && x < 205;
    return ink ? [45, 45, 45] : [224 + (x % 5), 224 + (x % 5), 224 + (x % 5)];
  }
  return [42, 72, 57];
});
const documentBox = silhouetteHelpers.boundingSilhouette(
  documentPixels, testWidth, testHeight, silhouetteHelpers.borderPalette(documentPixels, testWidth, testHeight)
);
const documentNeutralRatio = silhouetteHelpers.neutralBrightRatioInBox(documentPixels, testWidth, testHeight, documentBox);
if (documentBox.width * documentBox.height <= 0.35 || documentNeutralRatio <= 0.72) throw new Error("Document-like image rejection regression failed");

console.log("product 3D pilot workflow contract: OK");
