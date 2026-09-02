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
  }
  get className() { return this.classList.toString(); }
  set className(value) { this.classList.set(value); }
  appendChild(child) {
    child.parentElement = this;
    child.setConnected(this.isConnected);
    this.children.push(child);
    return child;
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
    const mobile = windowObject.innerWidth <= 700;
    const width = this.classList.contains("dcats-concierge-mover") ? (mobile ? 88 : 118) : 120;
    const height = this.classList.contains("dcats-concierge-mover") ? (mobile ? 96 : 128) : 44;
    const left = this.transformPoint ? this.transformPoint.x : 20;
    const top = this.transformPoint ? this.transformPoint.y : 80;
    return { left, top, right: left + width, bottom: top + height, width, height };
  }
  getClientRects() { return isRendered(this) ? [this.getBoundingClientRect()] : []; }
  animate(keyframes, options) { return new FakeAnimation(this, keyframes, options); }
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
documentObject.body = new FakeElement("body", documentObject);
documentObject.body.setConnected(true);
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
const windowObject = {
  innerWidth: 1200,
  innerHeight: 800,
  location: { search: "" },
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
  }
};

const context = {
  window: windowObject,
  document: documentObject,
  localStorage: {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, String(value)); }
  },
  MutationObserver: FakeMutationObserver,
  URLSearchParams,
  Promise,
  Math,
  Date,
  Number,
  Object,
  JSON,
  String,
  Infinity,
  setTimeout(callback) { timerId += 1; pendingTimers.set(timerId, callback); return timerId; },
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

const api = windowObject.DcatsConcierge;
assert(api, "Runtime did not expose window.DcatsConcierge");
assert(byClass("dcats-concierge-sprite").length === 1, "Runtime must create exactly one sprite element");
const root = byClass("dcats-concierge")[0];
const mover = byClass("dcats-concierge-mover")[0];
const sprite = byClass("dcats-concierge-sprite")[0];
const launcher = byClass("dcats-concierge-launcher")[0];
const panel = byClass("dcats-concierge-panel")[0];
const panelClose = byClass("dcats-concierge-panel-close")[0];

assert(root.hidden, "Concierge must be hidden before a system-admin profile is available");
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
documentObject.documentElement.lang = "zh-CN";
notifyObservers();
assert(allElements().some((element) => element.textContent === "礼宾助手设置"), "Chinese settings copy did not update");

documentObject.hidden = false;
api.setMode("active");
dispatch(documentObject.listeners, "visibilitychange");
assert(animations.some((animation) => animation.owner === mover && Number(animation.options.duration) >= 1250), "Active mode did not start walking");
assert(liveInfiniteAnimations().some((animation) => animation.owner === sprite), "Active mode did not animate the selected sprite");

dispatch(documentObject.listeners, "pointermove", { clientX: 0, clientY: 0 });
flushAnimationFrames();
const gazeAnimation = lastAnimationFor(sprite);
assert(gazeAnimation && gazeAnimation.options.duration === 1, "Pointer gaze did not select a static directional frame");
assert(gazeAnimation.keyframes.some((frame) => String(frame.backgroundPosition || "").endsWith("% 90%") || String(frame.backgroundPosition || "").endsWith("% 100%")), "Pointer gaze did not use one of the 16 gaze directions");

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
windowObject.userProfile = { role: "company_admin" };
notifyObservers();
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

console.log("Concierge runtime behavior verification passed (system-admin gate, one sprite, user-scoped preferences, i18n, active motion, gaze, card avoidance, viewport revalidation, reduced motion, focus, and inactive cancellation).");
