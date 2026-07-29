const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

function requiredMatch(source, pattern, label) {
  const match = source.match(pattern);
  if (!match) throw new Error(`${label} is missing`);
  return match[1];
}

const appVersion = requiredMatch(app, /var\s+APP_VERSION\s*=\s*"(v[^\"]+)"/, "APP_VERSION");
const metaVersion = requiredMatch(html, /name="dcats-app-version"\s+content="(v[^\"]+)"/, "version meta");
const legacyVersion = requiredMatch(html, /Legacy updater compatibility: var APP_VERSION = "(v[^\"]+)"/, "legacy updater version");
const scriptVersion = "v" + requiredMatch(html, /<script\s+src="app\.js\?v=([^\"]+)"/, "app.js cache version");
const styleVersion = "v" + requiredMatch(html, /<link\s+rel="stylesheet"\s+href="styles\.css\?v=([^&\"]+)/, "styles.css cache version");

const versions = { metaVersion, legacyVersion, scriptVersion, styleVersion };
Object.entries(versions).forEach(([label, version]) => {
  if (version !== appVersion) {
    throw new Error(`${label} ${version} must match ${appVersion}`);
  }
});

if (!app.includes('url.searchParams.set("_dcats_refresh", String(Date.now()))')) {
  throw new Error("manual refresh must request a fresh index document");
}

console.log(`app release asset guard passed (${appVersion})`);
