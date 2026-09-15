(function(root) {
  "use strict";

  var MAX_FILE_BYTES = 30 * 1024 * 1024;
  var MAX_SOURCE_ROWS = 60000;
  var MAX_IMPORT_PARTS = 200;
  var PREVIEW_LIMIT = 200;
  var XLSX_SCRIPT = Object.freeze({
    src: "vendor/xlsx-0.18.5.full.min.js",
    integrity: "sha384-vtjasyidUo0kW94K5MXDXntzOJpQgBKXmE7e2Ga4LG0skTTLeBi97eFAXsqewJjw"
  });
  var PDF_SCRIPT = Object.freeze({
    src: "vendor/pdfjs-3.11.174.min.js",
    integrity: "sha384-/1qUCSGwTur9vjf/z9lmu/eCUYbpOTgSjmpbMQZ1/CtX2v/WcAIKqRv+U1DUCG6e"
  });
  var PDF_WORKER = "vendor/pdfjs-3.11.174.worker.min.js";
  var PDF_CMAPS = "vendor/pdfjs-3.11.174-cmaps/";
  var PDF_STANDARD_FONTS = "vendor/pdfjs-3.11.174-standard-fonts/";
  var scriptPromises = {};
  var state = {
    fileName: "",
    sheets: [],
    selectedSheet: "*",
    overrides: {},
    selectedParts: {},
    isReading: false
  };
  var elements = {};

  function normalizeText(value) {
    var text = String(value == null ? "" : value);
    try { text = text.normalize("NFKC"); } catch (error) {}
    return text.trim();
  }

  function normalizeHeader(value) {
    return normalizeText(value).toUpperCase().replace(/[\s　:：._\/\\()（）\[\]【】・-]/g, "");
  }

  function normalizePart(value) {
    return normalizeText(value).toUpperCase()
      .replace(/[‐‑‒–—―ー−]/g, "-")
      .replace(/[\s　]+(?=\()/g, "")
      .replace(/[\s　]/g, "");
  }

  function isPartHeader(value) {
    var key = normalizeHeader(value);
    if (!key || /パレット|PALLET|CAGE|CASE|数量|QUANTITY|QTY|重量|WEIGHT|合計|TOTAL|AMOUNT|金額|REMARK|備考/.test(key)) return false;
    return /品番|部品番号|型番|PARTS?NO|PARTNUMBER|ITEMNO|PRODUCTCODE|商品CD|商品コード|OEMNO/.test(key);
  }

  function isQuantityHeader(value) {
    var key = normalizeHeader(value);
    if (!key || /単位重量|UNITWEIGHT|合計|TOTAL|AMOUNT|金額|重量|WEIGHT|PRICE|単価/.test(key)) return false;
    return /数量|QUANTITY|QTY|PCS|個数|台数/.test(key);
  }

  function partValueScore(value) {
    var key = normalizePart(value);
    if (!key || key.length < 4 || key.length > 40 || !/[0-9]/.test(key)) return 0;
    if (/^[+-]?[0-9]+(?:\.[0-9]+)?$/.test(key)) return key.length >= 5 && key.indexOf(".") < 0 ? 3 : 0;
    if (!/^[A-Z0-9][A-Z0-9._/()\-]*$/.test(key)) return 0;
    var score = 2;
    if (/[A-Z]/.test(key)) score += 2;
    if (/[-/]/.test(key)) score += 2;
    if (/^[A-Z0-9]+\([A-Z0-9_-]+\)$/.test(key)) score += 1;
    return score;
  }

  function extractPart(value) {
    var text = normalizeText(value).toUpperCase().replace(/[‐‑‒–—―ー−]/g, "-");
    if (!text || isPartHeader(text)) return "";
    var candidates = [text].concat(text.split(/[\s　,，;；|｜]+/));
    var best = "";
    var bestScore = 0;
    candidates.forEach(function(candidate) {
      var key = normalizePart(candidate.replace(/^[#№]+/, "").replace(/[。,:：;；]+$/, ""));
      var score = partValueScore(key);
      if (score > bestScore || (score === bestScore && score > 0 && key.length < best.length)) {
        best = key;
        bestScore = score;
      }
    });
    return bestScore >= 3 ? best : "";
  }

  function parseQuantity(value) {
    if (typeof value === "number" && Number.isFinite(value)) return value > 0 ? value : null;
    var text = normalizeText(value).replace(/,/g, "");
    if (!text) return null;
    var match = text.match(/^-?\d+(?:\.\d+)?/);
    if (!match) return null;
    var number = Number(match[0]);
    return Number.isFinite(number) && number > 0 ? number : null;
  }

  function columnValues(matrix, column, startRow) {
    var values = [];
    for (var rowIndex = startRow; rowIndex < matrix.length && values.length < 250; rowIndex++) {
      var row = Array.isArray(matrix[rowIndex]) ? matrix[rowIndex] : [];
      var value = row[column];
      if (normalizeText(value)) values.push(value);
    }
    return values;
  }

  function partColumnScore(matrix, column, startRow, header) {
    var values = columnValues(matrix, column, startRow);
    if (!values.length) return -100;
    var valid = values.filter(function(value) { return partValueScore(extractPart(value)) >= 3; });
    var score = valid.length / values.length * 12;
    score += valid.slice(0, 20).reduce(function(total, value) { return total + partValueScore(extractPart(value)); }, 0) / Math.max(1, Math.min(20, valid.length));
    if (isPartHeader(header)) score += 14;
    var headerKey = normalizeHeader(header);
    if (/パレット|PALLET|CAGE|CASE|数量|QUANTITY|QTY|重量|WEIGHT|合計|TOTAL|AMOUNT|備考|REMARK/.test(headerKey)) score -= 14;
    return score;
  }

  function quantityColumnScore(matrix, column, startRow, header) {
    var values = columnValues(matrix, column, startRow);
    if (!values.length) return -100;
    var numeric = values.map(parseQuantity).filter(function(value) { return value != null; });
    var integers = numeric.filter(function(value) { return Math.floor(value) === value; });
    var score = numeric.length / values.length * 7 + integers.length / values.length * 5;
    if (isQuantityHeader(header)) score += 14;
    var headerKey = normalizeHeader(header);
    if (/品番|PARTS?NO|PARTNUMBER|単位重量|UNITWEIGHT|重量|WEIGHT|合計|TOTAL|AMOUNT|金額|PRICE|単価/.test(headerKey)) score -= 14;
    return score;
  }

  function maxColumnCount(matrix) {
    return (matrix || []).reduce(function(maximum, row) {
      return Math.max(maximum, Array.isArray(row) ? row.length : 0);
    }, 0);
  }

  function mappingForHeader(matrix, headerRow) {
    var startRow = headerRow >= 0 ? headerRow + 1 : 0;
    var width = Math.min(maxColumnCount(matrix), 60);
    var partColumn = -1;
    var quantityColumn = -1;
    var bestPartScore = -100;
    var bestQuantityScore = -100;
    for (var column = 0; column < width; column++) {
      var header = headerRow >= 0 && matrix[headerRow] ? matrix[headerRow][column] : "";
      var partScore = partColumnScore(matrix, column, startRow, header);
      if (partScore > bestPartScore) {
        bestPartScore = partScore;
        partColumn = column;
      }
    }
    for (var quantity = 0; quantity < width; quantity++) {
      if (quantity === partColumn) continue;
      var quantityHeader = headerRow >= 0 && matrix[headerRow] ? matrix[headerRow][quantity] : "";
      var quantityScore = quantityColumnScore(matrix, quantity, startRow, quantityHeader);
      if (quantityScore > bestQuantityScore) {
        bestQuantityScore = quantityScore;
        quantityColumn = quantity;
      }
    }
    if (bestQuantityScore < 7) quantityColumn = -1;
    var headerSignal = 0;
    if (headerRow >= 0) {
      var headerValues = Array.isArray(matrix[headerRow]) ? matrix[headerRow] : [];
      if (headerValues.some(isPartHeader)) headerSignal += 5;
      if (headerValues.some(isQuantityHeader)) headerSignal += 5;
    }
    var totalScore = bestPartScore + Math.max(0, bestQuantityScore) + headerSignal;
    return {
      headerRow: headerRow,
      dataStartRow: startRow,
      partColumn: partColumn,
      quantityColumn: quantityColumn,
      partScore: bestPartScore,
      quantityScore: bestQuantityScore,
      totalScore: totalScore,
      confidence: bestPartScore >= 23 && bestQuantityScore >= 14 ? "high" : (bestPartScore >= 15 ? "medium" : "low")
    };
  }

  function inferMapping(matrix, forcedHeaderRow) {
    matrix = Array.isArray(matrix) ? matrix : [];
    if (Number.isInteger(forcedHeaderRow)) return mappingForHeader(matrix, forcedHeaderRow);
    var candidates = [mappingForHeader(matrix, -1)];
    var limit = Math.min(matrix.length, 20);
    for (var row = 0; row < limit; row++) {
      var headerValues = Array.isArray(matrix[row]) ? matrix[row] : [];
      if (headerValues.some(isPartHeader) || headerValues.some(isQuantityHeader)) {
        candidates.push(mappingForHeader(matrix, row));
      }
    }
    candidates.sort(function(a, b) { return b.totalScore - a.totalScore; });
    return candidates[0] || mappingForHeader(matrix, -1);
  }

  function columnLabel(matrix, column, headerRow) {
    if (column < 0) return tr("manufacturing_cost_import_qty_none");
    var labels = [];
    [headerRow - 1, headerRow].forEach(function(rowIndex) {
      if (rowIndex < 0 || !matrix[rowIndex]) return;
      var label = normalizeText(matrix[rowIndex][column]);
      if (label && labels.indexOf(label) < 0) labels.push(label);
    });
    return labels.length ? labels.join(" / ") : trf("manufacturing_cost_import_column_n", { n: columnName(column) });
  }

  function columnName(index) {
    var value = index + 1;
    var name = "";
    while (value > 0) {
      value -= 1;
      name = String.fromCharCode(65 + value % 26) + name;
      value = Math.floor(value / 26);
    }
    return name;
  }

  function analyzeMatrix(matrix, options) {
    options = options || {};
    var mapping = inferMapping(matrix, Number.isInteger(options.headerRow) ? options.headerRow : undefined);
    if (Number.isInteger(options.partColumn)) mapping.partColumn = options.partColumn;
    if (Number.isInteger(options.quantityColumn)) mapping.quantityColumn = options.quantityColumn;
    var rowsByPart = {};
    var ignored = 0;
    var nonEmpty = 0;
    for (var rowIndex = mapping.dataStartRow; rowIndex < matrix.length && rowIndex < MAX_SOURCE_ROWS; rowIndex++) {
      var row = Array.isArray(matrix[rowIndex]) ? matrix[rowIndex] : [];
      if (!row.some(function(value) { return !!normalizeText(value); })) continue;
      nonEmpty += 1;
      var part = extractPart(row[mapping.partColumn]);
      if (!part) {
        ignored += 1;
        continue;
      }
      var quantity = mapping.quantityColumn >= 0 ? parseQuantity(row[mapping.quantityColumn]) : null;
      var key = normalizePart(part);
      if (!rowsByPart[key]) {
        rowsByPart[key] = { key: key, part: part, quantity: quantity, sourceRows: [rowIndex + 1], confidence: mapping.confidence };
      } else {
        if (quantity != null) rowsByPart[key].quantity = (rowsByPart[key].quantity || 0) + quantity;
        rowsByPart[key].sourceRows.push(rowIndex + 1);
      }
    }
    return {
      mapping: mapping,
      rows: Object.keys(rowsByPart).map(function(key) { return rowsByPart[key]; }),
      ignoredRows: ignored,
      nonEmptyRows: nonEmpty,
      truncated: matrix.length > MAX_SOURCE_ROWS
    };
  }

  function analyzeSheet(sheet) {
    var override = state.overrides[sheet.key] || {};
    var analysis = analyzeMatrix(sheet.matrix, override);
    analysis.sheet = sheet;
    return analysis;
  }

  function combineAnalyses(analyses) {
    var byPart = {};
    var ignoredRows = 0;
    analyses.forEach(function(analysis) {
      ignoredRows += analysis.ignoredRows;
      analysis.rows.forEach(function(row) {
        if (!byPart[row.key]) {
          byPart[row.key] = {
            key: row.key,
            part: row.part,
            quantity: row.quantity,
            sources: [{ sheet: analysis.sheet.name, rows: row.sourceRows.slice() }],
            confidence: row.confidence
          };
        } else {
          if (row.quantity != null) byPart[row.key].quantity = (byPart[row.key].quantity || 0) + row.quantity;
          byPart[row.key].sources.push({ sheet: analysis.sheet.name, rows: row.sourceRows.slice() });
          if (row.confidence === "low") byPart[row.key].confidence = "low";
          else if (row.confidence === "medium" && byPart[row.key].confidence === "high") byPart[row.key].confidence = "medium";
        }
      });
    });
    var rows = Object.keys(byPart).map(function(key) { return byPart[key]; });
    var duplicateCount = rows.reduce(function(total, row) {
      var occurrences = row.sources.reduce(function(count, source) { return count + source.rows.length; }, 0);
      return total + Math.max(0, occurrences - 1);
    }, 0);
    return { rows: rows, ignoredRows: ignoredRows, duplicateCount: duplicateCount };
  }

  function currentAnalyses() {
    var sheets = state.selectedSheet === "*"
      ? state.sheets
      : state.sheets.filter(function(sheet) { return sheet.key === state.selectedSheet; });
    return sheets.map(analyzeSheet);
  }

  function tr(key) {
    if (typeof root.t === "function") return root.t(key);
    return key;
  }

  function trf(key, values) {
    if (typeof root.tf === "function") return root.tf(key, values);
    var text = tr(key);
    Object.keys(values || {}).forEach(function(name) {
      text = text.replace(new RegExp("\\{" + name + "\\}", "g"), String(values[name]));
    });
    return text;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function setStatus(message, type) {
    if (!elements.status) return;
    elements.status.textContent = message || "";
    elements.status.classList.remove("is-loading", "is-success", "is-error");
    if (type) elements.status.classList.add("is-" + type);
  }

  function loadScript(asset, globalName) {
    if (root[globalName]) return Promise.resolve(root[globalName]);
    if (scriptPromises[asset.src]) return scriptPromises[asset.src];
    scriptPromises[asset.src] = new Promise(function(resolve, reject) {
      var script = document.createElement("script");
      script.src = asset.src;
      script.integrity = asset.integrity;
      script.async = true;
      script.crossOrigin = "anonymous";
      script.onload = function() {
        if (root[globalName]) resolve(root[globalName]);
        else reject(new Error(tr("manufacturing_cost_import_library_error")));
      };
      script.onerror = function() { reject(new Error(tr("manufacturing_cost_import_library_error"))); };
      document.head.appendChild(script);
    });
    return scriptPromises[asset.src];
  }

  function workbookSheets(workbook, XLSX) {
    var sheets = [];
    workbook.SheetNames.forEach(function(name, index) {
      var matrix = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: "", raw: true });
      if (!matrix.length || !maxColumnCount(matrix)) return;
      sheets.push({ key: "sheet-" + index, name: name, matrix: matrix });
    });
    return sheets;
  }

  function median(values) {
    if (!values.length) return 0;
    var sorted = values.slice().sort(function(a, b) { return a - b; });
    return sorted[Math.floor(sorted.length / 2)];
  }

  function matrixFromPdfItems(items) {
    var usable = (items || []).filter(function(item) { return normalizeText(item.str); }).map(function(item) {
      var transform = item.transform || [];
      return { text: normalizeText(item.str), x: Number(transform[4] || 0), y: Number(transform[5] || 0), width: Number(item.width || 0) };
    });
    if (!usable.length) return [];
    var heightTolerance = 3;
    var lines = [];
    usable.sort(function(a, b) { return b.y - a.y || a.x - b.x; }).forEach(function(item) {
      var line = lines.find(function(candidate) { return Math.abs(candidate.y - item.y) <= heightTolerance; });
      if (!line) {
        line = { y: item.y, items: [] };
        lines.push(line);
      }
      line.items.push(item);
    });
    var widths = usable.map(function(item) { return item.width / Math.max(1, item.text.length); }).filter(function(value) { return value > 0; });
    var xTolerance = Math.max(8, Math.min(20, median(widths) * 2.5 || 12));
    var clusters = [];
    usable.slice().sort(function(a, b) { return a.x - b.x; }).forEach(function(item) {
      var cluster = clusters.find(function(candidate) { return Math.abs(candidate.x - item.x) <= xTolerance; });
      if (!cluster) clusters.push({ x: item.x, count: 1 });
      else {
        cluster.x = (cluster.x * cluster.count + item.x) / (cluster.count + 1);
        cluster.count += 1;
      }
    });
    clusters = clusters.filter(function(cluster) { return cluster.count >= 2 || clusters.length <= 20; })
      .sort(function(a, b) { return a.x - b.x; })
      .slice(0, 40);
    return lines.sort(function(a, b) { return b.y - a.y; }).map(function(line) {
      var row = new Array(clusters.length).fill("");
      line.items.sort(function(a, b) { return a.x - b.x; }).forEach(function(item) {
        var bestIndex = 0;
        var bestDistance = Infinity;
        clusters.forEach(function(cluster, index) {
          var distance = Math.abs(cluster.x - item.x);
          if (distance < bestDistance) {
            bestDistance = distance;
            bestIndex = index;
          }
        });
        row[bestIndex] = row[bestIndex] ? row[bestIndex] + " " + item.text : item.text;
      });
      return row;
    });
  }

  async function readSpreadsheet(file) {
    setStatus(tr("manufacturing_cost_import_loading_library"), "loading");
    var XLSX = await loadScript(XLSX_SCRIPT, "XLSX");
    setStatus(tr("manufacturing_cost_import_reading"), "loading");
    var buffer = await file.arrayBuffer();
    var workbook = XLSX.read(buffer, { type: "array", cellDates: false });
    return workbookSheets(workbook, XLSX);
  }

  async function readPdf(file) {
    setStatus(tr("manufacturing_cost_import_loading_library"), "loading");
    var pdfjsLib = await loadScript(PDF_SCRIPT, "pdfjsLib");
    pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_WORKER;
    setStatus(tr("manufacturing_cost_import_reading"), "loading");
    var buffer = await file.arrayBuffer();
    var loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      cMapUrl: PDF_CMAPS,
      cMapPacked: true,
      standardFontDataUrl: PDF_STANDARD_FONTS
    });
    var pdf = await loadingTask.promise;
    var sheets = [];
    var totalItems = 0;
    for (var pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      var page = await pdf.getPage(pageNumber);
      var content = await page.getTextContent({ normalizeWhitespace: true });
      totalItems += content.items.length;
      if (totalItems > MAX_SOURCE_ROWS * 20) throw new Error(tr("manufacturing_cost_import_too_many_rows"));
      var matrix = matrixFromPdfItems(content.items);
      if (matrix.length) sheets.push({ key: "pdf-" + pageNumber, name: trf("manufacturing_cost_import_pdf_page", { n: pageNumber }), matrix: matrix });
    }
    if (!sheets.length) throw new Error(tr("manufacturing_cost_import_pdf_no_text"));
    return sheets;
  }

  async function readFile(file) {
    if (!file) throw new Error(tr("manufacturing_cost_import_file_required"));
    if (file.size > MAX_FILE_BYTES) throw new Error(tr("manufacturing_cost_import_too_large"));
    var extension = String(file.name || "").split(".").pop().toLowerCase();
    if (["xlsx", "xls", "xlsm", "csv"].indexOf(extension) >= 0) return readSpreadsheet(file);
    if (extension === "pdf") return readPdf(file);
    throw new Error(tr("manufacturing_cost_import_unsupported"));
  }

  function resetSelections(rows) {
    state.selectedParts = {};
    rows.forEach(function(row) { state.selectedParts[row.key] = true; });
  }

  function renderSheetOptions() {
    if (!elements.sheet) return;
    var html = "<option value='*'>" + escapeHtml(tr("manufacturing_cost_import_all_sheets")) + "</option>";
    state.sheets.forEach(function(sheet) {
      var analysis = analyzeSheet(sheet);
      html += "<option value='" + escapeHtml(sheet.key) + "'>" + escapeHtml(sheet.name + " (" + analysis.rows.length + ")") + "</option>";
    });
    elements.sheet.innerHTML = html;
    elements.sheet.value = state.selectedSheet;
  }

  function renderMappingControls(analysis) {
    var all = state.selectedSheet === "*";
    [elements.headerRow, elements.partColumn, elements.quantityColumn].forEach(function(element) { if (element) element.disabled = all; });
    if (all || !analysis) {
      if (elements.mappingNote) elements.mappingNote.textContent = tr("manufacturing_cost_import_auto_all_note");
      return;
    }
    var matrix = analysis.sheet.matrix;
    var mapping = analysis.mapping;
    elements.headerRow.value = mapping.headerRow >= 0 ? String(mapping.headerRow + 1) : "0";
    var width = Math.min(maxColumnCount(matrix), 60);
    var partHtml = "";
    var quantityHtml = "<option value='-1'>" + escapeHtml(tr("manufacturing_cost_import_qty_none")) + "</option>";
    for (var column = 0; column < width; column++) {
      var label = columnName(column) + ": " + columnLabel(matrix, column, mapping.headerRow);
      partHtml += "<option value='" + column + "'>" + escapeHtml(label) + "</option>";
      quantityHtml += "<option value='" + column + "'>" + escapeHtml(label) + "</option>";
    }
    elements.partColumn.innerHTML = partHtml;
    elements.quantityColumn.innerHTML = quantityHtml;
    elements.partColumn.value = String(mapping.partColumn);
    elements.quantityColumn.value = String(mapping.quantityColumn);
    if (elements.mappingNote) elements.mappingNote.textContent = trf("manufacturing_cost_import_mapping_confidence", {
      confidence: tr("manufacturing_cost_import_confidence_" + mapping.confidence)
    });
  }

  function sourceLabel(row) {
    return row.sources.map(function(source) {
      var rows = source.rows.slice(0, 3).join(", ");
      if (source.rows.length > 3) rows += "…";
      return source.sheet + " " + trf("manufacturing_cost_import_rows", { rows: rows });
    }).join(" / ");
  }

  function renderPreview(reset) {
    var analyses = currentAnalyses();
    var combined = combineAnalyses(analyses);
    if (reset) resetSelections(combined.rows);
    if (elements.config) elements.config.hidden = false;
    if (elements.summary) elements.summary.textContent = trf("manufacturing_cost_import_summary", {
      parts: combined.rows.length,
      quantity: combined.rows.reduce(function(total, row) { return total + (row.quantity || 0); }, 0),
      duplicates: combined.duplicateCount,
      ignored: combined.ignoredRows
    });
    var rows = combined.rows.slice(0, PREVIEW_LIMIT);
    if (!rows.length) {
      elements.preview.innerHTML = "<div class='empty'>" + escapeHtml(tr("manufacturing_cost_import_no_parts")) + "</div>";
    } else {
      var html = "<table class='manufacturing-cost-import-table'><thead><tr>";
      html += "<th><span class='sr-only'>" + escapeHtml(tr("manufacturing_cost_import_target")) + "</span></th>";
      html += "<th>" + escapeHtml(tr("manufacturing_cost_import_part")) + "</th>";
      html += "<th>" + escapeHtml(tr("manufacturing_cost_import_quantity")) + "</th>";
      html += "<th>" + escapeHtml(tr("manufacturing_cost_import_source")) + "</th>";
      html += "<th>" + escapeHtml(tr("manufacturing_cost_import_confidence")) + "</th></tr></thead><tbody>";
      rows.forEach(function(row) {
        var checked = state.selectedParts[row.key] ? " checked" : "";
        var quantity = row.quantity == null ? tr("manufacturing_cost_import_quantity_missing") : String(row.quantity);
        html += "<tr><td><input type='checkbox' data-cost-import-check='1' value='" + escapeHtml(row.key) + "'" + checked + "></td>";
        html += "<td><strong>" + escapeHtml(row.part) + "</strong></td><td>" + escapeHtml(quantity) + "</td>";
        html += "<td><small>" + escapeHtml(sourceLabel(row)) + "</small></td>";
        html += "<td><span class='manufacturing-cost-import-confidence " + escapeHtml(row.confidence) + "'>" + escapeHtml(tr("manufacturing_cost_import_confidence_" + row.confidence)) + "</span></td></tr>";
      });
      html += "</tbody></table>";
      if (combined.rows.length > PREVIEW_LIMIT) html += "<div class='manufacturing-cost-import-preview-note'>" + escapeHtml(trf("manufacturing_cost_import_preview_limit", { n: PREVIEW_LIMIT })) + "</div>";
      elements.preview.innerHTML = html;
    }
    var selectedCount = Object.keys(state.selectedParts).filter(function(key) { return state.selectedParts[key]; }).length;
    elements.search.disabled = !combined.rows.length || !selectedCount || state.isReading;
    elements.search.textContent = trf("manufacturing_cost_import_search_selected_n", { n: selectedCount });
    var selectedAnalysis = analyses.length === 1 ? analyses[0] : null;
    renderMappingControls(selectedAnalysis);
  }

  function currentCombinedRows() {
    return combineAnalyses(currentAnalyses()).rows;
  }

  function updateSearchButton() {
    var selectedCount = currentCombinedRows().filter(function(row) { return state.selectedParts[row.key]; }).length;
    elements.search.disabled = !selectedCount || state.isReading;
    elements.search.textContent = trf("manufacturing_cost_import_search_selected_n", { n: selectedCount });
  }

  async function handleFile(file) {
    state.isReading = true;
    elements.search.disabled = true;
    if (elements.fileName) elements.fileName.textContent = file ? file.name : "";
    try {
      var sheets = await readFile(file);
      if (!sheets.length) throw new Error(tr("manufacturing_cost_import_no_rows"));
      state.fileName = file.name || "";
      state.sheets = sheets;
      state.selectedSheet = "*";
      state.overrides = {};
      renderSheetOptions();
      renderPreview(true);
      setStatus(trf("manufacturing_cost_import_ready", { n: currentCombinedRows().length }), "success");
    } catch (error) {
      state.fileName = "";
      state.sheets = [];
      state.selectedParts = {};
      if (elements.config) elements.config.hidden = true;
      setStatus((error && error.message) || String(error), "error");
    } finally {
      state.isReading = false;
      if (state.sheets.length) updateSearchButton();
    }
  }

  function openDialog() {
    if (!elements.overlay) return;
    elements.overlay.classList.add("show");
    setStatus(tr("manufacturing_cost_import_initial"), "");
    if (elements.choose) elements.choose.focus();
  }

  function closeDialog() {
    if (!elements.overlay) return;
    elements.overlay.classList.remove("show");
    var opener = document.getElementById("btn-manufacturing-cost-import-open");
    if (opener) opener.focus();
  }

  function applyMappingChange(kind, value) {
    if (state.selectedSheet === "*") return;
    var override = state.overrides[state.selectedSheet] || {};
    if (kind === "headerRow") {
      override.headerRow = Math.max(-1, parseInt(value || "0", 10) - 1);
      delete override.partColumn;
      delete override.quantityColumn;
    } else {
      override[kind] = parseInt(value, 10);
    }
    state.overrides[state.selectedSheet] = override;
    renderPreview(true);
  }

  function selectAll(checked) {
    currentCombinedRows().forEach(function(row) { state.selectedParts[row.key] = checked; });
    renderPreview(false);
  }

  function searchSelectedParts() {
    var selected = currentCombinedRows().filter(function(row) { return state.selectedParts[row.key]; });
    if (!selected.length) {
      setStatus(tr("manufacturing_cost_import_selected_required"), "error");
      return;
    }
    if (selected.length > MAX_IMPORT_PARTS) {
      setStatus(trf("manufacturing_cost_import_selection_limit", { n: MAX_IMPORT_PARTS }), "error");
      return;
    }
    var query = document.getElementById("manufacturing-cost-query");
    var searchButton = document.getElementById("btn-manufacturing-cost-calc");
    if (!query || !searchButton) return;
    var existing = normalizeText(query.value).split(/[\s,、，]+/).filter(Boolean);
    var seen = {};
    var values = [];
    existing.concat(selected.map(function(row) { return row.part; })).forEach(function(part) {
      var key = normalizePart(part);
      if (!key || seen[key]) return;
      seen[key] = true;
      values.push(part);
    });
    query.value = values.join(" ");
    closeDialog();
    searchButton.click();
  }

  function refreshLanguage() {
    if (!elements.overlay || !elements.overlay.classList.contains("show") || !state.sheets.length) return;
    renderSheetOptions();
    renderPreview(false);
  }

  function cacheElements() {
    elements = {
      overlay: document.getElementById("manufacturing-cost-import-overlay"),
      choose: document.getElementById("btn-manufacturing-cost-import-choose"),
      file: document.getElementById("manufacturing-cost-import-file"),
      fileName: document.getElementById("manufacturing-cost-import-file-name"),
      status: document.getElementById("manufacturing-cost-import-status"),
      config: document.getElementById("manufacturing-cost-import-config"),
      sheet: document.getElementById("manufacturing-cost-import-sheet"),
      headerRow: document.getElementById("manufacturing-cost-import-header-row"),
      partColumn: document.getElementById("manufacturing-cost-import-part-column"),
      quantityColumn: document.getElementById("manufacturing-cost-import-quantity-column"),
      mappingNote: document.getElementById("manufacturing-cost-import-mapping-note"),
      summary: document.getElementById("manufacturing-cost-import-summary"),
      preview: document.getElementById("manufacturing-cost-import-preview"),
      search: document.getElementById("btn-manufacturing-cost-import-search")
    };
  }

  function init() {
    cacheElements();
    if (!elements.overlay) return;
    document.getElementById("btn-manufacturing-cost-import-open").addEventListener("click", openDialog);
    document.getElementById("btn-manufacturing-cost-import-close").addEventListener("click", closeDialog);
    elements.choose.addEventListener("click", function() { elements.file.click(); });
    elements.file.addEventListener("change", function() { handleFile(elements.file.files && elements.file.files[0]); });
    elements.sheet.addEventListener("change", function() { state.selectedSheet = elements.sheet.value || "*"; renderPreview(true); });
    elements.headerRow.addEventListener("change", function() { applyMappingChange("headerRow", elements.headerRow.value); });
    elements.partColumn.addEventListener("change", function() { applyMappingChange("partColumn", elements.partColumn.value); });
    elements.quantityColumn.addEventListener("change", function() { applyMappingChange("quantityColumn", elements.quantityColumn.value); });
    document.getElementById("btn-manufacturing-cost-import-select-all").addEventListener("click", function() { selectAll(true); });
    document.getElementById("btn-manufacturing-cost-import-clear").addEventListener("click", function() { selectAll(false); });
    elements.preview.addEventListener("change", function(event) {
      if (!event.target.matches("[data-cost-import-check]")) return;
      state.selectedParts[event.target.value] = !!event.target.checked;
      updateSearchButton();
    });
    elements.search.addEventListener("click", searchSelectedParts);
    elements.overlay.addEventListener("click", function(event) { if (event.target === elements.overlay) closeDialog(); });
    document.addEventListener("keydown", function(event) {
      if (event.key === "Escape" && elements.overlay.classList.contains("show")) closeDialog();
    });
    new MutationObserver(refreshLanguage).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  }

  var api = {
    normalizePart: normalizePart,
    extractPart: extractPart,
    inferMapping: inferMapping,
    analyzeMatrix: analyzeMatrix,
    combineAnalyses: combineAnalyses,
    matrixFromPdfItems: matrixFromPdfItems,
    workbookSheets: workbookSheets,
    _state: state
  };
  root.DcatsManufacturingCostImport = api;
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
    else init();
  }
})(typeof window !== "undefined" ? window : globalThis);
