const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const icon = fs.readFileSync(path.join(root, "assets", "icons", "image.svg"), "utf8");

const combined = app + "\n" + html;
[
  "&#x1F5BC;",
  "&#x1F4F7;",
  "🖼",
  "📷"
].forEach((legacyIcon) => {
  if (combined.includes(legacyIcon)) {
    throw new Error(`Legacy image emoji remains: ${legacyIcon}`);
  }
});

if ((combined.match(/class=['\"]icon-image['\"]/g) || []).length < 8) {
  throw new Error("Shared image icon is not used in every image state");
}
if (!css.includes('.icon-image { display: inline-block;') ||
    !css.includes('mask: url("assets/icons/image.svg?v=1.1.728")')) {
  throw new Error("Shared image icon styling or cache version is missing");
}
if (!icon.includes('viewBox="0 0 24 24"') || !icon.includes('<circle cx="9" cy="9" r="2"/>')) {
  throw new Error("Image icon asset is incomplete");
}

console.log("Shared image icon consistency verified.");
