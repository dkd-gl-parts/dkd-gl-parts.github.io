(function () {
  "use strict";

  var STORAGE_KEY_PREFIX = "dcats_concierge_pet_v1:";
  var EXCLUDED_SCREENS = { boot: true, login: true, forgot: true, reset: true };
  var PETS = {
    suzuto: { copyKey: "suzuto", className: "is-suzuto" },
    rinna: { copyKey: "rinna", className: "is-rinna" }
  };
  var ROWS = {
    idle: { row: 0, durations: [280, 110, 110, 140, 140, 320] },
    "running-right": { row: 1, durations: [120, 120, 120, 120, 120, 120, 120, 220] },
    "running-left": { row: 2, durations: [120, 120, 120, 120, 120, 120, 120, 220] },
    waving: { row: 3, durations: [140, 140, 140, 280] },
    jumping: { row: 4, durations: [140, 140, 140, 140, 280] },
    failed: { row: 5, durations: [140, 140, 140, 140, 140, 140, 140, 240] },
    waiting: { row: 6, durations: [150, 150, 150, 150, 150, 260] },
    running: { row: 7, durations: [120, 120, 120, 120, 120, 220] },
    review: { row: 8, durations: [150, 150, 150, 150, 150, 280] }
  };
  var COPY = {
    ja: {
      rootLabel: "D-CATSコンシェルジュ",
      stateWorking: "処理しています。少しお待ちください。",
      stateWaiting: "確認をお待ちしています。",
      stateReview: "内容を確認しています。",
      stateFailed: "うまくいきませんでした。もう一度確認します。",
      stateSuccess: "完了しました。",
      stateGreeting: "いつでもお手伝いします。",
      launcher: "コンシェルジュ",
      settingsTitle: "コンシェルジュ設定",
      closeSettings: "設定を閉じる",
      chooseCharacter: "コンシェルジュを選ぶ（1体のみ表示）",
      suzuto: "スズト",
      rinna: "リンナ",
      motionLegend: "動き方",
      modeActive: "よく動く",
      modeFixed: "定位置",
      modeOff: "非表示",
      help: "選択した1体だけを読み込みます。「よく動く」は操作部品を避けて歩き、「定位置」は画面右下で反応だけを表示します。OSの「視差効果を減らす」が有効な場合も静止します。",
      openSettings: "{name}の設定を開く",
      launcherOff: "コンシェルジュを表示",
      switched: "{name}に切り替えました。",
      activeMessage: "元気にご案内します。",
      fixedMessage: "画面の隅で待機します。"
    },
    en: {
      rootLabel: "D-CATS Concierge",
      stateWorking: "Processing. Please wait.",
      stateWaiting: "Waiting for your confirmation.",
      stateReview: "Reviewing the details.",
      stateFailed: "That did not work. I will check again.",
      stateSuccess: "Done.",
      stateGreeting: "I am always here to help.",
      launcher: "Concierge",
      settingsTitle: "Concierge settings",
      closeSettings: "Close settings",
      chooseCharacter: "Choose a concierge (only one appears)",
      suzuto: "Suzuto",
      rinna: "Rinna",
      motionLegend: "Movement",
      modeActive: "Active",
      modeFixed: "Stay put",
      modeOff: "Hide",
      help: "Only the selected concierge is loaded. Active mode walks around while avoiding controls. Stay put keeps the concierge in the lower-right corner for reactions only. Motion also stops when your OS requests reduced motion.",
      openSettings: "Open {name}'s settings",
      launcherOff: "Show concierge",
      switched: "Switched to {name}.",
      activeMessage: "I will guide you actively.",
      fixedMessage: "I will wait in the corner."
    },
    zh: {
      rootLabel: "D-CATS礼宾助手",
      stateWorking: "正在处理，请稍候。",
      stateWaiting: "正在等待您的确认。",
      stateReview: "正在确认内容。",
      stateFailed: "处理未成功，我会再次确认。",
      stateSuccess: "已完成。",
      stateGreeting: "随时为您提供帮助。",
      launcher: "礼宾助手",
      settingsTitle: "礼宾助手设置",
      closeSettings: "关闭设置",
      chooseCharacter: "选择礼宾助手（仅显示一位）",
      suzuto: "Suzuto",
      rinna: "Rinna",
      motionLegend: "移动方式",
      modeActive: "活跃移动",
      modeFixed: "固定位置",
      modeOff: "隐藏",
      help: "仅加载所选的一位礼宾助手。“活跃移动”会避开操作控件在画面中行走；“固定位置”只在右下角作出反应。操作系统启用减少动态效果时也会停止移动。",
      openSettings: "打开{name}的设置",
      launcherOff: "显示礼宾助手",
      switched: "已切换为{name}。",
      activeMessage: "我会积极为您引导。",
      fixedMessage: "我会在画面角落等候。"
    }
  };
  var STATE_MESSAGE_KEYS = {
    working: "stateWorking",
    waiting: "stateWaiting",
    review: "stateReview",
    failed: "stateFailed",
    success: "stateSuccess",
    greeting: "stateGreeting"
  };

  var root;
  var mover;
  var sprite;
  var hitTarget;
  var bubble;
  var launcher;
  var launcherLabel;
  var panel;
  var panelClose;
  var characterButtons = [];
  var modeButtons = [];
  var movementAnimation = null;
  var spriteAnimation = null;
  var sequenceToken = 0;
  var activityTimer = null;
  var bubbleTimer = null;
  var pointerFrameRequest = null;
  var layoutFrameRequest = null;
  var currentVisualKey = "";
  var panelReturnFocus = null;
  var position = { x: 18, y: 120 };
  var pointer = { x: 0, y: 0, at: 0 };
  var settingsOwner = "";
  var settings = readSettings("");
  var languageObserver = null;
  var reduceMotionQuery = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  var visible = false;
  var panelOpen = false;
  var externalStateUntil = 0;
  var lastInteractionAt = 0;

  function activeLanguage() {
    var lang = String(document.documentElement.lang || "ja").toLowerCase();
    if (lang.indexOf("zh") === 0) return "zh";
    if (lang.indexOf("en") === 0) return "en";
    return "ja";
  }

  function copy(key, values) {
    var dictionary = COPY[activeLanguage()] || COPY.ja;
    var text = dictionary[key] || COPY.ja[key] || key;
    Object.keys(values || {}).forEach(function (name) {
      text = text.split("{" + name + "}").join(String(values[name]));
    });
    return text;
  }

  function petName(character) {
    return copy((PETS[character] || PETS.suzuto).copyKey);
  }

  function currentSettingsOwner() {
    var user = window.currentUser;
    return user && user.id ? String(user.id) : "";
  }

  function isSystemAdminSession() {
    var access = window.DcatsAccess;
    if (!window.currentUser || !access || typeof access.isSystemAdmin !== "function") return false;
    try {
      return !!access.isSystemAdmin();
    } catch (error) {
      return false;
    }
  }

  function readSettings(owner) {
    var value = { character: "suzuto", mode: "active" };
    if (!owner) return value;
    try {
      var saved = JSON.parse(localStorage.getItem(STORAGE_KEY_PREFIX + owner) || "null");
      if (saved && PETS[saved.character]) value.character = saved.character;
      if (saved && saved.mode === "calm") value.mode = "fixed";
      if (saved && (saved.mode === "active" || saved.mode === "fixed" || saved.mode === "off")) value.mode = saved.mode;
    } catch (error) {
      // A private browsing policy may disable storage; defaults remain usable.
    }
    return value;
  }

  function saveSettings() {
    if (!settingsOwner) return;
    try {
      localStorage.setItem(STORAGE_KEY_PREFIX + settingsOwner, JSON.stringify(settings));
    } catch (error) {
      // The concierge remains session-usable when persistence is unavailable.
    }
  }

  function syncSettingsOwner() {
    var owner = currentSettingsOwner();
    if (owner === settingsOwner) return;
    settingsOwner = owner;
    settings = readSettings(owner);
    if (root) applySettings();
  }

  function createElement(tag, className, text) {
    var element = document.createElement(tag);
    if (className) element.className = className;
    if (text != null) element.textContent = text;
    return element;
  }

  function createCopyElement(tag, className, copyKey) {
    var element = createElement(tag, className, copy(copyKey));
    element.dataset.conciergeCopy = copyKey;
    return element;
  }

  function createChoice(copyKey, value, group) {
    var button = createCopyElement("button", "dcats-concierge-choice", copyKey);
    button.type = "button";
    button.dataset.value = value;
    button.dataset.group = group;
    button.setAttribute("aria-pressed", "false");
    return button;
  }

  function buildUi() {
    root = createElement("section", "dcats-concierge");
    root.id = "dcats-concierge";
    root.hidden = true;
    root.setAttribute("aria-label", copy("rootLabel"));

    mover = createElement("div", "dcats-concierge-mover");
    sprite = createElement("div", "dcats-concierge-sprite");
    sprite.setAttribute("aria-hidden", "true");
    hitTarget = createElement("button", "dcats-concierge-hit-target");
    hitTarget.type = "button";
    bubble = createElement("div", "dcats-concierge-bubble");
    bubble.setAttribute("role", "status");
    bubble.setAttribute("aria-live", "polite");
    mover.appendChild(sprite);
    mover.appendChild(hitTarget);
    mover.appendChild(bubble);

    launcher = createElement("button", "dcats-concierge-launcher");
    launcher.type = "button";
    launcher.setAttribute("aria-haspopup", "dialog");
    launcher.setAttribute("aria-expanded", "false");
    var launcherIcon = createElement("span", "dcats-concierge-launcher-icon", "♢");
    launcherIcon.setAttribute("aria-hidden", "true");
    launcherLabel = createCopyElement("span", "dcats-concierge-launcher-label", "launcher");
    launcher.appendChild(launcherIcon);
    launcher.appendChild(launcherLabel);

    panel = createElement("section", "dcats-concierge-panel");
    panel.id = "dcats-concierge-panel";
    panel.hidden = true;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "false");
    panel.setAttribute("aria-labelledby", "dcats-concierge-title");

    var panelHead = createElement("div", "dcats-concierge-panel-head");
    var headingWrap = createElement("div");
    headingWrap.appendChild(createElement("span", "dcats-concierge-panel-kicker", "D-CATS OFFICIAL CONCIERGE"));
    var title = createCopyElement("h2", "", "settingsTitle");
    title.id = "dcats-concierge-title";
    headingWrap.appendChild(title);
    panelClose = createElement("button", "dcats-concierge-panel-close", "×");
    panelClose.type = "button";
    panelClose.setAttribute("aria-label", copy("closeSettings"));
    panelHead.appendChild(headingWrap);
    panelHead.appendChild(panelClose);

    var panelBody = createElement("div", "dcats-concierge-panel-body");
    var characterField = createElement("fieldset", "dcats-concierge-fieldset");
    characterField.appendChild(createCopyElement("legend", "", "chooseCharacter"));
    var characterGrid = createElement("div", "dcats-concierge-choice-grid");
    characterButtons = [createChoice("suzuto", "suzuto", "character"), createChoice("rinna", "rinna", "character")];
    characterButtons.forEach(function (button) { characterGrid.appendChild(button); });
    characterField.appendChild(characterGrid);

    var modeField = createElement("fieldset", "dcats-concierge-fieldset");
    modeField.appendChild(createCopyElement("legend", "", "motionLegend"));
    var modeGrid = createElement("div", "dcats-concierge-choice-grid dcats-concierge-mode-grid");
    modeButtons = [
      createChoice("modeActive", "active", "mode"),
      createChoice("modeFixed", "fixed", "mode"),
      createChoice("modeOff", "off", "mode")
    ];
    modeButtons.forEach(function (button) { modeGrid.appendChild(button); });
    modeField.appendChild(modeGrid);

    panelBody.appendChild(characterField);
    panelBody.appendChild(modeField);
    panelBody.appendChild(createCopyElement("p", "dcats-concierge-help", "help"));
    panel.appendChild(panelHead);
    panel.appendChild(panelBody);

    root.appendChild(mover);
    root.appendChild(launcher);
    root.appendChild(panel);
    document.body.appendChild(root);

    hitTarget.addEventListener("click", function () {
      showBubble(copy(STATE_MESSAGE_KEYS.greeting), 2400);
      playExternalState("greeting", 1200);
      openPanel();
    });
    launcher.addEventListener("click", function () { panelOpen ? closePanel() : openPanel(); });
    panelClose.addEventListener("click", closePanel);
    characterButtons.forEach(function (button) {
      button.addEventListener("click", function () { selectCharacter(button.dataset.value); });
    });
    modeButtons.forEach(function (button) {
      button.addEventListener("click", function () { selectMode(button.dataset.value); });
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && panelOpen) closePanel();
    });
    document.addEventListener("pointerdown", function (event) {
      if (!panelOpen || panel.contains(event.target) || launcher.contains(event.target) || hitTarget.contains(event.target)) return;
      closePanel();
    }, { passive: true });
    document.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("click", onAppInteraction, true);
    window.addEventListener("dcats:concierge-state", onConciergeState);
    document.addEventListener("visibilitychange", syncRunningState);
    window.addEventListener("resize", scheduleViewportSync, { passive: true });
    window.addEventListener("scroll", scheduleViewportSync, { passive: true, capture: true });
    if (reduceMotionQuery) {
      if (reduceMotionQuery.addEventListener) reduceMotionQuery.addEventListener("change", syncRunningState);
      else if (reduceMotionQuery.addListener) reduceMotionQuery.addListener(syncRunningState);
    }
    if (typeof MutationObserver === "function") {
      languageObserver = new MutationObserver(refreshCopy);
      languageObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    }

    syncSettingsOwner();
    applySettings();
    observeScreens();
    syncVisibility();
  }

  function observeScreens() {
    var screens = document.querySelectorAll(".screen");
    if (!screens.length || typeof MutationObserver !== "function") return;
    var observer = new MutationObserver(syncVisibility);
    screens.forEach(function (screen) { observer.observe(screen, { attributes: true, attributeFilter: ["class", "hidden"] }); });
  }

  function activeScreenName() {
    var active = document.querySelector(".screen.active");
    if (!active || !active.id || active.id.indexOf("screen-") !== 0) return "";
    return active.id.slice(7);
  }

  function syncVisibility() {
    syncSettingsOwner();
    var screen = activeScreenName();
    var dedicatedPrintStation = new URLSearchParams(window.location.search).has("dcats_print_station");
    var systemAdmin = isSystemAdminSession();
    visible = systemAdmin && !!screen && !EXCLUDED_SCREENS[screen] && !dedicatedPrintStation;
    if (!systemAdmin && panelOpen) {
      panelOpen = false;
      panel.hidden = true;
      launcher.setAttribute("aria-expanded", "false");
      panelReturnFocus = null;
    }
    root.hidden = !visible;
    syncRunningState();
  }

  function isReducedMotion() {
    return !!(reduceMotionQuery && reduceMotionQuery.matches);
  }

  function refreshCopy() {
    if (!root) return;
    root.setAttribute("aria-label", copy("rootLabel"));
    panelClose.setAttribute("aria-label", copy("closeSettings"));
    root.querySelectorAll("[data-concierge-copy]").forEach(function (element) {
      element.textContent = copy(element.dataset.conciergeCopy);
    });
    applySettings();
  }

  function applySettings() {
    var name = petName(settings.character);
    sprite.classList.remove("is-suzuto", "is-rinna");
    sprite.classList.add(PETS[settings.character].className);
    root.classList.toggle("is-off", settings.mode === "off");
    hitTarget.setAttribute("aria-label", copy("openSettings", { name: name }));
    launcher.setAttribute("aria-label", copy("openSettings", { name: name }));
    launcherLabel.textContent = settings.mode === "off" ? copy("launcherOff") : name;
    characterButtons.forEach(function (button) { button.setAttribute("aria-pressed", String(button.dataset.value === settings.character)); });
    modeButtons.forEach(function (button) { button.setAttribute("aria-pressed", String(button.dataset.value === settings.mode)); });
  }

  function selectCharacter(character) {
    if (!isSystemAdminSession()) return;
    syncSettingsOwner();
    if (!PETS[character] || settings.character === character) return;
    settings.character = character;
    saveSettings();
    applySettings();
    showBubble(copy("switched", { name: petName(character) }), 2200);
    playExternalState("greeting", 1300);
  }

  function selectMode(mode) {
    if (!isSystemAdminSession()) return;
    syncSettingsOwner();
    if (mode !== "active" && mode !== "fixed" && mode !== "off") return;
    settings.mode = mode;
    saveSettings();
    if (mode === "off") {
      stopActivity();
      applySettings();
      closePanel();
      return;
    }
    applySettings();
    showBubble(copy(mode === "active" ? "activeMessage" : "fixedMessage"), 2200);
    closePanel();
    syncRunningState();
  }

  function openPanel() {
    if (!isSystemAdminSession() || panelOpen) return;
    panelReturnFocus = document.activeElement;
    panelOpen = true;
    panel.hidden = false;
    launcher.setAttribute("aria-expanded", "true");
    stopActivity();
    syncRunningState();
    panelClose.focus();
  }

  function closePanel(restoreFocus) {
    if (!panelOpen) return;
    var focusTarget = panelReturnFocus;
    panelReturnFocus = null;
    panelOpen = false;
    panel.hidden = true;
    launcher.setAttribute("aria-expanded", "false");
    if (restoreFocus !== false) {
      if (!focusTarget || !focusTarget.isConnected || !isElementVisible(focusTarget)) focusTarget = launcher;
      focusTarget.focus();
    }
    syncRunningState();
  }

  function syncRunningState() {
    if (!visible || document.hidden || settings.mode === "off") {
      stopActivity();
      return;
    }
    if (panelOpen) {
      stopActivity();
      if (isReducedMotion()) showFrame(ROWS.waiting.row, 0);
      else playRow("waiting", Infinity);
      return;
    }
    if (isReducedMotion()) {
      stopActivity();
      parkAtSafeCorner();
      showFrame(0, 0);
      return;
    }
    if (settings.mode === "fixed") {
      stopActivity();
      parkAtSafeCorner();
      playRow("idle", Infinity);
      return;
    }
    startActivity();
  }

  function startActivity() {
    sequenceToken += 1;
    var token = sequenceToken;
    clearActivityTimer();
    runActivityLoop(token);
  }

  function stopActivity() {
    sequenceToken += 1;
    clearActivityTimer();
    if (pointerFrameRequest != null) window.cancelAnimationFrame(pointerFrameRequest);
    pointerFrameRequest = null;
    freezeMovement();
    if (spriteAnimation) spriteAnimation.cancel();
    spriteAnimation = null;
    currentVisualKey = "";
  }

  function clearActivityTimer() {
    if (activityTimer) clearTimeout(activityTimer);
    activityTimer = null;
  }

  function delay(ms, token) {
    return new Promise(function (resolve) {
      clearActivityTimer();
      activityTimer = setTimeout(function () {
        activityTimer = null;
        resolve(token === sequenceToken);
      }, ms);
    });
  }

  async function runActivityLoop(token) {
    if (token !== sequenceToken || !canAnimate()) return;
    if (Date.now() < externalStateUntil) {
      if (await delay(220, token)) runActivityLoop(token);
      return;
    }
    if (hasBlockingDialog()) {
      root.classList.add("is-blocked");
      parkAtSafeCorner();
      playRow("waiting", Infinity);
      if (await delay(700, token)) runActivityLoop(token);
      return;
    }
    root.classList.remove("is-blocked");

    var segments = 1 + Math.floor(Math.random() * 3);
    for (var i = 0; i < segments; i += 1) {
      var target = findSafeTarget();
      if (!target) {
        root.classList.add("has-no-safe-target");
        showFrame(ROWS.idle.row, 0);
        if (await delay(3000, token)) runActivityLoop(token);
        return;
      }
      root.classList.remove("has-no-safe-target");
      var moved = await moveTo(target, token);
      if (!moved || token !== sequenceToken) return;
    }

    var action = chooseAmbientAction();
    var duration = action === "waving" ? 1700 : action === "jumping" ? 1500 : action === "review" ? 1750 : 1150;
    playRow(action, 1);
    if (!(await delay(duration + 200, token))) return;
    playRow("idle", Infinity);
    var rest = 350 + Math.floor(Math.random() * 1150);
    if (await delay(rest, token)) runActivityLoop(token);
  }

  function canAnimate() {
    return visible && !document.hidden && settings.mode !== "off" && !panelOpen && !isReducedMotion();
  }

  function chooseAmbientAction() {
    var value = Math.random();
    if (value < .28) return "waving";
    if (value < .52) return "jumping";
    if (value < .69) return "review";
    return "idle";
  }

  function moveTo(target, token) {
    var start = { x: position.x, y: position.y };
    var dx = target.x - start.x;
    var dy = target.y - start.y;
    var distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < 28) return Promise.resolve(true);
    playRow(dx >= 0 ? "running-right" : "running-left", Infinity);
    var speed = 118;
    var duration = Math.max(1250, Math.min(5600, distance / speed * 1000));
    var next = mover.animate([
      { transform: transformFor(start) },
      { transform: transformFor(target) }
    ], { duration: duration, easing: "cubic-bezier(.38,.05,.2,1)", fill: "forwards" });
    var previous = movementAnimation;
    movementAnimation = next;
    if (previous) previous.cancel();
    return next.finished.then(function () {
      if (token !== sequenceToken) return false;
      position = target;
      return true;
    }).catch(function () { return false; });
  }

  function transformFor(point) {
    return "translate3d(" + Math.round(point.x) + "px," + Math.round(point.y) + "px,0)";
  }

  function freezeMovement() {
    if (!movementAnimation) return;
    var previous = movementAnimation;
    if (!mover || !mover.getClientRects().length) {
      previous.cancel();
      movementAnimation = null;
      return;
    }
    var rect = mover.getBoundingClientRect();
    var current = { x: rect.left, y: rect.top };
    var hold = mover.animate([
      { transform: transformFor(current) },
      { transform: transformFor(current) }
    ], { duration: 1, fill: "forwards" });
    movementAnimation = hold;
    position = current;
    previous.cancel();
  }

  function parkAtSafeCorner() {
    root.classList.remove("has-no-safe-target");
    var size = petSize();
    var target = {
      x: Math.max(10, window.innerWidth - size.width - 72),
      y: Math.max(54, window.innerHeight - size.height - 74)
    };
    position = target;
    var next = mover.animate([
      { transform: transformFor(target) },
      { transform: transformFor(target) }
    ], { duration: 1, fill: "forwards" });
    var previous = movementAnimation;
    movementAnimation = next;
    if (previous) previous.cancel();
  }

  function petSize() {
    var rect = mover.getBoundingClientRect();
    return { width: rect.width || (window.innerWidth <= 700 ? 88 : 118), height: rect.height || (window.innerWidth <= 700 ? 96 : 128) };
  }

  function findSafeTarget() {
    var size = petSize();
    var width = Math.max(1, window.innerWidth - size.width - 18);
    var height = Math.max(1, window.innerHeight - size.height - 18);
    var minimumY = window.innerWidth <= 700 ? Math.max(48, height * .42) : 52;
    var rects = collectExclusionRects();
    for (var attempt = 0; attempt < 32; attempt += 1) {
      var x;
      var y;
      x = 10 + Math.random() * Math.max(1, width - 20);
      y = minimumY + Math.random() * Math.max(1, height - minimumY - 12);
      var candidate = { x: x, y: y };
      if (isSafeCandidate(candidate, size, rects)) return candidate;
    }
    var fallbackY = Math.max(minimumY, height - 20);
    var fallbacks = [
      { x: 14, y: fallbackY },
      { x: Math.max(14, width - 14), y: fallbackY },
      { x: 14, y: minimumY },
      { x: Math.max(14, width - 14), y: minimumY }
    ];
    for (var fallbackIndex = 0; fallbackIndex < fallbacks.length; fallbackIndex += 1) {
      if (isSafeCandidate(fallbacks[fallbackIndex], size, rects)) return fallbacks[fallbackIndex];
    }
    return null;
  }

  function collectExclusionRects() {
    var active = document.querySelector(".screen.active");
    if (!active) return [];
    var selectors = "button,input,select,textarea,a[href],summary,[role='button'],[role='link'],[role='dialog'],[tabindex]:not([tabindex='-1']),[data-production-index],.form-overlay,.overlay.show,.panel.show,.fullscreen,.toast,.loading-overlay";
    var elements = active.querySelectorAll(selectors);
    var rects = [];
    for (var i = 0; i < elements.length && rects.length < 260; i += 1) {
      var element = elements[i];
      if (!isElementVisible(element)) continue;
      var rect = element.getBoundingClientRect();
      if (rect.width < 8 || rect.height < 8) continue;
      rects.push({ left: rect.left - 18, top: rect.top - 18, right: rect.right + 18, bottom: rect.bottom + 18 });
    }
    [launcher, panel].forEach(function (element) {
      if (!element || !isElementVisible(element)) return;
      var rect = element.getBoundingClientRect();
      rects.push({ left: rect.left - 18, top: rect.top - 18, right: rect.right + 18, bottom: rect.bottom + 18 });
    });
    return rects;
  }

  function isSafeCandidate(candidate, size, rects) {
    var left = candidate.x;
    var top = candidate.y;
    var right = left + size.width;
    var bottom = top + size.height;
    for (var i = 0; i < rects.length; i += 1) {
      var rect = rects[i];
      if (left < rect.right && right > rect.left && top < rect.bottom && bottom > rect.top) return false;
    }
    for (var step = 1; step < 12; step += 1) {
      var ratio = step / 12;
      var sample = {
        x: position.x + (candidate.x - position.x) * ratio,
        y: position.y + (candidate.y - position.y) * ratio
      };
      var sampleRight = sample.x + size.width;
      var sampleBottom = sample.y + size.height;
      for (var j = 0; j < rects.length; j += 1) {
        var obstacle = rects[j];
        if (sample.x < obstacle.right && sampleRight > obstacle.left && sample.y < obstacle.bottom && sampleBottom > obstacle.top) return false;
      }
    }
    return true;
  }

  function isElementVisible(element) {
    if (!element || element.hidden) return false;
    var style = window.getComputedStyle(element);
    var rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) !== 0 && rect.width > 0 && rect.height > 0;
  }

  function hasBlockingDialog() {
    var dialogs = document.querySelectorAll("[role='dialog'],.form-overlay,.overlay.show,.panel.show,.fullscreen,.loading-overlay");
    for (var i = 0; i < dialogs.length; i += 1) {
      if (panel.contains(dialogs[i]) || dialogs[i] === panel) continue;
      if (isElementVisible(dialogs[i]) && dialogs[i].getBoundingClientRect().width > 20) return true;
    }
    return false;
  }

  function playRow(name, iterations) {
    var rowName = ROWS[name] ? name : "idle";
    var row = ROWS[rowName];
    if (!sprite || typeof sprite.animate !== "function") return null;
    if (isReducedMotion()) return showFrame(row.row, 0);
    var visualKey = "row:" + rowName + ":" + String(iterations == null ? 1 : iterations);
    if (currentVisualKey === visualKey && spriteAnimation && spriteAnimation.playState === "running") return spriteAnimation;
    if (spriteAnimation) spriteAnimation.cancel();
    var total = row.durations.reduce(function (sum, duration) { return sum + duration; }, 0);
    var elapsed = 0;
    var frames = [];
    row.durations.forEach(function (duration, column) {
      frames.push({ offset: elapsed / total, backgroundPosition: backgroundPosition(row.row, column), easing: "steps(1, end)" });
      elapsed += duration;
    });
    frames.push({ offset: 1, backgroundPosition: backgroundPosition(row.row, row.durations.length - 1), easing: "steps(1, end)" });
    currentVisualKey = visualKey;
    spriteAnimation = sprite.animate(frames, { duration: total, iterations: iterations == null ? 1 : iterations, fill: "forwards" });
    return spriteAnimation;
  }

  function showFrame(row, column) {
    if (!sprite || typeof sprite.animate !== "function") return null;
    var visualKey = "frame:" + row + ":" + column;
    if (currentVisualKey === visualKey && spriteAnimation) return spriteAnimation;
    if (spriteAnimation) spriteAnimation.cancel();
    var value = backgroundPosition(row, column);
    currentVisualKey = visualKey;
    spriteAnimation = sprite.animate([{ backgroundPosition: value }, { backgroundPosition: value }], { duration: 1, fill: "forwards" });
    return spriteAnimation;
  }

  function backgroundPosition(row, column) {
    return (column * 100 / 7) + "% " + (row * 100 / 10) + "%";
  }

  function onPointerMove(event) {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.at = Date.now();
    if (pointerFrameRequest != null) return;
    pointerFrameRequest = window.requestAnimationFrame(function () {
      pointerFrameRequest = null;
      updatePointerGaze();
    });
  }

  function updatePointerGaze() {
    if (!canAnimate() || movementAnimation && movementAnimation.playState === "running") return;
    var rect = mover.getBoundingClientRect();
    var dx = pointer.x - (rect.left + rect.width / 2);
    var dy = pointer.y - (rect.top + rect.height / 2);
    if (Math.sqrt(dx * dx + dy * dy) < 72) {
      playRow("idle", Infinity);
      return;
    }
    var degrees = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
    var index = Math.round(degrees / 22.5) % 16;
    showFrame(index < 8 ? 9 : 10, index < 8 ? index : index - 8);
  }

  function onAppInteraction(event) {
    if (!visible || settings.mode !== "active" || root.contains(event.target)) return;
    var target = event.target && event.target.closest ? event.target.closest("button,a[href]") : null;
    if (!target) return;
    lastInteractionAt = Date.now();
    if (Math.random() < .22) playExternalState(Math.random() < .55 ? "review" : "success", 1250);
  }

  function onConciergeState(event) {
    var detail = event && event.detail;
    var state = typeof detail === "string" ? detail : detail && detail.state;
    var duration = detail && Number(detail.duration);
    playExternalState(state, Number.isFinite(duration) ? duration : 2200);
  }

  function playExternalState(state, duration) {
    var rowName = {
      working: "running",
      waiting: "waiting",
      review: "review",
      failed: "failed",
      success: "jumping",
      greeting: "waving"
    }[state];
    if (!rowName || !isSystemAdminSession() || !visible || document.hidden || settings.mode === "off" || root.classList.contains("has-no-safe-target")) return;
    root.classList.remove("has-no-safe-target");
    sequenceToken += 1;
    clearActivityTimer();
    freezeMovement();
    externalStateUntil = Date.now() + Math.max(700, duration || 2200);
    playRow(rowName, state === "working" || state === "waiting" ? Infinity : 2);
    if (STATE_MESSAGE_KEYS[state]) showBubble(copy(STATE_MESSAGE_KEYS[state]), duration || 2200);
    var token = sequenceToken;
    activityTimer = setTimeout(function () {
      activityTimer = null;
      if (token !== sequenceToken) return;
      externalStateUntil = 0;
      syncRunningState();
    }, Math.max(700, duration || 2200));
  }

  function showBubble(message, duration) {
    if (!bubble || !message) return;
    var moverRect = mover.getBoundingClientRect();
    mover.classList.toggle("has-left-bubble", moverRect.left + moverRect.width / 2 > window.innerWidth / 2);
    bubble.textContent = message;
    bubble.classList.add("is-visible");
    if (bubbleTimer) clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(function () {
      bubble.classList.remove("is-visible");
      bubbleTimer = null;
    }, duration || 2200);
  }

  function scheduleViewportSync() {
    if (!root || layoutFrameRequest != null) return;
    root.classList.add("is-revalidating");
    layoutFrameRequest = window.requestAnimationFrame(syncViewportLayout);
  }

  function syncViewportLayout() {
    layoutFrameRequest = null;
    if (!visible) {
      root.classList.remove("is-revalidating");
      return;
    }
    freezeMovement();
    var size = petSize();
    position.x = Math.max(8, Math.min(position.x, window.innerWidth - size.width - 8));
    position.y = Math.max(46, Math.min(position.y, window.innerHeight - size.height - 8));
    var next = mover.animate([
      { transform: transformFor(position) },
      { transform: transformFor(position) }
    ], { duration: 1, fill: "forwards" });
    var previous = movementAnimation;
    movementAnimation = next;
    if (previous) previous.cancel();
    root.classList.remove("is-revalidating");
    syncRunningState();
  }

  function publicState(state, options) {
    playExternalState(state, options && options.duration);
  }

  function initialize() {
    buildUi();
    parkAtSafeCorner();
    window.DcatsConcierge = Object.freeze({
      setState: publicState,
      setCharacter: selectCharacter,
      setMode: selectMode,
      openSettings: openPanel,
      getSettings: function () { return { character: settings.character, mode: settings.mode }; }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
})();
