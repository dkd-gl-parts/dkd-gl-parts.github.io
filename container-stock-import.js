(function(root) {
  "use strict";

  var MAX_FILE_BYTES = 30 * 1024 * 1024;
  var MAX_LINES = 200;
  var state = {
    fileName: "",
    fileSha256: "",
    sheets: [],
    preview: null,
    selections: {},
    corrections: {},
    preferredTargets: {},
    editingKey: "",
    searchResults: [],
    searchQuery: "",
    searchError: "",
    searching: false,
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
  function sourceKey(row) {
    return row.category_code + "|" + String(row.part_number || "").trim().toUpperCase();
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
    state.selections = {};
    state.editingKey = "";
    state.searchResults = [];
    state.applied = false;
    byId("container-stock-results").innerHTML = "";
    byId("container-stock-apply").disabled = true;
    byId("container-stock-preview").disabled = state.working || !state.sheets.length || selectedReference().length < 3;
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
      return Object.assign({}, row, { match_part_number: matchPart });
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
    state.preferredTargets = {};
    byId("container-stock-file-name").textContent = file.name;
    invalidatePreview();
    renderSheets();
    setStatus("ファイルを読み込みました。シート・列・区分を確認し、取込内容を照合してください。");
  }
  function sourceLabel(row) {
    return (row.sources || []).map(function(source) {
      return source.sheet + " " + (source.rows || []).join(",") + "行";
    }).join(" / ");
  }
  function renderResolver(row) {
    if (!row) return "";
    var original = row.part_number;
    var matchPart = row.match_part_number || original;
    var canManageProducts = typeof root.canEdit === "function" && root.canEdit();
    var html = "<section class='container-stock-resolver' aria-label='品番の照合を修正'>" +
      "<div class='container-stock-resolver-head'><div><strong>照合を修正 · " + esc(original) + "</strong>" +
      "<small>" + esc(sourceLabel(row)) + " / " + esc(row.quantity) + "台</small></div>" +
      "<button type='button' class='btn-secondary' data-container-close-editor>閉じる</button></div>" +
      "<p>元ファイルの品番・数量は変更しません。読み取り違い、またはこの入庫だけの品番読み替えを指定し、再照合します。</p>" +
      "<div class='container-stock-resolver-fields'><label>照合に使う品番" +
      "<input class='form-input' id='container-stock-match-part' type='text' maxlength='80' value='" + esc(matchPart) + "'></label>" +
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
    if (canManageProducts) html += "<button type='button' class='btn-secondary' data-container-add-product>該当商品がなければ新規登録</button>";
    else html += "<p class='container-stock-resolver-hint'>商品マスタへの登録・変更には商品管理権限が必要です。</p>";
    return html + "</section>";
  }
  function renderPreview() {
    var host = byId("container-stock-results");
    var preview = state.preview;
    if (!preview) { host.innerHTML = ""; return; }
    var rows = preview.rows || [];
    var duplicate = preview.duplicate;
    var unmatched = rows.filter(function(row) { return !(row.candidates || []).length; }).length;
    var needsChoice = rows.filter(function(row) {
      return (row.candidates || []).length > 0 && !state.selections[sourceKey(row)];
    }).length;
    var html = "<div class='container-stock-summary'>" + rows.length + "品番 / " +
      Number(preview.total_quantity || 0).toLocaleString("ja-JP") + "台" +
      "<span class='container-stock-unresolved' role='status'>一致なし " + unmatched + "件</span>" +
      "<span>候補選択待ち " + needsChoice + "件</span>";
    if (duplicate) {
      html += "<strong class='container-stock-duplicate'>取込済み: #" + esc(duplicate.id) +
        " · " + esc(duplicate.container_reference) + " · " + esc(duplicate.received_at) + "</strong>";
    }
    html += "</div>";
    if (unmatched || needsChoice) html += "<p class='container-stock-resolution-notice'>未解決の行があるため、一括入庫はできません。行を修正・選択してから再確認してください。</p>";
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
      if (!candidates.length) {
        html += "<span class='container-stock-unresolved'>エラー: 商品マスタに一致なし</span>";
      } else {
        if (!selected) html += "<span class='container-stock-choice'>候補の選択が必要</span>";
        html += "<select class='form-select' data-container-row='" + index + "' aria-label='" +
          esc(row.part_number + " の入庫先") + "'><option value=''>候補を選択</option>";
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
              (active ? "" : " / 無効")) + "</option>";
        });
        html += "</select>";
      }
      html += "<button type='button' class='container-stock-fix-button' data-container-edit='" + index + "'>品番を修正</button>";
      html += "</td><td>" + (chosen ?
        esc(String(chosen.stock_qty || 0) + " → " +
          String(Number(chosen.stock_qty || 0) + Number(row.quantity))) : "—") +
        "</td><td class='container-stock-source'>" + esc(sources) + "</td></tr>";
    });
    html += "</tbody></table></div>";
    host.innerHTML = html;
    byId("container-stock-apply").disabled =
      !!duplicate || state.working || state.applied || !rows.length ||
      rows.some(function(row) {
        return !state.selections[sourceKey(row)] || !(row.candidates || []).some(function(candidate) {
          return String(candidate.dkd_shohin_id) === state.selections[sourceKey(row)] && candidate.variant_active !== false;
        });
      });
  }
  async function previewReceipt() {
    if (state.working) return;
    var reference = selectedReference();
    if (reference.length < 3) { setStatus("コンテナ識別子を3文字以上で入力してください。", true); return; }
    var rows;
    try { rows = collectedRows(); }
    catch (error) { setStatus(error.message, true); return; }
    state.working = true;
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
      state.preview = result.data;
      state.selections = {};
      (state.preview.rows || []).forEach(function(row) {
        var candidates = row.candidates || [];
        var preferred = state.preferredTargets[sourceKey(row)];
        if (preferred && candidates.some(function(candidate) {
          return String(candidate.dkd_shohin_id) === preferred && candidate.variant_active !== false;
        })) state.selections[sourceKey(row)] = preferred;
        else if (candidates.length === 1 && candidates[0].variant_active !== false)
          state.selections[sourceKey(row)] = String(candidates[0].dkd_shohin_id);
      });
      renderPreview();
      if (state.preview.duplicate) setStatus("同じコンテナ識別子、ファイル、または品番・数量の内容が取込済みです。再取込できません。", true);
      else if ((state.preview.rows || []).some(function(row) {
        return !(row.candidates || []).length;
      })) setStatus("一致なしの行があります。品番を修正するか、商品マスタを確認してください。全行の照合が終わるまで入庫できません。", true);
      else setStatus("候補を確認してください。すべての入庫先を確定すると入庫できます。");
    } catch (error) {
      invalidatePreview();
      setStatus("照合に失敗しました: " + (error.message || String(error)), true);
    } finally {
      state.working = false;
      byId("container-stock-preview").disabled = !state.sheets.length || selectedReference().length < 3;
    }
  }
  async function applyReceipt() {
    if (state.working || !state.preview || state.preview.duplicate || state.applied) return;
    var rows = state.preview.rows || [];
    if (!rows.length || rows.some(function(row) { return !state.selections[sourceKey(row)]; })) return;
    var reference = selectedReference();
    if (reference !== state.preview.container_reference) {
      invalidatePreview();
      setStatus("コンテナ識別子が変わりました。再照合してください。", true);
      return;
    }
    if (!root.confirm(reference + " の " + rows.length + "品番・" +
      Number(state.preview.total_quantity).toLocaleString("ja-JP") +
      "台を在庫へ加算します。入庫を確定しますか？")) return;
    state.working = true;
    byId("container-stock-apply").disabled = true;
    byId("container-stock-preview").disabled = true;
    setStatus("在庫と入庫履歴を登録しています。");
    try {
      var payload = rows.map(function(row) {
        return {
          part_number: row.part_number,
          match_part_number: row.match_part_number || row.part_number,
          category_code: row.category_code,
          quantity: row.quantity,
          sources: row.sources,
          target_dkd_shohin_id: Number(state.selections[sourceKey(row)])
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
      setStatus("入庫 #" + result.data.receipt_id + " を登録しました。" +
        result.data.line_count + "品番・" +
        Number(result.data.total_quantity).toLocaleString("ja-JP") + "台を反映しました。");
      renderPreview();
      try {
        await loadHistory();
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
      byId("container-stock-preview").disabled = !state.sheets.length || selectedReference().length < 3;
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
          "品番 / " + esc(row.total_quantity) + "台 · " + esc(row.received_at) + "</li>";
      }).join("") + "</ul>" : "入庫履歴はありません。";
  }
  async function searchProducts() {
    if (state.searching || !state.preview || !state.editingKey) return;
    var input = byId("container-stock-product-search");
    var query = input ? input.value.trim() : "";
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
      state.searchResults = result.data || [];
      if (!state.searchResults.length) state.searchError = "該当する商品がありません。品番を確認するか、商品マスタへ新規登録してください。";
    } catch (error) {
      state.searchError = "商品を検索できませんでした: " + (error.message || String(error));
    } finally {
      state.searching = false;
      renderPreview();
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
    if (corrected === row.part_number) delete state.corrections[state.editingKey];
    else state.corrections[state.editingKey] = corrected;
    if (preferredTarget) state.preferredTargets[state.editingKey] = String(preferredTarget);
    else delete state.preferredTargets[state.editingKey];
    state.searchError = "";
    state.searchResults = [];
    state.searchQuery = "";
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
      setStatus("コンテナ識別子とExcel / CSVを指定してください。");
    }
  }
  function init() {
    var fileInput = byId("container-stock-file");
    if (!fileInput) return;
    byId("container-stock-choose").addEventListener("click", function() { fileInput.click(); });
    fileInput.addEventListener("change", async function() {
      var file = fileInput.files && fileInput.files[0];
      state.sheets = [];
      state.corrections = {};
      state.preferredTargets = {};
      state.fileName = "";
      state.fileSha256 = "";
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
      invalidatePreview();
      setStatus("");
    });
    byId("container-stock-preview").addEventListener("click", previewReceipt);
    byId("container-stock-apply").addEventListener("click", applyReceipt);
    byId("container-stock-sheets").addEventListener("change", function(event) {
      var row = event.target.closest("[data-sheet-index]");
      if (!row) return;
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
      state.preferredTargets = {};
      renderSheets();
      setStatus("シート設定を変更しました。取込内容を再照合してください。");
    });
    byId("container-stock-results").addEventListener("change", function(event) {
      if (!event.target.matches("[data-container-row]") || !state.preview) return;
      var index = Number(event.target.dataset.containerRow);
      var row = state.preview.rows[index];
      if (!row) return;
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
      var edit = target.closest("[data-container-edit]");
      if (edit && state.preview) {
        var row = state.preview.rows[Number(edit.dataset.containerEdit)];
        if (!row) return;
        state.editingKey = sourceKey(row);
        state.searchResults = [];
        state.searchQuery = "";
        state.searchError = "";
        renderPreview();
        var input = byId("container-stock-match-part");
        if (input) input.focus();
        return;
      }
      if (target.closest("[data-container-close-editor]")) {
        state.editingKey = "";
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
    byId("container-stock-history-toggle").addEventListener("click", function() {
      var history = byId("container-stock-history");
      history.hidden = !history.hidden;
      if (!history.hidden) loadHistory();
    });
  }
  root.DcatsContainerStockImport = {
    enter: enter, _collectRows: collectedRows, _renderPreview: renderPreview,
    _validPartNumber: validPartNumber, _state: state
  };
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
    else init();
  }
})(typeof window !== "undefined" ? window : globalThis);
