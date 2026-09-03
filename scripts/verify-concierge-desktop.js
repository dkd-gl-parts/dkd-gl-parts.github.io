"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const desktopRoot = path.join(root, "desktop", "concierge-companion");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(relativePath) {
  const target = path.join(desktopRoot, relativePath);
  assert(fs.existsSync(target), `Missing desktop concierge file: ${relativePath}`);
  return fs.readFileSync(target, "utf8");
}

function requireFragment(source, fragment, message) {
  assert(source.includes(fragment), message || `Missing fragment: ${fragment}`);
}

const packageJson = JSON.parse(read("package.json"));
const main = read("main.cjs");
const preload = read("preload.cjs");
const html = read(path.join("renderer", "index.html"));
const css = read(path.join("renderer", "styles.css"));
const renderer = read(path.join("renderer", "renderer.js"));
const readme = read("README.md");
const publicHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
const staticBuilder = fs.readFileSync(path.join(root, "scripts", "build-static-site.js"), "utf8");

assert(packageJson.private === true, "Desktop concierge pilot package must remain private");
assert(packageJson.devDependencies.electron === "44.1.1", "Electron must be pinned to the reviewed version");
assert(packageJson.devDependencies["electron-builder"] === "26.15.3", "electron-builder must be pinned to the reviewed version");
assert(packageJson.build.win.target.includes("portable"), "Admin pilot must build a portable Windows executable");
assert(packageJson.build.win.signAndEditExecutable === false, "Unsigned admin pilot must not attempt code-signing work");

[
  "transparent: true",
  "frame: false",
  "alwaysOnTop: true",
  "resizable: false",
  "skipTaskbar: true",
  "backgroundColor: \"#00000000\"",
  "nodeIntegration: false",
  "contextIsolation: true",
  "sandbox: true",
  "webSecurity: true",
  "devTools: false",
  "app.enableSandbox()",
  "setPermissionRequestHandler",
  "setWindowOpenHandler(() => ({ action: \"deny\" }))",
  "event.sender !== petWindow.webContents",
  "setAlwaysOnTop(true, \"floating\")",
  "setIgnoreMouseEvents(preferences.clickThrough, { forward: true })",
  "screen.getDisplayMatching(bounds).workArea",
  "petWindow.setPosition(Math.round(x), Math.round(y), false)",
  "nativeTheme.shouldUseReducedMotion",
  "movementDelta",
  "spriteBackgroundPositionY",
  "HORIZONTAL_STEPS_PER_LEG = 72",
  "TRUSTED_D_CATS_URL"
].forEach((fragment) => requireFragment(main, fragment));

assert(!main.includes("loadURL(\"http"), "Desktop concierge must not load remote web content");
assert(!main.includes("nodeIntegration: true"), "Desktop concierge must not expose Node.js to the renderer");
assert(!main.includes("webSecurity: false"), "Desktop concierge must not disable web security");
assert(!preload.includes("ipcRenderer.send,"), "Preload must not expose unrestricted IPC");
requireFragment(html, "default-src 'self'");
requireFragment(html, "connect-src 'none'");
requireFragment(css, "background: transparent");
requireFragment(css, "-webkit-app-region: drag");
requireFragment(css, "prefers-reduced-motion: reduce");
requireFragment(renderer, "window.dcatsCompanion.onState(applyState)");
requireFragment(renderer, "document.body.dataset.facing = facing");
requireFragment(renderer, 'suzuto: Object.freeze({ right: "10%", left: "20%" })');
requireFragment(renderer, 'rinna: Object.freeze({ right: "20%", left: "10%" })');
requireFragment(renderer, 'document.body.style.setProperty("--travel-row", TRAVEL_ROWS[character][facing])');
requireFragment(css, "--sprite-row: var(--travel-row, 10%)");
requireFragment(css, 'body[data-character="rinna"][data-facing="right"] .pet-sprite');
requireFragment(css, "transform: scaleX(-1)");
requireFragment(readme, "system-administrator-only Windows pilot");
requireFragment(readme, "JPY 0");

assert(!publicHtml.includes("D-CATS Concierge Admin Pilot"), "Public D-CATS UI must not expose the desktop pilot");
assert(!staticBuilder.includes("desktop/concierge-companion"), "Static deployment must not publish the desktop pilot");

const expectedSprites = [
  ["suzuto", "DC5978A1C172A0A66D8DFAFF8C0C0F15AABCE474C266FF3F1B63E009661431C7"],
  ["rinna", "6095678C6515F73EA870266B6383BDAA22C8DB99E7CA96F2F6E597D82E16850E"]
];
for (const [character, expectedHash] of expectedSprites) {
  const spritePath = path.join(root, "assets", "concierge-pet", character, "spritesheet.webp");
  const actualHash = crypto.createHash("sha256").update(fs.readFileSync(spritePath)).digest("hex").toUpperCase();
  assert(actualHash === expectedHash, `${character} desktop sprite does not match the approved atlas`);
}

console.log("Transparent Windows concierge admin-pilot verification passed (frameless, always-on-top, click-through option, strict local renderer, approved sprites, no public UI).");
