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
    "ランプ": "Lamp"
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
    "ランプ": "灯具"
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
  const missing = values.filter((value) =>
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
