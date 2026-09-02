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
  constructor(options) {
    this.options = options || {};
    this.playState = this.options.iterations === Infinity ? "running" : "finished";
    this.canceled = false;
    this.finished = Promise.resolve();
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
    return [];
  }
  getBoundingClientRect() {
    if (!isRendered(this)) return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
    const mobile = windowObject.innerWidth <= 700;
    const width = this.classList.contains("dcats-concierge-mover") ? (mobile ? 88 : 118) : 120;
    const height = this.classList.contains("dcats-concierge-mover") ? (mobile ? 96 : 128) : 44;
    return { left: 20, top: 80, right: 20 + width, bottom: 80 + height, width, height };
  }
  getClientRects() { return isRendered(this) ? [this.getBoundingClientRect()] : []; }
  animate(keyframes, options) { return new FakeAnimation(options); }
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
const windowObject = {
  innerWidth: 1200,
  innerHeight: 800,
  location: { search: "" },
  currentUser: { id: "user-a" },
  matchMedia() { return { matches: false, addEventListener() {}, addListener() {} }; },
  addEventListener() {},
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

const api = windowObject.DcatsConcierge;
assert(api, "Runtime did not expose window.DcatsConcierge");
assert(byClass("dcats-concierge-sprite").length === 1, "Runtime must create exactly one sprite element");
assert(api.getSettings().character === "suzuto" && api.getSettings().mode === "active", "User A defaults are invalid");

api.setCharacter("rinna");
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

api.setMode("off");
assert(byClass("dcats-concierge")[0].classList.contains("is-off"), "Off mode did not hide the mover");
assert(!animations.some((animation) => animation.options.iterations === Infinity && !animation.canceled), "Off mode left an infinite animation running");

activeScreen.id = "screen-login";
notifyObservers();
assert(byClass("dcats-concierge")[0].hidden, "Concierge must be hidden on the login screen");

console.log("Concierge runtime behavior verification passed (one sprite, user-scoped preferences, multilingual copy, inactive animation cancellation).");
