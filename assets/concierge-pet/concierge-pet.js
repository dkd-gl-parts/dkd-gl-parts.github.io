(function () {
  "use strict";

  var STORAGE_KEY_PREFIX = "dcats_concierge_pet_v1:";
  var EXCLUDED_SCREENS = { boot: true, login: true, forgot: true, reset: true };
  var PETS = {
    suzuto: { copyKey: "suzuto", className: "is-suzuto", travelRows: { right: "running-right", left: "running-left" } },
    rinna: { copyKey: "rinna", className: "is-rinna", travelRows: { right: "running-right", left: "running-left" } }
  };
  var TRAVEL_TURN_DELAY = 220;
  var GAZE_MIN_DISTANCE = 112;
  var GAZE_DISTANCE_RATIO = .82;
  // Visible-height ratios keep the approved gaze art aligned to the idle baseline; cap at 1.15 to avoid cell-edge clipping.
  var GAZE_FRAME_SCALES = {
    suzuto: [1.005, 1.005, 1.005, 1, 1, 1.01, 1.015, 1.048, 1.026, 1.021, 1.015, 1.015, 1.015, 1.015, 1.015, 1.01],
    rinna: [1.005, 1, 1.005, 1.026, 1.053, 1.106, 1.15, 1.15, 1.138, 1.131, 1.131, 1.125, 1.125, 1.138, 1.138, 1.138]
  };
  var MODES = { active: true, horizontal: true, vertical: true, fixed: true, off: true };
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
  var STOP_GESTURE_ORDER = ["settle", "bow", "escort", "handshake", "shy", "welcome"];
  var STOP_GESTURES = {
    settle: { column: 0, enter: 180, hold: 620, exit: 260 },
    bow: { column: 1, enter: 260, hold: 850, exit: 320 },
    escort: { column: 2, enter: 260, hold: 1000, exit: 300 },
    handshake: { column: 3, enter: 260, hold: 1100, exit: 320 },
    shy: { column: 4, enter: 300, hold: 1000, exit: 350 },
    welcome: { column: 5, enter: 260, hold: 950, exit: 320 }
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
      modeHorizontal: "横移動だけ",
      modeVertical: "縦移動だけ",
      modeFixed: "定位置",
      modeOff: "非表示",
      help: "選択した1体だけを読み込みます。「よく動く」は操作部品を避けて自由に歩き、「横移動だけ」「縦移動だけ」は指定した一方向に歩きます。「定位置」は画面右下で反応だけを表示します。OSの「視差効果を減らす」が有効な場合も静止します。",
      openSettings: "{name}の設定を開く",
      launcherOff: "コンシェルジュを表示",
      switched: "{name}に切り替えました。",
      activeMessage: "元気にご案内します。",
      horizontalMessage: "横方向に歩いてご案内します。",
      verticalMessage: "縦方向に歩いてご案内します。",
      fixedMessage: "画面の隅で待機します。",
      floatingLegend: "画面外表示",
      floatingOpen: "常に前面の小窓で表示",
      floatingReturn: "D-CATS画面に戻す",
      floatingHelp: "D-CATSを開いている間、常に前面で表示します。小窓は好きな場所へ移動できます。",
      floatingCost: "追加料金：0円（ブラウザ標準機能）",
      floatingUnsupported: "このブラウザはフローティング表示に対応していません。",
      floatingOpening: "フローティングウィンドウを開いています。",
      floatingActive: "常に前面の小窓で表示中です。",
      floatingFailed: "フローティングウィンドウを開けませんでした。ブラウザの設定を確認してください。",
      bridgeLegend: "Windows業務連携（管理者テスト）",
      bridgeCheck: "Windows連携を確認",
      bridgeHelp: "連携キューの確認と、受信フォルダー内CSVの事前検査・待機準備だけを行います。販売王やD-CATS本番データは変更しません。",
      bridgeInboxHelp: "CSVをWindows受信フォルダーへ置き、ファイル名だけを入力してください。フォルダー：%LOCALAPPDATA%\\D-CATS\\HanbaiOhBridge\\inbox",
      bridgeSalesFile: "売上CSVファイル名",
      bridgeCustomerFile: "得意先CSVファイル名",
      bridgePrepareSales: "売上CSVを検査して待機",
      bridgeStageTestSales: "テスト会社用CSVを準備",
      bridgePrepareCustomer: "得意先CSVを検査して確認待ち",
      bridgeCost: "追加料金：0円（D-CATS・Windows連携機能）",
      bridgeIdle: "未確認です。",
      bridgeWorking: "Windows連携を確認しています。",
      bridgeSalesWorking: "売上CSVを検査しています。元ファイルは変更しません。",
      bridgeTestSalesWorking: "テスト会社専用データを確認し、販売王用CSVを準備しています。",
      bridgeCustomerWorking: "得意先CSVを検査しています。元ファイルは変更しません。",
      bridgeSuccess: "接続できました。連携キューは{count}件です。",
      bridgeSalesPrepared: "売上CSVを{rows}行・{slips}伝票・警告{warnings}件で待機キューへ準備しました。",
      bridgeTestSalesStaged: "{company}専用CSV「{file}」を取込待ちへ準備しました。販売王への取込は会社名を確認して手動で行ってください。",
      bridgeTestSalesExisting: "同じテスト会社用CSVは準備済みです。「{file}」を使用してください。販売王への取込は会社名を確認して手動で行ってください。",
      bridgeCustomerPrepared: "得意先CSVを{rows}行・{customers}得意先・警告{warnings}件で確認待ちに準備しました。",
      bridgePreparedExisting: "同じCSVは準備済みです。既存の待機データを使用します。",
      bridgeInvalidFileName: "受信フォルダー内のCSVファイル名だけを入力してください。",
      bridgeFileMissing: "受信フォルダーにCSVが見つかりません。ファイル名と保存場所を確認してください。",
      bridgeValidationFailed: "CSVの事前検査で修正箇所が見つかりました：{detail}",
      bridgeUnavailable: "Windows連携を起動できません。拡張機能と連携アプリを確認してください。",
      bridgeTimeout: "Windows連携から応答がありませんでした。もう一度確認してください。",
      bridgeForbidden: "システム管理者として再ログインしてから確認してください。",
      bridgeFailed: "Windows連携を確認できませんでした。時間をおいてもう一度お試しください。"
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
      modeHorizontal: "Horizontal only",
      modeVertical: "Vertical only",
      modeFixed: "Stay put",
      modeOff: "Hide",
      help: "Only the selected concierge is loaded. Active mode walks freely while avoiding controls. Horizontal only and Vertical only restrict walking to one direction. Stay put keeps the concierge in the lower-right corner for reactions only. Motion also stops when your OS requests reduced motion.",
      openSettings: "Open {name}'s settings",
      launcherOff: "Show concierge",
      switched: "Switched to {name}.",
      activeMessage: "I will guide you actively.",
      horizontalMessage: "I will move horizontally.",
      verticalMessage: "I will move vertically.",
      fixedMessage: "I will wait in the corner.",
      floatingLegend: "Floating display",
      floatingOpen: "Show in an always-on-top window",
      floatingReturn: "Return to the D-CATS window",
      floatingHelp: "The concierge stays on top while D-CATS is open. Move the small window anywhere you like.",
      floatingCost: "Additional charge: \u00a50 (browser feature)",
      floatingUnsupported: "This browser does not support floating display.",
      floatingOpening: "Opening the floating window.",
      floatingActive: "Showing in an always-on-top window.",
      floatingFailed: "The floating window could not be opened. Check your browser settings.",
      bridgeLegend: "Windows integration (admin pilot)",
      bridgeCheck: "Check Windows integration",
      bridgeHelp: "Checks the queue and only validates CSV files in the Windows inbox for local staging. It does not change Sales King or D-CATS production data.",
      bridgeInboxHelp: "Place the CSV in the Windows inbox and enter only its file name. Folder: %LOCALAPPDATA%\\D-CATS\\HanbaiOhBridge\\inbox",
      bridgeSalesFile: "Sales CSV file name",
      bridgeCustomerFile: "Customer CSV file name",
      bridgePrepareSales: "Validate and stage sales CSV",
      bridgeStageTestSales: "Prepare test-company CSV",
      bridgePrepareCustomer: "Validate customer CSV for review",
      bridgeCost: "Additional charge: \u00a50 (D-CATS Windows integration)",
      bridgeIdle: "Not checked yet.",
      bridgeWorking: "Checking Windows integration.",
      bridgeSalesWorking: "Validating the sales CSV without changing the source file.",
      bridgeTestSalesWorking: "Checking test-only data and preparing a Sales King CSV.",
      bridgeCustomerWorking: "Validating the customer CSV without changing the source file.",
      bridgeSuccess: "Connected. The integration queue contains {count} items.",
      bridgeSalesPrepared: "Staged {rows} sales rows across {slips} slips with {warnings} warnings.",
      bridgeTestSalesStaged: "Prepared test-company CSV “{file}” for {company}. Confirm the company name and import it into Sales King manually.",
      bridgeTestSalesExisting: "The same test-company CSV is already ready. Use “{file}” and confirm the company name before manually importing it into Sales King.",
      bridgeCustomerPrepared: "Staged {rows} rows for {customers} customers with {warnings} warnings for review.",
      bridgePreparedExisting: "This CSV is already staged. The existing queued item will be used.",
      bridgeInvalidFileName: "Enter only a CSV file name from the Windows inbox.",
      bridgeFileMissing: "The CSV was not found in the Windows inbox. Check its file name and location.",
      bridgeValidationFailed: "The CSV preflight found an item to fix: {detail}",
      bridgeUnavailable: "Windows integration could not start. Check the extension and integration app.",
      bridgeTimeout: "Windows integration did not respond. Please try again.",
      bridgeForbidden: "Sign in again as a system administrator and retry.",
      bridgeFailed: "Windows integration could not be checked. Please try again later."
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
      modeHorizontal: "仅横向移动",
      modeVertical: "仅纵向移动",
      modeFixed: "固定位置",
      modeOff: "隐藏",
      help: "仅加载所选的一位礼宾助手。“活跃移动”会避开操作控件自由行走；“仅横向移动”和“仅纵向移动”会限制为一个方向。“固定位置”只在右下角作出反应。操作系统启用减少动态效果时也会停止移动。",
      openSettings: "打开{name}的设置",
      launcherOff: "显示礼宾助手",
      switched: "已切换为{name}。",
      activeMessage: "我会积极为您引导。",
      horizontalMessage: "我会横向移动为您引导。",
      verticalMessage: "我会纵向移动为您引导。",
      fixedMessage: "我会在画面角落等候。",
      floatingLegend: "屏幕外显示",
      floatingOpen: "在置顶小窗中显示",
      floatingReturn: "返回D-CATS画面",
      floatingHelp: "D-CATS保持打开期间，小窗会始终置顶显示。您可以将小窗移动到喜欢的位置。",
      floatingCost: "额外费用：0日元（浏览器标准功能）",
      floatingUnsupported: "当前浏览器不支持悬浮显示。",
      floatingOpening: "正在打开悬浮窗口。",
      floatingActive: "正在置顶小窗中显示。",
      floatingFailed: "无法打开悬浮窗口。请确认浏览器设置。",
      bridgeLegend: "Windows业务联动（管理员测试）",
      bridgeCheck: "检查Windows联动",
      bridgeHelp: "仅检查联动队列，并预检Windows收件文件夹中的CSV后在本机暂存。不会更改销售王或D-CATS生产数据。",
      bridgeInboxHelp: "请将CSV放入Windows收件文件夹，并只输入文件名。文件夹：%LOCALAPPDATA%\\D-CATS\\HanbaiOhBridge\\inbox",
      bridgeSalesFile: "销售CSV文件名",
      bridgeCustomerFile: "客户CSV文件名",
      bridgePrepareSales: "检查销售CSV并等待",
      bridgeStageTestSales: "准备测试公司专用CSV",
      bridgePrepareCustomer: "检查客户CSV并等待确认",
      bridgeCost: "额外费用：0日元（D-CATS Windows联动功能）",
      bridgeIdle: "尚未检查。",
      bridgeWorking: "正在检查Windows联动。",
      bridgeSalesWorking: "正在检查销售CSV，不会更改原文件。",
      bridgeTestSalesWorking: "正在确认测试专用数据并准备销售王CSV。",
      bridgeCustomerWorking: "正在检查客户CSV，不会更改原文件。",
      bridgeSuccess: "连接成功。联动队列中有{count}项。",
      bridgeSalesPrepared: "已将{rows}行、{slips}张单据的销售CSV加入等待队列，警告{warnings}项。",
      bridgeTestSalesStaged: "已为{company}准备测试公司专用CSV“{file}”。请确认公司名称后手动导入销售王。",
      bridgeTestSalesExisting: "相同的测试公司专用CSV已准备完成，请使用“{file}”。确认公司名称后再手动导入销售王。",
      bridgeCustomerPrepared: "已将{rows}行、{customers}个客户的CSV加入确认等待，警告{warnings}项。",
      bridgePreparedExisting: "相同CSV已准备完成，将使用现有等待数据。",
      bridgeInvalidFileName: "请只输入Windows收件文件夹中的CSV文件名。",
      bridgeFileMissing: "Windows收件文件夹中未找到CSV，请检查文件名和保存位置。",
      bridgeValidationFailed: "CSV预检发现需要修正的项目：{detail}",
      bridgeUnavailable: "无法启动Windows联动。请检查扩展程序和联动应用。",
      bridgeTimeout: "Windows联动没有响应，请重试。",
      bridgeForbidden: "请以系统管理员身份重新登录后再试。",
      bridgeFailed: "无法检查Windows联动，请稍后重试。"
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
  var panelBody;
  var panelClose;
  var floatingButton;
  var floatingStatus;
  var bridgeCard;
  var bridgeButton;
  var bridgeSalesFileInput;
  var bridgeCustomerFileInput;
  var bridgeSalesButton;
  var bridgeTestSalesButton;
  var bridgeCustomerButton;
  var bridgeStatus;
  var conciergeHelp;
  var characterButtons = [];
  var modeButtons = [];
  var movementAnimation = null;
  var spriteAnimation = null;
  var sequenceToken = 0;
  var activityTimer = null;
  var bubbleTimer = null;
  var pointerFrameRequest = null;
  var layoutFrameRequest = null;
  var layoutFrameWindow = null;
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
  var floatingWindow = null;
  var floatingRequestPending = false;
  var bridgeRequestPending = false;
  var bridgeRequestToken = 0;
  var bridgeStatusState = { key: "bridgeIdle", values: null };
  var externalStateUntil = 0;
  var lastInteractionAt = 0;
  var stopGestureIndex = 0;
  var dragState = null;
  var suppressHitTargetClickUntil = 0;

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
      if (saved && MODES[saved.mode]) value.mode = saved.mode;
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
    launcher.setAttribute("aria-controls", "dcats-concierge-panel");
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

    panelBody = createElement("div", "dcats-concierge-panel-body");
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
      createChoice("modeHorizontal", "horizontal", "mode"),
      createChoice("modeVertical", "vertical", "mode"),
      createChoice("modeFixed", "fixed", "mode"),
      createChoice("modeOff", "off", "mode")
    ];
    modeButtons.forEach(function (button) { modeGrid.appendChild(button); });
    modeField.appendChild(modeGrid);

    var floatingCard = createElement("section", "dcats-concierge-floating-card");
    floatingCard.setAttribute("aria-labelledby", "dcats-concierge-floating-title");
    var floatingTitle = createCopyElement("h3", "dcats-concierge-floating-title", "floatingLegend");
    floatingTitle.id = "dcats-concierge-floating-title";
    floatingButton = createElement("button", "dcats-concierge-floating-button");
    floatingButton.type = "button";
    floatingButton.setAttribute("aria-describedby", "dcats-concierge-floating-help dcats-concierge-floating-cost dcats-concierge-floating-status");
    var floatingHelp = createCopyElement("p", "dcats-concierge-floating-help", "floatingHelp");
    floatingHelp.id = "dcats-concierge-floating-help";
    var floatingCost = createCopyElement("p", "dcats-concierge-floating-cost", "floatingCost");
    floatingCost.id = "dcats-concierge-floating-cost";
    floatingStatus = createElement("p", "dcats-concierge-floating-status");
    floatingStatus.id = "dcats-concierge-floating-status";
    floatingStatus.setAttribute("role", "status");
    floatingStatus.setAttribute("aria-live", "polite");
    floatingCard.appendChild(floatingTitle);
    floatingCard.appendChild(floatingButton);
    floatingCard.appendChild(floatingHelp);
    floatingCard.appendChild(floatingCost);
    floatingCard.appendChild(floatingStatus);

    bridgeCard = createElement("section", "dcats-concierge-bridge-card");
    bridgeCard.setAttribute("aria-labelledby", "dcats-concierge-bridge-title");
    var bridgeTitle = createCopyElement("h3", "dcats-concierge-bridge-title", "bridgeLegend");
    bridgeTitle.id = "dcats-concierge-bridge-title";
    bridgeButton = createCopyElement("button", "dcats-concierge-bridge-button", "bridgeCheck");
    bridgeButton.type = "button";
    bridgeButton.setAttribute("aria-describedby", "dcats-concierge-bridge-help dcats-concierge-bridge-cost dcats-concierge-bridge-status");
    var bridgeHelp = createCopyElement("p", "dcats-concierge-bridge-help", "bridgeHelp");
    bridgeHelp.id = "dcats-concierge-bridge-help";
    var bridgeInboxHelp = createCopyElement("p", "dcats-concierge-bridge-inbox-help", "bridgeInboxHelp");
    bridgeInboxHelp.id = "dcats-concierge-bridge-inbox-help";
    var bridgeActions = createElement("div", "dcats-concierge-bridge-actions");
    var bridgeSalesAction = createElement("div", "dcats-concierge-bridge-action");
    var bridgeSalesLabel = createCopyElement("label", "dcats-concierge-bridge-label", "bridgeSalesFile");
    bridgeSalesLabel.setAttribute("for", "dcats-concierge-bridge-sales-file");
    bridgeSalesFileInput = createElement("input", "dcats-concierge-bridge-input");
    bridgeSalesFileInput.id = "dcats-concierge-bridge-sales-file";
    bridgeSalesFileInput.type = "text";
    bridgeSalesFileInput.value = "sales.csv";
    bridgeSalesFileInput.setAttribute("autocomplete", "off");
    bridgeSalesFileInput.setAttribute("spellcheck", "false");
    bridgeSalesButton = createCopyElement("button", "dcats-concierge-bridge-button is-secondary", "bridgePrepareSales");
    bridgeSalesButton.type = "button";
    bridgeTestSalesButton = createCopyElement("button", "dcats-concierge-bridge-button is-secondary", "bridgeStageTestSales");
    bridgeTestSalesButton.type = "button";
    bridgeSalesAction.appendChild(bridgeSalesLabel);
    bridgeSalesAction.appendChild(bridgeSalesFileInput);
    bridgeSalesAction.appendChild(bridgeSalesButton);
    bridgeSalesAction.appendChild(bridgeTestSalesButton);
    var bridgeCustomerAction = createElement("div", "dcats-concierge-bridge-action");
    var bridgeCustomerLabel = createCopyElement("label", "dcats-concierge-bridge-label", "bridgeCustomerFile");
    bridgeCustomerLabel.setAttribute("for", "dcats-concierge-bridge-customer-file");
    bridgeCustomerFileInput = createElement("input", "dcats-concierge-bridge-input");
    bridgeCustomerFileInput.id = "dcats-concierge-bridge-customer-file";
    bridgeCustomerFileInput.type = "text";
    bridgeCustomerFileInput.value = "customers.csv";
    bridgeCustomerFileInput.setAttribute("autocomplete", "off");
    bridgeCustomerFileInput.setAttribute("spellcheck", "false");
    bridgeCustomerButton = createCopyElement("button", "dcats-concierge-bridge-button is-secondary", "bridgePrepareCustomer");
    bridgeCustomerButton.type = "button";
    bridgeCustomerAction.appendChild(bridgeCustomerLabel);
    bridgeCustomerAction.appendChild(bridgeCustomerFileInput);
    bridgeCustomerAction.appendChild(bridgeCustomerButton);
    bridgeActions.appendChild(bridgeSalesAction);
    bridgeActions.appendChild(bridgeCustomerAction);
    var bridgeCost = createCopyElement("p", "dcats-concierge-bridge-cost", "bridgeCost");
    bridgeCost.id = "dcats-concierge-bridge-cost";
    bridgeStatus = createElement("p", "dcats-concierge-bridge-status");
    bridgeStatus.id = "dcats-concierge-bridge-status";
    bridgeStatus.setAttribute("role", "status");
    bridgeStatus.setAttribute("aria-live", "polite");
    bridgeCard.appendChild(bridgeTitle);
    bridgeCard.appendChild(bridgeButton);
    bridgeCard.appendChild(bridgeHelp);
    bridgeCard.appendChild(bridgeInboxHelp);
    bridgeCard.appendChild(bridgeActions);
    bridgeCard.appendChild(bridgeCost);
    bridgeCard.appendChild(bridgeStatus);

    panelBody.appendChild(characterField);
    panelBody.appendChild(modeField);
    panelBody.appendChild(floatingCard);
    conciergeHelp = createCopyElement("p", "dcats-concierge-help", "help");
    panelBody.appendChild(conciergeHelp);
    panel.appendChild(panelHead);
    panel.appendChild(panelBody);

    root.appendChild(mover);
    root.appendChild(launcher);
    root.appendChild(panel);
    document.body.appendChild(root);

    hitTarget.addEventListener("click", function () {
      if (Date.now() < suppressHitTargetClickUntil) return;
      showBubble(copy(STATE_MESSAGE_KEYS.greeting), 2400);
      playExternalState("greeting", 1200);
      openPanel();
    });
    hitTarget.addEventListener("pointerdown", onDragPointerDown);
    hitTarget.addEventListener("lostpointercapture", onDragPointerEnd);
    bindDragSurface(document);
    launcher.addEventListener("click", function () { panelOpen ? closePanel() : openPanel(); });
    panelClose.addEventListener("click", closePanel);
    characterButtons.forEach(function (button) {
      button.addEventListener("click", function () { selectCharacter(button.dataset.value); });
    });
    modeButtons.forEach(function (button) {
      button.addEventListener("click", function () { selectMode(button.dataset.value); });
    });
    floatingButton.addEventListener("click", toggleFloatingWindow);
    bridgeButton.addEventListener("click", checkWindowsBridge);
    bridgeSalesButton.addEventListener("click", function () {
      prepareWindowsBridgeCsv("prepare_sales_import", bridgeSalesFileInput && bridgeSalesFileInput.value);
    });
    bridgeTestSalesButton.addEventListener("click", function () {
      prepareWindowsBridgeCsv("stage_test_company_sales_import", bridgeSalesFileInput && bridgeSalesFileInput.value);
    });
    bridgeCustomerButton.addEventListener("click", function () {
      prepareWindowsBridgeCsv("prepare_customer_import", bridgeCustomerFileInput && bridgeCustomerFileInput.value);
    });
    document.addEventListener("keydown", onPresentationKeyDown);
    document.addEventListener("pointerdown", onPresentationPointerDown, { passive: true });
    document.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("click", onAppInteraction, true);
    window.addEventListener("dcats:concierge-state", onConciergeState);
    document.addEventListener("visibilitychange", syncRunningState);
    window.addEventListener("resize", scheduleViewportSync, { passive: true });
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
    updateFloatingControls();
    updateBridgeStatus();
    observeScreens();
    syncVisibility();
  }

  function onPresentationKeyDown(event) {
    if (event.key === "Escape" && panelOpen) closePanel();
  }

  function onPresentationPointerDown(event) {
    if (!panelOpen || panel.contains(event.target) || launcher.contains(event.target) || hitTarget.contains(event.target)) return;
    closePanel();
  }

  function supportsFloatingWindow() {
    return !!(window.documentPictureInPicture && typeof window.documentPictureInPicture.requestWindow === "function");
  }

  function isFloatingWindowOpen() {
    return !!(floatingWindow && !floatingWindow.closed);
  }

  function viewportWindow() {
    return isFloatingWindowOpen() ? floatingWindow : window;
  }

  function presentationDocument() {
    return isFloatingWindowOpen() ? floatingWindow.document : document;
  }

  function isPresentationHidden() {
    var activeDocument = presentationDocument();
    return !!(activeDocument && activeDocument.hidden);
  }

  function updateFloatingControls(statusKey) {
    if (!floatingButton || !floatingStatus) return;
    var supported = supportsFloatingWindow();
    var floating = isFloatingWindowOpen();
    floatingButton.disabled = floatingRequestPending || !supported;
    floatingButton.textContent = copy(floating ? "floatingReturn" : "floatingOpen");
    floatingButton.setAttribute("aria-pressed", String(floating));
    var resolvedStatusKey = statusKey || (floating ? "floatingActive" : (!supported ? "floatingUnsupported" : ""));
    floatingStatus.textContent = resolvedStatusKey ? copy(resolvedStatusKey) : "";
    floatingStatus.hidden = !resolvedStatusKey;
  }

  function updateBridgeStatus() {
    if (!bridgeButton || !bridgeStatus) return;
    bridgeButton.disabled = bridgeRequestPending;
    if (bridgeSalesButton) bridgeSalesButton.disabled = bridgeRequestPending;
    if (bridgeTestSalesButton) bridgeTestSalesButton.disabled = bridgeRequestPending;
    if (bridgeCustomerButton) bridgeCustomerButton.disabled = bridgeRequestPending;
    if (bridgeSalesFileInput) bridgeSalesFileInput.disabled = bridgeRequestPending;
    if (bridgeCustomerFileInput) bridgeCustomerFileInput.disabled = bridgeRequestPending;
    bridgeStatus.textContent = copy(bridgeStatusState.key, bridgeStatusState.values || {});
    bridgeStatus.classList.toggle("is-success", ["bridgeSuccess", "bridgeSalesPrepared", "bridgeTestSalesStaged", "bridgeTestSalesExisting", "bridgeCustomerPrepared", "bridgePreparedExisting"].indexOf(bridgeStatusState.key) >= 0);
    bridgeStatus.classList.toggle("is-error", ["bridgeInvalidFileName", "bridgeFileMissing", "bridgeValidationFailed", "bridgeUnavailable", "bridgeTimeout", "bridgeForbidden", "bridgeFailed"].indexOf(bridgeStatusState.key) >= 0);
  }

  function setBridgeStatus(key, values) {
    bridgeStatusState = { key: key, values: values || null };
    updateBridgeStatus();
  }

  function syncBridgeControls(systemAdmin) {
    if (!bridgeCard || !panelBody || !conciergeHelp) return;
    if (systemAdmin) {
      if (!bridgeCard.parentElement) panelBody.insertBefore(bridgeCard, conciergeHelp);
      updateBridgeStatus();
      return;
    }
    bridgeRequestToken += 1;
    bridgeRequestPending = false;
    bridgeStatusState = { key: "bridgeIdle", values: null };
    if (bridgeSalesFileInput) bridgeSalesFileInput.value = "sales.csv";
    if (bridgeCustomerFileInput) bridgeCustomerFileInput.value = "customers.csv";
    if (bridgeCard.parentElement) bridgeCard.parentElement.removeChild(bridgeCard);
  }

  function bridgeRequestId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") return window.crypto.randomUUID();
    if (!window.crypto || typeof window.crypto.getRandomValues !== "function") throw new Error("secure_random_unavailable");
    var values = new Uint32Array(4);
    window.crypto.getRandomValues(values);
    return Array.prototype.map.call(values, function (value) { return value.toString(16).padStart(8, "0"); }).join("-");
  }

  function bridgeResponse(request) {
    return new Promise(function (resolve, reject) {
      var settled = false;
      var timeout = window.setTimeout(function () {
        if (settled) return;
        settled = true;
        window.removeEventListener("message", onMessage);
        var error = new Error("bridge_timeout");
        error.code = "BRIDGE_TIMEOUT";
        reject(error);
      }, 10000);
      function onMessage(event) {
        if (event.source !== window || event.origin !== window.location.origin) return;
        var message = event.data;
        if (!message || message.channel !== "dcats-hanbaioh25-bridge-v1" || message.type !== "response") return;
        if (!message.response || message.response.id !== request.id) return;
        settled = true;
        window.clearTimeout(timeout);
        window.removeEventListener("message", onMessage);
        resolve(message.response);
      }
      window.addEventListener("message", onMessage);
      window.postMessage({ channel: "dcats-hanbaioh25-bridge-v1", type: "request", request: request }, window.location.origin);
    });
  }

  function bridgeFailureStatus(error) {
    var code = String(error && error.code || "");
    var message = String(error && error.message || "");
    var status = Number(error && error.context && error.context.status || error && error.status || 0);
    if (status === 401 || status === 403 || /system_admin|required|forbidden/i.test(message)) return { key: "bridgeForbidden" };
    if (code === "BRIDGE_TIMEOUT") return { key: "bridgeTimeout" };
    if (["EXTENSION_UNAVAILABLE", "NATIVE_HOST_UNAVAILABLE"].indexOf(code) >= 0) return { key: "bridgeUnavailable" };
    if (code === "CSV_VALIDATION_FAILED") {
      var errors = error && error.validation && Array.isArray(error.validation.errors) ? error.validation.errors : [];
      var detail = errors[0] && errors[0].message ? String(errors[0].message) : copy("bridgeFailed");
      return { key: "bridgeValidationFailed", values: { detail: detail } };
    }
    if (/ENOENT|no such file|cannot find|見つかりません/i.test(message)) return { key: "bridgeFileMissing" };
    return { key: "bridgeFailed" };
  }

  async function runWindowsBridgeRequest(command, args, workingKey) {
    if (!isSystemAdminSession() || bridgeRequestPending) return;
    var bridgeApi = window.DcatsBridgeApi;
    if (!bridgeApi || typeof bridgeApi.issueCapability !== "function") {
      setBridgeStatus("bridgeFailed");
      playExternalState("failed", 2600);
      return;
    }

    var token = ++bridgeRequestToken;
    bridgeRequestPending = true;
    setBridgeStatus(workingKey);
    playExternalState("working", 10000);
    try {
      var request = { id: bridgeRequestId(), command: command };
      if (args) request.args = args;
      var issued = await bridgeApi.issueCapability(request);
      if (issued && issued.error) throw issued.error;
      if (!issued || !issued.data || issued.data.ok !== true || typeof issued.data.capability !== "string") {
        throw new Error("invalid_capability_response");
      }
      request.capability = issued.data.capability;
      var response = await bridgeResponse(request);
      if (!response || response.ok !== true) {
        var responseError = new Error(response && response.error && response.error.message || "bridge_request_failed");
        responseError.code = response && response.error && response.error.code || "BRIDGE_REQUEST_FAILED";
        responseError.validation = response && response.error && response.error.validation;
        throw responseError;
      }
      if (token !== bridgeRequestToken || !isSystemAdminSession()) return;
      var statusKey;
      var statusValues;
      if (command === "stage_test_company_sales_import") {
        var stage = response.data && response.data.stage || {};
        statusKey = response.data && response.data.reused === true ? "bridgeTestSalesExisting" : "bridgeTestSalesStaged";
        statusValues = { file: String(stage.fileName || ""), company: String(stage.testCompanyName || "") };
      } else if (command === "get_hanbaioh_queue_status") {
        var jobs = response.data && Array.isArray(response.data.jobs) ? response.data.jobs : [];
        var counts = response.data && response.data.counts && typeof response.data.counts === "object" ? response.data.counts : null;
        var jobCount = counts ? Object.keys(counts).reduce(function (total, key) {
          var value = Number(counts[key]);
          return total + (Number.isFinite(value) && value > 0 ? Math.floor(value) : 0);
        }, 0) : jobs.length;
        statusKey = "bridgeSuccess";
        statusValues = { count: jobCount };
      } else if (response.data && response.data.reused === true) {
        statusKey = "bridgePreparedExisting";
        statusValues = {};
      } else {
        var validation = response.data && response.data.validation || {};
        var summary = validation.summary || {};
        statusKey = command === "prepare_sales_import" ? "bridgeSalesPrepared" : "bridgeCustomerPrepared";
        statusValues = command === "prepare_sales_import"
          ? { rows: Number(summary.rowCount || 0), slips: Number(summary.slipCount || 0), warnings: Array.isArray(validation.warnings) ? validation.warnings.length : 0 }
          : { rows: Number(summary.rowCount || 0), customers: Number(summary.uniqueCustomerCount || 0), warnings: Array.isArray(validation.warnings) ? validation.warnings.length : 0 };
      }
      setBridgeStatus(statusKey, statusValues);
      showBubble(copy(statusKey, statusValues), 4200);
      playExternalState("success", 2200);
    } catch (error) {
      if (token !== bridgeRequestToken || !isSystemAdminSession()) return;
      var failure = bridgeFailureStatus(error);
      setBridgeStatus(failure.key, failure.values);
      showBubble(copy(failure.key, failure.values || {}), 4200);
      playExternalState("failed", 2600);
    } finally {
      if (token === bridgeRequestToken) {
        bridgeRequestPending = false;
        updateBridgeStatus();
      }
    }
  }

  function checkWindowsBridge() {
    return runWindowsBridgeRequest("get_hanbaioh_queue_status", null, "bridgeWorking");
  }

  function prepareWindowsBridgeCsv(command, value) {
    var fileName = String(value || "").trim();
    if (!fileName || fileName.length > 200 || /[\\/:]/.test(fileName) || !/\.csv$/i.test(fileName)) {
      setBridgeStatus("bridgeInvalidFileName");
      showBubble(copy("bridgeInvalidFileName"), 3600);
      playExternalState("failed", 2200);
      return;
    }
    var workingKey = command === "prepare_sales_import" ? "bridgeSalesWorking" : command === "stage_test_company_sales_import" ? "bridgeTestSalesWorking" : "bridgeCustomerWorking";
    return runWindowsBridgeRequest(command, { fileName: fileName }, workingKey);
  }

  async function toggleFloatingWindow() {
    if (!isSystemAdminSession() || floatingRequestPending) return;
    if (isFloatingWindowOpen()) {
      restoreFromFloatingWindow(floatingWindow, true);
      return;
    }
    if (!supportsFloatingWindow()) {
      updateFloatingControls("floatingUnsupported");
      return;
    }

    floatingRequestPending = true;
    updateFloatingControls("floatingOpening");
    try {
      var requestedWindow = await window.documentPictureInPicture.requestWindow({ width: 360, height: 420 });
      if (!isSystemAdminSession()) {
        requestedWindow.close();
        floatingRequestPending = false;
        updateFloatingControls();
        return;
      }

      floatingWindow = requestedWindow;
      configureFloatingDocument(requestedWindow.document);
      requestedWindow.addEventListener("pagehide", function () {
        restoreFromFloatingWindow(requestedWindow, false);
      }, { once: true });
      requestedWindow.addEventListener("resize", scheduleViewportSync, { passive: true });
      requestedWindow.document.addEventListener("keydown", onPresentationKeyDown);
      requestedWindow.document.addEventListener("pointerdown", onPresentationPointerDown, { passive: true });
      requestedWindow.document.addEventListener("pointermove", onPointerMove, { passive: true });
      requestedWindow.document.addEventListener("visibilitychange", syncRunningState);
      bindDragSurface(requestedWindow.document);

      if (panelOpen) closePanel(false);
      undockLauncher();
      root.classList.add("is-floating");
      requestedWindow.document.body.appendChild(root);
      floatingRequestPending = false;
      updateFloatingControls("floatingActive");
      parkAtSafeCorner();
      syncRunningState();
    } catch (error) {
      floatingWindow = null;
      floatingRequestPending = false;
      updateFloatingControls("floatingFailed");
    }
  }

  function configureFloatingDocument(floatingDocument) {
    floatingDocument.title = copy("rootLabel");
    floatingDocument.documentElement.lang = document.documentElement.lang || "ja";
    floatingDocument.documentElement.classList.add("dcats-concierge-floating-document");
    floatingDocument.body.classList.add("dcats-concierge-floating-body");

    var viewport = floatingDocument.createElement("meta");
    viewport.setAttribute("name", "viewport");
    viewport.setAttribute("content", "width=device-width, initial-scale=1.0");
    floatingDocument.head.appendChild(viewport);

    var sourceStylesheet = document.querySelector('link[href*="assets/concierge-pet/concierge-pet.css"]');
    var stylesheet = floatingDocument.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = sourceStylesheet && sourceStylesheet.href
      ? sourceStylesheet.href
      : new URL("assets/concierge-pet/concierge-pet.css", document.baseURI).href;
    stylesheet.addEventListener("load", scheduleViewportSync, { once: true });
    floatingDocument.head.appendChild(stylesheet);
  }

  function restoreFromFloatingWindow(targetWindow, closeWindow) {
    if (!targetWindow || floatingWindow !== targetWindow) return;
    cancelLayoutFrame();
    floatingWindow = null;
    floatingRequestPending = false;
    if (root.ownerDocument !== document) document.body.appendChild(root);
    root.classList.remove("is-floating");
    dockLauncher();
    updateFloatingControls();
    if (closeWindow && !targetWindow.closed) targetWindow.close();
    if (visible) {
      parkAtSafeCorner();
      syncRunningState();
    }
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

  function undockLauncher() {
    if (!launcher || !root) return;
    launcher.classList.remove("is-header-docked");
    if (launcher.parentNode !== root) root.appendChild(launcher);
  }

  function dockLauncher() {
    if (!launcher || isFloatingWindowOpen()) return;
    var activeScreen = document.querySelector(".screen.active");
    var dock = activeScreen && typeof activeScreen.querySelector === "function"
      ? activeScreen.querySelector(".page-header-right")
      : null;
    if (!dock) {
      undockLauncher();
      return;
    }
    launcher.classList.add("is-header-docked");
    if (launcher.parentNode !== dock) dock.insertBefore(launcher, dock.firstChild);
  }

  function syncVisibility() {
    syncSettingsOwner();
    var screen = activeScreenName();
    var dedicatedPrintStation = new URLSearchParams(window.location.search).has("dcats_print_station");
    var systemAdmin = isSystemAdminSession();
    visible = systemAdmin && !!screen && !EXCLUDED_SCREENS[screen] && !dedicatedPrintStation;
    syncBridgeControls(systemAdmin && visible);
    if (isFloatingWindowOpen() && (!systemAdmin || EXCLUDED_SCREENS[screen] || dedicatedPrintStation)) {
      restoreFromFloatingWindow(floatingWindow, true);
    }
    if (!systemAdmin && panelOpen) {
      panelOpen = false;
      panel.hidden = true;
      launcher.setAttribute("aria-expanded", "false");
      panelReturnFocus = null;
    }
    if (!isFloatingWindowOpen()) dockLauncher();
    root.hidden = !visible;
    launcher.hidden = !visible;
    syncRunningState();
  }

  function isReducedMotion() {
    return !!(reduceMotionQuery && reduceMotionQuery.matches);
  }

  function refreshCopy() {
    if (!root) return;
    root.setAttribute("aria-label", copy("rootLabel"));
    panelClose.setAttribute("aria-label", copy("closeSettings"));
    if (isFloatingWindowOpen()) {
      floatingWindow.document.title = copy("rootLabel");
      floatingWindow.document.documentElement.lang = document.documentElement.lang || "ja";
    }
    root.querySelectorAll("[data-concierge-copy]").forEach(function (element) {
      element.textContent = copy(element.dataset.conciergeCopy);
    });
    applySettings();
    updateFloatingControls();
    updateBridgeStatus();
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
    updateFloatingControls();
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
    if (!MODES[mode]) return;
    settings.mode = mode;
    saveSettings();
    if (mode === "off") {
      stopActivity();
      applySettings();
      closePanel();
      return;
    }
    applySettings();
    var modeMessageKey = {
      active: "activeMessage",
      horizontal: "horizontalMessage",
      vertical: "verticalMessage",
      fixed: "fixedMessage"
    }[mode] || "fixedMessage";
    showBubble(copy(modeMessageKey), 2200);
    closePanel();
    syncRunningState();
  }

  function openPanel() {
    if (!isSystemAdminSession() || panelOpen) return;
    panelReturnFocus = presentationDocument().activeElement;
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
    if (!visible || isPresentationHidden() || settings.mode === "off") {
      clearDragState();
      stopActivity();
      return;
    }
    if (dragState) {
      playRow("idle", Infinity);
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

    playRow("idle", Infinity);
    var settle = 700 + Math.floor(Math.random() * 500);
    if (!(await delay(settle, token))) return;

    var gesture = nextStopGesture();
    playStopGesture(gesture);
    if (!(await delay(stopGestureDuration(gesture) + 100, token))) return;
    playRow("idle", Infinity);
    var rest = 1600 + Math.floor(Math.random() * 1400);
    if (await delay(rest, token)) runActivityLoop(token);
  }

  function canAnimate() {
    return visible && !isPresentationHidden() && settings.mode !== "off" && !panelOpen && !dragState && !isReducedMotion();
  }

  function nextStopGesture() {
    var name = STOP_GESTURE_ORDER[stopGestureIndex % STOP_GESTURE_ORDER.length];
    stopGestureIndex += 1;
    return STOP_GESTURES[name];
  }

  function stopGestureDuration(gesture) {
    return gesture.enter + gesture.hold + gesture.exit;
  }

  function moveTo(target, token) {
    var start = { x: position.x, y: position.y };
    var dx = target.x - start.x;
    var dy = target.y - start.y;
    var distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < 28) return Promise.resolve(true);
    playRow(travelRowFor(dx), Infinity);
    var speed = 118;
    var walkDuration = Math.max(1250, Math.min(5600, distance / speed * 1000));
    var duration = walkDuration + TRAVEL_TURN_DELAY;
    var turnOffset = TRAVEL_TURN_DELAY / duration;
    var next = mover.animate([
      { transform: transformFor(start), offset: 0, easing: "linear" },
      { transform: transformFor(start), offset: turnOffset, easing: "cubic-bezier(.38,.05,.2,1)" },
      { transform: transformFor(target) }
    ], { duration: duration, easing: "linear", fill: "forwards" });
    var previous = movementAnimation;
    movementAnimation = next;
    if (previous) previous.cancel();
    return next.finished.then(function () {
      if (token !== sequenceToken) return false;
      position = target;
      return true;
    }).catch(function () { return false; });
  }

  function travelRowFor(dx) {
    var pet = PETS[settings.character] || PETS.suzuto;
    return dx >= 0 ? pet.travelRows.right : pet.travelRows.left;
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
    var viewport = viewportWindow();
    var target = clampToViewport({
      x: Math.max(10, viewport.innerWidth - size.width - 72),
      y: Math.max(54, viewport.innerHeight - size.height - 74)
    }, size, viewport);
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
    var viewport = viewportWindow();
    return { width: rect.width || (viewport.innerWidth <= 700 ? 88 : 118), height: rect.height || (viewport.innerWidth <= 700 ? 96 : 128) };
  }

  function clampToViewport(target, size, viewport) {
    var maximumX = Math.max(0, viewport.innerWidth - size.width - 8);
    var maximumY = Math.max(0, viewport.innerHeight - size.height - 8);
    var minimumX = Math.min(8, maximumX);
    var minimumY = Math.min(isFloatingWindowOpen() ? 8 : 46, maximumY);
    return {
      x: Math.max(minimumX, Math.min(target.x, maximumX)),
      y: Math.max(minimumY, Math.min(target.y, maximumY))
    };
  }

  function findSafeTarget() {
    var size = petSize();
    var viewport = viewportWindow();
    var width = Math.max(1, viewport.innerWidth - size.width - 18);
    var height = Math.max(1, viewport.innerHeight - size.height - 18);
    var minimumY = isFloatingWindowOpen() ? 8 : (viewport.innerWidth <= 700 ? Math.max(48, height * .42) : 52);
    var rects = collectExclusionRects();
    var horizontalOnly = settings.mode === "horizontal";
    var verticalOnly = settings.mode === "vertical";
    var fixedX = Math.max(10, Math.min(position.x, width - 10));
    var fixedY = Math.max(minimumY, Math.min(position.y, height - 12));
    for (var attempt = 0; attempt < 32; attempt += 1) {
      var x;
      var y;
      x = verticalOnly ? fixedX : 10 + Math.random() * Math.max(1, width - 20);
      y = horizontalOnly ? fixedY : minimumY + Math.random() * Math.max(1, height - minimumY - 12);
      var candidate = { x: x, y: y };
      if (isSafeCandidate(candidate, size, rects)) return candidate;
    }
    var fallbackY = Math.max(minimumY, height - 20);
    var fallbacks = horizontalOnly ? [
      { x: 14, y: fixedY },
      { x: Math.max(14, width - 14), y: fixedY }
    ] : verticalOnly ? [
      { x: fixedX, y: minimumY },
      { x: fixedX, y: fallbackY }
    ] : [
      { x: 14, y: fallbackY },
      { x: Math.max(14, width - 14), y: fallbackY },
      { x: 14, y: minimumY },
      { x: Math.max(14, width - 14), y: minimumY }
    ];
    for (var fallbackIndex = 0; fallbackIndex < fallbacks.length; fallbackIndex += 1) {
      if (isSafeCandidate(fallbacks[fallbackIndex], size, rects)) return fallbacks[fallbackIndex];
    }
    if (isFloatingWindowOpen()) return clampToViewport({ x: 8, y: 8 }, size, viewport);
    return null;
  }

  function collectExclusionRects() {
    var selectors = "button,input,select,textarea,a[href],summary,[role='button'],[role='link'],[role='dialog'],[tabindex]:not([tabindex='-1']),[data-production-index],.sales-order-detail-head,.sales-order-dispatch-summary,.sales-order-waybill-progress,.core-return-mgmt-detail-head,.core-return-mgmt-facts,.core-return-mgmt-section,.core-return-mgmt-history,.form-overlay,.overlay.show,.panel.show,.fullscreen,.toast,.loading-overlay";
    var rects = [];
    if (!isFloatingWindowOpen()) {
      var active = document.querySelector(".screen.active");
      var elements = active ? active.querySelectorAll(selectors) : [];
      for (var i = 0; i < elements.length && rects.length < 260; i += 1) {
        var element = elements[i];
        if (!isElementVisible(element)) continue;
        var rect = element.getBoundingClientRect();
        if (rect.width < 8 || rect.height < 8) continue;
        rects.push({ left: rect.left - 18, top: rect.top - 18, right: rect.right + 18, bottom: rect.bottom + 18 });
      }
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
    var ownerWindow = element.ownerDocument && element.ownerDocument.defaultView;
    var style = (ownerWindow || window).getComputedStyle(element);
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
    if (isReducedMotion()) {
      return showFrame(row.row, 0);
    }
    var visualKey = "row:" + rowName + ":" + String(iterations == null ? 1 : iterations);
    if (currentVisualKey === visualKey && spriteAnimation && spriteAnimation.playState === "running") return spriteAnimation;
    if (spriteAnimation) spriteAnimation.cancel();
    var total = row.durations.reduce(function (sum, duration) { return sum + duration; }, 0);
    var elapsed = 0;
    var frames = [];
    row.durations.forEach(function (duration, column) {
      frames.push({ offset: elapsed / total, backgroundPosition: backgroundPosition(row.row, column, 1), backgroundSize: "800% 1100%", easing: "steps(1, end)" });
      elapsed += duration;
    });
    frames.push({ offset: 1, backgroundPosition: backgroundPosition(row.row, row.durations.length - 1, 1), backgroundSize: "800% 1100%", easing: "steps(1, end)" });
    currentVisualKey = visualKey;
    spriteAnimation = sprite.animate(frames, { duration: total, iterations: iterations == null ? 1 : iterations, fill: "forwards" });
    return spriteAnimation;
  }

  function showFrame(row, column, scale) {
    if (!sprite || typeof sprite.animate !== "function") return null;
    var resolvedScale = Number(scale) > 0 ? Number(scale) : 1;
    var visualKey = "frame:" + row + ":" + column + ":" + resolvedScale;
    if (currentVisualKey === visualKey && spriteAnimation) return spriteAnimation;
    if (spriteAnimation) spriteAnimation.cancel();
    var value = backgroundPosition(row, column, resolvedScale);
    var size = (800 * resolvedScale) + "% " + (1100 * resolvedScale) + "%";
    currentVisualKey = visualKey;
    spriteAnimation = sprite.animate([
      { backgroundPosition: value, backgroundSize: size },
      { backgroundPosition: value, backgroundSize: size }
    ], { duration: 1, fill: "forwards" });
    return spriteAnimation;
  }

  function playStopGesture(gesture) {
    if (!sprite || typeof sprite.animate !== "function") return null;
    if (!gesture || !Number.isInteger(gesture.column)) return playRow("idle", Infinity);
    if (isReducedMotion()) return showFrame(ROWS.idle.row, 0);
    var total = stopGestureDuration(gesture);
    var targetPosition = backgroundPosition(ROWS.review.row, gesture.column, 1);
    var idlePosition = backgroundPosition(ROWS.idle.row, 0, 1);
    var visualKey = "stop:" + gesture.column;
    if (currentVisualKey === visualKey && spriteAnimation && spriteAnimation.playState === "running") return spriteAnimation;
    if (spriteAnimation) spriteAnimation.cancel();
    var enterOffset = gesture.enter / total;
    var exitOffset = (gesture.enter + gesture.hold) / total;
    var frames = [
      { offset: 0, backgroundPosition: idlePosition, backgroundSize: "800% 1100%", easing: "steps(1, end)" },
      { offset: enterOffset, backgroundPosition: targetPosition, backgroundSize: "800% 1100%", easing: "steps(1, end)" },
      { offset: exitOffset, backgroundPosition: targetPosition, backgroundSize: "800% 1100%", easing: "steps(1, end)" },
      { offset: 1, backgroundPosition: idlePosition, backgroundSize: "800% 1100%", easing: "steps(1, end)" }
    ];
    currentVisualKey = visualKey;
    spriteAnimation = sprite.animate(frames, { duration: total, iterations: 1, fill: "forwards" });
    return spriteAnimation;
  }

  function backgroundPosition(row, column, scale) {
    var resolvedScale = Number(scale) > 0 ? Number(scale) : 1;
    var x = (((1 - resolvedScale) / 2) - column * resolvedScale) / (1 - 8 * resolvedScale) * 100;
    var y = ((1 - resolvedScale) - row * resolvedScale) / (1 - 11 * resolvedScale) * 100;
    return x + "% " + y + "%";
  }

  function gazeScale(index) {
    var scales = GAZE_FRAME_SCALES[settings.character] || GAZE_FRAME_SCALES.suzuto;
    return scales[index] || 1;
  }

  function bindDragSurface(surface) {
    surface.addEventListener("pointermove", onDragPointerMove, { passive: false });
    surface.addEventListener("pointerup", onDragPointerEnd);
    surface.addEventListener("pointercancel", onDragPointerEnd);
  }

  function onDragPointerDown(event) {
    if (!isSystemAdminSession() || !visible || panelOpen || settings.mode === "off") return;
    if (event.isPrimary === false || Number.isFinite(event.button) && event.button !== 0) return;
    if (event.preventDefault) event.preventDefault();
    if (event.stopPropagation) event.stopPropagation();
    stopActivity();
    root.classList.remove("has-no-safe-target");
    var rect = mover.getBoundingClientRect();
    dragState = {
      pointerId: event.pointerId,
      startX: Number(event.clientX) || 0,
      startY: Number(event.clientY) || 0,
      originX: rect.left,
      originY: rect.top,
      moved: false
    };
    root.classList.add("is-dragging");
    if (hitTarget.setPointerCapture && event.pointerId != null) {
      try { hitTarget.setPointerCapture(event.pointerId); } catch (error) { /* Pointer capture can be unavailable during synthetic events. */ }
    }
    playRow("idle", Infinity);
  }

  function onDragPointerMove(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    var clientX = Number(event.clientX);
    var clientY = Number(event.clientY);
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return;
    var dx = clientX - dragState.startX;
    var dy = clientY - dragState.startY;
    if (!dragState.moved && Math.sqrt(dx * dx + dy * dy) < 5) return;
    dragState.moved = true;
    if (event.preventDefault) event.preventDefault();
    if (event.stopPropagation) event.stopPropagation();
    var size = petSize();
    var viewport = viewportWindow();
    holdMoverAt(clampToViewport({
      x: dragState.originX + dx,
      y: dragState.originY + dy
    }, size, viewport));
  }

  function onDragPointerEnd(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    if (Number.isFinite(Number(event.clientX)) && Number.isFinite(Number(event.clientY))) onDragPointerMove(event);
    var moved = dragState.moved;
    clearDragState();
    if (moved) suppressHitTargetClickUntil = Date.now() + 500;
    if (!visible || isPresentationHidden() || settings.mode === "off" || panelOpen) return;
    if (isReducedMotion()) {
      showFrame(ROWS.idle.row, 0);
      return;
    }
    playRow("idle", Infinity);
    if (settings.mode === "fixed") return;
    sequenceToken += 1;
    var token = sequenceToken;
    clearActivityTimer();
    activityTimer = setTimeout(function () {
      activityTimer = null;
      if (token === sequenceToken) runActivityLoop(token);
    }, moved ? 900 : 300);
  }

  function clearDragState() {
    if (!dragState) return;
    var pointerId = dragState.pointerId;
    dragState = null;
    root.classList.remove("is-dragging");
    if (hitTarget.releasePointerCapture && pointerId != null) {
      try {
        if (!hitTarget.hasPointerCapture || hitTarget.hasPointerCapture(pointerId)) hitTarget.releasePointerCapture(pointerId);
      } catch (error) { /* The browser may release capture before pointercancel. */ }
    }
  }

  function holdMoverAt(target) {
    position = target;
    var next = mover.animate([
      { transform: transformFor(target) },
      { transform: transformFor(target) }
    ], { duration: 1, fill: "forwards" });
    var previous = movementAnimation;
    movementAnimation = next;
    if (previous) previous.cancel();
  }

  function onPointerMove(event) {
    if (dragState) return;
    if (isFloatingWindowOpen() && event.target && event.target.ownerDocument !== floatingWindow.document) return;
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
    var deadzone = Math.max(GAZE_MIN_DISTANCE, Math.max(rect.width, rect.height) * GAZE_DISTANCE_RATIO);
    if (Math.sqrt(dx * dx + dy * dy) < deadzone) {
      playRow("idle", Infinity);
      return;
    }
    var degrees = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
    var index = Math.round(degrees / 22.5) % 16;
    showFrame(index < 8 ? 9 : 10, index < 8 ? index : index - 8, gazeScale(index));
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
    if (!rowName || !isSystemAdminSession() || !visible || isPresentationHidden() || settings.mode === "off" || dragState || root.classList.contains("has-no-safe-target")) return;
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
    mover.classList.toggle("has-left-bubble", moverRect.left + moverRect.width / 2 > viewportWindow().innerWidth / 2);
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
    layoutFrameWindow = viewportWindow();
    layoutFrameRequest = layoutFrameWindow.requestAnimationFrame(syncViewportLayout);
  }

  function cancelLayoutFrame() {
    if (layoutFrameRequest != null && layoutFrameWindow && typeof layoutFrameWindow.cancelAnimationFrame === "function") {
      layoutFrameWindow.cancelAnimationFrame(layoutFrameRequest);
    }
    layoutFrameRequest = null;
    layoutFrameWindow = null;
    if (root) root.classList.remove("is-revalidating");
  }

  function syncViewportLayout() {
    layoutFrameRequest = null;
    layoutFrameWindow = null;
    if (!visible) {
      root.classList.remove("is-revalidating");
      return;
    }
    freezeMovement();
    var size = petSize();
    var viewport = viewportWindow();
    position = clampToViewport(position, size, viewport);
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
      toggleFloating: toggleFloatingWindow,
      getSettings: function () { return { character: settings.character, mode: settings.mode }; },
      isFloating: isFloatingWindowOpen
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize, { once: true });
  else initialize();
})();
