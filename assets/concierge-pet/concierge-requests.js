(function () {
  "use strict";
  var STATUS = [
    "new",
    "reviewing",
    "needs_info",
    "in_progress",
    "resolved",
    "declined",
  ];
  var COPY = {
    ja: {
      confirmHeading: "受付内容の確認",
      confirmPrivacy: "相談ログは記録済みです。依頼の受付はまだ確定していません。本文・対象画面・画像を確認し、確定すると管理者の依頼一覧へ登録します。コードや業務データの自動修正は行いません。",
      confirmSave: "この内容で受付を確定",
      confirmRetry: "同じ受付を確認・再送",
      editMessage: "本文を直す",
      heading: "修正依頼・改善提案",
      intro: "内容を送信すると受付番号が付き、ここで対応状況を確認できます。",
      compose: "依頼・提案を作成",
      fromQuestion: "今の質問から下書きを作る",
      kind: "種類",
      bug: "不具合・修正依頼",
      suggestion: "改善提案",
      question: "確認してほしい質問",
      title: "件名",
      description: "内容・再現手順・期待する動作",
      screen: "対象画面",
      image: "画像を添付（任意）",
      pasteHint: "内容欄またはここを選び、Ctrl+V／⌘Vで画像を貼り付けられます。画像は1枚、送信前に確認・削除できます。",
      imageReading: "画像を確認しています…",
      imageReady: "画像を添付しました。内容を確認してから送信してください。",
      removeImage: "画像を外す",
      privacy:
        "送信前に内容と画像を確認してください。パスワード、個人情報、顧客・受注情報、機密価格は含めないでください。画像は管理者だけで共有し、AIには送信しません。",
      submit: "この内容で送信",
      sending: "送信中…",
      sent: "受付番号 {no} で受け付けました。",
      imageWarning:
        "依頼は受付済みです。画像の保存に失敗しました。「画像を再送」から同じ画像を添付できます。",
      retryImage: "画像を再送",
      imageSaved: "画像を保存しました。",
      draftEmpty: "先に質問を入力してください。",
      required: "件名と内容を入力してください。",
      invalidImage:
        "画像を読み込めません。PNG・JPEG・WebPの画像（10MB以内）を選び直してください。",
      imageLarge: "画像が大きすぎます。範囲を絞った画像を選んでください。",
      list: "受付済みの依頼",
      refresh: "一覧を更新",
      loading: "読み込み中…",
      empty: "該当する依頼はありません。",
      all: "すべて",
      filter: "状態で絞り込み",
      more: "さらに表示",
      detail: "依頼の詳細",
      back: "詳細を閉じる",
      showImage: "添付画像を表示",
      history: "対応履歴（最新100件）",
      note: "対応内容・確認事項",
      update: "状態と対応内容を保存",
      updated: "対応状況を更新しました。",
      reload: "詳細を読み直す",
      needNote: "対応内容を入力してください。",
      unknown:
        "送信結果を確認できませんでした。同じ内容のまま再送すると重複せず確認できます。",
      failed:
        "読み込み・保存に失敗しました。通信を確認して再度お試しください。",
      unavailable: "受付機能の準備中です。入力内容はこの画面に保持しています。",
      forbidden: "管理者として再ログインしてください。",
      conflict:
        "別の更新があります。詳細を読み直し、対応内容を確認して再度保存してください。",
      rate: "受付件数の上限に達しました。時間をおいてお試しください。",
      created: "受付",
      attachment: "画像添付",
      new: "受付済み",
      reviewing: "確認中",
      needs_info: "追加情報待ち",
      in_progress: "対応中",
      resolved: "対応済み",
      declined: "見送り",
      aiAnswer: "参考：AIの回答",
      imageFailed: "画像を表示できませんでした。再度お試しください。",
    },
    en: {
      confirmHeading: "Review request",
      confirmPrivacy: "The consultation is logged, but this request is not confirmed yet. Review the text, screen and image. Confirm to add it to the administrator inbox. No code or business data is changed automatically.",
      confirmSave: "Confirm and save request",
      confirmRetry: "Check / retry the same request",
      editMessage: "Edit message",
      heading: "Fix requests and suggestions",
      intro:
        "Submit a request to receive a reference number and track its progress here.",
      compose: "Create a request",
      fromQuestion: "Draft from this question",
      kind: "Type",
      bug: "Bug or fix request",
      suggestion: "Improvement suggestion",
      question: "Question for review",
      title: "Subject",
      description: "Details, steps to reproduce, expected result",
      screen: "Screen",
      image: "Attach an image (optional)",
      pasteHint: "Select the details field or here and paste one image with Ctrl+V / ⌘V. Review or remove it before sending.",
      imageReading: "Checking the image…",
      imageReady: "Image attached. Review it before sending.",
      removeImage: "Remove image",
      privacy:
        "Review the text and image before sending. Exclude passwords, personal or customer data, orders and confidential prices. Images are shared only with administrators and are not sent to AI.",
      submit: "Submit this request",
      sending: "Sending…",
      sent: "Accepted as {no}.",
      imageWarning:
        "The request was accepted, but the image could not be saved. Retry the same image below.",
      retryImage: "Retry image",
      imageSaved: "Image saved.",
      draftEmpty: "Enter a question first.",
      required: "Enter a subject and details.",
      invalidImage: "Choose a PNG, JPEG or WebP image up to 10 MB.",
      imageLarge: "The image is too large. Select a smaller area.",
      list: "Submitted requests",
      refresh: "Refresh list",
      loading: "Loading…",
      empty: "No matching requests.",
      all: "All",
      filter: "Filter by status",
      more: "Load more",
      detail: "Request details",
      back: "Close details",
      showImage: "View attached image",
      history: "History (latest 100)",
      note: "Response or information needed",
      update: "Save status and response",
      updated: "Status updated.",
      reload: "Reload details",
      needNote: "Enter a response.",
      unknown:
        "The result could not be confirmed. Retry the same content to check without creating a duplicate.",
      failed: "Could not load or save. Check your connection and retry.",
      unavailable:
        "Request intake is being prepared. Your input remains on this screen.",
      forbidden: "Sign in again as a system administrator.",
      conflict:
        "Another update exists. Reload the details, review your response, and save again.",
      rate: "Request limit reached. Please try later.",
      created: "Accepted",
      attachment: "Image attached",
      new: "Received",
      reviewing: "Reviewing",
      needs_info: "Needs information",
      in_progress: "In progress",
      resolved: "Resolved",
      declined: "Declined",
      aiAnswer: "Reference: AI answer",
      imageFailed: "Could not display the image. Please retry.",
    },
    zh: {
      confirmHeading: "确认受理内容",
      confirmPrivacy: "咨询已记录，但请求尚未确认。请检查正文、页面和图片，确认后加入管理员的请求列表。不会自动修改代码或业务数据。",
      confirmSave: "确认并保存请求",
      confirmRetry: "确认或重发同一请求",
      editMessage: "修改正文",
      heading: "修正请求与改进建议",
      intro: "提交后获得受理编号，可在这里查看处理进度。",
      compose: "新建请求或建议",
      fromQuestion: "根据当前问题创建草稿",
      kind: "类型",
      bug: "故障或修正请求",
      suggestion: "改进建议",
      question: "需要确认的问题",
      title: "标题",
      description: "详细内容、重现步骤和预期结果",
      screen: "相关页面",
      image: "附加图片（可选）",
      pasteHint: "选择内容栏或此处，按Ctrl+V／⌘V粘贴1张图片。发送前可以确认或移除。",
      imageReading: "正在检查图片…",
      imageReady: "已添加图片。请确认后再发送。",
      removeImage: "移除图片",
      privacy:
        "发送前请确认内容和图片。不要包含密码、个人或客户资料、订单及机密价格。图片仅与管理员共享，不会发送给AI。",
      submit: "提交此内容",
      sending: "正在提交…",
      sent: "已受理，编号为 {no}。",
      imageWarning: "请求已受理，但图片保存失败。可在下方重新发送同一图片。",
      retryImage: "重新发送图片",
      imageSaved: "图片已保存。",
      draftEmpty: "请先输入问题。",
      required: "请输入标题和内容。",
      invalidImage: "请选择10MB以内的PNG、JPEG或WebP图片。",
      imageLarge: "图片过大，请缩小截图范围。",
      list: "已受理的请求",
      refresh: "刷新列表",
      loading: "正在读取…",
      empty: "没有符合条件的请求。",
      all: "全部",
      filter: "按状态筛选",
      more: "显示更多",
      detail: "请求详情",
      back: "关闭详情",
      showImage: "查看附图",
      history: "处理记录（最近100条）",
      note: "处理内容或待确认事项",
      update: "保存状态和处理内容",
      updated: "处理状态已更新。",
      reload: "重新读取详情",
      needNote: "请输入处理内容。",
      unknown: "无法确认提交结果。保持内容不变后重试，不会重复受理。",
      failed: "读取或保存失败，请检查网络后重试。",
      unavailable: "受理功能准备中，当前输入保留在本页面。",
      forbidden: "请以系统管理员身份重新登录。",
      conflict: "已有其他更新。请重新读取详情，确认内容后再次保存。",
      rate: "已达到请求数量上限，请稍后再试。",
      created: "受理",
      attachment: "已附图",
      new: "已受理",
      reviewing: "确认中",
      needs_info: "等待补充",
      in_progress: "处理中",
      resolved: "已处理",
      declined: "暂不处理",
      aiAnswer: "参考：AI回答",
      imageFailed: "无法显示图片，请重试。",
    },
  };
  COPY.ja.statusLabel = "対応状況";
  COPY.en.statusLabel = "Status";
  COPY.zh.statusLabel = "处理状态";
  COPY.ja.retryImage = "この画像を保存";
  COPY.en.retryImage = "Save this image";
  COPY.zh.retryImage = "保存此图片";
  COPY.ja.imageConflict =
    "依頼は受付済みで、画像も保存されています。保存済みの画像は差し替えできません。";
  COPY.en.imageConflict =
    "The request already has a saved image. It cannot be replaced.";
  COPY.zh.imageConflict = "请求已有保存的图片，不能替换。";
  var SCREENS = {
    menu: ["メニュー", "Menu", "菜单"],
    search: ["販売管理", "Sales management", "销售管理"],
    "customer-portal": ["得意先ポータル", "Customer portal", "客户门户"],
    "sales-order-mgmt": [
      "受注・出荷管理",
      "Orders and shipping",
      "订单与发货管理",
    ],
    "shipping-document-mgmt": [
      "出荷帳票発行",
      "Shipping documents",
      "发货单据",
    ],
    "core-return-mgmt": ["コア返却管理", "Core returns", "旧件退回管理"],
    "production-search": ["製造管理", "Production management", "生产管理"],
    "finished-label-mgmt": [
      "完品登録・製造シリアル",
      "Finished products and serials",
      "成品与序列号",
    ],
    "finished-product-shipping": [
      "出荷照合・保証管理",
      "Shipment verification and warranty",
      "发货核对与保修",
    ],
    "core-list-mgmt": ["コア管理", "Core management", "旧件管理"],
    "product-kind-stock-mgmt": ["在庫管理", "Inventory", "库存管理"],
    "manufacturing-cost-mgmt": ["製造原価", "Manufacturing cost", "制造成本"],
    "rakuten-price": [
      "ECモール価格調査",
      "Marketplace research",
      "电商价格调查",
    ],
    users: ["社内ユーザー管理", "Internal users", "内部用户管理"],
    "customer-access-mgmt": ["得意先管理", "Customer access", "客户管理"],
    "shipping-rate-mgmt": [
      "運送・送料管理",
      "Carriers and rates",
      "承运商与运费",
    ],
    "parts-mgmt": ["商品管理", "Product management", "商品管理"],
    "component-name-master-mgmt": [
      "部品名マスター",
      "Component names",
      "零件名称主数据",
    ],
    "component-compat-mgmt": [
      "構成部品互換管理",
      "Component compatibility",
      "零件兼容管理",
    ],
    "component-parallel": [
      "構成部品並列表示",
      "Parallel component view",
      "零件并列显示",
    ],
    components: ["構成部品検索", "Component search", "零件搜索"],
    "sales-pricing-mgmt": ["販売価格設定", "Sales pricing", "销售价格设置"],
    "purchase-mgmt": ["仕入管理", "Purchasing", "采购管理"],
    "customer-catalog": [
      "得意先商品カタログ",
      "Customer catalog",
      "客户商品目录",
    ],
    "customer-orders": ["得意先注文", "Customer orders", "客户订单"],
    "customer-shipping": [
      "得意先配送先",
      "Customer destinations",
      "客户收货地址",
    ],
    "customer-users": ["得意先ユーザー", "Customer users", "客户用户"],
    "kikan-mgmt": ["基幹品番管理", "Core part numbers", "核心品号管理"],
    "manufacturing-ranking-report": [
      "製造ランキング帳票",
      "Manufacturing ranking report",
      "制造排名报表",
    ],
    "production-ranking-mgmt": [
      "製造ランキング管理",
      "Manufacturing rankings",
      "制造排名管理",
    ],
    "rakuten-bulk": [
      "ECモール価格一括調査",
      "Bulk marketplace research",
      "电商价格批量调查",
    ],
    "rakuten-price-list": [
      "ECモール価格一覧",
      "Marketplace price list",
      "电商价格列表",
    ],
    logs: ["操作ログ", "Activity logs", "操作日志"],
    "concierge-admin": ["コンシェルジュ管理", "Concierge inbox", "礼宾管理"],
    "api-settings": ["API設定", "API settings", "API设置"],
    "change-pw": ["パスワード変更", "Change password", "修改密码"],
  };
  SCREENS["report-hub"] = ["帳票出力 / レポート", "Reports", "报表输出 / 报告"];
  SCREENS["customer-price-report"] = [
    "帳票出力 / 販売価格表",
    "Sales price reports",
    "报表输出 / 销售价格表",
  ];
  function mount(parent, options) {
    var doc = parent.ownerDocument,
      owner = options.context().owner,
      disposed = false;
    var tokens = {},
      sending = false,
      updating = false,
      imageToken = 0;
    var imageData = "",
      draftId = "",
      fingerprint = "",
      draftContext = null,
      pendingImage = null;
    var draft = null, attempted = false;
    var current = null,
      updateId = "",
      updateFingerprint = "",
      lastPage = [],
      items = [];
    function language() {
      var value = options.context().language;
      return COPY[value] ? value : "ja";
    }
    function t(key, values) {
      var text = COPY[language()][key] || COPY.ja[key] || key;
      Object.keys(values || {}).forEach(function (k) {
        text = text.split("{" + k + "}").join(String(values[k]));
      });
      return text;
    }
    function valid() {
      var c = options.context();
      return !disposed && c.admin && c.owner === owner;
    }
    function element(tag, key, className) {
      var node = doc.createElement(tag);
      if (key) {
        node.dataset.requestCopy = key;
        node.textContent = t(key);
      }
      if (className) node.className = className;
      return node;
    }
    function button(key, fn, className) {
      var node = element("button", key, className);
      node.type = "button";
      node.addEventListener("click", fn);
      return node;
    }
    function label(key, input, suffix) {
      var node = element("label", key);
      var id = "dcats-request-" + key + (suffix || "");
      input.id = id;
      node.htmlFor = id;
      return node;
    }
    function announce(key, error, values) {
      if (!valid()) return;
      message.textContent = t(key, values);
      message.classList.toggle("is-error", !!error);
    }
    function ref(row) {
      return "DC-" + String(row.request_no).padStart(6, "0");
    }
    function screenLabel(id) {
      return SCREENS[id]
        ? SCREENS[id][["ja", "en", "zh"].indexOf(language())]
        : id;
    }
    function date(value) {
      return new Date(value).toLocaleString(
        language() === "zh" ? "zh-CN" : language() === "en" ? "en-US" : "ja-JP",
      );
    }
    function uuid() {
      return window.crypto.randomUUID();
    }
    function apiError(error, isSend) {
      var code = String((error && error.message) || "");
      if (/forbidden|authorization|system_admin_required/.test(code))
        return "forbidden";
      if (
        /service_not_configured|not.found|Failed to send a request/.test(code)
      )
        return "unavailable";
      if (/conflict/.test(code)) return "conflict";
      if (/rate_limited/.test(code)) return "rate";
      return isSend ? "unknown" : "failed";
    }
    async function send(command, scope) {
      if (!valid()) throw new Error("system_admin_required");
      var api = options.api();
      if (!api || typeof api.send !== "function")
        throw new Error("service_not_configured");
      var token = (tokens[scope] || 0) + 1;
      tokens[scope] = token;
      var result = await api.send(command);
      if (!valid() || token !== tokens[scope]) throw new Error("stale_session");
      if (!result || result.error || !result.data || result.data.ok !== true)
        throw (result && result.error) || new Error("request_failed");
      return result.data;
    }
    var section = element("section", null, "dcats-concierge-request-card");
    var form = element("form"),
      kind = element("p", null, "dcats-request-muted"),
      title = element("h4"),
      description = element("p", null, "dcats-request-pre");
    form.hidden = true;
    form.className = "dcats-request-confirm";
    form.appendChild(element("h3", "confirmHeading"));
    form.appendChild(kind);
    form.appendChild(title);
    form.appendChild(description);
    var screen = element("p", null, "dcats-request-muted");
    form.appendChild(screen);
    var preview = element("img", null, "dcats-request-preview");
    preview.hidden = true;
    preview.alt = t("image");
    form.appendChild(preview);
    form.appendChild(element("p", "confirmPrivacy", "dcats-request-muted"));
    var submit = element("button", "confirmSave", "dcats-request-primary");
    submit.type = "submit";
    form.appendChild(submit);
    var edit = button("editMessage", function () {
      if (sending || attempted || !draft || !valid()) return;
      var previous = draft;
      clearDraft();
      if (options.edit) options.edit(previous);
    });
    form.appendChild(edit);
    var retryImage = button("retryImage", async function () {
      if (sending || !pendingImage) return;
      sending = true;
      syncBusy();
      try {
        var result = await send(
          { action: "attach", id: pendingImage.id, image: pendingImage.data },
          "submit",
        );
        retryImage.hidden = true;
        pendingImage = null;
        announce("imageSaved");
        renderDetail(result);
      } catch (error) {
        announce(apiError(error), true);
      } finally {
        sending = false;
        if (valid()) syncBusy();
      }
    });
    retryImage.hidden = true;
    section.appendChild(form);
    var message = element("p", null, "dcats-request-message");
    message.setAttribute("role", "status");
    message.setAttribute("aria-live", "polite");
    section.appendChild(message);
    section.appendChild(retryImage);
    var history = element("details"), historyBody = element("div");
    history.appendChild(element("summary", "list"));
    history.appendChild(historyBody);
    section.appendChild(history);
    var filter = element("select");
    ["all"].concat(STATUS).forEach(function (key) {
      var o = element("option", key);
      o.value = key;
      filter.appendChild(o);
    });
    historyBody.appendChild(label("filter", filter));
    historyBody.appendChild(filter);
    var refresh = button("refresh", function () {
      loadList(false);
    });
    historyBody.appendChild(refresh);
    var listStatus = element("p", null, "dcats-request-muted"),
      list = element("ul", null, "dcats-request-list");
    historyBody.appendChild(listStatus);
    historyBody.appendChild(list);
    var more = button("more", function () {
      loadList(true);
    });
    more.hidden = true;
    historyBody.appendChild(more);
    var detail = element("section");
    detail.hidden = true;
    historyBody.appendChild(detail);
    var statusSelect, noteInput, saveButton;
    parent.insertBefore(section, options.before || null);
    function syncBusy() {
      [submit, retryImage].forEach(function (n) {
        n.disabled = sending;
      });
      edit.disabled = sending || attempted;
      submit.textContent = t(sending ? "sending" : attempted ? "confirmRetry" : "confirmSave");
      if (saveButton) saveButton.disabled = updating;
      if (options.changed) options.changed();
    }
    function clearImage() {
      imageToken++;
      imageData = "";
      preview.removeAttribute("src");
      preview.hidden = true;
    }
    function clearDraft() {
      draft = null; attempted = false; draftId = ""; fingerprint = ""; draftContext = null;
      form.hidden = true;
      title.textContent = ""; description.textContent = ""; kind.textContent = ""; screen.textContent = "";
      clearImage();
      syncBusy();
    }
    function prepare(value) {
      if (!valid() || draft || sending || pendingImage || !value || ["bug", "suggestion"].indexOf(value.kind) < 0 || typeof value.title !== "string" || !value.title.trim() || value.title.length > 120 || typeof value.question !== "string" || !value.question.trim() || value.question.length > 800 || !SCREENS[value.screenId] || !COPY[value.language]) return false;
      draft = { kind: value.kind, title: value.title.trim(), question: value.question.trim(), image: value.image || "", screenId: value.screenId, language: value.language, messageId: typeof value.messageId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.messageId) ? value.messageId : "" };
      draftContext = { screenId: draft.screenId, language: draft.language };
      title.textContent = draft.title;
      description.textContent = draft.question;
      kind.textContent = t(draft.kind);
      screen.textContent = t("screen") + ": " + screenLabel(draft.screenId);
      imageData = draft.image;
      if (imageData) { preview.src = "data:image/png;base64," + imageData; preview.hidden = false; }
      message.textContent = "";
      form.hidden = false;
      syncBusy();
      return true;
    }
    history.addEventListener("toggle", function () { if (history.open) loadList(false); });
    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      if (sending || !draft || !valid()) return;
      var body = {
        action: "create",
        kind: draft.kind,
        title: draft.title,
        description: draft.question,
        screen_id: draftContext.screenId,
        language: draftContext.language,
      };
      var next = JSON.stringify(body);
      if (fingerprint !== next) {
        draftId = draft.messageId || uuid();
        fingerprint = next;
      }
      body.id = draftId;
      if (imageData) body.image = imageData;
      sending = true;
      attempted = true;
      syncBusy();
      announce("sending");
      try {
        var result = await send(body, "submit");
        if (!result.request || result.request.id !== body.id) throw new Error("request_failed");
        history.open = true;
        renderDetail(result);
        announce("sent", false, { no: ref(result.request) });
        if (result.warning === "attachment_conflict") {
          announce("imageConflict", true);
        } else if (result.warning) {
          pendingImage = { id: result.request.id, data: imageData };
          announce("imageWarning", true);
          retryImage.hidden = false;
        }
        var acceptedDraft = draft;
        clearDraft();
        if (options.accepted) options.accepted(acceptedDraft);
        loadList(false, true);
      } catch (error) {
        announce(apiError(error, true), true);
      } finally {
        sending = false;
        if (valid()) syncBusy();
      }
    });
    function renderList() {
      list.replaceChildren();
      items.forEach(function (row) {
        var li = element("li"),
          b = button(null, function () {
            showDetail(row.id);
          });
        b.appendChild(doc.createTextNode(ref(row) + " · " + row.title + "\n"));
        b.appendChild(element("span", row.status));
        li.appendChild(b);
        list.appendChild(li);
      });
      listStatus.textContent = items.length ? "" : t("empty");
      more.hidden = lastPage.length < 30;
    }
    async function loadList(append, quiet) {
      var selected = filter.value,
        command = { action: "list", status: selected };
      if (append && items.length)
        command.before_no = items[items.length - 1].request_no;
      refresh.disabled = true;
      more.disabled = true;
      if (!quiet) listStatus.textContent = t("loading");
      try {
        var result = await send(command, "list");
        lastPage = Array.isArray(result.items) ? result.items : [];
        items = append ? items.concat(lastPage) : lastPage.slice();
        renderList();
      } catch (error) {
        if (valid() && error.message !== "stale_session") {
          listStatus.textContent = t(apiError(error));
        }
      } finally {
        if (valid()) {
          refresh.disabled = false;
          more.disabled = false;
        }
      }
    }
    filter.addEventListener("change", function () {
      loadList(false);
    });
    async function showDetail(id) {
      var savedNote =
        current && current.id === id && noteInput ? noteInput.value : "";
      try {
        var result = await send({ action: "detail", id: id }, "detail");
        renderDetail(result);
        noteInput.value = savedNote;
      } catch (error) {
        if (error.message !== "stale_session") announce(apiError(error), true);
      }
    }
    function renderDetail(data) {
      if (!valid() || !data.request) return;
      current = data.request;
      detail.replaceChildren();
      detail.hidden = false;
      detail.appendChild(element("h4", "detail"));
      var h = element("p");
      h.textContent = ref(current) + " · " + current.title;
      detail.appendChild(h);
      var meta = element("p", null, "dcats-request-muted");
      meta.textContent =
        screenLabel(current.screen_id) + " · " + date(current.created_at);
      detail.appendChild(meta);
      var content = element("p", null, "dcats-request-pre");
      content.textContent = current.description;
      detail.appendChild(content);
      if (current.has_attachment) {
        var imageId = current.id;
        var show = button("showImage", async function () {
          show.disabled = true;
          try {
            var result = await send({ action: "image", id: imageId }, "image");
            if (!current || current.id !== imageId) return;
            var url = new URL(result.url);
            if (
              url.protocol !== "https:" ||
              url.hostname !== "jqoeqximtwfpqwzngutj.supabase.co" ||
              url.pathname.indexOf(
                "/storage/v1/object/sign/concierge-request-images/" +
                  imageId +
                  "/",
              ) !== 0
            )
              throw new Error("invalid_url");
            var img = element("img", null, "dcats-request-preview");
            img.alt = t("image");
            img.referrerPolicy = "no-referrer";
            img.src = url.href;
            show.after(img);
            show.remove();
          } catch (error) {
            if (error.message !== "stale_session")
              announce("imageFailed", true);
            show.disabled = false;
          }
        });
        detail.appendChild(show);
      }
      if (current.can_attach) {
        var attachId = current.id,
          attachFile = element("input");
        attachFile.type = "file";
        attachFile.accept = "image/png,image/jpeg,image/webp";
        detail.appendChild(label("image", attachFile, "-detail"));
        detail.appendChild(attachFile);
        var attachPreview = element("img", null, "dcats-request-preview"),
          attachData = "",
          attachToken = 0;
        attachPreview.hidden = true;
        attachPreview.alt = t("image");
        detail.appendChild(attachPreview);
        var attachSave = button("retryImage", async function () {
          if (!attachData || !current || current.id !== attachId) return;
          attachSave.disabled = true;
          attachFile.disabled = true;
          try {
            var result = await send(
              { action: "attach", id: attachId, image: attachData },
              "attach",
            );
            if (!current || current.id !== attachId) return;
            renderDetail(result);
            announce("imageSaved");
            loadList(false, true);
          } catch (error) {
            if (error.message !== "stale_session")
              announce(apiError(error), true);
          } finally {
            attachSave.disabled = false;
            attachFile.disabled = false;
          }
        });
        attachSave.hidden = true;
        detail.appendChild(attachSave);
        attachFile.addEventListener("change", async function () {
          var selected = attachFile.files && attachFile.files[0],
            token = ++attachToken;
          attachData = "";
          attachSave.hidden = true;
          attachPreview.hidden = true;
          attachPreview.removeAttribute("src");
          if (!selected) return;
          try {
            var data = await window.DcatsConciergeImages.prepare(selected, doc);
            if (
              !valid() ||
              !current ||
              current.id !== attachId ||
              token !== attachToken
            )
              return;
            attachData = data;
            attachPreview.src = "data:image/png;base64," + data;
            attachPreview.hidden = false;
            attachSave.hidden = false;
          } catch (error) {
            if (valid() && token === attachToken)
              announce(
                error.message === "image_large" ? "imageLarge" : "invalidImage",
                true,
              );
          }
        });
      }
      detail.appendChild(element("h4", "history"));
      var history = element("ol", null, "dcats-request-history");
      (data.events || []).forEach(function (event) {
        var li = element("li");
        li.appendChild(doc.createTextNode(date(event.occurred_at) + " · "));
        li.appendChild(
          element(
            "span",
            event.event_type === "status" ? event.status : event.event_type,
          ),
        );
        if (event.note) {
          var note = element("p", null, "dcats-request-pre");
          note.textContent = event.note;
          li.appendChild(note);
        }
        history.appendChild(li);
      });
      detail.appendChild(history);
      var updateForm = element("form");
      statusSelect = element("select");
      STATUS.forEach(function (key) {
        var o = element("option", key);
        o.value = key;
        statusSelect.appendChild(o);
      });
      statusSelect.value = current.status;
      updateForm.appendChild(label("statusLabel", statusSelect, "-detail"));
      updateForm.appendChild(statusSelect);
      noteInput = element("textarea");
      noteInput.maxLength = 2000;
      noteInput.required = true;
      updateForm.appendChild(label("note", noteInput));
      updateForm.appendChild(noteInput);
      saveButton = element("button", "update", "dcats-request-primary");
      saveButton.type = "submit";
      updateForm.appendChild(saveButton);
      updateForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        if (updating || !valid()) return;
        if (!noteInput.value.trim()) {
          announce("needNote", true);
          return;
        }
        var body = {
            action: "update",
            id: current.id,
            expected_version: current.version,
            status: statusSelect.value,
            note: noteInput.value.trim(),
          },
          next = JSON.stringify(body);
        if (updateFingerprint !== next) {
          updateId = uuid();
          updateFingerprint = next;
        }
        body.operation_id = updateId;
        updating = true;
        syncBusy();
        try {
          var result = await send(body, "update");
          if (!current || current.id !== body.id) return;
          renderDetail(result);
          updateFingerprint = "";
          announce("updated");
          loadList(false, true);
        } catch (error) {
          announce(apiError(error), true);
        } finally {
          updating = false;
          if (valid()) syncBusy();
        }
      });
      detail.appendChild(updateForm);
      detail.appendChild(
        button("reload", function () {
          showDetail(current.id);
        }),
      );
      detail.appendChild(
        button("back", function () {
          tokens.detail = (tokens.detail || 0) + 1;
          tokens.image = (tokens.image || 0) + 1;
          detail.replaceChildren();
          detail.hidden = true;
          current = null;
        }),
      );
      syncBusy();
    }
    function sync() {
      if (!valid()) {
        destroy();
        return;
      }
      section.querySelectorAll("[data-request-copy]").forEach(function (node) {
        node.textContent = t(node.dataset.requestCopy);
      });
      if (draftContext)
        screen.textContent =
          t("screen") + ": " + screenLabel(draftContext.screenId);
      if (draft) kind.textContent = t(draft.kind);
      syncBusy();
    }
    function destroy() {
      if (disposed) return;
      disposed = true;
      imageToken++;
      clearImage();
      imageData = "";
      pendingImage = null;
      draft = null;
      title.textContent = "";
      description.textContent = "";
      if (noteInput) noteInput.value = "";
      current = null;
      items = [];
      section.remove();
    }
    sync();
    return {
      sync: sync, destroy: destroy, prepare: prepare,
      pending: function () { return !!(draft || sending || pendingImage); },
      beginMessage: function () { if (!draft && !sending && !pendingImage) message.textContent = ""; },
      previewElement: function () { return !form.hidden ? form : null; },
      resetDraft: function () { if (draft && !sending && !attempted) clearDraft(); }
    };
  }
  window.DcatsConciergeRequestsUi = Object.freeze({ mount: mount });
})();
