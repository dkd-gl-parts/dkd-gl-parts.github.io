(function() {
  "use strict";

  var MAX_FILE_BYTES = 50 * 1024 * 1024;
  var MAX_SOURCE_ROWS = 150000;
  var PREVIEW_LIMIT = 200;
  var DATA_PAGE_SIZE = 1000;
  var DATA_PAGE_CONCURRENCY = 4;
  var REFERENCE_QUERY_CHUNK_SIZE = 400;
  var REFERENCE_QUERY_CONCURRENCY = 4;
  var SUPPLIER_NAMES = {
    "1": "Stronghold",
    "3": "STAL / Santian"
  };
  var MASTER_PART_FIELDS = [
    { normalized: "normalized_genuine_part_number", value: "genuine_part_number", label: "純正" },
    { normalized: "normalized_genuine_part_number_2", value: "genuine_part_number_2", label: "純正2" },
    { normalized: "normalized_manufacturer_part_number", value: "manufacturer_part_number", label: "メーカー" },
    { normalized: "normalized_pulley_assy_part_number", value: "pulley_assy_part_number", label: "プーリーASSY" },
    { normalized: "normalized_genuine_body_part_number", value: "genuine_body_part_number", label: "純正本体" },
    { normalized: "normalized_manufacturer_body_part_number", value: "manufacturer_body_part_number", label: "メーカー本体" },
    { normalized: "normalized_genuine_clutch_part_number", value: "genuine_clutch_part_number", label: "純正クラッチ" },
    { normalized: "normalized_manufacturer_clutch_part_number", value: "manufacturer_clutch_part_number", label: "メーカークラッチ" }
  ];
  var MASTER_PART_COLUMNS = MASTER_PART_FIELDS.map(function(field) { return field.normalized; });
  var MASTER_VALUE_COLUMNS = MASTER_PART_FIELDS.map(function(field) { return field.value; });
  var state = {
    fileName: "",
    dataset: null,
    isLoading: false,
    rankingReady: false,
    masterDataReady: false,
    masterDataError: false,
    supplierDataReady: false,
    supplierDataError: false,
    rows: [],
    sheets: [],
    masterPartNumbers: Object.create(null),
    masterProductsById: Object.create(null),
    masterProductsByPart: Object.create(null),
    kikanMembersByGroupId: Object.create(null),
    kikanGroupIdsByProductId: Object.create(null),
    masterProductCount: 0,
    masterCacheRowCount: 0,
    stockedProductCount: 0,
    kikanGroupCount: 0,
    kikanMemberCount: 0,
    supplierItemsByProductId: Object.create(null),
    supplierItemCount: 0,
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

  function normalizeManufacturingProductName(value) {
    return normalizeText(value).replace(/大型オルタネータ/g, "オルタネータ");
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
        productName: normalizeManufacturingProductName(cellValue(row, columns.productName)),
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
    var excel = byId("manufacturing-ranking-excel");
    var pdf = byId("manufacturing-ranking-pdf");
    state.isLoading = isLoading;
    if (reload) reload.disabled = isLoading;
    if (preview) preview.disabled = !state.rankingReady || !state.rows.length;
    var reportType = byId("manufacturing-ranking-report-type");
    var supplierReport = reportType && reportType.value === "supplier_availability";
    var reportDataReady = state.masterDataReady && (!supplierReport || state.supplierDataReady);
    if (excel) {
      excel.disabled = !reportDataReady || !state.results.length;
      if (!state.rankingReady) excel.textContent = "Excel準備中...";
      else if (!state.masterDataReady) excel.textContent = state.masterDataError ? "Excel準備エラー" : "在庫照合中...";
      else if (supplierReport && !state.supplierDataReady) excel.textContent = state.supplierDataError ? "仕入先照合エラー" : "仕入先照合中...";
      else excel.textContent = "Excel出力";
    }
    if (pdf) {
      pdf.disabled = !reportDataReady || !state.results.length;
      if (!state.rankingReady) pdf.textContent = "PDF準備中...";
      else if (!state.masterDataReady) pdf.textContent = state.masterDataError ? "PDF準備エラー" : "在庫照合中...";
      else if (supplierReport && !state.supplierDataReady) pdf.textContent = state.supplierDataError ? "仕入先照合エラー" : "仕入先照合中...";
      else pdf.textContent = "PDF出力";
    }
  }

  function applyParsedSource(parsed) {
    state.fileName = parsed.fileName;
    state.rows = parsed.rows;
    state.sheets = parsed.sheets;
    state.rankingReady = true;
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
      productName: normalizeManufacturingProductName(row.product_name),
      productCode: normalizeText(row.product_code),
      genuine: normalizeText(row.genuine_part_number),
      maker: normalizeText(row.manufacturer_part_number),
      genuine2: normalizeText(row.genuine_part_number_2),
      body: normalizeText(row.genuine_body_part_number),
      clutch: normalizeText(row.genuine_clutch_part_number),
      type: normalizeText(row.product_type),
      shipment: Number(row.shipment_count || 0),
      substitute: Number(row.substitute_count || 0),
      masterProductIds: Array.isArray(row.master_product_ids) ? row.master_product_ids.map(String) : [],
      missingMasterParts: Array.isArray(row.missing_master_part_numbers) ? row.missing_master_part_numbers.map(function(entry) {
        return { label: normalizeText(entry && entry.label), value: normalizeText(entry && entry.value) };
      }).filter(function(entry) { return entry.value; }) : [],
      masterCacheReady: !!row.master_checked_at
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

  function fetchDatasetRowPage(datasetId, offset) {
    return sb.from("manufacturing_report_rows")
        .select("id,dataset_id,category_name,category_order,source_row_number,is_aggregate,product_name,product_code,genuine_part_number,manufacturer_part_number,genuine_part_number_2,genuine_body_part_number,genuine_clutch_part_number,product_type,shipment_count,substitute_count,master_product_ids,missing_master_part_numbers,master_checked_at")
        .eq("dataset_id", datasetId)
        .order("category_order", { ascending: true })
        .order("source_row_number", { ascending: true })
        .order("id", { ascending: true })
        .range(offset, offset + DATA_PAGE_SIZE - 1);
  }

  async function fetchDatasetRows(datasetId, expectedCount) {
    var rows = [];
    var count = Number(expectedCount || 0);
    if (count > 0) {
      var offsets = [];
      for (var parallelOffset = 0; parallelOffset < count; parallelOffset += DATA_PAGE_SIZE) {
        offsets.push(parallelOffset);
      }
      for (var batchStart = 0; batchStart < offsets.length; batchStart += DATA_PAGE_CONCURRENCY) {
        var batchOffsets = offsets.slice(batchStart, batchStart + DATA_PAGE_CONCURRENCY);
        var responses = await Promise.all(batchOffsets.map(function(offset) {
          return fetchDatasetRowPage(datasetId, offset);
        }));
        responses.forEach(function(response) {
          if (response.error) throw response.error;
          rows = rows.concat(response.data || []);
        });
      }
      return rows;
    }

    for (var offset = 0; ; offset += DATA_PAGE_SIZE) {
      var response = await fetchDatasetRowPage(datasetId, offset);
      if (response.error) throw response.error;
      var page = response.data || [];
      rows = rows.concat(page);
      if (page.length < DATA_PAGE_SIZE) break;
    }
    return rows;
  }

  function uniqueIds(values) {
    var seen = Object.create(null);
    return (values || []).filter(function(value) {
      return value !== null && value !== undefined && String(value) !== "";
    }).map(String).filter(function(value) {
      if (!value || seen[value]) return false;
      seen[value] = true;
      return true;
    });
  }

  async function fetchRowsByValues(table, selectColumns, field, values, chunkSize) {
    var ids = uniqueIds(values);
    if (!ids.length) return [];
    var size = Math.max(1, Number(chunkSize || REFERENCE_QUERY_CHUNK_SIZE));
    var requests = [];
    for (var index = 0; index < ids.length; index += size) {
      requests.push(sb.from(table)
        .select(selectColumns)
        .in(field, ids.slice(index, index + size)));
    }
    var responses = await Promise.all(requests);
    var rows = [];
    responses.forEach(function(response) {
      if (response.error) throw response.error;
      rows = rows.concat(response.data || []);
    });
    return rows;
  }

  async function fetchRowsByValuesBatched(table, selectColumns, field, values, chunkSize) {
    var ids = uniqueIds(values);
    if (!ids.length) return [];
    var size = Math.max(1, Number(chunkSize || REFERENCE_QUERY_CHUNK_SIZE));
    var chunks = [];
    for (var index = 0; index < ids.length; index += size) chunks.push(ids.slice(index, index + size));
    var rows = [];
    for (var batchStart = 0; batchStart < chunks.length; batchStart += REFERENCE_QUERY_CONCURRENCY) {
      var batch = chunks.slice(batchStart, batchStart + REFERENCE_QUERY_CONCURRENCY);
      var responses = await Promise.all(batch.map(function(valuesChunk) {
        return sb.from(table).select(selectColumns).in(field, valuesChunk);
      }));
      responses.forEach(function(response) {
        if (response.error) throw response.error;
        rows = rows.concat(response.data || []);
      });
    }
    return rows;
  }

  function indexSupplierCatalogData(links, items) {
    var itemsById = Object.create(null);
    var itemsByProductId = Object.create(null);
    var usedItemKeys = Object.create(null);
    (items || []).forEach(function(item) {
      if (!item || item.id == null || item.is_active === false) return;
      itemsById[String(item.id)] = item;
    });
    (links || []).forEach(function(link) {
      if (!link || link.status !== "active" || link.dkd_shohin_id == null) return;
      var item = itemsById[String(link.supplier_catalog_item_id)];
      if (!item) return;
      var productId = String(link.dkd_shohin_id);
      var itemKey = supplierItemIdentityKey(item);
      if (!itemsByProductId[productId]) itemsByProductId[productId] = [];
      if (itemsByProductId[productId].some(function(existing) { return supplierItemIdentityKey(existing) === itemKey; })) return;
      itemsByProductId[productId].push(item);
      usedItemKeys[itemKey] = true;
    });
    return {
      itemsByProductId: itemsByProductId,
      itemCount: Object.keys(usedItemKeys).length
    };
  }

  async function fetchSupplierCatalogData(productIds) {
    var links = await fetchRowsByValuesBatched(
      "supplier_catalog_item_links",
      "id,supplier_catalog_item_id,dkd_shohin_id,status",
      "dkd_shohin_id",
      productIds
    );
    links = links.filter(function(link) { return link.status === "active"; });
    var itemIds = uniqueIds(links.map(function(link) { return link.supplier_catalog_item_id; }));
    var items = await fetchRowsByValuesBatched(
      "supplier_catalog_items",
      "id,supplier_id,source_item_id,supplier_pn,category_label,genuine_part_number,manufacturer_part_number,manufacturer,model,is_active",
      "id",
      itemIds
    );
    return indexSupplierCatalogData(links, items);
  }

  async function fetchMasterProducts(productIds) {
    var numbers = Object.create(null);
    var productsById = Object.create(null);
    var productsByPart = Object.create(null);
    var selectColumns = ["dkd_shohin_id", "manufacturer"]
      .concat(MASTER_VALUE_COLUMNS, MASTER_PART_COLUMNS).join(",");
    var rows = await fetchRowsByValues("core_products", selectColumns, "dkd_shohin_id", productIds);
    rows.forEach(function(row) {
        var productId = String(row.dkd_shohin_id);
        var product = {
          id: productId,
          manufacturer: normalizeText(row.manufacturer),
          coreStockQty: 0
        };
        MASTER_PART_FIELDS.forEach(function(field) {
          product[field.value] = normalizeText(row[field.value]);
        });
        productsById[productId] = product;

        var indexed = Object.create(null);
        MASTER_PART_FIELDS.forEach(function(field) {
          var normalizedValue = row[field.normalized] || row[field.value];
          if (!isLikelyPartNumber(normalizedValue)) return;
          var key = normalizeSearch(normalizedValue);
          if (!key) return;
          numbers[key] = true;
          if (indexed[key]) return;
          indexed[key] = true;
          if (!productsByPart[key]) productsByPart[key] = [];
          productsByPart[key].push(product);
        });
      });
    return {
      numbers: numbers,
      productsById: productsById,
      productsByPart: productsByPart,
      productCount: rows.length,
      partNumberCount: Object.keys(numbers).length
    };
  }

  async function fetchKikanMembership(productIds) {
    var membersByGroupId = Object.create(null);
    var directMembers = await fetchRowsByValues(
      "kikan_group_members",
      "id,kikan_group_id,dkd_gokan_id",
      "dkd_gokan_id",
      productIds
    );
    var groupIds = uniqueIds(directMembers.map(function(row) { return row.kikan_group_id; }));
    var rows = await fetchRowsByValues(
      "kikan_group_members",
      "id,kikan_group_id,dkd_gokan_id",
      "kikan_group_id",
      groupIds,
      25
    );
    rows.forEach(function(row) {
        if (row.kikan_group_id == null || row.dkd_gokan_id == null) return;
        var groupId = String(row.kikan_group_id);
        var productId = String(row.dkd_gokan_id);
        if (!membersByGroupId[groupId]) membersByGroupId[groupId] = [];
        if (membersByGroupId[groupId].indexOf(productId) < 0) membersByGroupId[groupId].push(productId);
      });

    var groupIdsByProductId = Object.create(null);
    Object.keys(membersByGroupId).forEach(function(groupId) {
      membersByGroupId[groupId].forEach(function(productId) {
        if (!groupIdsByProductId[productId]) groupIdsByProductId[productId] = [];
        groupIdsByProductId[productId].push(groupId);
      });
    });
    return {
      membersByGroupId: membersByGroupId,
      groupIdsByProductId: groupIdsByProductId,
      groupCount: Object.keys(membersByGroupId).length,
      memberCount: rows.length
    };
  }

  async function fetchCurrentCoreStock(productIds) {
    var rows = await fetchRowsByValues(
      "production_core_list_entries",
      "dkd_shohin_id,quantity",
      "dkd_shohin_id",
      productIds
    );
    var quantitiesByProductId = Object.create(null);
    rows.forEach(function(row) {
      var productId = String(row.dkd_shohin_id || "");
      if (!productId) return;
      quantitiesByProductId[productId] = (quantitiesByProductId[productId] || 0) + Math.max(0, parseNumber(row.quantity));
    });
    return quantitiesByProductId;
  }

  async function fetchReportReferenceData(rows) {
    var cachedProductIds = [];
    rows.forEach(function(row) {
      (row.masterProductIds || []).forEach(function(productId) { cachedProductIds.push(productId); });
    });
    var directProductIds = uniqueIds(cachedProductIds);
    var kikan = await fetchKikanMembership(directProductIds);
    var compatibleProductIds = [];
    Object.keys(kikan.membersByGroupId).forEach(function(groupId) {
      compatibleProductIds = compatibleProductIds.concat(kikan.membersByGroupId[groupId]);
    });
    var allProductIds = uniqueIds(directProductIds.concat(compatibleProductIds));
    var loaded = await Promise.all([
      fetchMasterProducts(allProductIds),
      fetchCurrentCoreStock(allProductIds)
    ]);
    var master = loaded[0];
    var stockByProductId = loaded[1];
    Object.keys(master.productsById).forEach(function(productId) {
      master.productsById[productId].coreStockQty = stockByProductId[productId] || 0;
    });
    return {
      master: master,
      kikan: kikan,
      cacheRowCount: rows.filter(function(row) { return row.masterCacheReady; }).length,
      stockedProductCount: Object.keys(stockByProductId).filter(function(productId) { return stockByProductId[productId] > 0; }).length
    };
  }

  async function loadDcatsSource() {
    if (state.isLoading) return;
    state.dataset = null;
    state.fileName = "";
    state.rows = [];
    state.sheets = [];
    state.rankingReady = false;
    state.masterDataReady = false;
    state.masterDataError = false;
    state.supplierDataReady = false;
    state.supplierDataError = false;
    state.masterPartNumbers = Object.create(null);
    state.masterProductsById = Object.create(null);
    state.masterProductsByPart = Object.create(null);
    state.kikanMembersByGroupId = Object.create(null);
    state.kikanGroupIdsByProductId = Object.create(null);
    state.masterProductCount = 0;
    state.masterCacheRowCount = 0;
    state.stockedProductCount = 0;
    state.kikanGroupCount = 0;
    state.kikanMemberCount = 0;
    state.supplierItemsByProductId = Object.create(null);
    state.supplierItemCount = 0;
    state.results = [];
    state.summary = null;
    state.options = null;
    setLoading(true);
    setSourceStatus("D-CATSのカテゴリを読み込んでいます...", "loading");
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
      state.dataset = dataset;
      state.fileName = dataset.source_file_name || dataset.dataset_name || "D-CATS";
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
      setSourceStatus("カテゴリを表示しました。ランキング明細を読み込んでいます...", "loading");

      var sourceRows = await fetchDatasetRows(dataset.id, dataset.row_count);
      if (sourceRows.length !== Number(dataset.row_count || 0)) {
        throw new Error("D-CATSの帳票データ件数が一致しません。管理者に確認してください。");
      }

      state.rows = sourceRows.map(mapDatabaseRow);
      state.rankingReady = true;
      setLoading(true);
      setSourceStatus("ランキングを表示しました。コア在庫・互換情報を照合しています...", "loading");
      updatePreview();

      try {
        var referenceData = await fetchReportReferenceData(state.rows);
        var master = referenceData.master;
        var kikan = referenceData.kikan;
        state.masterPartNumbers = master.numbers;
        state.masterProductsById = master.productsById;
        state.masterProductsByPart = master.productsByPart;
        state.kikanMembersByGroupId = kikan.membersByGroupId;
        state.kikanGroupIdsByProductId = kikan.groupIdsByProductId;
        state.masterProductCount = master.productCount;
        state.masterCacheRowCount = referenceData.cacheRowCount;
        state.stockedProductCount = referenceData.stockedProductCount;
        state.kikanGroupCount = kikan.groupCount;
        state.kikanMemberCount = kikan.memberCount;
        state.masterDataReady = true;
        setSourceStatus("ランキングを表示しました。仕入先商品を照合しています...", "loading");
        updatePreview();
        try {
          var supplierData = await fetchSupplierCatalogData(Object.keys(master.productsById));
          state.supplierItemsByProductId = supplierData.itemsByProductId;
          state.supplierItemCount = supplierData.itemCount;
          state.supplierDataReady = true;
          setSourceStatus("D-CATS保存データを読み込みました。元データ: " + state.fileName + " / マスタ照合済み " + formatNumber(state.masterCacheRowCount) + "行 / 現在庫あり " + formatNumber(state.stockedProductCount) + "商品 / 仕入先商品 " + formatNumber(state.supplierItemCount) + "件 / 互換 " + formatNumber(state.kikanGroupCount) + "グループ", "success");
          updatePreview();
        } catch (supplierError) {
          state.supplierDataError = true;
          setSourceStatus("ランキング・コア在庫は利用できますが、仕入先商品を取得できませんでした。再読み込みしてください。", "error");
          updatePreview();
        }
      } catch (referenceError) {
        state.masterDataError = true;
        state.supplierDataError = true;
        setSourceStatus("ランキングは利用できますが、コア在庫・互換情報を取得できませんでした。再読み込みしてください。", "error");
        updatePreview();
      }
    } catch (error) {
      state.dataset = null;
      state.fileName = "";
      state.rows = [];
      state.sheets = [];
      state.rankingReady = false;
      state.masterDataReady = false;
      state.masterDataError = false;
      state.supplierDataReady = false;
      state.supplierDataError = false;
      state.masterPartNumbers = Object.create(null);
      state.masterProductsById = Object.create(null);
      state.masterProductsByPart = Object.create(null);
      state.kikanMembersByGroupId = Object.create(null);
      state.kikanGroupIdsByProductId = Object.create(null);
      state.masterProductCount = 0;
      state.masterCacheRowCount = 0;
      state.stockedProductCount = 0;
      state.kikanGroupCount = 0;
      state.kikanMemberCount = 0;
      state.supplierItemsByProductId = Object.create(null);
      state.supplierItemCount = 0;
      state.results = [];
      state.summary = null;
      renderCategoryOptions();
      setSourceStatus(error && error.message ? error.message : String(error), "error");
      renderEmptyPreview("D-CATSデータを読み込めませんでした", "接続状態または閲覧権限を確認してください。");
    } finally {
      setLoading(false);
    }
  }

  function renderCategoryOptions() {
    var host = byId("manufacturing-ranking-categories");
    if (!host) return;
    host.innerHTML = state.sheets.map(function(sheet) {
      var aggregate = sheet.isAggregate ? "<small>全体集計 - カテゴリ別シートとの重複に注意</small>" : "<small>" + formatNumber(sheet.count) + "件</small>";
      return "<label class='ranking-report-category-option'>" +
        "<input type='checkbox' value='" + escapeHtml(sheet.name) + "'>" +
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
    var endRank = positiveInteger("manufacturing-ranking-end", 200);
    if (endRank < startRank) {
      var swap = startRank;
      startRank = endRank;
      endRank = swap;
    }
    var reportType = byId("manufacturing-ranking-report-type").value;
    return {
      categories: selectedCategories(),
      reportType: reportType,
      metric: byId("manufacturing-ranking-metric").value,
      rankScope: byId("manufacturing-ranking-scope").value,
      startRank: startRank,
      endRank: endRank,
      minShipment: nonNegativeNumber("manufacturing-ranking-min-shipment", 0),
      query: normalizeSearch(byId("manufacturing-ranking-query").value),
      compatibilityMode: byId("manufacturing-ranking-compat-mode").value,
      compatibilityBasis: byId("manufacturing-ranking-compat-basis").value,
      orientation: byId("manufacturing-ranking-orientation").value,
      supplierId: byId("manufacturing-ranking-supplier").value,
      supplierStatus: byId("manufacturing-ranking-supplier-status").value,
      showCoreStock: reportType !== "supplier_availability" && byId("manufacturing-ranking-show-core-stock").checked,
      showMissingMaster: reportType !== "supplier_availability" && byId("manufacturing-ranking-show-missing").checked
    };
  }

  function syncReportTypeControls() {
    var reportType = byId("manufacturing-ranking-report-type");
    if (!reportType) return;
    var supplierReport = reportType.value === "supplier_availability";
    var supplierOptions = byId("manufacturing-ranking-supplier-options");
    var coreStockOption = byId("manufacturing-ranking-core-stock-option");
    var missingOption = byId("manufacturing-ranking-missing-option");
    if (supplierOptions) supplierOptions.hidden = !supplierReport;
    if (coreStockOption) coreStockOption.hidden = supplierReport;
    if (missingOption) missingOption.hidden = supplierReport;
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
    var sourceRows = rows.filter(function(row) {
      if (!categorySet[row.sheet]) return false;
      return options.reportType !== "supplier_availability" || !isDaikoManufacturerPart(row.maker);
    });
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

  function printFileDate(date) {
    function pad(value) { return String(value).padStart(2, "0"); }
    return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
  }

  function printFileTitle(categories, startRank, endRank, date, reportType) {
    var categoryNames = (categories || []).map(function(category) {
      return normalizeText(category)
        .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "・")
        .replace(/・+/g, "・")
        .replace(/[.\s]+$/g, "");
    }).filter(Boolean);
    var firstRank = Math.max(1, parseInt(startRank, 10) || 1);
    var lastRank = Math.max(firstRank, parseInt(endRank, 10) || firstRank);
    var rankRange = firstRank === lastRank ? String(firstRank) : firstRank + "-" + lastRank;
    var reportName = reportType === "supplier_availability" ? "仕入先商品照合" : "製造ランキング";
    return (categoryNames.join("・") || "カテゴリ") + "＆" + reportName + rankRange + "位＆" + printFileDate(date);
  }

  function rowPartNumberEntries(row) {
    return [
      { label: "純正", value: row.genuine },
      { label: "メーカー", value: row.maker },
      { label: "純正2", value: row.genuine2 },
      { label: "純正本体", value: row.body },
      { label: "純正クラッチ", value: row.clutch }
    ];
  }

  function rowPrimaryPartNumberEntries(row) {
    return [
      { label: "純正", value: row.genuine },
      { label: "メーカー", value: row.maker },
      { label: "純正2", value: row.genuine2 }
    ];
  }

  function masterProductsForRow(row) {
    if (row.masterCacheReady) {
      return (row.masterProductIds || []).map(function(productId) {
        return state.masterProductsById[String(productId)];
      }).filter(Boolean);
    }
    var seen = Object.create(null);
    var candidates = [];
    rowPrimaryPartNumberEntries(row).forEach(function(entry) {
      if (!isLikelyPartNumber(entry.value)) return;
      var matches = state.masterProductsByPart[normalizeSearch(entry.value)] || [];
      matches.forEach(function(product) {
        if (seen[product.id]) return;
        seen[product.id] = true;
        candidates.push(product);
      });
    });
    if (!candidates.length) return [];

    var makerKey = isLikelyPartNumber(row.maker) ? normalizeSearch(row.maker) : "";
    var genuineKeys = [row.genuine, row.genuine2].filter(isLikelyPartNumber).map(normalizeSearch);
    function matchScore(product) {
      var score = 0;
      if (makerKey && normalizeSearch(product.manufacturer_part_number) === makerKey) score += 4;
      genuineKeys.forEach(function(key) {
        if (normalizeSearch(product.genuine_part_number) === key || normalizeSearch(product.genuine_part_number_2) === key) score += 3;
      });
      return score || 1;
    }
    var highestScore = candidates.reduce(function(highest, product) {
      return Math.max(highest, matchScore(product));
    }, 0);
    return candidates.filter(function(product) { return matchScore(product) === highestScore; });
  }

  function masterProductPartNumber(product) {
    var values = [
      product.manufacturer_part_number,
      product.genuine_part_number,
      product.genuine_part_number_2
    ].filter(function(value, index, list) {
      return isLikelyPartNumber(value) && list.indexOf(value) === index;
    });
    return values.slice(0, 2).join(" / ") || ("商品ID " + product.id);
  }

  function compatibilityMembers(result) {
    return result.group.filter(function(row) { return row.id !== result.row.id; });
  }

  function kikanCompatibleProducts(result) {
    var directProducts = masterProductsForRow(result.row);
    var directIds = Object.create(null);
    var compatibleIds = Object.create(null);
    directProducts.forEach(function(product) { directIds[product.id] = true; });
    directProducts.forEach(function(product) {
      (state.kikanGroupIdsByProductId[product.id] || []).forEach(function(groupId) {
        (state.kikanMembersByGroupId[groupId] || []).forEach(function(productId) {
          if (!directIds[productId]) compatibleIds[productId] = true;
        });
      });
    });
    return Object.keys(compatibleIds).map(function(productId) {
      return state.masterProductsById[productId];
    }).filter(Boolean).sort(function(left, right) {
      return right.coreStockQty - left.coreStockQty ||
        masterProductPartNumber(left).localeCompare(masterProductPartNumber(right), "ja");
    });
  }

  function supplierName(supplierId) {
    var key = String(supplierId == null ? "" : supplierId);
    return SUPPLIER_NAMES[key] || (key ? "仕入先 #" + key : "仕入先未設定");
  }

  function isDaikoManufacturerPart(value) {
    return /^[A-Z]{2}DK\d{3,}$/.test(normalizeSearch(value));
  }

  function supplierItemIdentityKey(item) {
    var supplierId = item && item.supplier_id != null ? String(item.supplier_id) : "";
    var managementNumber = item ? normalizeSearch(item.supplier_pn || item.source_item_id) : "";
    return supplierId + "|" + (managementNumber || "item:" + String(item && item.id || ""));
  }

  function matchedProductsForSupplier(result, compatibilityMode) {
    var productsById = Object.create(null);
    var rows = compatibilityMode === "all" ? [result.row] : result.group;
    rows.filter(function(row) { return !isDaikoManufacturerPart(row && row.maker); }).forEach(function(row) {
      masterProductsForRow(row).forEach(function(product) {
        productsById[product.id] = product;
        (state.kikanGroupIdsByProductId[product.id] || []).forEach(function(groupId) {
          (state.kikanMembersByGroupId[groupId] || []).forEach(function(productId) {
            var compatible = state.masterProductsById[String(productId)];
            if (compatible) productsById[compatible.id] = compatible;
          });
        });
      });
    });
    return Object.keys(productsById).map(function(productId) { return productsById[productId]; });
  }

  function supplierItemsForResult(result, options) {
    if (isDaikoManufacturerPart(result && result.row && result.row.maker)) return [];
    var itemsByKey = Object.create(null);
    matchedProductsForSupplier(result, options.compatibilityMode).forEach(function(product) {
      (state.supplierItemsByProductId[product.id] || []).forEach(function(item) {
        if (options.supplierId !== "all" && String(item.supplier_id) !== String(options.supplierId)) return;
        var itemKey = supplierItemIdentityKey(item);
        if (!itemsByKey[itemKey]) itemsByKey[itemKey] = item;
      });
    });
    return Object.keys(itemsByKey).map(function(itemKey) { return itemsByKey[itemKey]; }).sort(function(left, right) {
      return supplierName(left.supplier_id).localeCompare(supplierName(right.supplier_id), "ja") ||
        normalizeSearch(left.supplier_pn || left.source_item_id).localeCompare(normalizeSearch(right.supplier_pn || right.source_item_id), "ja");
    });
  }

  function supplierItemPartText(item) {
    var parts = [];
    if (isLikelyPartNumber(item.genuine_part_number)) parts.push("純正 " + item.genuine_part_number);
    if (isLikelyPartNumber(item.manufacturer_part_number)) parts.push("メーカー " + item.manufacturer_part_number);
    return parts.join(" / ") || "品番情報なし";
  }

  function supplierItemManagementNumber(item) {
    return normalizeText(item.supplier_pn || item.source_item_id) || "-";
  }

  function supplierItemDetailText(item) {
    var maker = normalizeText(item.manufacturer);
    return supplierItemPartText(item) + (maker ? " / " + maker : "");
  }

  function supplierAvailabilitySummary(results, options) {
    var itemKeys = Object.create(null);
    var availableCount = 0;
    (results || []).forEach(function(result) {
      var items = supplierItemsForResult(result, options);
      if (items.length) availableCount++;
      items.forEach(function(item) { itemKeys[supplierItemIdentityKey(item)] = true; });
    });
    return {
      availableCount: availableCount,
      unavailableCount: Math.max(0, (results || []).length - availableCount),
      itemCount: Object.keys(itemKeys).length
    };
  }

  function filterSupplierResults(results, options) {
    if (options.reportType !== "supplier_availability") return results;
    var supplierResults = results.filter(function(result) {
      return !isDaikoManufacturerPart(result && result.row && result.row.maker);
    });
    if (options.supplierStatus === "all" || !state.supplierDataReady) return supplierResults;
    return supplierResults.filter(function(result) {
      var available = supplierItemsForResult(result, options).length > 0;
      return options.supplierStatus === "available" ? available : !available;
    });
  }

  function compatibilityDetails(result, includeCoreStock) {
    var entries = [];
    var seenNumbers = Object.create(null);
    var includeResolvedStock = includeCoreStock && state.masterDataReady;

    compatibilityMembers(result).forEach(function(row) {
      var numbers = rowPrimaryPartNumberEntries(row).map(function(entry) { return entry.value; }).filter(function(value, index, list) {
        return isLikelyPartNumber(value) && list.indexOf(value) === index;
      });
      if (!numbers.length) return;
      numbers.forEach(function(value) { seenNumbers[normalizeSearch(value)] = true; });
      var stock = masterProductsForRow(row).reduce(function(total, product) { return total + product.coreStockQty; }, 0);
      var detail = numbers.join(" / ") + " (出荷 " + formatNumber(row.shipment);
      if (includeResolvedStock) detail += " / コア " + formatNumber(stock) + "台";
      entries.push(detail + ")");
    });

    kikanCompatibleProducts(result).forEach(function(product) {
      var number = masterProductPartNumber(product);
      var key = normalizeSearch(number.split(" / ")[0]);
      if (seenNumbers[key]) return;
      seenNumbers[key] = true;
      entries.push("登録互換 " + number + (includeResolvedStock ? " (コア " + formatNumber(product.coreStockQty) + "台)" : ""));
    });
    return entries;
  }

  function coreStockDetails(result) {
    var directProducts = masterProductsForRow(result.row);
    var directIds = Object.create(null);
    directProducts.forEach(function(product) { directIds[product.id] = true; });

    var compatibleById = Object.create(null);
    function addCompatible(product) {
      if (!product || directIds[product.id] || product.coreStockQty <= 0) return;
      compatibleById[product.id] = product;
    }
    kikanCompatibleProducts(result).forEach(addCompatible);
    compatibilityMembers(result).forEach(function(row) {
      masterProductsForRow(row).forEach(addCompatible);
    });

    var compatibleStocked = Object.keys(compatibleById).map(function(productId) {
      return compatibleById[productId];
    }).sort(function(left, right) {
      return right.coreStockQty - left.coreStockQty ||
        masterProductPartNumber(left).localeCompare(masterProductPartNumber(right), "ja");
    });
    return {
      ready: state.masterDataReady,
      matched: directProducts.length > 0,
      currentTotal: directProducts.reduce(function(total, product) { return total + product.coreStockQty; }, 0),
      compatibleStocked: compatibleStocked,
      compatibleTotal: compatibleStocked.reduce(function(total, product) { return total + product.coreStockQty; }, 0)
    };
  }

  function rankingCoreStockSummary(results) {
    var productsById = Object.create(null);
    function addProduct(product) {
      if (product && product.id) productsById[String(product.id)] = product;
    }
    (results || []).forEach(function(result) {
      masterProductsForRow(result.row).forEach(addProduct);
      coreStockDetails(result).compatibleStocked.forEach(addProduct);
    });
    var products = Object.keys(productsById).map(function(productId) { return productsById[productId]; });
    return {
      ready: state.masterDataReady,
      productCount: products.length,
      total: products.reduce(function(total, product) { return total + Math.max(0, Number(product.coreStockQty || 0)); }, 0)
    };
  }

  function buildPreviewCoreStock(result) {
    if (!state.masterDataReady) return "<span class='ranking-report-none'>照合中</span>";
    var stock = coreStockDetails(result);
    if (!stock.matched) return "<span class='ranking-report-none'>-</span>";
    var currentClass = stock.currentTotal > 0 ? " is-positive" : "";
    var currentLabel = stock.currentTotal > 0 ? "在庫あり " : "現在 ";
    var html = "<span class='ranking-report-stock-row'><span class='ranking-report-stock-badge" + currentClass + "'>" + currentLabel + formatNumber(stock.currentTotal) + "台</span>";
    if (stock.compatibleTotal > 0) html += "<span class='ranking-report-stock-badge is-compatible'>互換品に " + formatNumber(stock.compatibleTotal) + "台</span>";
    return html + "</span>";
  }

  function buildPrintCoreStock(result) {
    if (!state.masterDataReady) return "-";
    var stock = coreStockDetails(result);
    if (!stock.matched) return "-";
    var html = "<span class='stock-status-row'>" + (stock.currentTotal > 0
      ? "<span class='stock-status has-stock'><span>在庫あり</span><strong>" + formatNumber(stock.currentTotal) + "台</strong></span>"
      : "<span class='stock-status no-stock'>現在 0台</span>");
    if (stock.compatibleTotal > 0) html += "<span class='compatible-stock'>互換品に <strong>" + formatNumber(stock.compatibleTotal) + "台</strong></span>";
    return html + "</span>";
  }

  function buildPrintMissingMaster(missing) {
    if (!state.masterDataReady || !missing.length) return "-";
    var html = "<span class='missing-badge'>未登録 " + formatNumber(missing.length) + "品番</span>";
    missing.forEach(function(entry) {
      html += "<span class='missing-part'>" + escapeHtml(entry.label + " " + entry.value) + "</span>";
    });
    return html;
  }

  function missingMasterPartNumbers(result, compatibilityMode) {
    if (!state.masterDataReady) return [];
    var rows = compatibilityMode === "all" ? [result.row] : result.group;
    var seen = Object.create(null);
    var missing = [];
    rows.forEach(function(row) {
      if (row.masterCacheReady) {
        (row.missingMasterParts || []).forEach(function(entry) {
          var key = normalizeSearch(entry.value);
          if (!key || seen[key]) return;
          seen[key] = true;
          missing.push({ label: entry.label, value: entry.value });
        });
        return;
      }
      rowPartNumberEntries(row).forEach(function(entry) {
        if (!isLikelyPartNumber(entry.value)) return;
        var key = normalizeSearch(entry.value);
        if (!key || state.masterPartNumbers[key] || seen[key]) return;
        seen[key] = true;
        missing.push({ label: entry.label, value: entry.value });
      });
    });
    return missing;
  }

  function renderSummary(summary, options) {
    var host = byId("manufacturing-ranking-summary");
    if (!host) return;
    if (options.reportType === "supplier_availability") {
      var supplierSummary = supplierAvailabilitySummary(summary.results, options);
      host.innerHTML = [
        ["出力件数", formatNumber(summary.results.length)],
        ["仕入先商品あり", state.supplierDataReady ? formatNumber(supplierSummary.availableCount) : (state.supplierDataError ? "取得失敗" : "照合中")],
        ["仕入先商品なし", state.supplierDataReady ? formatNumber(supplierSummary.unavailableCount) : (state.supplierDataError ? "取得失敗" : "照合中")],
        ["紐づく仕入先商品", state.supplierDataReady ? formatNumber(supplierSummary.itemCount) + "件" : (state.supplierDataError ? "取得失敗" : "照合中")],
        ["順位範囲", formatNumber(options.startRank) + " - " + formatNumber(options.endRank)]
      ].map(function(card) {
        return "<div class='ranking-report-summary-card'><span>" + card[0] + "</span><strong>" + card[1] + "</strong></div>";
      }).join("");
      return;
    }
    var missingPartNumberCount = summary.results.reduce(function(total, result) {
      return total + missingMasterPartNumbers(result, options.compatibilityMode).length;
    }, 0);
    var coreStockSummary = rankingCoreStockSummary(summary.results);
    host.innerHTML = [
      ["対象件数", formatNumber(summary.results.length)],
      ["コア在庫合計（互換含む）", coreStockSummary.ready ? formatNumber(coreStockSummary.total) + "台" : "照合中"],
      ["マスタ未登録品番", state.masterDataReady ? formatNumber(missingPartNumberCount) : "照合中"],
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
    if (options.reportType === "supplier_availability") {
      if (!state.supplierDataReady) messages.push(state.supplierDataError || state.masterDataError ? "仕入先商品の照合に失敗しました。再読み込みしてください。" : "仕入先商品を照合しています。完了後に自動更新します。");
      else if (!supplierAvailabilitySummary(summary.results, options).availableCount) messages.push("選択した条件で紐づく仕入先商品はありません。");
      if (hasAggregate && hasDetail) messages.push("全体集計シートとカテゴリ別シートを同時に選択しています。重複集計に注意してください。");
      if (options.compatibilityMode !== "all" && summary.omittedRows) messages.push("互換品番 " + formatNumber(summary.omittedRows) + "行を代表品番へまとめています。");
      warning.hidden = messages.length === 0;
      warning.textContent = messages.join(" ");
      return;
    }
    var compatibleRows = summary.results.filter(function(result) {
      return compatibilityDetails(result, options.showCoreStock).length > 0;
    }).length;
    var compatibleStockRows = options.showCoreStock ? summary.results.filter(function(result) {
      return coreStockDetails(result).compatibleStocked.length > 0;
    }).length : 0;
    if (!state.masterDataReady) messages.push(state.masterDataError ? "コア在庫・登録互換の照合に失敗しました。再読み込みしてください。" : "コア在庫・登録互換を照合しています。完了後に自動更新します。");
    if (compatibleRows) messages.push("表示対象のうち " + formatNumber(compatibleRows) + "件に互換品があります。");
    if (compatibleStockRows) messages.push("うち " + formatNumber(compatibleStockRows) + "件は互換品にもコア在庫があります。");
    if (hasAggregate && hasDetail) messages.push("全体集計シートとカテゴリ別シートを同時に選択しています。重複集計に注意してください。");
    if (options.compatibilityMode !== "all" && summary.omittedRows) messages.push("互換品番 " + formatNumber(summary.omittedRows) + "行を代表品番へまとめています。");
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
      renderEmptyPreview("条件に一致する明細がありません", options.reportType === "supplier_availability" ? "ランキング条件・対象仕入先・仕入先商品の有無を見直してください。" : "カテゴリ・順位範囲・最小出荷数を見直してください。");
      return;
    }
    var visible = results.slice(0, PREVIEW_LIMIT);
    if (options.reportType === "supplier_availability") {
      var supplierHtml = "<table class='ranking-report-table is-supplier-report'><thead><tr>" +
        "<th>順位</th><th>商品名</th><th>純正品番</th><th>メーカー品番</th><th class='ranking-report-supplier-status-column'>仕入先商品</th><th class='ranking-report-supplier-name-column'>仕入先名称</th><th class='ranking-report-supplier-part-column'>仕入先品番</th><th class='ranking-report-supplier-detail-column'>品番情報</th>" +
        "</tr></thead><tbody>";
      visible.forEach(function(result) {
        var row = result.row;
        var items = state.supplierDataReady ? supplierItemsForResult(result, options) : [];
        var rowSpan = Math.max(1, items.length);
        var status = state.supplierDataReady
          ? (items.length ? "<span class='ranking-report-supplier-status is-available'>あり</span>" : "<span class='ranking-report-supplier-status is-unavailable'>なし</span>")
          : "<span class='ranking-report-none'>" + (state.supplierDataError ? "取得失敗" : "照合中") + "</span>";
        var displayItems = items.length ? items : [null];
        displayItems.forEach(function(item, itemIndex) {
          supplierHtml += "<tr" + (itemIndex ? " class='ranking-report-supplier-continuation'" : "") + ">";
          if (itemIndex === 0) {
            supplierHtml += "<td class='ranking-report-rank-cell' rowspan='" + rowSpan + "'>" + formatNumber(result.rank) + "</td>" +
              "<td rowspan='" + rowSpan + "'><strong>" + escapeHtml(row.productName || "-") + "</strong><small>商品CD " + escapeHtml(row.productCode || "-") + "</small></td>" +
              "<td class='ranking-report-part-cell' rowspan='" + rowSpan + "'>" + escapeHtml(row.genuine || "-") + "</td>" +
              "<td class='ranking-report-part-cell' rowspan='" + rowSpan + "'>" + escapeHtml(row.maker || "-") + "</td>" +
              "<td rowspan='" + rowSpan + "'>" + status + "</td>";
          }
          if (item) {
            supplierHtml += "<td class='ranking-report-supplier-name-cell'>" + escapeHtml(supplierName(item.supplier_id)) + "</td>" +
              "<td class='ranking-report-supplier-part-cell'>" + escapeHtml(supplierItemManagementNumber(item)) + "</td>" +
              "<td class='ranking-report-supplier-detail-cell'>" + escapeHtml(supplierItemDetailText(item)) + "</td>";
          } else {
            var emptyLabel = state.supplierDataReady ? "-" : (state.supplierDataError ? "取得失敗" : "照合中");
            supplierHtml += "<td class='ranking-report-none'>" + emptyLabel + "</td><td class='ranking-report-none'>" + emptyLabel + "</td><td class='ranking-report-none'>" + emptyLabel + "</td>";
          }
          supplierHtml += "</tr>";
        });
      });
      supplierHtml += "</tbody></table>";
      byId("manufacturing-ranking-table").innerHTML = supplierHtml;
      var supplierNote = byId("manufacturing-ranking-preview-note");
      if (supplierNote) supplierNote.textContent = results.length > PREVIEW_LIMIT ? "全" + formatNumber(results.length) + "行中、上位" + formatNumber(PREVIEW_LIMIT) + "行を画面表示" : "全" + formatNumber(results.length) + "行を表示";
      setLoading(state.isLoading);
      return;
    }
    var html = "<table class='ranking-report-table'><thead><tr>" +
      "<th>順位</th><th>商品名</th><th>純正品番</th><th>メーカー品番</th><th>出荷数</th>";
    if (options.metric !== "shipment") html += "<th>順位値</th>";
    if (options.showCoreStock) html += "<th class='ranking-report-stock-column'>コア在庫</th>";
    if (options.showMissingMaster) html += "<th class='ranking-report-compat-column'>マスタ未登録品番</th>";
    html += "</tr></thead><tbody>";
    visible.forEach(function(result) {
      var row = result.row;
      var missing = missingMasterPartNumbers(result, options.compatibilityMode);
      html += "<tr><td class='ranking-report-rank-cell'>" + formatNumber(result.rank) + "</td>" +
        "<td><strong>" + escapeHtml(row.productName || "-") + "</strong><small>商品CD " + escapeHtml(row.productCode || "-") + "</small></td>" +
        "<td class='ranking-report-part-cell'>" + escapeHtml(row.genuine || "-") + "</td>" +
        "<td class='ranking-report-part-cell'>" + escapeHtml(row.maker || "-") + "</td>" +
        "<td class='ranking-report-number-cell'>" + formatNumber(result.shipment) + "</td>";
      if (options.metric !== "shipment") html += "<td class='ranking-report-number-cell ranking-report-score-cell'>" + formatNumber(result.score) + "</td>";
      if (options.showCoreStock) html += "<td class='ranking-report-stock-cell'>" + buildPreviewCoreStock(result) + "</td>";
      if (options.showMissingMaster) {
        html += "<td class='ranking-report-compat-cell'>";
        if (!state.masterDataReady) html += "<span class='ranking-report-none'>照合中</span>";
        else if (!missing.length) html += "<span class='ranking-report-none'>-</span>";
        else {
          html += "<span class='ranking-report-compat-badge'>未登録 " + formatNumber(missing.length) + "品番</span>";
          missing.slice(0, 5).forEach(function(entry) { html += "<small>" + escapeHtml(entry.label + " " + entry.value) + "</small>"; });
          if (missing.length > 5) html += "<small>ほか " + formatNumber(missing.length - 5) + "品番</small>";
        }
        html += "</td>";
      }
      html += "</tr>";
    });
    html += "</tbody></table>";
    byId("manufacturing-ranking-table").innerHTML = html;
    var note = byId("manufacturing-ranking-preview-note");
    if (note) note.textContent = results.length > PREVIEW_LIMIT ? "全" + formatNumber(results.length) + "行中、上位" + formatNumber(PREVIEW_LIMIT) + "行を画面表示" : "全" + formatNumber(results.length) + "行を表示";
    setLoading(state.isLoading);
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
    summary.results = filterSupplierResults(summary.results, options);
    state.results = summary.results;
    state.summary = summary;
    state.options = options;
    renderSummary(summary, options);
    renderWarning(options, summary);
    renderPreviewTable(summary.results, options);
    return summary.results.length > 0;
  }

  function buildExcelRows(results, options) {
    var exportResults = options.reportType === "supplier_availability"
      ? filterSupplierResults(results || [], options)
      : (results || []);
    if (options.reportType === "supplier_availability") {
      var supplierRows = [[
        "順位", "カテゴリ", "商品名", "商品CD", "純正品番", "純正品番2", "メーカー品番",
        "仕入先商品", "仕入先名称", "仕入先品番", "仕入先メーカー", "仕入先純正品番", "仕入先メーカー品番"
      ]];
      exportResults.forEach(function(result) {
        var row = result.row;
        var items = supplierItemsForResult(result, options);
        (items.length ? items : [null]).forEach(function(item) {
          supplierRows.push([
            result.rank,
            row.sheet || "",
            row.productName || "",
            row.productCode || "",
            row.genuine || "",
            row.genuine2 || "",
            row.maker || "",
            items.length ? "あり" : "なし",
            item ? supplierName(item.supplier_id) : "",
            item ? supplierItemManagementNumber(item) : "",
            item ? normalizeText(item.manufacturer) : "",
            item ? normalizeText(item.genuine_part_number) : "",
            item ? normalizeText(item.manufacturer_part_number) : ""
          ]);
        });
      });
      return supplierRows;
    }

    var headers = ["順位", "カテゴリ", "商品名", "商品CD", "純正品番", "純正品番2", "メーカー品番", "出荷数", "代替台数", "順位値"];
    if (options.showCoreStock) headers.push("現在コア在庫", "互換コア在庫", "コア在庫合計");
    if (options.showMissingMaster) headers.push("マスタ未登録品番");
    var rows = [headers];
    exportResults.forEach(function(result) {
      var row = result.row;
      var values = [
        result.rank,
        row.sheet || "",
        row.productName || "",
        row.productCode || "",
        row.genuine || "",
        row.genuine2 || "",
        row.maker || "",
        Number(result.shipment || 0),
        Number(result.substitute || 0),
        Number(result.score || 0)
      ];
      if (options.showCoreStock) {
        var stock = coreStockDetails(result);
        values.push(stock.currentTotal, stock.compatibleTotal, stock.currentTotal + stock.compatibleTotal);
      }
      if (options.showMissingMaster) {
        values.push(missingMasterPartNumbers(result, options.compatibilityMode).map(function(entry) {
          return entry.label + " " + entry.value;
        }).join(" / "));
      }
      rows.push(values);
    });
    return rows;
  }

  function excelCsvCell(value) {
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    var text = String(value == null ? "" : value);
    if (/^[=+\-@]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }

  function buildExcelCsv(results, options) {
    return buildExcelRows(results, options).map(function(row) {
      return row.map(excelCsvCell).join(",");
    }).join("\r\n") + "\r\n";
  }

  function exportRankingExcel() {
    var reportType = byId("manufacturing-ranking-report-type");
    var supplierReport = reportType && reportType.value === "supplier_availability";
    if (!state.masterDataReady) {
      alert("コア在庫・互換情報の照合完了後にExcel出力できます。");
      return;
    }
    if (supplierReport && !state.supplierDataReady) {
      alert(state.supplierDataError ? "仕入先商品の照合に失敗しました。再読み込みしてください。" : "仕入先商品の照合完了後にExcel出力できます。");
      return;
    }
    if (!updatePreview()) return;
    var csv = buildExcelCsv(state.results, state.options);
    var blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = printFileTitle(state.options.categories, state.options.startRank, state.options.endRank, new Date(), state.options.reportType) + ".csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
    setSourceStatus("Excel用CSVを " + formatNumber(state.results.length) + " 件出力しました。", "success");
  }

  function buildPrintRows(results, options) {
    return results.map(function(result) {
      var row = result.row;
      if (options.reportType === "supplier_availability") {
        var supplierItems = supplierItemsForResult(result, options);
        var supplierRowSpan = Math.max(1, supplierItems.length);
        var supplierStatus = supplierItems.length
          ? "<span class='supplier-status is-available'>あり</span>"
          : "<span class='supplier-status is-unavailable'>なし</span>";
        var supplierRows = (supplierItems.length ? supplierItems : [null]).map(function(item, itemIndex) {
          var html = "<tr>";
          if (itemIndex === 0) {
            html += "<td class='rank' rowspan='" + supplierRowSpan + "'>" + formatNumber(result.rank) + "</td>" +
              "<td class='product' rowspan='" + supplierRowSpan + "'><b>" + escapeHtml(row.productName || "-") + "</b><small>商品CD " + escapeHtml(row.productCode || "-") + "</small></td>" +
              "<td class='part genuine-part' rowspan='" + supplierRowSpan + "'>" + escapeHtml(row.genuine || "-") + "</td>" +
              "<td class='part maker-part' rowspan='" + supplierRowSpan + "'>" + escapeHtml(row.maker || "-") + "</td>" +
              "<td class='supplier-status-cell' rowspan='" + supplierRowSpan + "'>" + supplierStatus + "</td>";
          }
          return html + (item
            ? "<td class='supplier-name'>" + escapeHtml(supplierName(item.supplier_id)) + "</td><td class='supplier-part'>" + escapeHtml(supplierItemManagementNumber(item)) + "</td><td class='supplier-product-detail'>" + escapeHtml(supplierItemDetailText(item)) + "</td>"
            : "<td class='supplier-name'>-</td><td class='supplier-part'>-</td><td class='supplier-product-detail'>-</td>") + "</tr>";
        }).join("");
        return "<tbody class='print-item'>" + supplierRows + "</tbody>";
      }
      var missing = missingMasterPartNumbers(result, options.compatibilityMode);
      var html = "<tr><td class='rank'>" + formatNumber(result.rank) + "</td>" +
        "<td class='product'><b>" + escapeHtml(row.productName || "-") + "</b><small>商品CD " + escapeHtml(row.productCode || "-") + "</small></td>" +
        "<td class='part genuine-part'>" + escapeHtml(row.genuine || "-") + "</td>" +
        "<td class='part maker-part'>" + escapeHtml(row.maker || "-") + "</td>" +
        "<td class='number shipment'>" + formatNumber(result.shipment) + "</td>";
      if (options.metric !== "shipment") html += "<td class='number score'>" + formatNumber(result.score) + "</td>";
      if (options.showCoreStock) html += "<td class='stock'>" + buildPrintCoreStock(result) + "</td>";
      if (options.showMissingMaster) html += "<td class='missing'>" + buildPrintMissingMaster(missing) + "</td>";
      html += "</tr>";
      return "<tbody class='print-item'>" + html + "</tbody>";
    }).join("");
  }

  function buildPrintHtml(results, options) {
    var version = typeof APP_VERSION === "string" ? APP_VERSION : "";
    var orientationCss = options.orientation === "portrait" ? "ranking-report-print-portrait.css" : "ranking-report-print-landscape.css";
    var generatedDate = new Date();
    var generatedAt = generatedDate.toLocaleString("ja-JP");
    var categoryText = options.categories.join(" / ");
    var supplierReport = options.reportType === "supplier_availability";
    var title = printFileTitle(options.categories, options.startRank, options.endRank, generatedDate, options.reportType);
    var coreStockSummary = rankingCoreStockSummary(results);
    var supplierSummary = supplierAvailabilitySummary(results, options);
    var header;
    if (supplierReport) {
      header = "<tr><th class='rank-head'>順位</th><th class='product-head'>商品名</th><th class='genuine-head'>純正品番</th><th class='maker-head'>メーカー品番</th><th class='supplier-status-head'>仕入先商品</th><th class='supplier-name-head'>仕入先名称</th><th class='supplier-part-head'>仕入先品番</th><th class='supplier-product-detail-head'>品番情報</th></tr>";
    } else {
      header = "<tr><th class='rank-head'>順位</th><th class='product-head'>商品名</th><th class='genuine-head'>純正品番</th><th class='maker-head'>メーカー品番</th><th class='shipment-head'>出荷数</th>";
      if (options.metric !== "shipment") header += "<th class='score-head'>順位値</th>";
      if (options.showCoreStock) header += "<th class='stock-head'>コア在庫</th>";
      if (options.showMissingMaster) header += "<th class='missing-head'>未登録</th>";
      header += "</tr>";
    }
    var conditions = supplierReport
      ? "<section class='conditions'><div><span>D-CATSデータ</span><b>" + escapeHtml(state.fileName) + "</b></div>" +
        "<div><span>順位基準</span><b>" + escapeHtml(metricLabel(options.metric) + " / " + rankScopeLabel(options.rankScope)) + "</b></div>" +
        "<div><span>対象仕入先</span><b>" + escapeHtml(options.supplierId === "all" ? "すべて" : supplierName(options.supplierId)) + "</b></div>" +
        "<div><span>仕入先商品</span><b>あり " + formatNumber(supplierSummary.availableCount) + "件 / なし " + formatNumber(supplierSummary.unavailableCount) + "件</b></div>" +
        "<div><span>出力件数</span><b>" + formatNumber(results.length) + "件</b></div></section>"
      : "<section class='conditions'><div><span>D-CATSデータ</span><b>" + escapeHtml(state.fileName) + "</b></div>" +
        "<div><span>順位基準</span><b>" + escapeHtml(metricLabel(options.metric) + " / " + rankScopeLabel(options.rankScope)) + "</b></div>" +
        "<div><span>互換品番</span><b>" + escapeHtml(compatibilityModeLabel(options.compatibilityMode)) + "</b></div>" +
        "<div><span>コア在庫合計（互換含む）</span><b>" + (coreStockSummary.ready ? formatNumber(coreStockSummary.total) + "台" : "照合中") + "</b></div>" +
        "<div><span>出力件数</span><b>" + formatNumber(results.length) + "件</b></div></section>";

    return "<!doctype html><html lang='ja'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>" +
      "<title>" + escapeHtml(title) + "</title>" +
      "<link rel='stylesheet' href='ranking-report-print.css?dcats_version=" + encodeURIComponent(version) + "&amp;layout=6'>" +
      "<link rel='stylesheet' href='" + orientationCss + "?dcats_version=" + encodeURIComponent(version) + "&amp;layout=6'>" +
      "</head><body><div class='print-toolbar'><button id='dcats-ranking-print' type='button'>PDFとして保存 / 印刷</button><span>印刷先で「PDFに保存」を選択してください。</span></div>" +
      "<main class='report" + (supplierReport ? " supplier-report" : "") + "'><header><div><span class='eyebrow'>D-CATS MANUFACTURING REPORT</span><h1>" + (supplierReport ? "仕入先商品照合リスト" : "製造ランキング") + "</h1><p>" + escapeHtml(categoryText) + "</p></div>" +
      "<div class='report-meta'><b>順位 " + formatNumber(options.startRank) + " - " + formatNumber(options.endRank) + "</b><span>" + escapeHtml(generatedAt) + " 作成</span></div></header>" +
      conditions +
      "<table><thead>" + header + "</thead>" + buildPrintRows(results, options) + "</table>" +
      "<footer><span>D-CATS / " + (supplierReport ? "仕入先商品照合" : "製造ランキング") + "</span><span>" + (supplierReport ? "順位はD-CATS出荷実績に基づく / 出荷数・コア在庫は非表示 / 仕入先商品はD-CATS照合時点" : "順位は連番で重複なし / コア在庫・互換・未登録品番はD-CATS照合時点") + "</span></footer></main></body></html>";
  }

  function openPdfPreview() {
    var popup = window.open("", "_blank");
    if (!popup) {
      alert("PDFプレビューを開けませんでした。ブラウザのポップアップ許可を確認してください。");
      return;
    }
    var reportType = byId("manufacturing-ranking-report-type");
    var supplierReport = reportType && reportType.value === "supplier_availability";
    if (!state.masterDataReady) {
      popup.close();
      alert("コア在庫・互換情報の照合完了後にPDF出力できます。");
      return;
    }
    if (supplierReport && !state.supplierDataReady) {
      popup.close();
      alert(state.supplierDataError ? "仕入先商品の照合に失敗しました。再読み込みしてください。" : "仕入先商品の照合完了後にPDF出力できます。");
      return;
    }
    if (!updatePreview()) {
      popup.close();
      return;
    }
    var printPrepared = false;
    var attachPrint = function() {
      if (printPrepared || popup.closed) return;
      printPrepared = true;
      var button = popup.document.getElementById("dcats-ranking-print");
      if (button) button.addEventListener("click", function() { popup.print(); });
      popup.focus();
      window.setTimeout(function() {
        if (!popup.closed) popup.print();
      }, 300);
    };
    popup.addEventListener("load", attachPrint, { once: true });
    popup.document.open();
    popup.document.write(buildPrintHtml(state.results, state.options));
    popup.document.close();
    window.setTimeout(attachPrint, 800);
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
    byId("manufacturing-ranking-excel").addEventListener("click", exportRankingExcel);
    byId("manufacturing-ranking-pdf").addEventListener("click", openPdfPreview);
    byId("manufacturing-ranking-report-type").addEventListener("change", function() {
      syncReportTypeControls();
      updatePreview();
    });
    byId("manufacturing-ranking-supplier").addEventListener("change", updatePreview);
    byId("manufacturing-ranking-supplier-status").addEventListener("change", updatePreview);
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
    syncReportTypeControls();
  }

  window.enterManufacturingRankingReport = enterManufacturingRankingReport;
  window.DCatsManufacturingRankingReport = {
    buildRanking: buildRanking,
    normalizePart: normalizePart,
    mapDatabaseRow: mapDatabaseRow,
    buildPrintHtml: buildPrintHtml,
    missingMasterPartNumbers: missingMasterPartNumbers,
    compatibilityDetails: compatibilityDetails,
    coreStockDetails: coreStockDetails,
    rankingCoreStockSummary: rankingCoreStockSummary,
    printFileTitle: printFileTitle,
    buildExcelRows: buildExcelRows,
    buildExcelCsv: buildExcelCsv,
    supplierItemsForResult: supplierItemsForResult,
    supplierAvailabilitySummary: supplierAvailabilitySummary,
    filterSupplierResults: filterSupplierResults,
    indexSupplierCatalogData: indexSupplierCatalogData,
    setMasterPartNumbers: function(values) {
      state.masterPartNumbers = Object.create(null);
      (values || []).forEach(function(value) {
        var key = normalizeSearch(value);
        if (key) state.masterPartNumbers[key] = true;
      });
      state.masterDataReady = true;
      state.masterDataError = false;
    },
    setMasterProducts: function(products, groups) {
      state.masterProductsById = Object.create(null);
      state.masterProductsByPart = Object.create(null);
      state.kikanMembersByGroupId = Object.create(null);
      state.kikanGroupIdsByProductId = Object.create(null);
      (products || []).forEach(function(source) {
        var product = Object.assign({
          id: String(source.id),
          manufacturer: "",
          coreStockQty: 0
        }, source);
        product.id = String(product.id);
        product.coreStockQty = Math.max(0, parseNumber(product.coreStockQty));
        state.masterProductsById[product.id] = product;
        MASTER_VALUE_COLUMNS.forEach(function(column) {
          var value = product[column];
          if (!isLikelyPartNumber(value)) return;
          var key = normalizeSearch(value);
          if (!state.masterProductsByPart[key]) state.masterProductsByPart[key] = [];
          if (state.masterProductsByPart[key].indexOf(product) < 0) state.masterProductsByPart[key].push(product);
        });
      });
      Object.keys(groups || {}).forEach(function(groupId) {
        var members = groups[groupId].map(String);
        state.kikanMembersByGroupId[String(groupId)] = members;
        members.forEach(function(productId) {
          if (!state.kikanGroupIdsByProductId[productId]) state.kikanGroupIdsByProductId[productId] = [];
          state.kikanGroupIdsByProductId[productId].push(String(groupId));
        });
      });
      state.masterDataReady = true;
      state.masterDataError = false;
    },
    setSupplierCatalogData: function(links, items) {
      var indexed = indexSupplierCatalogData(links, items);
      state.supplierItemsByProductId = indexed.itemsByProductId;
      state.supplierItemCount = indexed.itemCount;
      state.supplierDataReady = true;
      state.supplierDataError = false;
    }
  };
  bindEvents();
})();
