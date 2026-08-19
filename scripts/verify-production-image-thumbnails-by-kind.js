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
if (!loaderSource.includes('fetchAllCoreProductImagesForContext(dkdId, "production")')) {
  throw new Error("production thumbnails must be loaded in one request for both product kinds");
}
if (loaderSource.includes("fetchCoreProductImagesForContext")) {
  throw new Error("production thumbnail loading must not issue one request per selected product kind");
}
if (!loaderSource.includes("productionImages[kind].push(img)")) {
  throw new Error("production images must be grouped by their stored product kind");
}

const rendererSource = sourceBetween("function renderProductionImages", "async function loadImages");
[
  'countEl.textContent = images.length + " 枚"',
  't("production_images_empty")',
  'productionImages[selectedKind] || []'
].forEach((fragment) => {
  if (!rendererSource.includes(fragment)) throw new Error(`production image rendering is incomplete: ${fragment}`);
});

if (!source.includes('selectedImageActionKind("production")') ||
    !source.includes('document.getElementById("production-image-action-kind")')) {
  throw new Error("production image registration must remain separated by the selected product kind");
}

[
  ".production-image-groups { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));",
  ".production-image-group.rebuilt .production-image-kind",
  ".production-image-group.aftermarket_new .production-image-kind",
  ".production-image-groups { grid-template-columns: 1fr;"
].forEach((fragment) => {
  if (!css.includes(fragment)) throw new Error(`production image grouping style is missing: ${fragment}`);
});

console.log("Production image thumbnails by product kind verified.");
