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
      questionTitle: "{name}に質問",
      closeQuestion: "質問画面を閉じる",
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
      openQuestion: "{name}に質問する",
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
      aiLegend: "AIに質問・画面案内（管理者テスト）",
      aiHelp: "D-CATSの使い方を質問すると、回答と開く画面の候補を表示します。画面移動やデータの入力・更新・削除は自動実行しません。",
      aiQuestionLabel: "質問",
      aiPlaceholder: "例：受注データはどの画面で確認しますか？",
      aiAsk: "AIに質問する",
      aiCost: "API料金：GPT-5.6 Luna 入力 US$0.20／100万トークン、出力 US$1.20／100万トークン（ChatGPTサブスクリプションとは別料金）。D-CATS追加料金：0円。",
      aiPrivacy: "顧客名・受注内容・価格・個人情報・パスワード・APIキーは入力しないでください。送信するのは質問文・表示言語・現在の画面名だけです。",
      aiIdle: "まだ質問していません。",
      aiWorking: "回答を確認しています。",
      aiDone: "回答しました。操作は実行していません。",
      aiInvalidQuestion: "1～800文字で質問を入力してください。",
      aiNotConfigured: "AIの管理者設定が未完了です。システム管理者へ連絡してください。",
      aiConfigurationInvalid: "AIの管理者設定を確認してください。",
      aiForbidden: "システム管理者として再ログインしてからお試しください。",
      aiRateLimited: "AIが混み合っています。少し待ってからもう一度お試しください。",
      aiProviderFailed: "AIから回答を取得できませんでした。時間をおいてもう一度お試しください。",
      aiFailed: "AIに接続できませんでした。時間をおいてもう一度お試しください。",
      aiGuide: "案内先：{screen} — {reason}",
      aiUsage: "今回の使用量：入力{input}／出力{output}トークン、推定API料金 US${cost}",
      bridgeLegend: "Windows業務連携（管理者テスト）",
      bridgeCheck: "Windows連携を確認",
      bridgeHelp: "連携キューの確認、受信フォルダー内CSVの事前検査、固定の取込待ちフォルダー表示、販売王25の起動だけを行います。CSV取込やD-CATS本番データの変更は行いません。",
      bridgeInboxHelp: "CSVをWindows受信フォルダーへ置き、ファイル名だけを入力してください。フォルダー：%LOCALAPPDATA%\\D-CATS\\HanbaiOhBridge\\inbox",
      bridgeDesktopHelp: "販売王への取込は自動実行しません。販売王で「D-CATS連携テスト（実データ禁止）」を確認してから手動で行ってください。",
      bridgeOpenTestFolder: "取込待ちフォルダーを開く",
      bridgeLaunchHanbaioh: "販売王25を起動",
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
      bridgeFolderWorking: "固定の取込待ちフォルダーを開いています。",
      bridgeLaunchWorking: "販売王25の起動状態を確認しています。",
      bridgeSuccess: "接続できました。連携キューは{count}件です。",
      bridgeSalesPrepared: "売上CSVを{rows}行・{slips}伝票・警告{warnings}件で待機キューへ準備しました。",
      bridgeTestSalesStaged: "{company}専用CSV「{file}」を取込待ちへ準備しました。販売王への取込は会社名を確認して手動で行ってください。",
      bridgeTestSalesExisting: "同じテスト会社用CSVは準備済みです。「{file}」を使用してください。販売王への取込は会社名を確認して手動で行ってください。",
      bridgeCustomerPrepared: "得意先CSVを{rows}行・{customers}得意先・警告{warnings}件で確認待ちに準備しました。",
      bridgeFolderOpened: "取込待ちフォルダーを開きました。販売王への取込は会社名を確認して手動で行ってください。",
      bridgeHanbaiohLaunched: "販売王25を起動しました。「D-CATS連携テスト（実データ禁止）」を確認してから手動で取り込んでください。",
      bridgeHanbaiohAlreadyRunning: "販売王25はこのPCで起動済みです。別ログインは行いません。［ツール→利用状況］のユーザー名と画面上部のデータ名称を確認し、割当と違えば取込を止めて管理者へ連絡してください。",
      bridgeHanbaiohAlreadyRunningBubble: "販売王は起動中です。利用者と会社データを確認してください。",
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
      questionTitle: "Ask {name}",
      closeQuestion: "Close question window",
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
      openQuestion: "Ask {name}",
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
      aiLegend: "Ask AI and get screen guidance (admin pilot)",
      aiHelp: "Ask how to use D-CATS to receive an answer and a suggested screen. It never navigates or creates, updates, or deletes data automatically.",
      aiQuestionLabel: "Question",
      aiPlaceholder: "Example: Which screen shows sales orders?",
      aiAsk: "Ask AI",
      aiCost: "API pricing: GPT-5.6 Luna US$0.20/1M input tokens and US$1.20/1M output tokens (separate from ChatGPT subscriptions). Additional D-CATS charge: \u00a50.",
      aiPrivacy: "Do not enter customer names, order details, prices, personal data, passwords, or API keys. Only the question, display language, and current screen name are sent.",
      aiIdle: "No question has been asked yet.",
      aiWorking: "Checking the answer.",
      aiDone: "Answered. No action was performed.",
      aiInvalidQuestion: "Enter a question between 1 and 800 characters.",
      aiNotConfigured: "AI administrator setup is incomplete. Contact the system administrator.",
      aiConfigurationInvalid: "Check the AI administrator settings.",
      aiForbidden: "Sign in again as a system administrator and retry.",
      aiRateLimited: "AI is busy. Wait a moment and try again.",
      aiProviderFailed: "AI could not return an answer. Please try again later.",
      aiFailed: "AI could not be reached. Please try again later.",
      aiGuide: "Suggested screen: {screen} — {reason}",
      aiUsage: "This request: {input} input / {output} output tokens; estimated API cost US${cost}",
      bridgeLegend: "Windows integration (admin pilot)",
      bridgeCheck: "Check Windows integration",
      bridgeHelp: "Checks the queue, validates CSV files in the Windows inbox, opens the fixed import folder, and launches Sales King 25. It does not import CSV files or change D-CATS production data.",
      bridgeInboxHelp: "Place the CSV in the Windows inbox and enter only its file name. Folder: %LOCALAPPDATA%\\D-CATS\\HanbaiOhBridge\\inbox",
      bridgeDesktopHelp: "Import is never automatic. In Sales King, confirm “D-CATS Integration Test (No Production Data)” before importing manually.",
      bridgeOpenTestFolder: "Open import-ready folder",
      bridgeLaunchHanbaioh: "Launch Sales King 25",
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
      bridgeFolderWorking: "Opening the fixed import-ready folder.",
      bridgeLaunchWorking: "Checking the Sales King 25 launch state.",
      bridgeSuccess: "Connected. The integration queue contains {count} items.",
      bridgeSalesPrepared: "Staged {rows} sales rows across {slips} slips with {warnings} warnings.",
      bridgeTestSalesStaged: "Prepared test-company CSV “{file}” for {company}. Confirm the company name and import it into Sales King manually.",
      bridgeTestSalesExisting: "The same test-company CSV is already ready. Use “{file}” and confirm the company name before manually importing it into Sales King.",
      bridgeCustomerPrepared: "Staged {rows} rows for {customers} customers with {warnings} warnings for review.",
      bridgeFolderOpened: "Opened the import-ready folder. Confirm the company name before importing into Sales King manually.",
      bridgeHanbaiohLaunched: "Launched Sales King 25. Confirm “D-CATS Integration Test (No Production Data)” before importing manually.",
      bridgeHanbaiohAlreadyRunning: "Sales King 25 is already running on this PC. No second sign-in will be attempted. Confirm the user name under Tools → Usage Status and the data name in the window title. If either differs from the assigned account, stop the import and contact an administrator.",
      bridgeHanbaiohAlreadyRunningBubble: "Sales King is running. Check the user and company data.",
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
      questionTitle: "向{name}提问",
      closeQuestion: "关闭提问窗口",
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
      openQuestion: "向{name}提问",
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
      aiLegend: "AI问答与画面引导（管理员测试）",
      aiHelp: "可以询问D-CATS的使用方法，AI会回答并建议应打开的画面。不会自动跳转，也不会自动输入、更新或删除数据。",
      aiQuestionLabel: "问题",
      aiPlaceholder: "示例：在哪个画面确认订单数据？",
      aiAsk: "向AI提问",
      aiCost: "API费用：GPT-5.6 Luna输入每100万tokens为US$0.20，输出为US$1.20（与ChatGPT订阅分开计费）。D-CATS额外费用：0日元。",
      aiPrivacy: "请勿输入客户姓名、订单内容、价格、个人信息、密码或API密钥。仅发送问题、显示语言和当前画面名称。",
      aiIdle: "尚未提问。",
      aiWorking: "正在确认回答。",
      aiDone: "回答完成。未执行任何操作。",
      aiInvalidQuestion: "请输入1至800个字符的问题。",
      aiNotConfigured: "AI管理员设置尚未完成。请联系系统管理员。",
      aiConfigurationInvalid: "请检查AI管理员设置。",
      aiForbidden: "请以系统管理员身份重新登录后再试。",
      aiRateLimited: "AI当前繁忙，请稍后重试。",
      aiProviderFailed: "无法从AI取得回答，请稍后重试。",
      aiFailed: "无法连接AI，请稍后重试。",
      aiGuide: "建议画面：{screen} — {reason}",
      aiUsage: "本次用量：输入{input}／输出{output} tokens，预估API费用 US${cost}",
      bridgeLegend: "Windows业务联动（管理员测试）",
      bridgeCheck: "检查Windows联动",
      bridgeHelp: "仅检查联动队列、预检Windows收件文件夹中的CSV、打开固定导入文件夹并启动销售王25。不会自动导入CSV或更改D-CATS生产数据。",
      bridgeInboxHelp: "请将CSV放入Windows收件文件夹，并只输入文件名。文件夹：%LOCALAPPDATA%\\D-CATS\\HanbaiOhBridge\\inbox",
      bridgeDesktopHelp: "不会自动导入。请在销售王中确认“D-CATS联动测试（禁止使用实际数据）”后再手动导入。",
      bridgeOpenTestFolder: "打开待导入文件夹",
      bridgeLaunchHanbaioh: "启动销售王25",
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
      bridgeFolderWorking: "正在打开固定的待导入文件夹。",
      bridgeLaunchWorking: "正在确认销售王25的启动状态。",
      bridgeSuccess: "连接成功。联动队列中有{count}项。",
      bridgeSalesPrepared: "已将{rows}行、{slips}张单据的销售CSV加入等待队列，警告{warnings}项。",
      bridgeTestSalesStaged: "已为{company}准备测试公司专用CSV“{file}”。请确认公司名称后手动导入销售王。",
      bridgeTestSalesExisting: "相同的测试公司专用CSV已准备完成，请使用“{file}”。确认公司名称后再手动导入销售王。",
      bridgeCustomerPrepared: "已将{rows}行、{customers}个客户的CSV加入确认等待，警告{warnings}项。",
      bridgeFolderOpened: "已打开待导入文件夹。请确认公司名称后再手动导入销售王。",
      bridgeHanbaiohLaunched: "已启动销售王25。请确认“D-CATS联动测试（禁止使用实际数据）”后再手动导入。",
      bridgeHanbaiohAlreadyRunning: "销售王25已在此电脑运行，不会再次登录。请在“工具→使用状况”确认用户名，并在窗口标题确认数据名称；若与分配的信息不符，请停止导入并联系管理员。",
      bridgeHanbaiohAlreadyRunningBubble: "销售王已在运行，请确认用户和公司数据。",
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
  var panelTitle;
  var panelBody;
  var panelClose;
  var floatingButton;
  var floatingStatus;
  var aiCard;
  var aiQuestionInput;
  var aiAskButton;
  var aiStatus;
  var aiAnswer;
  var aiGuide;
  var aiUsage;
  var bridgeCard;
  var bridgeButton;
  var bridgeSalesFileInput;
  var bridgeCustomerFileInput;
  var bridgeSalesButton;
  var bridgeTestSalesButton;
  var bridgeCustomerButton;
  var bridgeFolderButton;
  var bridgeLaunchButton;
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
  var panelView = "settings";
  var floatingWindow = null;
  var floatingRequestPending = false;
  var aiRequestPending = false;
  var aiRequestToken = 0;
  var aiStatusState = "aiIdle";
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
    hitTarget.setAttribute("aria-haspopup", "dialog");
    hitTarget.setAttribute("aria-expanded", "false");
    hitTarget.setAttribute("aria-controls", "dcats-concierge-panel");
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
    panelTitle = createCopyElement("h2", "", "settingsTitle");
    panelTitle.id = "dcats-concierge-title";
    headingWrap.appendChild(panelTitle);
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

    aiCard = createElement("section", "dcats-concierge-ai-card");
    aiCard.setAttribute("aria-labelledby", "dcats-concierge-ai-title");
    var aiTitle = createCopyElement("h3", "dcats-concierge-ai-title", "aiLegend");
    aiTitle.id = "dcats-concierge-ai-title";
    var aiHelp = createCopyElement("p", "dcats-concierge-ai-help", "aiHelp");
    aiHelp.id = "dcats-concierge-ai-help";
    var aiQuestionLabel = createCopyElement("label", "dcats-concierge-ai-label", "aiQuestionLabel");
    aiQuestionLabel.setAttribute("for", "dcats-concierge-ai-question");
    aiQuestionInput = createElement("textarea", "dcats-concierge-ai-question");
    aiQuestionInput.id = "dcats-concierge-ai-question";
    aiQuestionInput.maxLength = 800;
    aiQuestionInput.rows = 4;
    aiQuestionInput.setAttribute("autocomplete", "off");
    aiQuestionInput.setAttribute("aria-describedby", "dcats-concierge-ai-help dcats-concierge-ai-privacy dcats-concierge-ai-cost");
    aiAskButton = createCopyElement("button", "dcats-concierge-ai-button", "aiAsk");
    aiAskButton.type = "button";
    aiAskButton.setAttribute("aria-describedby", "dcats-concierge-ai-help dcats-concierge-ai-privacy dcats-concierge-ai-cost dcats-concierge-ai-status");
    var aiPrivacy = createCopyElement("p", "dcats-concierge-ai-privacy", "aiPrivacy");
    aiPrivacy.id = "dcats-concierge-ai-privacy";
    var aiCost = createCopyElement("p", "dcats-concierge-ai-cost", "aiCost");
    aiCost.id = "dcats-concierge-ai-cost";
    aiStatus = createElement("p", "dcats-concierge-ai-status");
    aiStatus.id = "dcats-concierge-ai-status";
    aiStatus.setAttribute("role", "status");
    aiStatus.setAttribute("aria-live", "polite");
    aiAnswer = createElement("p", "dcats-concierge-ai-answer");
    aiAnswer.hidden = true;
    aiGuide = createElement("p", "dcats-concierge-ai-guide");
    aiGuide.hidden = true;
    aiUsage = createElement("p", "dcats-concierge-ai-usage");
    aiUsage.hidden = true;
    aiCard.appendChild(aiTitle);
    aiCard.appendChild(aiHelp);
    aiCard.appendChild(aiQuestionLabel);
    aiCard.appendChild(aiQuestionInput);
    aiCard.appendChild(aiAskButton);
    aiCard.appendChild(aiPrivacy);
    aiCard.appendChild(aiCost);
    aiCard.appendChild(aiStatus);
    aiCard.appendChild(aiAnswer);
    aiCard.appendChild(aiGuide);
    aiCard.appendChild(aiUsage);

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
    var bridgeDesktopHelp = createCopyElement("p", "dcats-concierge-bridge-help", "bridgeDesktopHelp");
    bridgeDesktopHelp.id = "dcats-concierge-bridge-desktop-help";
    var bridgeDesktopActions = createElement("div", "dcats-concierge-bridge-actions");
    bridgeFolderButton = createCopyElement("button", "dcats-concierge-bridge-button is-secondary", "bridgeOpenTestFolder");
    bridgeFolderButton.type = "button";
    bridgeFolderButton.setAttribute("aria-describedby", "dcats-concierge-bridge-desktop-help dcats-concierge-bridge-cost dcats-concierge-bridge-status");
    bridgeLaunchButton = createCopyElement("button", "dcats-concierge-bridge-button is-secondary", "bridgeLaunchHanbaioh");
    bridgeLaunchButton.type = "button";
    bridgeLaunchButton.setAttribute("aria-describedby", "dcats-concierge-bridge-desktop-help dcats-concierge-bridge-cost dcats-concierge-bridge-status");
    bridgeDesktopActions.appendChild(bridgeFolderButton);
    bridgeDesktopActions.appendChild(bridgeLaunchButton);
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
    bridgeCard.appendChild(bridgeDesktopHelp);
    bridgeCard.appendChild(bridgeDesktopActions);
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
      openPanel("question");
    });
    hitTarget.addEventListener("pointerdown", onDragPointerDown);
    hitTarget.addEventListener("lostpointercapture", onDragPointerEnd);
    bindDragSurface(document);
    launcher.addEventListener("click", function () {
      if (panelOpen && panelView === "settings") closePanel();
      else openPanel("settings");
    });
    panelClose.addEventListener("click", closePanel);
    characterButtons.forEach(function (button) {
      button.addEventListener("click", function () { selectCharacter(button.dataset.value); });
    });
    modeButtons.forEach(function (button) {
      button.addEventListener("click", function () { selectMode(button.dataset.value); });
    });
    floatingButton.addEventListener("click", toggleFloatingWindow);
    aiAskButton.addEventListener("click", runAiRequest);
    aiQuestionInput.addEventListener("keydown", function (event) {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        runAiRequest();
      }
    });
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
    bridgeFolderButton.addEventListener("click", function () {
      runWindowsBridgeRequest("open_test_company_import_folder", null, "bridgeFolderWorking");
    });
    bridgeLaunchButton.addEventListener("click", function () {
      runWindowsBridgeRequest("launch_hanbaioh25", null, "bridgeLaunchWorking");
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

  function clearAiResult() {
    if (aiAnswer) {
      aiAnswer.textContent = "";
      aiAnswer.hidden = true;
    }
    if (aiGuide) {
      aiGuide.textContent = "";
      aiGuide.hidden = true;
    }
    if (aiUsage) {
      aiUsage.textContent = "";
      aiUsage.hidden = true;
    }
  }

  function updateAiStatus() {
    if (!aiAskButton || !aiQuestionInput || !aiStatus) return;
    aiAskButton.disabled = aiRequestPending;
    aiQuestionInput.disabled = aiRequestPending;
    aiQuestionInput.placeholder = copy("aiPlaceholder");
    aiStatus.textContent = copy(aiStatusState);
    aiStatus.classList.toggle("is-success", aiStatusState === "aiDone");
    aiStatus.classList.toggle("is-error", ["aiInvalidQuestion", "aiNotConfigured", "aiConfigurationInvalid", "aiForbidden", "aiRateLimited", "aiProviderFailed", "aiFailed"].indexOf(aiStatusState) >= 0);
  }

  function syncAiControls(systemAdmin) {
    if (!aiCard || !panelBody || !conciergeHelp) return;
    if (systemAdmin) {
      if (!aiCard.parentElement) panelBody.insertBefore(aiCard, bridgeCard && bridgeCard.parentElement ? bridgeCard : conciergeHelp);
      updateAiStatus();
      return;
    }
    aiRequestToken += 1;
    aiRequestPending = false;
    aiStatusState = "aiIdle";
    if (aiQuestionInput) aiQuestionInput.value = "";
    clearAiResult();
    if (aiCard.parentElement) aiCard.parentElement.removeChild(aiCard);
  }

  function aiFailureStatus(error) {
    var code = String(error && error.message || "");
    if (code.indexOf("invalid_") >= 0) return "aiInvalidQuestion";
    if (code.indexOf("ai_not_configured") >= 0 || code.indexOf("missing_env") >= 0) return "aiNotConfigured";
    if (code.indexOf("configuration_invalid") >= 0 || code.indexOf("service_not_configured") >= 0) return "aiConfigurationInvalid";
    if (code.indexOf("forbidden") >= 0 || code.indexOf("authorization") >= 0 || code.indexOf("system_admin_required") >= 0) return "aiForbidden";
    if (code.indexOf("rate_limited") >= 0) return "aiRateLimited";
    if (code.indexOf("provider_failed") >= 0) return "aiProviderFailed";
    return "aiFailed";
  }

  function currentAiScreenId(api) {
    var screen = activeScreenName();
    var allowed = api && api.allowedScreens;
    return allowed && allowed[screen] ? screen : "menu";
  }

  async function runAiRequest() {
    if (aiRequestPending || !isSystemAdminSession()) return;
    var question = String(aiQuestionInput && aiQuestionInput.value || "").trim();
    if (!question || question.length > 800) {
      aiStatusState = "aiInvalidQuestion";
      clearAiResult();
      updateAiStatus();
      return;
    }
    var api = window.DcatsConciergeAiApi;
    if (!api || typeof api.ask !== "function") {
      aiStatusState = "aiNotConfigured";
      clearAiResult();
      updateAiStatus();
      return;
    }
    aiRequestPending = true;
    aiStatusState = "aiWorking";
    clearAiResult();
    updateAiStatus();
    var requestToken = ++aiRequestToken;
    try {
      var result = await api.ask({
        question: question,
        language: activeLanguage(),
        screenId: currentAiScreenId(api)
      });
      if (requestToken !== aiRequestToken || !isSystemAdminSession()) return;
      if (!result || result.error) throw result && result.error || new Error("ai_request_failed");
      var data = result.data;
      if (!data || data.ok !== true || data.performed_action !== false || typeof data.answer !== "string" || !data.answer.trim()) {
        throw new Error("ai_provider_failed");
      }
      aiAnswer.textContent = data.answer.trim();
      aiAnswer.hidden = false;
      if (data.guide && typeof data.guide.screen_label === "string" && typeof data.guide.reason === "string") {
        aiGuide.textContent = copy("aiGuide", { screen: data.guide.screen_label, reason: data.guide.reason });
        aiGuide.hidden = false;
      }
      var usage = data.usage || {};
      var inputTokens = Math.max(0, Number(usage.input_tokens) || 0);
      var outputTokens = Math.max(0, Number(usage.output_tokens) || 0);
      var estimatedCost = Math.max(0, Number(data.estimated_cost_usd) || 0).toFixed(8);
      aiUsage.textContent = copy("aiUsage", { input: inputTokens, output: outputTokens, cost: estimatedCost });
      aiUsage.hidden = false;
      aiStatusState = "aiDone";
    } catch (error) {
      if (requestToken !== aiRequestToken) return;
      aiStatusState = aiFailureStatus(error);
      clearAiResult();
    } finally {
      if (requestToken === aiRequestToken) {
        aiRequestPending = false;
        updateAiStatus();
      }
    }
  }

  function updateBridgeStatus() {
    if (!bridgeButton || !bridgeStatus) return;
    bridgeButton.disabled = bridgeRequestPending;
    if (bridgeSalesButton) bridgeSalesButton.disabled = bridgeRequestPending;
    if (bridgeTestSalesButton) bridgeTestSalesButton.disabled = bridgeRequestPending;
    if (bridgeCustomerButton) bridgeCustomerButton.disabled = bridgeRequestPending;
    if (bridgeFolderButton) bridgeFolderButton.disabled = bridgeRequestPending;
    if (bridgeLaunchButton) bridgeLaunchButton.disabled = bridgeRequestPending;
    if (bridgeSalesFileInput) bridgeSalesFileInput.disabled = bridgeRequestPending;
    if (bridgeCustomerFileInput) bridgeCustomerFileInput.disabled = bridgeRequestPending;
    bridgeStatus.textContent = copy(bridgeStatusState.key, bridgeStatusState.values || {});
    bridgeStatus.classList.toggle("is-success", ["bridgeSuccess", "bridgeSalesPrepared", "bridgeTestSalesStaged", "bridgeTestSalesExisting", "bridgeCustomerPrepared", "bridgePreparedExisting", "bridgeFolderOpened", "bridgeHanbaiohLaunched"].indexOf(bridgeStatusState.key) >= 0);
    bridgeStatus.classList.toggle("is-warning", bridgeStatusState.key === "bridgeHanbaiohAlreadyRunning");
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
      } else if (command === "open_test_company_import_folder") {
        statusKey = "bridgeFolderOpened";
        statusValues = {};
      } else if (command === "launch_hanbaioh25") {
        statusKey = response.data && response.data.alreadyRunning === true ? "bridgeHanbaiohAlreadyRunning" : "bridgeHanbaiohLaunched";
        statusValues = {};
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
      showBubble(copy(statusKey === "bridgeHanbaiohAlreadyRunning" ? "bridgeHanbaiohAlreadyRunningBubble" : statusKey, statusValues), 4200);
      playExternalState(statusKey === "bridgeHanbaiohAlreadyRunning" ? "review" : "success", 2200);
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
    syncAiControls(systemAdmin && visible);
    syncBridgeControls(systemAdmin && visible);
    if (isFloatingWindowOpen() && (!systemAdmin || EXCLUDED_SCREENS[screen] || dedicatedPrintStation)) {
      restoreFromFloatingWindow(floatingWindow, true);
    }
    if (!systemAdmin && panelOpen) {
      panelOpen = false;
      panelView = "settings";
      panel.hidden = true;
      panelReturnFocus = null;
      syncPanelPresentation();
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
    if (isFloatingWindowOpen()) {
      floatingWindow.document.title = copy("rootLabel");
      floatingWindow.document.documentElement.lang = document.documentElement.lang || "ja";
    }
    root.querySelectorAll("[data-concierge-copy]").forEach(function (element) {
      element.textContent = copy(element.dataset.conciergeCopy);
    });
    applySettings();
    syncPanelPresentation();
    updateFloatingControls();
    updateAiStatus();
    updateBridgeStatus();
  }

  function applySettings() {
    var name = petName(settings.character);
    sprite.classList.remove("is-suzuto", "is-rinna");
    sprite.classList.add(PETS[settings.character].className);
    root.classList.toggle("is-off", settings.mode === "off");
    hitTarget.setAttribute("aria-label", copy("openQuestion", { name: name }));
    launcher.setAttribute("aria-label", copy("openSettings", { name: name }));
    launcherLabel.textContent = settings.mode === "off" ? copy("launcherOff") : name;
    characterButtons.forEach(function (button) { button.setAttribute("aria-pressed", String(button.dataset.value === settings.character)); });
    modeButtons.forEach(function (button) { button.setAttribute("aria-pressed", String(button.dataset.value === settings.mode)); });
    syncPanelPresentation();
    updateFloatingControls();
  }

  function syncPanelPresentation() {
    if (!panel || !panelTitle || !panelClose || !hitTarget || !launcher) return;
    var questionView = panelOpen && panelView === "question";
    panel.classList.toggle("is-question-view", questionView);
    panelTitle.textContent = questionView
      ? copy("questionTitle", { name: petName(settings.character) })
      : copy("settingsTitle");
    panelClose.setAttribute("aria-label", copy(questionView ? "closeQuestion" : "closeSettings"));
    hitTarget.setAttribute("aria-expanded", String(questionView));
    launcher.setAttribute("aria-expanded", String(panelOpen && panelView === "settings"));
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

  function parkBesideQuestionPanel() {
    var size = petSize();
    var viewport = viewportWindow();
    holdMoverAt(clampToViewport({
      x: 10,
      y: Math.max(54, viewport.innerHeight - size.height - 16)
    }, size, viewport));
  }

  function openPanel(view) {
    if (!isSystemAdminSession()) return;
    var nextView = view === "question" ? "question" : "settings";
    if (!panelOpen) panelReturnFocus = presentationDocument().activeElement;
    panelOpen = true;
    panelView = nextView;
    panel.hidden = false;
    syncPanelPresentation();
    stopActivity();
    if (panelView === "question") parkBesideQuestionPanel();
    syncRunningState();
    if (panelView === "question" && aiQuestionInput) aiQuestionInput.focus();
    else panelClose.focus();
  }

  function closePanel(restoreFocus) {
    if (!panelOpen) return;
    var focusTarget = panelReturnFocus;
    panelReturnFocus = null;
    panelOpen = false;
    panelView = "settings";
    panel.hidden = true;
    syncPanelPresentation();
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
