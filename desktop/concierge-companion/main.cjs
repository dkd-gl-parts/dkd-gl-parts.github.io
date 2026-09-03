"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const {
  app,
  BrowserWindow,
  Menu,
  Tray,
  ipcMain,
  nativeImage,
  nativeTheme,
  net,
  protocol,
  screen,
  shell
} = require("electron");

const APP_SCHEME = "dcats-concierge";
const CHANNEL_STATE = "dcats-concierge:state";
const CHANNEL_SHOW_MENU = "dcats-concierge:show-menu";
const TRUSTED_D_CATS_URL = "https://dcats.daiko-denki.co.jp/";
const CHARACTER_IDS = new Set(["suzuto", "rinna"]);
const MODE_IDS = new Set(["active", "horizontal", "vertical", "fixed", "off"]);
const SIZE_IDS = new Set(["small", "normal", "large"]);
const SIZE_PRESETS = Object.freeze({
  small: Object.freeze({ width: 210, height: 248 }),
  normal: Object.freeze({ width: 280, height: 320 }),
  large: Object.freeze({ width: 350, height: 400 })
});
const HORIZONTAL_STEPS_PER_LEG = 72;
const MOTION_STEP_MS = 32;
const REST_MIN_MS = 3000;
const REST_MAX_MS = 4600;
const REST_GESTURE_ORDER = Object.freeze(["escort", "handshake", "shy"]);
const DEFAULT_PREFERENCES = Object.freeze({
  character: "suzuto",
  mode: "active",
  size: "normal",
  clickThrough: false,
  bounds: null
});

protocol.registerSchemesAsPrivileged([{
  scheme: APP_SCHEME,
  privileges: {
    standard: true,
    secure: true,
    supportFetchAPI: true
  }
}]);

app.enableSandbox();

let petWindow = null;
let tray = null;
let preferences = { ...DEFAULT_PREFERENCES };
let boundsSaveTimer = null;
let motionTimer = null;
let motionVelocity = { x: 0, y: 0 };
let horizontalStepsUntilTurn = 0;
let motionStepsRemaining = 0;
let motionPhase = "idle";
let restGestureIndex = 0;
let restGesture = "idle";
let facing = "right";
let isQuitting = false;

function repositoryRoot() {
  return path.resolve(__dirname, "..", "..");
}

function resourceRoot() {
  return app.isPackaged ? process.resourcesPath : repositoryRoot();
}

function preferencesPath() {
  return path.join(app.getPath("userData"), "concierge-preferences.json");
}

function sanitizeBounds(value) {
  if (!value || typeof value !== "object") return null;
  const x = Number(value.x);
  const y = Number(value.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x: Math.round(x), y: Math.round(y) };
}

function sanitizePreferences(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    character: CHARACTER_IDS.has(source.character) ? source.character : DEFAULT_PREFERENCES.character,
    mode: MODE_IDS.has(source.mode) ? source.mode : DEFAULT_PREFERENCES.mode,
    size: SIZE_IDS.has(source.size) ? source.size : DEFAULT_PREFERENCES.size,
    clickThrough: source.clickThrough === true,
    bounds: sanitizeBounds(source.bounds)
  };
}

function loadPreferences() {
  try {
    preferences = sanitizePreferences(JSON.parse(fs.readFileSync(preferencesPath(), "utf8")));
  } catch (_error) {
    preferences = { ...DEFAULT_PREFERENCES };
  }
}

function savePreferences() {
  const target = preferencesPath();
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(preferences, null, 2), { encoding: "utf8", mode: 0o600 });
}

function resolveAppResource(requestUrl) {
  const url = new URL(requestUrl);
  if (url.hostname !== "app") return null;
  const pathname = decodeURIComponent(url.pathname);
  const rendererFiles = new Map([
    ["/index.html", path.join(__dirname, "renderer", "index.html")],
    ["/styles.css", path.join(__dirname, "renderer", "styles.css")],
    ["/renderer.js", path.join(__dirname, "renderer", "renderer.js")]
  ]);
  const assetFiles = new Map([
    ["/assets/concierge-pet/suzuto/spritesheet.webp", path.join(resourceRoot(), "assets", "concierge-pet", "suzuto", "spritesheet.webp")],
    ["/assets/concierge-pet/rinna/spritesheet.webp", path.join(resourceRoot(), "assets", "concierge-pet", "rinna", "spritesheet.webp")]
  ]);
  return rendererFiles.get(pathname) || assetFiles.get(pathname) || null;
}

function registerAppProtocol() {
  protocol.handle(APP_SCHEME, (request) => {
    const filePath = resolveAppResource(request.url);
    if (!filePath || !fs.existsSync(filePath)) return new Response("Not found", { status: 404 });
    return net.fetch(pathToFileURL(filePath).toString());
  });
}

function windowBoundsFor(sizeId) {
  const preset = SIZE_PRESETS[sizeId] || SIZE_PRESETS.normal;
  const display = screen.getPrimaryDisplay();
  const workArea = display.workArea;
  const saved = preferences.bounds;
  const proposed = {
    x: saved ? saved.x : workArea.x + workArea.width - preset.width - 24,
    y: saved ? saved.y : workArea.y + workArea.height - preset.height - 24,
    width: preset.width,
    height: preset.height
  };
  return clampBoundsToDisplays(proposed);
}

function clampBoundsToDisplays(bounds) {
  const displays = screen.getAllDisplays();
  let display = displays.find((candidate) => {
    const area = candidate.workArea;
    return bounds.x < area.x + area.width && bounds.x + bounds.width > area.x && bounds.y < area.y + area.height && bounds.y + bounds.height > area.y;
  }) || screen.getPrimaryDisplay();
  const area = display.workArea;
  return {
    x: Math.max(area.x, Math.min(bounds.x, area.x + Math.max(0, area.width - bounds.width))),
    y: Math.max(area.y, Math.min(bounds.y, area.y + Math.max(0, area.height - bounds.height))),
    width: Math.min(bounds.width, area.width),
    height: Math.min(bounds.height, area.height)
  };
}

function iconPath() {
  return app.isPackaged ? path.join(process.resourcesPath, "favicon.ico") : path.join(repositoryRoot(), "favicon.ico");
}

function sendState() {
  if (!petWindow || petWindow.isDestroyed() || petWindow.webContents.isDestroyed()) return;
  petWindow.webContents.send(CHANNEL_STATE, {
    character: preferences.character,
    mode: preferences.mode,
    size: preferences.size,
    clickThrough: preferences.clickThrough,
    facing,
    moving: motionPhase === "moving",
    restGesture
  });
}

function stopWindowMotion() {
  if (motionTimer) clearTimeout(motionTimer);
  motionTimer = null;
  motionVelocity = { x: 0, y: 0 };
  horizontalStepsUntilTurn = 0;
  motionStepsRemaining = 0;
  motionPhase = "idle";
  restGesture = "idle";
}

function updateFacing(horizontalVelocity) {
  if (!horizontalVelocity) return;
  const nextFacing = horizontalVelocity < 0 ? "left" : "right";
  if (nextFacing === facing) return;
  facing = nextFacing;
  sendState();
}

function moveWindowOneStep() {
  if (!petWindow || petWindow.isDestroyed() || !petWindow.isVisible()) return;
  const bounds = petWindow.getBounds();
  const area = screen.getDisplayMatching(bounds).workArea;
  const minimumX = area.x;
  const maximumX = area.x + Math.max(0, area.width - bounds.width);
  const minimumY = area.y;
  const maximumY = area.y + Math.max(0, area.height - bounds.height);
  let x = bounds.x + motionVelocity.x;
  let y = bounds.y + motionVelocity.y;

  if (x < minimumX || x > maximumX) {
    motionVelocity.x *= -1;
    x = Math.max(minimumX, Math.min(maximumX, x));
    horizontalStepsUntilTurn = HORIZONTAL_STEPS_PER_LEG;
    updateFacing(motionVelocity.x);
  }
  if (y < minimumY || y > maximumY) {
    motionVelocity.y *= -1;
    y = Math.max(minimumY, Math.min(maximumY, y));
  }
  petWindow.setPosition(Math.round(x), Math.round(y), false);
}

function isMovingMode() {
  return preferences.mode === "active" || preferences.mode === "horizontal" || preferences.mode === "vertical";
}

function scheduleMotionStep() {
  motionTimer = setTimeout(runMotionStep, MOTION_STEP_MS);
}

function beginMovingPhase() {
  if (!petWindow || petWindow.isDestroyed() || !petWindow.isVisible() || nativeTheme.shouldUseReducedMotion || !isMovingMode()) {
    stopWindowMotion();
    sendState();
    return;
  }
  motionPhase = "moving";
  restGesture = "idle";
  motionStepsRemaining = HORIZONTAL_STEPS_PER_LEG;
  horizontalStepsUntilTurn = motionVelocity.x ? HORIZONTAL_STEPS_PER_LEG : 0;
  sendState();
  scheduleMotionStep();
}

function beginRestPhase() {
  motionPhase = "resting";
  restGesture = REST_GESTURE_ORDER[restGestureIndex % REST_GESTURE_ORDER.length];
  restGestureIndex += 1;
  const previousFacing = facing;
  if (motionVelocity.x && horizontalStepsUntilTurn <= 0) {
    motionVelocity.x *= -1;
    horizontalStepsUntilTurn = HORIZONTAL_STEPS_PER_LEG;
    updateFacing(motionVelocity.x);
  }
  if (facing === previousFacing) sendState();
  const restDuration = REST_MIN_MS + Math.floor(Math.random() * (REST_MAX_MS - REST_MIN_MS + 1));
  motionTimer = setTimeout(beginMovingPhase, restDuration);
}

function runMotionStep() {
  motionTimer = null;
  if (!petWindow || petWindow.isDestroyed() || !petWindow.isVisible() || nativeTheme.shouldUseReducedMotion || !isMovingMode()) {
    stopWindowMotion();
    sendState();
    return;
  }
  moveWindowOneStep();
  motionStepsRemaining -= 1;
  if (horizontalStepsUntilTurn > 0) horizontalStepsUntilTurn -= 1;
  if (motionStepsRemaining <= 0) {
    beginRestPhase();
    return;
  }
  scheduleMotionStep();
}

function configureWindowMotion() {
  stopWindowMotion();
  if (!petWindow || petWindow.isDestroyed() || nativeTheme.shouldUseReducedMotion) {
    sendState();
    return;
  }
  if (preferences.mode === "active") motionVelocity = { x: 3, y: 2 };
  else if (preferences.mode === "horizontal") motionVelocity = { x: 4, y: 0 };
  else if (preferences.mode === "vertical") motionVelocity = { x: 0, y: 3 };
  else {
    sendState();
    return;
  }
  horizontalStepsUntilTurn = motionVelocity.x ? HORIZONTAL_STEPS_PER_LEG : 0;
  updateFacing(motionVelocity.x);
  beginMovingPhase();
}

function scheduleBoundsSave() {
  if (!petWindow || petWindow.isDestroyed()) return;
  if (boundsSaveTimer) clearTimeout(boundsSaveTimer);
  boundsSaveTimer = setTimeout(() => {
    boundsSaveTimer = null;
    if (!petWindow || petWindow.isDestroyed()) return;
    const [x, y] = petWindow.getPosition();
    preferences.bounds = { x, y };
    savePreferences();
  }, 250);
}

function setCharacter(character) {
  if (!CHARACTER_IDS.has(character)) return;
  preferences.character = character;
  savePreferences();
  sendState();
  rebuildTrayMenu();
}

function setMode(mode) {
  if (!MODE_IDS.has(mode)) return;
  preferences.mode = mode;
  savePreferences();
  sendState();
  if (mode === "off") {
    stopWindowMotion();
    petWindow.hide();
  } else {
    showPetWindow();
    configureWindowMotion();
  }
  rebuildTrayMenu();
}

function setSize(size) {
  if (!SIZE_IDS.has(size) || !petWindow || petWindow.isDestroyed()) return;
  preferences.size = size;
  const current = petWindow.getBounds();
  const preset = SIZE_PRESETS[size];
  const next = clampBoundsToDisplays({
    x: Math.round(current.x + (current.width - preset.width) / 2),
    y: Math.round(current.y + (current.height - preset.height) / 2),
    width: preset.width,
    height: preset.height
  });
  petWindow.setBounds(next, false);
  preferences.bounds = { x: next.x, y: next.y };
  savePreferences();
  sendState();
  rebuildTrayMenu();
}

function setClickThrough(enabled) {
  preferences.clickThrough = enabled === true;
  petWindow.setIgnoreMouseEvents(preferences.clickThrough, { forward: true });
  savePreferences();
  sendState();
  rebuildTrayMenu();
}

function resetPosition() {
  preferences.bounds = null;
  const next = windowBoundsFor(preferences.size);
  petWindow.setBounds(next, false);
  preferences.bounds = { x: next.x, y: next.y };
  savePreferences();
}

function showPetWindow() {
  if (!petWindow || petWindow.isDestroyed()) return;
  if (preferences.mode === "off") {
    preferences.mode = "fixed";
    savePreferences();
    rebuildTrayMenu();
  }
  petWindow.showInactive();
  petWindow.moveTop();
  sendState();
}

function buildMenuTemplate() {
  return [
    { label: "D-CATS コンシェルジュ（管理者テスト）", enabled: false },
    { type: "separator" },
    {
      label: "キャラクター",
      submenu: [
        { label: "スズト", type: "radio", checked: preferences.character === "suzuto", click: () => setCharacter("suzuto") },
        { label: "リンナ", type: "radio", checked: preferences.character === "rinna", click: () => setCharacter("rinna") }
      ]
    },
    {
      label: "動き方",
      submenu: [
        { label: "よく動く", type: "radio", checked: preferences.mode === "active", click: () => setMode("active") },
        { label: "横移動だけ", type: "radio", checked: preferences.mode === "horizontal", click: () => setMode("horizontal") },
        { label: "縦移動だけ", type: "radio", checked: preferences.mode === "vertical", click: () => setMode("vertical") },
        { label: "定位置", type: "radio", checked: preferences.mode === "fixed", click: () => setMode("fixed") },
        { label: "非表示", type: "radio", checked: preferences.mode === "off", click: () => setMode("off") }
      ]
    },
    {
      label: "大きさ",
      submenu: [
        { label: "小", type: "radio", checked: preferences.size === "small", click: () => setSize("small") },
        { label: "標準", type: "radio", checked: preferences.size === "normal", click: () => setSize("normal") },
        { label: "大", type: "radio", checked: preferences.size === "large", click: () => setSize("large") }
      ]
    },
    { label: "透明部分のクリックを下へ通す", type: "checkbox", checked: preferences.clickThrough, click: (item) => setClickThrough(item.checked) },
    { label: "位置を右下へ戻す", click: resetPosition },
    { type: "separator" },
    { label: "D-CATSを開く", click: () => shell.openExternal(TRUSTED_D_CATS_URL) },
    { label: "終了", click: () => { isQuitting = true; app.quit(); } }
  ];
}

function rebuildTrayMenu() {
  if (!tray) return;
  tray.setContextMenu(Menu.buildFromTemplate(buildMenuTemplate()));
}

function showContextMenu() {
  Menu.buildFromTemplate(buildMenuTemplate()).popup({ window: petWindow });
}

function createTray() {
  const icon = nativeImage.createFromPath(iconPath()).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip("D-CATS コンシェルジュ（管理者テスト）");
  rebuildTrayMenu();
  tray.on("click", showPetWindow);
}

function createWindow() {
  const bounds = windowBoundsFor(preferences.size);
  petWindow = new BrowserWindow({
    ...bounds,
    title: "D-CATS Concierge Admin Pilot",
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: "#00000000",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      devTools: false
    }
  });
  petWindow.setAlwaysOnTop(true, "floating");
  petWindow.setMenuBarVisibility(false);
  petWindow.setIgnoreMouseEvents(preferences.clickThrough, { forward: true });
  petWindow.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  petWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  petWindow.webContents.on("will-navigate", (event) => event.preventDefault());
  petWindow.webContents.on("did-finish-load", () => {
    sendState();
    if (preferences.mode !== "off") petWindow.showInactive();
    configureWindowMotion();
    runQaCaptureIfRequested();
  });
  petWindow.on("move", scheduleBoundsSave);
  petWindow.on("close", (event) => {
    if (isQuitting) return;
    event.preventDefault();
    preferences.mode = "off";
    stopWindowMotion();
    savePreferences();
    petWindow.hide();
    rebuildTrayMenu();
  });
  petWindow.loadURL(`${APP_SCHEME}://app/index.html`);
}

function qaOutputDirectory() {
  const prefix = "--qa-output=";
  const argument = process.argv.find((value) => value.startsWith(prefix));
  const configuredPath = argument ? argument.slice(prefix.length) : process.env.DCATS_CONCIERGE_QA_OUTPUT;
  return configuredPath ? path.resolve(configuredPath) : null;
}

function runQaCaptureIfRequested() {
  const outputDirectory = qaOutputDirectory();
  if (!outputDirectory) return;
  const initialBounds = petWindow.getBounds();
  const configuredDelay = Number(process.env.DCATS_CONCIERGE_QA_DELAY_MS);
  const captureDelay = Number.isFinite(configuredDelay) ? Math.max(400, Math.min(10000, configuredDelay)) : 800;
  setTimeout(async () => {
    try {
      fs.mkdirSync(outputDirectory, { recursive: true });
      const image = await petWindow.capturePage();
      fs.writeFileSync(path.join(outputDirectory, "transparent-window.png"), image.toPNG());
      const spriteBackgroundPositionY = await petWindow.webContents.executeJavaScript(
        "getComputedStyle(document.querySelector('.pet-sprite')).backgroundPositionY",
        true
      );
      const bitmap = image.toBitmap();
      const imageSize = image.getSize();
      const alphaSamples = [
        3,
        Math.max(3, (imageSize.width - 1) * 4 + 3),
        Math.max(3, ((imageSize.height - 1) * imageSize.width) * 4 + 3),
        Math.max(3, (imageSize.width * imageSize.height - 1) * 4 + 3)
      ].map((offset) => bitmap[offset]);
      const finalBounds = petWindow.getBounds();
      const report = {
        transparentRequested: true,
        frameless: true,
        alwaysOnTop: petWindow.isAlwaysOnTop(),
        character: preferences.character,
        mode: preferences.mode,
        facing,
        moving: motionPhase === "moving",
        motionPhase,
        restGesture,
        spriteBackgroundPositionY,
        initialBounds,
        finalBounds,
        movementDelta: {
          x: finalBounds.x - initialBounds.x,
          y: finalBounds.y - initialBounds.y
        },
        alphaSamples
      };
      fs.writeFileSync(path.join(outputDirectory, "qa-report.json"), JSON.stringify(report, null, 2), "utf8");
      process.stdout.write(`${JSON.stringify(report)}\n`);
      isQuitting = true;
      app.quit();
    } catch (error) {
      process.stderr.write(`${error && error.stack || error}\n`);
      app.exit(1);
    }
  }, captureDelay);
}

ipcMain.on(CHANNEL_SHOW_MENU, (event) => {
  if (!petWindow || petWindow.isDestroyed() || event.sender !== petWindow.webContents) return;
  showContextMenu();
});

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", showPetWindow);
  app.whenReady().then(() => {
    loadPreferences();
    if (qaOutputDirectory()) {
      const qaMode = MODE_IDS.has(process.env.DCATS_CONCIERGE_QA_MODE) && process.env.DCATS_CONCIERGE_QA_MODE !== "off"
        ? process.env.DCATS_CONCIERGE_QA_MODE
        : "active";
      const qaCharacter = CHARACTER_IDS.has(process.env.DCATS_CONCIERGE_QA_CHARACTER)
        ? process.env.DCATS_CONCIERGE_QA_CHARACTER
        : preferences.character;
      preferences = { ...preferences, character: qaCharacter, mode: qaMode, clickThrough: false };
    }
    registerAppProtocol();
    createWindow();
    createTray();
    nativeTheme.on("updated", configureWindowMotion);
  });
  app.on("before-quit", stopWindowMotion);
  app.on("window-all-closed", () => {
    if (isQuitting) app.quit();
  });
}
