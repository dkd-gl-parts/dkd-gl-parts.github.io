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
    sourceBack: ["カルテに戻る", "Return to Karte", "返回卡片"],
    sourceBatch: ["最大3件を自動取得", "Fetch up to three automatically", "自动获取最多三项"],
    partLookupCount: ["Recycle+カルテ {count}件", "Recycle+ Karte · {count} results", "Recycle+ 卡片 · {count} 条"],
    partLookupList: ["カルテ一覧", "Karte results", "卡片列表"],
    preview: ["販売管理（カルテ検索プレビュー）", "Sales Management (Karte preview)", "销售管理（卡片查询预览）"],
    search: ["カルテ番号検索", "Search Karte number", "查询卡片编号"],
    list: ["Recycle+カルテ", "Recycle+ Karte", "Recycle+ 卡片"],
    detail: ["詳細", "Details", "详情"], pending: ["部品詳細の取得待ち", "Waiting for part details", "等待获取零件详情"],
    exit: ["通常の販売管理に戻る", "Return to Sales Management", "返回销售管理"],
    loading: ["読み込み中…", "Loading…", "正在加载…"], error: ["処理できませんでした。もう一度お試しください。", "The request failed. Try again.", "处理失败，请重试。"],
    denied: ["システム管理者の権限が必要です。", "System administrator access is required.", "需要系统管理员权限。"],
    missing: ["未取得", "Not retrieved", "未获取"], blank: ["空欄", "Blank", "空白"],
    valid: ["カルテ番号を 00000-000000000000 の形式で入力してください。", "Enter a Karte number in 00000-000000000000 format.", "请输入 00000-000000000000 格式的卡片编号。"],
    noRows: ["登録済みのカルテはありません。", "No registered Karte records.", "暂无已登记的卡片。"],
    unknown: ["商品未確定", "Product unconfirmed", "商品未确认"], updated: ["最終確認", "Last observed", "最后核对"],
    close: ["閉じる", "Close", "关闭"], previous: ["前へ", "Previous", "上一页"], next: ["次へ", "Next", "下一页"],
    refresh: ["部品詳細の更新を依頼", "Request a part detail refresh", "申请更新零件详情"],
    manage: ["取得依頼・確認データ取込", "Refresh requests & verified import", "更新申请和已核验导入"],
    sourceList: ["在庫一覧", "Stock list", "库存一览"], sourceDetail: ["在庫入出庫 → 部品詳細", "Stock movements → Part details", "库存出入库 → 零件详情"],
    photos: ["D-CATSの商品画像", "D-CATS product image", "D-CATS 商品图片"],
    noPhoto: ["表示できるD-CATSの商品画像がありません。", "No D-CATS product image is available.", "暂无可显示的 D-CATS 商品图片。"],
    photoFull: ["画像を拡大", "Open full-size image", "放大图片"],
    link: ["商品との紐付け", "Product link", "关联商品"], variant: ["商品種別ID", "Product variant ID", "商品类别 ID"],
    linkNote: ["D-CATS側の紐付けメモ", "D-CATS link note", "D-CATS 关联备注"], save: ["紐付けを保存", "Save link", "保存关联"],
    invalidVariant: ["商品種別IDを半角数字で入力してください。", "Enter a numeric product variant ID.", "请输入数字商品类别 ID。"],
    saved: ["保存しました。", "Saved.", "已保存。"], batch: ["取得依頼を登録", "Queue refresh requests", "登记更新申请"],
    batchHelp: ["登録済みのカルテ番号を1行に1件、最大100件入力してください。", "Enter up to 100 registered Karte numbers, one per line.", "请输入最多 100 个已登记的卡片编号，每行一个。"],
    importTitle: ["Recycle+で確認したデータ", "Data verified in Recycle+", "在 Recycle+ 核验的数据"],
    importHelp: ["取得依頼は、Recycle+の部品詳細を確認し、その結果を取り込むと完了します。取り込む前に差分を確認できます。", "A request completes when verified Recycle+ part details are imported. Review changes before applying.", "导入经过核验的 Recycle+ 零件详情后，更新申请完成。导入前可以检查差异。"],
    review: ["差分を確認", "Review changes", "预览差异"], apply: ["確認した差分を反映", "Apply reviewed changes", "应用已核验差异"],
    noDiff: ["値の変更なし", "No value change", "数值未改变"], invalidFile: ["取込用のJSONファイルを選択してください。", "Select a JSON import file.", "请选择 JSON 导入文件。"],
    rejected: ["差分の確認後に内容が変わりました。再度差分を確認してください。", "Data changed after review. Review the changes again.", "数据在预览后发生变化。请重新检查差异。"],
    details: ["更新差分", "Changes", "变更"], source: ["出典", "Source", "来源"]
  };

  const groups = [
    ["part", {part_number:"品番", alternate_karte_number:"任意カルテ番号", part_category:"部品区分", part_name:"部品名", oe_part_number:"純正品番", maker_part_number:"メーカー品番", brand:"メーカー", specification:"仕様", auxiliary_part_number:"補足品番", ps_number:"PS番号", same_day_shipping:"当日出荷可", part_frame_number:"フレームNo.", part_mileage:"キロ数[Km]", source_updated_at:"更新日"}],
    ["pricing", {sale_price:"販売価格", wholesale_price:"卸価格", shipping_fee:"送料", shipping_size:"送料サイズ", tax:"税区分", price_note:"価格備考", inventory_sale_price:"販売金額"}],
    ["vehicle", {donor_number:"車両カルテ番号", vehicle_name:"車名", vehicle_model:"型式", chassis_number:"車台番号", vehicle_grade:"グレード", first_registration:"初度登録", mileage:"走行距離", engine:"エンジン型式", transmission:"ミッション", drive:"駆動", color:"カラー", model_designation:"型式指定", classification:"類別区分", vehicle_body:"形状", fuel:"燃料", year:"年式", displacement:"排気量", generation:"期別"}],
    ["stock", {stock_quantity:"在庫数", shelf:"棚番", location:"拠点", listing_status:"出品状況", available_quantity:"有効在庫", first_listed_at:"出品日", stock_status:"在庫状況", recovered_at:"入庫日", inventory_note:"在庫備考", shipped_quantity:"出庫", received_quantity:"入庫", allocated_quantity:"引当", temporarily_held_quantity:"仮押", proposed_quantity:"提案中", inventory_vehicle_name:"車名（在庫）", inventory_vehicle_model:"型式（在庫）", warehouse:"倉庫"}],
    ["condition", {part_condition:"部品状態", quality:"品質", test_result:"動作確認", warranty:"保証", defects:"損傷・注意点", inspection:"検品", quality_kind:"種別", inventory_quality:"品質（在庫）", source_state:"状態", source_information:"情報"}],
    ["office", {office_name:"事業所名", office_code:"事業所コード", office_postal_code:"郵便番号", office_address:"住所", office_phone:"電話番号", office_fax:"FAX番号", office_email:"Email", office_site:"URL", office_group:"グループ", office_system:"システム", office_psf:"PSF利用", office_quality_rule:"品質規定", producer:"生産担当者", temporary_hold_at:"仮押日", temporary_hold_by:"仮押担当者"}],
    ["notes", {components:"構成部品", source_photo:"Recycle+の写真", memo:"メモ", remarks:"備考", listing_note:"出品備考", internal_note:"社内備考"}]
  ];

  const allFields = Object.assign({}, ...groups.map(([, fields]) => fields));
  const $ = (id) => document.getElementById(id);
  const screen = $("screen-search");
  const menu = $("menu-grid");
  const head = screen?.querySelector(".search-header");
  const productPanel = $("sales-detail-basic");
  const identity = $("sales-product-identity");
  if (!head || !productPanel || !identity || !menu) return;

  let active = false;
  let epoch = 0;
  let lookups = 0;
  let productRequest = 0;
  let productKey = "";
  let productPage = 0;
  let displayedDetail = null;
  let details = null;

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
    inputmode:"search", placeholder:"00000-000000000000", maxlength:"22", autocomplete:"off"});
  const status = element("p", {role:"status", className:"recycle-karte-status"});
  const searchRow = element("div", {className:"recycle-karte-search-row"},
    element("label", {for:input.id, text:tr("search")}), input,
    button("search", null, {type:"submit", className:"btn-search"}));
  const searchForm = element("form", {className:"recycle-karte-form"}, searchRow, status);
  const tools = element("div", {className:"recycle-karte-controls"},
    button("manage", () => void openManage()), button("exit", () => reset()));
  const entry = element("section", {className:"recycle-karte-entry", hidden:""}, searchForm, tools);
  head.append(entry);
  const partSearchInput = $("q");
  let partLookupRequest = 0;
  const partLookupStatus = element("p", {className:"recycle-karte-status", role:"status"});
  const partLookupFirst = button("detail", null, {hidden:""});
  const partLookupResults = button("partLookupList", null, {hidden:""});
  const partLookup = element("section", {className:"recycle-karte-product", hidden:""},
    partLookupStatus, element("div", {className:"recycle-karte-controls"}, partLookupFirst, partLookupResults));
  entry.append(partLookup);


  const productSection = element("section", {className:"recycle-karte-product", hidden:""},
    element("h3", {text:tr("list")}));
  const productList = element("div", {className:"recycle-karte-list", "aria-live":"polite"});
  productSection.append(productList);
  productPanel.prepend(productSection);

  function reset() {
    active = false;
    epoch++;
    lookups++;
    productRequest++;
    productKey = "";
    clearPartLookup();
    input.value = "";
    status.replaceChildren();
    productList.replaceChildren();
    entry.hidden = true;
    productSection.hidden = true;
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
        entry.hidden = false;
        input.focus();
        refreshProductSection();
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

  function refreshProductSection(force = false) {
    if (!canShow()) return;
    const id = currentId();
    if (!force && id === productKey) return;
    if (id !== productKey) productPage = 0;
    productKey = id;
    productSection.hidden = !id;
    if (id) void renderProductList(id, productPage);
  }

  async function renderProductList(id, page) {
    const run = ++productRequest;
    productList.textContent = tr("loading");
    try {
      const rows = await rpc("read", {p_product:id, p_offset:page * pageSize});
      if (run !== productRequest || id !== currentId()) return;
      productPage = page;
      productList.replaceChildren();
      if (!rows.length) productList.textContent = tr("noRows");
      rows.slice(0, pageSize).forEach(row => {
        const summary = element("div", {className:"recycle-karte-list-summary"},
          element("strong", {text:row.karte_number}), element("span", {text:row.part_name || row.part_number || tr("missing")}),
          element("small", {text:productKindLabel(row.product_kind)}));
        productList.append(element("div", {className:"recycle-karte-result"}, summary,
          button("detail", event => void openDetail(row.karte_number, event.currentTarget),
            {"aria-label":tr("detail") + " " + row.karte_number})));
      });
      const navigation = pager(page, rows.length > pageSize, value => void renderProductList(id, value));
      if (navigation) productList.append(navigation);
    } catch (error) {
      if (run === productRequest && error?.code !== "closed") productList.textContent = errorText(error);
    }
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
    const part = String(partSearchInput?.value || "").normalize("NFKC").trim();
    if (!/^[A-Z0-9][A-Z0-9 \u002d\u2010\u2011\u2013\u2212]{1,79}$/i.test(part) || !/[0-9]/.test(part)) return;
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
    let pageRequest = 0;
    async function showPage(page, initial) {
      const run = ++pageRequest;
      body.textContent = tr("loading");
      try {
        const data = initial ?? await rpc("read_part", {p_part:part, p_offset:page * pageSize});
        if (details !== modal || pageRequest !== run) return;
        body.replaceChildren(element("p", {className:"recycle-karte-status", text:tr("partLookupCount").replace("{count}", String(data.total))}));
        data.items.forEach(row => {
          const summary = element("div", {className:"recycle-karte-list-summary"},
            element("strong", {text:row.karte_number}),
            element("span", {text:row.part_number || part}),
            element("small", {text:row.link_active ? productKindLabel(row.product_kind) : tr("unknown")}));
          body.append(element("div", {className:"recycle-karte-result"}, summary,
            button("detail", () => void openDetail(row.karte_number, partLookupResults),
              {"aria-label":tr("detail") + " " + row.karte_number})));
        });
        const navigation = pager(page, data.total > (page + 1) * pageSize, next => void showPage(next));
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
    const requested = normalizeNumber(input.value);
    if (!numberPattern.test(requested)) {
      status.textContent = tr("valid");
      input.focus();
      return;
    }
    const lookup = ++lookups;
    const targetPress = searchRequestSeq;
    status.textContent = tr("loading");
    try {
      const [row] = await rpc("read", {p_karte:requested, p_detail:true});
      if (lookup !== lookups || !canShow()) return;
      if (!row) {
        status.textContent = tr("noRows");
        return;
      }
      if (row.link_active && targetPress === searchRequestSeq) {
        try {
          await openProductByDkdId(row.dkd_shohin_id);
          if (lookup === lookups && canShow() && currentId() === row.dkd_shohin_id) {
            const selection = detailSecondaryRequestSeq;
            void productSearchDetailReadyPromise.then(() => {
              if (!canShow() || lookup !== lookups || selection !== detailSecondaryRequestSeq) return;
              const select = $("product-kind-select");
              if (!select || !Array.from(select.options).some(option => option.value === row.product_kind)) return;
              select.value = row.product_kind;
              select.dispatchEvent(new Event("change"));
            }).catch(() => {});
          }
        } catch { /* The saved karte remains available. */ }
      }
      if (lookup !== lookups || !canShow()) return;
      status.textContent = row.link_active && currentId() === row.dkd_shohin_id ? "" : tr("unknown");
      displayDetail(row, input);
    } catch (error) {
      if (lookup === lookups && error?.code !== "closed") status.textContent = errorText(error);
    }
  });

  function dialog(title, origin) {
    details?.close();
    const heading = element("h2", {id:"recycle-karte-dialog-title", text:title});
    const modal = element("dialog", {className:"recycle-karte-dialog", "aria-labelledby":heading.id});
    const body = element("div", {className:"recycle-karte-dialog-body"});
    modal.append(element("header", {className:"recycle-karte-dialog-head"}, heading,
      button("close", () => modal.close())), body);
    document.body.append(modal);
    modal.addEventListener("close", () => {
      modal.remove();
      if (details === modal) {
        details = null;
        displayedDetail = null;
            if (canShow() && origin?.isConnected) origin.focus();
      }
    });
    details = modal;
    modal.showModal();
    return {body, modal};
  }

  async function openDetail(number, origin) {
    if (!canShow()) return;
    const {body, modal} = dialog(number, origin);
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

  function displayDetail(row, origin) {
    const {body} = dialog(row.karte_number, origin);
    renderDetail(row, body);
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

  function renderDiffPage(panel, reviewed) {
    const changes = reviewed.flatMap(item => {
      const fields = Object.entries(item.changes);
      return fields.length ? fields.map(([key,field]) => [item.karte_number,key,field]) :
        [[item.karte_number,"",null]];
    });
    function show(index) {
      const [number,key,value] = changes[index];
      panel.replaceChildren(element("strong", {text:number}),
        element("p", {text:value ? fieldLabel(key) : tr("noDiff")}));
      if (value) {
        panel.append(limitedValue(value.before ? codeText(value.before.value) : tr("missing")),
          limitedValue("→ " + codeText(value.after.value)));
      }
      const navigation = pager(index, index < changes.length - 1, show);
      if (navigation) panel.append(navigation);
    }
    if (changes.length) show(0);
  }

  async function renderSourceReview(row, job, body) {
    const revision = document.createElement("div");
    const status = element("p", {role:"status", text:tr("loading")});
    const back = button("sourceBack", () => renderDetail(row, body));
    const show = element("div", {className:"recycle-karte-diff"});
    revision.append(back, status, show);
    body.replaceChildren(revision);
    try {
      const review = await rpc("source_review", {
        p_karte:row.karte_number, p_job:job.job_id, p_action:"preview"
      });
      if (!revision.isConnected) return;
      status.textContent = tr("reviewSource");
      renderDiffPage(show, review);
      const apply = button("apply", async () => {
        apply.disabled = true;
        back.disabled = true;
        try {
          await rpc("source_review", {p_karte:row.karte_number, p_job:job.job_id, p_action:"apply", p_expected:review});
          const [updated] = await rpc("read", {p_karte:row.karte_number, p_detail:true});
          if (updated && revision.isConnected) {
            renderDetail(updated, body);
            const saved = body.querySelector("[role='status']");
            if (saved) saved.textContent = tr("saved");
          }
          refreshProductSection(true);
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

  function renderDetail(row, body) {
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
    const section = element("select", {"aria-label":tr("detail")});
    [...groups.map(([key]) => key), "photos", "link"].forEach(key => {
      section.append(element("option", {value:key, text:tr(key)}));
    });
    const area = element("section", {className:"recycle-karte-detail-fields", "aria-live":"polite"});
    const photo = element("aside", {className:"recycle-karte-desktop-photo"});
    const content = element("div", {className:"recycle-karte-detail-layout"}, area, photo);
    let lastPhoto = null;
    let photoPromise = null;
    function renderPhotoInto(target) {
      target.replaceChildren(element("strong", {text:tr("photos")}));
      if (lastPhoto) {
        const img = element("img", {src:lastPhoto.thumb, loading:"lazy", alt:tr("photos")});
        img.addEventListener("error", () => target.replaceChildren(element("p", {text:tr("noPhoto")})));
        const openImage = button("photoFull", async () => {
          const url = await lastPhoto.full().catch(() => "");
          if (!url || displayedDetail !== row) return;
          target.replaceChildren(element("strong", {text:tr("photos")}),
            element("img", {src:url, alt:tr("photos")}),
            element("a", {href:url, target:"_blank", rel:"noopener", text:tr("photoFull")}));
        });
        target.append(img, openImage);
        return;
      }
      const message = element("p", {text:row.link_active ? tr("loading") : tr("noPhoto")});
      target.append(message);
      if (!row.link_active) return;
      photoPromise ||= loadPhoto(row).catch(() => null);
      void photoPromise.then(result => {
        if (!target.isConnected || displayedDetail !== row) return;
        if (result) {
          lastPhoto = result;
          renderPhotoInto(target);
        } else message.textContent = tr("noPhoto");
      });
    }
    function renderGroup(page = 0) {
      area.replaceChildren();
      content.classList.toggle("recycle-karte-photo-selected", section.value === "photos");
      if (section.value === "link") {
        renderLink(row, area);
        return;
      }
      if (section.value === "photos") {
        renderPhotoInto(area);
        return;
      }
      const fieldKeys = Object.keys(groups.find(([key]) => key === section.value)[1]);
      if (section.value === "notes") {
        fieldKeys.push(...Object.keys(row.fields || {}).filter(key => !Object.hasOwn(allFields, key)).sort());
      }
      const list = element("dl", {className:"recycle-karte-values"});
      const perPage = 3;
      fieldKeys.slice(page * perPage, (page + 1) * perPage).forEach(key => {
        const field = row.fields?.[key];
        const value = element("dd", {},
          limitedValue(field ? codeText(field.value) : tr("missing")));
        if (field) value.append(element("small", {text:tr(field.source_page === "stock-list" ? "sourceList" : "sourceDetail") + " · " + time(field.observed_at)}));
        list.append(element("div", {}, element("dt", {text:fieldLabel(key)}), value));
      });
      area.append(list, pager(page, fieldKeys.length > (page + 1) * perPage, renderGroup));
    }
    section.addEventListener("change", () => renderGroup());
    body.replaceChildren(source, element("div", {className:"recycle-karte-controls"}, section, refresh, review), message, content);
    void syncAcquisition();
    renderGroup();
    if (window.matchMedia("(min-width: 920px) and (min-height: 580px)").matches) renderPhotoInto(photo);
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

  async function loadPhoto(row) {
    const result = await fetchAllCoreProductImagesForContext(row.dkd_shohin_id, "sales");
    if (result.error) return null;
    const match = (result.data || []).find(img => normalizeProductKind(img.product_kind || "rebuilt") === row.product_kind);
    if (!match) return null;
    const options = {width:240, height:240, resize:"contain"};
    const path = productImageStoragePath(match);
    const thumb = (path && await signProductImageUrl(path, options)) || productImageFallbackUrl(match, options);
    if (!thumb) return null;
    const full = () => path ? signProductImageUrl(path, {}) : Promise.resolve(safeSupabaseImageUrl(match.image_url));
    return {thumb, full};
  }

  function renderLink(row, area) {
    const variant = element("input", {type:"text", inputmode:"numeric", maxlength:"19", value:row.product_variant_id || ""});
    const note = element("input", {type:"text", maxlength:"500", value:row.link_note || ""});
    const product = currentProduct;
    const productId = currentId();
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
        state.textContent = tr("saved");
        refreshProductSection(true);
        const [updated] = await rpc("read", {p_karte:row.karte_number, p_detail:true});
        if (displayedDetail === row && updated) {
          const parent = area.closest(".recycle-karte-dialog-body");
          renderDetail(updated, parent);
          parent.querySelector("[role=status]").textContent = tr("saved");
        }
      } catch (error) {
        if (error?.code !== "closed") state.textContent = errorText(error);
      } finally { save.disabled = false; }
    });
    area.append(element("label", {text:tr("variant")}, variant), element("label", {text:tr("linkNote")}, note), save, state);
    if (productId) {
      void fetchProductVariantsByDkdId(productId).then(rows => {
        if (displayedDetail !== row || !area.isConnected) return;
        const candidates = rows.filter(item => item.is_active !== false && item.product_variant_id);
        if (!candidates.length) return;
        const select = element("select", {}, element("option", {value:"", text:"—"}));
        candidates.forEach(item => select.append(element("option", {value:String(item.product_variant_id),
          text:productKindLabel(item.product_kind) + " · " + item.product_variant_id})));
        select.addEventListener("change", () => { if (select.value) variant.value = select.value; });
        area.prepend(element("label", {text:salesDetailPrimaryPartNumber(product)}, select));
      }).catch(() => {});
    }
  }

  async function openManage() {
    const {body, modal} = dialog(tr("manage"), entry.querySelector("button[type='button']"));
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
      const numbers = element("textarea", {rows:"2", placeholder:"00000-000000000000"});
      const collected = new Set();
      const note = element("p", {role:"status", text:"0 / 100"});
      const add = button("search", () => {
        const entries = numbers.value.split(/\s+/).filter(Boolean).map(normalizeNumber);
        if (!entries.length || entries.some(next => !numberPattern.test(next))) {
          note.textContent = tr("valid");
          return;
        }
        const next = new Set([...collected, ...entries]);
        if (next.size > 100) { note.textContent = tr("batchHelp"); return; }
        next.forEach(number => collected.add(number));
        numbers.value = "";
        note.textContent = collected.size + " / 100";
        numbers.focus();
      }, {text:document.documentElement.lang === "ja" ? "番号を追加" : "Add number"});
      const send = button("batch", async () => {
        if (!collected.size) return;
        send.disabled = true;
        try {
          await rpc("request", {p_numbers:[...collected]});
          section.value = "pending";
          void pendingPage(0);
        } catch (error) {
          if (error?.code !== "closed") note.textContent = errorText(error);
        } finally { send.disabled = false; }
      });
      const fetchBatch = button("sourceBatch", async () => {
        if (!collected.size || collected.size > 3) {
          note.textContent = tr("sourceBatch");
          return;
        }
        fetchBatch.disabled = true;
        try {
          const outcomes = await Promise.allSettled([...collected].map(requestAutomatic));
          note.textContent = outcomes.map((value,index) => {
            const state = value.status === 'fulfilled' ? acquisitionStatus(value.value) : errorText(value.reason);
            return Array.from(collected)[index] + ' · ' + (state || tr("sourceRunning"));
          }).join("  ");
        } finally { fetchBatch.disabled = false; }
      });
      panel.append(element("label", {text:tr("batchHelp")}, numbers),
        element("div", {className:"recycle-karte-controls"}, add, send, fetchBatch), note);
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
          reviewed = previewed = null;
          message.textContent = tr("saved");
          diff.replaceChildren();
          file.value = "";
          refreshProductSection(true);
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

  new MutationObserver(syncMenu).observe(menu, {childList:true, subtree:true});
  new MutationObserver(() => {
    if (active && !canShow()) reset();
  }).observe(screen, {attributes:true, attributeFilter:["class"]});
  new MutationObserver(() => refreshProductSection()).observe(identity, {childList:true});
  sb.auth.onAuthStateChange(event => {
    if (event === "SIGNED_OUT") {
      reset();
      menu.querySelector(".recycle-karte-menu")?.remove();
    }
  });
  syncMenu();
})();
