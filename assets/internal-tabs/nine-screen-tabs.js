/* Dynamic menu-screen tabs. Metadata only; business inputs stay in native screen memory. */
(function (root) {
  "use strict";
  var LIMIT = 9;
  var context = null, verifiedId = null, verifiedScope = null, epoch = 0;
  var tabs = [], opened = [], active = null, loaded = new Set(), states = new Map(), edits = new Map(), prepared = null, navigating = false;
  var bar, list, notice, toggle, hint, enabled = false, persistedSnapshot = null;

  var PROPERTIES_SCREEN = "screen-tab-properties";
  var properties, propertiesStatus, propertiesApply, pagePrev, pageNext, pageCount, pages = [], pageNumber = 0;
  var drag = null, suppressDragClick = false;
  function propertiesTitle() { return text("画面タブのプロパティ", "Screen tab properties", "屏幕标签属性"); }
  function propertiesHome() {
    if (current() && context.home) context.home();
    else if (root.location && root.location.reload) root.location.reload();
  }
  function element(tag, className, parent, content) {
    var node = root.document.createElement(tag);
    if (className) node.className = className;
    if (content != null) node.textContent = content;
    if (parent) parent.appendChild(node);
    return node;
  }
  function mountProperties() {
    properties = element("section", "screen dcats-ui-screen dcats-tab-properties-screen", root.document.body);
    properties.id = "screen-" + PROPERTIES_SCREEN;
    properties.setAttribute("aria-labelledby", "dcats-tab-properties-title");
    var header = element("div", "page-header", properties), left = element("div", "page-header-left", header);
    var back = element("button", "back-btn", left); back.type = "button"; back.dataset.propertyText = "back";
    back.addEventListener("click", propertiesHome);
    var title = element("h1", "dcats-tab-properties-title", left); title.id = "dcats-tab-properties-title"; title.dataset.propertyText = "title";
    var help = element("a", "feature-help-link", header, "ヘルプ");
    help.setAttribute("data-feature-help", "");
    help.href = "assets/help/features.html?v=1#screen-tab-properties";
    help.target = "_blank";
    help.rel = "noopener noreferrer";
    help.setAttribute("aria-label", "ヘルプ（別ウィンドウ）");
    var body = element("div", "dcats-tab-properties-body", properties);
    var option = element("label", "dcats-tab-properties-option", body);
    toggle = element("input", "", option); toggle.type = "checkbox"; toggle.id = "dcats-nine-tabs-toggle";
    var optionText = element("span", "", option); optionText.dataset.propertyText = "enable";
    var definitions = element("dl", "dcats-tab-properties-definitions", body);
    [["limit", "limitValue"], ["overflow", "overflowValue"], ["unsaved", "unsavedValue"], ["restore", "restoreValue"]].forEach(function (keys) {
      var row = element("div", "", definitions);
      element("dt", "", row).dataset.propertyText = keys[0];
      element("dd", "", row).dataset.propertyText = keys[1];
    });
    element("p", "dcats-tab-properties-note", body).dataset.propertyText = "note";
    propertiesStatus = element("p", "dcats-tab-properties-status", body); propertiesStatus.setAttribute("role", "status"); propertiesStatus.setAttribute("aria-live", "polite");
    var footer = element("div", "dcats-tab-properties-footer", properties);
    var cancel = element("button", "btn-secondary", footer); cancel.type = "button"; cancel.dataset.propertyText = "cancel"; cancel.addEventListener("click", propertiesHome);
    propertiesApply = element("button", "btn-primary", footer); propertiesApply.type = "button"; propertiesApply.id = "dcats-tab-properties-apply"; propertiesApply.dataset.propertyText = "apply";
    propertiesApply.addEventListener("click", function () {
      var requested = toggle.checked === true;
      var result = setEnabled(requested);
      updateProperties();
      if (!available()) return;
      if (result !== requested) {
        propertiesStatus.textContent = text("変更していません。開いている画面をご確認ください。", "Settings were not changed. Check the open screens.", "设置未更改。请检查已打开的屏幕。");
        return;
      }
      propertiesHome();
    });
    root.document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && properties.classList.contains("active")) { event.preventDefault(); propertiesHome(); }
    });
  }
  function updateProperties() {
    if (!properties) return;
    var words = {
      back: text("← メニュー", "← Menu", "← 菜单"), title: propertiesTitle(),
      enable: text("このブラウザーで画面タブを使う", "Use screen tabs in this browser", "在此浏览器中使用屏幕标签"),
      limit: text("保持数", "Tab limit", "保留数量"), limitValue: text("最大9個", "Up to 9", "最多9个"),
      overflow: text("10個目", "Tenth tab", "第10个标签"), overflowValue: text("一番古いタブを閉じる", "Close the oldest tab", "关闭最早的标签"),
      unsaved: text("未保存の入力", "Unsaved input", "未保存的输入"), unsavedValue: text("閉じる前に必ず確認", "Always confirm before closing", "关闭前始终确认"),
      restore: text("再読込・開き直し", "After reopening", "重新打开后"), restoreValue: text("画面・順番・選択を復元", "Restore screens, order and selection", "恢复屏幕、顺序和选择"),
      note: text("同じブラウザーで開き直すと復元されます。未保存の入力は復元されません。", "Tabs are restored in the same browser. Unsaved input is not restored.", "在同一浏览器中重新打开时会恢复标签。未保存的输入不会恢复。"),
      cancel: text("キャンセル", "Cancel", "取消"), apply: text("適用して閉じる", "Apply & close", "应用并关闭")
    };
    properties.querySelectorAll("[data-property-text]").forEach(function (node) { node.textContent = words[node.dataset.propertyText]; });
    toggle.checked = enabled && current(); toggle.disabled = !available(); propertiesApply.disabled = !available();
    if (!available()) propertiesStatus.textContent = text("利用状態を確認できません。メニューへ戻ってください。", "Session unavailable. Return to the menu.", "无法确认会话。请返回菜单。");
  }
  function openProperties() {
    if (!available()) return false;
    announce(""); propertiesStatus.textContent = "";
    context.show(PROPERTIES_SCREEN);
    updateProperties();
    toggle.focus();
    return true;
  }
  function refreshMenu() { if (context && context.refreshMenu && context.screen() === "menu") context.refreshMenu(); }

  function text(ja, en, zh) { return root.currentLang === "zh" ? zh : root.currentLang === "en" ? en : ja; }
  function policy() { return root.DcatsNineTabsPolicy || {mode: "off"}; }
  function ownerKey() { return "dcats-nine-tabs.v1:" + verifiedId; }
  function preferenceKey() { return ownerKey() + ":enabled"; }
  function current() { return !!context && !!verifiedId && context.userId() === verifiedId && context.scope() === verifiedScope; }
  function available() { return current() && (policy().mode === "all" || policy().mode === "pilot" && Array.isArray(policy().pilotUserIds) && policy().pilotUserIds.includes(verifiedId) && Array.isArray(policy().pilotEmails) && policy().pilotEmails.includes(context.email)); }
  function canShowSettings(id) { return !!id && (policy().mode === "all" || id === verifiedId && available()); }
  function entries() { return context && context.entries ? context.entries() : []; }
  function features() { return entries().map(function (entry) { return entry.id; }); }
  function eligible(id) { return features().includes(id); }
  function allowed(id) { return current() && eligible(id) && context.canAccess(id) === true; }
  function label(id) { var entry = entries().find(function (item) { return item.id === id; }); return entry ? entry.label : text("画面", "Screen", "屏幕"); }
  function storageGet(key) { try { return root.sessionStorage.getItem(key); } catch (_) { return null; } }
  function storageSet(key, value) { try { root.sessionStorage.setItem(key, value); } catch (_) { announce(text("タブを保存できません。再読込後の復元は利用できません。", "Tabs cannot be saved for reload.", "无法保存标签以供重新加载。")); } }
  function persistentGet(key) { try { return root.localStorage.getItem(key); } catch (_) { return null; } }
  function savedTabs(value) {
    try {
      var saved = JSON.parse(value);
      return saved && [1, 2].includes(saved.version) && Array.isArray(saved.tabs) ? saved : null;
    } catch (_) { return null; }
  }
  function save() {
    if (!current()) return;
    var key = ownerKey(), value = JSON.stringify({version: 2, tabs: opened, displayOrder: tabs, active: active});
    storageSet(key, value);
    // A window with unchanged tabs must not overwrite a newer order from another window.
    if (value === persistedSnapshot || persistedSnapshot === null && !opened.length) return;
    try {
      root.localStorage.setItem(key, value);
      persistedSnapshot = value;
    } catch (_) {
      announce(text("タブを保存できません。画面を閉じると復元できない場合があります。", "Tabs could not be saved for reopening.", "无法保存标签以供重新打开。"));
    }
  }
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
    if (!enabled || !available() || !active || !tabs.includes(active) || context.screen() === "menu" || properties && properties.contains(event.target) || !editable(event.target)) return;
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
    tabs = tabs.filter(function (item) { return item !== id; });
    opened = opened.filter(function (item) { return item !== id; });
    loaded.delete(id); states.delete(id);
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
    pagePrev = element("button", "dcats-tab-page-button", strip, "‹"); pagePrev.type = "button"; pagePrev.id = "dcats-tabs-previous";
    pageCount = element("span", "dcats-tab-page-count", strip); pageCount.setAttribute("aria-live", "polite");
    pageNext = element("button", "dcats-tab-page-button", strip, "›"); pageNext.type = "button"; pageNext.id = "dcats-tabs-next";
    pagePrev.addEventListener("click", function () { if (pageNumber > 0) revealSelected(tabs[pages[pageNumber - 1].start]); });
    pageNext.addEventListener("click", function () { if (pageNumber + 1 < pages.length) revealSelected(tabs[pages[pageNumber + 1].start]); });
    mountTabReorder(strip);
    mountProperties();
    ["focusin", "beforeinput", "input", "change"].forEach(function (event) { root.document.addEventListener(event, rememberInput, true); });
    root.addEventListener("beforeunload", function (event) { if (enabled && current() && tabs.some(dirty)) { event.preventDefault(); event.returnValue = ""; } });
    root.addEventListener("resize", revealSelected);
    list.addEventListener("keydown", function (event) {
      var buttons = Array.from(list.querySelectorAll('[role="tab"]')), at = buttons.indexOf(event.target);
      if (at < 0) return;
      if (event.shiftKey && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
        event.preventDefault();
        moveTab(event.target.dataset.feature, at + (event.key === "ArrowLeft" ? -1 : 1));
        return;
      }
      var next = event.key === "ArrowRight" ? (at + 1) % buttons.length : event.key === "ArrowLeft" ? (at + buttons.length - 1) % buttons.length : event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : -1;
      if (next >= 0) { event.preventDefault(); revealSelected(buttons[next].dataset.feature); buttons.forEach(function (button) { button.tabIndex = -1; }); buttons[next].tabIndex = 0; buttons[next].focus(); }
      if (event.key === "Delete") { event.preventDefault(); close(event.target.dataset.feature); }
    });
  }

  function moveTab(id, position) {
    var from = tabs.indexOf(id);
    if (!enabled || !available() || from < 0 || position < 0 || position >= tabs.length || position === from) return false;
    tabs.splice(from, 1);
    tabs.splice(position, 0, id);
    save();
    render();
    revealSelected(id);
    var buttons = list.querySelectorAll('[role="tab"]');
    buttons.forEach(function (button) { button.tabIndex = button.dataset.feature === id ? 0 : -1; });
    root.document.getElementById("dcats-nine-tab-" + id).focus();
    return true;
  }

  function markDropTarget(group, side) {
    if (drag.targetGroup) drag.targetGroup.classList.remove("is-drop-before", "is-drop-after");
    drag.targetGroup = group;
    if (group) group.classList.add("is-drop-" + side);
  }

  function pointIn(element, x, y) {
    var rect = element.getBoundingClientRect();
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }

  function cancelPageTurn() {
    if (drag.pageTimer) root.clearTimeout(drag.pageTimer);
    drag.pageTimer = null;
    drag.pageDirection = 0;
  }

  function updateDropPosition(x, y, allowPageTurn) {
    drag.position = -1;
    var direction = 0;
    if (allowPageTurn) {
      if (!pagePrev.hidden && !pagePrev.disabled && pointIn(pagePrev, x, y)) direction = -1;
      if (!pageNext.hidden && !pageNext.disabled && pointIn(pageNext, x, y)) direction = 1;
    }
    if (direction !== drag.pageDirection) {
      cancelPageTurn();
      if (direction) {
        drag.pageDirection = direction;
        drag.pageTimer = root.setTimeout(function () {
          var nextPage = pages[pageNumber + direction];
          if (nextPage) revealSelected(tabs[nextPage.start]);
          cancelPageTurn();
          updateDropPosition(x, y, true);
        }, 450);
      }
    }
    if (direction || !pointIn(list, x, y)) { markDropTarget(null); return; }

    var visible = Array.from(list.children).filter(function (group) { return !group.hidden; });
    var target = visible.find(function (group) {
      var rect = group.getBoundingClientRect();
      return x < (rect.left + rect.right) / 2;
    });
    var side = target ? "before" : "after";
    target = target || visible[visible.length - 1];
    if (!target) { markDropTarget(null); return; }
    var from = tabs.indexOf(drag.id);
    var slot = tabs.indexOf(target.querySelector('[role="tab"]').dataset.feature) + (side === "after" ? 1 : 0);
    var position = slot > from ? slot - 1 : slot;
    drag.position = position;
    markDropTarget(position === from ? null : target, side);
  }

  function clearTabDrag() {
    if (!drag) return;
    var gesture = drag;
    cancelPageTurn();
    markDropTarget(null);
    drag = null;
    if (!gesture.started) return;
    suppressDragClick = true;
    gesture.group.classList.remove("is-tab-dragging");
    if (gesture.strip.hasPointerCapture(gesture.pointerId)) gesture.strip.releasePointerCapture(gesture.pointerId);
  }

  function mountTabReorder(strip) {
    strip.addEventListener("pointerdown", function (event) {
      if (drag || !event.isPrimary || event.button !== 0) return;
      suppressDragClick = false;
      var button = event.target.closest('[role="tab"]');
      if (!button || tabs.length < 2 || !enabled || !available()) return;
      drag = {id: button.dataset.feature, group: button.parentElement, strip: strip, pointerId: event.pointerId,
        x: event.clientX, started: false, pageDirection: 0, position: -1};
    });
    root.addEventListener("pointermove", function (event) {
      if (!drag || drag.pointerId !== event.pointerId) return;
      if (!drag.started) {
        if (Math.abs(event.clientX - drag.x) < 7) return;
        if (!strip.contains(drag.group) || !enabled || !available()) { clearTabDrag(); return; }
        strip.setPointerCapture(event.pointerId);
        drag.started = true;
        drag.group.classList.add("is-tab-dragging");
      }
      updateDropPosition(event.clientX, event.clientY, true);
    });
    root.addEventListener("pointerup", function (event) {
      if (!drag || drag.pointerId !== event.pointerId) return;
      var gesture = drag;
      if (gesture.started) updateDropPosition(event.clientX, event.clientY, false);
      clearTabDrag();
      if (gesture.started && !moveTab(gesture.id, gesture.position)) revealSelected(gesture.id);
    });
    function cancel(event) {
      if (!drag || (event.pointerId != null && event.pointerId !== drag.pointerId)) return;
      var id = drag.id;
      var started = drag.started;
      clearTabDrag();
      if (started) revealSelected(id);
    }
    root.addEventListener("pointercancel", cancel);
    root.addEventListener("blur", cancel);
    strip.addEventListener("lostpointercapture", function (event) { if (event.target === strip) cancel(event); });
    strip.addEventListener("click", function (event) {
      if (suppressDragClick && event.detail) {
        suppressDragClick = false;
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);
  }

  function revealSelected(preferredId) {
    if (!list || !bar || bar.hidden) return;
    var groups = Array.from(list.children);
    [pagePrev, pageNext, pageCount].forEach(function (node) { node.hidden = true; });
    groups.forEach(function (node) { node.hidden = false; });
    pages = []; pageNumber = 0;
    if (!groups.length) return;
    var bounds = list.getBoundingClientRect(), width = (list.clientWidth || bounds.width || bounds.right - bounds.left) - 12;
    var widths = groups.map(function (node) { var rect = node.getBoundingClientRect(); return rect.width || rect.right - rect.left; });
    if (widths.reduce(function (sum, value) { return sum + value; }, 0) + (groups.length - 1) * 4 <= width) return;
    [pagePrev, pageNext, pageCount].forEach(function (node) { node.hidden = false; });
    bounds = list.getBoundingClientRect(); width = (list.clientWidth || bounds.width || bounds.right - bounds.left) - 12;
    widths = groups.map(function (node) { var rect = node.getBoundingClientRect(); return Math.min(rect.width || rect.right - rect.left, width); });
    var start = 0, used = 0;
    widths.forEach(function (value, index) {
      if (index > start && used + 4 + value > width) { pages.push({start: start, end: index - 1}); start = index; used = 0; }
      used += (index > start ? 4 : 0) + value;
    });
    pages.push({start: start, end: groups.length - 1});
    var focused = root.document.activeElement, focusId = focused && focused.dataset && (focused.dataset.feature || focused.dataset.closeFeature);
    var id = typeof preferredId === "string" ? preferredId : focusId || active;
    var at = Math.max(0, tabs.indexOf(id));
    pageNumber = Math.max(0, pages.findIndex(function (page) { return at >= page.start && at <= page.end; }));
    var page = pages[pageNumber];
    groups.forEach(function (node, index) { node.hidden = index < page.start || index > page.end; });
    var visibleButtons = groups.slice(page.start, page.end + 1).map(function (node) { return node.querySelector('[role="tab"]'); });
    if (!visibleButtons.some(function (node) { return node.tabIndex === 0; })) visibleButtons[0].tabIndex = 0;
    pagePrev.disabled = pageNumber === 0; pageNext.disabled = pageNumber === pages.length - 1;
    pagePrev.setAttribute("aria-label", text("前のタブを表示", "Show previous tabs", "显示上一组标签"));
    pageNext.setAttribute("aria-label", text("次のタブを表示", "Show next tabs", "显示下一组标签"));
    pageCount.textContent = (page.start + 1 === page.end + 1 ? String(page.start + 1) : (page.start + 1) + "–" + (page.end + 1)) + "/" + tabs.length;
  }
  function appendMenuIcon(button, id) {
    var menu = root.document.getElementById("menu-grid");
    var item = menu && Array.from(menu.querySelectorAll("[data-action]")).find(function (node) { return node.dataset.action === id; });
    var source = item && item.querySelector(".menu-icon, .menu-admin-link-icon");
    if (!source) return;
    var icon = element("span", "dcats-nine-tab-icon", button);
    icon.setAttribute("aria-hidden", "true");
    Array.from(source.childNodes).forEach(function (node) { icon.appendChild(node.cloneNode(true)); });
  }
  function render() {
    if (!bar) return;
    clearTabDrag();
    var screen = context && context.screen();
    bar.hidden = !enabled || !current() || !screen || ["login", "boot", "reset", "forgot"].includes(screen);
    var destination = screen && root.document.getElementById("screen-" + screen);
    if (!bar.hidden && destination && bar.parentNode !== destination) destination.insertBefore(bar, destination.firstChild);
    root.document.body.classList.toggle("dcats-nine-tabs-visible", !bar.hidden);
    hint.hidden = tabs.length > 0;
    hint.textContent = text("メニューから開いた画面を9つまで保持します。タブはドラッグで並べ替えられます。", "Keep up to 9 screens. Drag tabs to change their order.", "最多保留9个屏幕。拖动标签可调整顺序。");
    list.replaceChildren(); list.setAttribute("aria-label", text("画面タブ（最大9）", "Screen tabs (maximum 9)", "屏幕标签（最多9个）"));
    tabs.forEach(function (id) {
      var selected = screen !== "menu" && screen !== PROPERTIES_SCREEN && active === id, group = root.document.createElement("div"); group.className = "dcats-nine-tab"; group.classList.toggle("is-active", selected);
      var button = root.document.createElement("button"); button.type = "button"; button.dataset.feature = id; button.id = "dcats-nine-tab-" + id;
      button.setAttribute("aria-keyshortcuts", "Shift+ArrowLeft Shift+ArrowRight");
      button.setAttribute("role", "tab"); button.setAttribute("aria-selected", String(selected)); button.setAttribute("aria-controls", "screen-" + id); button.tabIndex = active === id || !active && tabs[0] === id ? 0 : -1;
      var name = label(id); appendMenuIcon(button, id); element("span", "dcats-nine-tab-label", button, name);
      button.title = name; button.addEventListener("click", function () { activate(id); });
      var remove = root.document.createElement("button"); remove.type = "button"; remove.className = "dcats-nine-tab-close"; remove.dataset.closeFeature = id; remove.textContent = "×";
      remove.setAttribute("aria-label", name + text("を閉じる", ": close", "：关闭")); remove.addEventListener("click", function () { close(id); });
      group.append(button, remove); list.appendChild(group);
    });
    revealSelected();
    updateProperties();
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
  function restore(openSavedScreen) {
    var key = ownerKey();
    persistedSnapshot = persistentGet(key);
    var saved = savedTabs(persistedSnapshot) || savedTabs(storageGet(key));
    opened = saved ? Array.from(new Set(saved.tabs.filter(allowed))).slice(-LIMIT) : [];
    var displayOrder = opened.length && Array.isArray(saved.displayOrder) ? saved.displayOrder.filter(function (id) { return opened.includes(id); }) : [];
    tabs = Array.from(new Set(displayOrder.concat(opened)));
    active = saved && tabs.includes(saved.active) ? saved.active : tabs[0] || null;
    save(); render();
    if (openSavedScreen !== false && active && context.screen() === "menu") activate(active);
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
    var victim = !tabs.includes(id) && tabs.length >= LIMIT ? opened[0] : null;
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
    if (id === PROPERTIES_SCREEN && !available()) return false;
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
        if (tabs.length < LIMIT) { tabs.push(id); opened.push(id); }
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
    if (forgetSaved && verifiedId) {
      try { root.sessionStorage.removeItem(ownerKey()); root.sessionStorage.removeItem(preferenceKey()); } catch (_) {}
      try { root.localStorage.removeItem(ownerKey()); } catch (_) {}
    }
    persistedSnapshot = null;
    epoch += 1; enabled = false; context = null; verifiedId = null; verifiedScope = null; tabs = []; opened = []; active = null; loaded.clear(); states.clear(); edits.clear(); prepared = null; render();
  }
  async function afterAuthenticated(options, openSavedScreen) {
    var wasCurrent = current(), ticket = ++epoch, expected = options.userId(), expectedScope = options.scope();
    if (!expected || options.external) { suspend(false); return; }
    var response;
    try { response = await options.verify(); } catch (_) { if (ticket === epoch) suspend(false); return; }
    if (ticket !== epoch || options.userId() !== expected || options.scope() !== expectedScope) return;
    var user = response && !response.error && response.data && response.data.user;
    if (!user || user.id !== expected || !user.email_confirmed_at) { suspend(false); return; }
    context = options; context.email = String(user.email || "").toLowerCase(); verifiedId = user.id; verifiedScope = expectedScope;
    mount();
    var preference = storageGet(preferenceKey());
    enabled = available() && (preference === null || preference === "on");
    if (wasCurrent) { render(); refreshMenu(); return; }
    tabs = []; opened = []; loaded.clear(); states.clear(); edits.clear(); active = null; prepared = null;
    if (enabled) restore(openSavedScreen); else render();
    refreshMenu();
  }
  root.DcatsNineTabs = Object.freeze({
    isAvailable: available, canShowSettings: canShowSettings, openProperties: openProperties, propertiesTitle: propertiesTitle,
    get features() { return features(); }, retainedLimit: LIMIT, afterAuthenticated: afterAuthenticated, beforeEnter: beforeEnter, beforeShow: beforeShow, screenChanged: screenChanged, suspend: suspend,
    authEvent: function (event) { if (["SIGNED_OUT", "USER_UPDATED", "PASSWORD_RECOVERY"].includes(event)) suspend(event === "SIGNED_OUT"); },
    willLeave: function (id) { if (id === "menu") capture(); },
    hasTab: function (id) { return enabled && current() && tabs.includes(id); },
    hasUnsaved: function () { return enabled && current() && tabs.some(dirty); },
    markClean: function (id) { edits.delete(id); },
    snapshot: function () { return {enabled: enabled && current(), tabs: tabs.slice(), active: active, retainedLimit: LIMIT}; }
  });
})(window);
