(function(root) {
  "use strict";

  var MAX_FILE_BYTES = 30 * 1024 * 1024;
  var MAX_LINES = 200;
  var state = {
    fileName: "",
    fileSha256: "",
    autoReferenceName: "",
    costListId: "",
    costListName: "",
    costProductIds: [],
    costListReady: false,
    costListLoading: false,
    costListRequestSeq: 0,
    sheets: [],
    preview: null,
    previewInputFingerprint: "",
    selections: {},
    holds: {},
    resumeRows: null,
    resumeReceiptId: null,
    heldOffset: 0,
    heldLoading: false,
    corrections: {},
    correctionReasons: {},
    preferredTargets: {},
    editingKey: "",
    draftPart: "",
    draftReason: "",
    draftDirty: false,
    searchResults: [],
    searchQuery: "",
    searchError: "",
    searching: false,
    searchRequestSeq: 0,
    working: false,
    applied: false
  };

  function byId(id) { return document.getElementById(id); }
  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function(character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
    });
  }
  function setStatus(message, isError) {
    var element = byId("container-stock-status");
    if (!element) return;
    element.textContent = message || "";
    element.classList.toggle("is-error", !!isError);
  }
  function selectedReference() {
    return (byId("container-stock-reference").value || "").trim();
  }
  function costListRequired() {
    return !!byId("container-stock-cost-list");
  }
  function canPreview() {
    return !state.working && !state.costListLoading && !!(state.resumeRows || state.sheets.length) &&
      selectedReference().length >= 3 &&
      (!costListRequired() || (state.costListId && state.costListReady));
  }
  async function fetchCostProductIds(listId) {
    var result = await sb.from("manufacturing_cost_list_items")
      .select("dkd_shohin_id", { count: "exact" }).eq("list_id", Number(listId)).limit(1001);
    if (result.error) throw result.error;
    if (!result.data || !result.data.length) throw new Error("リストに商品がありません。");
    if (result.data.length > 1000 || (result.count != null && result.count > result.data.length))
      throw new Error("原価計算リストの商品数が上限を超えています。");
    return result.data.map(function(item) { return String(item.dkd_shohin_id); }).sort();
  }
  async function loadCostLists() {
    var select = byId("container-stock-cost-list");
    if (!select || !root.sb) return;
    select.disabled = true;
    select.innerHTML = "<option value=''>リストを読み込んでいます</option>";
    var result = await sb.from("manufacturing_cost_lists")
      .select("id,list_name")
      .eq("is_active", true).eq("product_kind", "rebuilt")
      .order("updated_at", { ascending: false }).limit(100);
    var options = result.error ? [] : result.data || [];
    select.innerHTML = "<option value=''>原価計算リストを選択</option>" +
      options.map(function(item) {
        return "<option value='" + esc(item.id) + "'>" + esc(item.list_name) + "</option>";
      }).join("") + "<option value='none'>該当リストなし（通常の品番照合）</option>";
    select.disabled = false;
    if (state.costListId) select.value = state.costListId;
    var note = byId("container-stock-cost-list-note");
    if (note && result.error)
      note.textContent = "原価計算リストを取得できません。閲覧権限を確認するか、通常の品番照合を選んでください。";
    else if (note && !options.length)
      note.textContent = "利用できる保存済み原価計算リストがありません。通常の品番照合を選んでください。";
  }
  async function loadCostListProducts() {
    var listId = state.costListId;
    var requestSeq = ++state.costListRequestSeq;
    state.costProductIds = [];
    state.costListReady = listId === "none";
    state.costListLoading = !!listId && listId !== "none";
    var note = byId("container-stock-cost-list-note");
    if (!state.costListLoading) {
      if (note) note.textContent = listId === "none"
        ? "原価計算リストは使いません。候補が複数ある場合は入庫先を確認してください。"
        : "保存済みの原価計算リストを選んでください。";
      byId("container-stock-preview").disabled = !canPreview();
      return;
    }
    if (note) note.textContent = "原価計算で照合済みの商品を読み込んでいます。";
    byId("container-stock-preview").disabled = true;
    try {
      var productIds = await fetchCostProductIds(listId);
      if (requestSeq !== state.costListRequestSeq) return;
      state.costProductIds = productIds;
      state.costListReady = true;
      if (note) note.textContent = state.costListName + " の照合済み " +
        state.costProductIds.length + " 商品を優先します。一致しない品番は要確認のまま残します。";
    } catch (error) {
      if (requestSeq !== state.costListRequestSeq) return;
      state.costListReady = false;
      if (note) note.textContent = "原価計算リストを読み込めません: " +
        (error.message || String(error));
    } finally {
      if (requestSeq === state.costListRequestSeq) {
        state.costListLoading = false;
        byId("container-stock-preview").disabled = !canPreview();
      }
    }
  }
  function validReference(value) {
    var reference = String(value || "").trim();
    var key = reference.toUpperCase().replace(/[-\s\u3000]/g, "");
    return reference.length >= 3 && reference.length <= 100 &&
      key.length >= 3 && key.length <= 80 && !/[\x00-\x1f\x7f]/.test(reference);
  }
  function useFileNameAsReference(name) {
    var reference = String(name || "").trim();
    if (selectedReference() || !validReference(reference)) return false;
    byId("container-stock-reference").value = reference;
    state.autoReferenceName = reference;
    return true;
  }
  function sourceKey(row) {
    return row.category_code + "|" + String(row.part_number || "").trim().toUpperCase();
  }
  function received(row) { return row.line_status === "received"; }
  function held(row) { return !received(row) && typeof state.holds[sourceKey(row)] === "string"; }
  function validHold(row) {
    var reason = state.holds[sourceKey(row)] || "";
    return reason.trim().length >= 5 && reason.trim().length <= 300 && !/[\x00-\x1f\x7f]/.test(reason);
  }
  function busyControls() {
    ["container-stock-reference", "container-stock-choose", "container-stock-file", "container-stock-cost-list"].forEach(function(id) {
      var element = byId(id);
      if (element) element.disabled = state.working || !!state.resumeRows;
    });
    var reset = byId("container-stock-new");
    if (reset) reset.disabled = state.working;
  }
  function toggleHold(index) {
    var row = state.preview && state.preview.rows[index];
    if (!row || received(row) || state.working || state.applied || state.preview.duplicate) return;
    state.holds[sourceKey(row)] = held(row) ? null : "商品マスタの必要情報が不足しているため";
    renderPreview();
  }
  function matchPartFor(row) {
    return state.corrections[sourceKey(row)] || row.part_number;
  }
  function validPartNumber(value) {
    var part = String(value || "").trim().toUpperCase();
    return part.length >= 4 && part.length <= 80 &&
      /^[A-Z0-9][A-Z0-9 ._()/+-]*$/.test(part) &&
      part.replace(/[^A-Z0-9]/g, "").length >= 4;
  }
  function strictQuantity(value) {
    if (typeof value === "number") return Number.isSafeInteger(value) && value > 0 ? value : null;
    var text = String(value == null ? "" : value).trim();
    if (!/^(?:[1-9][0-9]*|[1-9][0-9]{0,2}(?:,[0-9]{3})+)$/.test(text)) return null;
    var number = Number(text.replace(/,/g, ""));
    return Number.isSafeInteger(number) && number > 0 ? number : null;
  }
  function guessCategory(name) {
    var text = String(name || "").toUpperCase();
    if (/ALT|ALTERNATOR|オルタ/.test(text)) return "alternator";
    if (/STA|STARTER|スタータ|セル/.test(text)) return "starter";
    return "";
  }
  function colName(index) {
    var value = index + 1;
    var result = "";
    while (value > 0) {
      value -= 1;
      result = String.fromCharCode(65 + value % 26) + result;
      value = Math.floor(value / 26);
    }
    return result;
  }
  function sheetAnalysis(sheet) {
    return root.DcatsManufacturingCostImport.analyzeMatrix(sheet.matrix, sheet.overrides);
  }
  function sheetColumnOptions(sheet, selected, headerRow) {
    var width = Math.min(30, sheet.matrix.reduce(function(max, row) {
      return Math.max(max, Array.isArray(row) ? row.length : 0);
    }, 0));
    var headers = sheet.matrix[headerRow] || [];
    var html = "";
    for (var i = 0; i < width; i++) {
      html += "<option value='" + i + "'" + (i === selected ? " selected" : "") + ">" +
        esc(colName(i) + (headers[i] ? " · " + String(headers[i]).slice(0, 24) : "")) + "</option>";
    }
    return html;
  }
  function invalidatePreview() {
    state.preview = null;
    state.previewInputFingerprint = "";
    state.selections = {};
    state.editingKey = "";
    state.draftPart = "";
    state.draftReason = "";
    state.draftDirty = false;
    state.searchResults = [];
    state.applied = false;
    byId("container-stock-results").innerHTML = "";
    byId("container-stock-apply").disabled = true;
    byId("container-stock-preview").disabled = !canPreview();
  }
  function renderSheets() {
    var host = byId("container-stock-sheets");
    if (!host) return;
    host.innerHTML = state.sheets.map(function(sheet, index) {
      var analysis = sheetAnalysis(sheet);
      var mapping = analysis.mapping;
      var headerRow = mapping.headerRow >= 0 ? mapping.headerRow : 0;
      var qty = analysis.rows.reduce(function(sum, row) { return sum + (Number(row.quantity) || 0); }, 0);
      var warning = analysis.ignoredRows ? " / 品番なし行 " + analysis.ignoredRows + "件" : "";
      if (analysis.truncated) warning += " / 上限超過";
      return "<div class='container-stock-sheet' data-sheet-index='" + index + "'>" +
        "<label class='container-stock-sheet-check'><input type='checkbox' data-sheet-field='included'" + (sheet.included ? " checked" : "") + "> " + esc(sheet.name) + "</label>" +
        "<span class='container-stock-sheet-summary'>" + analysis.rows.length + "品番 / " + qty.toLocaleString("ja-JP") + "台" + esc(warning) + "</span>" +
        "<label>区分<select class='form-select' data-sheet-field='category'>" +
          "<option value=''>選択してください</option>" +
          "<option value='alternator'" + (sheet.category === "alternator" ? " selected" : "") + ">オルタネーター</option>" +
          "<option value='starter'" + (sheet.category === "starter" ? " selected" : "") + ">スターター</option>" +
        "</select></label>" +
        "<label>見出し行<input class='form-input' type='number' min='1' max='" + sheet.matrix.length + "' data-sheet-field='headerRow' value='" + (headerRow + 1) + "'></label>" +
        "<label>品番列<select class='form-select' data-sheet-field='partColumn'>" +
          sheetColumnOptions(sheet, mapping.partColumn, headerRow) + "</select></label>" +
        "<label>数量列<select class='form-select' data-sheet-field='quantityColumn'>" +
          sheetColumnOptions(sheet, mapping.quantityColumn, headerRow) + "</select></label>" +
        "</div>";
    }).join("");
  }
  function collectedRows() {
    if (state.resumeRows) return state.resumeRows.map(function(row) {
      return {
        part_number: row.part_number, category_code: row.category_code, quantity: row.quantity,
        sources: row.sources, match_part_number: received(row) ? row.match_part_number || row.part_number : matchPartFor(row),
        match_reason: received(row) ? row.match_reason || "" : state.correctionReasons[sourceKey(row)] || row.match_reason || "",
        target_dkd_shohin_id: received(row) ? row.target_dkd_shohin_id : null
      };
    });
    var combined = new Map();
    var included = 0;
    state.sheets.forEach(function(sheet) {
      if (!sheet.included) return;
      included += 1;
      if (!sheet.category) throw new Error(sheet.name + " の区分を選択してください。");
      var analysis = sheetAnalysis(sheet);
      if (analysis.truncated) throw new Error(sheet.name + " の行数が取込上限を超えています。");
      if (analysis.mapping.partColumn < 0 || analysis.mapping.quantityColumn < 0)
        throw new Error(sheet.name + " の品番列と数量列を確認してください。");
      analysis.rows.forEach(function(row) {
        var quantity = row.sourceRows.reduce(function(sum, sourceRow) {
          var cells = sheet.matrix[sourceRow - 1] || [];
          var parsed = strictQuantity(cells[analysis.mapping.quantityColumn]);
          if (parsed === null || parsed > 100000)
            throw new Error(sheet.name + " の " + sourceRow + "行目の数量を確認してください。");
          return sum + parsed;
        }, 0);
        if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 100000)
          throw new Error(sheet.name + " の " + row.part + " に正の整数の数量が必要です。");
        var key = sheet.category + "|" + row.key;
        var source = { sheet: sheet.name, rows: row.sourceRows.slice() };
        if (!combined.has(key)) {
          combined.set(key, {
            part_number: row.part,
            category_code: sheet.category,
            quantity: quantity,
            sources: [source]
          });
        } else {
          var existing = combined.get(key);
          existing.quantity += quantity;
          existing.sources.push(source);
        }
      });
    });
    if (!included) throw new Error("取り込むシートを選択してください。");
    var rows = Array.from(combined.values()).sort(function(a, b) {
      return sourceKey(a).localeCompare(sourceKey(b));
    });
    if (!rows.length) throw new Error("品番と数量を読み取れませんでした。列の設定を確認してください。");
    if (rows.length > MAX_LINES) throw new Error("一度に取り込める品番は200件までです。");
    return rows.map(function(row) {
      var matchPart = matchPartFor(row);
      return Object.assign({}, row, {
        match_part_number: matchPart,
        match_reason: state.correctionReasons[sourceKey(row)] || ""
      });
    });
  }
  async function readFile(file) {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) throw new Error("ファイルが30MBを超えています。");
    if (!/\.(xlsx|xls|xlsm|csv)$/i.test(file.name || ""))
      throw new Error("Excel（.xlsx / .xls / .xlsm）またはCSVを選択してください。");
    if (!root.crypto || !root.crypto.subtle) throw new Error("安全な接続でファイルを開いてください。");
    var parser = root.DcatsManufacturingCostImport;
    if (!parser) throw new Error("Excel解析機能を読み込めませんでした。");
    var buffer = await file.arrayBuffer();
    var digest = await root.crypto.subtle.digest("SHA-256", buffer);
    var sha = Array.from(new Uint8Array(digest)).map(function(byte) {
      return byte.toString(16).padStart(2, "0");
    }).join("");
    var XLSX = await parser.loadSpreadsheetLibrary();
    var workbook = XLSX.read(buffer, { type: "array", cellDates: false });
    var sheets = parser.workbookSheets(workbook, XLSX).map(function(sheet) {
      var analysis = parser.analyzeMatrix(sheet.matrix);
      return {
        key: sheet.key, name: sheet.name, matrix: sheet.matrix,
        category: guessCategory(sheet.name),
        included: analysis.rows.length > 0,
        overrides: {}
      };
    }).filter(function(sheet) { return sheet.included; });
    if (!sheets.length) throw new Error("品番を含むシートが見つかりませんでした。");
    state.fileName = file.name;
    state.fileSha256 = sha;
    state.sheets = sheets;
    state.corrections = {};
    state.correctionReasons = {};
    state.preferredTargets = {};
    state.costListId = "";
    state.costListName = "";
    state.costProductIds = [];
    state.costListReady = false;
    state.costListLoading = false;
    state.costListRequestSeq += 1;
    var costSelect = byId("container-stock-cost-list");
    if (costSelect) costSelect.value = "";
    useFileNameAsReference(file.name);
    byId("container-stock-file-name").textContent = file.name;
    invalidatePreview();
    renderSheets();
    setStatus(!selectedReference()
      ? "ファイル名を識別子に使用できません。識別子を入力してから照合してください。"
      : "ファイルを読み込みました。原価計算リスト・シート・列・区分を確認して照合してください。",
    !selectedReference());
  }
  function sourceLabel(row) {
    return (row.sources || []).map(function(source) {
      return source.sheet + " " + (source.rows || []).join(",") + "行";
    }).join(" / ");
  }
  function renderResolver(row) {
    if (!row) return "";
    var original = row.part_number;
    var matchPart = state.draftPart;
    var reason = state.draftReason;
    var canManageProducts = typeof root.canEdit === "function" && root.canEdit();
    var html = "<section class='container-stock-resolver' aria-label='品番の照合を修正'>" +
      "<div class='container-stock-resolver-head'><div><strong>照合を修正 · " + esc(original) + "</strong>" +
      "<small>" + esc(sourceLabel(row)) + " / " + esc(row.quantity) + "台</small></div>" +
      "<button type='button' class='btn-secondary' data-container-close-editor>閉じる</button></div>" +
      "<p>元ファイルの品番・数量は変更しません。読み取り違い、またはこの入庫だけの品番読み替えを指定し、再照合します。</p>" +
      "<div class='container-stock-resolver-fields'><label>照合に使う品番" +
      "<input class='form-input' id='container-stock-match-part' type='text' maxlength='80' value='" + esc(matchPart) + "'></label>" +
      "<label>修正理由（品番を変える場合は必須）" +
      "<input class='form-input' id='container-stock-match-reason' type='text' maxlength='300' value='" + esc(reason) + "' placeholder='例: 原票の品番表記違いを現物ラベルで確認'></label>" +
      "<button type='button' class='btn-primary' data-container-save-match>品番を修正して再照合</button></div>" +
      "<p class='container-stock-resolver-hint'>区分が違う場合は、上のシート設定を直してから再照合してください。</p>" +
      "<div class='container-stock-resolver-search'><label>既存商品を探す" +
      "<input class='form-input' id='container-stock-product-search' type='search' value='" + esc(state.searchQuery) + "' placeholder='純正品番・メーカー品番・DKD番号'></label>" +
      "<button type='button' class='btn-secondary' data-container-search-product" + (state.searching ? " disabled" : "") + ">検索</button></div>";
    if (state.searching) html += "<p role='status'>商品を検索しています。</p>";
    if (state.searchError) html += "<p class='container-stock-unresolved' role='alert'>" + esc(state.searchError) + "</p>";
    if (state.searchResults.length) {
      html += "<div class='container-stock-product-results'>";
      state.searchResults.forEach(function(product, index) {
        html += "<div class='container-stock-product-result'><div><strong>DKD " + esc(product.dkd_shohin_id) +
          "</strong><small>" + esc([
            product.genuine_part_number, product.genuine_part_number_2,
            product.manufacturer_part_number, product.manufacturer
          ].filter(Boolean).join(" / ")) + "</small></div>" +
          "<button type='button' class='btn-secondary' data-container-use-product='" + index + "'>この商品で照合</button>" +
          (canManageProducts ? "<button type='button' class='btn-secondary' data-container-edit-product='" + index + "'>商品マスタを編集</button>" : "") +
          "</div>";
      });
      html += "</div>";
    }
    if (canManageProducts) html += "<button type='button' class='btn-secondary' data-container-add-product>不足データを探す・正式登録</button><p>情報不足の品番は要調査です。仮マスタ・在庫登録はできません。</p>";
    else html += "<p class='container-stock-resolver-hint'>商品マスタへの登録・変更には商品管理権限が必要です。</p>";
    return html + "</section>";
  }
  function renderPreview() {
    var host = byId("container-stock-results");
    var preview = state.preview;
    if (!preview) { host.innerHTML = ""; return; }
    var rows = preview.rows || [];
    var duplicate = preview.duplicate;
    var pending = rows.filter(function(row) { return !received(row) && !held(row); });
    var heldRows = rows.filter(held);
    var invalidHolds = heldRows.some(function(row) { return !validHold(row); });
    var unmatched = pending.filter(function(row) { return !(row.candidates || []).length; }).length;
    var needsChoice = pending.filter(function(row) {
      var selected = state.selections[sourceKey(row)];
      return (row.candidates || []).length > 0 && !(row.candidates || []).some(function(candidate) {
        return String(candidate.dkd_shohin_id) === String(selected) && candidate.variant_active !== false;
      });
    }).length;
    var statusTone, statusTitle, statusDetail;
    if (state.applied) {
      statusTone = "applied";
      statusTitle = heldRows.length ? "登録完了・保留あり" : "入庫完了（在庫反映済み）";
      statusDetail = heldRows.length ? "登録可能分だけ在庫に反映しました。保留分は在庫未反映です。「保留品番の管理」から後日再開できます。" : "在庫に反映しました。取込履歴から確認できます。";
    } else if (state.working) {
      statusTone = "working";
      statusTitle = "入庫を登録中です";
      statusDetail = "処理が終わるまで再操作しないでください。";
    } else if (duplicate) {
      statusTone = "duplicate";
      statusTitle = "照合完了・取込済み（再入庫不可）";
      statusDetail = "同じ識別子・ファイル・品番と数量のいずれかが取込済みです。再入庫できません。";
    } else if (state.editingKey || state.draftDirty) {
      statusTone = "editing";
      statusTitle = "照合結果を修正中（在庫未反映）";
      statusDetail = "修正して再照合するか、編集を閉じてください。まだ在庫には反映していません。";
    } else if (!rows.length) {
      statusTone = "attention";
      statusTitle = "照合完了・対象品番なし";
      statusDetail = "対象品番がありません。シートと列の設定を確認してください。";
    } else if (unmatched || needsChoice || invalidHolds) {
      statusTone = "attention";
      statusTitle = "照合完了・未解決あり（在庫未反映）";
      statusDetail = "未解決の品番は修正するか、理由を付けて保留にしてください。保留分は在庫に加算せず、残りの登録を進められます。";
    } else {
      statusTone = "ready";
      statusTitle = "照合完了・入庫可能（在庫未反映）";
      statusDetail = heldRows.length ? "保留分を保存し、登録可能分だけ入庫します。保留品番のマスタは作成せず、在庫にも加算しません。" : "すべての入庫先が確定しました。まだ在庫には反映していません。内容を確認してから一括入庫してください。";
    }
    var html = "<div class='container-stock-result-state is-" + statusTone + "' role='group' aria-label='照合結果'>" +
      "<strong>" + esc(statusTitle) + "</strong><p>" + esc(statusDetail) + "</p></div>" +
      "<div class='container-stock-summary'>" + rows.length + "品番 / " +
      Number(preview.total_quantity || 0).toLocaleString("ja-JP") + "台" +
      "<span class='container-stock-unresolved' role='status'>一致なし " + unmatched + "件</span>" +
      "<span>候補選択待ち " + needsChoice + "件</span>" +
      "<span class='container-stock-held-badge'>保留 " + heldRows.length + "品番 / " + heldRows.reduce(function(sum,row) { return sum + Number(row.quantity); },0) + "台（在庫未反映）</span>" +
      "<span>登録済み " + rows.filter(received).length + "品番（再加算なし）</span>";
    if (duplicate) {
      html += "<strong class='container-stock-duplicate'>取込済み: #" + esc(duplicate.id) +
        " · " + esc(duplicate.container_reference) + " · " + esc(duplicate.received_at) + "</strong>";
    }
    html += "</div>";
    if (state.costListId && state.costListId !== "none") {
      var costUnique = rows.filter(function(row) { return !!automaticTarget(row); }).length;
      html += "<p class='container-stock-cost-summary'>原価計算リスト「" +
        esc(state.costListName) + "」から入庫先を自動選択可能 " + costUnique +
        "件 / 要確認 " + (rows.length - costUnique) + "件</p>";
    }
    html += renderResolver(rows.find(function(row) { return sourceKey(row) === state.editingKey; }));
    html += "<div class='container-stock-table-wrap'><table class='mgmt-table container-stock-table'>" +
      "<thead><tr><th>区分・品番</th><th>数量</th><th>入庫先の商品</th><th>現在庫 → 入庫後</th><th>出典</th></tr></thead><tbody>";
    rows.map(function(row, index) { return { row: row, index: index }; }).sort(function(a, b) {
      var rank = function(item) {
        return !(item.row.candidates || []).length ? 0 :
          state.selections[sourceKey(item.row)] ? 2 : 1;
      };
      return rank(a) - rank(b) || a.index - b.index;
    }).forEach(function(item) {
      var row = item.row;
      var index = item.index;
      var key = sourceKey(row);
      var candidates = row.candidates || [];
      var frozen = received(row) || state.working || state.applied || !!duplicate;
      var selected = state.selections[key] || "";
      var chosen = candidates.find(function(candidate) {
        return String(candidate.dkd_shohin_id) === String(selected);
      });
      var sources = sourceLabel(row);
      var corrected = (row.match_part_number || row.part_number) !== row.part_number;
      html += "<tr" + (!candidates.length ? " class='container-stock-error-row'" : "") + "><td><strong>" + esc(row.part_number) + "</strong>" +
        (corrected ? "<small>照合品番: " + esc(row.match_part_number) + "</small>" : "") + "<small>" +
        esc(row.category_code === "alternator" ? "オルタネーター" : "スターター") +
        "</small></td><td>" + esc(row.quantity) + "</td><td>";
      if (received(row)) {
        html += "<strong class='container-stock-received'>登録済み · DKD " + esc(row.target_dkd_shohin_id) + "</strong><small>在庫は再加算しません</small>";
      } else if (!candidates.length) {
        html += "<span class='container-stock-unresolved'>エラー: 商品マスタに一致なし</span>";
      } else {
        if (!selected) html += "<span class='container-stock-choice'>候補の選択が必要</span>";
        if (state.costListId && state.costListId !== "none" && !candidates.some(function(candidate) {
          return state.costProductIds.indexOf(String(candidate.dkd_shohin_id)) >= 0;
        })) html += "<span class='container-stock-choice'>原価計算リストに一致なし・入庫先を確認</span>";
        html += "<select class='form-select' data-container-row='" + index + "' aria-label='" +
          esc(row.part_number + " の入庫先") + "'" + (frozen || held(row) ? " disabled" : "") + "><option value=''>候補を選択</option>";
        candidates.forEach(function(candidate) {
          var active = candidate.variant_active !== false;
          html += "<option value='" + esc(candidate.dkd_shohin_id) + "'" +
            (String(selected) === String(candidate.dkd_shohin_id) ? " selected" : "") +
            (active ? "" : " disabled") + ">" +
            esc("DKD " + candidate.dkd_shohin_id + " / " +
              (candidate.genuine_part_number || "-") + " / " +
              (candidate.genuine_part_number_2 || "-") + " / " +
              (candidate.manufacturer_part_number || "-") +
              (candidate.product_variant_id ? "" : " / 区分を新規作成") +
              (state.costProductIds.indexOf(String(candidate.dkd_shohin_id)) >= 0 ? " / 原価計算リスト" : "") +
              (active ? "" : " / 無効")) + "</option>";
        });
        html += "</select>";
      }
      if (!received(row)) {
        html += "<div class='container-stock-row-actions'><button type='button' class='container-stock-fix-button' data-container-edit='" + index + "'" + (frozen ? " disabled" : "") + ">品番を修正・マスタ登録</button>" +
          "<button type='button' class='btn-secondary' data-container-hold='" + index + "'" + (frozen ? " disabled" : "") + ">" + (held(row) ? "保留を解除して入庫先を確認" : "この品番を保留") + "</button></div>";
        if (held(row)) html += "<label class='container-stock-hold-reason'>保留理由（5文字以上）<input class='form-input' data-container-hold-reason='" + index + "' maxlength='300' value='" + esc(state.holds[key]) + "'" + (frozen ? " disabled" : "") + "></label><small class='container-stock-held-badge'>保留・在庫未反映</small>";
      }
      html += "</td><td>" + (received(row) ? "登録済み" : held(row) ? "加算しません" : chosen ?
        esc(String(chosen.stock_qty || 0) + " → " +
          String(Number(chosen.stock_qty || 0) + Number(row.quantity))) : "—") +
        "</td><td class='container-stock-source'>" + esc(sources) + "</td></tr>";
    });
    html += "</tbody></table></div>";
    host.innerHTML = html;
    byId("container-stock-apply").disabled =
      !!duplicate || state.working || state.applied || !!state.editingKey || state.draftDirty ||
      !rows.length || !!unmatched || !!needsChoice || invalidHolds || (!pending.length && !heldRows.length);
    byId("container-stock-apply").textContent = heldRows.length ? (pending.length ? "保留を保存して登録可能分を入庫" : "保留だけ保存（在庫は変更しません）") : "確認した内容で一括入庫";
    busyControls();
    if (!state.working && !state.applied) setStatus(statusTitle,
      statusTone === "duplicate" || statusTone === "attention");
  }
  async function previewReceipt() {
    if (state.working) return;
    if (costListRequired() && (!state.costListId || !state.costListReady)) {
      setStatus("原価計算リストを選ぶか、該当リストなしを選んでください。", true);
      return;
    }
    if (state.draftDirty) {
      setStatus("編集中の品番を修正・再照合するか、編集を閉じてから照合してください。", true);
      return;
    }
    var reference = selectedReference();
    if (reference.length < 3) { setStatus("コンテナ識別子を3文字以上で入力してください。", true); return; }
    var rows;
    try { rows = collectedRows(); }
    catch (error) { setStatus(error.message, true); return; }
    var inputFingerprint = JSON.stringify({
      reference: reference, fileName: state.fileName, fileSha256: state.fileSha256,
      costListId: state.costListId, costProductIds: state.costProductIds, rows: rows
    });
    invalidatePreview();
    state.working = true;
    busyControls();
    byId("container-stock-preview").disabled = true;
    byId("container-stock-apply").disabled = true;
    setStatus("品番と取込履歴を照合しています。");
    try {
      var result = await sb.rpc("preview_container_stock_receipt", {
        p_container_reference: reference,
        p_source_file_name: state.fileName,
        p_source_sha256: state.fileSha256,
        p_rows: rows
      });
      if (result.error) throw result.error;
      if (inputFingerprint !== JSON.stringify({
        reference: selectedReference(), fileName: state.fileName,
        fileSha256: state.fileSha256, costListId: state.costListId,
        costProductIds: state.costProductIds, rows: collectedRows()
      })) throw new Error("取込条件が変わりました。再照合してください。");
      state.preview = result.data;
      state.previewInputFingerprint = inputFingerprint;
      state.selections = {};
      (state.preview.rows || []).forEach(function(row) {
        var key = sourceKey(row);
        if (row.line_status === "held" && !Object.prototype.hasOwnProperty.call(state.holds,key))
          state.holds[key] = row.stored_hold_reason || row.hold_reason || "商品マスタの必要情報が不足しているため";
        var automatic = received(row) ? String(row.target_dkd_shohin_id) : automaticTarget(row);
        if (automatic) state.selections[sourceKey(row)] = automatic;
      });
    } catch (error) {
      invalidatePreview();
      setStatus("照合に失敗しました: " + (error.message || String(error)), true);
    } finally {
      state.working = false;
      busyControls();
      byId("container-stock-preview").disabled = !canPreview();
      if (state.preview) renderPreview();
    }
  }
  function automaticTarget(row) {
    var candidates = (row.candidates || []).filter(function(candidate) {
      return candidate.variant_active !== false;
    });
    if (state.costListId && state.costListId !== "none") {
      var costCandidates = candidates.filter(function(candidate) {
        return state.costProductIds.indexOf(String(candidate.dkd_shohin_id)) >= 0;
      });
      return costCandidates.length === 1 ? String(costCandidates[0].dkd_shohin_id) : "";
    }
    var preferred = state.preferredTargets[sourceKey(row)];
    if (preferred && candidates.some(function(candidate) {
      return String(candidate.dkd_shohin_id) === preferred;
    })) return preferred;
    return candidates.length === 1 ? String(candidates[0].dkd_shohin_id) : "";
  }
  async function applyReceipt() {
    if (state.working || !state.preview || state.preview.duplicate || state.applied ||
        state.editingKey || state.draftDirty) return;
    var rows = state.preview.rows || [];
    if (!rows.length || rows.some(function(row) {
      if (received(row)) return false;
      if (held(row)) return !validHold(row);
      return !(row.candidates || []).some(function(candidate) { return String(candidate.dkd_shohin_id) === String(state.selections[sourceKey(row)]) && candidate.variant_active !== false; });
    })) return;
    var reference = selectedReference();
    var currentFingerprint;
    try {
      currentFingerprint = JSON.stringify({
        reference: reference, fileName: state.fileName,
        fileSha256: state.fileSha256, costListId: state.costListId,
        costProductIds: state.costProductIds, rows: collectedRows()
      });
    } catch (error) {
      currentFingerprint = "";
    }
    if (reference !== state.preview.container_reference ||
        currentFingerprint !== state.previewInputFingerprint) {
      invalidatePreview();
      setStatus("取込条件が変わりました。再照合してください。", true);
      return;
    }
    var selectionFingerprint = JSON.stringify([state.selections,state.holds]);
    state.working = true;
    busyControls();
    byId("container-stock-apply").disabled = true;
    byId("container-stock-preview").disabled = true;
    if (state.costListId && state.costListId !== "none") {
      try {
        var currentProductIds = await fetchCostProductIds(state.costListId);
        if (JSON.stringify(currentProductIds) !== JSON.stringify(state.costProductIds))
          throw new Error("原価計算リストの内容が変更されました。");
      } catch (error) {
        state.working = false;
        invalidatePreview();
        busyControls();
        setStatus("原価計算リストを再確認できません: " +
          (error.message || String(error)) + " 再照合してください。", true);
        return;
      }
    }
    if (!state.preview || currentFingerprint !== state.previewInputFingerprint ||
        selectionFingerprint !== JSON.stringify([state.selections,state.holds]) || reference !== selectedReference()) {
      state.working = false;
      invalidatePreview();
      busyControls();
      setStatus("取込条件が変わりました。再照合してください。", true);
      return;
    }
    var readyRows = rows.filter(function(row) { return !received(row) && !held(row); });
    var holdRows = rows.filter(held);
    if (!readyRows.length && !holdRows.length) {
      state.working = false;
      busyControls();
      renderPreview();
      return;
    }
    if (!root.confirm(reference + " の登録可能 " + readyRows.length + "品番・" +
      readyRows.reduce(function(sum,row) { return sum + Number(row.quantity); },0).toLocaleString("ja-JP") +
      "台だけを在庫へ加算します。\n保留 " + holdRows.length + "品番は保存のみで、在庫には加算しません。登録済み品番も再加算しません。\n確定しますか？")) {
      state.working = false;
      byId("container-stock-preview").disabled = !canPreview();
      busyControls();
      renderPreview();
      return;
    }
    renderPreview();
    setStatus("在庫と入庫履歴を登録しています。");
    try {
      var payload = rows.map(function(row) {
        return {
          part_number: row.part_number,
          match_part_number: row.match_part_number || row.part_number,
          match_reason: row.match_reason || "",
          category_code: row.category_code,
          quantity: row.quantity,
          sources: row.sources,
          target_dkd_shohin_id: received(row) ? row.target_dkd_shohin_id : held(row) ? null : Number(state.selections[sourceKey(row)]),
          held: held(row), hold_reason: held(row) ? state.holds[sourceKey(row)].trim() : ""
        };
      });
      var result = await sb.rpc("apply_container_stock_receipt", {
        p_container_reference: reference,
        p_source_file_name: state.fileName,
        p_source_sha256: state.fileSha256,
        p_rows: payload
      });
      if (result.error) throw result.error;
      state.applied = true;
      if (result.data.rows) state.preview.rows = result.data.rows;
      setStatus("入庫 #" + result.data.receipt_id + " を登録しました。" +
        result.data.line_count + "品番・" +
        Number(result.data.total_quantity).toLocaleString("ja-JP") + "台を反映しました。保留 " + Number(result.data.held_count || 0) + "品番は在庫未反映です。");
      renderPreview();
      try {
        await loadHistory();
        await loadHeld();
        if (typeof root.loadProductKindStockMgmt === "function") await root.loadProductKindStockMgmt();
      } catch (refreshError) {
        setStatus("入庫 #" + result.data.receipt_id +
          " は登録済みです。画面の再読込に失敗したため、在庫一覧を検索し直してください。", true);
      }
    } catch (error) {
      setStatus("入庫を確定できませんでした: " + (error.message || String(error)) +
        "。再照合してから確認してください。", true);
      invalidatePreview();
    } finally {
      state.working = false;
      busyControls();
      byId("container-stock-preview").disabled = !canPreview();
    }
  }
  async function loadHistory() {
    var host = byId("container-stock-history");
    if (!host || host.hidden) return;
    host.textContent = "入庫履歴を読み込んでいます。";
    var result = await sb.rpc("list_container_stock_receipts", { p_limit: 20 });
    if (result.error) { host.textContent = "入庫履歴を取得できませんでした: " + result.error.message; return; }
    var rows = result.data || [];
    host.innerHTML = rows.length ? "<h3>最近のコンテナ入庫</h3><ul>" +
      rows.map(function(row) {
        return "<li>#" + esc(row.id) + " · " + esc(row.container_reference) +
          " · " + esc(row.source_file_name) + " · " + esc(row.line_count) +
          "品番 / " + esc(row.total_quantity) + "台（入庫 " + esc(Number(row.total_quantity) - Number(row.held_quantity || 0)) + "台・保留 " + esc(row.held_count || 0) + "品番 / " + esc(row.held_quantity || 0) + "台） · " + esc(row.received_at) + "</li>";
      }).join("") + "</ul>" : "入庫履歴はありません。";
  }
  async function loadHeld() {
    var host = byId("container-stock-held-list");
    if (!host || state.heldLoading) return;
    state.heldLoading = true;
    host.textContent = "保留品番を読み込んでいます。";
    try {
      var result = await sb.rpc("get_container_stock_held_receipts", { p_receipt_id: null, p_offset: state.heldOffset, p_limit: 20 });
      if (result.error) throw result.error;
      var data = result.data;
      if (state.heldOffset && state.heldOffset >= Number(data.total_receipts)) {
        state.heldOffset = 0;
        state.heldLoading = false;
        return loadHeld();
      }
      byId("container-stock-held-toggle").textContent = "保留品番の管理（" + data.total_held_count + "品番）";
      host.innerHTML = "<p><strong>保留 " + esc(data.total_held_count) + "品番 / " + esc(data.total_held_quantity) + "台</strong> · " + esc(data.total_receipts) + "パレット</p><p>保留分は在庫未反映です。マスタの必要情報が揃ってから登録・再照合し、保留を解除して入庫します。</p>" +
        (data.receipts || []).map(function(item) {
          return "<article class='container-stock-held-item'><div><strong>#" + esc(item.id) + " · " + esc(item.container_reference) + "</strong><small>" + esc(item.source_file_name) + " · 保留 " + esc(item.held_count) + "品番 / " + esc(item.held_quantity) + "台</small><p>" + esc(item.part_numbers) + "</p></div><button type='button' class='btn-secondary' data-container-resume='" + esc(item.id) + "'>保留品番を確認・再開</button></article>";
        }).join("") + ((data.receipts || []).length ? "<div class='container-stock-row-actions'><button type='button' class='btn-secondary' data-container-held-page='-1'" + (state.heldOffset ? "" : " disabled") + ">前へ</button><span>" + (state.heldOffset + 1) + "〜" + (state.heldOffset + data.receipts.length) + " / " + esc(data.total_receipts) + "パレット</span><button type='button' class='btn-secondary' data-container-held-page='1'" + (state.heldOffset + 20 < data.total_receipts ? "" : " disabled") + ">次へ</button></div>" : "<p>保留中の品番はありません。</p>");
    } catch (error) {
      host.textContent = "保留品番を取得できませんでした: " + (error.message || String(error));
      byId("container-stock-held-toggle").textContent = "保留品番の管理（取得失敗）";
    } finally { state.heldLoading = false; }
  }
  function resetReceipt() {
    if (state.working) return;
    state.resumeRows = null;
    state.resumeReceiptId = null;
    state.holds = {};
    state.sheets = [];
    state.corrections = {};
    state.correctionReasons = {};
    state.preferredTargets = {};
    state.fileName = "";
    state.fileSha256 = "";
    state.autoReferenceName = "";
    state.costListId = "none";
    state.costListReady = true;
    state.costProductIds = [];
    state.costListRequestSeq += 1;
    state.costListLoading = false;
    byId("container-stock-reference").value = "";
    byId("container-stock-file").value = "";
    byId("container-stock-file-name").textContent = "";
    byId("container-stock-sheets").innerHTML = "";
    byId("container-stock-cost-list").value = "none";
    invalidatePreview();
    busyControls();
    setStatus("新しいファイルを選択してください。保存済みの保留品番は消えません。");
  }
  async function resumeReceipt(id) {
    if (state.working) return;
    if (state.preview && !state.applied && !root.confirm("編集中の取込内容を閉じ、保存済みの保留パレットを開きますか？")) return;
    state.working = true;
    busyControls();
    invalidatePreview();
    setStatus("保留パレットを読み込んでいます。");
    try {
      var result = await sb.rpc("get_container_stock_held_receipts", { p_receipt_id: Number(id), p_offset: 0, p_limit: 20 });
      if (result.error) throw result.error;
      var receipt = result.data.receipt;
      if (!receipt || !(receipt.lines || []).some(function(row) { return row.line_status === "held"; })) throw new Error("保留分がありません。管理一覧を再読込してください。");
      state.resumeRows = receipt.lines;
      state.resumeReceiptId = receipt.id;
      state.fileName = receipt.source_file_name;
      state.fileSha256 = receipt.source_sha256;
      state.sheets = [];
      state.holds = {};
      state.corrections = {};
      state.correctionReasons = {};
      state.preferredTargets = {};
      state.costListId = "none";
      state.costListReady = true;
      state.costListLoading = false;
      state.costProductIds = [];
      state.costListRequestSeq += 1;
      receipt.lines.forEach(function(row) {
        if (!received(row)) {
          state.holds[sourceKey(row)] = row.hold_reason;
          state.corrections[sourceKey(row)] = row.match_part_number || row.part_number;
          state.correctionReasons[sourceKey(row)] = row.match_reason || "";
        }
      });
      byId("container-stock-reference").value = receipt.container_reference;
      byId("container-stock-file-name").textContent = "保留パレット #" + receipt.id + " · " + receipt.source_file_name;
      byId("container-stock-cost-list").value = "none";
      byId("container-stock-cost-list-note").textContent = "保存済みの元品番・数量を使用します。登録済み品番の在庫は再加算しません。";
      byId("container-stock-sheets").innerHTML = "";
    } catch (error) {
      setStatus("保留パレットを開けませんでした: " + (error.message || String(error)), true);
      return;
    } finally { state.working = false; busyControls(); }
    await previewReceipt();
  }
  async function searchProducts() {
    if (state.searching || !state.preview || !state.editingKey) return;
    var input = byId("container-stock-product-search");
    var query = input ? input.value.trim() : "";
    var matchInput = byId("container-stock-match-part");
    var reasonInput = byId("container-stock-match-reason");
    if (matchInput) state.draftPart = matchInput.value;
    if (reasonInput) state.draftReason = reasonInput.value;
    state.searchQuery = query;
    state.searchError = "";
    state.searchResults = [];
    if (query.length < 3) {
      state.searchError = "3文字以上の品番またはDKD番号を入力してください。";
      renderPreview();
      return;
    }
    var row = (state.preview.rows || []).find(function(item) {
      return sourceKey(item) === state.editingKey;
    });
    if (!row) return;
    var searchKey = state.editingKey;
    var searchSeq = ++state.searchRequestSeq;
    state.searching = true;
    renderPreview();
    try {
      var result;
      if (/^[1-9][0-9]*$/.test(query)) {
        result = await sb.from("core_products")
          .select("dkd_shohin_id,category_code,genuine_part_number,genuine_part_number_2,manufacturer_part_number,manufacturer")
          .eq("dkd_shohin_id", Number(query))
          .eq("category_code", row.category_code)
          .limit(1);
      }
      if (!result || (!result.error && !(result.data || []).length)) {
        if (typeof root.fetchCoreProductMasterMatches !== "function")
          throw new Error("商品検索機能を利用できません。");
        result = await root.fetchCoreProductMasterMatches(query, row.category_code, 20);
      }
      if (result.error) throw result.error;
      if (searchSeq !== state.searchRequestSeq || searchKey !== state.editingKey) return;
      state.searchResults = result.data || [];
      if (!state.searchResults.length) state.searchError = "該当する商品がありません。品番を確認するか、商品マスタへ新規登録してください。";
    } catch (error) {
      if (searchSeq === state.searchRequestSeq)
        state.searchError = "商品を検索できませんでした: " + (error.message || String(error));
    } finally {
      if (searchSeq === state.searchRequestSeq) {
        state.searching = false;
        renderPreview();
      }
    }
  }
  async function saveMatch(part, preferredTarget) {
    if (!state.preview || !state.editingKey || state.working) return;
    var row = (state.preview.rows || []).find(function(item) {
      return sourceKey(item) === state.editingKey;
    });
    if (!row) return;
    var corrected = String(part || "").trim().toUpperCase();
    if (!validPartNumber(corrected)) {
      state.searchError = "品番は英数字で始まる4～80文字で入力してください。";
      renderPreview();
      return;
    }
    var reasonInput = byId("container-stock-match-reason");
    var reason = reasonInput ? reasonInput.value.trim() : state.draftReason.trim();
    if (corrected !== row.part_number && (reason.length < 5 || reason.length > 300 || /[\x00-\x1f\x7f]/.test(reason))) {
      state.searchError = "品番を変更する場合は、修正理由を5～300文字で入力してください。";
      renderPreview();
      return;
    }
    if (corrected === row.part_number) {
      delete state.corrections[state.editingKey];
      delete state.correctionReasons[state.editingKey];
    } else {
      state.corrections[state.editingKey] = corrected;
      state.correctionReasons[state.editingKey] = reason;
    }
    if (preferredTarget) state.preferredTargets[state.editingKey] = String(preferredTarget);
    else delete state.preferredTargets[state.editingKey];
    state.searchError = "";
    state.searchResults = [];
    state.searchRequestSeq += 1;
    state.searching = false;
    state.searchQuery = "";
    state.draftPart = corrected;
    state.draftReason = reason;
    state.draftDirty = false;
    byId("container-stock-apply").disabled = true;
    await previewReceipt();
  }
  async function openProductForm(mode, product) {
    if (typeof root.canEdit !== "function" || !root.canEdit() ||
        typeof root.openCoreProductForm !== "function") {
      setStatus("商品マスタの登録・編集権限がありません。", true);
      return;
    }
    var row = (state.preview && state.preview.rows || []).find(function(item) {
      return sourceKey(item) === state.editingKey;
    });
    if (!row) return;
    var editingKey = state.editingKey;
    if (mode === "add") {
      if (!root.DcatsProductResearch) { setStatus("調査機能を読み込めません。画面を更新してください。", true); return; }
      var token = row.match_part_number || row.part_number;
      invalidatePreview();
      setStatus("要調査：必要情報を確認して正式登録後、再照合してください。在庫は未登録です。", true);
      await root.DcatsProductResearch.open({
        token: token,
        category: row.category_code,
        onResolved: async function(fresh) {
          if (fresh.category_code !== row.category_code) throw new Error("カテゴリが異なります。取込設定を確認してください。");
          state.preferredTargets[editingKey] = String(fresh.dkd_shohin_id);
          await previewReceipt();
          if (!state.preview) throw new Error("再照合できませんでした。取込内容を確認してください。");
          var resolved = (state.preview.rows || []).find(function(item) { return sourceKey(item) === editingKey; });
          if (!resolved || !(resolved.candidates || []).some(function(candidate) { return String(candidate.dkd_shohin_id) === String(fresh.dkd_shohin_id); })) throw new Error("登録した商品と取込品番が一致しません。要調査のまま入庫できません。");
        }
      });
      return;
    }
    if (mode === "edit") {
      if (!product || !product.dkd_shohin_id) return;
      var fresh = await sb.from("core_products")
        .select(root.CORE_PRODUCT_FAST_SELECT || "*")
        .eq("dkd_shohin_id", product.dkd_shohin_id)
        .maybeSingle();
      if (fresh.error || !fresh.data) {
        setStatus("商品マスタを開けませんでした: " +
          (fresh.error ? fresh.error.message : "商品が見つかりません。"), true);
        return;
      }
      product = fresh.data;
    }
    if (editingKey !== state.editingKey || !state.preview) return;
    invalidatePreview();
    setStatus("商品マスタを保存した後、必ず取込内容を再照合してください。", true);
    await root.openCoreProductForm(mode, product || null, "management");
    if (mode === "add") {
      var originalInput = byId("pf-genuine-pn");
      var categorySelect = byId("pf-category");
      if (originalInput) originalInput.value = row.part_number;
      if (categorySelect && typeof root.formValueFromCategoryCode === "function")
        categorySelect.value = root.formValueFromCategoryCode(row.category_code);
    }
  }
  function enter() {
    var host = byId("container-stock-import");
    if (!host) return;
    host.hidden = !(typeof root.canEditProductKindStockMgmt === "function" &&
      root.canEditProductKindStockMgmt());
    if (!host.hidden) {
      invalidatePreview();
      setStatus("Excel / CSVを選択してください。ファイル名を識別子に使用します。");
      loadCostLists().catch(function(error) {
        var note = byId("container-stock-cost-list-note");
        if (note) note.textContent = "原価計算リストを取得できません: " +
          (error.message || String(error));
      });
      loadHeld();
    }
  }
  function init() {
    var fileInput = byId("container-stock-file");
    if (!fileInput) return;
    byId("container-stock-choose").addEventListener("click", function() { if (!state.working && !state.resumeRows) fileInput.click(); });
    fileInput.addEventListener("change", async function() {
      if (state.working || state.resumeRows) return;
      var file = fileInput.files && fileInput.files[0];
      if (state.autoReferenceName && selectedReference() === state.autoReferenceName)
        byId("container-stock-reference").value = "";
      state.autoReferenceName = "";
      state.sheets = [];
      state.corrections = {};
      state.correctionReasons = {};
      state.preferredTargets = {};
      state.holds = {};
      state.fileName = "";
      state.fileSha256 = "";
      state.costListId = "";
      state.costListName = "";
      state.costProductIds = [];
      state.costListReady = false;
      state.costListLoading = false;
      state.costListRequestSeq += 1;
      var costSelect = byId("container-stock-cost-list");
      if (costSelect) costSelect.value = "";
      byId("container-stock-file-name").textContent = "";
      byId("container-stock-sheets").innerHTML = "";
      invalidatePreview();
      if (!file) return;
      state.working = true;
      setStatus("ファイルを読み込んでいます。");
      try { await readFile(file); }
      catch (error) { setStatus("ファイルを読み込めませんでした: " + (error.message || String(error)), true); }
      finally { state.working = false; invalidatePreview(); }
    });
    byId("container-stock-reference").addEventListener("input", function() {
      state.autoReferenceName = "";
      invalidatePreview();
      setStatus("");
    });
    byId("container-stock-preview").addEventListener("click", previewReceipt);
    byId("container-stock-apply").addEventListener("click", applyReceipt);
    byId("container-stock-sheets").addEventListener("change", function(event) {
      var row = event.target.closest("[data-sheet-index]");
      if (!row || state.working || state.resumeRows) return;
      var sheet = state.sheets[Number(row.dataset.sheetIndex)];
      if (!sheet) return;
      var field = event.target.dataset.sheetField;
      if (field === "included") sheet.included = event.target.checked;
      else if (field === "category") sheet.category = event.target.value;
      else if (field === "headerRow") {
        var headerRow = Number(event.target.value) - 1;
        if (Number.isInteger(headerRow) && headerRow >= 0 && headerRow < sheet.matrix.length)
          sheet.overrides.headerRow = headerRow;
      } else if (field === "partColumn" || field === "quantityColumn") {
        sheet.overrides[field] = Number(event.target.value);
      }
      invalidatePreview();
      state.corrections = {};
      state.correctionReasons = {};
      state.preferredTargets = {};
      state.holds = {};
      renderSheets();
      setStatus("シート設定を変更しました。取込内容を再照合してください。");
    });
    byId("container-stock-results").addEventListener("change", function(event) {
      if (!event.target.matches("[data-container-row]") || !state.preview) return;
      var index = Number(event.target.dataset.containerRow);
      var row = state.preview.rows[index];
      if (!row || state.working || state.applied || received(row) || held(row) || state.preview.duplicate) return;
      var tableWrap = byId("container-stock-results").querySelector(".container-stock-table-wrap");
      var scrollTop = tableWrap ? tableWrap.scrollTop : 0;
      state.selections[sourceKey(row)] = event.target.value;
      renderPreview();
      tableWrap = byId("container-stock-results").querySelector(".container-stock-table-wrap");
      if (tableWrap) tableWrap.scrollTop = scrollTop;
      var select = byId("container-stock-results").querySelector("[data-container-row='" + index + "']");
      if (select) select.focus();
    });
    byId("container-stock-results").addEventListener("click", async function(event) {
      var target = event.target;
      if (state.working || state.applied || (state.preview && state.preview.duplicate)) return;
      var hold = target.closest("[data-container-hold]");
      if (hold) { toggleHold(Number(hold.dataset.containerHold)); return; }
      var edit = target.closest("[data-container-edit]");
      if (edit && state.preview) {
        var row = state.preview.rows[Number(edit.dataset.containerEdit)];
        if (!row || received(row)) return;
        state.editingKey = sourceKey(row);
        state.searchRequestSeq += 1;
        state.searching = false;
        state.draftPart = row.match_part_number || row.part_number;
        state.draftReason = state.correctionReasons[state.editingKey] || row.match_reason || "";
        state.draftDirty = false;
        state.searchResults = [];
        state.searchQuery = "";
        state.searchError = "";
        renderPreview();
        var input = byId("container-stock-match-part");
        if (input) input.focus();
        return;
      }
      if (target.closest("[data-container-close-editor]")) {
        if (state.draftDirty) {
          invalidatePreview();
          setStatus("編集中の修正を破棄しました。取込内容を再照合してください。", true);
          return;
        }
        state.editingKey = "";
        state.searchRequestSeq += 1;
        state.searching = false;
        state.draftPart = "";
        state.draftReason = "";
        state.searchResults = [];
        renderPreview();
        return;
      }
      if (target.closest("[data-container-save-match]")) {
        var matchInput = byId("container-stock-match-part");
        await saveMatch(matchInput && matchInput.value);
        return;
      }
      if (target.closest("[data-container-search-product]")) {
        await searchProducts();
        return;
      }
      var useProduct = target.closest("[data-container-use-product]");
      if (useProduct) {
        var product = state.searchResults[Number(useProduct.dataset.containerUseProduct)];
        if (!product) return;
        var canonical = product.genuine_part_number || product.genuine_part_number_2 || product.manufacturer_part_number;
        await saveMatch(canonical, product.dkd_shohin_id);
        return;
      }
      var editProduct = target.closest("[data-container-edit-product]");
      if (editProduct) {
        var existing = state.searchResults[Number(editProduct.dataset.containerEditProduct)];
        if (existing) await openProductForm("edit", existing);
        return;
      }
      if (target.closest("[data-container-add-product]")) await openProductForm("add", null);
    });
    byId("container-stock-results").addEventListener("keydown", function(event) {
      if (event.key === "Enter" && event.target.id === "container-stock-product-search") {
        event.preventDefault();
        searchProducts();
      }
    });
    var costListSelect = byId("container-stock-cost-list");
    if (costListSelect) costListSelect.addEventListener("change", function() {
      state.costListId = costListSelect.value;
      state.costListName = costListSelect.selectedOptions[0]
        ? costListSelect.selectedOptions[0].textContent : "";
      state.preferredTargets = {};
      invalidatePreview();
      loadCostListProducts();
    });
    byId("container-stock-results").addEventListener("input", function(event) {
      if (event.target.matches("[data-container-hold-reason]") && state.preview && !state.working && !state.applied) {
        var row = state.preview.rows[Number(event.target.dataset.containerHoldReason)];
        if (row && held(row)) {
          state.holds[sourceKey(row)] = event.target.value;
          byId("container-stock-apply").disabled = !!state.editingKey || state.draftDirty || !!state.preview.duplicate ||
            state.preview.rows.some(function(item) {
              if (received(item)) return false;
              if (held(item)) return !validHold(item);
              return !(item.candidates || []).some(function(candidate) {
                return String(candidate.dkd_shohin_id) === String(state.selections[sourceKey(item)]) && candidate.variant_active !== false;
              });
            });
        }
      }
      if (event.target.id === "container-stock-match-part") {
        state.draftPart = event.target.value;
        state.draftDirty = true;
        byId("container-stock-apply").disabled = true;
      }
      if (event.target.id === "container-stock-match-reason") {
        state.draftReason = event.target.value;
        state.draftDirty = true;
        byId("container-stock-apply").disabled = true;
      }
      if (event.target.id === "container-stock-product-search") state.searchQuery = event.target.value;
    });
    byId("container-stock-history-toggle").addEventListener("click", function() {
      var history = byId("container-stock-history");
      history.hidden = !history.hidden;
      if (!history.hidden) loadHistory();
    });
    byId("container-stock-results").addEventListener("change", function(event) {
      if (event.target.matches("[data-container-hold-reason]")) renderPreview();
    });
    byId("container-stock-new").addEventListener("click", function() {
      if (state.preview && !state.applied && !root.confirm("編集中の取込内容を閉じますか？保存済みの保留品番は消えません。")) return;
      resetReceipt();
    });
    byId("container-stock-held-toggle").addEventListener("click", function() {
      var panel = byId("container-stock-held-panel");
      panel.hidden = !panel.hidden;
      if (!panel.hidden) loadHeld();
    });
    byId("container-stock-held-refresh").addEventListener("click", loadHeld);
    byId("container-stock-held-list").addEventListener("click", function(event) {
      var resume = event.target.closest("[data-container-resume]");
      if (resume) { resumeReceipt(resume.dataset.containerResume); return; }
      var page = event.target.closest("[data-container-held-page]");
      if (page && !state.heldLoading && !state.working) {
        state.heldOffset = Math.max(0,state.heldOffset + Number(page.dataset.containerHeldPage) * 20);
        loadHeld();
      }
    });
  }
  root.DcatsContainerStockImport = {
    enter: enter, _collectRows: collectedRows, _renderPreview: renderPreview,
    _validPartNumber: validPartNumber, _useFileNameAsReference: useFileNameAsReference,
    _automaticTarget: automaticTarget, _state: state,
    _toggleHold: toggleHold, _previewReceipt: previewReceipt, _applyReceipt: applyReceipt,
    _resumeReceipt: resumeReceipt, _loadHeld: loadHeld, _resetReceipt: resetReceipt
  };
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
    else init();
  }
})(typeof window !== "undefined" ? window : globalThis);
