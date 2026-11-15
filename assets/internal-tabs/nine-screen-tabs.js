/* Nine existing screens share their original Auth, permissions and server APIs. */
(function (root) {
  "use strict";
  var FEATURES = Object.freeze(["concierge-admin", "customer-access-mgmt", "finished-label-mgmt", "finished-product-shipping", "logs", "rakuten-price", "rakuten-price-list", "shipping-rate-mgmt", "users"]);
  var LABELS = {
    ja: ["コンシェルジュ管理", "得意先管理", "完成品ラベル", "完成品出荷", "操作ログ", "ECモール価格調査", "ECモール価格調査結果", "送料管理", "ユーザー管理"],
    en: ["Concierge", "Customers", "Product labels", "Product shipping", "Operation logs", "Price research", "Price results", "Shipping rates", "Users"],
    zh: ["礼宾管理", "客户管理", "成品标签", "成品发货", "操作日志", "价格调查", "价格结果", "运费管理", "用户管理"]
  };
  var context = null, verifiedId = null, verifiedScope = null, epoch = 0, tabs = [], active = null, loaded = new Set(), navigating = false;
  var bar, list, notice, toggle, enabled = false;
  function language() { return LABELS[root.currentLang] ? root.currentLang : "ja"; }
  function text(ja, en, zh) { return language() === "ja" ? ja : language() === "zh" ? zh : en; }
  function policy() { return root.DcatsNineTabsPolicy || {mode: "off", pilotEmails: []}; }
  function ownerKey() { return "dcats-nine-tabs.v1:" + verifiedId; }
  function preferenceKey() { return ownerKey() + ":enabled"; }
  function current() { return !!context && !!verifiedId && context.userId() === verifiedId && context.scope() === verifiedScope; }
  function pilot() { return current() && policy().mode === "pilot" && Array.isArray(policy().pilotUserIds) && policy().pilotUserIds.includes(verifiedId) && Array.isArray(policy().pilotEmails) && policy().pilotEmails.includes(context.email); }
  function allowed(id) { return current() && FEATURES.includes(id) && context.canAccess(id) === true; }
  function available() { return current() && (policy().mode === "all" || pilot()); }
  function storageGet(key) { try { return root.sessionStorage.getItem(key); } catch (_) { return null; } }
  function storageSet(key, value) { try { root.sessionStorage.setItem(key, value); } catch (_) { announce(text("タブを保存できません。再読込後の復元は利用できません。", "Tabs cannot be saved for reload.", "无法保存标签以供重新加载。")); } }
  function save() { if (current()) storageSet(ownerKey(), JSON.stringify({version: 1, tabs: tabs.slice(), active: active})); }
  function announce(message) { if (notice) notice.textContent = message; }
  function mount() {
    if (bar) return;
    bar = root.document.createElement("section"); bar.id = "dcats-nine-tabs"; bar.className = "dcats-nine-tabs"; bar.hidden = true;
    list = root.document.createElement("div"); list.className = "dcats-nine-tabs-list"; list.setAttribute("role", "tablist");
    notice = root.document.createElement("p"); notice.className = "dcats-nine-tabs-notice"; notice.setAttribute("role", "status"); notice.setAttribute("aria-live", "polite");
    bar.append(list, notice); root.document.body.insertBefore(bar, root.document.body.firstChild);
    var menu = root.document.getElementById("screen-menu");
    if (menu) {
      toggle = root.document.createElement("button"); toggle.type = "button"; toggle.id = "dcats-nine-tabs-toggle"; toggle.className = "btn-secondary dcats-nine-tabs-toggle"; toggle.hidden = true;
      toggle.addEventListener("click", function () { setEnabled(!enabled); });
      (menu.querySelector(".screen-body") || menu).appendChild(toggle);
    }
    list.addEventListener("keydown", function (event) {
      var buttons = Array.from(list.querySelectorAll('[role="tab"]')), at = buttons.indexOf(event.target);
      if (at < 0) return;
      var next = event.key === "ArrowRight" ? (at + 1) % buttons.length : event.key === "ArrowLeft" ? (at + buttons.length - 1) % buttons.length : event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : -1;
      if (next >= 0) { event.preventDefault(); buttons[next].focus(); }
      if (event.key === "Delete") { event.preventDefault(); close(event.target.dataset.feature); }
    });
  }
  function render() {
    if (!bar) return;
    var screen = context && context.screen();
    bar.hidden = !enabled || !current() || !(screen === "menu" || FEATURES.includes(screen));
    var destination = screen && root.document.getElementById("screen-" + screen);
    if (!bar.hidden && destination && bar.parentNode !== destination) destination.insertBefore(bar, destination.firstChild);
    root.document.body.classList.toggle("dcats-nine-tabs-visible", !bar.hidden);
    list.replaceChildren(); list.setAttribute("aria-label", text("画面タブ（最大6）", "Screen tabs (maximum 6)", "屏幕标签（最多6个）"));
    tabs.forEach(function (id) {
      var group = root.document.createElement("div"); group.className = "dcats-nine-tab";
      var button = root.document.createElement("button"); button.type = "button"; button.dataset.feature = id; button.id = "dcats-nine-tab-" + id;
      button.setAttribute("role", "tab"); button.setAttribute("aria-selected", String(active === id)); button.setAttribute("aria-controls", "screen-" + id); button.tabIndex = active === id || !active && tabs[0] === id ? 0 : -1;
      button.textContent = LABELS[language()][FEATURES.indexOf(id)]; button.addEventListener("click", function () { activate(id); });
      var remove = root.document.createElement("button"); remove.type = "button"; remove.className = "dcats-nine-tab-close"; remove.dataset.closeFeature = id; remove.textContent = "×";
      remove.setAttribute("aria-label", button.textContent + text("を閉じる", ": close", "：关闭")); remove.addEventListener("click", function () { close(id); });
      group.append(button, remove); list.appendChild(group);
    });
    if (toggle) { toggle.hidden = !available(); toggle.setAttribute("aria-pressed", String(enabled)); toggle.textContent = text("画面タブ（試験）: ", "Screen tabs (pilot): ", "屏幕标签（试用）：") + (enabled ? "ON" : "OFF"); }
  }
  function setEnabled(value) {
    if (!available()) return false;
    enabled = value === true;
    storageSet(preferenceKey(), enabled ? "on" : "off");
    if (enabled) restore();
    else { tabs = []; active = null; loaded.clear(); save(); }
    announce(""); render(); return enabled;
  }
  function restore() {
    var saved;
    try { saved = JSON.parse(storageGet(ownerKey()) || "null"); } catch (_) { saved = null; }
    tabs = saved && saved.version === 1 && Array.isArray(saved.tabs) ? Array.from(new Set(saved.tabs.filter(allowed))).slice(0, 6) : [];
    active = saved && tabs.includes(saved.active) ? saved.active : tabs[0] || null;
    save(); render();
    if (active && context.screen() === "menu") activate(active);
  }
  function denied(id) {
    tabs = tabs.filter(function (item) { return item !== id; }); loaded.delete(id);
    if (active === id) active = null;
    if (context && context.screen() === id) context.show("menu");
    save(); render(); announce(text("この画面の閲覧権限を確認できません。", "Access to this screen is unavailable.", "无法确认此屏幕的访问权限。"));
  }
  function activate(id) {
    if (!enabled || !available() || !tabs.includes(id)) return false;
    if (!allowed(id)) { denied(id); return false; }
    active = id; announce(""); save();
    if (loaded.has(id) && id !== "concierge-admin") { context.show(id); render(); return true; }
    navigating = true;
    try {
      Promise.resolve(context.enter(id)).catch(function () { announce(text("画面を開けませんでした。タブから再度開けます。", "Unable to open this screen. Select its tab to retry.", "无法打开屏幕，请再次选择标签。")); }).finally(function () { render(); });
    } catch (_) { announce(text("画面を開けませんでした。", "Unable to open this screen.", "无法打开屏幕。")); }
    finally { navigating = false; }
    return true;
  }
  function beforeEnter(id, hasContext) {
    if (enabled && !current()) suspend(false);
    if (!enabled || !available() || !FEATURES.includes(id)) return false;
    if (!allowed(id)) { denied(id); return true; }
    if (!tabs.includes(id) && tabs.length >= 6) { announce(text("画面タブは6つまでです。1つ閉じてから開いてください。", "Maximum 6 tabs. Close one before opening another.", "最多6个标签，请先关闭一个。")); return true; }
    if (!navigating && tabs.includes(id) && !hasContext) { activate(id); return true; }
    return false;
  }
  function screenChanged(id) {
    if (["login", "boot", "reset"].includes(id)) { suspend(false); return; }
    if (!enabled || !available()) { render(); return; }
    tabs = tabs.filter(allowed);
    if (FEATURES.includes(id) && allowed(id)) {
      if (!tabs.includes(id) && tabs.length < 6) tabs.push(id);
      if (tabs.includes(id)) { active = id; loaded.add(id); }
    }
    save(); render();
  }
  function close(id) {
    if (!current() || !tabs.includes(id)) return false;
    var wasActive = context.screen() === id, index = tabs.indexOf(id);
    tabs.splice(index, 1); loaded.delete(id); if (active === id) active = tabs[Math.min(index, tabs.length - 1)] || null;
    save();
    if (wasActive) { if (active) activate(active); else context.show("menu"); }
    render(); var focus = list.querySelector('[role="tab"][aria-selected="true"]'); if (focus) focus.focus();
    return true;
  }
  function suspend(forget) {
    if (forget && verifiedId) { try { root.sessionStorage.removeItem(ownerKey()); root.sessionStorage.removeItem(preferenceKey()); } catch (_) {} }
    epoch += 1; enabled = false; context = null; verifiedId = null; verifiedScope = null; tabs = []; active = null; loaded.clear(); render();
  }
  async function afterAuthenticated(options) {
    var wasCurrent = current();
    var ticket = ++epoch, expected = options.userId(), expectedScope = options.scope();
    if (!expected || options.external) { suspend(false); return; }
    var response;
    try { response = await options.verify(); } catch (_) { if (ticket === epoch) suspend(false); return; }
    if (ticket !== epoch || options.userId() !== expected || options.scope() !== expectedScope) return;
    var user = response && !response.error && response.data && response.data.user;
    if (!user || user.id !== expected || !user.email_confirmed_at) { suspend(false); return; }
    context = options; context.email = String(user.email || "").toLowerCase(); verifiedId = user.id; verifiedScope = expectedScope;
    mount();
    enabled = available() && storageGet(preferenceKey()) === "on";
    // Returning to the menu for the same verified scope must not reopen its last tab.
    if (wasCurrent) { render(); return; }
    tabs = []; loaded.clear(); active = null;
    if (enabled) restore(); else render();
  }
  root.DcatsNineTabs = Object.freeze({features: FEATURES, retainedLimit: 6, afterAuthenticated: afterAuthenticated, beforeEnter: beforeEnter, screenChanged: screenChanged, suspend: suspend,
    authEvent: function (event) { if (["SIGNED_OUT", "USER_UPDATED", "PASSWORD_RECOVERY"].includes(event)) suspend(event === "SIGNED_OUT"); },
    hasTab: function (id) { return enabled && current() && tabs.includes(id); },
    snapshot: function () { return {enabled: enabled && current(), tabs: tabs.slice(), active: active, retainedLimit: 6}; }});
})(window);
