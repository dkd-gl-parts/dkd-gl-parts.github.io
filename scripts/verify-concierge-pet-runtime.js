const fs = require("fs");
const path = require("path");
const vm = require("vm");

const rootDir = path.resolve(__dirname, "..");
const runtime = fs.readFileSync(path.join(rootDir, "assets", "concierge-pet", "concierge-pet.js"), "utf8");
const observers = [];
const animations = [];
const storage = new Map();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

class FakeClassList {
  constructor(owner) {
    this.owner = owner;
    this.values = new Set();
  }
  add(...names) { names.forEach((name) => this.values.add(name)); }
  remove(...names) { names.forEach((name) => this.values.delete(name)); }
  contains(name) { return this.values.has(name); }
  toggle(name, force) {
    const next = force == null ? !this.contains(name) : Boolean(force);
    if (next) this.add(name); else this.remove(name);
    return next;
  }
  set(value) { this.values = new Set(String(value || "").split(/\s+/).filter(Boolean)); }
  toString() { return Array.from(this.values).join(" "); }
}

class FakeAnimation {
  constructor(owner, keyframes, options) {
    this.owner = owner;
    this.keyframes = keyframes || [];
    this.options = options || {};
    this.playState = this.options.iterations === Infinity ? "running" : "finished";
    this.canceled = false;
    this.finished = Promise.resolve();
    const lastFrame = this.keyframes[this.keyframes.length - 1] || {};
    const transform = /translate3d\((-?[\d.]+)px,(-?[\d.]+)px,0\)/.exec(String(lastFrame.transform || ""));
    if (transform) owner.transformPoint = { x: Number(transform[1]), y: Number(transform[2]) };
    animations.push(this);
  }
  cancel() {
    this.canceled = true;
    this.playState = "idle";
  }
}

class FakeElement {
  constructor(tagName, documentRef) {
    this.tagName = String(tagName || "div").toUpperCase();
    this.ownerDocument = documentRef;
    this.nodeType = 1;
    this.children = [];
    this.parentElement = null;
    this.dataset = {};
    this.attributes = new Map();
    this.listeners = new Map();
    this.classList = new FakeClassList(this);
    this.hidden = false;
    this.id = "";
    this.textContent = "";
    this.type = "";
    this.isConnected = false;
    this.transformPoint = null;
    this.customRect = null;
    this.capturedPointerId = null;
  }
  get className() { return this.classList.toString(); }
  set className(value) { this.classList.set(value); }
  appendChild(child) {
    if (child.parentElement) {
      child.parentElement.children = child.parentElement.children.filter((candidate) => candidate !== child);
    }
    child.parentElement = this;
    child.setOwnerDocument(this.ownerDocument);
    child.setConnected(this.isConnected);
    this.children.push(child);
    return child;
  }
  setOwnerDocument(documentRef) {
    this.ownerDocument = documentRef;
    this.children.forEach((child) => child.setOwnerDocument(documentRef));
  }
  setConnected(value) {
    this.isConnected = value;
    this.children.forEach((child) => child.setConnected(value));
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  hasAttribute(name) { return this.attributes.has(name); }
  addEventListener(type, listener) {
    const list = this.listeners.get(type) || [];
    list.push(listener);
    this.listeners.set(type, list);
  }
  contains(node) {
    if (node === this) return true;
    return this.children.some((child) => child.contains(node));
  }
  descendants() {
    return this.children.flatMap((child) => [child, ...child.descendants()]);
  }
  querySelectorAll(selector) {
    if (selector === "[data-concierge-copy]") {
      return this.descendants().filter((element) => element.dataset.conciergeCopy);
    }
    if (selector.includes("[role='button']") && selector.includes("[data-production-index]")) {
      return this.descendants().filter((element) => (
        element.getAttribute("role") === "button" ||
        element.getAttribute("role") === "link" ||
        element.hasAttribute("data-production-index") ||
        (element.hasAttribute("tabindex") && element.getAttribute("tabindex") !== "-1")
      ));
    }
    return [];
  }
  getBoundingClientRect() {
    if (!isRendered(this)) return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
    if (this.customRect) return { ...this.customRect };
    const ownerWindow = this.ownerDocument && this.ownerDocument.defaultView || windowObject;
    const mobile = ownerWindow.innerWidth <= 700;
    const floatingMover = this.classList.contains("dcats-concierge-mover") && ownerWindow !== windowObject;
    const floatingWidth = Math.max(32, Math.min(192, ownerWindow.innerWidth - 16, (ownerWindow.innerHeight - 16) * 12 / 13));
    const width = this.classList.contains("dcats-concierge-mover") ? (floatingMover ? floatingWidth : (mobile ? 88 : 118)) : 120;
    const height = this.classList.contains("dcats-concierge-mover") ? (floatingMover ? floatingWidth * 13 / 12 : (mobile ? 96 : 128)) : 44;
    const left = this.transformPoint ? this.transformPoint.x : 20;
    const top = this.transformPoint ? this.transformPoint.y : 80;
    return { left, top, right: left + width, bottom: top + height, width, height };
  }
  getClientRects() { return isRendered(this) ? [this.getBoundingClientRect()] : []; }
  animate(keyframes, options) { return new FakeAnimation(this, keyframes, options); }
  setPointerCapture(pointerId) { this.capturedPointerId = pointerId; }
  hasPointerCapture(pointerId) { return this.capturedPointerId === pointerId; }
  releasePointerCapture(pointerId) { if (this.capturedPointerId === pointerId) this.capturedPointerId = null; }
  focus() { this.ownerDocument.activeElement = this; }
  closest() { return null; }
}

function isRendered(element) {
  let current = element;
  while (current) {
    if (current.hidden) return false;
    if (current.classList && current.classList.contains("is-off") && element.classList.contains("dcats-concierge-mover")) return false;
    current = current.parentElement;
  }
  return true;
}

const documentObject = {
  readyState: "complete",
  hidden: true,
  activeElement: null,
  listeners: new Map(),
  createElement(tag) { return new FakeElement(tag, this); },
  addEventListener(type, listener) {
    const list = this.listeners.get(type) || [];
    list.push(listener);
    this.listeners.set(type, list);
  },
  querySelector(selector) {
    if (selector === ".screen.active") return activeScreen;
    return null;
  },
  querySelectorAll(selector) {
    if (selector === ".screen") return [activeScreen];
    return [];
  }
};
documentObject.documentElement = new FakeElement("html", documentObject);
documentObject.documentElement.lang = "ja";
documentObject.documentElement.setConnected(true);
documentObject.head = new FakeElement("head", documentObject);
documentObject.head.setConnected(true);
documentObject.body = new FakeElement("body", documentObject);
documentObject.body.setConnected(true);
documentObject.baseURI = "https://dcats.example.test/";
const activeScreen = new FakeElement("main", documentObject);
activeScreen.id = "screen-menu";
activeScreen.className = "screen active";
documentObject.body.appendChild(activeScreen);

class FakeMutationObserver {
  constructor(callback) { this.callback = callback; observers.push(this); }
  observe() {}
}

let frameId = 0;
const pendingFrames = new Map();
const pendingTimers = new Map();
let timerId = 0;
const windowListeners = new Map();
const reduceMotionListeners = [];
const reduceMotionQuery = {
  matches: false,
  addEventListener(type, listener) { if (type === "change") reduceMotionListeners.push(listener); },
  addListener(listener) { reduceMotionListeners.push(listener); }
};
const sandboxMath = Object.create(Math);
sandboxMath.random = () => Math.random();
const floatingRequests = [];
const floatingWindows = [];

function createFloatingDocument() {
  const listeners = new Map();
  const floatingDocument = {
    readyState: "complete",
    hidden: false,
    activeElement: null,
    title: "",
    baseURI: "https://dcats.example.test/",
    listeners,
    createElement(tag) { return new FakeElement(tag, this); },
    addEventListener(type, listener) {
      const list = listeners.get(type) || [];
      list.push(listener);
      listeners.set(type, list);
    },
    querySelector() { return null; },
    querySelectorAll() { return []; }
  };
  floatingDocument.documentElement = new FakeElement("html", floatingDocument);
  floatingDocument.documentElement.setConnected(true);
  floatingDocument.head = new FakeElement("head", floatingDocument);
  floatingDocument.head.setConnected(true);
  floatingDocument.body = new FakeElement("body", floatingDocument);
  floatingDocument.body.setConnected(true);
  return floatingDocument;
}

function createFloatingWindow() {
  const listeners = new Map();
  const floatingDocument = createFloatingDocument();
  const floating = {
    innerWidth: 360,
    innerHeight: 420,
    closed: false,
    document: floatingDocument,
    addEventListener(type, listener) {
      const list = listeners.get(type) || [];
      list.push(listener);
      listeners.set(type, list);
    },
    dispatchForTest(type, event = {}) { dispatch(listeners, type, event); },
    close() {
      if (this.closed) return;
      this.closed = true;
      floatingDocument.hidden = true;
      dispatch(listeners, "pagehide", { target: floatingDocument });
    },
    requestAnimationFrame(callback) { return windowObject.requestAnimationFrame(callback); },
    cancelAnimationFrame(id) { windowObject.cancelAnimationFrame(id); },
    getComputedStyle(element) { return windowObject.getComputedStyle(element); }
  };
  floatingDocument.defaultView = floating;
  floatingWindows.push(floating);
  return floating;
}

const windowObject = {
  innerWidth: 1200,
  innerHeight: 800,
  location: { search: "", href: "https://dcats.example.test/", origin: "https://dcats.example.test" },
  currentUser: { id: "user-a" },
  userProfile: { role: "price_viewer" },
  DcatsAccess: { isSystemAdmin: () => Boolean(windowObject.userProfile && windowObject.userProfile.role === "system_admin") },
  matchMedia() { return reduceMotionQuery; },
  addEventListener(type, listener) {
    const list = windowListeners.get(type) || [];
    list.push(listener);
    windowListeners.set(type, list);
  },
  requestAnimationFrame(callback) { frameId += 1; pendingFrames.set(frameId, callback); return frameId; },
  cancelAnimationFrame(id) { pendingFrames.delete(id); },
  getComputedStyle(element) {
    return { display: isRendered(element) ? "block" : "none", visibility: "visible", opacity: "1" };
  },
  documentPictureInPicture: {
    async requestWindow(options) {
      floatingRequests.push({ ...options });
      return createFloatingWindow();
    }
  }
};
documentObject.defaultView = windowObject;

const context = {
  window: windowObject,
  document: documentObject,
  localStorage: {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, String(value)); }
  },
  MutationObserver: FakeMutationObserver,
  URLSearchParams,
  URL,
  Promise,
  Math: sandboxMath,
  Date,
  Number,
  Object,
  JSON,
  String,
  Infinity,
  setTimeout(callback, delay) { timerId += 1; pendingTimers.set(timerId, { callback, delay: Number(delay) }); return timerId; },
  clearTimeout(id) { pendingTimers.delete(id); }
};
windowObject.window = windowObject;
windowObject.document = documentObject;
windowObject.localStorage = context.localStorage;
windowObject.MutationObserver = FakeMutationObserver;
windowObject.URLSearchParams = URLSearchParams;
windowObject.setTimeout = context.setTimeout;
windowObject.clearTimeout = context.clearTimeout;

vm.createContext(context);
vm.runInContext(runtime, context, { filename: "concierge-pet.js" });

function allElements() { return [documentObject.body, ...documentObject.body.descendants()]; }
function byClass(className) { return allElements().filter((element) => element.classList.contains(className)); }
function notifyObservers() { observers.forEach((observer) => observer.callback([])); }
function dispatch(listeners, type, event = {}) {
  (listeners.get(type) || []).forEach((listener) => listener({ type, ...event }));
}
function flushAnimationFrames(limit = 20) {
  let passes = 0;
  while (pendingFrames.size && passes < limit) {
    const callbacks = Array.from(pendingFrames.values());
    pendingFrames.clear();
    callbacks.forEach((callback) => callback(Date.now()));
    passes += 1;
  }
  assert(!pendingFrames.size, "Animation-frame work did not settle");
}
function liveInfiniteAnimations() {
  return animations.filter((animation) => animation.options.iterations === Infinity && !animation.canceled);
}
function lastAnimationFor(element) {
  return animations.filter((animation) => animation.owner === element).at(-1);
}
function animationEndpoints(animation) {
  const points = (animation && animation.keyframes || []).map((frame) => {
    const match = /translate3d\((-?[\d.]+)px,(-?[\d.]+)px,0\)/.exec(String(frame.transform || ""));
    return match ? { x: Number(match[1]), y: Number(match[2]) } : null;
  }).filter(Boolean);
  return { start: points[0], end: points.at(-1) };
}

function animationRowPercent(animation) {
  const positions = (animation && animation.keyframes || []).map((frame) => String(frame.backgroundPosition || ""));
  const match = /\s(\d+(?:\.\d+)?)%$/.exec(positions.find(Boolean) || "");
  return match ? Number(match[1]) : null;
}

function animationBackgroundWidthPercent(animation) {
  const sizes = (animation && animation.keyframes || []).map((frame) => String(frame.backgroundSize || ""));
  const match = /^(\d+(?:\.\d+)?)%/.exec(sizes.find(Boolean) || "");
  return match ? Number(match[1]) : null;
}

function animationColumnPercent(animation) {
  const frame = (animation && animation.keyframes || []).find((candidate) => String(candidate.backgroundPosition || "").endsWith("% 80%"));
  const position = String(frame && frame.backgroundPosition || "");
  const match = /^(-?\d+(?:\.\d+)?)%/.exec(position);
  return match ? Number(match[1]) : null;
}

function runTimerWithDelay(expectedDelay) {
  const entry = Array.from(pendingTimers.entries()).find(([, timer]) => timer.delay === expectedDelay);
  assert(entry, `No pending timer has the expected ${expectedDelay} ms delay`);
  pendingTimers.delete(entry[0]);
  entry[1].callback();
}

(async function run() {
const api = windowObject.DcatsConcierge;
assert(api, "Runtime did not expose window.DcatsConcierge");
assert(byClass("dcats-concierge-sprite").length === 1, "Runtime must create exactly one sprite element");
const root = byClass("dcats-concierge")[0];
const mover = byClass("dcats-concierge-mover")[0];
const sprite = byClass("dcats-concierge-sprite")[0];
const hitTarget = byClass("dcats-concierge-hit-target")[0];
const launcher = byClass("dcats-concierge-launcher")[0];
const panel = byClass("dcats-concierge-panel")[0];
const panelClose = byClass("dcats-concierge-panel-close")[0];
const floatingButton = byClass("dcats-concierge-floating-button")[0];
const floatingCost = byClass("dcats-concierge-floating-cost")[0];

assert(root.hidden, "Concierge must be hidden before a system-admin profile is available");
assert(floatingCost.textContent === "追加料金：0円（ブラウザ標準機能）", "Floating display did not disclose its zero additional charge");
await api.toggleFloating();
assert(!floatingRequests.length && !api.isFloating(), "Non-admin API calls opened the floating concierge window");
api.setCharacter("rinna");
api.setMode("fixed");
api.openSettings();
assert(api.getSettings().character === "suzuto" && api.getSettings().mode === "active", "Non-admin API calls changed concierge settings");
assert(panel.hidden, "Non-admin API calls exposed the concierge settings panel");
assert(!storage.size, "Non-admin API calls persisted concierge settings");

windowObject.userProfile = { role: "system_admin" };
notifyObservers();
assert(!root.hidden, "System administrator could not enter concierge test operation");
assert(api.getSettings().character === "suzuto" && api.getSettings().mode === "active", "User A defaults are invalid");

await api.toggleFloating();
const firstFloatingWindow = floatingWindows.at(-1);
assert(floatingRequests.length === 1, "System administrator could not request the floating concierge window");
assert(floatingRequests[0].width === 360 && floatingRequests[0].height === 420, "Floating concierge requested an unexpected initial window size");
assert(api.isFloating() && root.ownerDocument === firstFloatingWindow.document, "Concierge was not moved into the always-on-top presentation window");
assert(root.classList.contains("is-floating"), "Floating concierge state was not applied");
assert(firstFloatingWindow.document.documentElement.classList.contains("dcats-concierge-floating-document"), "Floating document styling hook is missing");
assert(firstFloatingWindow.document.head.children.some((element) => element.tagName === "LINK" && element.rel === "stylesheet"), "Floating document did not load the CSP-safe concierge stylesheet");
assert(floatingButton.getAttribute("aria-pressed") === "true" && floatingButton.textContent === "D-CATS画面に戻す", "Floating display control did not expose its active state");
firstFloatingWindow.innerWidth = 120;
firstFloatingWindow.innerHeight = 120;
firstFloatingWindow.dispatchForTest("resize");
flushAnimationFrames();
const compactFloatingRect = mover.getBoundingClientRect();
assert(compactFloatingRect.width <= 104 && compactFloatingRect.height <= 104, "Floating concierge did not shrink with a cramped window");
assert(compactFloatingRect.left >= 0 && compactFloatingRect.top >= 0 && compactFloatingRect.right <= firstFloatingWindow.innerWidth && compactFloatingRect.bottom <= firstFloatingWindow.innerHeight, "Floating concierge escaped the cramped window viewport");
assert(!root.classList.contains("has-no-safe-target"), "Cramped floating window hid the concierge when no movement lane was available");
firstFloatingWindow.innerWidth = 360;
firstFloatingWindow.innerHeight = 420;
firstFloatingWindow.dispatchForTest("resize");
flushAnimationFrames();
api.setMode("fixed");
assert(liveInfiniteAnimations().some((animation) => animation.owner === sprite), "Floating concierge stopped when the originating D-CATS document was hidden");
api.setMode("active");
activeScreen.id = "screen-search";
notifyObservers();
assert(api.isFloating() && !root.hidden, "Floating concierge disappeared during a D-CATS feature transition");
activeScreen.id = "screen-menu";
notifyObservers();
await api.toggleFloating();
assert(!api.isFloating() && root.ownerDocument === documentObject, "Concierge did not return to the D-CATS document");
assert(firstFloatingWindow.closed && !root.classList.contains("is-floating"), "Floating window did not close cleanly");

api.setMode("fixed");
const dragStart = mover.getBoundingClientRect();
const pointerId = 17;
dispatch(hitTarget.listeners, "pointerdown", {
  target: hitTarget,
  pointerId,
  button: 0,
  isPrimary: true,
  clientX: dragStart.left + dragStart.width / 2,
  clientY: dragStart.top + dragStart.height / 2,
  preventDefault() {},
  stopPropagation() {}
});
assert(root.classList.contains("is-dragging") && hitTarget.hasPointerCapture(pointerId), "Concierge did not capture the primary pointer for dragging");
dispatch(documentObject.listeners, "pointermove", {
  target: hitTarget,
  pointerId,
  clientX: 5000,
  clientY: -500,
  preventDefault() {},
  stopPropagation() {}
});
const draggedRect = mover.getBoundingClientRect();
assert(draggedRect.left >= 8 && draggedRect.top >= 46, "Dragging allowed the concierge to disappear outside the viewport");
assert(draggedRect.left !== dragStart.left || draggedRect.top !== dragStart.top, "Concierge did not follow the drag pointer");
dispatch(documentObject.listeners, "pointerup", {
  target: hitTarget,
  pointerId,
  clientX: 5000,
  clientY: -500,
  preventDefault() {},
  stopPropagation() {}
});
assert(!root.hidden && !root.classList.contains("is-dragging") && !hitTarget.hasPointerCapture(pointerId), "Concierge disappeared or retained pointer capture after dragging");
assert(api.getSettings().mode === "fixed", "Dragging changed the selected movement mode");
const droppedRect = mover.getBoundingClientRect();
assert(droppedRect.left === draggedRect.left && droppedRect.top === draggedRect.top, "Fixed mode did not keep the concierge at the dropped position");
dispatch(hitTarget.listeners, "click", { target: hitTarget });
assert(panel.hidden, "A completed drag was mistaken for a click and opened settings");
sandboxMath.random = () => 0;
api.setMode("active");

documentObject.hidden = false;
dispatch(documentObject.listeners, "visibilitychange");
assert(animationRowPercent(lastAnimationFor(sprite)) === 20, "Suzuto did not face left for leftward travel using his approved atlas rows");
const moveCountBeforeStop = animations.filter((animation) => animation.owner === mover).length;
await new Promise((resolve) => setImmediate(resolve));
assert(animationRowPercent(lastAnimationFor(sprite)) === 0, "Concierge did not visibly stop on the idle row after moving");
assert(animations.filter((animation) => animation.owner === mover).length === moveCountBeforeStop, "Concierge started a second move without a stationary phase");
const expectedStopGestures = [
  { column: 0, duration: 1160, name: "settle" },
  { column: 1, duration: 1530, name: "bow" },
  { column: 2, duration: 1660, name: "escort" },
  { column: 3, duration: 1780, name: "handshake" },
  { column: 4, duration: 1750, name: "shy" },
  { column: 5, duration: 1630, name: "welcome" }
];
for (const expected of expectedStopGestures) {
  runTimerWithDelay(700);
  await new Promise((resolve) => setImmediate(resolve));
  const gestureAnimation = lastAnimationFor(sprite);
  assert(gestureAnimation.keyframes.some((frame) => String(frame.backgroundPosition || "").endsWith("% 80%")), `${expected.name} did not use the review gesture row`);
  assert(gestureAnimation.options.iterations === 1, `${expected.name} repeated instead of playing once`);
  assert(gestureAnimation.keyframes.length === 4, `${expected.name} must enter once, hold, and return to idle`);
  assert(Math.abs(animationColumnPercent(gestureAnimation) - expected.column * 100 / 7) < .001, `${expected.name} used the wrong unique review frame`);
  runTimerWithDelay(expected.duration);
  await new Promise((resolve) => setImmediate(resolve));
  assert(animationRowPercent(lastAnimationFor(sprite)) === 0, `${expected.name} did not return to idle before the next move`);
  if (expected !== expectedStopGestures.at(-1)) {
    runTimerWithDelay(1600);
    await new Promise((resolve) => setImmediate(resolve));
  }
}
documentObject.hidden = true;
dispatch(documentObject.listeners, "visibilitychange");
sandboxMath.random = () => Math.random();

api.setCharacter("rinna");
assert(!liveInfiniteAnimations().length, "Changing character in a hidden tab started an animation");
api.setMode("fixed");
assert(storage.has("dcats_concierge_pet_v1:user-a"), "User A preference was not stored in a user-scoped key");
assert(!storage.has("dcats_concierge_pet_v1"), "Unscoped concierge preference must never be written");
assert(byClass("dcats-concierge-sprite")[0].classList.contains("is-rinna"), "Rinna was not selected");
assert(!byClass("dcats-concierge-sprite")[0].classList.contains("is-suzuto"), "Both character classes must never be active together");

windowObject.currentUser = { id: "user-b" };
notifyObservers();
assert(api.getSettings().character === "suzuto" && api.getSettings().mode === "active", "User B inherited User A preferences");

windowObject.currentUser = { id: "user-a" };
notifyObservers();
assert(api.getSettings().character === "rinna" && api.getSettings().mode === "fixed", "User A preferences were not restored");

documentObject.documentElement.lang = "en";
notifyObservers();
assert(byClass("dcats-concierge-launcher-label")[0].textContent === "Rinna", "English character label did not update");
assert(allElements().some((element) => element.textContent === "Concierge settings"), "English settings copy did not update");
assert(floatingCost.textContent === "Additional charge: JPY 0 (browser feature)", "English floating cost copy did not update");
documentObject.documentElement.lang = "zh-CN";
notifyObservers();
assert(allElements().some((element) => element.textContent === "礼宾助手设置"), "Chinese settings copy did not update");

documentObject.hidden = false;
api.setMode("active");
dispatch(documentObject.listeners, "visibilitychange");
assert(animations.some((animation) => animation.owner === mover && Number(animation.options.duration) >= 1250), "Active mode did not start walking");
assert(liveInfiniteAnimations().some((animation) => animation.owner === sprite), "Active mode did not animate the selected sprite");

const activeDragStart = mover.getBoundingClientRect();
const activePointerId = 23;
dispatch(hitTarget.listeners, "pointerdown", {
  target: hitTarget,
  pointerId: activePointerId,
  button: 0,
  isPrimary: true,
  clientX: activeDragStart.left + activeDragStart.width / 2,
  clientY: activeDragStart.top + activeDragStart.height / 2,
  preventDefault() {},
  stopPropagation() {}
});
dispatch(documentObject.listeners, "pointermove", {
  target: activeScreen,
  pointerId: activePointerId,
  clientX: activeDragStart.left + activeDragStart.width / 2 + 48,
  clientY: activeDragStart.top + activeDragStart.height / 2 + 36,
  preventDefault() {},
  stopPropagation() {}
});
dispatch(documentObject.listeners, "pointerup", {
  target: activeScreen,
  pointerId: activePointerId,
  clientX: activeDragStart.left + activeDragStart.width / 2 + 48,
  clientY: activeDragStart.top + activeDragStart.height / 2 + 36,
  preventDefault() {},
  stopPropagation() {}
});
assert(!root.hidden && !root.classList.contains("is-dragging") && api.getSettings().mode === "active", "Active-mode drag hid the concierge or changed its mode");
runTimerWithDelay(900);
await new Promise((resolve) => setImmediate(resolve));
assert(animations.some((animation) => animation.owner === mover && Number(animation.options.duration) >= 1250 && !animation.canceled), "Active mode did not resume walking after the drag pause");

const gazeRect = mover.getBoundingClientRect();
dispatch(documentObject.listeners, "pointermove", {
  clientX: gazeRect.left + gazeRect.width / 2 + 80,
  clientY: gazeRect.top + gazeRect.height / 2
});
flushAnimationFrames();
const nearPointerAnimation = lastAnimationFor(sprite);
assert(nearPointerAnimation.options.iterations === Infinity && animationRowPercent(nearPointerAnimation) === 0, "A slight pointer movement changed the stable front-facing idle scale");

dispatch(documentObject.listeners, "pointermove", { clientX: 0, clientY: 0 });
flushAnimationFrames();
const gazeAnimation = lastAnimationFor(sprite);
assert(gazeAnimation && gazeAnimation.options.duration === 1, "Pointer gaze did not select a static directional frame");
assert(gazeAnimation.keyframes.some((frame) => String(frame.backgroundPosition || "").endsWith("% 90%") || String(frame.backgroundPosition || "").endsWith("% 100%")), "Pointer gaze did not use one of the 16 gaze directions");
assert(animationBackgroundWidthPercent(gazeAnimation) > 800, "Directional gaze did not compensate for the approved atlas scale difference");

const blockingCard = new FakeElement("div", documentObject);
blockingCard.setAttribute("role", "button");
blockingCard.setAttribute("tabindex", "0");
blockingCard.customRect = { left: -100, top: -100, right: 1400, bottom: 1000, width: 1500, height: 1100 };
activeScreen.appendChild(blockingCard);
api.setMode("fixed");
api.setMode("active");
assert(root.classList.contains("has-no-safe-target"), "Interactive result cards were not treated as movement exclusions");
assert(!liveInfiniteAnimations().length, "No-safe-target retry kept an invisible infinite sprite animation running");
api.setState("working", { duration: 1200 });
assert(root.classList.contains("has-no-safe-target") && !liveInfiniteAnimations().length, "External state revived a concierge without a safe target");
blockingCard.hidden = true;
api.setMode("fixed");
assert(!root.classList.contains("has-no-safe-target"), "Safe-target failure state did not clear after parking");

sandboxMath.random = () => 0;
api.setMode("horizontal");
const horizontalMove = animationEndpoints(lastAnimationFor(mover));
assert(horizontalMove.start && horizontalMove.end && horizontalMove.start.x !== horizontalMove.end.x, "Horizontal-only mode did not move on the x axis");
assert(horizontalMove.start.y === horizontalMove.end.y, "Horizontal-only mode changed the y axis");
const horizontalAnimation = lastAnimationFor(mover);
assert(horizontalAnimation.keyframes.length === 3, "Travel did not include a turn-before-walk hold");
assert(horizontalAnimation.keyframes[0].transform === horizontalAnimation.keyframes[1].transform, "Travel started moving before the concierge changed direction");
assert(animationRowPercent(lastAnimationFor(sprite)) === 20, "Rinna did not use the corrected left-facing row for leftward travel");
api.setMode("fixed");
sandboxMath.random = () => .999;
api.setMode("horizontal");
assert(animationRowPercent(lastAnimationFor(sprite)) === 10, "Rinna did not use the corrected right-facing row for rightward travel");
api.setMode("fixed");
assert(!sprite.classList.contains("is-travel-mirrored"), "Corrected Rinna travel must not use CSS mirroring");
api.setMode("vertical");
const verticalMove = animationEndpoints(lastAnimationFor(mover));
assert(verticalMove.start && verticalMove.end && verticalMove.start.y !== verticalMove.end.y, "Vertical-only mode did not move on the y axis");
assert(verticalMove.start.x === verticalMove.end.x, "Vertical-only mode changed the x axis");
const movementBeforeScroll = lastAnimationFor(mover);
dispatch(windowListeners, "scroll");
assert(lastAnimationFor(mover) === movementBeforeScroll, "Mouse-wheel scrolling restarted the fixed-position concierge movement");
assert(!root.classList.contains("is-revalidating"), "Mouse-wheel scrolling entered viewport revalidation");
assert(!pendingFrames.size, "Mouse-wheel scrolling queued viewport layout work");
sandboxMath.random = () => Math.random();
api.setMode("fixed");

windowObject.innerWidth = 320;
windowObject.innerHeight = 420;
dispatch(windowListeners, "resize");
assert(root.classList.contains("is-revalidating"), "Resize did not suspend the concierge hit target while revalidating");
flushAnimationFrames();
assert(!root.classList.contains("is-revalidating"), "Resize revalidation state did not clear");
const resizedRect = mover.getBoundingClientRect();
assert(resizedRect.left >= 8 && resizedRect.top >= 46 && resizedRect.right <= windowObject.innerWidth && resizedRect.bottom <= windowObject.innerHeight, "Resize did not clamp the concierge inside the viewport");
assert(liveInfiniteAnimations().some((animation) => animation.owner === sprite), "Fixed-mode animation did not resume after resize revalidation");

api.setMode("active");
reduceMotionQuery.matches = true;
reduceMotionListeners.forEach((listener) => listener({ matches: true }));
assert(!liveInfiniteAnimations().length, "Reduced-motion mode left an infinite animation running");
const reducedFrame = lastAnimationFor(sprite);
assert(reducedFrame && reducedFrame.options.duration === 1, "Reduced-motion mode did not hold a static frame");
reduceMotionQuery.matches = false;
reduceMotionListeners.forEach((listener) => listener({ matches: false }));

api.setMode("off");
assert(root.classList.contains("is-off"), "Off mode did not hide the mover");
assert(!liveInfiniteAnimations().length, "Off mode left an infinite animation running");
launcher.focus();
api.openSettings();
assert(!panel.hidden && documentObject.activeElement === panelClose, "Settings did not open with focus on the close control");
assert(!liveInfiniteAnimations().length, "Opening settings while off animated a hidden sprite");
dispatch(documentObject.listeners, "keydown", { key: "Escape" });
assert(panel.hidden && documentObject.activeElement === launcher, "Closing settings did not restore launcher focus");

api.setMode("active");
await api.toggleFloating();
assert(api.isFloating(), "System administrator could not reopen floating display before role downgrade");
windowObject.userProfile = { role: "company_admin" };
notifyObservers();
assert(!api.isFloating() && floatingWindows.at(-1).closed, "Role downgrade did not close the floating concierge window");
assert(root.hidden, "Concierge remained visible after leaving the system-admin role");
assert(panel.hidden, "Concierge settings remained open after leaving the system-admin role");
assert(!liveInfiniteAnimations().length, "Role downgrade left concierge animation running");
const downgradedSettings = api.getSettings();
api.setCharacter(downgradedSettings.character === "suzuto" ? "rinna" : "suzuto");
api.setMode("fixed");
api.openSettings();
assert(JSON.stringify(api.getSettings()) === JSON.stringify(downgradedSettings), "Role downgrade did not disable concierge controls");
assert(panel.hidden, "Role downgrade did not keep concierge settings hidden");

windowObject.userProfile = { role: "system_admin" };
notifyObservers();
assert(!root.hidden, "Concierge did not return after restoring the system-admin role");

activeScreen.id = "screen-login";
notifyObservers();
assert(root.hidden, "Concierge must be hidden on the login screen");

console.log("Concierge runtime behavior verification passed (system-admin gate, always-on-top floating display, zero-cost disclosure, pointer-captured drag and viewport clamping, 5 movement modes, move-stop cycle, 6 distinct one-shot stop gestures, one sprite, user-scoped preferences, i18n, gaze, card avoidance, scroll-stable viewport revalidation, reduced motion, focus, and inactive cancellation).");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
