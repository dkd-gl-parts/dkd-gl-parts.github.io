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
  "REST_GESTURE_ORDER = Object.freeze([\"escort\", \"handshake\", \"shy\"])",
  "motionPhase === \"moving\"",
  "motionPhase = \"resting\"",
  "setTimeout(runMotionStep, MOTION_STEP_MS)",
  "setTimeout(beginMovingPhase, restDuration)",
  "restGesture",
  "TRUSTED_D_CATS_URL"
].forEach((fragment) => requireFragment(main, fragment));

assert(!main.includes("setInterval(moveWindowOneStep"), "Desktop concierge must stop between movement legs");

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
requireFragment(renderer, 'suzuto: Object.freeze({ right: 1, left: 2 })');
requireFragment(renderer, 'rinna: Object.freeze({ right: 1, left: 2 })');
requireFragment(renderer, "const IDLE_DURATIONS = Object.freeze([280, 110, 110, 140, 140, 320]);");
requireFragment(renderer, "const TRAVEL_DURATIONS = Object.freeze([120, 120, 120, 120, 120, 120, 120, 220]);");
requireFragment(renderer, 'escort: Object.freeze({ columns: Object.freeze([0, 1])');
requireFragment(renderer, 'handshake: Object.freeze({ columns: Object.freeze([2, 3])');
requireFragment(renderer, 'shy: Object.freeze({ columns: Object.freeze([4, 5])');
requireFragment(renderer, "if (moving)");
requireFragment(renderer, "playRowFrames(8, gesture.columns, gesture.durations)");
requireFragment(renderer, "playRow(0, IDLE_DURATIONS)");
requireFragment(renderer, "playRow(TRAVEL_ROWS[character][facing], TRAVEL_DURATIONS)");
assert(!css.includes("@keyframes sprite-frames"), "Desktop concierge must not use a uniform frame count for unlike atlas rows");
assert(!css.includes('body[data-character="rinna"][data-facing="right"] .pet-sprite'), "Corrected Rinna rows must not be mirrored in desktop CSS");
assert(!css.includes("transform: scaleX(-1)"), "Desktop concierge must preserve the corrected directional artwork");
requireFragment(readme, "system-administrator-only Windows pilot");
requireFragment(readme, "JPY 0");

assert(!publicHtml.includes("D-CATS Concierge Admin Pilot"), "Public D-CATS UI must not expose the desktop pilot");
assert(!staticBuilder.includes("desktop/concierge-companion"), "Static deployment must not publish the desktop pilot");

const expectedSprites = [
  ["suzuto", "4C3985F11D4BBF69ED08BECCDC88903CAAC882E01A21120256A59EC66E2F7066"],
  ["rinna", "082AAAF835D217FEEFD7BD0C958779325CEC90FAC1FEA1D339F977AB3D0DF439"]
];
for (const [character, expectedHash] of expectedSprites) {
  const spritePath = path.join(root, "assets", "concierge-pet", character, "spritesheet.webp");
  const actualHash = crypto.createHash("sha256").update(fs.readFileSync(spritePath)).digest("hex").toUpperCase();
  assert(actualHash === expectedHash, `${character} desktop sprite does not match the approved atlas`);
}

console.log("Transparent Windows concierge admin-pilot verification passed (frameless, always-on-top, move-stop cycle, rotating escort/handshake/shy gestures, click-through option, strict local renderer, approved sprites, no public UI).");
