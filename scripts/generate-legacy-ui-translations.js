const fs = require("fs");
const path = require("path");
const vm = require("vm");
const os = require("os");
const childProcess = require("child_process");

const root = path.resolve(__dirname, "..");
const appPath = path.join(root, "app.js");
const htmlPath = path.join(root, "index.html");
const outputPath = path.join(root, "legacy-i18n.js");
const runtimeScriptPaths = [
  "app.js",
  "install-app.js",
  "label-print-window.js",
  "manufacturing-ranking-report.js",
  "product-3d.js",
  "product-3d-viewer.js"
];
const curatedTranslations = {
  en: {
    "dkd商品id": "DKD Product ID",
    "受注金額の修正": "Edit Order Amounts",
    "受注を取り消す": "Cancel Order",
    "受注金額": "Order Total",
    "対象を確認し、取消理由を記録してから実行してください。": "Confirm the order and record the cancellation reason before continuing.",
    "取消後は在庫引当を解除し、処理履歴へ記録します。対象受注を確認してから実行してください。": "Cancelling releases the inventory allocation and records the action in the history. Confirm the target order before continuing.",
    "この受注は出荷済みです。商品がまだ社内にあることを確認してください。取消後、在庫とシリアルを戻します。運送会社へ渡した後は、受注取消ではなく返品処理を行ってください。": "This order is marked shipped. Confirm the product is still in-house. Cancelling restores inventory and serial assignments. After handoff to the carrier, use the return process instead.",
    "取消後は在庫引当を解除し、処理履歴へ記録します。元に戻す場合は再受注が必要です。": "Cancelling releases the inventory allocation and records the action in the history. A new order is required to restore it.",
    "商品がまだ社内にあることを確認しました": "I confirmed that the product is still in-house",
    "表示中の受注を取り消すことを確認しました": "I confirmed that I want to cancel the displayed order",
    "取消理由を4文字以上で入力してください。": "Enter a cancellation reason of at least 4 characters.",
    "対象受注を確認し、取消理由を4文字以上で入力してください。": "Confirm the target order and enter a cancellation reason of at least 4 characters.",
    "在庫・シリアル・送り状の状態を確認して取り消しています。": "Checking inventory, serial, and waybill status and cancelling the order.",
    "受注を取り消せませんでした。": "Could not cancel the order.",
    "取消処理中...": "Cancelling...",
    "取消をやめる": "Keep Order",
    "この受注を取り消す": "Cancel This Order",
    "その他の操作": "More Actions",
    "商品発送送り状": "Outbound Shipping Waybill",
    "コア返却用複写伝票": "Multipart Core Return Waybill",
    "ヤマト運輸 / 宅急便 元払い": "Yamato Transport / TA-Q-BIN Prepaid",
    "佐川急便 / 飛脚宅配便 元払い": "Sagawa Express / Hikyaku Courier Prepaid",
    "ヤマト運輸 / 宅急便 着払い": "Yamato Transport / TA-Q-BIN Collect",
    "佐川急便 / 飛脚宅配便 着払い": "Sagawa Express / Hikyaku Courier Collect",
    "返却用伝票なし": "No Core Return Waybill",
    "発行方法未設定": "Issuance Method Not Set",
    "B2 CSV発行済み": "B2 CSV Issued",
    "伝票番号未登録": "Waybill Number Not Registered",
    "受注内容": "Order Contents",
    "受注明細がありません。": "No order items are available.",
    "コア返却対象の商品を確認できません。受注明細を再読込してください。": "Could not confirm the products requiring core return. Reload the order details.",
    "この商品の手書きを完了しました。次の商品へ進みます。": "Handwriting for this product is complete. Proceeding to the next product.",
    "対象商品1個につき1枚": "One sheet per eligible product unit",
    "対象商品1個につき1枚 /": "One sheet per eligible product unit /",
    "対象商品1個につき1枚 / 佐川急便 着払い": "One sheet per eligible product unit / Sagawa collect-on-delivery",
    "着払い伝票の種類と伝票番号を登録し、コア返却対象の商品1個につき1枚を発行します。": "Register the collect-on-delivery waybill type and number, then issue one sheet per product unit requiring core return.",
    "枚": "sheets",
    "枚 /": "sheets /",
    "枚を印刷待ちに登録しました。": "sheets were queued for printing.",
    "コア返却用複写伝票の印刷が完了しました。必要な場合は「再印刷」からもう一度発行できます。": "The multipart core return waybill has finished printing. Use \"Reprint\" to print it again if needed.",
    "コア返却用複写伝票を印刷できませんでした。印刷端末を確認して「再送」してください。": "The multipart core return waybill could not be printed. Check the printing terminal, then select \"Resend\".",
    "再送": "Resend",
    "印刷位置調整": "Print Position Adjustment",
    "自動印刷設定": "Automatic Print Settings",
    "受付時の自動印刷": "Automatic Printing on Order Acceptance",
    "帳票の標準設定": "Default Document Settings",
    "未印刷あり": "Has unprinted documents",
    "未印刷": "Not printed",
    "印刷済み": "Printed",
    "待機中": "Pending",
    "出荷処理中": "Preparing Shipment",
    "専用BOX": "Dedicated Box",
    "規定サイズ": "Standard Size",
    "北海道": "Hokkaido",
    "北東北": "Northern Tohoku",
    "南東北": "Southern Tohoku",
    "関東": "Kanto",
    "信越": "Shinetsu",
    "北陸": "Hokuriku",
    "中部": "Chubu",
    "関西": "Kansai",
    "中国": "Chugoku",
    "四国": "Shikoku",
    "九州": "Kyushu",
    "沖縄": "Okinawa",
    "各ランキング内で連番（重複なし）": "Sequential (no duplicates)",
    "商品別出荷実績集計": "Product-level Shipment Summary",
    "オルタ": "Alternator",
    "Sジェネ": "Starter Generator",
    "他オルタ": "Other Alternators",
    "セル": "Starter",
    "デスビ": "Distributor",
    "インジェ": "Injector",
    "スロボ": "Throttle Body",
    "センサ": "Sensor",
    "ランプ": "Lamp",
    "B2契約情報": "B2 Contract Settings",
    "B2 CSV事前検査": "B2 CSV Preflight Check",
    "チェックした受注を発行します。": "Issue the checked orders.",
    "現在表示中の受注を発行します。": "Issue the currently displayed order.",
    "注文を表示するか、一覧の処理対象にチェックを入れてください。": "Display an order or check the orders to process in the list.",
    "発行できない項目を注文ごとに表示しています。修正後にもう一度発行してください。": "Items blocking issuance are shown for each order. Correct them and issue the file again.",
    "ヤマトB2クラウド基本レイアウトへ出力する発送元と契約コードを設定します。": "Configure the sender and contract codes exported to the Yamato B2 Cloud basic layout.",
    "設定を確認しています。": "Checking the settings.",
    "発送元電話番号": "Sender Phone Number",
    "発送元郵便番号": "Sender Postal Code",
    "発送元住所": "Sender Address",
    "発送元建物名": "Sender Building",
    "発送元名称": "Sender Name",
    "請求先顧客コードと運賃管理番号は、ヤマト運輸の契約運賃資料またはB2クラウドの設定内容を確認して入力してください。": "Enter the billing customer code and fare management number from your Yamato contract-rate documents or B2 Cloud settings.",
    "空欄または3桁": "Blank or 3 digits",
    "B2クラウド連携の応答がありません。通信状態を確認して、もう一度実行してください。": "B2 Cloud did not respond. Check the connection and try again.",
    "B2 CSV発行に必要な契約情報は設定済みです。": "The contract information required for B2 CSV issuance is configured.",
    "未設定または形式確認が必要です:": "Missing or invalid settings:",
    "必須項目": "Required fields",
    "B2契約情報の読み込みに時間がかかっています。画面を閉じて、もう一度開いてください。": "Loading the B2 contract settings is taking too long. Close this window and open it again.",
    "B2契約情報はシステム管理者が設定します。": "B2 contract settings are managed by a system administrator.",
    "B2契約情報を読み込んでいます。": "Loading B2 contract settings.",
    "内容を変更した場合は「設定を保存」を押してください。": "After changing any values, select Save Settings.",
    "B2契約情報を読み込めませんでした。": "Could not load the B2 contract settings.",
    "発送元電話番号を10桁または11桁で入力してください。": "Enter a 10- or 11-digit sender phone number.",
    "発送元郵便番号を7桁で入力してください。": "Enter the sender postal code as 7 digits.",
    "発送元住所を入力してください。": "Enter the sender address.",
    "発送元名称を入力してください。": "Enter the sender name.",
    "請求先顧客コードを10桁から12桁で入力してください。": "Enter a 10- to 12-digit billing customer code.",
    "請求先分類コードは空欄または3桁で入力してください。": "Leave the billing classification code blank or enter 3 digits.",
    "運賃管理番号を2桁で入力してください。": "Enter the 2-digit fare management number.",
    "B2契約情報を保存しています。": "Saving B2 contract settings.",
    "B2契約情報の保存に時間がかかっています。通信状態を確認して、もう一度保存してください。": "Saving the B2 contract settings is taking too long. Check the connection and save again.",
    "B2契約情報を保存しました。CSV発行前の事前検査に反映されます。": "B2 contract settings were saved and will be used by the CSV preflight check.",
    "B2契約情報を保存できませんでした。": "Could not save the B2 contract settings.",
    "内容を確認してください。": "Review the details.",
    "B2 CSVの必須項目を確認できませんでした。": "Could not validate the required B2 CSV fields.",
    "必須項目を確認中...": "Checking required fields...",
    "B2 CSVの必須項目を確認しています。": "Checking required B2 CSV fields.",
    "B2 CSVの事前検査に時間がかかっています。通信状態を確認して、もう一度発行してください。": "The B2 CSV preflight check is taking too long. Check the connection and issue it again.",
    "B2 CSVの発行に時間がかかっています。発行履歴を確認してから、もう一度操作してください。": "B2 CSV issuance is taking too long. Check the issuance history before trying again.",
    "B2 CSVを保存できませんでした。ブラウザのダウンロード許可を確認してください。": "Could not save the B2 CSV. Check the browser's download permission.",
    "B2 CSVを発行しました。ダウンロードフォルダを確認してください。": "The B2 CSV was issued. Check the Downloads folder.",
    "B2 CSVの再取得に時間がかかっています。通信状態を確認して、もう一度実行してください。": "Retrieving the B2 CSV is taking too long. Check the connection and try again.",
    "B2 CSVを再ダウンロードしました。": "The B2 CSV was downloaded again."
  },
  zh: {
    "dkd商品id": "DKD商品ID",
    "受注金額の修正": "修改订单金额",
    "受注を取り消す": "取消订单",
    "受注金額": "订单金额",
    "対象を確認し、取消理由を記録してから実行してください。": "请确认订单并记录取消原因后再继续。",
    "取消後は在庫引当を解除し、処理履歴へ記録します。対象受注を確認してから実行してください。": "取消后将解除库存预留，并记录到处理历史中。请确认目标订单后再继续。",
    "この受注は出荷済みです。商品がまだ社内にあることを確認してください。取消後、在庫とシリアルを戻します。運送会社へ渡した後は、受注取消ではなく返品処理を行ってください。": "此订单已标记为已发货。请确认商品仍在公司内。取消后将恢复库存和序列号分配。交给承运商后，请改用退货流程。",
    "取消後は在庫引当を解除し、処理履歴へ記録します。元に戻す場合は再受注が必要です。": "取消后将解除库存预留，并记录到处理历史中。如需恢复，必须重新下单。",
    "商品がまだ社内にあることを確認しました": "我已确认商品仍在公司内",
    "表示中の受注を取り消すことを確認しました": "我已确认要取消当前显示的订单",
    "取消理由を4文字以上で入力してください。": "请输入至少4个字符的取消原因。",
    "対象受注を確認し、取消理由を4文字以上で入力してください。": "请确认目标订单，并输入至少4个字符的取消原因。",
    "在庫・シリアル・送り状の状態を確認して取り消しています。": "正在确认库存、序列号和运单状态并取消订单。",
    "受注を取り消せませんでした。": "无法取消订单。",
    "取消処理中...": "正在取消...",
    "取消をやめる": "保留订单",
    "この受注を取り消す": "取消此订单",
    "その他の操作": "更多操作",
    "商品発送送り状": "商品发货运单",
    "コア返却用複写伝票": "旧件返还用复写运单",
    "ヤマト運輸 / 宅急便 元払い": "雅玛多运输 / 宅急便 预付",
    "佐川急便 / 飛脚宅配便 元払い": "佐川急便 / 飞脚宅配便 预付",
    "ヤマト運輸 / 宅急便 着払い": "雅玛多运输 / 宅急便 到付",
    "佐川急便 / 飛脚宅配便 着払い": "佐川急便 / 飞脚宅配便 到付",
    "返却用伝票なし": "无旧件返还运单",
    "発行方法未設定": "未设置发行方式",
    "B2 CSV発行済み": "B2 CSV已发行",
    "伝票番号未登録": "运单号码未登记",
    "受注内容": "订单内容",
    "受注明細がありません。": "没有订单明细。",
    "コア返却対象の商品を確認できません。受注明細を再読込してください。": "无法确认需要返还旧件的商品。请重新加载订单明细。",
    "この商品の手書きを完了しました。次の商品へ進みます。": "该商品的手写已完成。继续处理下一件商品。",
    "対象商品1個につき1枚": "每个适用商品单位一张",
    "対象商品1個につき1枚 /": "每个适用商品单位一张 /",
    "対象商品1個につき1枚 / 佐川急便 着払い": "每个适用商品单位一张 / 佐川急便到付",
    "着払い伝票の種類と伝票番号を登録し、コア返却対象の商品1個につき1枚を発行します。": "登记到付运单类型和运单号码，并为每个需要返还旧件的商品单位签发一张。",
    "枚": "张",
    "枚 /": "张 /",
    "枚を印刷待ちに登録しました。": "张已加入打印队列。",
    "コア返却用複写伝票の印刷が完了しました。必要な場合は「再印刷」からもう一度発行できます。": "旧件返还用复写运单已打印完成。如需再次打印，请选择“重新打印”。",
    "コア返却用複写伝票を印刷できませんでした。印刷端末を確認して「再送」してください。": "旧件返还用复写运单打印失败。请检查打印终端后选择“重新发送”。",
    "再送": "重新发送",
    "印刷位置調整": "打印位置调整",
    "自動印刷設定": "自动打印设置",
    "受付時の自動印刷": "接单时自动打印",
    "帳票の標準設定": "单据默认设置",
    "未印刷あり": "有未打印单据",
    "未印刷": "未打印",
    "印刷済み": "已打印",
    "待機中": "等待中",
    "出荷処理中": "出货处理中",
    "専用BOX": "专用箱",
    "規定サイズ": "标准尺寸",
    "北海道": "北海道",
    "北東北": "北东北",
    "南東北": "南东北",
    "関東": "关东",
    "信越": "信越",
    "北陸": "北陆",
    "中部": "中部",
    "関西": "关西",
    "中国": "中国地区",
    "四国": "四国",
    "九州": "九州",
    "沖縄": "冲绳",
    "各ランキング内で連番（重複なし）": "各排名内连续编号（不重复）",
    "商品別出荷実績集計": "按商品统计出货实绩",
    "オルタ": "发电机",
    "Sジェネ": "起动发电机",
    "他オルタ": "其他发电机",
    "セル": "起动机",
    "デスビ": "分电器",
    "インジェ": "喷油器",
    "スロボ": "节气门体",
    "センサ": "传感器",
    "ランプ": "灯具",
    "B2契約情報": "B2合同信息",
    "B2 CSV事前検査": "B2 CSV预检",
    "チェックした受注を発行します。": "发行已勾选的订单。",
    "現在表示中の受注を発行します。": "发行当前显示的订单。",
    "注文を表示するか、一覧の処理対象にチェックを入れてください。": "请显示订单，或在列表中勾选要处理的订单。",
    "発行できない項目を注文ごとに表示しています。修正後にもう一度発行してください。": "按订单显示阻止发行的项目。修正后请重新发行。",
    "ヤマトB2クラウド基本レイアウトへ出力する発送元と契約コードを設定します。": "设置导出到雅玛多B2 Cloud基本布局的发件人和合同代码。",
    "設定を確認しています。": "正在检查设置。",
    "発送元電話番号": "发件人电话号码",
    "発送元郵便番号": "发件人邮政编码",
    "発送元住所": "发件人地址",
    "発送元建物名": "发件人楼宇名称",
    "発送元名称": "发件人名称",
    "請求先顧客コードと運賃管理番号は、ヤマト運輸の契約運賃資料またはB2クラウドの設定内容を確認して入力してください。": "请根据雅玛多合同运费资料或B2 Cloud设置输入账单客户代码和运费管理编号。",
    "空欄または3桁": "留空或3位数字",
    "B2クラウド連携の応答がありません。通信状態を確認して、もう一度実行してください。": "B2 Cloud无响应。请检查网络后重试。",
    "B2 CSV発行に必要な契約情報は設定済みです。": "发行B2 CSV所需的合同信息已设置。",
    "未設定または形式確認が必要です:": "未设置或格式不正确：",
    "必須項目": "必填项目",
    "B2契約情報の読み込みに時間がかかっています。画面を閉じて、もう一度開いてください。": "读取B2合同信息耗时过长。请关闭窗口后重新打开。",
    "B2契約情報はシステム管理者が設定します。": "B2合同信息由系统管理员设置。",
    "B2契約情報を読み込んでいます。": "正在读取B2合同信息。",
    "内容を変更した場合は「設定を保存」を押してください。": "更改内容后，请点击“保存设置”。",
    "B2契約情報を読み込めませんでした。": "无法读取B2合同信息。",
    "発送元電話番号を10桁または11桁で入力してください。": "请输入10位或11位发件人电话号码。",
    "発送元郵便番号を7桁で入力してください。": "请输入7位发件人邮政编码。",
    "発送元住所を入力してください。": "请输入发件人地址。",
    "発送元名称を入力してください。": "请输入发件人名称。",
    "請求先顧客コードを10桁から12桁で入力してください。": "请输入10至12位账单客户代码。",
    "請求先分類コードは空欄または3桁で入力してください。": "账单分类代码请留空或输入3位数字。",
    "運賃管理番号を2桁で入力してください。": "请输入2位运费管理编号。",
    "B2契約情報を保存しています。": "正在保存B2合同信息。",
    "B2契約情報の保存に時間がかかっています。通信状態を確認して、もう一度保存してください。": "保存B2合同信息耗时过长。请检查网络后重新保存。",
    "B2契約情報を保存しました。CSV発行前の事前検査に反映されます。": "B2合同信息已保存，并将用于CSV发行前预检。",
    "B2契約情報を保存できませんでした。": "无法保存B2合同信息。",
    "内容を確認してください。": "请确认内容。",
    "B2 CSVの必須項目を確認できませんでした。": "无法检查B2 CSV的必填项目。",
    "必須項目を確認中...": "正在检查必填项目...",
    "B2 CSVの必須項目を確認しています。": "正在检查B2 CSV必填项目。",
    "B2 CSVの事前検査に時間がかかっています。通信状態を確認して、もう一度発行してください。": "B2 CSV预检耗时过长。请检查网络后重新发行。",
    "B2 CSVの発行に時間がかかっています。発行履歴を確認してから、もう一度操作してください。": "B2 CSV发行耗时过长。请先检查发行历史再重试。",
    "B2 CSVを保存できませんでした。ブラウザのダウンロード許可を確認してください。": "无法保存B2 CSV。请检查浏览器下载权限。",
    "B2 CSVを発行しました。ダウンロードフォルダを確認してください。": "B2 CSV已发行。请检查下载文件夹。",
    "B2 CSVの再取得に時間がかかっています。通信状態を確認して、もう一度実行してください。": "重新获取B2 CSV耗时过长。请检查网络后重试。",
    "B2 CSVを再ダウンロードしました。": "B2 CSV已重新下载。"
  }
};

function extractTranslations(appSource) {
  const start = appSource.indexOf("var TRANSLATIONS = ");
  const currentLang = appSource.indexOf("\nvar currentLang", start);
  const source = appSource.slice(start, currentLang);
  const close = source.lastIndexOf("\n};");
  const context = {};
  vm.createContext(context);
  vm.runInContext(
    source.slice(0, close + 3).replace(/^var TRANSLATIONS\s*=\s*/, "TRANSLATIONS = "),
    context
  );
  return context.TRANSLATIONS;
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#43;/g, "+")
    .replace(/&times;/g, "x")
    .replace(/\s+/g, " ")
    .trim();
}

function addCandidate(set, value) {
  const text = decodeHtml(value).replace(/\\n/g, " ").replace(/\\t/g, " ").trim();
  if (!text || text.length > 300 || !/[ぁ-んァ-ヶ一-龠]/.test(text)) return;
  if (/^[#./:_-]+$/.test(text)) return;
  set.add(text);
}

function extractHtmlCandidates(source, set) {
  const clean = source
    .replace(/<!--[^]*?-->/g, "")
    .replace(/<script[^]*?<\/script>/gi, "")
    .replace(/<style[^]*?<\/style>/gi, "");
  for (const match of clean.matchAll(/>([^<>]*[ぁ-んァ-ヶ一-龠][^<>]*)</g)) addCandidate(set, match[1]);
  for (const match of clean.matchAll(/(?:placeholder|title|aria-label|value)="([^"]*[ぁ-んァ-ヶ一-龠][^"]*)"/g)) {
    addCandidate(set, match[1]);
  }
}

function extractJsCandidates(source, set) {
  for (const line of source.split(/\r?\n/)) {
    const literal = /(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)')/g;
    let match;
    while ((match = literal.exec(line))) {
      const raw = match[1] == null ? match[2] : match[1];
      if (!/[ぁ-んァ-ヶ一-龠]/.test(raw)) continue;
      if (/[<>]/.test(raw)) {
        for (const textMatch of raw.matchAll(/>([^<>]*[ぁ-んァ-ヶ一-龠][^<>]*)</g)) addCandidate(set, textMatch[1]);
        for (const attrMatch of raw.matchAll(/(?:placeholder|title|aria-label)=(?:"|')([^"']*[ぁ-んァ-ヶ一-龠][^"']*)(?:"|')/g)) {
          addCandidate(set, attrMatch[1]);
        }
      } else {
        addCandidate(set, raw);
      }
    }
  }
}

function plainDictionaryValue(value) {
  return decodeHtml(String(value || "").replace(/<[^>]*>/g, " "));
}

function existingJapaneseValues(translations) {
  return new Set(Object.values(translations.ja || {}).map(plainDictionaryValue).filter(Boolean));
}

function appRuntimeUiSource(source) {
  let runtime = source.slice(source.indexOf("\nvar currentLang"));
  const bridgeStart = runtime.indexOf("\nvar legacyI18nTextSources");
  const bridgeEnd = runtime.indexOf("\n// HTMLのdata-i18n属性", bridgeStart);
  if (bridgeStart >= 0 && bridgeEnd > bridgeStart) runtime = runtime.slice(0, bridgeStart) + runtime.slice(bridgeEnd);
  return runtime;
}

function readExistingSupplemental() {
  if (!fs.existsSync(outputPath)) return { en: {}, zh: {} };
  const context = {};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(outputPath, "utf8"), context);
  return context.DCATS_LEGACY_UI_TRANSLATIONS || { en: {}, zh: {} };
}

async function bingSession() {
  const response = await fetch("https://www.bing.com/translator", {
    headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36" }
  });
  if (!response.ok) throw new Error(`Bing translator bootstrap failed: ${response.status}`);
  const html = await response.text();
  const ig = (html.match(/IG:"([A-F0-9]+)"/) || [])[1];
  const auth = html.match(/params_AbusePreventionHelper = \[(\d+),"([^"]+)"/);
  if (!ig || !auth) throw new Error("Could not read Bing translator session parameters");
  const cookies = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie().map((item) => item.split(";", 1)[0]).join("; ")
    : "";
  return { ig, key: auth[1], token: auth[2], cookies, iid: 0 };
}

async function translateRequest(session, text, target) {
  session.iid += 1;
  const url = `https://www.bing.com/ttranslatev3?isVertical=1&&IG=${session.ig}&IID=translator.5025.${session.iid}`;
  const body = new URLSearchParams({
    fromLang: "ja",
    to: target,
    text,
    token: session.token,
    key: session.key,
    tryFetchingGenderDebiasedTranslations: "true"
  });
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
      "origin": "https://www.bing.com",
      "referer": "https://www.bing.com/translator",
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
      ...(session.cookies ? { cookie: session.cookies } : {})
    },
    body
  });
  if (!response.ok) throw new Error(`Bing translation failed (${target}): ${response.status}`);
  const payload = await response.json();
  return payload && payload[0] && payload[0].translations && payload[0].translations[0]
    ? String(payload[0].translations[0].text || "")
    : "";
}

function makeBatches(values) {
  const batches = [];
  let current = [];
  let length = 0;
  values.forEach((value, index) => {
    const delimiterLength = index ? 32 : 0;
    if (current.length && (current.length >= 35 || length + value.length + delimiterLength > 3400)) {
      batches.push(current);
      current = [];
      length = 0;
    }
    current.push({ value, index });
    length += value.length + delimiterLength;
  });
  if (current.length) batches.push(current);
  return batches;
}

async function translateValues(values, target) {
  const session = await bingSession();
  const result = {};
  const batches = makeBatches(values);
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
    const batch = batches[batchIndex];
    const source = batch.map((item, index) => {
      return (index ? `\n<<<DCATS_SPLIT_${item.index}>>>\n` : "") + item.value;
    }).join("");
    const translated = await translateRequest(session, source, target);
    const parts = translated.split(/\s*<<<DCATS_SPLIT_\d+>>>\s*/);
    if (parts.length !== batch.length) {
      for (const item of batch) result[item.value] = await translateRequest(session, item.value, target);
    } else {
      batch.forEach((item, index) => { result[item.value] = parts[index].trim(); });
    }
    process.stdout.write(`${target}: ${batchIndex + 1}/${batches.length}\n`);
  }
  return result;
}

async function main() {
  const app = fs.readFileSync(appPath, "utf8");
  const html = fs.readFileSync(htmlPath, "utf8");
  const translations = extractTranslations(app);
  const candidates = new Set();
  extractHtmlCandidates(html, candidates);
  runtimeScriptPaths.forEach((relativePath) => {
    const source = relativePath === "app.js"
      ? appRuntimeUiSource(app)
      : fs.readFileSync(path.join(root, relativePath), "utf8");
    extractJsCandidates(source, candidates);
  });
  const existing = existingJapaneseValues(translations);
  const values = Array.from(candidates).filter((value) => !existing.has(value)).sort((a, b) => a.localeCompare(b, "ja"));
  const previous = readExistingSupplemental();
  const curatedOnly = process.env.DCATS_I18N_CURATED_ONLY === "1";
  const missing = curatedOnly ? [] : values.filter((value) =>
    !(previous.en[value] || curatedTranslations.en[value]) ||
    !(previous.zh[value] || curatedTranslations.zh[value])
  );
  console.log(`Supplemental translations: ${values.length} total, ${missing.length} new`);
  let translated = { en: {}, zh: {} };
  if (missing.length && process.platform === "win32") {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dcats-i18n-"));
    const candidatePath = path.join(tempDir, "candidates.json");
    const translatedPath = path.join(tempDir, "translated.json");
    fs.writeFileSync(candidatePath, JSON.stringify(missing), "utf8");
    const helper = path.join(__dirname, "generate-legacy-ui-translations.ps1");
    const processResult = childProcess.spawnSync("pwsh.exe", [
      "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", helper,
      "-CandidatePath", candidatePath, "-OutputPath", translatedPath
    ], { stdio: "inherit" });
    if (processResult.status !== 0) throw new Error("PowerShell translation helper failed");
    translated = JSON.parse(fs.readFileSync(translatedPath, "utf8"));
    fs.rmSync(tempDir, { recursive: true, force: true });
  } else if (missing.length) {
    translated.en = await translateValues(missing, "en");
    translated.zh = await translateValues(missing, "zh-Hans");
  }
  const en = Object.assign({}, previous.en || {}, translated.en || {});
  const zh = Object.assign({}, previous.zh || {}, translated.zh || {});
  Object.assign(en, curatedTranslations.en);
  Object.assign(zh, curatedTranslations.zh);
  const content = [
    "// Generated by scripts/generate-legacy-ui-translations.js.",
    "// Runtime translation is local; this file makes no external requests.",
    "var DCATS_LEGACY_UI_TRANSLATIONS = " + JSON.stringify({ en, zh }, null, 2) + ";",
    ""
  ].join("\n");
  fs.writeFileSync(outputPath, content, "utf8");
  console.log(`Wrote ${path.relative(root, outputPath)}`);
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
