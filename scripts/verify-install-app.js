const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const install = fs.readFileSync(path.join(root, "install-app.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const headers = fs.readFileSync(path.join(root, "_headers"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "site.webmanifest"), "utf8"));

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

function pngDimensions(file) {
  const data = fs.readFileSync(path.join(root, file));
  expect(data.length >= 24 && data.subarray(1, 4).toString("ascii") === "PNG", `${file} must be a PNG`);
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

expect(html.includes('id="btn-install-app"'), "Login install button is missing");
expect(html.includes('id="app-install-dialog"'), "Install guidance dialog is missing");
const appVersionMatch = app.match(/var\s+APP_VERSION\s*=\s*"v([^"]+)"/);
expect(appVersionMatch, "D-CATS app version is missing");
expect(html.includes(`src="install-app.js?v=${appVersionMatch[1]}"`), "Install runtime is missing or unversioned");
expect(html.includes('name="apple-mobile-web-app-capable" content="yes"'), "iOS standalone metadata is missing");
expect(html.includes('href="assets/icons/apple-touch-icon-v4.png"'), "Versioned Apple touch icon is missing");
expect((html.match(/data-install-entry/g) || []).length === 3, "Install action must be available on login, internal home, and customer home");

for (const fragment of [
  'window.addEventListener("beforeinstallprompt"',
  "event.preventDefault()",
  "await promptEvent.prompt()",
  "await promptEvent.userChoice",
  'window.addEventListener("appinstalled"',
  'window.matchMedia("(display-mode: standalone)")',
  "window.navigator.standalone === true",
  "function isIos()",
  "function isAndroid()",
  "function isNarrowViewport()",
  "function isIosSafari()",
]) {
  expect(install.includes(fragment), `Install runtime contract is missing: ${fragment}`);
}

for (const key of [
  "app_install_action",
  "app_install_note",
  "app_install_title",
  "app_install_ios_safari_required",
  "app_install_ios_step_share",
  "app_install_manual_step_install",
]) {
  const matches = app.match(new RegExp(`${key}:`, "g")) || [];
  expect(matches.length === 3, `${key} must be translated in Japanese, English, and Chinese`);
}

expect(styles.includes(".app-install-entry[hidden]"), "Hidden install controls must remain hidden");
expect(styles.includes(".app-install-header-entry[hidden]"), "Hidden header install controls must remain hidden");
expect(styles.includes(".app-install-dialog-card"), "Install dialog styling is missing");
expect(styles.includes("body.app-install-dialog-open"), "Install dialog scroll lock is missing");
expect(/\/site\.webmanifest\r?\n\s+Cache-Control: no-cache/.test(headers), "Manifest must be revalidated after releases");
expect(/\/apple-touch-icon\.png\r?\n\s+Cache-Control: no-cache/.test(headers), "Root Apple touch icon must be revalidated");
expect(/\/assets\/icons\/\*-v4\.png\r?\n\s+Cache-Control: public, max-age=31536000, immutable/.test(headers), "Versioned install icons must be immutable");

expect(manifest.id === "/", "Manifest must define a stable D-CATS app id");
expect(manifest.start_url === "/" && manifest.scope === "/", "Manifest launch URL and scope must use the site root");
expect(manifest.display === "standalone", "Manifest must launch as a standalone app");

const iconContracts = [
  ["assets/icons/icon-192-v4.png", 192, "any"],
  ["assets/icons/icon-512-v4.png", 512, "any"],
  ["assets/icons/icon-maskable-512-v4.png", 512, "maskable"],
];
for (const [source, size, purpose] of iconContracts) {
  const icon = (manifest.icons || []).find((candidate) => candidate.src === source);
  expect(icon, `Manifest icon is missing: ${source}`);
  expect(icon.sizes === `${size}x${size}` && icon.type === "image/png" && icon.purpose === purpose, `Manifest icon metadata is invalid: ${source}`);
  const dimensions = pngDimensions(source);
  expect(dimensions.width === size && dimensions.height === size, `Manifest icon dimensions are invalid: ${source}`);
}

for (const source of ["apple-touch-icon.png", "assets/icons/apple-touch-icon-v4.png"]) {
  const dimensions = pngDimensions(source);
  expect(dimensions.width === 180 && dimensions.height === 180, `${source} must be 180x180`);
}

console.log("D-CATS install experience contract: OK");
