(() => {
  "use strict";

  const pageSize = 5;
  const labels = {
    part: ["部品", "Part", "零件"], pricing: ["価格・送料", "Price & shipping", "价格和运费"],
    vehicle: ["車両", "Vehicle", "车辆"], office: ["事業所", "Office", "营业所"], stock: ["在庫", "Inventory", "库存"],
    condition: ["状態・保証", "Condition & warranty", "状态和保修"],
    notes: ["メモ・追加項目", "Notes & additional fields", "备注和附加项目"],
    sourceStart: ["Recycle+から最新情報を取得", "Fetch latest from Recycle+", "从 Recycle+ 获取最新信息"],
    sourceRunning: ["Recycle+から部品詳細を取得中です。", "Fetching part details from Recycle+.", "正在从 Recycle+ 获取零件详情。"],
    sourceReady: ["取得しました。差分を確認して反映できます。", "Retrieved. Review the changes before applying.", "已获取，请检查差异后应用。"],
    sourceConfig: ["TinyFishのサーバー接続設定が必要です。", "TinyFish server configuration is required.", "需要配置 TinyFish 服务器。"],
    sourceLimit: ["取得中の依頼が3件あります。完了後にお試しください。", "Three requests are running. Try again after one finishes.", "已有三个任务正在运行，请稍后重试。"],
    sourceAuth: ["Recycle+またはTinyFishの認証を確認してください。", "Check Recycle+ or TinyFish authentication.", "请检查 Recycle+ 或 TinyFish 登录。"],
    sourceFailed: ["照合済みの詳細を取得できませんでした。前回値を表示しています。", "Verified details could not be retrieved. Showing the previous values.", "未能获取已核验详情，已保留原有数据。"],
    reviewSource: ["取得した差分を確認", "Review retrieved changes", "检查已获取的变更"],
    sourceBatch: ["最大3件を自動取得", "Fetch up to three automatically", "自动获取最多三项"],
    sourceOe: ["カーメーカーNo. → 純正品番", "Car maker number → OE part number", "整车厂编号 → 原厂品号"],
    sourceMaker: ["パーツメーカーNo. → メーカー品番", "Parts maker number → Manufacturer part number", "零件厂编号 → 厂商品号"],
    matchCandidates: ["純正品番とメーカー品番が一致する商品種別", "Product variants matching both numbers", "两个品号同时匹配的商品类别"],
    masterOnly: ["商品種別未登録", "Product variant not registered", "商品类别未登记"],
    matchMissing: ["純正品番とメーカー品番がそろうと、紐付け候補を照合できます。", "Both numbers are needed to match product variants.", "需要两个品号才能匹配商品类别。"],
    matchNone: ["純正品番とメーカー品番の両方が一致する商品種別はありません。", "No product variant matches both numbers.", "暂无同时匹配两个品号的商品类别。"],
    inventoryOpen: ["夜間の全件取得結果", "Nightly inventory results", "夜间库存获取结果"],
    inventoryRefresh: ["状況を更新", "Refresh status", "刷新进度"],
    inventoryDownload: ["全件のCSVをダウンロード", "Download the complete CSV", "下载完整CSV"],
    inventoryScope: ["本社（000001）の全件取得は、毎日午前1時からサーバーで行います。", "The server starts the head-office inventory scan at 1:00 a.m. JST each day.", "服务器每天日本时间凌晨1点开始获取总部库存。"],
    inventoryIdle: ["全件取得の結果はまだありません。", "No full inventory scan has completed yet.", "尚无全量库存获取结果。"],
    inventoryCount: ["照合済み {count} / {total} 件", "{count} / {total} rows verified", "已核验 {count} / {total} 条"],
    inventoryReady: ["在庫一覧の全{count}件を照合しました。", "All {count} rows in the inventory list were verified.", "已核验库存列表的全部 {count} 条记录。"],
    inventoryDetailCount: ["部品詳細 {verified}/{total}件を確認・反映（未確認{pending}件、取得できず{failed}件）", "Part details verified and applied: {verified}/{total} ({pending} pending, {failed} unsuccessful)", "部件详情已核验并同步 {verified}/{total} 条（待核验 {pending} 条，未能获取 {failed} 条）"],
    inventoryDetailUntracked: ["この一覧の部品詳細は夜間更新の記録がありません。", "This inventory list has no recorded nightly detail results.", "此库存列表没有夜间部件详情更新记录。"],
    inventoryComparison: ["前回の一覧から増えた番号は{appeared}件、外れた番号は{absent}件です。", "Compared with the previous list, {appeared} numbers appeared and {absent} are absent.", "与上次列表相比，新增{appeared}个号码，{absent}个号码未出现在列表中。"],
    inventoryIncomplete: ["次の行を照合できませんでした。", "The next row could not be verified.", "无法核验下一行。"],
    inventoryChanged: ["取得中に一覧の条件や行が変わりました。", "The source list changed during retrieval.", "获取期间源列表发生变化。"],
    inventoryPolicy: ["TinyFishの安全チェックで停止しました。", "TinyFish stopped the run at a safety check.", "TinyFish 安全检查停止了运行。"],
    inventoryUncertain: ["TinyFishの受付結果を確認できません。", "TinyFish submission could not be confirmed.", "无法确认 TinyFish 是否接收了请求。"],
    inventoryCapacity: ["取得範囲が5,000件を超えています。", "The result exceeds 5,000 rows.", "结果超过 5,000 条。"],
    inventoryStopped: ["途中で取得が止まりました。", "Retrieval stopped before completing.", "获取在完成前停止。"],
    partLookupCount: ["Recycle+カルテ {count}件", "Recycle+ Karte · {count} results", "Recycle+ 卡片 · {count} 条"],
    partLookupList: ["カルテ一覧", "Karte results", "卡片列表"],
    preview: ["販売管理（カルテ検索プレビュー）", "Sales Management (Karte preview)", "销售管理（卡片查询预览）"],
    search: ["カルテ番号検索", "Search Karte number", "查询卡片编号"],
    searchOpen: ["カルテ検索", "Karte search", "卡片查询"],
    numberExample: ["カルテ番号（例 22）", "Karte number (e.g. 22)", "卡片编号（例如 22）"],
    workspaceTools: ["カルテ操作", "Karte actions", "卡片操作"],
    productListTitle: ["Recycle+カルテ一覧", "Recycle+ Karte results", "Recycle+ 卡片列表"],
    partMatch: ["品番一致", "Part number match", "品号匹配"],
    countShort: ["{count}件", "{count} results", "{count} 条"],
    karteNo: ["カルテNo", "Karte No.", "卡片编号"],
    oeNumber: ["純正品番", "OE part no.", "原厂品号"],
    makerNumber: ["メーカー品番", "Manufacturer part no.", "厂商品号"],
    retry: ["再試行", "Retry", "重试"],
    sourceFailedShort: ["取得失敗", "Unavailable", "读取失败"],
    submit: ["検索", "Search", "查询"],
    related: ["関連カルテ", "Related Karte", "关联卡片"],
    dcatsProductDetail: ["D-CATS商品詳細", "D-CATS product", "D-CATS商品详情"],
    dcatsProductSearch: ["D-CATS商品検索", "Search D-CATS", "搜索D-CATS商品"],
    list: ["Recycle+カルテ", "Recycle+ Karte", "Recycle+ 卡片"],
    detail: ["詳細", "Details", "详情"], pending: ["部品詳細の取得待ち", "Waiting for part details", "等待获取零件详情"],
    exit: ["通常の販売管理に戻る", "Return to Sales Management", "返回销售管理"],
    loading: ["読み込み中…", "Loading…", "正在加载…"], error: ["処理できませんでした。もう一度お試しください。", "The request failed. Try again.", "处理失败，请重试。"],
    denied: ["システム管理者の権限が必要です。", "System administrator access is required.", "需要系统管理员权限。"],
    missing: ["未取得", "Not retrieved", "未获取"], blank: ["空欄", "Blank", "空白"],
    valid: ["カルテ番号の下12桁以内の数字（例 22）か、ハイフン付きの全番号を入力してください。", "Enter up to 12 digits (e.g. 22) or the full Karte number with its hyphen.", "请输入最多 12 位数字（例如 22），或含连字符的完整卡片编号。"],
    noRows: ["登録済みのカルテはありません。", "No registered Karte records.", "暂无已登记的卡片。"],
    unknown: ["商品未確定", "Product unconfirmed", "商品未确认"], updated: ["最終確認", "Last observed", "最后核对"],
    close: ["閉じる", "Close", "关闭"], previous: ["前へ", "Previous", "上一页"], next: ["次へ", "Next", "下一页"],
    refresh: ["部品詳細の更新を依頼", "Request a part detail refresh", "申请更新零件详情"],
    manage: ["取得依頼・確認データ取込", "Refresh requests & verified import", "更新申请和已核验导入"],
    partDetail: ["部品詳細", "Part details", "零件详情"],
    recordTools: ["カルテの取得・紐付け", "Karte retrieval and linking", "获取与关联卡片"],
    sourceStateGroup: ["情報・状態", "Information and status", "信息和状态"],
    sourceIdentifiers: ["品番・日付", "Part numbers and dates", "品号和日期"],
    photos: ["写真", "Photos", "照片"],
    noPhoto: ["表示できる写真がありません。", "No photos are available.", "暂无可显示的照片。"],
    photoFull: ["画像を拡大", "Open full-size image", "放大图片"],
    link: ["商品との紐付け", "Product link", "关联商品"], variant: ["商品種別ID", "Product variant ID", "商品类别 ID"],
    linkNote: ["D-CATS側の紐付けメモ", "D-CATS link note", "D-CATS 关联备注"], save: ["紐付けを保存", "Save link", "保存关联"],
    invalidVariant: ["商品種別IDを半角数字で入力してください。", "Enter a numeric product variant ID.", "请输入数字商品类别 ID。"],
    saved: ["保存しました。", "Saved.", "已保存。"], batch: ["取得依頼を登録", "Queue refresh requests", "登记更新申请"],
    batchHelp: ["登録済みカルテを番号または100件以内の範囲で指定します。", "Enter a registered Karte number or a range of up to 100.", "请输入已登记的卡片编号或不超过100条的范围。"],
    rangeFrom: ["開始カルテ番号", "Start Karte number", "起始卡片编号"],
    rangeTo: ["終了カルテ番号（範囲指定時）", "End Karte number (for a range)", "结束卡片编号（范围时）"],
    rangeInvalid: ["同じ接頭番号の範囲を、開始番号から100件以内で指定してください。", "Use the same prefix and a range of up to 100 numbers.", "请指定相同前缀且不超过100条的号码范围。"],
    rangeRegistered: ["{count}件の取得依頼を登録しました。", "Queued {count} retrieval requests.", "已登记 {count} 条获取请求。"],
    importTitle: ["Recycle+で確認したデータ", "Data verified in Recycle+", "在 Recycle+ 核验的数据"],
    importHelp: ["取得依頼は、Recycle+の部品詳細を確認し、その結果を取り込むと完了します。取り込む前に差分を確認できます。", "A request completes when verified Recycle+ part details are imported. Review changes before applying.", "导入经过核验的 Recycle+ 零件详情后，更新申请完成。导入前可以检查差异。"],
    review: ["差分を確認", "Review changes", "预览差异"], apply: ["確認した差分を反映", "Apply reviewed changes", "应用已核验差异"],
    noDiff: ["値の変更なし", "No value change", "数值未改变"], invalidFile: ["取込用のJSONファイルを選択してください。", "Select a JSON import file.", "请选择 JSON 导入文件。"],
    rejected: ["差分の確認後に内容が変わりました。再度差分を確認してください。", "Data changed after review. Review the changes again.", "数据在预览后发生变化。请重新检查差异。"],
    details: ["更新差分", "Changes", "变更"], source: ["出典", "Source", "来源"]
  };

  const groups = [
    ["part", {part_number:"品番", alternate_karte_number:"任意カルテ番号", part_category:"部品区分", part_name:"部品名", oe_part_number:"純正品番", maker_part_number:"メーカー品番", brand:"メーカー", specification:"仕様", auxiliary_part_number:"補足品番", ps_number:"PS番号", same_day_shipping:"当日出荷可", part_frame_number:"フレームNo.", part_mileage:"キロ数[Km]", source_updated_at:"更新日"}],
    ["vehicle", {donor_number:"車両カルテ番号", vehicle_name:"車名", vehicle_model:"型式", chassis_number:"車台番号", vehicle_grade:"グレード", first_registration:"初度登録", mileage:"走行距離", engine:"エンジン型式", transmission:"ミッション", drive:"駆動", color:"カラー", model_designation:"型式指定", classification:"類別区分", vehicle_body:"形状", fuel:"燃料", year:"年式", displacement:"排気量", generation:"期別"}],
    ["condition", {part_condition:"部品状態", quality:"品質", test_result:"動作確認", warranty:"保証", defects:"損傷・注意点", inspection:"検品", quality_kind:"種別", inventory_quality:"品質（在庫）", source_state:"状態", source_information:"情報"}],
    ["pricing", {sale_price:"販売価格", wholesale_price:"卸価格", shipping_fee:"送料", shipping_size:"送料サイズ", tax:"税区分", price_note:"価格備考", inventory_sale_price:"販売金額"}],
    ["stock", {stock_quantity:"在庫数", shelf:"棚番", location:"拠点", listing_status:"出品状況", available_quantity:"有効在庫", first_listed_at:"出品日", stock_status:"在庫状況", recovered_at:"入庫日", inventory_note:"在庫備考", shipped_quantity:"出庫", received_quantity:"入庫", allocated_quantity:"引当", temporarily_held_quantity:"仮押", proposed_quantity:"提案中", inventory_vehicle_name:"車名（在庫）", inventory_vehicle_model:"型式（在庫）", warehouse:"倉庫"}],
    ["office", {office_name:"事業所名", office_code:"事業所コード", office_postal_code:"郵便番号", office_address:"住所", office_phone:"電話番号", office_fax:"FAX番号", office_email:"Email", office_site:"URL", office_group:"グループ", office_system:"システム", office_psf:"PSF利用", office_quality_rule:"品質規定", producer:"生産担当者", temporary_hold_at:"仮押日", temporary_hold_by:"仮押担当者"}],
    ["notes", {components:"構成部品", source_photo:"Recycle+の写真", memo:"メモ", remarks:"備考", listing_note:"出品備考", internal_note:"社内備考"}]
  ];

  const allFields = Object.assign({}, ...groups.map(([, fields]) => fields));
  const partDetailSummary = [
    [["part_category", "part_name"], "部品"],
    [["sale_price"], "価格"],
    [["shipping_fee"], "送料"],
    [["quality"], "品質"],
    [["quality_kind"], "種別"]
  ];
  const partDetailGroups = [
    ["part", {
      karte_number:"カルテ番号", alternate_karte_number:"任意カルテ番号", ps_number:"PS番号",
      warehouse:"倉庫", shelf:"棚番", part_number:"品番"
    }],
    ["vehicle", {
      classification:"類別型式", vehicle_model:"型式", vehicle_name:"車種名",
      vehicle_body:"形状", engine:"エンジン", transmission:"ミッション", vehicle_grade:"グレード",
      fuel:"燃料", drive:"駆動方式", year:"年式", displacement:"排気量", generation:"期別", mileage:"走行距離[km]"
    }],
    ["sourceStateGroup", {components:"構成部品", source_information:"情報", source_state:"状態"}],
    ["sourceIdentifiers", {
      oe_part_number:"カーメーカーNo.", brand:"パーツメーカー名", same_day_shipping:"当日出荷可",
      maker_part_number:"パーツメーカーNo.", part_frame_number:"フレームNo.", first_listed_at:"公開日",
      "追加・摘要5":"摘要5", part_mileage:"キロ数[Km]", recovered_at:"入庫日",
      "追加・摘要7":"摘要7", "追加・摘要8":"摘要8", source_updated_at:"更新日"
    }]
  ];
  const $ = (id) => document.getElementById(id);
  const screen = $("screen-search");
  const menu = $("menu-grid");
  const panel = $("panel");
  const panelTitle = $("panel-topbar-title");
  const searchHeader = screen?.querySelector(".search-header");
  const productIdentity = $("sales-product-identity");
  const conditions = $("panel-right");
  const shippingEstimate = $("sales-shipping-estimate-section");
  const market = $("sales-conditions-market");
  if (!searchHeader || !panel || !panelTitle || !productIdentity || !conditions || !shippingEstimate || !market || !menu) return;

  let active = false;
  let epoch = 0;
  let lookups = 0;
  let displayedDetail = null;
  let lastViewedKarte = "";
  let details = null;
  let dialogOrigin = null;

  function tr(key) {
    const lang = document.documentElement.lang;
    return labels[key]?.[lang.startsWith("zh") ? 2 : lang === "ja" ? 0 : 1] || key;
  }

  function element(tag, {text, className, ...attributes} = {}, ...children) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
    node.append(...children);
    return node;
  }

  function button(key, click, attrs = {}) {
    const node = element("button", {type:"button", text:tr(key), ...attrs});
    if (click) node.addEventListener("click", click);
    return node;
  }

  function mayEnter() {
    return typeof userProfile !== "undefined" && !!userProfile &&
      (isSystemAdmin() && canViewProductSearch()) &&
      (!userProfile.status || userProfile.status === "active") &&
      accessRoleCode(userProfile) === "system_admin";
  }

  function canShow() {
    return active && mayEnter() && screen.classList.contains("active") &&
      !isCustomerPortalSearchMode();
  }

  function currentId() {
    return currentProduct ? String(productDkdId(currentProduct) || "") : "";
  }

  function normalizeNumber(value) {
    return String(value).normalize("NFKC").trim().replace(/[‐‑–−]/g, "-");
  }

  const numberPattern = /^[0-9]{5}-[0-9]{12}$/;

  function normalizeLookupNumber(value) {
    const normalized = normalizeNumber(value);
    return /^[0-9]{1,12}$/.test(normalized) ? "00000-" + normalized.padStart(12, "0") : normalized;
  }
  function selectedKarteNumbers(first, last) {
    const start = normalizeLookupNumber(first);
    const end = last.trim() ? normalizeLookupNumber(last) : start;
    if (!numberPattern.test(start) || !numberPattern.test(end)) return [];
    const prefix = start.slice(0, 6);
    const from = Number(start.slice(6));
    const through = Number(end.slice(6));
    const size = through - from + 1;
    if (!end.startsWith(prefix) || size < 1 || size > 100) return [];
    return Array.from({length:size}, (_, index) => prefix + String(from + index).padStart(12, "0"));
  }

  const time = value => value ? new Date(value).toLocaleString(document.documentElement.lang) : tr("missing");
  const codeText = value => value === "" ? tr("blank") : value;
  const fieldLabel = key => document.documentElement.lang === "ja" ? allFields[key] || key.replace(/^追加[．・]/, "") : key.replace(/^追加[．・]/, "").replace(/_/g, " ");

  async function rpc(name, args) {
    if (!canShow()) throw Object.assign(new Error("Access denied"), {code:"42501"});
    const run = epoch;
    const result = await sb.rpc("dcats_recycle_karte_" + name, args);
    if (run !== epoch || !canShow()) throw Object.assign(new Error("Preview closed"), {code:"closed"});
    if (result.error) throw result.error;
    return result.data;
  }

  function errorText(error) {
    if (error?.code === "42501") return tr("denied");
    if (error?.code === "40001") return tr("rejected");
    return tr("error");
  }

  const input = element("input", {id:"recycle-karte-number", type:"search", className:"search-input",
    inputmode:"search", placeholder:tr("numberExample"), "aria-label":tr("search"), maxlength:"22", autocomplete:"off"});
  const submit = button("submit", null, {type:"submit", className:"btn-search", "aria-label":tr("searchOpen")});
  const options = button("workspaceTools", event => openTools(event.currentTarget), {
    className:"search-clear-btn recycle-karte-options", text:"…", "aria-label":tr("workspaceTools"),
    title:tr("workspaceTools"), "aria-haspopup":"dialog"
  });
  const searchForm = element("form", {className:"search-row recycle-karte-form", hidden:""}, input, submit, options);
  searchHeader.append(searchForm);
  const inventoryButton = button("inventoryOpen", () => openInventory(inventoryButton));
  const tools = element("div", {className:"recycle-karte-controls"},
    button("manage", event => void openManage(event.currentTarget)), inventoryButton,
    button("exit", () => {
      reset();
      partSearchInput?.focus({preventScroll:true});
    }));
  const relatedLauncher = button("related", event => openProductList(event.currentTarget), {
    className:"search-clear-btn recycle-karte-detail-launcher", "aria-haspopup":"dialog"
  });
  const relatedSlot = element("span", {className:"recycle-karte-launcher-slot", hidden:""}, relatedLauncher);
  panelTitle.after(relatedSlot);

  const sidebarOpen = button("productListTitle", event => openProductList(event.currentTarget), {className:"recycle-karte-sidebar-open", "aria-haspopup":"dialog"});
  const sidebarTitle = element("h3", {id:"recycle-karte-sidebar-title"}, sidebarOpen);
  const sidebarMatch = element("small", {className:"recycle-karte-match", hidden:""});
  const sidebarHeaders = ["karteNo", "oeNumber", "makerNumber", "detail"].map(key =>
    element("th", {scope:"col", text:tr(key)}));
  const sidebarRows = element("tbody");
  const sidebarStatus = element("div", {className:"recycle-karte-sidebar-status", role:"status"});
  const sidebarMarker = element("div", {className:"recycle-karte-scroll-marker", "aria-hidden":"true", hidden:""});
  const sidebarScroll = element("div", {className:"recycle-karte-sidebar-scroll", tabindex:"0", role:"region",
    "aria-labelledby":sidebarTitle.id},
    element("table", {className:"recycle-karte-sidebar-table"},
      element("thead", {}, element("tr", {}, ...sidebarHeaders)), sidebarRows),
    sidebarStatus, sidebarMarker);
  const sidebar = element("aside", {className:"recycle-karte-sidebar", "aria-labelledby":sidebarTitle.id, hidden:""},
    element("div", {className:"recycle-karte-sidebar-head"}, sidebarTitle, sidebarMatch), sidebarScroll);
  const shippingColumn = element("div", {className:"recycle-karte-shipping-column"});
  shippingEstimate.before(shippingColumn);
  shippingColumn.append(shippingEstimate, sidebar);
  const rightColumn = window.matchMedia("(min-width: 981px)");
  let sidebarKey = "";
  let sidebarState = null;
  const sidebarVisibility = new IntersectionObserver(entries => {
    const state = sidebarState;
    if (!state || sidebar.hidden) return;
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      if (entry.target === sidebarMarker) {
        void readSidebarPage(state);
      } else {
        sidebarVisibility.unobserve(entry.target);
        const row = state.pending.get(entry.target);
        state.pending.delete(entry.target);
        if (row) void readSidebarNumbers(state, row);
      }
    }
  }, {root:sidebarScroll, rootMargin:"0px 0px 12px 0px"});
  const partSearchInput = $("q");
  let partLookupRequest = 0;
  const partLookupStatus = element("p", {className:"recycle-karte-status", role:"status"});
  const partLookupFirst = button("detail", null, {hidden:""});
  const partLookupResults = button("partLookupList", null, {hidden:""});
  const partLookup = element("section", {className:"recycle-karte-product", hidden:""},
    partLookupStatus, element("div", {className:"recycle-karte-controls"}, partLookupFirst, partLookupResults));

  function positionRelated() {
    const id = canShow() ? currentId() : "";
    const wide = Boolean(id && rightColumn.matches && !conditions.classList.contains("sales-conditions-without-price"));
    shippingColumn.classList.toggle("recycle-karte-shipping-column-active", wide);
    sidebar.hidden = !wide;
    if (wide) {
      const b = sidebar.getBoundingClientRect();
      sidebar.hidden = !b.width || b.bottom > panel.getBoundingClientRect().bottom || sidebarScroll.clientHeight < 34;
    }
    relatedSlot.hidden = !id || !sidebar.hidden;
    if (!relatedSlot.hidden) {
      const title = document.createRange();
      title.selectNodeContents(panelTitle);
      relatedLauncher.textContent = tr("related");
      relatedLauncher.hidden = false;
      relatedLauncher.hidden = relatedLauncher.getBoundingClientRect().left < title.getBoundingClientRect().right + 4;
    }
  }

  function syncWorkspace(refresh = false) {
    const enabled = canShow();
    searchForm.hidden = !enabled;
    if (enabled) {
      input.placeholder = tr("numberExample");
      input.setAttribute("aria-label", tr("search"));
      submit.textContent = tr("submit");
      submit.setAttribute("aria-label", tr("searchOpen"));
      options.setAttribute("aria-label", tr("workspaceTools"));
      options.title = tr("workspaceTools");
      sidebarOpen.textContent = tr("productListTitle");
      ["karteNo", "oeNumber", "makerNumber", "detail"].forEach((key, i) => { sidebarHeaders[i].textContent = tr(key); });
    }
    const id = enabled && rightColumn.matches ? currentId() : "";
    const part = id ? selectedPartNumber() : "";
    const key = id && id + "|" + part;
    if (refresh === true || key !== sidebarKey) {
      sidebarKey = key;
      resetSidebar(id, part);
    }
    positionRelated();
  }

  function openTools(origin) {
    if (!canShow()) return;
    const {body} = dialog(tr("workspaceTools"), origin);
    body.append(partLookup, tools);
    const number = lastViewedKarte || normalizeLookupNumber(input.value);
    if (numberPattern.test(number)) {
      const recordTools = button("recordTools", event => void openRecordTools(number, event.currentTarget),
        {text:tr("recordTools") + " · " + number});
      body.append(element("div", {className:"recycle-karte-controls"}, recordTools));
    }
  }

  function reset() {
    active = false;
    epoch++;
    lookups++;
    clearPartLookup();
    input.value = "";
    lastViewedKarte = "";
    searchForm.removeAttribute("aria-busy");
    syncWorkspace();
    details?.close();
    displayedDetail = null;
  }

  function syncMenu() {
    const regular = menu.querySelector("[data-action='search']");
    const shortcut = menu.querySelector(".recycle-karte-menu");
    if (shortcut && (!mayEnter() || !regular)) shortcut.remove();
    if (!regular || shortcut || !mayEnter()) return;
    const preview = button("preview", async () => {
      if (!mayEnter()) return;
      reset();
      const run = epoch;
      active = true;
      try {
        await enterSearch();
        if (run !== epoch || !canShow()) return;
        syncWorkspace();
      } catch {
        if (run === epoch) reset();
      }
    }, {className:"menu-card recycle-karte-menu"});
    preview.replaceChildren(element("span", {className:"menu-card-title", text:tr("preview")}));
    regular.after(preview);
  }

  function pager(page, more, select) {
    if (page === 0 && !more) return "";
    return element("nav", {className:"recycle-karte-pager", "aria-label":tr("list")},
      button("previous", () => select(page - 1), page === 0 ? {disabled:""} : {}),
      element("span", {text:String(page + 1)}),
      button("next", () => select(page + 1), !more ? {disabled:""} : {}));
  }

  function resultPageSize() {
    return window.matchMedia("(max-width: 480px), (max-height: 620px)").matches ? 3 : pageSize;
  }

  function partNumberQuery(value) {
    const part = String(value || "").normalize("NFKC").trim();
    return /^[A-Z0-9][A-Z0-9 \u002d\u2010\u2011\u2013\u2212]{1,79}$/i.test(part) && /[0-9]/.test(part) ? part : "";
  }

  function selectedPartNumber() {
    const primary = partNumberQuery(salesDetailPrimaryPartNumber(currentProduct));
    const typed = partNumberQuery(partSearchInput?.value);
    const standardize = value => value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const numbers = [primary, currentProduct.genuine_part_number, currentProduct.genuine_part_number_2,
      currentProduct.manufacturer_part_number].map(partNumberQuery);
    return typed && numbers.some(number => number && standardize(number) === standardize(typed)) ? typed : primary;
  }

  function openProductList(origin, id = currentId()) {
    if (!canShow() || !id) return;
    const {body, modal} = dialog(tr("productListTitle"), origin);
    const list = element("div", {className:"recycle-karte-list", "aria-live":"polite"});
    body.append(list);
    const part = String(id) === currentId() ? selectedPartNumber() : "";
    populateRelatedList(list, id, part, resultPageSize(), () => details === modal && canShow());
  }

  async function relatedPage(id, part, offset, limit, usePart, current) {
    const rows = usePart ? [] : await rpc("read", {p_product:id, p_offset:offset});
    if (!current()) return null;
    if (usePart || (!offset && !rows.length && part)) {
      const result = await rpc("read_part", {p_part:part, p_offset:offset});
      return current() ? {rows:result.items.slice(0, limit), count:result.total,
        more:result.total > offset + limit, usePart:true} : null;
    }
    const count = rows[0]?.related_count;
    return {rows:rows.slice(0, limit), count,
      more:count == null ? rows.length > limit : Number(count) > offset + limit, usePart:false};
  }

  function resetSidebar(id, part) {
    sidebarVisibility.disconnect();
    sidebarRows.replaceChildren();
    sidebarStatus.replaceChildren();
    sidebarMatch.hidden = true;
    sidebarMarker.hidden = !id;
    sidebarScroll.scrollTop = 0;
    sidebarState = id ? {id, part, offset:0, more:true, usePart:false, busy:false, pending:new Map(), seen:new Set()} : null;
    if (sidebarState) sidebarVisibility.observe(sidebarMarker);
  }

  function renderSidebarRow(state, row) {
    const cells = ["oe_part_number", "maker_part_number"].map(key =>
      element("td", {text:Object.hasOwn(row, key) ? row[key] || "—" : "…"}));
    const line = element("tr", {},
      element("th", {scope:"row", text:row.karte_number}), ...cells,
      element("td", {}, button("detail", e => void openDetail(row.karte_number, e.currentTarget), {
        className:"recycle-karte-table-detail", "aria-label":tr("detail") + " " + row.karte_number
      })));
    sidebarRows.append(line);
    if (Object.hasOwn(row, "oe_part_number") && Object.hasOwn(row, "maker_part_number")) return;
    state.pending.set(line, {number:row.karte_number, cells});
    sidebarVisibility.observe(line);
  }

  async function readSidebarNumbers(state, row) {
    try {
      const [detail] = await rpc("read", {p_karte:row.number, p_detail:true});
      if (sidebarState !== state) return;
      [row.cells[0].textContent, row.cells[1].textContent] =
        ["oe_part_number", "maker_part_number"].map(key => detail?.fields?.[key]?.value || "—");
    } catch (error) {
      if (sidebarState === state && error?.code !== "closed") {
        for (const cell of row.cells) cell.textContent = tr("sourceFailedShort");
      }
    }
  }

  async function readSidebarPage(state) {
    if (sidebar.hidden || state.busy || !state.more) return;
    state.busy = true;
    sidebarVisibility.unobserve(sidebarMarker);
    sidebarStatus.textContent = tr("loading");
    try {
      const page = await relatedPage(state.id, state.part, state.offset, pageSize, state.usePart, () => sidebarState === state);
      if (!page) return;
      state.usePart = page.usePart;
      state.more = page.more && page.rows.length > 0;
      state.offset += page.rows.length;
      const amount = page.count == null ? "" : tr("countShort").replace("{count}", String(page.count));
      sidebarMatch.textContent = [page.usePart ? tr("partMatch") : "", amount].filter(Boolean).join(" · ");
      sidebarMatch.hidden = !sidebarMatch.textContent;
      for (const row of page.rows) {
        if (state.seen.has(row.karte_number)) continue;
        state.seen.add(row.karte_number);
        renderSidebarRow(state, row);
      }
      sidebarStatus.textContent = state.seen.size ? "" : tr("noRows");
      sidebarMarker.hidden = !state.more;
      if (state.more) sidebarVisibility.observe(sidebarMarker);
    } catch (error) {
      if (sidebarState === state && error?.code !== "closed") {
        sidebarStatus.replaceChildren(errorText(error), button("retry", () => void readSidebarPage(state)));
      }
    } finally {
      state.busy = false;
    }
  }

  function populateRelatedList(list, id, part, perPage, isCurrent) {
    let pageRequest = 0;
    let usePart = false;
    async function showPage(pageNumber) {
      const run = ++pageRequest;
      const current = () => isCurrent() && run === pageRequest;
      list.textContent = tr("loading");
      try {
        const page = await relatedPage(id, part, pageNumber * perPage, perPage, usePart, current);
        if (!page) return;
        usePart = page.usePart;
        list.replaceChildren();
        if (!page.rows.length) list.textContent = tr("noRows");
        else if (page.count != null) list.append(element("p", {className:"recycle-karte-status",
          text:tr("partLookupCount").replace("{count}", String(page.count))}));
        if (usePart && page.rows.length) {
          list.append(element("small", {className:"recycle-karte-match", text:tr("partMatch")}));
        }
        for (const row of page.rows) {
          const summary = element("div", {className:"recycle-karte-list-summary"},
            element("strong", {text:row.karte_number}),
            element("span", {text:[row.part_name || row.part_number || tr("missing"), row.vehicle_model].filter(Boolean).join(" · ")}),
            element("small", {text:row.master_product_id ? tr("masterOnly") :
              usePart && !row.link_active ? tr("unknown") : productKindLabel(row.product_kind)}));
          list.append(element("div", {className:"recycle-karte-result"}, summary,
            button("detail", event => void openDetail(row.karte_number, event.currentTarget),
              {"aria-label":tr("detail") + " " + row.karte_number})));
        }
        const navigation = pager(pageNumber, page.more, showPage);
        if (navigation) list.append(navigation);
      } catch (error) {
        if (current() && error?.code !== "closed") list.textContent = errorText(error);
      }
    }
    void showPage(0);
  }

  function clearPartLookup() {
    partLookupRequest++;
    partLookup.hidden = true;
    partLookupStatus.textContent = "";
    partLookupFirst.hidden = true;
    partLookupResults.hidden = true;
  }

  function searchPartLookup() {
    clearPartLookup();
    if (!canShow()) return;
    const part = partNumberQuery(partSearchInput?.value);
    if (!part) return;
    const run = partLookupRequest;
    partLookup.hidden = false;
    partLookupStatus.textContent = tr("loading");
    void rpc("read_part", {p_part:part, p_offset:0}).then(data => {
      if (run !== partLookupRequest || !canShow()) return;
      partLookupStatus.textContent = tr("partLookupCount").replace("{count}", String(data.total));
      if (!data.items.length) return;
      const [first] = data.items;
      partLookupFirst.textContent = tr("detail") + " " + first.karte_number;
      partLookupFirst.onclick = () => void openDetail(first.karte_number, partLookupFirst);
      partLookupFirst.hidden = false;
      partLookupResults.onclick = () => openPartResults(part, data);
      partLookupResults.hidden = false;
    }).catch(error => {
      if (run === partLookupRequest && error?.code !== "closed") partLookupStatus.textContent = errorText(error);
    });
  }

  function openPartResults(part, firstPage) {
    if (!canShow()) return;
    const {body, modal} = dialog(tr("partLookupList") + " · " + part, partLookupResults);
    const perPage = resultPageSize();
    let pageRequest = 0;
    async function showPage(page, initial) {
      const run = ++pageRequest;
      body.textContent = tr("loading");
      try {
        const data = initial ?? await rpc("read_part", {p_part:part, p_offset:page * perPage});
        if (details !== modal || pageRequest !== run) return;
        body.replaceChildren(element("p", {className:"recycle-karte-status", text:tr("partLookupCount").replace("{count}", String(data.total))}));
        data.items.slice(0, perPage).forEach(row => {
          const summary = element("div", {className:"recycle-karte-list-summary"},
            element("strong", {text:row.karte_number}),
            element("span", {text:[row.part_number || part, row.vehicle_model].filter(Boolean).join(" · ")}),
            element("small", {text:row.master_product_id ? tr("masterOnly") :
              row.link_active ? productKindLabel(row.product_kind) : tr("unknown")}));
          body.append(element("div", {className:"recycle-karte-result"}, summary,
            button("detail", () => void openDetail(row.karte_number, partLookupResults),
              {"aria-label":tr("detail") + " " + row.karte_number})));
        });
        const navigation = pager(page, data.total > (page + 1) * perPage, next => void showPage(next));
        if (navigation) body.append(navigation);
      } catch (error) {
        if (details === modal && pageRequest === run && error?.code !== "closed") body.textContent = errorText(error);
      }
    }
    void showPage(0, firstPage);
  }

  $("search-btn")?.addEventListener("click", searchPartLookup);
  $("clear-btn")?.addEventListener("click", clearPartLookup);
  partSearchInput?.addEventListener("input", clearPartLookup);
  partSearchInput?.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.isComposing) searchPartLookup();
  });

  searchForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (!canShow()) return;
    const lookup = ++lookups;
    const requested = normalizeLookupNumber(input.value);
    if (!numberPattern.test(requested)) {
      searchForm.removeAttribute("aria-busy");
      dialog(tr("search"), input).body.textContent = tr("valid");
      return;
    }
    const searchDialog = details;
    const isCurrent = () => lookup === lookups && details === searchDialog && canShow();
    const targetPress = searchRequestSeq;
    searchForm.setAttribute("aria-busy", "true");
    try {
      const [row] = await rpc("read", {p_karte:requested, p_detail:true});
      if (!isCurrent()) return;
      if (!row) {
        dialog(tr("search"), input).body.textContent = tr("noRows");
        return;
      }
      const productId = await lookupKarteProductId(row);
      if (!isCurrent()) return;
      if (productId && targetPress === searchRequestSeq) {
        try {
          await openProductByDkdId(productId);
          if (isCurrent() && currentId() === productId && row.product_kind &&
              row.link_active && String(row.dkd_shohin_id) === productId) {
            const selection = detailSecondaryRequestSeq;
            void productSearchDetailReadyPromise.then(() => {
              if (!canShow() || lookup !== lookups || selection !== detailSecondaryRequestSeq) return;
              const select = $("product-kind-select");
              if (!select || !Array.from(select.options).some(option => option.value === row.product_kind)) return;
              select.value = row.product_kind;
              select.dispatchEvent(new Event("change"));
            }).catch(() => {});
          }
        } catch { /* Keep the Recycle+ detail available. */ }
      }
      if (!isCurrent()) return;
      displayDetail(row, input, productId);
    } catch (error) {
      if (isCurrent() && error?.code !== "closed") dialog(tr("search"), input).body.textContent = errorText(error);
    } finally {
      if (lookup === lookups) searchForm.removeAttribute("aria-busy");
    }
  });

  function linkedKarteProductId(row) {
    return String(row.master_product_id || (row.link_active ? row.dkd_shohin_id : "") || "");
  }

  async function lookupKarteProductId(row) {
    const linked = linkedKarteProductId(row);
    if (linked) return linked;
    if (!partNumberQuery(row.fields?.oe_part_number?.value) ||
        !partNumberQuery(row.fields?.maker_part_number?.value)) return "";
    try {
      const result = await rpc("link_candidates", {p_karte:row.karte_number});
      if (result.state !== "matched" || result.items.length >= 25) return "";
      const ids = new Set(result.items.map(item => String(item.dkd_shohin_id || "")).filter(Boolean));
      return ids.size === 1 ? ids.values().next().value : "";
    } catch {
      return "";
    }
  }

  function karteProductAction(row, productId) {
    if (productId) {
      return button("dcatsProductDetail", async event => {
        const control = event.currentTarget;
        const modal = details;
        control.disabled = true;
        try {
          const productIsVisible = () => currentId() === productId && (isPC() || panel.classList.contains("show"));
          if (!productIsVisible()) await openProductByDkdId(productId);
          if (modal === details && productIsVisible()) modal.close();
          else if (control.isConnected) control.textContent = tr("error");
        } catch {
          if (control.isConnected) control.textContent = tr("error");
        } finally {
          if (control.isConnected) control.disabled = false;
        }
      });
    }
    const part = [row.fields?.oe_part_number?.value, row.fields?.part_number?.value,
      row.part_number, row.fields?.maker_part_number?.value].map(partNumberQuery).find(Boolean);
    if (!part || !partSearchInput) return null;
    return button("dcatsProductSearch", () => {
      if (!canShow()) return;
      details?.close();
      partSearchInput.value = part;
      clearPartLookup();
      partSearchInput.focus({preventScroll:true});
      void runProductSearch({resetLimit:true, resetFilter:true, logActivity:true, source:"karte"});
    });
  }

  function dialog(title, origin, isPartDetail = false) {
    const focusTarget = details?.contains(origin) ? dialogOrigin : origin;
    details?.close();
    details?.remove();
    const heading = element("h2", {id:"recycle-karte-dialog-title", text:title});
    const modal = element("dialog", {
      className:isPartDetail ? "recycle-karte-dialog recycle-karte-part-detail" : "recycle-karte-dialog",
      "aria-labelledby":heading.id
    });
    const body = element("div", {className:"recycle-karte-dialog-body"});
    modal.append(element("header", {className:"recycle-karte-dialog-head"}, heading,
      button("close", () => modal.close())), body);
    document.body.append(modal);
    modal.addEventListener("close", () => {
      modal.remove();
      if (details === modal) {
        details = null;
        displayedDetail = null;
        dialogOrigin = null;
        if (canShow() && focusTarget?.isConnected) {
          const covered = focusTarget === input && panel.classList.contains("show") && !relatedSlot.hidden;
          (covered ? relatedLauncher : focusTarget).focus({preventScroll:true});
        }
      }
    });
    details = modal;
    dialogOrigin = focusTarget;
    modal.showModal();
    return {body, modal};
  }

  async function openDetail(number, origin) {
    if (!canShow()) return;
    const {body, modal} = dialog(tr("partDetail"), origin, true);
    body.textContent = tr("loading");
    try {
      const [row] = await rpc("read", {p_karte:number, p_detail:true});
      if (details !== modal) return;
      if (row) renderDetail(row, body);
      else body.textContent = tr("noRows");
    } catch (error) {
      if (details === modal && error?.code !== "closed") body.textContent = errorText(error);
    }
  }

  function displayDetail(row, origin, productId) {
    const {body} = dialog(tr("partDetail"), origin, true);
    renderDetail(row, body, productId);
  }


  async function openRecordTools(number, origin) {
    if (!canShow()) return;
    const {body, modal} = dialog(tr("recordTools") + " · " + number, origin, true);
    body.textContent = tr("loading");
    try {
      const [row] = await rpc("read", {p_karte:number, p_detail:true});
      if (details !== modal) return;
      if (row) renderRecordTools(row, body);
      else body.textContent = tr("noRows");
    } catch (error) {
      if (details === modal && error?.code !== "closed") body.textContent = errorText(error);
    }
  }

  async function requestAutomatic(number, action) {
    if (!canShow()) throw Object.assign(new Error("Preview closed"), {code:"closed"});
    const sessionEpoch = epoch;
    const result = await sb.functions.invoke("dcats-recycle-karte-source", {body:{karte_number:number, ...(action ? {action} : {})}});
    if (sessionEpoch !== epoch || !canShow()) throw Object.assign(new Error("Preview closed"), {code:"closed"});
    if (result.error || !result.data?.state) throw result.error || new Error("No acquisition status");
    return result.data.state;
  }

  function acquisitionStatus(key, reason) {
    if (key === "failed") return tr(reason === "authentication" ? "sourceAuth" : "sourceFailed");
    if (["starting","running","start_unknown"].includes(key)) return tr("sourceRunning");
    if (key === "ready") return tr("sourceReady");
    if (key === "not_configured") return tr("sourceConfig");
    if (key === "capacity") return tr("sourceLimit");
    return "";
  }

  function renderDiffPage(panel, reviewed, paginate = true) {
    const changes = reviewed.flatMap(item => {
      const fields = Object.entries(item.changes);
      return fields.length ? fields.map(([key,field]) => [item.karte_number,key,field]) :
        [[item.karte_number,"",null]];
    });
    function changeBlock([number,key,value]) {
      const block = element("div", {className:"recycle-karte-change"},
        element("strong", {text:number}), element("p", {text:value ? fieldLabel(key) : tr("noDiff")}));
      if (value) {
        const before = value.before ? codeText(value.before.value) : tr("missing");
        const after = "→ " + codeText(value.after.value);
        for (const text of [before, after]) {
          block.append(paginate ? limitedValue(text) : element("div", {className:"recycle-karte-value", text}));
        }
      }
      return block;
    }
    if (!paginate) {
      panel.replaceChildren(...changes.map(changeBlock));
      return;
    }
    function show(index) {
      panel.replaceChildren(changeBlock(changes[index]));
      const navigation = pager(index, index < changes.length - 1, show);
      if (navigation) panel.append(navigation);
    }
    if (changes.length) show(0);
  }

  async function renderSourceReview(row, job, body) {
    const revision = document.createElement("div");
    const status = element("p", {role:"status", text:tr("loading")});
    const back = button("recordTools", () => renderRecordTools(row, body));
    const show = element("div", {className:"recycle-karte-diff"});
    revision.append(back, status, show);
    body.replaceChildren(revision);
    body.parentElement.scrollTop = 0;
    try {
      const review = await rpc("source_review", {
        p_karte:row.karte_number, p_job:job.job_id, p_action:"preview"
      });
      if (!revision.isConnected) return;
      status.textContent = tr("reviewSource");
      renderDiffPage(show, review, false);
      const apply = button("apply", async () => {
        apply.disabled = true;
        back.disabled = true;
        try {
          await rpc("source_review", {p_karte:row.karte_number, p_job:job.job_id, p_action:"apply", p_expected:review});
          const [updated] = await rpc("read", {p_karte:row.karte_number, p_detail:true});
          if (updated && revision.isConnected) {
            renderRecordTools(updated, body);
            const saved = body.querySelector("[role='status']");
            if (saved) saved.textContent = tr("saved");
          }
        } catch (error) {
          if (error?.code !== "closed") status.textContent = errorText(error);
        } finally {
          back.disabled = false;
        }
      });
      revision.prepend(element("div", {className:"recycle-karte-controls"}, back, apply));
    } catch (error) {
      if (error?.code !== "closed" && revision.isConnected) status.textContent = errorText(error);
    }
  }

  function renderRecordTools(row, body) {
    displayedDetail = row;
    const source = element("div", {className:"recycle-karte-meta"},
      element("span", {text:tr("updated") + " " + time(row.last_observed_at)}),
      element("span", {text:row.link_active ? "D-CATS " + row.dkd_shohin_id + " · " + productKindLabel(row.product_kind) : tr("unknown")}));
    const message = element("p", {role:"status", className:"recycle-karte-status", text:row.refresh_pending ? tr("pending") : ""});
    const refresh = button("sourceStart", async () => {
      refresh.disabled = true;
      message.textContent = tr("sourceRunning");
      try {
        const state = await requestAutomatic(row.karte_number);
        if (!message.isConnected) return;
        message.textContent = acquisitionStatus(state);
        if (!["starting","running","start_unknown","ready","failed"].includes(state)) {
          refresh.disabled = false;
          return;
        }
        await syncAcquisition();
      } catch (error) {
        if (error?.code !== "closed") message.textContent = errorText(error);
        refresh.disabled = false;
      }
    });
    const review = button("reviewSource", null, {hidden:""});
    let statusSequence = 0;
    let lastProviderCheck = 0;
    function updateAcquisition(job) {
      const {state, reason} = job;
      const waiting = ["starting","running","start_unknown"].includes(state);
      const text = acquisitionStatus(state, reason);
      if (text) message.textContent = text;
      refresh.disabled = waiting || state === "ready";
      review.hidden = state !== "ready";
      review.onclick = () => void renderSourceReview(row, job, body);
      return waiting;
    }
    async function syncAcquisition() {
      const token = ++statusSequence;
      if (!message.isConnected || displayedDetail !== row) return;
      try {
        let state = await rpc("source_status", {p_karte:row.karte_number});
        if (!message.isConnected || displayedDetail !== row || token !== statusSequence) return;
        const needsCheck = state.state === "running" || (state.state === "failed" && !state.reason);
        if (state.job_id && needsCheck && Date.now() - lastProviderCheck >= 30000) {
          lastProviderCheck = Date.now();
          const provider = await requestAutomatic(row.karte_number, "status").catch(() => null);
          if (provider === "ready" || provider === "failed") {
            state = await rpc("source_status", {p_karte:row.karte_number});
          }
        }
        if (!message.isConnected || displayedDetail !== row || token !== statusSequence) return;
        if (updateAcquisition(state)) window.setTimeout(() => void syncAcquisition(), 6000);
      } catch (error) {
        if (error?.code !== "closed") message.textContent = errorText(error);
      }
    }
    const controls = element("div", {className:"recycle-karte-controls"}, refresh, review);
    if (row.link_active && row.dkd_shohin_id) {
      controls.append(button("related", event => openProductList(event.currentTarget, row.dkd_shohin_id)));
    }
    const linkFields = element("div", {className:"recycle-karte-detail-fields"});
    const link = element("details", {className:"recycle-karte-part-disclosure"},
      element("summary", {text:tr("link")}), linkFields);
    link.addEventListener("toggle", () => {
      if (link.open && !linkFields.childElementCount && displayedDetail === row) renderLink(row, linkFields);
    });
    const toolbar = element("div", {className:"recycle-karte-part-toolbar"}, source, controls);
    body.replaceChildren(toolbar, message, link);
    body.parentElement.scrollTop = 0;
    void syncAcquisition();
  }

  function renderDetail(row, body, productId = linkedKarteProductId(row)) {
    displayedDetail = row;
    lastViewedKarte = row.karte_number;
    const productAction = karteProductAction(row, productId);
    if (productAction) {
      const header = body.parentElement.querySelector(".recycle-karte-dialog-head");
      header.append(element("div", {className:"recycle-karte-detail-actions"}, productAction, header.lastElementChild));
    }
    const summary = element("dl", {className:"recycle-karte-part-summary"});
    for (const [keys, name] of partDetailSummary) {
      summary.append(partDetailField(row, keys, name));
    }

    const gallery = element("aside", {className:"recycle-karte-gallery", "aria-label":tr("photos")});
    const record = element("div", {className:"recycle-karte-part-groups"}, summary);
    for (const [group, mapping] of partDetailGroups) {
      const entries = Object.entries(mapping).map(([key, name]) =>
        partDetailField(row, [key], name));
      record.append(element("section", {className:"recycle-karte-part-group"},
        element("h3", {text:tr(group)}), element("dl", {className:"recycle-karte-values"}, ...entries)));
    }

    body.replaceChildren(element("div", {className:"recycle-karte-detail-layout"}, gallery, record));
    body.parentElement.scrollTop = 0;
    void renderDetailGallery(row, gallery);
  }

  function partDetailField(row, keys, name) {
    const values = keys.map(key => {
      if (key === "karte_number") return row.karte_number;
      const field = row.fields?.[key] ?? row.fields?.[key.replace(/^追加・/, "追加．")];
      return field?.value;
    });
    const text = values.filter(value => value != null && value !== "").join(" ");
    const label = document.documentElement.lang === "ja" ? name :
      keys[0] === "karte_number" ? tr("karteNo") : fieldLabel(keys[0]);
    const wide = text.length > 60 || text.includes("\n") ||
      ["components", "source_information", "source_state"].includes(keys[0]);
    return element("div", {className:wide ? "recycle-karte-field-wide" : undefined},
      element("dt", {text:label}),
      element("dd", {text}));
  }

  async function renderDetailGallery(row, gallery) {
    const photos = element("div", {className:"recycle-karte-gallery-photos"});
    const status = element("p", {role:"status", text:tr(row.link_active ? "loading" : "noPhoto")});
    gallery.append(element("h3", {text:tr("photos")}), photos, status);
    if (!row.link_active) return;
    const images = await loadDetailPhotos(row).catch(() => []);
    if (!gallery.isConnected || displayedDetail !== row) return;
    for (const [index, {thumb, full}] of images.entries()) {
      const image = element("img", {src:thumb, loading:"lazy", decoding:"async",
        alt:tr("photos") + " " + (index + 1)});
      const expand = button("photoFull", async () => {
        expand.disabled = true;
        const url = await full().catch(() => "");
        if (!expand.isConnected || displayedDetail !== row) return;
        if (url) {
          image.src = url;
          expand.replaceWith(element("a", {href:url, target:"_blank", rel:"noopener", text:tr("photoFull")}));
        } else {
          expand.disabled = false;
        }
      });
      const figure = element("figure", {}, image, expand);
      image.addEventListener("error", () => {
        figure.remove();
        if (!photos.childElementCount) status.textContent = tr("noPhoto");
      });
      photos.append(figure);
    }
    status.textContent = images.length ? "" : tr("noPhoto");
  }

  function limitedValue(value) {
    const container = element("div", {className:"recycle-karte-value"});
    const chars = Array.from(String(value ?? "").replace(/\r?\n/g, " ↵ "));
    const size = 56;
    function show(page) {
      container.replaceChildren(element("span", {text:chars.slice(page * size, (page + 1) * size).join("")}),
        pager(page, chars.length > (page + 1) * size, show));
    }
    show(0);
    return container;
  }

  async function loadDetailPhotos(row) {
    const result = await fetchAllCoreProductImagesForContext(row.dkd_shohin_id, "sales");
    if (result.error) return [];
    const options = {width:360, height:360, resize:"contain"};
    const matches = (result.data || []).filter(img => normalizeProductKind(img.product_kind || "rebuilt") === row.product_kind);
    const photos = await Promise.all(matches.map(async img => {
      const path = productImageStoragePath(img);
      const thumb = (path && await signProductImageUrl(path, options)) || productImageFallbackUrl(img, options);
      const full = () => path ? signProductImageUrl(path, {}) : Promise.resolve(safeSupabaseImageUrl(img.image_url));
      return thumb ? {thumb, full} : null;
    }));
    return photos.filter(Boolean);
  }

  function renderLink(row, area) {
    const variant = element("input", {type:"text", inputmode:"numeric", maxlength:"19", value:row.product_variant_id || ""});
    const note = element("input", {type:"text", maxlength:"500", value:row.link_note || ""});
    const state = element("p", {role:"status"});
    const save = button("save", async () => {
      const id = variant.value.trim();
      if (id && !/^[0-9]{1,19}$/.test(id)) {
        state.textContent = tr("invalidVariant");
        variant.focus();
        return;
      }
      save.disabled = true;
      try {
        await rpc("link", {p_karte:row.karte_number, p_variant:id || null, p_note:note.value});
        syncWorkspace(true);
        state.textContent = tr("saved");
        const [updated] = await rpc("read", {p_karte:row.karte_number, p_detail:true});
        if (displayedDetail === row && updated) {
          const parent = area.closest(".recycle-karte-dialog-body");
          renderRecordTools(updated, parent);
          parent.querySelector("[role=status]").textContent = tr("saved");
        }
      } catch (error) {
        if (error?.code !== "closed") state.textContent = errorText(error);
      } finally { save.disabled = false; }
    });
    area.append(element("label", {text:tr("variant")}, variant), element("label", {text:tr("linkNote")}, note), save, state);

    const matches = element("section", {className:"recycle-karte-detail-fields"});
    const matching = element("p", {role:"status", text:tr("loading")});
    matches.append(
      element("p", {text:tr("sourceOe") + " · " + (row.fields?.oe_part_number?.value || tr("missing"))}),
      element("p", {text:tr("sourceMaker") + " · " + (row.fields?.maker_part_number?.value || tr("missing"))}),
      matching);
    if (row.master_product_id) matches.append(element("p", {text:"D-CATS " + row.master_product_id + " · " + tr("masterOnly")}));
    area.prepend(matches);
    void rpc("link_candidates", {p_karte:row.karte_number}).then(data => {
      if (displayedDetail !== row || !matches.isConnected) return;
      if (data.state !== "matched") {
        matching.textContent = row.master_product_id ? "" : tr(data.state === "missing_fields" ? "matchMissing" : "matchNone");
        return;
      }
      matching.textContent = "";
      const select = element("select", {}, element("option", {value:"", text:"—"}));
      data.items.forEach(item => select.append(element("option", {value:item.product_variant_id,
        text:"D-CATS " + item.dkd_shohin_id + " · " + productKindLabel(item.product_kind) + " · " + item.product_variant_id})));
      select.addEventListener("change", () => {
        if (select.value) variant.value = select.value;
      });
      matches.append(element("label", {text:tr("matchCandidates")}, select));
    }).catch(error => {
      if (error?.code !== "closed" && matches.isConnected) matching.textContent = errorText(error);
    });
  }


  function inventoryMessage(work) {
    const count = String(work.checked_count || 0);
    const total = work.total == null ? "—" : String(work.total);
    const progress = tr("inventoryCount").replace("{count}", count).replace("{total}", total);
    if (work.state === "idle") return tr("inventoryIdle");
    if (work.state === "ready") {
      const ready = tr("inventoryReady").replace("{count}", count);
      const {appeared, absent} = work.comparison || {};
      if (!Number.isSafeInteger(appeared) || appeared < 0 || !Number.isSafeInteger(absent) || absent < 0) return ready;
      return ready + " " + tr("inventoryComparison").replace("{appeared}", String(appeared)).replace("{absent}", String(absent));
    }
    if (work.state === "not_configured") return tr("sourceConfig");
    if (work.state === "failed") {
      const reasonKeys = {
        authentication:"sourceAuth", incomplete:"inventoryIncomplete", source_changed:"inventoryChanged",
        policy:"inventoryPolicy", submission_unknown:"inventoryUncertain", capacity:"inventoryCapacity"
      };
      return progress + " · " + tr(reasonKeys[work.reason] || "inventoryStopped");
    }
    return progress;
  }

  function inventoryDetailMessage(work) {
    if (work.state !== "ready") return "";
    const {verified,total,pending,failed,blocked} = work.details || {};
    const values = {verified,total,pending,failed};
    if (!Object.values(values).every(value => Number.isSafeInteger(value) && value >= 0) ||
        verified + pending + failed !== total) return tr("inventoryDetailUntracked");
    let message = tr("inventoryDetailCount").replace(/\{(verified|total|pending|failed)\}/g, (_, key) => String(values[key]));
    const stop = {policy:"inventoryPolicy",authentication:"sourceAuth",submission_unknown:"inventoryUncertain"};
    if (Object.hasOwn(stop,blocked)) message += " " + tr(stop[blocked]);
    return message;
  }

  async function listDownload(work) {
    const records = [];
    for (let offset = 0; offset < work.total; offset += 100) {
      const page = await rpc("inventory_rows",{p_scan:work.scan_id,p_offset:offset});
      if (page.total !== work.total || !page.items.length) throw new Error("Inventory list changed");
      records.push(...page.items);
    }
    if (records.length !== work.total ||
        records.some((row,index) => Number(row.no) !== index + 1 || !numberPattern.test(row.karte_number))) {
      throw new Error("Unverified inventory coverage");
    }
    const csvCell = (value) => {
      let text = String(value ?? "");
      if (/^[=+@\u0009\u000d-]/.test(text)) text = "'" + text;
      return '"' + text.replaceAll('"','""') + '"';
    };
    const lines = [["No.","カルテ番号","品番","確認日時"],...records.map(row =>
      [row.no,row.karte_number,row.part_number,row.observed_at])];
    const url = URL.createObjectURL(new Blob(["\uFEFF",lines.map(row => row.map(csvCell).join(",")).join("\r\n"),"\r\n"],
      {type:"text/csv;charset=utf-8"}));
    const download = element("a",{href:url,download:"RecyclePlus-在庫一覧-" + work.scan_id.slice(0,8) + ".csv"});
    document.body.append(download);
    download.click();
    download.remove();
    window.setTimeout(() => URL.revokeObjectURL(url),1000);
  }

  function openInventory(origin) {
    if (!canShow()) return;
    const {body,modal} = dialog(tr("inventoryOpen"),origin);
    const message = element("p",{role:"status",className:"recycle-karte-help"});
    const detailMessage = element("p",{role:"status",className:"recycle-karte-help",hidden:""});
    const reload = button("inventoryRefresh",() => void refresh());
    const download = button("inventoryDownload",async () => {
      download.disabled = true;
      try { if (last?.state === "ready") await listDownload(last); }
      catch (error) { if (error?.code !== "closed") message.textContent = errorText(error); }
      finally { if (details === modal) download.disabled = false; }
    },{hidden:""});
    body.append(element("p",{className:"recycle-karte-help",text:tr("inventoryScope")}),
      message,detailMessage,element("div",{className:"recycle-karte-controls"},reload,download));
    let last = null;
    let timer = 0;
    modal.addEventListener("close", () => window.clearTimeout(timer));
    async function refresh() {
      if (reload.disabled || details !== modal || !canShow()) return;
      window.clearTimeout(timer);
      reload.disabled = true;
      try {
        const work = await rpc("inventory_latest",{});
        if (details !== modal) return;
        last = work;
        message.textContent = inventoryMessage(work);
        detailMessage.textContent = inventoryDetailMessage(work);
        detailMessage.hidden = !detailMessage.textContent;
        download.hidden = work.state !== "ready";
        if (work.state === "running") timer = window.setTimeout(() => void refresh(),18000);
      } catch (error) {
        if (details !== modal || error?.code === "closed") return;
        message.textContent = errorText(error);
        if (last?.state === "running") timer = window.setTimeout(() => void refresh(),30000);
      } finally { reload.disabled = false; }
    }
    void refresh();
  }

  async function openManage(origin) {
    const {body, modal} = dialog(tr("manage"), origin);
    const section = element("select", {"aria-label":tr("manage")},
      element("option", {value:"pending", text:tr("pending")}),
      element("option", {value:"batch", text:tr("batch")}),
      element("option", {value:"import", text:tr("review")}));
    const panel = element("section", {className:"recycle-karte-detail-fields"});
    let request = 0;

    async function pendingPage(page) {
      const token = ++request;
      panel.textContent = tr("loading");
      try {
        const rows = await rpc("pending", {p_offset:page * 6});
        if (details !== modal || token !== request || section.value !== "pending") return;
        panel.replaceChildren();
        if (!rows.length) panel.textContent = tr("noRows");
        rows.slice(0, 6).forEach(row => {
          panel.append(element("div", {className:"recycle-karte-result"},
            element("span", {text:row.karte_number}), element("small", {text:time(row.requested_at)})));
        });
        panel.append(pager(page, rows.length > 6, value => void pendingPage(value)));
      } catch (error) {
        if (token === request && error?.code !== "closed") panel.textContent = errorText(error);
      }
    }

    function renderBatch() {
      const attrs = {type:"search",inputmode:"numeric",maxlength:"22",placeholder:"22",autocomplete:"off"};
      const from = element("input",attrs);
      const through = element("input",{...attrs,placeholder:""});
      const note = element("p",{role:"status"});
      const range = element("div",{className:"recycle-karte-range"},
        element("label",{text:tr("rangeFrom")},from),element("label",{text:tr("rangeTo")},through));
      function numbers() {
        const selected = selectedKarteNumbers(from.value,through.value);
        if (!selected.length) {
          note.textContent = tr("rangeInvalid");
          from.focus();
        }
        return selected;
      }
      async function process(automatic) {
        const selected = numbers();
        if (!selected.length) return;
        if (automatic && selected.length > 3) {
          note.textContent = tr("sourceBatch");
          return;
        }
        send.disabled = fetchBatch.disabled = true;
        try {
          const count = await rpc("request",{p_numbers:selected});
          if (!note.isConnected) return;
          if (!automatic) {
            note.textContent = tr("rangeRegistered").replace("{count}",String(count));
            return;
          }
          const outcomes = await Promise.allSettled(selected.map(number => requestAutomatic(number)));
          if (!note.isConnected) return;
          note.textContent = outcomes.map((result,index) => {
            const state = result.status === "fulfilled" ? acquisitionStatus(result.value) : errorText(result.reason);
            return selected[index] + " · " + (state || tr("sourceRunning"));
          }).join("  ");
        } catch (error) {
          if (error?.code !== "closed" && note.isConnected) note.textContent = errorText(error);
        } finally { send.disabled = fetchBatch.disabled = false; }
      }
      const send = button("batch",() => void process(false));
      const fetchBatch = button("sourceBatch",() => void process(true));
      panel.append(element("p",{className:"recycle-karte-help",text:tr("batchHelp")}),range,
        element("div",{className:"recycle-karte-controls"},send,fetchBatch),note);
    }

    function renderImport() {
      const file = element("input", {type:"file", accept:".json,application/json"});
      const message = element("p", {role:"status", className:"recycle-karte-status"});
      const diff = element("div", {className:"recycle-karte-diff"});
      let reviewed = null;
      let previewed = null;
      const apply = button("apply", async () => {
        if (!reviewed || !previewed) return;
        apply.disabled = true;
        check.disabled = true;
        file.disabled = true;
        try {
          await rpc("import", {p_rows:reviewed, p_apply:true, p_expected:previewed});
          syncWorkspace(true);
          reviewed = previewed = null;
          message.textContent = tr("saved");
          diff.replaceChildren();
          file.value = "";
        } catch (error) {
          if (error?.code !== "closed") message.textContent = errorText(error);
          reviewed = previewed = null;
        } finally { check.disabled = file.disabled = false; }
      }, {disabled:""});
      const check = button("review", async () => {
        const selected = file.files[0];
        if (!selected || selected.size > 500000) {
          message.textContent = tr("invalidFile");
          return;
        }
        check.disabled = file.disabled = true;
        apply.disabled = true;
        try {
          const rows = JSON.parse(await selected.text());
          previewed = await rpc("import", {p_rows:rows, p_apply:false});
          reviewed = rows;
          message.textContent = previewed.length + " · " + tr("details");
          renderDiffPage(diff, previewed);
          apply.disabled = false;
        } catch (error) {
          message.textContent = error instanceof SyntaxError ? tr("invalidFile") : errorText(error);
        } finally { check.disabled = file.disabled = false; }
      });
      file.addEventListener("change", () => {
        reviewed = previewed = null;
        apply.disabled = true;
        diff.replaceChildren();
        message.replaceChildren();
      });
      panel.append(element("label", {text:tr("importTitle")}, file), element("div", {className:"recycle-karte-controls"}, check, apply), message, diff);
    }

    section.addEventListener("change", () => {
      request++;
      panel.replaceChildren();
      if (section.value === "pending") void pendingPage(0);
      else if (section.value === "batch") renderBatch();
      else renderImport();
    });
    body.append(element("p", {className:"recycle-karte-help", text:tr("importHelp")}), section, panel);
    void pendingPage(0);
  }

  const relatedResize = new ResizeObserver(positionRelated);
  [panelTitle, conditions, panel, shippingEstimate, market].forEach(node => relatedResize.observe(node));
  const selectionChanges = new MutationObserver(syncWorkspace);
  [panelTitle, productIdentity].forEach(node => selectionChanges.observe(node,
    {childList:true, characterData:true, subtree:true}));
  selectionChanges.observe(panel, {attributes:true, attributeFilter:["class"]});
  rightColumn.addEventListener("change", syncWorkspace);
  new MutationObserver(syncMenu).observe(menu, {childList:true, subtree:true});
  new MutationObserver(() => {
    if (active && !canShow()) reset();
  }).observe(screen, {attributes:true, attributeFilter:["class"]});
  sb.auth.onAuthStateChange(event => {
    if (event === "SIGNED_OUT") {
      reset();
      menu.querySelector(".recycle-karte-menu")?.remove();
    }
  });
  syncMenu();
})();
