"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const root = path.resolve(__dirname, ".."), read = name => fs.readFileSync(path.join(root, name), "utf8");
const source = read("assets/concierge-pet/concierge-admin.js"), html = read("index.html"), app = read("app.js");
new vm.Script(source);
assert(!/innerHTML|localStorage|sessionStorage|\.from\(|fetch\(|api\.openai|service_role|OPENAI_API_KEY/.test(source));
assert(html.includes('id="screen-concierge-admin"') && html.includes('id="concierge-admin-host"'));
assert(app.includes('action: "concierge-admin", available: isSystemAdmin()'));
assert(app.includes('if (id !== "concierge-admin") closeConciergeAdmin()'));
assert(app.includes('body.submission_id = window.crypto.randomUUID()'));
assert(read("assets/concierge-pet/concierge-pet.js").includes('messageId: data.message_id'));
assert(read("assets/concierge-pet/concierge-requests.js").includes('draftId = draft.messageId || uuid()'));
const dictionary = {};
vm.runInNewContext(source.slice(source.indexOf("var COPY ="), source.indexOf("function mount(")), dictionary);
for (const lang of ["en", "zh"]) assert.deepEqual(Object.keys(dictionary.COPY[lang]).sort(), Object.keys(dictionary.COPY.ja).sort());
class Element {
  constructor(tag, doc) { this.tagName = tag.toUpperCase(); this.ownerDocument = doc; this.children = []; this.attrs = {}; this.events = {}; this.value = ""; this.ownText = ""; this.classList = { add() {} }; }
  set textContent(value) { this.ownText = String(value); this.children = []; }
  get textContent() { return this.ownText + this.children.map(x => x.textContent).join(""); }
  appendChild(n) { this.children.push(n); return n; }
  replaceChildren(...nodes) { this.ownText = ""; this.children = nodes; }
  setAttribute(k, v) { this.attrs[k] = v; }
  addEventListener(k, v) { this.events[k] = v; }
  focus() {} select() {}
  all() { return this.children.flatMap(n => [n, ...n.all()]); }
  async click() { if (!this.disabled && this.events.click) await this.events.click(); }
}
const id = "20000000-0000-4000-8000-000000000001", image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/ZfoAAAAASUVORK5CYII=";
async function settle() { for (let i = 0; i < 25; i++) await Promise.resolve(); }
async function run(language) {
  const doc = { createElement: tag => new Element(tag, doc) }, host = doc.createElement("div"), calls = [], copies = [];
  const state = { id: "admin", admin: true, language }, word = dictionary.COPY[language];
  const row = { id, request_no: 4, title: "QA <script>alert(1)</script>", description: "検索できない", screen_id: "search", status: "new", version: 1, created_at: "2026-10-16T00:00:00Z", has_attachment: true };
  const log = { ...row, log_no: 5, question: row.description, state: "completed", kind: "bug", reporter_name: "QA ADMIN", has_image: true, response: { answer: "QA ANSWER" }, request_id: id };
  let deferred = null, failUpdate = true, version = 1;
  const window = { crypto: require("node:crypto").webcrypto, navigator: { clipboard: { writeText: async text => copies.push(text) } } };
  vm.runInNewContext(source, { window, Date, Object, Number, String, Error });
  function result(data) { return { data: { ok: true, ...data } }; }
  const send = async command => {
    calls.push(JSON.parse(JSON.stringify(command)));
    if (deferred) return new Promise(resolve => { deferred.resolve = resolve; });
    if (command.action === "list") return result({ items: [row] });
    if (command.action === "update") { if (failUpdate) { failUpdate = false; return { error: new Error("request_failed") }; } version++; return result({ request: { ...row, version } }); }
    if (command.action === "image") return result({ url: "https://jqoeqximtwfpqwzngutj.supabase.co/storage/v1/object/sign/concierge-request-images/qa.png?token=synthetic" });
    assert.equal(command.action, "admin");
    if (command.operation === "summary") return result({ request_new: 1, request_unread: 2, message_unread: 3 });
    if (command.operation === "messages") return result({ items: [{ ...log, unread: true }] });
    if (command.operation === "message") return result({ message: log });
    if (command.operation === "request") return result({ request: { ...row, version }, reporter_name: "QA ADMIN", events: [] });
    if (command.operation === "image") return result({ image });
    if (command.operation === "handoff") return result({ package_text: "D-CATS コンシェルジュ・3Dキャラ開発\nQA ORIGINAL", sent: false });
    throw new Error("unexpected command");
  };
  const controller = window.DcatsConciergeAdmin.mount(host, { context: () => state, send }); await settle();
  const button = text => host.all().find(n => n.tagName === "BUTTON" && n.textContent === text);
  const item = () => host.all().find(n => n.tagName === "BUTTON" && n.textContent.includes("#"));
  assert(host.textContent.includes("2") && host.textContent.includes("3")); assert.equal(copies.length, 0);
  await item().click(); await settle(); assert(host.textContent.includes("QA ADMIN"));
  await button(word.image).click(); assert(host.all().some(n => n.tagName === "IMG" && n.src.includes("storage/v1/object/sign/concierge-request-images")));
  const note = host.all().find(n => n.tagName === "TEXTAREA" && !n.readOnly); note.value = "QA NOTE";
  await button(word.save).click(); assert(host.textContent.includes(word.failure));
  await button(word.save).click(); await settle();
  const updates = calls.filter(c => c.action === "update"); assert.equal(updates.length, 2); assert.deepEqual(updates[0], updates[1]);
  await button(word.handoff).click(); assert(host.textContent.includes(word.prepared)); assert.equal(copies.length, 0);
  await button(word.copy).click(); assert.equal(copies.length, 1); assert(host.textContent.includes(word.copied));
  await button(word.messages).click(); await settle(); await item().click(); await settle(); assert(host.textContent.includes("QA ANSWER"));
  assert.equal(calls.filter(c => c.operation === "image").length, 0); await button(word.image).click(); assert.equal(calls.filter(c => c.operation === "image").length, 1);
  assert(host.all().some(n => n.tagName === "IMG" && n.src === "data:image/png;base64," + image));
  deferred = {}; const opening = item().click(); await settle(); state.id = "other-admin"; deferred.resolve(result({ message: log })); await opening; await settle(); assert.equal(host.children.length, 0);
  const before = calls.length; assert.equal(window.DcatsConciergeAdmin.mount(host, { context: () => ({ id: "staff", admin: false }), send }), null); assert.equal(calls.length, before);
  controller.destroy(); assert.equal(host.children.length, 0);
}
(async () => { for (const language of ["ja", "en", "zh"]) await run(language); console.log("Concierge admin: server-only API, role/session expiry, text safety, logs/images, request updates/replay, explicit unsent handoff and 3 languages passed."); })().catch(e => { console.error(e); process.exitCode = 1; });
