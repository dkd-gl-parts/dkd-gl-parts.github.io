const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "dist");
const files = [
  "_headers",
  "app.js",
  "box-label-print.css",
  "customer-invite-print.css",
  "customer-price-list-print.css",
  "index.html",
  "manufacturing-ranking-report.js",
  "print.css",
  "ranking-report-print-landscape.css",
  "ranking-report-print-portrait.css",
  "ranking-report-print.css",
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
console.log(`Static site build complete (${files.length} files + vendor)`);
