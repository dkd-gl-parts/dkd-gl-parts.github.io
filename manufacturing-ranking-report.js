(function() {
  "use strict";

  var MAX_FILE_BYTES = 50 * 1024 * 1024;
  var MAX_SOURCE_ROWS = 150000;
  var PREVIEW_LIMIT = 200;
  var DATA_PAGE_SIZE = 1000;
  var state = {
    fileName: "",
    dataset: null,
    isLoading: false,
    rows: [],
    sheets: [],
    results: [],
    summary: null,
    options: null
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeText(value) {
    var text = String(value == null ? "" : value);
    try { text = text.normalize("NFKC"); } catch (e) {}
    return text.trim();
  }

  function normalizeHeader(value) {
    return normalizeText(value).replace(/[\s　]/g, "").toUpperCase();
  }

  function normalizePart(value) {
    var text = normalizeText(value).toUpperCase();
    return text
      .replace(/[‐‑‒–—―ー−]/g, "-")
      .replace(/[\s　]/g, "");
  }

  function normalizeSearch(value) {
    return normalizePart(value).replace(/-/g, "");
  }

  function isLikelyPartNumber(value) {
    var key = normalizePart(value);
    return key.length >= 4 && /[0-9]/.test(key) && key !== "-";
  }

  function parseNumber(value) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    var text = normalizeText(value).replace(/,/g, "");
    if (!text) return 0;
    var parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 2 }).format(Number(value || 0));
  }

  function columnIndex(headers, candidates) {
    var normalized = headers.map(normalizeHeader);
    for (var i = 0; i < candidates.length; i++) {
      var index = normalized.indexOf(normalizeHeader(candidates[i]));
      if (index >= 0) return index;
    }
    return -1;
  }

  function detectHeaderRow(matrix) {
    var limit = Math.min(matrix.length, 15);
    for (var i = 0; i < limit; i++) {
      var row = Array.isArray(matrix[i]) ? matrix[i] : [];
      var headers = row.map(normalizeHeader);
      var hasShipment = headers.indexOf("出荷数計") >= 0 || headers.indexOf("出荷数") >= 0;
      var hasIdentity = headers.indexOf("商品名") >= 0 || headers.indexOf("商品CD") >= 0 || headers.indexOf("大光品番") >= 0;
      if (hasShipment && hasIdentity) return i;
    }
    return -1;
  }

  function cellValue(row, index) {
    return index >= 0 && index < row.length ? normalizeText(row[index]) : "";
  }

  function extractSheetRows(sheetName, worksheet) {
    var matrix = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "", raw: true });
    var headerRow = detectHeaderRow(matrix);
    if (headerRow < 0) return { rows: [], warning: "見出しを検出できませんでした" };

    var headers = matrix[headerRow].map(normalizeText);
    var columns = {
      productName: columnIndex(headers, ["商品名", "品名"]),
      productCode: columnIndex(headers, ["商品CD", "商品コード"]),
      genuine: columnIndex(headers, ["純正品番"]),
      maker: columnIndex(headers, ["メーカー品番", "製造メーカー品番"]),
      genuine2: columnIndex(headers, ["純正品番2", "純正品番２"]),
      body: columnIndex(headers, ["純正本体品番"]),
      clutch: columnIndex(headers, ["純正クラッチ品番"]),
      type: columnIndex(headers, ["タイプ"]),
      daiko: columnIndex(headers, ["大光品番", "自社品番"]),
      shipment: columnIndex(headers, ["出荷数計", "出荷数"]),
      substitute: columnIndex(headers, ["代替台数"])
    };
    if (columns.shipment < 0) return { rows: [], warning: "出荷数列を検出できませんでした" };

    var result = [];
    for (var i = headerRow + 1; i < matrix.length; i++) {
      var row = Array.isArray(matrix[i]) ? matrix[i] : [];
      var shipment = parseNumber(row[columns.shipment]);
      var substitute = columns.substitute >= 0 ? parseNumber(row[columns.substitute]) : 0;
      var item = {
        id: sheetName + "::" + String(i + 1),
        sheet: sheetName,
        sourceRow: i + 1,
        productName: cellValue(row, columns.productName),
        productCode: cellValue(row, columns.productCode),
        genuine: cellValue(row, columns.genuine),
        maker: cellValue(row, columns.maker),
        genuine2: cellValue(row, columns.genuine2),
        body: cellValue(row, columns.body),
        clutch: cellValue(row, columns.clutch),
        type: cellValue(row, columns.type),
        daiko: cellValue(row, columns.daiko),
        shipment: shipment,
        substitute: substitute
      };
      var hasIdentity = item.productCode || item.genuine || item.maker || item.daiko;
      if (!hasIdentity || (shipment === 0 && substitute === 0)) continue;
      result.push(item);
    }
    return { rows: result, headerRow: headerRow + 1, warning: "" };
  }

  function parseWorkbook(arrayBuffer, fileName) {
    if (!window.XLSX) throw new Error("Excel読込ライブラリを読み込めませんでした。通信状態を確認してください。");
    var workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: false });
    var rows = [];
    var sheets = [];
    var warnings = [];

    workbook.SheetNames.forEach(function(sheetName) {
      var extracted = extractSheetRows(sheetName, workbook.Sheets[sheetName]);
      if (extracted.rows.length) {
        rows = rows.concat(extracted.rows);
        sheets.push({
          name: sheetName,
          count: extracted.rows.length,
          headerRow: extracted.headerRow,
          isAggregate: /集計|総合|全体/.test(sheetName)
        });
      } else if (extracted.warning) {
        warnings.push(sheetName + ": " + extracted.warning);
      }
      if (rows.length > MAX_SOURCE_ROWS) {
        throw new Error("読込行数が上限の" + formatNumber(MAX_SOURCE_ROWS) + "行を超えました。");
      }
    });
    if (!rows.length) throw new Error("出荷数列を持つ明細シートが見つかりませんでした。");
    return { fileName: fileName || "Excel", rows: rows, sheets: sheets, warnings: warnings };
  }

  function setSourceStatus(message, type) {
    var element = byId("manufacturing-ranking-source-status");
    if (!element) return;
    element.textContent = message;
    element.classList.remove("is-loading", "is-success", "is-error");
    if (type) element.classList.add("is-" + type);
  }

  function setLoading(isLoading) {
    var reload = byId("manufacturing-ranking-reload");
    var preview = byId("manufacturing-ranking-preview");
    var pdf = byId("manufacturing-ranking-pdf");
    state.isLoading = isLoading;
    if (reload) reload.disabled = isLoading;
    if (preview) preview.disabled = isLoading;
    if (pdf) pdf.disabled = isLoading || !state.results.length;
  }

  function applyParsedSource(parsed) {
    state.fileName = parsed.fileName;
    state.rows = parsed.rows;
    state.sheets = parsed.sheets;
    renderCategoryOptions();
    var message = parsed.fileName + " / " + formatNumber(parsed.rows.length) + "件 / " + parsed.sheets.length + "シートを読み込みました。";
    if (parsed.warnings && parsed.warnings.length) message += " 未使用: " + parsed.warnings.join("、");
    setSourceStatus(message, "success");
    updatePreview();
  }

  async function loadSourceFile(file) {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setSourceStatus("ファイルが50MBを超えています。対象データを分割してください。", "error");
      return;
    }
    if (!/\.(xls|xlsx|xlsm)$/i.test(file.name || "")) {
      setSourceStatus(".xls / .xlsx / .xlsm ファイルを選択してください。", "error");
      return;
    }

    setLoading(true);
    setSourceStatus(file.name + " を読み込んでいます...", "loading");
    try {
      var parsed = parseWorkbook(await file.arrayBuffer(), file.name);
      applyParsedSource(parsed);
    } catch (error) {
      state.fileName = "";
      state.rows = [];
      state.sheets = [];
      state.results = [];
      state.summary = null;
      setSourceStatus(error && error.message ? error.message : String(error), "error");
      renderEmptyPreview("Excelを読み込めませんでした", "ファイル形式と見出しを確認してください。");
    } finally {
      setLoading(false);
    }
  }

  function mapDatabaseRow(row) {
    return {
      id: String(row.dataset_id) + "::" + String(row.id),
      sheet: normalizeText(row.category_name),
      sourceRow: Number(row.source_row_number || 0),
      productName: normalizeText(row.product_name),
      productCode: normalizeText(row.product_code),
      genuine: normalizeText(row.genuine_part_number),
      maker: normalizeText(row.manufacturer_part_number),
      genuine2: normalizeText(row.genuine_part_number_2),
      body: normalizeText(row.genuine_body_part_number),
      clutch: normalizeText(row.genuine_clutch_part_number),
      type: normalizeText(row.product_type),
      shipment: Number(row.shipment_count || 0),
      substitute: Number(row.substitute_count || 0)
    };
  }

  function renderDatasetMetadata(dataset) {
    var name = byId("manufacturing-ranking-dataset-name");
    var meta = byId("manufacturing-ranking-dataset-meta");
    if (name) name.textContent = dataset.dataset_name || (String(dataset.report_year) + "年 製造ランキング");
    if (meta) {
      var imported = dataset.imported_at ? new Date(dataset.imported_at).toLocaleString("ja-JP") : "-";
      meta.textContent = formatNumber(dataset.row_count) + "件 / " + formatNumber(dataset.sheet_count) + "カテゴリ / 更新 " + imported;
    }
  }

  async function fetchDatasetRows(datasetId) {
    var rows = [];
    for (var offset = 0; ; offset += DATA_PAGE_SIZE) {
      var response = await sb.from("manufacturing_report_rows")
        .select("id,dataset_id,category_name,category_order,source_row_number,is_aggregate,product_name,product_code,genuine_part_number,manufacturer_part_number,genuine_part_number_2,genuine_body_part_number,genuine_clutch_part_number,product_type,shipment_count,substitute_count")
        .eq("dataset_id", datasetId)
        .order("category_order", { ascending: true })
        .order("source_row_number", { ascending: true })
        .range(offset, offset + DATA_PAGE_SIZE - 1);
      if (response.error) throw response.error;
      var page = response.data || [];
      rows = rows.concat(page);
      if (page.length < DATA_PAGE_SIZE) break;
    }
    return rows;
  }

  async function loadDcatsSource() {
    if (state.isLoading) return;
    setLoading(true);
    setSourceStatus("D-CATSの出荷実績を読み込んでいます...", "loading");
    renderEmptyPreview("D-CATSデータを読み込んでいます", "最新の保存済みデータを取得しています。");
    try {
      var datasetResponse = await sb.from("manufacturing_report_datasets")
        .select("id,report_year,dataset_name,source_file_name,source_file_sha256,source_file_modified_at,row_count,sheet_count,sheet_manifest,imported_at")
        .eq("is_active", true)
        .order("report_year", { ascending: false })
        .order("imported_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (datasetResponse.error) throw datasetResponse.error;
      if (!datasetResponse.data) throw new Error("有効な製造ランキングデータが登録されていません。");

      var dataset = datasetResponse.data;
      var sourceRows = await fetchDatasetRows(dataset.id);
      if (sourceRows.length !== Number(dataset.row_count || 0)) {
        throw new Error("D-CATSの帳票データ件数が一致しません。管理者に確認してください。");
      }

      state.dataset = dataset;
      state.fileName = dataset.source_file_name || dataset.dataset_name || "D-CATS";
      state.rows = sourceRows.map(mapDatabaseRow);
      state.sheets = Array.isArray(dataset.sheet_manifest) ? dataset.sheet_manifest.map(function(sheet) {
        return {
          name: normalizeText(sheet.name),
          count: Number(sheet.count || 0),
          headerRow: Number(sheet.header_row || 0),
          isAggregate: !!sheet.is_aggregate
        };
      }) : [];
      renderDatasetMetadata(dataset);
      renderCategoryOptions();
      setSourceStatus("D-CATS保存データを読み込みました。元データ: " + state.fileName, "success");
      updatePreview();
    } catch (error) {
      state.dataset = null;
      state.fileName = "";
      state.rows = [];
      state.sheets = [];
      state.results = [];
      state.summary = null;
      setSourceStatus(error && error.message ? error.message : String(error), "error");
      renderEmptyPreview("D-CATSデータを読み込めませんでした", "接続状態または閲覧権限を確認してください。");
    } finally {
      setLoading(false);
    }
  }

  function renderCategoryOptions() {
    var host = byId("manufacturing-ranking-categories");
    if (!host) return;
    var hasDetailSheets = state.sheets.some(function(sheet) { return !sheet.isAggregate; });
    host.innerHTML = state.sheets.map(function(sheet) {
      var checked = !sheet.isAggregate || !hasDetailSheets;
      var aggregate = sheet.isAggregate ? "<small>全体集計 - カテゴリ別シートとの重複に注意</small>" : "<small>" + formatNumber(sheet.count) + "件</small>";
      return "<label class='ranking-report-category-option'>" +
        "<input type='checkbox' value='" + escapeHtml(sheet.name) + "'" + (checked ? " checked" : "") + ">" +
        "<span><strong>" + escapeHtml(sheet.name) + "</strong>" + aggregate + "</span></label>";
    }).join("");
  }

  function selectedCategories() {
    return Array.prototype.map.call(
      document.querySelectorAll("#manufacturing-ranking-categories input[type='checkbox']:checked"),
      function(input) { return input.value; }
    );
  }

  function positiveInteger(id, fallback) {
    var parsed = parseInt(byId(id).value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  function nonNegativeNumber(id, fallback) {
    var parsed = Number(byId(id).value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
  }

  function readOptions() {
    var startRank = positiveInteger("manufacturing-ranking-start", 1);
    var endRank = positiveInteger("manufacturing-ranking-end", 100);
    if (endRank < startRank) {
      var swap = startRank;
      startRank = endRank;
      endRank = swap;
    }
    return {
      categories: selectedCategories(),
      metric: byId("manufacturing-ranking-metric").value,
      rankScope: byId("manufacturing-ranking-scope").value,
      startRank: startRank,
      endRank: endRank,
      minShipment: nonNegativeNumber("manufacturing-ranking-min-shipment", 0),
      query: normalizeSearch(byId("manufacturing-ranking-query").value),
      compatibilityMode: byId("manufacturing-ranking-compat-mode").value,
      compatibilityBasis: byId("manufacturing-ranking-compat-basis").value,
      orientation: byId("manufacturing-ranking-orientation").value,
      showCompatibility: byId("manufacturing-ranking-show-compat").checked,
      showSubstitute: byId("manufacturing-ranking-show-substitute").checked
    };
  }

  function metricValue(row, metric) {
    if (metric === "shipment_plus_substitute") return row.shipment + row.substitute;
    if (metric === "substitute") return row.substitute;
    return row.shipment;
  }

  function compatibilityTokens(row, basis) {
    if (basis === "none") return [];
    var tokens = [];
    function add(prefix, value) {
      if (isLikelyPartNumber(value)) tokens.push(prefix + normalizePart(value));
    }
    if (basis === "maker" || basis === "maker_genuine") add("maker:", row.maker);
    if (basis === "genuine" || basis === "maker_genuine") {
      add("genuine:", row.genuine);
      add("genuine:", row.genuine2);
    }
    if (basis === "all_source") {
      [row.genuine, row.genuine2, row.maker, row.body, row.clutch].forEach(function(value) {
        add("part:", value);
      });
    }
    return tokens;
  }

  function createCompatibilityGroups(rows, basis) {
    var parent = rows.map(function(_, index) { return index; });
    var rank = rows.map(function() { return 0; });
    var tokenOwners = Object.create(null);

    function find(index) {
      while (parent[index] !== index) {
        parent[index] = parent[parent[index]];
        index = parent[index];
      }
      return index;
    }
    function union(left, right) {
      var rootLeft = find(left);
      var rootRight = find(right);
      if (rootLeft === rootRight) return;
      if (rank[rootLeft] < rank[rootRight]) parent[rootLeft] = rootRight;
      else if (rank[rootLeft] > rank[rootRight]) parent[rootRight] = rootLeft;
      else { parent[rootRight] = rootLeft; rank[rootLeft]++; }
    }

    rows.forEach(function(row, index) {
      compatibilityTokens(row, basis).forEach(function(token) {
        var scopedToken = row.sheet + "|" + token;
        if (Object.prototype.hasOwnProperty.call(tokenOwners, scopedToken)) union(index, tokenOwners[scopedToken]);
        else tokenOwners[scopedToken] = index;
      });
    });

    var grouped = Object.create(null);
    rows.forEach(function(row, index) {
      var root = find(index);
      if (!grouped[root]) grouped[root] = [];
      grouped[root].push(row);
    });
    return Object.keys(grouped).map(function(key) { return grouped[key]; });
  }

  function rowSearchText(row) {
    return normalizeSearch([
      row.sheet, row.productName, row.productCode, row.genuine, row.genuine2,
      row.maker, row.body, row.clutch, row.type
    ].join(" "));
  }

  function representativeFor(group, metric) {
    return group.slice().sort(function(left, right) {
      return metricValue(right, metric) - metricValue(left, metric) ||
        right.shipment - left.shipment ||
        normalizeSearch(left.maker || left.genuine || left.productCode).localeCompare(normalizeSearch(right.maker || right.genuine || right.productCode), "ja");
    })[0];
  }

  function resultFromRow(row, group, metric, aggregate) {
    var shipment = aggregate ? group.reduce(function(sum, item) { return sum + item.shipment; }, 0) : row.shipment;
    var substitute = aggregate ? group.reduce(function(sum, item) { return sum + item.substitute; }, 0) : row.substitute;
    var score = metric === "shipment_plus_substitute" ? shipment + substitute : metric === "substitute" ? substitute : shipment;
    return {
      row: row,
      group: group,
      shipment: shipment,
      substitute: substitute,
      score: score,
      rank: 0
    };
  }

  function compareResults(left, right) {
    return right.score - left.score ||
      right.shipment - left.shipment ||
      left.row.sheet.localeCompare(right.row.sheet, "ja") ||
      normalizeSearch(left.row.maker || left.row.genuine || left.row.productCode).localeCompare(normalizeSearch(right.row.maker || right.row.genuine || right.row.productCode), "ja");
  }

  function assignRanks(results) {
    results.forEach(function(result, index) {
      result.rank = index + 1;
    });
  }

  function buildRanking(rows, options) {
    var categorySet = Object.create(null);
    options.categories.forEach(function(category) { categorySet[category] = true; });
    var sourceRows = rows.filter(function(row) { return categorySet[row.sheet]; });
    var groups = createCompatibilityGroups(sourceRows, options.compatibilityBasis);
    var compatibleGroupCount = groups.filter(function(group) { return group.length > 1; }).length;
    var candidates = [];
    var omittedRows = 0;

    groups.forEach(function(group) {
      if (options.query && !group.some(function(row) { return rowSearchText(row).indexOf(options.query) >= 0; })) return;
      if (options.compatibilityMode === "all") {
        group.forEach(function(row) { candidates.push(resultFromRow(row, group, options.metric, false)); });
      } else {
        var representative = representativeFor(group, options.metric);
        omittedRows += Math.max(0, group.length - 1);
        candidates.push(resultFromRow(representative, group, options.metric, options.compatibilityMode === "consolidated"));
      }
    });

    candidates = candidates.filter(function(result) { return result.shipment >= options.minShipment; });
    var ranked = [];
    if (options.rankScope === "per_category") {
      options.categories.forEach(function(category) {
        var categoryResults = candidates.filter(function(result) { return result.row.sheet === category; });
        categoryResults.sort(compareResults);
        assignRanks(categoryResults);
        ranked = ranked.concat(categoryResults.filter(function(result) {
          return result.rank >= options.startRank && result.rank <= options.endRank;
        }));
      });
    } else {
      candidates.sort(compareResults);
      assignRanks(candidates);
      ranked = candidates.filter(function(result) {
        return result.rank >= options.startRank && result.rank <= options.endRank;
      });
    }
    return {
      results: ranked,
      sourceRowCount: sourceRows.length,
      candidateCount: candidates.length,
      compatibleGroupCount: compatibleGroupCount,
      omittedRows: omittedRows
    };
  }

  function metricLabel(metric) {
    if (metric === "shipment_plus_substitute") return "出荷数 + 代替台数";
    if (metric === "substitute") return "代替台数";
    return "出荷数";
  }

  function compatibilityModeLabel(mode) {
    if (mode === "representative") return "代表品番のみ";
    if (mode === "consolidated") return "互換グループ合算";
    return "全品番表示";
  }

  function rankScopeLabel(scope) {
    return scope === "overall" ? "選択カテゴリ通算" : "カテゴリ別";
  }

  function compatibilityMembers(result) {
    return result.group.filter(function(row) { return row.id !== result.row.id; });
  }

  function compatibilityLine(row) {
    var numbers = [row.genuine, row.genuine2, row.maker, row.body, row.clutch].filter(function(value, index, values) {
      return value && values.indexOf(value) === index;
    });
    return numbers.join(" / ") + " (出荷 " + formatNumber(row.shipment) + ")";
  }

  function renderSummary(summary, options) {
    var host = byId("manufacturing-ranking-summary");
    if (!host) return;
    host.innerHTML = [
      ["対象件数", formatNumber(summary.results.length)],
      ["対象カテゴリ", formatNumber(options.categories.length)],
      ["互換グループ", formatNumber(summary.compatibleGroupCount)],
      ["順位範囲", formatNumber(options.startRank) + " - " + formatNumber(options.endRank)]
    ].map(function(card) {
      return "<div class='ranking-report-summary-card'><span>" + card[0] + "</span><strong>" + card[1] + "</strong></div>";
    }).join("");
  }

  function renderWarning(options, summary) {
    var warning = byId("manufacturing-ranking-warning");
    if (!warning) return;
    var selectedSheets = state.sheets.filter(function(sheet) { return options.categories.indexOf(sheet.name) >= 0; });
    var hasAggregate = selectedSheets.some(function(sheet) { return sheet.isAggregate; });
    var hasDetail = selectedSheets.some(function(sheet) { return !sheet.isAggregate; });
    var messages = [];
    if (hasAggregate && hasDetail) messages.push("全体集計シートとカテゴリ別シートを同時に選択しています。重複集計に注意してください。");
    if (options.compatibilityMode !== "all" && summary.omittedRows) messages.push("互換候補 " + formatNumber(summary.omittedRows) + "行を代表品番へまとめています。");
    warning.hidden = messages.length === 0;
    warning.textContent = messages.join(" ");
  }

  function renderEmptyPreview(title, description) {
    var table = byId("manufacturing-ranking-table");
    if (!table) return;
    table.innerHTML = "<div class='ranking-report-empty'><span aria-hidden='true'>▤</span><strong>" + escapeHtml(title) + "</strong><p>" + escapeHtml(description) + "</p></div>";
    var pdf = byId("manufacturing-ranking-pdf");
    if (pdf) pdf.disabled = true;
  }

  function renderPreviewTable(results, options) {
    if (!results.length) {
      renderEmptyPreview("条件に一致する明細がありません", "カテゴリ・順位範囲・最小出荷数を見直してください。");
      return;
    }
    var visible = results.slice(0, PREVIEW_LIMIT);
    var html = "<table class='ranking-report-table'><thead><tr>" +
      "<th>順位</th><th>カテゴリ</th><th>商品名</th><th>純正品番</th><th>メーカー品番</th><th>出荷数</th>";
    if (options.showSubstitute) html += "<th>代替</th>";
    if (options.metric !== "shipment") html += "<th>順位値</th>";
    if (options.showCompatibility) html += "<th class='ranking-report-compat-column'>互換候補</th>";
    html += "</tr></thead><tbody>";
    visible.forEach(function(result) {
      var row = result.row;
      var members = compatibilityMembers(result);
      html += "<tr><td class='ranking-report-rank-cell'>" + formatNumber(result.rank) + "</td>" +
        "<td>" + escapeHtml(row.sheet) + "</td>" +
        "<td><strong>" + escapeHtml(row.productName || "-") + "</strong><small>商品CD " + escapeHtml(row.productCode || "-") + "</small></td>" +
        "<td class='ranking-report-part-cell'>" + escapeHtml(row.genuine || "-") + "</td>" +
        "<td class='ranking-report-part-cell'>" + escapeHtml(row.maker || "-") + "</td>" +
        "<td class='ranking-report-number-cell'>" + formatNumber(result.shipment) + "</td>";
      if (options.showSubstitute) html += "<td class='ranking-report-number-cell'>" + formatNumber(result.substitute) + "</td>";
      if (options.metric !== "shipment") html += "<td class='ranking-report-number-cell ranking-report-score-cell'>" + formatNumber(result.score) + "</td>";
      if (options.showCompatibility) {
        html += "<td class='ranking-report-compat-cell'>";
        if (!members.length) html += "<span class='ranking-report-none'>-</span>";
        else {
          html += "<span class='ranking-report-compat-badge'>互換候補 " + formatNumber(members.length) + "品番</span>";
          members.slice(0, 3).forEach(function(member) { html += "<small>" + escapeHtml(compatibilityLine(member)) + "</small>"; });
          if (members.length > 3) html += "<small>ほか " + formatNumber(members.length - 3) + "品番</small>";
        }
        html += "</td>";
      }
      html += "</tr>";
    });
    html += "</tbody></table>";
    byId("manufacturing-ranking-table").innerHTML = html;
    var note = byId("manufacturing-ranking-preview-note");
    if (note) note.textContent = results.length > PREVIEW_LIMIT ? "全" + formatNumber(results.length) + "行中、上位" + formatNumber(PREVIEW_LIMIT) + "行を画面表示" : "全" + formatNumber(results.length) + "行を表示";
    byId("manufacturing-ranking-pdf").disabled = false;
  }

  function updatePreview() {
    if (!state.rows.length) {
      renderEmptyPreview("D-CATSデータがありません", "再読み込みを押すか、管理者にデータ登録を確認してください。");
      return false;
    }
    var options = readOptions();
    if (!options.categories.length) {
      state.results = [];
      state.summary = null;
      state.options = options;
      renderEmptyPreview("対象カテゴリを選択してください", "左側のカテゴリにチェックを入れてください。");
      return false;
    }
    var summary = buildRanking(state.rows, options);
    state.results = summary.results;
    state.summary = summary;
    state.options = options;
    renderSummary(summary, options);
    renderWarning(options, summary);
    renderPreviewTable(summary.results, options);
    return summary.results.length > 0;
  }

  function buildPrintRows(results, options) {
    return results.map(function(result) {
      var row = result.row;
      var html = "<tr><td class='rank'>" + formatNumber(result.rank) + "</td>" +
        "<td>" + escapeHtml(row.sheet) + "</td>" +
        "<td><b>" + escapeHtml(row.productName || "-") + "</b><small>商品CD " + escapeHtml(row.productCode || "-") + "</small></td>" +
        "<td class='part'>" + escapeHtml(row.genuine || "-") + "</td>" +
        "<td class='part'>" + escapeHtml(row.maker || "-") + "</td>" +
        "<td class='number'>" + formatNumber(result.shipment) + "</td>";
      if (options.showSubstitute) html += "<td class='number'>" + formatNumber(result.substitute) + "</td>";
      if (options.metric !== "shipment") html += "<td class='number score'>" + formatNumber(result.score) + "</td>";
      if (options.showCompatibility) {
        var members = compatibilityMembers(result);
        html += "<td class='compat'>";
        if (!members.length) html += "-";
        else html += members.map(function(member) { return "<span>" + escapeHtml(compatibilityLine(member)) + "</span>"; }).join("");
        html += "</td>";
      }
      return html + "</tr>";
    }).join("");
  }

  function buildPrintHtml(results, options) {
    var version = typeof APP_VERSION === "string" ? APP_VERSION : "";
    var orientationCss = options.orientation === "portrait" ? "ranking-report-print-portrait.css" : "ranking-report-print-landscape.css";
    var generatedAt = new Date().toLocaleString("ja-JP");
    var categoryText = options.categories.join(" / ");
    var title = "製造ランキング " + options.startRank + "-" + options.endRank + "位";
    var header = "<tr><th>順位</th><th>カテゴリ</th><th>商品名</th><th>純正品番</th><th>メーカー品番</th><th>出荷数</th>";
    if (options.showSubstitute) header += "<th>代替</th>";
    if (options.metric !== "shipment") header += "<th>順位値</th>";
    if (options.showCompatibility) header += "<th class='compat-head'>互換候補</th>";
    header += "</tr>";

    return "<!doctype html><html lang='ja'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>" +
      "<title>" + escapeHtml(title) + "</title>" +
      "<link rel='stylesheet' href='ranking-report-print.css?dcats_version=" + encodeURIComponent(version) + "'>" +
      "<link rel='stylesheet' href='" + orientationCss + "?dcats_version=" + encodeURIComponent(version) + "'>" +
      "</head><body><div class='print-toolbar'><button id='dcats-ranking-print' type='button'>PDFとして保存 / 印刷</button><span>印刷先で「PDFに保存」を選択してください。</span></div>" +
      "<main class='report'><header><div><span class='eyebrow'>D-CATS MANUFACTURING REPORT</span><h1>製造ランキング</h1><p>" + escapeHtml(categoryText) + "</p></div>" +
      "<div class='report-meta'><b>順位 " + formatNumber(options.startRank) + " - " + formatNumber(options.endRank) + "</b><span>" + escapeHtml(generatedAt) + " 作成</span></div></header>" +
      "<section class='conditions'><div><span>D-CATSデータ</span><b>" + escapeHtml(state.fileName) + "</b></div>" +
      "<div><span>順位基準</span><b>" + escapeHtml(metricLabel(options.metric) + " / " + rankScopeLabel(options.rankScope)) + "</b></div>" +
      "<div><span>互換品番</span><b>" + escapeHtml(compatibilityModeLabel(options.compatibilityMode)) + "</b></div>" +
      "<div><span>出力件数</span><b>" + formatNumber(results.length) + "件</b></div></section>" +
      "<table><thead>" + header + "</thead><tbody>" + buildPrintRows(results, options) + "</tbody></table>" +
      "<footer><span>D-CATS / 製造ランキング</span><span>順位は指定した基準値の降順。同数時も商品別の連番で重複なし</span></footer></main></body></html>";
  }

  function openPdfPreview() {
    if (!updatePreview()) return;
    var popup = window.open("", "_blank");
    if (!popup) {
      alert("PDFプレビューを開けませんでした。ブラウザのポップアップ許可を確認してください。");
      return;
    }
    var attachPrint = function() {
      var button = popup.document.getElementById("dcats-ranking-print");
      if (button) button.addEventListener("click", function() { popup.print(); });
      popup.focus();
      window.setTimeout(function() { popup.print(); }, 250);
    };
    popup.addEventListener("load", attachPrint, { once: true });
    popup.document.open();
    popup.document.write(buildPrintHtml(state.results, state.options));
    popup.document.close();
  }

  function selectAllCategories(checked) {
    document.querySelectorAll("#manufacturing-ranking-categories input[type='checkbox']").forEach(function(input) {
      input.checked = checked;
    });
  }

  function enterManufacturingRankingReport() {
    if (typeof canViewManagementScreen === "function" && !canViewManagementScreen()) {
      alert(typeof t === "function" ? t("err_perm") : "権限がありません");
      return;
    }
    if (typeof showScreen === "function") showScreen("manufacturing-ranking-report");
    if (!state.rows.length) loadDcatsSource();
  }

  function bindEvents() {
    var reload = byId("manufacturing-ranking-reload");
    if (!reload) return;
    reload.addEventListener("click", loadDcatsSource);
    byId("manufacturing-ranking-category-all").addEventListener("click", function() { selectAllCategories(true); updatePreview(); });
    byId("manufacturing-ranking-category-clear").addEventListener("click", function() { selectAllCategories(false); updatePreview(); });
    byId("manufacturing-ranking-preview").addEventListener("click", updatePreview);
    byId("manufacturing-ranking-pdf").addEventListener("click", openPdfPreview);
    byId("btn-back-manufacturing-ranking-report").addEventListener("click", function() {
      if (typeof returnToMenuFresh === "function") returnToMenuFresh();
      else if (typeof showScreen === "function") showScreen("menu");
    });
    byId("btn-logout-manufacturing-ranking-report").addEventListener("click", function() {
      if (typeof doLogout === "function") doLogout();
    });
    byId("manufacturing-ranking-query").addEventListener("keydown", function(event) {
      if (event.key === "Enter") updatePreview();
    });
  }

  window.enterManufacturingRankingReport = enterManufacturingRankingReport;
  window.DCatsManufacturingRankingReport = {
    buildRanking: buildRanking,
    normalizePart: normalizePart,
    mapDatabaseRow: mapDatabaseRow
  };
  bindEvents();
})();
