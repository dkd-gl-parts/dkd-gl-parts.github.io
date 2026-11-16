/* Dynamic menu-screen tabs. Metadata only; business inputs stay in native screen memory. */
(function (root) {
  "use strict";
  var LIMIT = 9;
  var context = null, verifiedId = null, verifiedScope = null, epoch = 0;
  var tabs = [], active = null, loaded = new Set(), states = new Map(), edits = new Map(), prepared = null, navigating = false;
  var bar, list, notice, toggle, hint, enabled = false;
  function text(ja, en, zh) { return root.currentLang === "zh" ? zh : root.currentLang === "en" ? en : ja; }
  function policy() { return root.DcatsNineTabsPolicy || {mode: "off"}; }
  function ownerKey() { return "dcats-nine-tabs.v1:" + verifiedId; }
  function preferenceKey() { return ownerKey() + ":enabled"; }
  function current() { return !!context && !!verifiedId && context.userId() === verifiedId && context.scope() === verifiedScope; }
  function available() { return current() && (policy().mode === "all" || policy().mode === "pilot" && Array.isArray(policy().pilotUserIds) && policy().pilotUserIds.includes(verifiedId) && Array.isArray(policy().pilotEmails) && policy().pilotEmails.includes(context.email)); }
  function entries() { return context && context.entries ? context.entries() : []; }
  function features() { return entries().map(function (entry) { return entry.id; }); }
  function eligible(id) { return features().includes(id); }
  function allowed(id) { return current() && eligible(id) && context.canAccess(id) === true; }
  function label(id) { var entry = entries().find(function (item) { return item.id === id; }); return entry ? entry.label : text("画面", "Screen", "屏幕"); }
  function storageGet(key) { try { return root.sessionStorage.getItem(key); } catch (_) { return null; } }
  function storageSet(key, value) { try { root.sessionStorage.setItem(key, value); } catch (_) { announce(text("タブを保存できません。再読込後の復元は利用できません。", "Tabs cannot be saved for reload.", "无法保存标签以供重新加载。")); } }
  function save() { if (current()) storageSet(ownerKey(), JSON.stringify({version: 2, tabs: tabs.slice(), active: active})); }
  function announce(message) { if (notice) notice.textContent = message; }
  function capture() { if (current() && context.screen() !== "menu" && active && loaded.has(active) && context.capture) states.set(active, context.capture()); }
  function restoreContext(id) { if (context.restore && states.has(id)) context.restore(states.get(id)); }
  function closeState(id) { try { return context.closeState ? context.closeState(id) || {} : {}; } catch (_) { return {busy: true}; } }
  function signature(node) {
    if (node.type === "password") return node.value ? "present" : "";
    if (node.type === "file") return Array.from(node.files || []).map(function (f) { return [f.name, f.size, f.lastModified].join(":"); }).join("|");
    if (node.type === "checkbox" || node.type === "radio") return String(node.checked);
    return node.isContentEditable ? node.textContent : node.value;
  }
  function editable(node) { return node && (node.matches("input:not([type=hidden]):not([type=button]):not([type=submit]):not([type=reset]),textarea,select") || node.isContentEditable) && !node.disabled && !node.readOnly; }
  function rememberInput(event) {
    if (!enabled || !available() || !active || !tabs.includes(active) || context.screen() === "menu" || !editable(event.target)) return;
    var node = event.target, records = edits.get(active);
    if (!records) { records = new Map(); edits.set(active, records); }
    if (!records.has(node)) records.set(node, {initial: signature(node), touched: false, changed: false, password: node.type === "password"});
    if ((event.type === "beforeinput" || event.type === "focusin") && !records.get(node).touched) records.get(node).initial = signature(node);
    if (event.type === "input" || event.type === "change") {
      var record = records.get(node); record.touched = true;
      record.changed = record.password ? !!node.value : signature(node) !== record.initial;
    }
  }
  function dirty(id) {
    if (closeState(id).dirty) return true;
    var records = edits.get(id), changed = false;
    if (records) records.forEach(function (record, node) {
      if (!node.isConnected) { if (record.changed) changed = true; }
      else if (record.password ? record.changed && !!node.value : record.touched && signature(node) !== record.initial) changed = true;
    });
    return changed;
  }
  function mayClose(ids) {
    if (ids.some(function (id) { return closeState(id).busy; })) {
      announce(text("処理中、または保存結果の確認待ちです。確認が終わってから閉じてください。", "An operation is running or its save result is unresolved. Wait before closing.", "正在处理或保存结果尚未确认，请稍后关闭。"));
      return false;
    }
    var changed = ids.filter(dirty);
    if (!changed.length) return true;
    var name = changed.length === 1 ? label(changed[0]) : text("複数の画面", "Several screens", "多个屏幕");
    return root.confirm(text("「" + name + "」には入力内容の変更があります。未保存の内容は失われます。閉じてもよろしいですか？", '"' + name + '" has input changes. Unsaved changes will be lost. Close it?', "“" + name + "”有输入更改。未保存内容将丢失。是否关闭？"));
  }
  function forget(id) {
    tabs = tabs.filter(function (item) { return item !== id; }); loaded.delete(id); states.delete(id);
    var records = edits.get(id); edits.delete(id);
    // Reset only controls owned by the discarded screen, never persist their values.
    if (records && context.resetControl) records.forEach(function (_, node) { if (node.isConnected) context.resetControl(node); });
    if (context.release) context.release(id);
  }
  function mount() {
    if (bar) return;
    bar = root.document.createElement("section"); bar.id = "dcats-nine-tabs"; bar.className = "dcats-nine-tabs"; bar.hidden = true;
    list = root.document.createElement("div"); list.className = "dcats-nine-tabs-list"; list.setAttribute("role", "tablist");
    notice = root.document.createElement("p"); notice.className = "dcats-nine-tabs-notice"; notice.setAttribute("role", "status"); notice.setAttribute("aria-live", "polite");
    hint = root.document.createElement("p"); hint.className = "dcats-nine-tabs-hint";
    var strip = root.document.createElement("div"); strip.className = "dcats-nine-tabs-strip"; strip.append(list);
    bar.append(strip, hint, notice); root.document.body.insertBefore(bar, root.document.body.firstChild);
    var menu = root.document.getElementById("screen-menu");
    if (menu) {
      toggle = root.document.createElement("button"); toggle.type = "button"; toggle.id = "dcats-nine-tabs-toggle"; toggle.className = "btn-secondary dcats-nine-tabs-toggle"; toggle.hidden = true;
      toggle.addEventListener("click", function () { setEnabled(!enabled); });
      var menuBody = menu.querySelector(".menu-body") || menu, welcome = menuBody.querySelector(".menu-welcome");
      if (welcome) welcome.after(toggle); else menuBody.prepend(toggle);
    }
    ["focusin", "beforeinput", "input", "change"].forEach(function (event) { root.document.addEventListener(event, rememberInput, true); });
    root.addEventListener("beforeunload", function (event) { if (enabled && current() && tabs.some(dirty)) { event.preventDefault(); event.returnValue = ""; } });
    root.addEventListener("resize", revealSelected);
    list.addEventListener("keydown", function (event) {
      var buttons = Array.from(list.querySelectorAll('[role="tab"]')), at = buttons.indexOf(event.target);
      if (at < 0) return;
      var next = event.key === "ArrowRight" ? (at + 1) % buttons.length : event.key === "ArrowLeft" ? (at + buttons.length - 1) % buttons.length : event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : -1;
      if (next >= 0) { event.preventDefault(); buttons[next].focus(); }
      if (event.key === "Delete") { event.preventDefault(); close(event.target.dataset.feature); }
    });
  }
  function revealSelected() {
    if (!list || !bar || bar.hidden) return;
    var selectedTab = list.querySelector(".is-active");
    if (selectedTab) {
      var rect = selectedTab.getBoundingClientRect(), listRect = list.getBoundingClientRect();
      if (rect.left < listRect.left) list.scrollLeft -= listRect.left - rect.left;
      else if (rect.right > listRect.right) list.scrollLeft += rect.right - listRect.right;
    }
  }
  function render() {
    if (!bar) return;
    var screen = context && context.screen();
    bar.hidden = !enabled || !current() || !screen || ["login", "boot", "reset", "forgot"].includes(screen);
    var destination = screen && root.document.getElementById("screen-" + screen);
    if (!bar.hidden && destination && bar.parentNode !== destination) destination.insertBefore(bar, destination.firstChild);
    root.document.body.classList.toggle("dcats-nine-tabs-visible", !bar.hidden);
    hint.hidden = tabs.length > 0;
    hint.textContent = text("メニューから開いた順に9つまで残ります。10個目を開くと、一番古いタブを閉じます。", "Keep up to 9 screens in opening order. Opening a tenth closes the oldest tab.", "按打开顺序保留最多9个屏幕。打开第10个时关闭最早的标签。");
    list.replaceChildren(); list.setAttribute("aria-label", text("画面タブ（最大9）", "Screen tabs (maximum 9)", "屏幕标签（最多9个）"));
    tabs.forEach(function (id) {
      var selected = screen !== "menu" && active === id, group = root.document.createElement("div"); group.className = "dcats-nine-tab"; group.classList.toggle("is-active", selected);
      var button = root.document.createElement("button"); button.type = "button"; button.dataset.feature = id; button.id = "dcats-nine-tab-" + id;
      button.setAttribute("role", "tab"); button.setAttribute("aria-selected", String(selected)); button.setAttribute("aria-controls", "screen-" + id); button.tabIndex = active === id || !active && tabs[0] === id ? 0 : -1;
      button.textContent = label(id); button.title = button.textContent; button.addEventListener("click", function () { activate(id); });
      var remove = root.document.createElement("button"); remove.type = "button"; remove.className = "dcats-nine-tab-close"; remove.dataset.closeFeature = id; remove.textContent = "×";
      remove.setAttribute("aria-label", button.textContent + text("を閉じる", ": close", "：关闭")); remove.addEventListener("click", function () { close(id); });
      group.append(button, remove); list.appendChild(group);
    });
    revealSelected();
    if (toggle) { toggle.hidden = !available(); toggle.setAttribute("aria-pressed", String(enabled)); toggle.textContent = text("画面タブ（試験）: ", "Screen tabs (pilot): ", "屏幕标签（试用）：") + (enabled ? "ON" : "OFF"); }
  }
  function setEnabled(value) {
    if (!available()) return false;
    if (!value && !mayClose(tabs)) return enabled;
    enabled = value === true;
    storageSet(preferenceKey(), enabled ? "on" : "off");
    if (enabled) restore();
    else { tabs.slice().forEach(forget); active = null; prepared = null; save(); }
    announce(""); render(); return enabled;
  }
  function restore() {
    var saved;
    try { saved = JSON.parse(storageGet(ownerKey()) || "null"); } catch (_) { saved = null; }
    tabs = saved && [1, 2].includes(saved.version) && Array.isArray(saved.tabs) ? Array.from(new Set(saved.tabs.filter(allowed))).slice(-LIMIT) : [];
    active = saved && tabs.includes(saved.active) ? saved.active : tabs[0] || null;
    save(); render();
    if (active && context.screen() === "menu") activate(active);
  }
  function denied(id) {
    // Authorization changes take precedence over keeping a draft.
    if (tabs.includes(id)) forget(id); if (active === id) active = null;
    if (context && context.screen() === id) context.show("menu");
    save(); render(); announce(text("この画面の閲覧権限を確認できません。", "Access to this screen is unavailable.", "无法确认此屏幕的访问权限。"));
  }
  function activate(id) {
    if (!enabled || !available() || !tabs.includes(id)) return false;
    capture();
    var previous = context.capture && context.capture();
    restoreContext(id);
    if (!allowed(id)) { if (previous && context.restore) context.restore(previous); denied(id); return false; }
    announce("");
    if (loaded.has(id)) { if (context.resume) context.resume(id); context.show(id); render(); return context.screen() === id; }
    navigating = true;
    try {
      Promise.resolve(context.enter(id)).catch(function () { announce(text("画面を開けませんでした。タブから再度開けます。", "Unable to open this screen. Select its tab to retry.", "无法打开屏幕，请再次选择标签。")); }).finally(render);
    } catch (_) { announce(text("画面を開けませんでした。", "Unable to open this screen.", "无法打开屏幕。")); }
    finally { navigating = false; }
    return context.screen() === id;
  }
  function prepare(id, hasContext, allowReuse) {
    if (!allowed(id)) { denied(id); return false; }
    if (prepared && prepared.target === id) return true;
    if (allowReuse) capture();
    if (allowReuse && !navigating && tabs.includes(id) && !hasContext) { activate(id); return false; }
    if (tabs.includes(id) && hasContext && !mayClose([id])) return false;
    var victim = !tabs.includes(id) && tabs.length >= LIMIT ? tabs[0] : null;
    if (victim && !mayClose([victim])) return false;
    prepared = {target: id, victim: victim, reset: tabs.includes(id) && !!hasContext};
    var decision = prepared;
    Promise.resolve().then(function () { if (prepared === decision) prepared = null; });
    return true;
  }
  function beforeEnter(id, hasContext) {
    if (enabled && !current()) suspend(false);
    if (!enabled || !available() || !eligible(id)) return false;
    return !prepare(id, hasContext, true);
  }
  function beforeShow(id) {
    if (!enabled || !available() || !eligible(id)) return true;
    return prepare(id, false, false);
  }
  function screenChanged(id) {
    if (["login", "boot", "reset", "forgot"].includes(id)) { suspend(false); return; }
    if (!enabled || !available()) { render(); return; }
    if (eligible(id) && allowed(id)) {
      if (prepared && prepared.target === id && prepared.reset) { edits.delete(id); states.delete(id); }
      if (!tabs.includes(id)) {
        var victim = prepared && prepared.target === id ? prepared.victim : null;
        var targetState = context.capture && context.capture();
        if (victim) forget(victim);
        if (targetState && context.restore) context.restore(targetState);
        if (tabs.length < LIMIT) tabs.push(id);
      }
      if (tabs.includes(id)) { active = id; loaded.add(id); }
    }
    prepared = null; save(); render();
  }
  function close(id) {
    if (!current() || !tabs.includes(id) || !mayClose([id])) return false;
    capture();
    var wasActive = active === id && context.screen() !== "menu", index = tabs.indexOf(id);
    if (wasActive) {
      var next = tabs[index + 1] || tabs[index - 1];
      if (next) activate(next); else context.home();
      if (context.screen() === id) return false;
    }
    var nextState = context.capture && context.capture();
    forget(id); if (nextState && context.restore) context.restore(nextState);
    if (active === id) active = tabs[Math.min(index, tabs.length - 1)] || null;
    prepared = null; save(); render();
    var focus = list.querySelector('[role="tab"][aria-selected="true"]'); if (focus) focus.focus();
    return true;
  }
  function suspend(forgetSaved) {
    if (forgetSaved && verifiedId) { try { root.sessionStorage.removeItem(ownerKey()); root.sessionStorage.removeItem(preferenceKey()); } catch (_) {} }
    epoch += 1; enabled = false; context = null; verifiedId = null; verifiedScope = null; tabs = []; active = null; loaded.clear(); states.clear(); edits.clear(); prepared = null; render();
  }
  async function afterAuthenticated(options) {
    var wasCurrent = current(), ticket = ++epoch, expected = options.userId(), expectedScope = options.scope();
    if (!expected || options.external) { suspend(false); return; }
    var response;
    try { response = await options.verify(); } catch (_) { if (ticket === epoch) suspend(false); return; }
    if (ticket !== epoch || options.userId() !== expected || options.scope() !== expectedScope) return;
    var user = response && !response.error && response.data && response.data.user;
    if (!user || user.id !== expected || !user.email_confirmed_at) { suspend(false); return; }
    context = options; context.email = String(user.email || "").toLowerCase(); verifiedId = user.id; verifiedScope = expectedScope;
    mount(); enabled = available() && storageGet(preferenceKey()) === "on";
    if (wasCurrent) { render(); return; }
    tabs = []; loaded.clear(); states.clear(); edits.clear(); active = null; prepared = null;
    if (enabled) restore(); else render();
  }
  root.DcatsNineTabs = Object.freeze({
    get features() { return features(); }, retainedLimit: LIMIT, afterAuthenticated: afterAuthenticated, beforeEnter: beforeEnter, beforeShow: beforeShow, screenChanged: screenChanged, suspend: suspend,
    authEvent: function (event) { if (["SIGNED_OUT", "USER_UPDATED", "PASSWORD_RECOVERY"].includes(event)) suspend(event === "SIGNED_OUT"); },
    willLeave: function (id) { if (id === "menu") capture(); },
    hasTab: function (id) { return enabled && current() && tabs.includes(id); },
    hasUnsaved: function () { return enabled && current() && tabs.some(dirty); },
    markClean: function (id) { edits.delete(id); },
    snapshot: function () { return {enabled: enabled && current(), tabs: tabs.slice(), active: active, retainedLimit: LIMIT}; }
  });
})(window);
