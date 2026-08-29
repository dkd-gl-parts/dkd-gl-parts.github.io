const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "dist");
const files = [
  "_headers",
  "app.js",
  "install-app.js",
  "apple-touch-icon.png",
  "box-label-print.css",
  "customer-invite-print.css",
  "customer-price-list-print.css",
  "index.html",
  "label-print-window.js",
  "legacy-i18n.js",
  "manufacturing-ranking-report.js",
  "product-3d.js",
  "product-3d-viewer.js",
  "print.css",
  "ranking-report-print-landscape.css",
  "ranking-report-print-portrait.css",
  "ranking-report-print.css",
  "shipment-instruction-print.css",
  "favicon.ico",
  "site.webmanifest",
  "styles.css",
];

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

for (const file of files) {
  const source = path.join(root, file);
  if (!fs.existsSync(source)) throw new Error(`Missing deploy asset: ${file}`);
  fs.copyFileSync(source, path.join(output, file));
}

fs.cpSync(path.join(root, "vendor"), path.join(output, "vendor"), { recursive: true });
fs.cpSync(path.join(root, "assets"), path.join(output, "assets"), { recursive: true });
console.log(`Static site build complete (${files.length} files + vendor + assets)`);
