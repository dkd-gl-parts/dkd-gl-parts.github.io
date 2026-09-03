const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const runtimePath = path.join(root, "assets", "concierge-pet", "concierge-pet.js");
const cssPath = path.join(root, "assets", "concierge-pet", "concierge-pet.css");
const runtime = fs.readFileSync(runtimePath, "utf8");
const css = fs.readFileSync(cssPath, "utf8");
const appVersion = (app.match(/var\s+APP_VERSION\s*=\s*"(v[^"]+)"/) || [])[1];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function requireFragment(source, fragment, message) {
  assert(source.includes(fragment), message || `Missing fragment: ${fragment}`);
}

function readLosslessWebpSize(buffer) {
  assert(buffer.subarray(0, 4).toString("ascii") === "RIFF", "Spritesheet is not RIFF WebP");
  assert(buffer.subarray(8, 12).toString("ascii") === "WEBP", "Spritesheet has no WEBP signature");
  assert(buffer.subarray(12, 16).toString("ascii") === "VP8L", "Spritesheet must use lossless VP8L encoding");
  assert(buffer[20] === 0x2f, "Spritesheet has an invalid VP8L signature");
  return {
    width: 1 + buffer[21] + ((buffer[22] & 0x3f) << 8),
    height: 1 + (buffer[22] >> 6) + (buffer[23] << 2) + ((buffer[24] & 0x0f) << 10)
  };
}

assert(appVersion, "Unable to resolve APP_VERSION");
requireFragment(app, "function isSystemAdmin()", "Authenticated app runtime must define the system-admin predicate used by the concierge gate");
requireFragment(app, "window.DcatsAccess = Object.freeze", "Authenticated app runtime must expose the read-only concierge access bridge");
requireFragment(app, "isSystemAdmin: function() { return isSystemAdmin(); }", "Concierge access bridge must delegate to the canonical system-admin predicate");
requireFragment(html, `assets/concierge-pet/concierge-pet.css?${"v=" + appVersion.slice(1)}`, "Concierge stylesheet is not versioned with APP_VERSION");
requireFragment(html, `assets/concierge-pet/concierge-pet.js?${"v=" + appVersion.slice(1)}`, "Concierge runtime is not versioned with APP_VERSION");
assert(html.indexOf("concierge-pet.js") > html.indexOf("app.js"), "Concierge runtime must load after the authenticated app runtime");

[
  'suzuto: { copyKey: "suzuto"',
  'rinna: { copyKey: "rinna"',
  'MODES = { active: true, horizontal: true, vertical: true, fixed: true, off: true }',
  'character: "suzuto", mode: "active"',
  'STORAGE_KEY_PREFIX = "dcats_concierge_pet_v1:"',
  'var user = window.currentUser',
  'syncSettingsOwner();',
  'isSystemAdminSession()',
  'typeof access.isSystemAdmin !== "function"',
  'var systemAdmin = isSystemAdminSession()',
  'var COPY = {',
  'EXCLUDED_SCREENS = { boot: true, login: true, forgot: true, reset: true }',
  'has("dcats_print_station")',
  'saved && MODES[saved.mode]',
  'createChoice("modeHorizontal", "horizontal", "mode")',
  'createChoice("modeVertical", "vertical", "mode")',
  'var horizontalOnly = settings.mode === "horizontal"',
  'var verticalOnly = settings.mode === "vertical"',
  'x = verticalOnly ? fixedX',
  'y = horizontalOnly ? fixedY',
  'createElement("div", "dcats-concierge-sprite")',
  'localStorage.setItem(STORAGE_KEY_PREFIX + settingsOwner',
  'window.DcatsConcierge = Object.freeze',
  'window.addEventListener("dcats:concierge-state"',
  'document.addEventListener("visibilitychange"',
  'window.requestAnimationFrame(function ()',
  'currentVisualKey === visualKey',
  'prefers-reduced-motion: reduce',
  'showFrame(index < 8 ? 9 : 10',
  'var GAZE_MIN_DISTANCE = 112;',
  'var GAZE_DISTANCE_RATIO = .82;',
  'var GAZE_FRAME_SCALES = {',
  'backgroundSize: size',
  'collectExclusionRects()',
  "[role='button']",
  "[role='link']",
  "[data-production-index]",
  'hasBlockingDialog()',
  'has-no-safe-target',
  'return null;',
  'window.cancelAnimationFrame(pointerFrameRequest)',
  'window.addEventListener("scroll", scheduleViewportSync',
  'freezeMovement();',
  'is-revalidating',
  'layoutFrameWindow.requestAnimationFrame(syncViewportLayout)',
  'layoutFrameWindow.cancelAnimationFrame(layoutFrameRequest)',
  'focusTarget.isConnected',
  'has-left-bubble',
  '.overlay.show,.panel.show',
  'PETS[settings.character].className',
  'window.documentPictureInPicture.requestWindow({ width: 360, height: 420 })',
  'if (!isSystemAdminSession() || floatingRequestPending) return;',
  'root.classList.add("is-floating")',
  'requestedWindow.document.body.appendChild(root)',
  'restoreFromFloatingWindow(requestedWindow, false)',
  'floatingDocument.head.appendChild(stylesheet)',
  'stylesheet.addEventListener("load", scheduleViewportSync, { once: true })',
  'new URL("assets/concierge-pet/concierge-pet.css", document.baseURI).href',
  'return isFloatingWindowOpen() ? floatingWindow : window;',
  'var activeDocument = presentationDocument();',
  'toggleFloating: toggleFloatingWindow',
  'isFloating: isFloatingWindowOpen',
  '追加料金：0円（ブラウザ標準機能）'
].forEach((fragment) => requireFragment(runtime, fragment));

requireFragment(runtime, 'if (!visible || isPresentationHidden() || settings.mode === "off")', "Off mode must stop before panel animation handling");
requireFragment(runtime, 'settings.mode === "off" || root.classList.contains("has-no-safe-target")', "External states must not revive a concierge without a safe target");
requireFragment(runtime, 'if (!isSystemAdminSession() || panelOpen) return;', "Concierge settings must fail closed outside a system-admin session");
requireFragment(runtime, 'if (!isSystemAdminSession() || floatingRequestPending) return;', "Floating display must fail closed outside a system-admin session");
requireFragment(runtime, 'suzuto: { copyKey: "suzuto", className: "is-suzuto", travelRows: { right: "running-right", left: "running-left" } }', "Suzuto travel rows must match the approved atlas direction");
requireFragment(runtime, 'rinna: { copyKey: "rinna", className: "is-rinna", travelRows: { right: "running-left", left: "running-right" } }', "Rinna travel rows must compensate for the approved atlas direction");
requireFragment(runtime, "var TRAVEL_TURN_DELAY = 220;", "Directional travel must pause briefly after turning");
requireFragment(runtime, "Math.max(GAZE_MIN_DISTANCE, Math.max(rect.width, rect.height) * GAZE_DISTANCE_RATIO)", "Near-pointer gaze must keep the stable front-facing idle row");
requireFragment(runtime, "gazeScale(index)", "Directional gaze must compensate for approved-atlas scale differences");
requireFragment(runtime, "playRow(travelRowFor(dx), Infinity);", "Travel must select a character-aware facing direction");
requireFragment(runtime, "var turnOffset = TRAVEL_TURN_DELAY / duration;", "Travel must reserve time to face the destination before moving");
requireFragment(runtime, 'var mirrorTravel = settings.character === "rinna" && rowName === PETS.rinna.travelRows.right;', "Rinna must identify rightward browser travel before mirroring");
requireFragment(runtime, 'sprite.classList.toggle("is-travel-mirrored", mirrorTravel);', "Rinna must face right during animated and reduced-motion rightward travel");
requireFragment(runtime, 'sprite.classList.remove("is-travel-mirrored");', "Static and gaze frames must clear the travel-only mirror");
requireFragment(runtime, 'if (isFloatingWindowOpen()) return clampToViewport({ x: 8, y: 8 }, size, viewport);', "A cramped floating window must keep the concierge visible");

assert((runtime.match(/createElement\("div", "dcats-concierge-sprite"\)/g) || []).length === 1, "Runtime must create exactly one visible sprite element");
assert(!runtime.includes("innerHTML"), "Concierge UI must not use innerHTML");
assert(!runtime.includes("eval("), "Concierge runtime must not use eval");
assert(!runtime.includes(".style."), "Strict CSP forbids inline style mutation");
assert(!runtime.includes('setAttribute("style"'), "Strict CSP forbids style attributes");
assert(!runtime.includes("fetch("), "Concierge preferences must remain local and must not add network/API work");
assert(!runtime.includes("window.open("), "A normal popup cannot guarantee always-on-top concierge display");

const copyStart = runtime.indexOf("\n  var COPY = {");
const copyEnd = runtime.indexOf("\n  var STATE_MESSAGE_KEYS", copyStart);
assert(copyStart >= 0 && copyEnd > copyStart, "Concierge local translation dictionary is missing");
const copyContext = {};
vm.createContext(copyContext);
vm.runInContext(runtime.slice(copyStart, copyEnd).replace(/^\s*var COPY\s*=\s*/, "COPY = "), copyContext);
const copyLanguages = Object.keys(copyContext.COPY || {}).sort();
assert(JSON.stringify(copyLanguages) === JSON.stringify(["en", "ja", "zh"]), "Concierge must define Japanese, English, and Chinese copy");
const conciergeCopyKeys = Object.keys(copyContext.COPY.ja || {}).sort();
["en", "zh"].forEach((language) => {
  assert(JSON.stringify(Object.keys(copyContext.COPY[language] || {}).sort()) === JSON.stringify(conciergeCopyKeys), `Concierge ${language} copy keys do not match Japanese`);
  conciergeCopyKeys.forEach((key) => assert(String(copyContext.COPY[language][key] || "").trim(), `Concierge ${language}.${key} is empty`));
});

[
  "idle: { row: 0",
  '"running-right": { row: 1',
  '"running-left": { row: 2',
  "waving: { row: 3",
  "jumping: { row: 4",
  "failed: { row: 5",
  "waiting: { row: 6",
  "running: { row: 7",
  "review: { row: 8"
].forEach((fragment) => requireFragment(runtime, fragment, `Missing atlas row contract: ${fragment}`));

requireFragment(css, `./suzuto/spritesheet.webp?v=${appVersion.slice(1)}`);
requireFragment(css, `./rinna/spritesheet.webp?v=${appVersion.slice(1)}`);
requireFragment(css, ".dcats-concierge-sprite.is-suzuto");
requireFragment(css, ".dcats-concierge-sprite.is-rinna");
requireFragment(css, ".dcats-concierge-sprite.is-rinna.is-travel-mirrored");
requireFragment(css, "transform: scaleX(-1);");
requireFragment(css, "@media (prefers-reduced-motion: reduce)");
requireFragment(css, "@media print");
requireFragment(css, "z-index: 190");
requireFragment(css, "max-height: calc(100dvh");
requireFragment(css, "visibility: hidden", "A concierge without a safe target must leave keyboard and accessibility navigation");
requireFragment(css, "html.dcats-concierge-floating-document");
requireFragment(css, "body.dcats-concierge-floating-body");
requireFragment(css, ".dcats-concierge-floating-cost");
assert(/html\.dcats-concierge-floating-document,\s*body\.dcats-concierge-floating-body\s*\{[^}]*background:\s*transparent;/s.test(css), "Floating concierge document must not paint the decorative window background");
requireFragment(css, "--dcats-concierge-width: max(32px, min(192px, calc(100vw - 16px), calc(92.3077dvh - 14.7692px)));", "Floating concierge character must shrink with both window axes");
requireFragment(css, "--dcats-concierge-height: auto;", "Floating concierge character height must follow its aspect ratio");
requireFragment(css, "aspect-ratio: 12 / 13;", "Floating concierge character must preserve the native atlas aspect ratio");
assert(!css.includes("radial-gradient(circle at 18% 18%"), "Floating concierge must not retain the decorative window background");
assert(!css.includes("data:"), "Concierge stylesheet must not embed sprite data URLs");

const expectedPets = [
  { dir: "suzuto", id: "dcats-suzuto", displayName: "スズト", sha256: "DC5978A1C172A0A66D8DFAFF8C0C0F15AABCE474C266FF3F1B63E009661431C7" },
  { dir: "rinna", id: "dcats-rinna", displayName: "リンナ", sha256: "6095678C6515F73EA870266B6383BDAA22C8DB99E7CA96F2F6E597D82E16850E" }
];

for (const expected of expectedPets) {
  const petDir = path.join(root, "assets", "concierge-pet", expected.dir);
  const manifestPath = path.join(petDir, "pet.json");
  const spritesheetPath = path.join(petDir, "spritesheet.webp");
  assert(fs.existsSync(manifestPath), `Missing ${expected.dir}/pet.json`);
  assert(fs.existsSync(spritesheetPath), `Missing ${expected.dir}/spritesheet.webp`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  assert(manifest.id === expected.id, `Unexpected ${expected.dir} pet id`);
  assert(manifest.displayName === expected.displayName, `Unexpected ${expected.dir} display name`);
  assert(manifest.spriteVersionNumber === 2, `${expected.dir} must use spriteVersionNumber 2`);
  assert(manifest.spritesheetPath === "spritesheet.webp", `${expected.dir} manifest must use the local spritesheet`);
  assert(manifest.spritesheetSha256 === expected.sha256, `${expected.dir} manifest hash is not the approved atlas hash`);
  assert(manifest.spritesheetWidth === 1536 && manifest.spritesheetHeight === 2288, `${expected.dir} manifest dimensions are invalid`);
  assert(manifest.columns === 8 && manifest.rows === 11, `${expected.dir} manifest grid is invalid`);
  const buffer = fs.readFileSync(spritesheetPath);
  const bytes = buffer.length;
  assert(bytes > 0 && bytes <= 12 * 1024 * 1024, `${expected.dir} spritesheet exceeds the 12 MiB UI asset budget`);
  const actualSha = crypto.createHash("sha256").update(buffer).digest("hex").toUpperCase();
  assert(actualSha === expected.sha256, `${expected.dir} spritesheet hash does not match the approved atlas`);
  const size = readLosslessWebpSize(buffer);
  assert(size.width === 1536 && size.height === 2288, `${expected.dir} spritesheet must be 1536x2288`);
}

console.log(`Concierge pet verification passed (${appVersion}; one selected character, 5 movement modes, always-on-top floating display, 9 motion states, 16 gaze directions).`);
