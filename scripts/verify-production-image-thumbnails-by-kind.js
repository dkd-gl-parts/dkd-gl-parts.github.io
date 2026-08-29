const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

function sourceBetween(startText, endText) {
  const start = source.indexOf(startText);
  const end = source.indexOf(endText, start + startText.length);
  if (start < 0 || end < start) throw new Error(`${startText} could not be isolated`);
  return source.slice(start, end);
}

[
  'var productionImages  = { rebuilt: [], aftermarket_new: [] };',
  'class=\'production-image-groups\'',
  'id=\'production-image-groups\'',
  'return ["rebuilt", "aftermarket_new"]',
  'id=\'production-image-count-',
  'id=\'production-image-strip-',
  'data-production-image-kind=',
  'productionImages[selectedKind] || []'
].forEach((fragment) => {
  if (!source.includes(fragment)) throw new Error(`production image grouping is missing: ${fragment}`);
});

const loaderSource = sourceBetween("async function loadProductionImagesForRow", "function productionImageKinds");
if (!loaderSource.includes('fetchAllCoreProductImagesForContext(dkdId, "all")')) {
  throw new Error("production thumbnails must include sales and production image registrations");
}
if (loaderSource.includes("fetchCoreProductImagesForContext")) {
  throw new Error("production thumbnail loading must not issue one request per selected product kind");
}
if (!loaderSource.includes("productionImages[kind].push(img)")) {
  throw new Error("production images must be grouped by their stored product kind");
}
if (!loaderSource.includes("uniqueCoreProductImageRows(r.data || [])")) {
  throw new Error("production thumbnails must not duplicate copied image registrations");
}

const auxiliarySource = sourceBetween("async function loadProductionAuxiliaryData", "function productionMatchesQuery");
if (!auxiliarySource.includes('fetchProductImageCountMapForContext(products, "all")') ||
    !auxiliarySource.includes('applyProductImageCountMapForContext(products, fast[4] || {}, "production")')) {
  throw new Error("production image badges must count all product images while retaining the production cache");
}

if (!source.includes("function coreProductImageIdentity") || !source.includes("function uniqueCoreProductImageRows")) {
  throw new Error("shared production image identity helpers are missing");
}

const rendererSource = sourceBetween("function renderProductionImages", "async function loadImages");
[
  'countEl.textContent = tf("image_count", { n: images.length })',
  't("production_images_empty")',
  'productionImages[selectedKind] || []'
].forEach((fragment) => {
  if (!rendererSource.includes(fragment)) throw new Error(`production image rendering is incomplete: ${fragment}`);
});

if (!source.includes('selectedImageActionKind("production")') ||
    !source.includes('document.getElementById("production-image-action-kind")')) {
  throw new Error("production image registration must remain separated by the selected product kind");
}

const editLoaderSource = sourceBetween("async function openImageEditDialog", "function closeImageEditDialog");
[
  'context === "production" ? "all" : context',
  "uniqueCoreProductImageRows(r.data || [])",
  "imageProductKindOptions().indexOf"
].forEach((fragment) => {
  if (!editLoaderSource.includes(fragment)) throw new Error(`production image editing must match displayed thumbnails: ${fragment}`);
});

const editSaveSource = sourceBetween("async function saveImageEditDialog", "async function deleteImageFromDialog");
[
  'var payload = { product_kind: nextKind }',
  'imageOrigin === "sales"',
  "img.show_in_sales === true",
  "payload.product_variant_id = productVariantIdForKind(nextKind)"
].forEach((fragment) => {
  if (!editSaveSource.includes(fragment)) throw new Error(`image kind editing must preserve its registration context: ${fragment}`);
});
[
  "image_origin: context",
  'show_in_sales: context === "sales"',
  'show_in_production: context === "production"'
].forEach((fragment) => {
  if (editSaveSource.includes(fragment)) throw new Error(`image kind editing must not overwrite visibility: ${fragment}`);
});

[
  ".production-image-groups { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));",
  ".production-image-group.rebuilt .production-image-kind",
  ".production-image-group.aftermarket_new .production-image-kind",
  ".production-image-groups { grid-template-columns: 1fr;"
].forEach((fragment) => {
  if (!css.includes(fragment)) throw new Error(`production image grouping style is missing: ${fragment}`);
});

console.log("Production image thumbnails by product kind verified.");
