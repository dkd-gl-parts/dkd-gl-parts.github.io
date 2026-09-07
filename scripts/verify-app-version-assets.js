const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const styles = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "site.webmanifest"), "utf8"));

function requiredMatch(source, pattern, label) {
  const match = source.match(pattern);
  if (!match) throw new Error(`${label} is missing`);
  return match[1];
}

const appVersion = requiredMatch(app, /var\s+APP_VERSION\s*=\s*"(v[^\"]+)"/, "APP_VERSION");
const metaVersion = requiredMatch(html, /name="dcats-app-version"\s+content="(v[^\"]+)"/, "version meta");
const legacyVersion = requiredMatch(html, /Legacy updater compatibility: var APP_VERSION = "(v[^\"]+)"/, "legacy updater version");
const scriptVersion = "v" + requiredMatch(html, /<script\s+src="app\.js\?v=([^\"]+)"/, "app.js cache version");
const installScriptVersion = "v" + requiredMatch(html, /<script\s+src="install-app\.js\?v=([^\"]+)"/, "install-app.js cache version");
const legacyI18nVersion = "v" + requiredMatch(html, /<script\s+src="legacy-i18n\.js\?v=([^\"]+)"/, "legacy-i18n.js cache version");
const conciergeScriptVersion = "v" + requiredMatch(html, /<script\s+src="assets\/concierge-pet\/concierge-pet\.js\?v=([^\"]+)"/, "concierge-pet.js cache version");
const styleVersion = "v" + requiredMatch(html, /<link\s+rel="stylesheet"\s+href="styles\.css\?v=([^&\"]+)/, "styles.css cache version");
const conciergeStyleVersion = "v" + requiredMatch(html, /<link\s+rel="stylesheet"\s+href="assets\/concierge-pet\/concierge-pet\.css\?v=([^\"]+)"/, "concierge-pet.css cache version");
const manifestVersion = "v" + requiredMatch(html, /<link\s+rel="manifest"\s+href="site\.webmanifest\?v=([^&\"]+)/, "manifest cache version");

const supabaseScript = '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.115.0/dist/umd/supabase.js" integrity="sha384-CLZeq1dk8+Uzrs7TVvBUdlFoV5F0DMqgRoeHa8g5wJcuPe5SkVfEvdxB0ZuzlnBQ" crossorigin="anonymous"></script>';
const jsBarcodeScript = '<script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.12.3/dist/JsBarcode.all.min.js" integrity="sha384-vmcSy8TM1KhZWBIKMKTR8AxbrJQCuConAolGY+42odu9ZGIzw8L8xAT/u7ul4X2U" crossorigin="anonymous"></script>';
if (!html.includes(supabaseScript) || html.includes("@supabase/supabase-js@2/dist/")) {
  throw new Error("Supabase browser SDK must use the reviewed exact version and SRI");
}
const externalScriptTags = html.match(/<script\b[^>]*\bsrc="https:\/\/[^\"]+"[^>]*><\/script>/g) || [];
if (externalScriptTags.length !== 2 || !externalScriptTags.includes(supabaseScript) || !externalScriptTags.includes(jsBarcodeScript)) {
  throw new Error("Static external scripts must match the reviewed exact-version SRI allowlist");
}
const dynamicExternalScripts = [...app.matchAll(/\bscript\.src\s*=\s*"(https:\/\/[^\"]+)"/g)].map((match) => match[1]);
if (dynamicExternalScripts.length !== 1 || dynamicExternalScripts[0] !== "https://cdn.jsdelivr.net/npm/@zxing/browser@0.2.0/umd/zxing-browser.min.js") {
  throw new Error("Dynamic external scripts must match the reviewed ZXing allowlist");
}

const versions = { metaVersion, legacyVersion, scriptVersion, installScriptVersion, legacyI18nVersion, conciergeScriptVersion, styleVersion, conciergeStyleVersion, manifestVersion };
Object.entries(versions).forEach(([label, version]) => {
  if (version !== appVersion) {
    throw new Error(`${label} ${version} must match ${appVersion}`);
  }
});

const requiredInstallIcons = [
  "assets/icons/apple-touch-icon-v4.png",
  "assets/icons/icon-192-v4.png",
  "assets/icons/icon-512-v4.png",
  "assets/icons/icon-maskable-512-v4.png",
  "apple-touch-icon.png",
];
requiredInstallIcons.forEach((file) => {
  if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing install icon: ${file}`);
});
if (!html.includes('href="assets/icons/apple-touch-icon-v4.png"')) {
  throw new Error("Apple touch icon must use the cache-safe versioned filename");
}
const manifestIconSources = (manifest.icons || []).map((icon) => icon.src);
for (const source of requiredInstallIcons.slice(1, 4)) {
  if (!manifestIconSources.includes(source)) throw new Error(`Manifest install icon is missing: ${source}`);
}
if (manifest.id !== "/" || manifest.start_url !== "/" || manifest.scope !== "/") {
  throw new Error("Manifest identity, start_url, and scope must be rooted at D-CATS");
}

if (!app.includes('url.searchParams.set("_dcats_refresh", String(Date.now()))')) {
  throw new Error("manual refresh must request a fresh index document");
}

const loginBrandLockups = html.match(/class="login-brand-lockup"/g) || [];
if (loginBrandLockups.length !== 3) {
  throw new Error("login, forgot-password, and reset-password screens must share the brand lockup");
}
if (!styles.includes(".login-brand-lockup { display: inline-flex;") ||
    !styles.includes(".reg-card { background: #fff;") ||
    !styles.includes("width: calc(100% - 40px);")) {
  throw new Error("authentication brand lockup and narrow-screen card sizing are required");
}

console.log(`app release asset guard passed (${appVersion})`);
