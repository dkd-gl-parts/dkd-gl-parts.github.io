(function () {
  "use strict";

  var BUCKET = "product-3d";
  var MIN_CAPTURES = 6;
  var RECOMMENDED_CAPTURES = 12;
  var MAX_CAPTURE_EDGE = 2560;
  var LIVE_ANALYZE_INTERVAL_MS = 250;
  var VIDEO_SAMPLE_INTERVAL_MS = 1250;
  var VIDEO_PROPOSAL_DELAY_MS = 30000;
  var DIRECTIONS = [
    { id: "front", label: "正面", angle: 0 },
    { id: "front_right", label: "右前", angle: 45 },
    { id: "right", label: "右側", angle: 90 },
    { id: "rear_right", label: "右後", angle: 135 },
    { id: "rear", label: "背面", angle: 180 },
    { id: "rear_left", label: "左後", angle: 225 },
    { id: "left", label: "左側", angle: 270 },
    { id: "front_left", label: "左前", angle: 315 },
    { id: "upper", label: "上側", angle: null },
    { id: "lower", label: "下側", angle: null },
    { id: "bottom", label: "底面", angle: null },
    { id: "detail", label: "補足", angle: null }
  ];
  var state = freshState();
  var elements = {};
  var viewer = null;
  var viewerRequestId = 0;
  var viewerReturnFocus = null;
  var viewerFocusTarget = null;
  var viewerComparisonTarget = null;
  var viewerComparisonRequestId = 0;
  var viewerExportTarget = null;
  var modelCache = Object.create(null);
  var internalModelCache = Object.create(null);
  var modelBadgeCache = Object.create(null);
  var modelCacheEpoch = 0;
  var sessionModelsEnabled = true;
  var modelAuthUserId = null;
  var badgeRefreshTimer = null;
  var glbUploadTarget = null;
  var localGlbTarget = null;
  var glbMutationBusy = false;
  var tripoTarget = null;
  var tripoJob = null;
  var tripoBusy = false;
  var hunyuanReadinessBusy = false;
  var tripoHistoryReady = false;
  var tripoRequestId = 0;
  var tripoReturnFocus = null;
  var tripoImageRows = Object.create(null);
  var tripoImagePreviewRequestId = 0;
  var preparedInputsController = null;
  var mediaAvailabilityRequest = { sales: 0, production: 0, customer: 0 };
  var mediaPaneRequest = { sales: 0, production: 0, customer: 0 };

  function freshState() {
    return {
      context: "sales",
      product: null,
      kind: "rebuilt",
      workspace: null,
      stream: null,
      lastPreviewAnalyzedAt: 0,
      failures: 0,
      openedAt: 0,
      lastAcceptedAt: 0,
      currentDirection: "front",
      bottomMode: false,
      videoMode: false,
      videoTimer: null,
      proposalTimer: null,
      hashes: [],
      analyses: [],
      guide: null,
      busy: false
    };
  }

  function el(id) { return document.getElementById(id); }
  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function productId(product) {
    if (typeof productDkdId === "function") return Number(productDkdId(product));
    return Number(product && (product.dkd_shohin_id || product.id));
  }
  function cleanKind(kind) {
    kind = typeof normalizeProductKind === "function" ? normalizeProductKind(kind) : String(kind || "rebuilt");
    return kind === "rebuilt" || kind === "aftermarket_new" ? kind : "";
  }
  function kindLabel(kind) {
    kind = cleanKind(kind);
    return kind === "aftermarket_new" ? "新品" : (kind === "rebuilt" ? "リビルト" : "対象外");
  }
  function canManage3D() {
    return typeof canManageProduct3D === "function" && canManageProduct3D();
  }
  function canManageGlb() {
    return typeof canManageProduct3DGlb === "function" && canManageProduct3DGlb();
  }
  function canPublish3D() {
    return typeof canPublishProduct3D === "function" && canPublishProduct3D();
  }
  function canReview3D() {
    return typeof canReviewProduct3D === "function" && canReviewProduct3D();
  }
  function deny3D(action) {
    if (typeof showPermissionDenied === "function") showPermissionDenied(action, "product_3d_models");
    else alert("商品3D管理の権限がありません。");
  }
  function direction(id) { return DIRECTIONS.find(function (row) { return row.id === id; }) || DIRECTIONS[0]; }
  function nextDirection() {
    var covered = coveredDirections();
    var priority = state.bottomMode
      ? ["bottom", "lower", "detail"]
      : ["front", "front_right", "right", "rear_right", "rear", "rear_left", "left", "front_left", "upper", "lower"];
    return priority.find(function (id) { return covered.indexOf(id) < 0; }) || "detail";
  }
  function coveredDirections() {
    return Array.from(new Set(state.analyses.filter(function (a) { return a.accepted; }).map(function (a) { return a.direction; })));
  }

  function cacheElements() {
    if (window.DcatsPreparedInputs && el("product-3d-prepared-inputs")) {
      preparedInputsController = window.DcatsPreparedInputs.create(el("product-3d-prepared-inputs"));
    }
    [
      "product-3d-capture-overlay", "product-3d-capture-close", "product-3d-capture-context",
      "product-3d-camera-stage", "product-3d-camera-video", "product-3d-guide-canvas",
      "product-3d-analysis-canvas", "product-3d-camera-placeholder", "product-3d-direction-callout",
      "product-3d-live-feedback", "product-3d-start-camera", "product-3d-snapshot",
      "product-3d-video-supplement", "product-3d-bottom-mode", "product-3d-capture-count",
      "product-3d-capture-dial", "product-3d-analysis-progress", "product-3d-analysis-results",
      "product-3d-quality-score", "product-3d-quality-list", "product-3d-submit-status", "product-3d-submit",
      "product-3d-viewer-overlay", "product-3d-viewer-shell", "product-3d-viewer-close", "product-3d-viewer-title",
      "product-3d-viewer-stage", "product-3d-viewer-loading", "product-3d-viewer-reset",
      "product-3d-viewer-zoom-in", "product-3d-viewer-zoom-out",
      "product-3d-viewer-autorotate", "product-3d-viewer-fullscreen", "product-3d-viewer-fullscreen-notice",
      "product-3d-viewer-compare", "product-3d-viewer-reference", "product-3d-viewer-reference-image",
      "product-3d-viewer-export", "product-3d-viewer-export-notice",
      "product-3d-viewer-reference-label", "product-3d-viewer-reference-photos",
      "product-3d-glb-file", "product-3d-local-glb-file", "product-3d-tripo-overlay", "product-3d-tripo-close",
      "product-3d-tripo-context", "product-3d-tripo-images", "product-3d-tripo-views",
      "product-3d-tripo-kind", "product-3d-tripo-selection", "product-3d-tripo-selection-status",
      "product-3d-tripo-preset", "product-3d-tripo-auto-assign", "product-3d-tripo-preset-status",
      "product-3d-tripo-image-directions",
      "product-3d-tripo-image-preview", "product-3d-tripo-image-preview-img",
      "product-3d-tripo-image-preview-label", "product-3d-tripo-image-preview-close",
      "product-3d-tripo-status", "product-3d-tripo-start", "product-3d-tripo-poll",
      "product-3d-tripo-preview", "product-3d-tripo-publish", "product-3d-tripo-reject"
    ].forEach(function (id) { elements[id] = el(id); });
  }

  function selectedTarget(context) {
    var product = context === "production" ? window.currentProductionRow : (context === "customer" ? window.customerCatalogSelectedProduct : window.currentProduct);
    var kind = context === "production"
      ? (typeof selectedImageActionKind === "function" ? selectedImageActionKind("production") : window.currentProductionImageKind)
      : (context === "customer"
        ? (typeof customerCatalogProductKind === "function" ? customerCatalogProductKind(product) : (product && product.default_product_kind))
        : (typeof selectedImageActionKind === "function" ? selectedImageActionKind("sales") : (typeof selectedProductKind === "function" ? selectedProductKind() : "rebuilt")));
    return { product: product, kind: cleanKind(kind) };
  }

  async function openCapture(context) {
    if (state.busy) return;
    if (!canManage3D()) { deny3D("open_product_3d_capture"); return; }
    var target = selectedTarget(context || "sales");
    if (!target.product || !productId(target.product)) {
      alert("3Dモデルを作成する商品を選択してください。");
      return;
    }
    if (!target.kind) {
      alert("3Dモデルを作成できる商品区分は「リビルト」と「新品」です。");
      return;
    }
    closeImageActionOverlays();
    stopCamera();
    state = freshState();
    state.context = context || "sales";
    state.product = target.product;
    state.kind = target.kind;
    delete internalModelCache[String(productId(target.product))];
    state.openedAt = Date.now();
    state.lastAcceptedAt = Date.now();
    elements["product-3d-capture-overlay"].classList.add("show");
    elements["product-3d-capture-overlay"].setAttribute("aria-hidden", "false");
    elements["product-3d-capture-context"].textContent = productTitle(target.product) + " / " + kindLabel(target.kind);
    setStatus("保存済み画像を解析しています…", "working");
    renderAll();
    try {
      var result = await sb.rpc("open_product_3d_workspace", {
        target_dkd_shohin_id: productId(target.product),
        target_product_kind: target.kind
      });
      if (result.error) throw result.error;
      state.workspace = result.data;
      hydrateRegisteredCaptures();
      await analyzeExistingImages(result.data.existing_images || []);
      setStatus(captureReadinessText(), "ready");
    } catch (error) {
      console.error("product 3D workspace failed", error);
      setStatus("3D作成領域を開けませんでした: " + friendlyError(error), "error");
    }
    state.proposalTimer = window.setTimeout(proposeVideoIfNeeded, VIDEO_PROPOSAL_DELAY_MS);
    renderAll();
  }

  function productTitle(product) {
    var id = productId(product);
    var label = typeof t === "function" ? t("f_product_id") : "商品ID";
    var title = Number.isSafeInteger(id) && id > 0 ? label + " " + id : "商品";
    var details = [];
    var manufacturer = String(product && product.manufacturer_part_number || "").trim();
    var genuine = String(product && product.genuine_part_number || "").trim();
    if (manufacturer) details.push((typeof t === "function" ? t("f_mfr_pn") : "メーカー品番") + " " + manufacturer);
    if (genuine) details.push((typeof t === "function" ? t("f_genuine_pn") : "純正品番") + " " + genuine);
    return title + (details.length ? " / " + details.join(" / ") : "");
  }
  function closeImageActionOverlays() {
    ["image-actions-overlay", "production-image-actions-overlay"].forEach(function (id) {
      var node = el(id); if (node) node.classList.remove("show");
    });
  }
  function hydrateRegisteredCaptures() {
    var captures = state.workspace && state.workspace.captures || [];
    captures.forEach(function (capture) {
      var quality = capture.quality_metrics || {};
      var hash = typeof quality.perceptual_hash === "string" ? quality.perceptual_hash : null;
      state.analyses.push(Object.assign({ accepted: true, registered: true }, quality, {
        id: capture.id,
        coreProductImageId: capture.core_product_image_id,
        sourceKind: capture.source_kind,
        direction: capture.direction,
        silhouette: capture.silhouette || {},
        hash: hash
      }));
      if (hash && state.hashes.indexOf(hash) < 0) state.hashes.push(hash);
    });
  }

  async function analyzeExistingImages(images) {
    elements["product-3d-analysis-progress"].textContent = "0 / " + images.length;
    for (var index = 0; index < images.length; index += 1) {
      var imageRow = images[index];
      if (state.analyses.some(function (a) { return Number(a.coreProductImageId) === Number(imageRow.id); })) continue;
      var url = imageRow.storage_path && typeof signProductImageUrl === "function"
        ? await signProductImageUrl(imageRow.storage_path)
        : imageRow.image_url;
      var loaded = null;
      try {
        loaded = await loadImageBlob(url);
        var analysis = analyzeSource(loaded.image, "existing_image");
        analysis.direction = inferExistingDirection(index, images.length, analysis);
        applyCaptureContextChecks(analysis);
        analysis.coreProductImageId = imageRow.id;
        analysis.sourceKind = "existing_image";
        analysis.label = "保存済み画像 " + (index + 1);
        if (!imageRow.storage_path) {
          analysis.accepted = false;
          analysis.issues.push("生成に使える非公開元画像がありません");
        }
        if (analysis.accepted && !analysis.duplicate) {
          await registerAnalysis(analysis, null, await contentSha256(loaded.blob));
        } else {
          state.analyses.push(analysis);
        }
      } catch (error) {
        state.analyses.push({ accepted: false, label: "保存済み画像 " + (index + 1), issues: ["画像を解析できません"], direction: "detail", sourceKind: "existing_image" });
      } finally {
        if (loaded && loaded.image && typeof loaded.image.close === "function") loaded.image.close();
        if (loaded && loaded.objectUrl) URL.revokeObjectURL(loaded.objectUrl);
      }
      elements["product-3d-analysis-progress"].textContent = (index + 1) + " / " + images.length;
      renderAll();
    }
    state.currentDirection = nextDirection();
  }

  function inferExistingDirection(index, total, analysis) {
    if (analysis && analysis.topView) return "upper";
    var ring = DIRECTIONS.slice(0, 8);
    return ring[Math.round(index * ring.length / Math.max(total, 1)) % ring.length].id;
  }
  function loadImage(url) {
    return new Promise(function (resolve, reject) {
      if (!url) { reject(new Error("image URL missing")); return; }
      var image = new Image();
      image.crossOrigin = "anonymous";
      image.onload = function () { resolve(image); };
      image.onerror = reject;
      image.src = url;
    });
  }
  async function loadImageBlob(url) {
    if (!url) throw new Error("image URL missing");
    var response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error("image fetch failed: " + response.status);
    var blob = await response.blob();
    if (typeof createImageBitmap === "function") {
      return { image: await createImageBitmap(blob), blob: blob, objectUrl: null };
    }
    return { image: await loadImage(url), blob: blob, objectUrl: null };
  }

  async function startCamera() {
    if (!canManage3D()) { deny3D("start_product_3d_camera"); return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setLiveFeedback(["この端末ではカメラを利用できません"], false); return;
    }
    try {
      stopCamera();
      state.stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      var video = elements["product-3d-camera-video"];
      video.srcObject = state.stream;
      await video.play();
      elements["product-3d-camera-placeholder"].hidden = true;
      elements["product-3d-snapshot"].disabled = false;
      state.currentDirection = nextDirection();
      state.lastPreviewAnalyzedAt = 0;
      drawGuide();
      window.requestAnimationFrame(liveAnalyzeLoop);
    } catch (error) {
      setLiveFeedback(["カメラを開始できません。ブラウザのカメラ許可を確認してください"], false);
    }
  }
  function stopCamera() {
    if (state.videoTimer) window.clearInterval(state.videoTimer);
    state.videoTimer = null;
    state.videoMode = false;
    if (state.stream) state.stream.getTracks().forEach(function (track) { track.stop(); });
    state.stream = null;
    var video = elements["product-3d-camera-video"];
    if (video) video.srcObject = null;
  }
  function liveAnalyzeLoop(timestamp) {
    if (!state.stream) return;
    var video = elements["product-3d-camera-video"];
    timestamp = Number(timestamp) || Date.now();
    if (video.readyState >= 2 && timestamp - state.lastPreviewAnalyzedAt >= LIVE_ANALYZE_INTERVAL_MS) {
      state.lastPreviewAnalyzedAt = timestamp;
      var sample = analyzeSource(video, "preview", true);
      sample.direction = state.bottomMode ? "bottom" : state.currentDirection;
      applyCaptureContextChecks(sample);
      state.guide = sample;
      setLiveFeedback(sample.issues.length ? sample.issues.slice(0, 2) : [direction(state.currentDirection).label + "を撮影できます"], sample.accepted);
      drawGuide(sample);
    }
    window.requestAnimationFrame(liveAnalyzeLoop);
  }

  function analyzeSource(source, sourceKind, fast) {
    var canvas = elements["product-3d-analysis-canvas"];
    var ctx = canvas.getContext("2d", { willReadFrequently: true });
    var sw = source.videoWidth || source.naturalWidth || source.width;
    var sh = source.videoHeight || source.naturalHeight || source.height;
    var scale = Math.min(1, 320 / Math.max(sw, sh));
    canvas.width = Math.max(32, Math.round(sw * scale));
    canvas.height = Math.max(32, Math.round(sh * scale));
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
    var frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
    var pixels = frame.data, w = frame.width, h = frame.height;
    var luminance = new Float32Array(w * h);
    var total = 0, dark = 0, white = 0, reflection = 0;
    for (var i = 0, p = 0; i < pixels.length; i += 4, p += 1) {
      var y = pixels[i] * 0.2126 + pixels[i + 1] * 0.7152 + pixels[i + 2] * 0.0722;
      luminance[p] = y; total += y;
      if (y < 28) dark += 1;
      if (y > 248) white += 1;
      if (y > 238 && Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) - Math.min(pixels[i], pixels[i + 1], pixels[i + 2]) < 10) reflection += 1;
    }
    var mean = total / luminance.length;
    var lapTotal = 0, lapSquared = 0, lapCount = 0;
    for (var yPos = 1; yPos < h - 1; yPos += fast ? 2 : 1) {
      for (var xPos = 1; xPos < w - 1; xPos += fast ? 2 : 1) {
        var idx = yPos * w + xPos;
        var lap = 4 * luminance[idx] - luminance[idx - 1] - luminance[idx + 1] - luminance[idx - w] - luminance[idx + w];
        lapTotal += lap; lapSquared += lap * lap; lapCount += 1;
      }
    }
    var lapMean = lapTotal / Math.max(lapCount, 1);
    var sharpness = lapSquared / Math.max(lapCount, 1) - lapMean * lapMean;
    var palette = borderPalette(pixels, w, h);
    var silhouette = boundingSilhouette(pixels, w, h, palette);
    var fill = silhouette.width * silhouette.height;
    var neutralBrightRatio = neutralBrightRatioInBox(pixels, w, h, silhouette);
    var issues = [];
    if (sharpness < 95) issues.push("ブレ・ピンぼけ");
    if (mean < 58 || dark / luminance.length > 0.42) issues.push("暗すぎます");
    if (white / luminance.length > 0.23) issues.push("白飛びしています");
    if (fill < 0.15) issues.push("商品が遠すぎます");
    if (fill > 0.82) issues.push("商品が近すぎます");
    if (silhouette.clipped) issues.push("商品が画面から切れています");
    if (fill > 0.35 && neutralBrightRatio > 0.72) issues.push("商品ではない画像の可能性があります");
    if (Math.min(sw, sh) < 720 || Math.max(sw, sh) < 1000) issues.push("画像解像度が不足しています");
    if (reflection / luminance.length > 0.09) issues.push("金属反射が強すぎます");
    var hash = perceptualHash(luminance, w, h);
    var duplicate = state.hashes.some(function (known) { return hashDistance(known, hash) <= 5; });
    if (duplicate) issues.push("同じ方向の画像と重複しています");
    var score = Math.max(0, Math.min(100, Math.round(100 - issues.length * 19 - (sharpness < 160 ? 8 : 0))));
    return {
      accepted: issues.length === 0,
      duplicate: duplicate,
      issues: issues,
      score: score,
      sharpness: Math.round(sharpness),
      brightness: Math.round(mean),
      clipped: silhouette.clipped,
      reflectionRatio: Number((reflection / luminance.length).toFixed(4)),
      neutralBrightRatio: Number(neutralBrightRatio.toFixed(4)),
      sourceWidth: sw,
      sourceHeight: sh,
      silhouette: silhouette,
      hash: hash,
      sourceKind: sourceKind
    };
  }

  function borderPalette(pixels, w, h) {
    var clusters = Object.create(null), total = 0;
    var step = Math.max(1, Math.floor(Math.min(w, h) / 40));
    function add(x, y) {
      var i = (y * w + x) * 4;
      var key = (pixels[i] >> 5) + ":" + (pixels[i + 1] >> 5) + ":" + (pixels[i + 2] >> 5);
      var entry = clusters[key] || { count: 0, r: 0, g: 0, b: 0 };
      entry.count += 1; entry.r += pixels[i]; entry.g += pixels[i + 1]; entry.b += pixels[i + 2];
      clusters[key] = entry; total += 1;
    }
    for (var x = 0; x < w; x += step) { add(x, 0); add(x, h - 1); }
    for (var y = 0; y < h; y += step) { add(0, y); add(w - 1, y); }
    var minimum = Math.max(2, Math.round(total * 0.03));
    var selected = Object.keys(clusters).map(function (key) { return clusters[key]; })
      .filter(function (entry) { return entry.count >= minimum; })
      .sort(function (a, b) { return b.count - a.count; }).slice(0, 16);
    if (!selected.length) selected = Object.keys(clusters).map(function (key) { return clusters[key]; }).sort(function (a, b) { return b.count - a.count; }).slice(0, 1);
    return selected.map(function (entry) { return [entry.r / entry.count, entry.g / entry.count, entry.b / entry.count]; });
  }
  function borderTransitionRatio(pixels, w, h) {
    var step = Math.max(1, Math.floor(Math.min(w, h) / 40));
    var changes = 0, comparisons = 0;
    function compare(x1, y1, x2, y2) {
      var a = (y1 * w + x1) * 4, b = (y2 * w + x2) * 4;
      var difference = Math.abs(pixels[a] - pixels[b]) + Math.abs(pixels[a + 1] - pixels[b + 1]) + Math.abs(pixels[a + 2] - pixels[b + 2]);
      if (difference > 46) changes += 1;
      comparisons += 1;
    }
    for (var x = step; x < w; x += step) { compare(x - step, 0, x, 0); compare(x - step, h - 1, x, h - 1); }
    for (var y = step; y < h; y += step) { compare(0, y - step, 0, y); compare(w - 1, y - step, w - 1, y); }
    return changes / Math.max(1, comparisons);
  }
  function numericQuantile(values, ratio) {
    values.sort(function (a, b) { return a - b; });
    if (!values.length) return 0;
    var position = (values.length - 1) * ratio;
    var lower = Math.floor(position), upper = Math.ceil(position), fraction = position - lower;
    return values[lower] * (1 - fraction) + values[upper] * fraction;
  }
  function boundingSilhouette(pixels, w, h, palette) {
    var gridW = Math.ceil(w / 2), gridH = Math.ceil(h / 2), total = gridW * gridH;
    var foreground = new Uint8Array(total);
    for (var gy = 0; gy < gridH; gy += 1) for (var gx = 0; gx < gridW; gx += 1) {
      var px = Math.min(w - 1, gx * 2), py = Math.min(h - 1, gy * 2), pixelIndex = (py * w + px) * 4;
      var nearest = Infinity;
      for (var colorIndex = 0; colorIndex < palette.length; colorIndex += 1) {
        var color = palette[colorIndex];
        var distance = Math.abs(pixels[pixelIndex] - color[0]) + Math.abs(pixels[pixelIndex + 1] - color[1]) + Math.abs(pixels[pixelIndex + 2] - color[2]);
        nearest = Math.min(nearest, distance);
      }
      if (nearest > 72) foreground[gy * gridW + gx] = 1;
    }
    var merged = foreground.slice();
    for (var round = 0; round < 2; round += 1) {
      var expanded = new Uint8Array(total);
      for (var y = 0; y < gridH; y += 1) for (var x = 0; x < gridW; x += 1) {
        var found = false;
        for (var dy = -1; dy <= 1 && !found; dy += 1) for (var dx = -1; dx <= 1; dx += 1) {
          var nx = x + dx, ny = y + dy;
          if (nx >= 0 && nx < gridW && ny >= 0 && ny < gridH && merged[ny * gridW + nx]) { found = true; break; }
        }
        if (found) expanded[y * gridW + x] = 1;
      }
      merged = expanded;
    }
    var seen = new Uint8Array(total), queue = new Int32Array(total), best = null;
    for (var start = 0; start < total; start += 1) {
      if (!merged[start] || seen[start]) continue;
      var head = 0, tail = 0; queue[tail++] = start; seen[start] = 1;
      var minX = gridW, minY = gridH, maxX = 0, maxY = 0, componentCount = 0, componentSumX = 0, componentSumY = 0;
      var originalX = [], originalY = [], originalCount = 0, edgeCount = 0;
      var sumX = 0, sumY = 0, sumXX = 0, sumYY = 0, sumXY = 0;
      while (head < tail) {
        var cell = queue[head++], cy = Math.floor(cell / gridW), cx = cell - cy * gridW;
        minX = Math.min(minX, cx); minY = Math.min(minY, cy); maxX = Math.max(maxX, cx); maxY = Math.max(maxY, cy);
        componentCount += 1; componentSumX += cx; componentSumY += cy;
        if (foreground[cell]) {
          originalX.push(cx); originalY.push(cy); originalCount += 1;
          sumX += cx; sumY += cy; sumXX += cx * cx; sumYY += cy * cy; sumXY += cx * cy;
          if (cx <= 1 || cx >= gridW - 2 || cy <= 1 || cy >= gridH - 2) edgeCount += 1;
        }
        for (var neighborY = Math.max(0, cy - 1); neighborY <= Math.min(gridH - 1, cy + 1); neighborY += 1) {
          for (var neighborX = Math.max(0, cx - 1); neighborX <= Math.min(gridW - 1, cx + 1); neighborX += 1) {
            var neighbor = neighborY * gridW + neighborX;
            if (merged[neighbor] && !seen[neighbor]) { seen[neighbor] = 1; queue[tail++] = neighbor; }
          }
        }
      }
      if (originalCount < 4) continue;
      var componentWidth = maxX - minX + 1, componentHeight = maxY - minY + 1;
      var compactness = originalCount / Math.max(1, componentWidth * componentHeight);
      var centerDistance = Math.sqrt(Math.pow(componentSumX / componentCount / Math.max(gridW - 1, 1) - 0.5, 2) + Math.pow(componentSumY / componentCount / Math.max(gridH - 1, 1) - 0.5, 2));
      var score = originalCount * (0.55 + compactness) * Math.max(0.35, 1 - centerDistance);
      if (!best || score > best.score) best = {
        score: score, originalX: originalX, originalY: originalY, originalCount: originalCount, edgeCount: edgeCount,
        sumX: sumX, sumY: sumY, sumXX: sumXX, sumYY: sumYY, sumXY: sumXY
      };
    }
    if (!best) return { x: 0.25, y: 0.25, width: 0.5, height: 0.5, centerX: 0.5, centerY: 0.5, tilt: 0, clipped: borderTransitionRatio(pixels, w, h) > 0.12 };
    var lowerX = numericQuantile(best.originalX, 0.015), upperX = numericQuantile(best.originalX, 0.985);
    var lowerY = numericQuantile(best.originalY, 0.015), upperY = numericQuantile(best.originalY, 0.985);
    var left = Math.max(0, (lowerX * 2 - 5) / w), top = Math.max(0, (lowerY * 2 - 5) / h);
    var right = Math.min(1, ((upperX + 1) * 2 + 5) / w), bottom = Math.min(1, ((upperY + 1) * 2 + 5) / h);
    var centerXpx = best.sumX / best.originalCount, centerYpx = best.sumY / best.originalCount;
    var covarianceXX = best.sumXX / best.originalCount - centerXpx * centerXpx;
    var covarianceYY = best.sumYY / best.originalCount - centerYpx * centerYpx;
    var covarianceXY = best.sumXY / best.originalCount - centerXpx * centerYpx;
    var tilt = 0.5 * Math.atan2(2 * covarianceXY, covarianceXX - covarianceYY) * 180 / Math.PI;
    var edgeRatio = best.edgeCount / best.originalCount;
    return {
      x: left, y: top, width: right - left, height: bottom - top,
      centerX: (left + right) / 2, centerY: (top + bottom) / 2, tilt: Number(tilt.toFixed(1)),
      clipped: left <= 0.02 || top <= 0.02 || right >= 0.98 || bottom >= 0.98 || edgeRatio >= 0.025 || borderTransitionRatio(pixels, w, h) > 0.12
    };
  }
  function neutralBrightRatioInBox(pixels, w, h, box) {
    var left = Math.max(0, Math.floor(box.x * w)), top = Math.max(0, Math.floor(box.y * h));
    var right = Math.min(w, Math.ceil((box.x + box.width) * w)), bottom = Math.min(h, Math.ceil((box.y + box.height) * h));
    var neutralBright = 0, count = 0;
    for (var y = top; y < bottom; y += 2) for (var x = left; x < right; x += 2) {
      var i = (y * w + x) * 4, r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
      if (Math.max(r, g, b) - Math.min(r, g, b) < 28 && (r + g + b) / 3 > 145) neutralBright += 1;
      count += 1;
    }
    return neutralBright / Math.max(1, count);
  }
  function perceptualHash(luma, w, h) {
    var cells = [], sum = 0;
    for (var gy = 0; gy < 8; gy += 1) for (var gx = 0; gx < 8; gx += 1) {
      var x = Math.min(w - 1, Math.floor((gx + 0.5) * w / 8));
      var y = Math.min(h - 1, Math.floor((gy + 0.5) * h / 8));
      var value = luma[y * w + x]; cells.push(value); sum += value;
    }
    var mean = sum / cells.length;
    return cells.map(function (value) { return value >= mean ? "1" : "0"; }).join("");
  }
  function hashDistance(a, b) {
    var distance = 0; for (var i = 0; i < Math.min(a.length, b.length); i += 1) if (a[i] !== b[i]) distance += 1; return distance;
  }

  function silhouetteOverlap(a, b) {
    if (!a || !b) return 1;
    var left = Math.max(a.x, b.x), top = Math.max(a.y, b.y);
    var right = Math.min(a.x + a.width, b.x + b.width), bottom = Math.min(a.y + a.height, b.y + b.height);
    var intersection = Math.max(0, right - left) * Math.max(0, bottom - top);
    var smaller = Math.min(a.width * a.height, b.width * b.height);
    return smaller > 0 ? intersection / smaller : 0;
  }
  function applyCaptureContextChecks(analysis) {
    var accepted = state.analyses.filter(function (row) { return row.accepted && row.silhouette; });
    var previous = accepted[accepted.length - 1];
    if (previous && silhouetteOverlap(previous.silhouette, analysis.silhouette) < 0.35) analysis.issues.push("前の画像との重なり不足");
    var sameDirection = accepted.filter(function (row) { return row.direction === analysis.direction; }).length;
    if (sameDirection >= 2) analysis.issues.push("同じ方向を撮りすぎています");
    var sameDirectionGuide = accepted.find(function (row) { return row.direction === analysis.direction; });
    var guide = sameDirectionGuide || (analysis.sourceKind === "existing_image" ? null : accepted[0]);
    if (guide && Math.abs(Number(analysis.silhouette.tilt || 0) - Number(guide.silhouette.tilt || 0)) > 18) analysis.issues.push("商品が枠に対して傾きすぎています");
    analysis.accepted = analysis.issues.length === 0;
    analysis.score = Math.max(0, Math.min(100, Math.round(100 - analysis.issues.length * 19 - (analysis.sharpness < 160 ? 8 : 0))));
  }

  async function captureSnapshot(sourceKind) {
    if (!canManage3D()) { deny3D("capture_product_3d_snapshot"); return false; }
    if (!state.stream || state.busy) return false;
    var video = elements["product-3d-camera-video"];
    var analysis = analyzeSource(video, sourceKind || "camera_still");
    analysis.direction = state.bottomMode ? "bottom" : state.currentDirection;
    analysis.label = direction(analysis.direction).label;
    applyCaptureContextChecks(analysis);
    if (!analysis.accepted) {
      state.failures += 1;
      state.analyses.push(analysis);
      if (state.failures >= 3) proposeVideoIfNeeded();
      renderAll(); return false;
    }
    state.busy = true;
    elements["product-3d-snapshot"].disabled = true;
    var pendingPath = null;
    try {
      var blob = await sourceToJpeg(video);
      var blobSha256 = await contentSha256(blob);
      var path = captureStoragePath(analysis.direction);
      var upload = await sb.storage.from(BUCKET).upload(path, blob, {
        contentType: "image/jpeg",
        upsert: false,
        metadata: { sha256: blobSha256 }
      });
      if (upload.error) throw upload.error;
      pendingPath = path;
      var registration = await registerAnalysis(analysis, path, blobSha256);
      if (registration.duplicate) {
        var duplicateRemoval = await sb.storage.from(BUCKET).remove([path]);
        if (duplicateRemoval.error) throw duplicateRemoval.error;
        pendingPath = null;
        state.failures += 1;
        setLiveFeedback(["同じ画像は保存しません。別の方向へ移動してください"], false);
        if (state.failures >= 3) proposeVideoIfNeeded();
        renderAll(); return false;
      }
      pendingPath = null;
      state.failures = 0;
      state.lastAcceptedAt = Date.now();
      state.currentDirection = nextDirection();
      setLiveFeedback([direction(state.currentDirection).label + "へ移動してください"], true);
      renderAll(); return true;
    } catch (error) {
      if (pendingPath) {
        var removal = await sb.storage.from(BUCKET).remove([pendingPath]);
        if (removal.error) console.warn("orphan product 3D source cleanup failed", removal.error);
      }
      state.failures += 1;
      setLiveFeedback(["保存できませんでした: " + friendlyError(error)], false);
      return false;
    } finally {
      state.busy = false;
      elements["product-3d-snapshot"].disabled = !state.stream;
    }
  }
  function sourceToJpeg(source) {
    return new Promise(function (resolve, reject) {
      var sw = source.videoWidth || source.naturalWidth || source.width;
      var sh = source.videoHeight || source.naturalHeight || source.height;
      var scale = Math.min(1, MAX_CAPTURE_EDGE / Math.max(sw, sh));
      var canvas = document.createElement("canvas");
      canvas.width = Math.round(sw * scale); canvas.height = Math.round(sh * scale);
      canvas.getContext("2d").drawImage(source, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(function (blob) { blob ? resolve(blob) : reject(new Error("画像の作成に失敗しました")); }, "image/jpeg", 0.91);
    });
  }
  function captureStoragePath(directionId) {
    var model = state.workspace.model;
    return "source/dkd_" + productId(state.product) + "/" + state.kind + "/model_" + model.id + "/" +
      Date.now() + "_" + directionId + "_" + crypto.randomUUID().slice(0, 8) + ".jpg";
  }
  async function registerAnalysis(analysis, storagePath, contentSha) {
    var response = await sb.rpc("register_product_3d_capture", {
      target_model_id: state.workspace.model.id,
      target_core_product_image_id: analysis.coreProductImageId || null,
      target_storage_path: storagePath,
      target_source_kind: analysis.sourceKind,
      target_direction: analysis.direction,
      target_quality_metrics: {
        score: analysis.score, sharpness: analysis.sharpness, brightness: analysis.brightness,
        clipped: analysis.clipped, reflection_ratio: analysis.reflectionRatio,
        neutral_bright_ratio: analysis.neutralBrightRatio,
        source_width: analysis.sourceWidth, source_height: analysis.sourceHeight,
        perceptual_hash: analysis.hash,
        browser_analyzer_version: "pilot-2"
      },
      target_silhouette: analysis.silhouette,
      target_content_sha256: contentSha,
      target_captured_at: new Date().toISOString()
    });
    if (response.error) throw response.error;
    if (response.data && response.data.duplicate) {
      analysis.accepted = false;
      analysis.duplicate = true;
      analysis.issues = Array.isArray(analysis.issues) ? analysis.issues : [];
      analysis.issues.push("同じ画像はすでに登録済みです");
      state.analyses.push(analysis);
      return { duplicate: true };
    }
    analysis.accepted = true; analysis.registered = true; analysis.storagePath = storagePath;
    if (analysis.hash && state.hashes.indexOf(analysis.hash) < 0) state.hashes.push(analysis.hash);
    state.analyses.push(analysis);
    state.workspace.model = response.data.model;
    return { duplicate: false };
  }
  async function contentSha256(blob) {
    var digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
    return Array.from(new Uint8Array(digest)).map(function (byte) { return byte.toString(16).padStart(2, "0"); }).join("");
  }

  function proposeVideoIfNeeded() {
    if (!state.stream || coveredDirections().length >= MIN_CAPTURES) return;
    elements["product-3d-video-supplement"].hidden = false;
    setLiveFeedback(["不足方向が続いています。「動画で補完」で鮮明なフレームだけを抽出できます"], false);
  }
  function toggleVideoSupplement() {
    if (!canManage3D()) { deny3D("supplement_product_3d_video"); return; }
    if (!state.stream) { startCamera(); return; }
    state.videoMode = !state.videoMode;
    elements["product-3d-video-supplement"].classList.toggle("active", state.videoMode);
    elements["product-3d-video-supplement"].textContent = state.videoMode ? "動画補完を停止" : "動画で補完";
    if (state.videoTimer) window.clearInterval(state.videoTimer);
    state.videoTimer = null;
    if (state.videoMode) {
      setLiveFeedback(["商品またはカメラをゆっくり回してください。動画自体は保存しません"], true);
      state.videoTimer = window.setInterval(async function () {
        if (!state.busy && coveredDirections().length < RECOMMENDED_CAPTURES) {
          await captureSnapshot("video_frame");
        }
      }, VIDEO_SAMPLE_INTERVAL_MS);
    }
  }
  function toggleBottomMode() {
    if (!canManage3D()) { deny3D("set_product_3d_bottom_mode"); return; }
    state.bottomMode = !state.bottomMode;
    state.currentDirection = state.bottomMode ? "bottom" : nextDirection();
    elements["product-3d-bottom-mode"].classList.toggle("active", state.bottomMode);
    elements["product-3d-bottom-mode"].textContent = state.bottomMode ? "通常方向へ戻る" : "反転して底面";
    drawGuide(state.guide);
  }

  async function submitWorkspace() {
    if (!canManage3D()) { deny3D("submit_product_3d_model"); return; }
    if (!state.workspace || state.busy || coveredDirections().length < MIN_CAPTURES) return;
    state.busy = true; renderAll();
    try {
      var response = await sb.rpc("submit_product_3d_model", { target_model_id: state.workspace.model.id });
      if (response.error) throw response.error;
      state.workspace.model = response.data.model;
      delete internalModelCache[String(productId(state.product))];
      setStatus("生成待機へ登録しました。Windows処理端末が安全に引き継ぎます。", "success");
      stopCamera(); renderAll();
    } catch (error) {
      setStatus("生成依頼に失敗しました: " + friendlyError(error), "error");
    } finally { state.busy = false; renderAll(); }
  }

  function drawGuide(sample) {
    var canvas = elements["product-3d-guide-canvas"];
    var stage = elements["product-3d-camera-stage"];
    if (!canvas || !stage) return;
    var rect = stage.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(rect.width * dpr)); canvas.height = Math.max(1, Math.round(rect.height * dpr));
    canvas.style.width = rect.width + "px"; canvas.style.height = rect.height + "px";
    var ctx = canvas.getContext("2d"); ctx.scale(dpr, dpr);
    var acceptedGuides = state.analyses.filter(function (a) { return a.accepted && a.silhouette; });
    var guide = acceptedGuides.length >= MIN_CAPTURES
      ? (acceptedGuides.find(function (a) { return a.direction === state.currentDirection; }) || acceptedGuides[0])
      : acceptedGuides[0];
    var box = guide && guide.silhouette || { x: 0.18, y: 0.18, width: 0.64, height: 0.64 };
    var x = box.x * rect.width, y = box.y * rect.height, w = box.width * rect.width, h = box.height * rect.height;
    ctx.fillStyle = "rgba(45, 212, 191, 0.08)"; ctx.strokeStyle = sample && sample.accepted ? "#4ade80" : "#2dd4bf";
    ctx.lineWidth = 2; ctx.setLineDash([10, 7]); ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(rect.width / 2 - 18, rect.height / 2); ctx.lineTo(rect.width / 2 + 18, rect.height / 2);
    ctx.moveTo(rect.width / 2, rect.height / 2 - 18); ctx.lineTo(rect.width / 2, rect.height / 2 + 18); ctx.stroke();
    if (sample && sample.silhouette) {
      var s = sample.silhouette; ctx.strokeStyle = "rgba(255,255,255,.75)"; ctx.strokeRect(s.x * rect.width, s.y * rect.height, s.width * rect.width, s.height * rect.height);
    }
    var liveBox = sample && sample.silhouette;
    var sizeText = liveBox ? Math.round(Math.max(liveBox.width, liveBox.height) * 100) + "%" : "-";
    var tiltText = liveBox ? Math.round(liveBox.tilt || 0) + "°" : "-";
    elements["product-3d-direction-callout"].textContent = "次: " + direction(state.currentDirection).label + " / 大きさ " + sizeText + " / 傾き " + tiltText;
  }

  function renderAll() { renderDial(); renderAnalysis(); renderQuality(); renderSubmit(); }
  function renderDial() {
    var covered = coveredDirections();
    elements["product-3d-capture-count"].textContent = state.analyses.filter(function (a) { return a.accepted; }).length + " / " + RECOMMENDED_CAPTURES;
    elements["product-3d-capture-dial"].innerHTML = DIRECTIONS.map(function (row) {
      var cls = covered.indexOf(row.id) >= 0 ? "covered" : (row.id === state.currentDirection ? "next" : "");
      return "<button type='button' class='product-3d-direction " + cls + "' data-direction='" + row.id + "'><span></span>" + esc(row.label) + "</button>";
    }).join("");
  }
  function renderAnalysis() {
    var rows = state.analyses.slice(-14).reverse();
    elements["product-3d-analysis-results"].innerHTML = rows.length ? rows.map(function (row) {
      return "<div class='product-3d-analysis-row " + (row.accepted ? "accepted" : "rejected") + "'><span>" + (row.accepted ? "✓" : "!") + "</span><div><strong>" + esc(row.label || direction(row.direction).label) + "</strong><small>" + esc(row.accepted ? ("品質 " + (row.score || "-") + " / " + direction(row.direction).label) : (row.issues || []).join("・")) + "</small></div></div>";
    }).join("") : "<p>解析対象の画像はまだありません。</p>";
  }
  function renderQuality() {
    var recent = state.analyses[state.analyses.length - 1];
    elements["product-3d-quality-score"].textContent = recent && recent.score != null ? recent.score + " / 100" : "-";
    var issues = recent && recent.issues && recent.issues.length ? recent.issues : ["枠内で商品全体が鮮明に見えるようにします", "金属反射は照明の角度をずらして抑えます"];
    elements["product-3d-quality-list"].innerHTML = issues.map(function (issue) { return "<li>" + esc(issue) + "</li>"; }).join("");
  }
  function renderSubmit() {
    var covered = coveredDirections().length;
    var model = state.workspace && state.workspace.model;
    var terminal = model && ["waiting", "processing", "review", "published"].indexOf(model.status) >= 0;
    elements["product-3d-submit"].disabled = state.busy || covered < MIN_CAPTURES || terminal;
    if (!terminal) elements["product-3d-submit-status"].textContent = captureReadinessText();
  }
  function captureReadinessText() {
    var count = state.analyses.filter(function (a) { return a.accepted; }).length;
    var dirs = coveredDirections().length;
    if (dirs < MIN_CAPTURES) return "あと " + (MIN_CAPTURES - dirs) + "方向必要です（有効画像 " + count + "枚）。";
    if (count < RECOMMENDED_CAPTURES) return "生成可能です。精度向上には " + (RECOMMENDED_CAPTURES - count) + "枚程度追加してください。";
    return "推奨枚数が揃いました。3D生成を依頼できます。";
  }
  function setStatus(text, type) {
    var node = elements["product-3d-submit-status"]; node.textContent = text; node.dataset.status = type || "";
  }
  function setLiveFeedback(messages, good) {
    elements["product-3d-live-feedback"].classList.toggle("good", !!good);
    elements["product-3d-live-feedback"].textContent = messages.join(" / ");
  }
  function friendlyError(error) { return String(error && (error.message || error.error_description) || error || "不明なエラー"); }
  async function edgeErrorMessage(error) {
    try {
      if (error && error.context && typeof error.context.json === "function") {
        var body = await error.context.json();
        if (body && typeof body.error === "string") return body.error;
      }
    } catch (_) { /* Keep the original transport error. */ }
    return friendlyError(error);
  }

  async function fetchPublishedModels(dkdId) {
    if (!dkdId || !sessionModelsEnabled) return [];
    var key = String(dkdId);
    if (modelCache[key]) return modelCache[key];
    var epoch = modelCacheEpoch;
    var result = await sb.from("product_3d_viewer_models")
      .select("id,dkd_shohin_id,product_kind,revision,status,published_model_path,thumbnail_path,model_bytes,triangle_count,published_at,model_source,model_format")
      .eq("dkd_shohin_id", dkdId).order("revision", { ascending: false });
    if (epoch !== modelCacheEpoch || !sessionModelsEnabled) return [];
    if (result.error) {
      // During a phased release the old generated-model viewer remains usable.
      result = await sb.from("product_3d_models")
        .select("id,dkd_shohin_id,product_kind,revision,status,published_model_path,thumbnail_path,model_bytes,triangle_count,published_at")
        .eq("dkd_shohin_id", dkdId).eq("status", "published").order("revision", { ascending: false });
      if (epoch !== modelCacheEpoch || !sessionModelsEnabled) return [];
      if (result.error) throw new Error("3Dモデルを確認できませんでした。3Dタブを開き直してください。");
      modelCache[key] = (result.data || []).map(function (row) {
        return Object.assign({ model_source: "generated", model_format: "glb" }, row);
      });
    } else modelCache[key] = result.data || [];
    return modelCache[key];
  }
  function normalizeUploadedModel(row) {
    return {
      id: "uploaded:" + row.id, dkd_shohin_id: row.dkd_shohin_id,
      product_kind: row.product_kind, revision: 1, status: "published",
      published_model_path: row.storage_path, model_bytes: row.model_bytes,
      published_at: row.created_at, updated_at: row.updated_at,
      model_source: row.model_source === "generated" ? "generated" : "uploaded", model_format: "glb"
    };
  }
  async function fetchInternalModels(dkdId) {
    if (!dkdId || !sessionModelsEnabled) return [];
    var key = String(dkdId);
    if (internalModelCache[key]) return internalModelCache[key];
    var epoch = modelCacheEpoch;
    var result = await sb.from("product_3d_models")
      .select("id,dkd_shohin_id,product_kind,revision,status,published_model_path,thumbnail_path,model_bytes,triangle_count,published_at,additional_capture_instructions,failure_message,updated_at")
      .eq("dkd_shohin_id", dkdId).order("revision", { ascending: false });
    if (epoch !== modelCacheEpoch || !sessionModelsEnabled) return [];
    if (result.error) console.warn("internal generated 3D lookup failed", result.error);
    var uploads = await sb.from("product_3d_uploaded_models")
      .select("id,dkd_shohin_id,product_kind,status,storage_path,model_bytes,created_at,updated_at,model_source")
      .eq("dkd_shohin_id", dkdId).eq("status", "ready");
    if (epoch !== modelCacheEpoch || !sessionModelsEnabled) return [];
    if (uploads.error) console.warn("internal uploaded 3D lookup failed", uploads.error);
    if (result.error && uploads.error) throw new Error("3Dモデルを確認できませんでした。3Dタブを開き直してください。");
    var models = (result.data || []).map(function (row) {
      return Object.assign({ model_source: "generated", model_format: "glb" }, row);
    }).concat((uploads.data || []).map(normalizeUploadedModel));
    // A partial lookup is usable but must not cache an outage as an empty list.
    if (!result.error && !uploads.error) internalModelCache[key] = models;
    return models;
  }
  async function refreshMediaAvailability(context) {
    if (!sessionModelsEnabled) return;
    if (!Object.prototype.hasOwnProperty.call(mediaAvailabilityRequest, context)) return;
    var request = ++mediaAvailabilityRequest[context];
    var target = selectedTarget(context);
    var dkdId = productId(target.product);
    var pane = document.querySelector("[data-product-media-pane='model'][data-product-media-context='" + context + "']");
    var switcher = pane && pane.parentElement && pane.parentElement.querySelector(".product-media-switch");
    if (!pane || !switcher) return;
    function hideStaleMedia() {
      var staleTab = switcher.querySelector("[data-product-media='model']");
      if (staleTab) { staleTab.hidden = true; staleTab.classList.remove("active"); staleTab.setAttribute("aria-selected", "false"); }
      pane.hidden = true;
      var photosTab = switcher.querySelector("[data-product-media='photos']");
      var photosPane = pane.parentElement.querySelector("[data-product-media-pane='photos']");
      if (photosTab) { photosTab.classList.add("active"); photosTab.setAttribute("aria-selected", "true"); }
      if (photosPane) photosPane.hidden = false;
      var mediaShell = switcher.closest("[data-product-3d-media-shell]");
      if (mediaShell && mediaShell.dataset.noPhotos === "true") mediaShell.hidden = true;
      var staleHost = el({ sales: "sales-product-3d-list", production: "production-product-3d-list", customer: "customer-product-3d-list" }[context]);
      if (staleHost) staleHost.textContent = "";
    }
    if (!dkdId) { hideStaleMedia(); return; }
    var internal = context !== "customer" && canReview3D();
    var models = [], lookupFailed = false;
    try { models = internal ? await fetchInternalModels(dkdId) : await fetchPublishedModels(dkdId); }
    catch (error) { lookupFailed = true; }
    var current = selectedTarget(context);
    if (request !== mediaAvailabilityRequest[context] || productId(current.product) !== dkdId ||
        (context !== "customer" && current.kind !== target.kind) || !pane.isConnected || !sessionModelsEnabled) return;
    if (internal !== (context !== "customer" && canReview3D())) {
      hideStaleMedia();
      return;
    }
    var available = context === "customer"
      ? models.length > 0
      : models.some(function (model) { return model.product_kind === target.kind; }) || (canManage3D() && !!target.kind);
    if (lookupFailed && !available) { hideStaleMedia(); return; }
    var tab = switcher.querySelector("[data-product-media='model']");
    if (available && !tab) {
      tab = document.createElement("button");
      tab.type = "button";
      tab.className = "product-media-switch-btn";
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-selected", "false");
      tab.dataset.productMedia = "model";
      tab.dataset.productMediaContext = context;
      tab.textContent = "3Dで見る";
      switcher.appendChild(tab);
    }
    if (tab) tab.hidden = !available;
    var mediaShell = switcher.closest("[data-product-3d-media-shell]");
    if (mediaShell && mediaShell.dataset.noPhotos === "true") mediaShell.hidden = !available;
    if (!available && !pane.hidden) {
      pane.hidden = true;
      if (tab) { tab.classList.remove("active"); tab.setAttribute("aria-selected", "false"); }
      var photos = switcher.querySelector("[data-product-media='photos']");
      var photoPane = pane.parentElement.querySelector("[data-product-media-pane='photos']");
      if (photos) { photos.classList.add("active"); photos.setAttribute("aria-selected", "true"); }
      if (photoPane) photoPane.hidden = false;
    }
    if (available && !pane.hidden) await renderMediaPane(context);
  }
  function visibleProductNodes() {
    return Array.from(document.querySelectorAll("#list [data-dkd-id], #production-list [data-dkd-id], [data-customer-catalog-dkd]"));
  }
  async function refreshListBadges() {
    if (!sessionModelsEnabled) return;
    var epoch = modelCacheEpoch;
    var nodes = visibleProductNodes();
    var ids = Array.from(new Set(nodes.map(function (node) {
      return Number(node.dataset.dkdId || node.dataset.customerCatalogDkd);
    }).filter(Boolean)));
    var missing = ids.filter(function (id) { return !Object.prototype.hasOwnProperty.call(modelBadgeCache, String(id)); });
    if (missing.length) {
      var batch = missing.slice(0, 300);
      var result = await sb.from("product_3d_viewer_models").select("dkd_shohin_id").in("dkd_shohin_id", batch);
      if (result.error) result = await sb.from("product_3d_models")
        .select("dkd_shohin_id").eq("status", "published").in("dkd_shohin_id", batch);
      if (epoch !== modelCacheEpoch || !sessionModelsEnabled) return;
      if (!result.error) {
        batch.forEach(function (id) { modelBadgeCache[String(id)] = false; });
        (result.data || []).forEach(function (row) { modelBadgeCache[String(row.dkd_shohin_id)] = true; });
        if (missing.length > batch.length) scheduleBadgeRefresh();
      }
    }
    nodes.forEach(function (node) {
      var id = String(node.dataset.dkdId || node.dataset.customerCatalogDkd || "");
      var badge = node.querySelector(".product-3d-has-badge");
      if (modelBadgeCache[id]) {
        if (!badge) {
          badge = document.createElement("span"); badge.className = "product-3d-has-badge"; badge.textContent = "3Dあり";
          var host = node.querySelector(".card-media, .production-label-row, .customer-catalog-item-copy") || node;
          host.appendChild(badge);
        }
      } else if (badge) badge.remove();
    });
  }
  function scheduleBadgeRefresh() {
    if (badgeRefreshTimer) window.clearTimeout(badgeRefreshTimer);
    badgeRefreshTimer = window.setTimeout(refreshListBadges, 120);
  }
  async function renderMediaPane(context) {
    if (!sessionModelsEnabled) return;
    if (!Object.prototype.hasOwnProperty.call(mediaPaneRequest, context)) return;
    var request = ++mediaPaneRequest[context];
    var target = selectedTarget(context);
    var dkdId = productId(target.product);
    var epoch = modelCacheEpoch;
    var hostId = { sales: "sales-product-3d-list", production: "production-product-3d-list", customer: "customer-product-3d-list" }[context];
    var host = el(hostId);
    if (!host) return;
    if (!target.product) { host.textContent = ""; return; }
    host.innerHTML = "<div class='product-3d-loading-card'>3Dモデルを確認しています…</div>";
    var internal = context !== "customer" && canReview3D();
    var manageable = context !== "customer" && !!target.kind && canManage3D();
    var glbManageable = context !== "customer" && !!target.kind && canManageGlb();
    var publishable = context !== "customer" && canPublish3D();
    var models = [], lookupFailed = false;
    try { models = internal ? await fetchInternalModels(dkdId) : await fetchPublishedModels(dkdId); }
    catch (error) { lookupFailed = true; }
    var current = selectedTarget(context);
    if (request !== mediaPaneRequest[context] || epoch !== modelCacheEpoch || !sessionModelsEnabled ||
        productId(current.product) !== dkdId ||
        (context !== "customer" && current.kind !== target.kind) || !host.isConnected) return;
    if (internal !== (context !== "customer" && canReview3D()) ||
        manageable !== (context !== "customer" && !!current.kind && canManage3D()) ||
        glbManageable !== (context !== "customer" && !!current.kind && canManageGlb()) ||
        publishable !== (context !== "customer" && canPublish3D())) {
      host.textContent = "表示条件が変わりました。3Dタブを開き直してください。";
      return;
    }
    var localPreviewAction = glbManageable
      ? "<button type='button' class='product-3d-card-action' data-local-glb='" + context + "'>GLBをプレビュー（登録しない）</button>"
      : "";
    if (lookupFailed) {
      host.innerHTML = "<div class='product-3d-empty-card'>3Dモデルを確認できませんでした。3Dタブを開き直してください。" + localPreviewAction + "</div>";
      return;
    }
    var visible = context === "customer" ? models : models.filter(function (model) { return model.product_kind === target.kind; });
    var tripoConnection = glbManageable
      ? "<div class='product-3d-empty-card'><button type='button' data-tripo-readiness='" + context + "'>Tripo接続確認（クレジット消費なし）</button><span data-tripo-readiness-status role='status'>画像送信・3D生成は行いません。</span><button type='button' data-tripo-3d='" + context + "'>保存済み画像を確認・3D作成の準備</button></div>"
      : "";
    var hunyuanConnection = glbManageable && dkdId === 2639 && target.kind === "aftermarket_new"
      ? "<div class='product-3d-empty-card'><strong>" + esc(t("product_3d_hunyuan_title")) + "</strong>" +
        "<span>" + esc(t("product_3d_hunyuan_notice")) + "</span>" +
        "<button type='button' data-hunyuan-readiness='" + context + "'" + (hunyuanReadinessBusy ? " disabled" : "") + ">" +
        esc(t("product_3d_hunyuan_check")) + "</button><span data-hunyuan-readiness-status role='status' aria-live='polite'></span></div>"
      : "";
    if (!visible.length) {
      var createAction = manageable ? "<button type='button' data-create-3d='" + context + "'>3Dモデルを作成</button>" : "";
      var uploadAction = glbManageable ? "<button type='button' data-upload-3d='" + context + "'>GLBをアップロード</button>" : "";
      host.innerHTML = "<div class='product-3d-empty-card'><span class='product-3d-cube'>3D</span><strong>公開済み3Dモデルはありません</strong>" + createAction + uploadAction + localPreviewAction + "</div>" + tripoConnection + hunyuanConnection;
      return;
    }
    function modelCardHtml(model) {
      var size = model.model_bytes ? (model.model_bytes / 1048576).toFixed(1) + " MB" : "";
      var status = modelStatusLabel(model.status);
      var canOpen = model.published_model_path && (model.status === "published" || model.status === "review" || model.status === "archived");
      var glbAsset = typeof model.id === "string" && model.id.indexOf("uploaded:") === 0;
      var action = canOpen ? "<button type='button' class='product-3d-card-action' data-open-model='" + model.id + "' data-model-context='" + context + "' data-model-product='" + productId(target.product) + "'>3Dで見る</button>" : "";
      if (publishable && !glbAsset && model.status === "review") action += "<button type='button' class='product-3d-card-action publish' data-publish-model='" + model.id + "' data-publish-context='" + context + "'>公開</button>";
      if (glbManageable && glbAsset) {
        action += "<button type='button' class='product-3d-card-action' data-replace-uploaded='" + model.id.slice(9) + "' data-upload-context='" + context + "'>差し替え</button>";
        action += "<button type='button' class='product-3d-card-action' data-delete-uploaded='" + model.id.slice(9) + "' data-upload-context='" + context + "'>削除</button>";
      }
      if (manageable && !glbAsset && ["draft", "needs_capture", "failed"].indexOf(model.status) >= 0) action += "<button type='button' class='product-3d-card-action' data-create-3d='" + context + "'>撮影を再開</button>";
      var note = model.failure_message || (model.additional_capture_instructions && model.additional_capture_instructions.length ? "追加撮影: " + model.additional_capture_instructions.join(" / ") : "");
      var source = model.model_source === "uploaded" ? "外部GLB" : (glbAsset ? "Tripo生成" : "D-CATS生成");
      return "<div class='product-3d-model-card'><span class='product-3d-cube'>3D</span><span><strong>" + esc(kindLabel(model.product_kind)) + " 3Dモデル <i data-model-status='" + esc(model.status) + "'>" + esc(status) + "</i></strong><small>" + source + " / " + size + (note ? " / " + esc(note) : "") + "</small></span><span class='product-3d-card-actions'>" + action + "</span></div>";
    }
    if (context === "customer") {
      host.innerHTML = ["rebuilt", "aftermarket_new"].map(function (kind) {
        var grouped = visible.filter(function (model) { return model.product_kind === kind; });
        var body = grouped.length
          ? grouped.map(modelCardHtml).join("")
          : "<div class='product-3d-kind-empty'>公開済み3Dモデルはありません</div>";
        return "<section class='product-3d-kind-group " + esc(kind) + "'><div class='product-3d-kind-group-head'><strong>" + esc(kindLabel(kind)) + "</strong><span>" + grouped.length + " 件</span></div><div class='product-3d-kind-group-list'>" + body + "</div></section>";
      }).join("");
      return;
    }
    var failedGeneration = visible.some(function (model) { return model.model_source !== "uploaded" && model.status === "failed"; });
    var usableAlternative = visible.some(function (model) {
      return !!model.published_model_path && ["published", "review"].indexOf(model.status) >= 0;
    });
    var fallback = failedGeneration && !usableAlternative && glbManageable
      ? "<div class='product-3d-empty-card'>3Dモデルを生成できませんでした。GLBファイルをアップロードしてください。</div>"
      : "";
    var uploadAction = glbManageable
      ? "<button type='button' class='product-3d-card-action' data-upload-3d='" + context + "'>GLBをアップロード</button>"
      : "";
    host.innerHTML = fallback + visible.map(modelCardHtml).join("") + uploadAction + localPreviewAction + tripoConnection + hunyuanConnection;
  }
  function modelStatusLabel(status) {
    return ({ draft: "撮影途中", waiting: "待機", processing: "処理中", needs_capture: "要追加撮影", failed: "失敗", review: "確認待ち", published: "公開済み", archived: "旧版" })[status] || status;
  }
  async function publishModel(modelId, context) {
    if (!canPublish3D()) { deny3D("publish_product_3d_model"); return; }
    if (!window.confirm("確認中の3Dモデルを得意先にも公開します。公開してよろしいですか？")) return;
    var epoch = modelCacheEpoch;
    var result = await sb.rpc("publish_product_3d_model", { target_model_id: Number(modelId) });
    if (epoch !== modelCacheEpoch || !sessionModelsEnabled) return;
    if (result.error) { alert("3Dモデルを公開できませんでした: " + friendlyError(result.error)); return; }
    var dkdId = String(result.data.dkd_shohin_id);
    delete modelCache[dkdId]; delete internalModelCache[dkdId]; delete modelBadgeCache[dkdId];
    await renderMediaPane(context || "sales"); scheduleBadgeRefresh();
  }
  function clearModelCaches(dkdId) {
    var key = String(dkdId);
    delete modelCache[key]; delete internalModelCache[key]; delete modelBadgeCache[key];
  }
  async function checkTripoReadiness(context, button) {
    if (!sessionModelsEnabled || !button || button.disabled ||
        ["sales", "production"].indexOf(context) < 0) return;
    if (!canManageGlb()) { deny3D("product_3d_tripo_readiness"); return; }
    var target = selectedTarget(context);
    var id = productId(target.product);
    if (!id || !target.kind) return;
    var epoch = modelCacheEpoch;
    var paneRequest = mediaPaneRequest[context];
    var status = button.parentElement && button.parentElement.querySelector("[data-tripo-readiness-status]");
    if (!status || !button.isConnected) return;
    function stillCurrent() {
      var current = selectedTarget(context);
      return sessionModelsEnabled && epoch === modelCacheEpoch && button.isConnected &&
        paneRequest === mediaPaneRequest[context] && canManageGlb() &&
        productId(current.product) === id && current.kind === target.kind;
    }
    function connectionFailure(data) {
      var messages = {
        key_format: "Tripo APIキーの保存形式に問題があります。サーバー設定を確認してください。",
        authentication: "TripoでAPIキーの認証が拒否されました。キーの有効状態とサーバー設定を確認してください。",
        permission: "Tripo側で残高照会が許可されませんでした。追加購入せず管理者に確認してください。",
        rate_limit: "Tripoの接続回数制限に達しました。連打せず、時間を置いて確認してください。",
        provider_unavailable: "Tripo側でサービスエラーが発生しました。時間を置いて確認してください。",
        timeout: "Tripo残高照会が時間切れになりました。接続成功は未確認です。",
        network: "Tripoへの通信を完了できませんでした。サーバー側の接続状況を確認してください。",
        invalid_response: "Tripoの残高応答を読み取れませんでした。管理者によるAPI仕様の確認が必要です。",
        provider_rejected: "Tripoが残高照会を拒否しました。管理者による応答コードの確認が必要です。"
      };
      var category = data && data.diagnostic && data.diagnostic.category;
      if (data && data.configured === true && data.connection_status === "unavailable" &&
          typeof data.generation_enabled === "boolean" && typeof category === "string" &&
          Object.prototype.hasOwnProperty.call(messages, category)) {
        return messages[category] + "画像送信・生成は開始していません。";
      }
      return "Tripo接続を確認できませんでした。画像送信・生成は開始していません。";
    }
    button.disabled = true;
    status.textContent = "接続・残高を確認中です。画像送信・生成は開始しません。";
    try {
      var result = await sb.functions.invoke("product-3d-tripo-readiness", { body: {
        action: "readiness", product_id: id, product_kind: target.kind
      } });
      if (!stillCurrent()) return;
      if (result.error) {
        // Supabase FunctionsHttpError carries the Response, not its JSON in data.
        // Never render an exception message, provider body or arbitrary category.
        var errorData = null;
        var response = result.error.context;
        if (response && response.status === 502 && typeof response.json === "function") {
          try { errorData = await response.json(); } catch (_) { /* Safe generic fallback. */ }
        }
        if (!stillCurrent()) return;
        status.textContent = connectionFailure(errorData);
        return;
      }
      var data = result.data || {};
      if (data.connection_status === "not_configured" && data.configured === false) {
        status.textContent = "Tripo APIキーが未設定です。システム管理者がサーバー側に設定してください。";
      } else if (data.connection_status === "connected" && data.configured === true &&
          typeof data.balance === "number" && Number.isFinite(data.balance) && data.balance >= 0 &&
          typeof data.generation_enabled === "boolean") {
        status.textContent = "Tripo接続済み / 残高 " + data.balance + " クレジット。" +
          (data.generation_enabled === true ? "生成は開始していません。" : "3D生成はまだ無効です。") +
          (data.has_sufficient_credits === false ? "生成の見積りに対して残高が不足しています。" : "");
      } else throw new Error("Invalid connection status");
    } catch (_) {
      if (stillCurrent()) status.textContent = "Tripo接続を確認できませんでした。画像送信・生成は開始していません。";
    } finally { if (button.isConnected) button.disabled = false; }
  }
  async function checkHunyuanReadiness(context, button) {
    if (!sessionModelsEnabled || hunyuanReadinessBusy || !button || button.disabled ||
        ["sales", "production"].indexOf(context) < 0) return;
    if (!canManageGlb()) { deny3D("product_3d_hunyuan_readiness"); return; }
    var target = selectedTarget(context);
    if (productId(target.product) !== 2639 || target.kind !== "aftermarket_new") return;
    var epoch = modelCacheEpoch;
    var paneRequest = mediaPaneRequest[context];
    var status = button.parentElement && button.parentElement.querySelector("[data-hunyuan-readiness-status]");
    if (!status || !button.isConnected) return;
    function stillCurrent() {
      var current = selectedTarget(context);
      return sessionModelsEnabled && epoch === modelCacheEpoch && button.isConnected &&
        paneRequest === mediaPaneRequest[context] && canManageGlb() &&
        productId(current.product) === 2639 && current.kind === "aftermarket_new";
    }
    function setBusy(busy) {
      hunyuanReadinessBusy = busy;
      document.querySelectorAll("[data-hunyuan-readiness]").forEach(function (node) { node.disabled = busy; });
    }
    setBusy(true);
    status.textContent = t("product_3d_hunyuan_working");
    try {
      var result = await sb.functions.invoke("product-3d-hunyuan-readiness", { body: {
        action: "check_connection", consent: "query-only-no-product-data"
      } });
      if (!stillCurrent()) return;
      if (result.error) {
        // Never read/echo provider bodies, secret values or arbitrary exceptions.
        var httpStatus = result.error.context && result.error.context.status;
        status.textContent = t(httpStatus === 401 ? "product_3d_hunyuan_session" :
          (httpStatus === 403 ? "product_3d_hunyuan_denied" : "product_3d_hunyuan_failed"));
        return;
      }
      var data = result.data || {};
      if (data.generation_enabled !== false || data.authentication_verified !== false ||
          typeof data.configured !== "boolean") throw new Error("Invalid readiness response");
      var messages = {
        provider_response_received_unverified: "product_3d_hunyuan_response",
        authentication_rejected: "product_3d_hunyuan_auth",
        permission_denied: "product_3d_hunyuan_permission",
        invalid_credentials: "product_3d_hunyuan_invalid",
        timeout: "product_3d_hunyuan_timeout",
        provider_http_error: "product_3d_hunyuan_failed",
        provider_invalid_response: "product_3d_hunyuan_failed",
        provider_unexpected_response: "product_3d_hunyuan_failed",
        runtime_unavailable: "product_3d_hunyuan_failed",
        invalid_clock: "product_3d_hunyuan_failed",
        check_failed: "product_3d_hunyuan_failed"
      };
      if (data.configured === false && data.status === "not_configured") {
        status.textContent = t("product_3d_hunyuan_missing");
      } else if (data.configured === true && typeof data.status === "string" &&
          Object.prototype.hasOwnProperty.call(messages, data.status)) {
        status.textContent = t(messages[data.status]);
      } else throw new Error("Invalid readiness status");
    } catch (_) {
      if (stillCurrent()) status.textContent = t("product_3d_hunyuan_failed");
    } finally { setBusy(false); }
  }
  function sameTripoTarget(requestId) {
    if (!tripoTarget || !sessionModelsEnabled || requestId !== tripoRequestId) return false;
    var current = selectedTarget(tripoTarget.context);
    return productId(current.product) === tripoTarget.productId &&
      current.kind === (tripoTarget.originKind || tripoTarget.kind) &&
      ["rebuilt", "aftermarket_new"].includes(tripoTarget.kind) && canManageGlb();
  }
  function tripoStatus(text) { elements["product-3d-tripo-status"].textContent = text; }
  function canStartTripoJob() {
    return tripoHistoryReady && canManageGlb() && !(tripoJob && tripoJob.start_allowed === false) &&
      ["none", "failed", "cancelled", "rejected", "published"].includes(tripoJob && tripoJob.status || "none");
  }
  function renderTripoJob() {
    var status = tripoJob && tripoJob.status || "none";
    var names = { none: "未作成", reserved: "開始確認中", submitted: "生成を依頼済み", processing: "生成中",
      collecting: "生成GLBを保管中（長時間変わらない場合は管理者へ）",
      review: "非公開の確認待ち", publishing: "商品への登録確認中", published: "商品への登録済み",
      failed: "生成失敗", cancelled: "生成中止", held: "結果確認が必要（再実行しないでください）", rejected: "不採用" };
    tripoStatus("Tripo作成状態: " + (names[status] || status) +
      (tripoJob && tripoJob.credits_consumed != null ? " / 使用 " + tripoJob.credits_consumed + " クレジット" : ""));
    elements["product-3d-tripo-start"].hidden = !canStartTripoJob() || !Object.keys(tripoImageRows).length;
    elements["product-3d-tripo-poll"].hidden = !tripoHistoryReady ||
      !["reserved", "submitted", "processing", "collecting", "publishing", "held"].includes(status);
    elements["product-3d-tripo-preview"].hidden = !tripoHistoryReady || status !== "review";
    elements["product-3d-tripo-publish"].hidden = !tripoHistoryReady || status !== "review" || !canPublish3D() || tripoJob.publish_allowed === false;
    elements["product-3d-tripo-reject"].hidden = !tripoHistoryReady || status !== "review" || tripoJob.reject_allowed === false;
  }
  async function tripoInvoke(payload) {
    var result = await sb.functions.invoke("product-3d-tripo", { body: payload });
    if (result.error) {
      var message = await edgeErrorMessage(result.error);
      var error = new Error(message);
      // Only the server's explicit disabled response permits a preparation notice.
      // Authentication, network and unrelated 503 failures remain errors.
      error.tripoGenerationDisabled = !!(result.error.context && result.error.context.status === 503 &&
        message === "Tripo generation is not configured");
      throw error;
    }
    var data = result.data || {};
    ["start_allowed", "publish_allowed", "reject_allowed"].forEach(function (field) {
      if (data[field] != null && typeof data[field] !== "boolean") throw new Error("Invalid generation permission");
    });
    // Prepared-image responses are plans/capabilities, not generation ledger
    // rows. Their strict target/hash/geometry/cost validation is performed by
    // DcatsPreparedInputs; applying the job parser first rejects valid plans.
    var inputResponse = ["input_plan", "input_sources", "input_preview", "input_upload", "input_check", "prepared_quote"]
      .includes(payload.action);
    if (payload.action !== "quote" && !inputResponse) {
      var statuses = ["reserved", "submitted", "processing", "collecting", "review", "publishing",
        "published", "failed", "cancelled", "held", "rejected"];
      var emptyHistory = ["latest", "prepared_latest"].includes(payload.action) && data.status === "none";
      if (!emptyHistory && (!statuses.includes(data.status) || typeof data.request_key !== "string" ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.request_key) ||
          (payload.request_key && data.request_key.toLowerCase() !== payload.request_key.toLowerCase()))) {
        throw new Error("Invalid generation state");
      }
      if (payload.action === "preview" && (typeof data.preview_url !== "string" || !data.preview_url)) {
        throw new Error("Preview unavailable");
      }
    }
    return data;
  }
  function tripoPayload(action) {
    return { action: action, product_id: tripoTarget.productId, product_kind: tripoTarget.kind,
      request_key: tripoJob && tripoJob.request_key };
  }
  function selectedTripoImages() {
    var selected = Array.from(elements["product-3d-tripo-views"].querySelectorAll("select"))
      .filter(function (node) { return !node.disabled && node.value !== ""; })
      .map(function (node) { return { view: node.dataset.tripoView, id: Number(node.value) }; });
    if (!selected.length || new Set(selected.map(function (item) { return item.id; })).size !== selected.length ||
        (selected.length > 1 && !selected.some(function (item) { return item.view === "front"; }))) {
      throw new Error("1～4枚を重複なく選択してください。複数枚では正面が必須です。");
    }
    return selected;
  }
  function tripoContextLabel(product, target) {
    return [productTitle(product), kindLabel(target.kind)].join(" / ");
  }
  function tripoImageLabel(row, index) {
    var created = typeof row.created_at === "string" ? new Date(row.created_at) : null;
    var date = created && Number.isFinite(created.getTime())
      ? created.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" }) : "";
    return "画像 " + (index + 1) + " / ID " + row.id + (date ? "（" + date + "）" : "");
  }
  function tripoViewLabels() { return { front: "正面", left: "左側", back: "背面", right: "右側" }; }
  function reviewedTripoDirections() {
    // Reviewed candidate only; not camera calibration or generation permission.
    return tripoTarget && tripoTarget.productId === 2639 && tripoTarget.kind === "aftermarket_new"
      ? { front: "171", left: "175", back: "179", right: "172" } : null;
  }
  function tripoPresetAvailable() {
    var preset = reviewedTripoDirections();
    if (!preset || tripoBusy || !sameTripoTarget(tripoRequestId)) return false;
    var controls = Array.from(elements["product-3d-tripo-views"].querySelectorAll("select"));
    return controls.length === 4 && Object.keys(preset).every(function (view) {
      var row = tripoImageRows[preset[view]];
      return row && String(row.id) === preset[view] && row.storage_path && row.previewUrl &&
        controls.filter(function (node) { return node.dataset.tripoView === view && !node.disabled; }).length === 1;
    });
  }
  function renderTripoPreset() {
    var host = elements["product-3d-tripo-preset"];
    if (!host) return;
    host.hidden = !reviewedTripoDirections() || !sameTripoTarget(tripoRequestId);
    var available = !host.hidden && tripoPresetAvailable();
    elements["product-3d-tripo-auto-assign"].disabled = !available;
    elements["product-3d-tripo-preset-status"].textContent = host.hidden ? "" : available
      ? "商品2639・新品専用。選択中の写真を候補で置き換えます（生成・課金なし）。"
      : "候補4枚の画像を確認できるまで自動セットできません。画像不足・取得失敗時は手動で選択してください。";
  }
  function autoAssignTripoImages() {
    // Preflight all four before changing any control. No API/quote/start/upload.
    if (!tripoPresetAvailable()) { renderTripoPreset(); return false; }
    var preset = reviewedTripoDirections();
    Array.from(elements["product-3d-tripo-views"].querySelectorAll("select")).forEach(function (node) {
      node.value = preset[node.dataset.tripoView];
    });
    renderTripoSelection();
    elements["product-3d-tripo-preset-status"].textContent = "4方向をセットしました。写真を確認し、必要なら変更してください（生成・課金なし）。";
    return true;
  }
  function tripoDirectionButtons(imageId, enabled) {
    var labels = tripoViewLabels();
    return Object.keys(labels).map(function (view) {
      var label = "画像 ID " + imageId + "を" + labels[view] + "に指定";
      return "<button type='button' data-tripo-assign='" + view + "' data-tripo-image-id='" + esc(imageId) +
        "' aria-label='" + esc(label) + "' aria-pressed='false'" +
        (enabled ? "" : " disabled") + ">" + labels[view] + "</button>";
    }).join("");
  }
  function renderTripoSelection() {
    var host = elements["product-3d-tripo-selection"];
    if (!host) return;
    var labels = tripoViewLabels();
    var selected = {}, missing = [], count = 0;
    Array.from(elements["product-3d-tripo-views"].querySelectorAll("select")).forEach(function (node) {
      if (!node.disabled && tripoImageRows[node.value]) { selected[node.dataset.tripoView] = node.value; count++; }
    });
    host.innerHTML = Object.keys(labels).map(function (view) {
      var id = selected[view], row = id && tripoImageRows[id];
      if (!row) missing.push(labels[view]);
      var picture = row && row.previewUrl
        ? "<img src='" + esc(row.previewUrl) + "' alt='" + labels[view] + " / " + esc(row.selectionLabel || "画像 ID " + id) + "'>"
        : "<div class='product-3d-tripo-selection-placeholder'>" + (row ? "画像を確認中…" : "未選択") + "</div>";
      return "<figure data-tripo-selected-view='" + view + "'><strong>" + labels[view] + "</strong>" + picture +
        "<figcaption>" + (row ? esc(row.selectionLabel || "画像 ID " + id) : "未選択") + "</figcaption>" +
        (row ? "<button type='button' data-tripo-clear-view='" + view + "' aria-label='" + labels[view] + "の選択を解除'>解除</button>" : "") + "</figure>";
    }).join("");
    elements["product-3d-tripo-selection-status"].textContent = "選択済み " + count + " / 4" +
      (missing.length ? " / 未選択: " + missing.join("・") : " / 4方向を選択済み") +
      (count > 1 && !selected.front ? "。複数枚では正面を選択してください。" : "。画像の向きは写真を見て確認してください。");
    [elements["product-3d-tripo-images"], elements["product-3d-tripo-image-directions"]].forEach(function (area) {
      if (!area) return;
      Array.from(area.querySelectorAll("[data-tripo-assign]")).forEach(function (button) {
        button.setAttribute("aria-pressed", selected[button.dataset.tripoAssign] === button.dataset.tripoImageId ? "true" : "false");
      });
      Array.from(area.querySelectorAll("[data-tripo-assigned-label]")).forEach(function (badge) {
        var views = Object.keys(labels).filter(function (view) { return selected[view] === badge.dataset.tripoAssignedLabel; });
        badge.textContent = views.length ? labels[views[0]] + "に指定済み" : "";
      });
    });
  }
  function assignTripoImage(view, imageId) {
    if (tripoBusy || !sameTripoTarget(tripoRequestId) || !Object.prototype.hasOwnProperty.call(tripoViewLabels(), view)) return false;
    imageId = String(imageId || "");
    if (imageId && !Object.prototype.hasOwnProperty.call(tripoImageRows, imageId)) return false;
    Array.from(elements["product-3d-tripo-views"].querySelectorAll("select")).forEach(function (node) {
      if (node.dataset.tripoView === view) node.value = imageId;
      else if (imageId && node.value === imageId) node.value = "";
    });
    renderTripoSelection();
    return true;
  }
  async function changeTripoKind() {
    var control = elements["product-3d-tripo-kind"];
    if (!tripoTarget) return;
    var nextKind = control.value;
    if (!sameTripoTarget(tripoRequestId) || !["rebuilt", "aftermarket_new"].includes(nextKind) || tripoBusy ||
        ["reserved", "submitted", "processing", "collecting", "publishing", "held"].includes(tripoJob && tripoJob.status)) {
      control.value = tripoTarget.kind;
      tripoStatus("処理中または結果未確認のため、商品区分を変更できません。再実行せず確認してください。");
      return;
    }
    if (nextKind !== tripoTarget.kind) await openTripo(tripoTarget.context, nextKind);
  }
  function renderTripoImageChoices(images, unavailableText) {
    var placeholder = unavailableText || (images.length ? "選択しない" : "保存済み画像なし");
    var options = "<option value=''>" + esc(placeholder) + "</option>" + images.map(function (row, index) {
      return "<option value='" + esc(row.id) + "'>" + esc(tripoImageLabel(row, index)) + "</option>";
    }).join("");
    // The four controls are in the initial markup, before the gallery and preview.
    // Loading/failed image queries must never leave this area blank.
    Array.from(elements["product-3d-tripo-views"].querySelectorAll("select")).forEach(function (node) {
      node.innerHTML = options;
      node.value = "";
      node.disabled = !!unavailableText || !images.length;
    });
    renderTripoSelection();
    renderTripoPreset();
  }
  function clearTripoImagePreview() {
    tripoImagePreviewRequestId += 1;
    var preview = elements["product-3d-tripo-image-preview"];
    if (!preview) return;
    preview.hidden = true;
    elements["product-3d-tripo-image-preview-img"].removeAttribute("src");
    elements["product-3d-tripo-image-preview-label"].textContent = "";
    if (elements["product-3d-tripo-image-directions"]) elements["product-3d-tripo-image-directions"].textContent = "";
  }
  async function showTripoImagePreview(button) {
    if (!sameTripoTarget(tripoRequestId)) return;
    var thumbnail = button && button.querySelector("img");
    var signedUrl = thumbnail && thumbnail.getAttribute("src");
    if (!signedUrl) { tripoStatus("画像の拡大表示を準備中です。しばらくしてから選択してください。"); return; }
    var imageId = String(button.dataset.tripoImagePreview || "");
    var row = tripoImageRows[imageId];
    var previewRequestId = ++tripoImagePreviewRequestId;
    var targetRequestId = tripoRequestId;
    elements["product-3d-tripo-image-preview-img"].src = signedUrl;
    elements["product-3d-tripo-image-preview-img"].alt = button.getAttribute("aria-label");
    elements["product-3d-tripo-image-preview-label"].textContent = button.dataset.tripoLabel;
    elements["product-3d-tripo-image-preview"].hidden = false;
    if (elements["product-3d-tripo-image-directions"]) {
      elements["product-3d-tripo-image-directions"].innerHTML = tripoDirectionButtons(imageId, true);
      renderTripoSelection();
    }
    if (!row || !row.storage_path) return;
    // Keep the already loaded thumbnail visible while the original private image loads.
    var originalUrl;
    try { originalUrl = await signProductImageUrl(row.storage_path); }
    catch (_) { return; }
    if (!originalUrl || previewRequestId !== tripoImagePreviewRequestId ||
        elements["product-3d-tripo-image-preview"].hidden || !sameTripoTarget(targetRequestId)) return;
    elements["product-3d-tripo-image-preview-img"].src = originalUrl;
  }
  async function openTripo(context, requestedKind) {
    if (!sessionModelsEnabled || context === "customer") return;
    if (!canManageGlb()) { deny3D("product_3d_tripo"); return; }
    var switchingKind = typeof requestedKind === "string";
    if (switchingKind && (!sameTripoTarget(tripoRequestId) || tripoBusy ||
        !["rebuilt", "aftermarket_new"].includes(requestedKind))) return;
    var target = selectedTarget(context || "sales");
    if (!target.product || !productId(target.product) || !target.kind) {
      alert("対象商品と区分を選択してください。"); return;
    }
    if (!switchingKind) tripoReturnFocus = document.activeElement;
    closeImageActionOverlays();
    clearViewerComparison();
    var requestId = ++tripoRequestId;
    tripoTarget = { context: context || "sales", productId: productId(target.product),
      kind: switchingKind ? requestedKind : target.kind, originKind: target.kind };
    tripoJob = null;
    tripoHistoryReady = false;
    tripoImageRows = Object.create(null);
    if (preparedInputsController) preparedInputsController.open({
      target: { productId: tripoTarget.productId, kind: tripoTarget.kind },
      isCurrent: function () { return sameTripoTarget(requestId); },
      invoke: function (action, body) {
        if (!sameTripoTarget(requestId)) return Promise.reject(new Error("Stale product target"));
        return tripoInvoke(Object.assign({ action: action, product_id: tripoTarget.productId, product_kind: tripoTarget.kind }, body));
      }, storage: sb.storage, preview: async function (result, trigger) {
        if (!sameTripoTarget(requestId)) return;
        var preparedViewerRequest = ++viewerRequestId;
        await showCommonViewer({ url: result.preview_url, reviewExport: true, reviewKind: tripoTarget.kind }, "Tripo生成結果 / 非公開プレビュー",
          { context: tripoTarget.context, productId: tripoTarget.productId, kind: tripoTarget.originKind || tripoTarget.kind },
          preparedViewerRequest, function () { return sameTripoTarget(requestId) && preparedViewerRequest === viewerRequestId; }, trigger);
      }
    });
    elements["product-3d-tripo-overlay"].classList.add("show");
    elements["product-3d-tripo-overlay"].setAttribute("aria-hidden", "false");
    elements["product-3d-tripo-kind"].value = tripoTarget.kind;
    (switchingKind ? elements["product-3d-tripo-kind"] : elements["product-3d-tripo-close"]).focus();
    elements["product-3d-tripo-context"].textContent = tripoContextLabel(target.product, tripoTarget);
    elements["product-3d-tripo-images"].textContent = "保存済み画像を読み込んでいます…";
    clearTripoImagePreview();
    renderTripoImageChoices([], "保存済み画像を読み込んでいます…");
    renderTripoJob();
    tripoStatus("確認中…");
    var imagesLoaded = false;
    try {
      var rows = await sb.from("core_product_images")
        .select("id,storage_path,sort_order,created_at").eq("dkd_shohin_id", tripoTarget.productId)
        .eq("product_kind", tripoTarget.kind).not("storage_path", "is", null)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(80);
      if (rows.error) throw rows.error;
      if (!sameTripoTarget(requestId)) return;
      var images = (rows.data || []).filter(function (row) { return row.storage_path; });
      images.forEach(function (row, index) { row.selectionIndex = index; row.selectionLabel = tripoImageLabel(row, index); tripoImageRows[String(row.id)] = row; });
      elements["product-3d-tripo-images"].innerHTML = images.length ? images.map(function (row, index) {
        var label = tripoImageLabel(row, index);
        return "<figure><button type='button' data-tripo-image-preview='" + esc(row.id) + "' data-tripo-label='" + esc(label) + "' aria-label='" + esc(label + "を拡大表示") + "'><img data-tripo-image='" + esc(row.id) + "' alt='' loading='lazy'></button><figcaption>" + esc(label) + "<span class='product-3d-tripo-assigned-label' data-tripo-assigned-label='" + esc(row.id) + "'></span></figcaption><div class='product-3d-tripo-photo-directions'>" + tripoDirectionButtons(row.id, false) + "</div></figure>";
      }).join("") : "この区分に保存済み画像がありません。先に商品画像を登録してください。";
      renderTripoImageChoices(images);
      imagesLoaded = true;
      images.forEach(async function (row) {
        try {
          var signed = await signProductImageUrl(row.storage_path);
          if (!sameTripoTarget(requestId)) return;
          var node = elements["product-3d-tripo-images"].querySelector("[data-tripo-image='" + row.id + "']");
          if (node) node.src = signed;
          if (signed) {
            row.previewUrl = signed;
            renderTripoPreset();
            Array.from(elements["product-3d-tripo-images"].querySelectorAll("[data-tripo-image-id='" + row.id + "']")).forEach(function (button) { button.disabled = false; });
            if (Array.from(elements["product-3d-tripo-views"].querySelectorAll("select")).some(function (control) { return control.value === String(row.id); })) renderTripoSelection();
          }
        } catch (_) { /* A missing preview does not authorize generating from an unavailable image. */ }
      });
      var latest = await tripoInvoke({ action: "latest", product_id: tripoTarget.productId, product_kind: tripoTarget.kind });
      if (!sameTripoTarget(requestId)) return;
      tripoJob = latest.status === "none" ? null : latest;
      tripoHistoryReady = true;
      renderTripoJob();
      if (!images.length) elements["product-3d-tripo-start"].hidden = true;
    } catch (error) {
      if (!sameTripoTarget(requestId)) return;
      if (!imagesLoaded) {
        renderTripoImageChoices([], "画像を読み込めませんでした");
        elements["product-3d-tripo-images"].textContent = "画像を読み込めませんでした。対象商品・区分とログイン状態を確認してください。";
      }
      tripoStatus(error.tripoGenerationDisabled
        ? (Object.keys(tripoImageRows).length
          ? "画像の確認・方向選択ができます。3D生成はまだ無効です。画像送信・課金・商品への登録は行っていません。"
          : "この区分に保存済み画像がありません。先に商品画像を登録してください。")
        : "画像または作成履歴を確認できませんでした: " + friendlyError(error));
    }
  }
  function closeTripo() {
    clearViewerComparison();
    if (preparedInputsController) preparedInputsController.close();
    var previous = tripoTarget;
    var wasOpen = elements["product-3d-tripo-overlay"].classList.contains("show");
    tripoRequestId += 1;
    tripoTarget = null; tripoJob = null; tripoHistoryReady = false;
    tripoImageRows = Object.create(null);
    renderTripoPreset();
    clearTripoImagePreview();
    if (elements["product-3d-tripo-selection"]) elements["product-3d-tripo-selection"].textContent = "";
    if (elements["product-3d-tripo-selection-status"]) elements["product-3d-tripo-selection-status"].textContent = "";
    if (elements["product-3d-tripo-images"]) elements["product-3d-tripo-images"].textContent = "";
    elements["product-3d-tripo-overlay"].classList.remove("show");
    elements["product-3d-tripo-overlay"].setAttribute("aria-hidden", "true");
    var returnFocus = tripoReturnFocus;
    tripoReturnFocus = null;
    if (!wasOpen || !sessionModelsEnabled || !previous) return;
    var current = selectedTarget(previous.context);
    if (productId(current.product) !== previous.productId || current.kind !== (previous.originKind || previous.kind)) return;
    if (!returnFocus || !returnFocus.isConnected || !returnFocus.getClientRects().length) {
      returnFocus = document.getElementById(previous.context === "production"
        ? "production-open-image-actions" : "btn-open-image-actions");
    }
    if (returnFocus && returnFocus.isConnected && !returnFocus.disabled &&
        returnFocus.getClientRects().length) returnFocus.focus();
  }
  function keepTripoFocus(event) {
    if (event.key !== "Tab" || !elements["product-3d-tripo-overlay"].classList.contains("show") ||
        elements["product-3d-viewer-overlay"].classList.contains("show")) return;
    var controls = Array.from(elements["product-3d-tripo-overlay"].querySelectorAll("button, select, input"))
      .filter(function (node) { return node.isConnected && !node.hidden && !node.disabled && node.getClientRects().length; });
    if (!controls.length) return;
    var first = controls[0];
    var last = controls[controls.length - 1];
    if (!controls.includes(document.activeElement) || (event.shiftKey && document.activeElement === first)) {
      event.preventDefault();
      (event.shiftKey && controls.includes(document.activeElement) ? last : first).focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first.focus();
    }
  }
  async function startTripo() {
    if (tripoBusy || !tripoTarget || !canStartTripoJob() || !sameTripoTarget(tripoRequestId)) return;
    var requestId = tripoRequestId;
    var images;
    try { images = selectedTripoImages(); }
    catch (error) { tripoStatus(friendlyError(error)); return; }
    tripoBusy = true;
    try {
      var quote = await tripoInvoke(Object.assign(tripoPayload("quote"), { images: images }));
      if (!sameTripoTarget(requestId)) return;
      if (typeof quote.can_start !== "boolean" || !Number.isSafeInteger(quote.estimated_credits) ||
          quote.estimated_credits < 1 || quote.estimated_credits > 100 ||
          typeof quote.balance !== "number" || !Number.isFinite(quote.balance) || quote.balance < 0 ||
          (quote.request_key != null && (typeof quote.request_key !== "string" ||
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(quote.request_key)))) {
        throw new Error("Tripoの見積りを確認できませんでした。");
      }
      if (!quote.can_start) {
        tripoStatus(quote.start_blocked_reason === "pilot_already_reserved"
          ? "初回1回の作成は依頼済みです。再作成せず、画面を開き直して結果を確認してください。"
          : "Tripo APIの残高が不足しています。"); return;
      }
      if (!window.confirm("選択した保存済み画像を外部サービスTripoへ送信し、3Dモデルを1回作成します。見積り " + quote.estimated_credits +
          " クレジット、現在残高 " + quote.balance + " クレジット。実際の料金はTripo APIで確定します。開始しますか？")) return;
      var requestKey = quote.request_key ? quote.request_key.toLowerCase() : crypto.randomUUID();
      tripoJob = { request_key: requestKey, status: "reserved" };
      renderTripoJob();
      var created = await tripoInvoke(Object.assign(tripoPayload("start"), {
        images: images, confirm_paid_generation: true,
        accepted_estimate_credits: quote.estimated_credits
      }));
      if (!sameTripoTarget(requestId)) return;
      tripoJob = created; renderTripoJob();
    } catch (error) {
      if (sameTripoTarget(requestId)) tripoStatus("開始結果を確認できません。再実行せず管理者に確認してください: " + friendlyError(error));
    } finally {
      tripoBusy = false;
      // Preserve uncertain reservations rather than re-enabling submission.
      if (sameTripoTarget(requestId)) {
        elements["product-3d-tripo-start"].hidden = !canStartTripoJob();
      }
    }
  }
  async function pollTripo() {
    if (tripoBusy || !tripoTarget || !tripoJob || !tripoJob.request_key ||
        !sameTripoTarget(tripoRequestId)) return;
    var requestId = tripoRequestId;
    tripoBusy = true;
    try {
      var result = await tripoInvoke(tripoPayload("poll"));
      if (sameTripoTarget(requestId)) { tripoJob = result; renderTripoJob(); }
    } catch (error) {
      if (sameTripoTarget(requestId)) tripoStatus("生成結果の確認を保留しました。再作成せず管理者に確認してください: " + friendlyError(error));
    } finally { tripoBusy = false; }
  }
  async function previewTripo() {
    if (tripoBusy || !tripoTarget || !tripoJob || tripoJob.status !== "review" ||
        !sameTripoTarget(tripoRequestId)) return;
    var requestId = tripoRequestId;
    var viewerRequest;
    tripoBusy = true;
    try {
      var result = await tripoInvoke(tripoPayload("preview"));
      if (!sameTripoTarget(requestId)) return;
      viewerRequest = ++viewerRequestId;
      await showCommonViewer({ url: result.preview_url, reviewExport: true, reviewKind: tripoTarget.kind }, "Tripo生成結果 / 非公開プレビュー",
        { context: tripoTarget.context, productId: tripoTarget.productId, kind: tripoTarget.originKind || tripoTarget.kind },
        viewerRequest, function () {
          return sameTripoTarget(requestId) && viewerRequest === viewerRequestId;
        }, elements["product-3d-tripo-preview"]);
      if (viewer && sameTripoTarget(requestId) && viewerRequest === viewerRequestId) {
        prepareViewerComparison(requestId, viewerRequest);
      }
    } catch (error) {
      if (sameTripoTarget(requestId)) {
        var message = "プレビューできませんでした: " + friendlyError(error);
        tripoStatus(message);
        if (viewerRequest === viewerRequestId) elements["product-3d-viewer-loading"].textContent = message;
      } else if (viewerRequest === viewerRequestId) closeViewer();
    } finally { tripoBusy = false; }
  }
  async function publishTripo() {
    if (tripoBusy || !tripoTarget || !tripoJob || tripoJob.status !== "review" || tripoJob.publish_allowed === false || !canPublish3D() ||
        !sameTripoTarget(tripoRequestId)) return;
    var requestId = tripoRequestId;
    tripoBusy = true;
    try {
      var active = await sb.from("product_3d_uploaded_models").select("id")
        .eq("dkd_shohin_id", tripoTarget.productId).eq("product_kind", tripoTarget.kind)
        .eq("status", "ready").maybeSingle();
      if (active.error) throw active.error;
      if (!sameTripoTarget(requestId)) return;
      if (!window.confirm("確認済みのTripoモデルを商品へ登録します。現在の外部GLBがあれば差し替えます。よろしいですか？")) return;
      tripoJob = Object.assign({}, tripoJob, { status: "publishing" });
      renderTripoJob();
      var result = await tripoInvoke(Object.assign(tripoPayload("publish"), {
        confirm_publish: true, replaced_id: active.data && active.data.id || null
      }));
      if (!sameTripoTarget(requestId)) return;
      tripoJob = result; renderTripoJob();
      clearModelCaches(tripoTarget.productId);
      await renderMediaPane(tripoTarget.context);
      scheduleBadgeRefresh();
    } catch (error) {
      if (sameTripoTarget(requestId)) tripoStatus("登録結果が未確認です。再実行せず管理者に確認してください: " + friendlyError(error));
    } finally { tripoBusy = false; }
  }
  async function rejectTripo() {
    if (tripoBusy || !tripoTarget || !tripoJob || tripoJob.status !== "review" || tripoJob.reject_allowed === false ||
        !sameTripoTarget(tripoRequestId) ||
        !window.confirm("この生成結果を不採用にしますか？非公開モデルは監査用に保持します。")) return;
    var requestId = tripoRequestId;
    tripoBusy = true;
    try {
      var result = await tripoInvoke(tripoPayload("reject"));
      if (sameTripoTarget(requestId)) { tripoJob = result; renderTripoJob(); }
    } catch (error) { if (sameTripoTarget(requestId)) tripoStatus("不採用を確定できませんでした: " + friendlyError(error)); }
    finally { tripoBusy = false; }
  }
  function selectGlbForUpload(context, replacedId) {
    if (!sessionModelsEnabled || glbMutationBusy) return;
    if (!canManageGlb()) { deny3D("upload_product_3d_glb"); return; }
    var target = selectedTarget(context || "sales");
    if (!target.product || !productId(target.product) || !target.kind) {
      alert("3Dモデルを登録する商品と区分を選択してください。");
      return;
    }
    glbUploadTarget = {
      context: context || "sales", productId: productId(target.product),
      kind: target.kind, replacedId: replacedId || ""
    };
    closeImageActionOverlays();
    elements["product-3d-glb-file"].value = "";
    elements["product-3d-glb-file"].click();
  }
  async function uploadSelectedGlb() {
    var input = elements["product-3d-glb-file"];
    var file = input.files && input.files[0];
    var target = glbUploadTarget;
    glbUploadTarget = null;
    if (!file || !target || !sessionModelsEnabled || glbMutationBusy) return;
    var epoch = modelCacheEpoch;
    var selected = selectedTarget(target.context);
    if (productId(selected.product) !== target.productId || selected.kind !== target.kind || !canManageGlb()) {
      alert("商品・区分・権限が変わりました。GLBを選び直してください。");
      input.value = "";
      return;
    }
    if (!/\.glb$/i.test(file.name) || file.size < 20 || file.size > 30 * 1024 * 1024 ||
        ["", "model/gltf-binary", "application/octet-stream"].indexOf(file.type) < 0) {
      alert("30 MB以下のGLBファイル（.glb）を選択してください。");
      return;
    }
    var form = new FormData();
    form.append("action", "upload");
    form.append("product_id", String(target.productId));
    form.append("product_kind", target.kind);
    form.append("replaced_id", target.replacedId);
    form.append("file", file);
    glbMutationBusy = true;
    input.disabled = true;
    var result;
    try {
      try {
        result = await sb.functions.invoke("product-3d-glb", { body: form });
        if (epoch !== modelCacheEpoch || !sessionModelsEnabled) return;
        // This Edge contract returns 400/413 before reserving a model or writing Storage.
        var response = result.error && result.error.context;
        if (response && (response.status === 400 || response.status === 413) &&
            typeof response.json === "function") {
          var rejected = null;
          try { rejected = await response.json(); }
          catch (_) { /* An unreadable response remains an uncertain outcome. */ }
          if (epoch !== modelCacheEpoch || !sessionModelsEnabled) return;
          if (rejected && typeof rejected.error === "string") {
            alert(response.status === 413
              ? "GLBは登録されませんでした。送信サイズが上限を超えています。小さいファイルを選び直してください。"
              : "GLBは登録されませんでした。ファイルの形式・内容を確認してください: " + rejected.error);
            return;
          }
        }
        if (result.error || !result.data || !result.data.ok) {
          throw new Error(await edgeErrorMessage(result.error || (result.data && result.data.error)));
        }
      } catch (error) {
        if (epoch !== modelCacheEpoch || !sessionModelsEnabled) return;
        // A lost response does not prove the server failed. Refresh read-only
        // state, and never automatically submit the same file a second time.
        clearModelCaches(target.productId);
        try {
          selected = selectedTarget(target.context);
          if (productId(selected.product) === target.productId && selected.kind === target.kind) {
            await renderMediaPane(target.context);
            if (epoch !== modelCacheEpoch || !sessionModelsEnabled) return;
            await refreshMediaAvailability(target.context);
            if (epoch !== modelCacheEpoch || !sessionModelsEnabled) return;
            scheduleBadgeRefresh();
          }
        } catch (refreshError) { console.warn("GLB status refresh failed", refreshError); }
        if (epoch !== modelCacheEpoch || !sessionModelsEnabled) return;
        alert("GLB登録の結果を確認できません。再送信せず、登録状態を確認してください: " + friendlyError(error));
        return;
      }
      if (epoch !== modelCacheEpoch || !sessionModelsEnabled) return;
      clearModelCaches(target.productId);
      // The new model is committed, but the old Storage object may still need
      // attention. Report that independently of the optional preview refresh.
      if (result.data.cleanup_pending) alert("新しいGLBは登録されました。旧ファイルの片付けは保留されています。");
      selected = selectedTarget(target.context);
      if (productId(selected.product) !== target.productId || selected.kind !== target.kind) {
        alert("GLBは登録されました。対象商品を選び直してプレビューを確認してください。");
        return;
      }
      try {
        await renderMediaPane(target.context);
        if (epoch !== modelCacheEpoch || !sessionModelsEnabled) return;
        await refreshMediaAvailability(target.context);
        if (epoch !== modelCacheEpoch || !sessionModelsEnabled) return;
        scheduleBadgeRefresh();
        await openViewerById("uploaded:" + result.data.model_id, target.context, target.productId);
      } catch (error) {
        if (epoch !== modelCacheEpoch || !sessionModelsEnabled) return;
        alert("GLBは登録されましたが、プレビューを更新できませんでした: " + friendlyError(error));
      }
    } finally {
      if (epoch === modelCacheEpoch) {
        input.disabled = false;
        input.value = "";
      }
      glbMutationBusy = false;
    }
  }
  async function deleteUploadedGlb(context, modelId) {
    if (!sessionModelsEnabled || glbMutationBusy) return;
    if (!canManageGlb()) { deny3D("delete_product_3d_glb"); return; }
    var target = selectedTarget(context || "sales");
    if (!target.product || !target.kind || !window.confirm("登録済みの外部GLBを削除しますか？")) return;
    var dkdId = productId(target.product);
    var epoch = modelCacheEpoch;
    var deletionConfirmed = false;
    var partialCleanupMessage = "";
    glbMutationBusy = true;
    try {
      var result = await sb.functions.invoke("product-3d-glb", {
        body: { action: "delete", product_id: dkdId, product_kind: target.kind, model_id: modelId }
      });
      if (epoch !== modelCacheEpoch || !sessionModelsEnabled) return;
      deletionConfirmed = !!(result && !result.error && result.data && result.data.ok === true);
      var errorBody = null;
      if (result.error && result.error.context && typeof result.error.context.json === "function") {
        try { errorBody = await result.error.context.json(); }
        catch (_) { /* A transport or malformed response leaves the outcome uncertain. */ }
      }
      if (epoch !== modelCacheEpoch || !sessionModelsEnabled) return;
      if (errorBody && errorBody.model_retired === true && errorBody.cleanup_pending === true) {
        partialCleanupMessage = errorBody.storage_removal_confirmed === true
          ? "GLBは表示から外れ、ファイルは削除されましたが、管理記録の片付けは保留中です。再実行せず管理者に確認してください。"
          : "GLBは表示から外れましたが、ファイル削除の結果は確認できません。再実行せず管理者に確認してください。";
      }
      clearModelCaches(dkdId);
      await renderMediaPane(context || "sales");
      if (epoch !== modelCacheEpoch || !sessionModelsEnabled) return;
      await refreshMediaAvailability(context || "sales");
      if (epoch !== modelCacheEpoch || !sessionModelsEnabled) return;
      scheduleBadgeRefresh();
      if (partialCleanupMessage) { alert(partialCleanupMessage); return; }
      if (result.error || !result.data || !result.data.ok) {
        var message = errorBody && typeof errorBody.error === "string"
          ? errorBody.error : await edgeErrorMessage(result.error || (result.data && result.data.error));
        if (epoch !== modelCacheEpoch || !sessionModelsEnabled) return;
        alert("GLB削除を完了できませんでした。再実行せず管理者に確認してください: " + message);
      }
    } catch (error) {
      if (epoch !== modelCacheEpoch || !sessionModelsEnabled) return;
      if (deletionConfirmed) {
        alert("GLBは削除されましたが、画面を更新できませんでした。商品を選び直して確認してください: " + friendlyError(error));
        return;
      }
      if (partialCleanupMessage) {
        alert(partialCleanupMessage + " 画面も更新できませんでした。商品を選び直して確認してください。");
        return;
      }
      clearModelCaches(dkdId);
      try {
        var selectedAfterDelete = selectedTarget(context || "sales");
        if (productId(selectedAfterDelete.product) === dkdId && selectedAfterDelete.kind === target.kind) {
          await renderMediaPane(context || "sales");
          if (epoch !== modelCacheEpoch || !sessionModelsEnabled) return;
          await refreshMediaAvailability(context || "sales");
          if (epoch !== modelCacheEpoch || !sessionModelsEnabled) return;
          scheduleBadgeRefresh();
        }
      } catch (refreshError) { console.warn("GLB delete status refresh failed", refreshError); }
      if (epoch !== modelCacheEpoch || !sessionModelsEnabled) return;
      alert("GLB削除の状態を確認できません。再実行せず管理者に確認してください: " + friendlyError(error));
    } finally {
      glbMutationBusy = false;
    }
  }
  async function openViewerById(modelId, context, dkdId) {
    var activeContext = context || "sales";
    var target = selectedTarget(activeContext);
    var targetId = productId(target.product);
    if (!sessionModelsEnabled || !targetId || (dkdId != null && Number(dkdId) !== targetId)) return;
    var targetKind = target.kind;
    var requestId = ++viewerRequestId;
    var internal = activeContext !== "customer" && canReview3D();
    function targetStillSelected() {
      var current = selectedTarget(activeContext);
      return requestId === viewerRequestId && sessionModelsEnabled &&
        productId(current.product) === targetId &&
        (activeContext === "customer" || current.kind === targetKind) &&
        internal === (activeContext !== "customer" && canReview3D());
    }
    var models;
    try { models = internal ? await fetchInternalModels(targetId) : await fetchPublishedModels(targetId); }
    catch (error) {
      if (targetStillSelected()) alert("3Dモデルを確認できませんでした。3Dタブを開き直してください。");
      return;
    }
    if (!targetStillSelected()) return;
    var model = models.find(function (row) { return String(row.id) === String(modelId); });
    if (!model || (activeContext !== "customer" && model.product_kind !== targetKind)) return;
    var signed;
    try {
      signed = await sb.storage.from(BUCKET).createSignedUrl(model.published_model_path, 600);
    } catch (error) {
      if (targetStillSelected()) alert("3Dモデルを開けませんでした: " + friendlyError(error));
      return;
    }
    if (!targetStillSelected()) return;
    if (!signed || signed.error || !signed.data || typeof signed.data.signedUrl !== "string" || !signed.data.signedUrl) {
      alert("3Dモデルを開けませんでした: " + friendlyError(signed && signed.error || "署名URLを取得できませんでした"));
      return;
    }
    await showCommonViewer({ url: signed.data.signedUrl },
      productTitle(target.product) + " / " + kindLabel(model.product_kind),
      { context: activeContext, productId: targetId, kind: targetKind }, requestId, targetStillSelected);
  }
  function selectLocalGlb(context) {
    if (!sessionModelsEnabled || !canManageGlb() || context === "customer") return;
    var target = selectedTarget(context || "sales");
    if (!productId(target.product) || !target.kind) return;
    localGlbTarget = { context: context || "sales", productId: productId(target.product), kind: target.kind };
    var input = elements["product-3d-local-glb-file"];
    input.value = "";
    input.click();
  }
  async function previewLocalGlb() {
    var input = elements["product-3d-local-glb-file"];
    var file = input.files && input.files[0];
    var target = localGlbTarget;
    localGlbTarget = null;
    input.value = "";
    if (!file || !target) return;
    var epoch = modelCacheEpoch;
    var requestId = ++viewerRequestId;
    function targetStillSelected() {
      var current = selectedTarget(target.context);
      return requestId === viewerRequestId && epoch === modelCacheEpoch && sessionModelsEnabled && canManageGlb() &&
        productId(current.product) === target.productId && current.kind === target.kind;
    }
    if (!targetStillSelected()) return;
    try {
      window.Product3DLocalGlb.validateFile(file);
      var buffer = await file.arrayBuffer();
      if (!targetStillSelected()) return;
      window.Product3DLocalGlb.validateBytes(buffer);
      await showCommonViewer({ buffer: buffer }, "端末内プレビュー（未登録） / " + file.name,
        target, requestId, targetStillSelected);
    } catch (error) {
      if (targetStillSelected()) alert("GLBをプレビューできませんでした: " + friendlyError(error));
    }
  }
  function clearViewerComparison() {
    viewerComparisonRequestId += 1;
    viewerComparisonTarget = null;
    var image = elements["product-3d-viewer-reference-image"];
    if (!image) return;
    image.onload = null; image.onerror = null;
    image.removeAttribute("src"); image.alt = ""; image.hidden = true;
    elements["product-3d-viewer-reference-photos"].textContent = "";
    elements["product-3d-viewer-reference-label"].textContent = "";
    elements["product-3d-viewer-reference"].hidden = true;
    elements["product-3d-viewer-compare"].hidden = true;
    elements["product-3d-viewer-compare"].setAttribute("aria-expanded", "false");
    elements["product-3d-viewer-shell"].classList.remove("has-photo-comparison");
  }
  function sameViewerComparison() {
    return !!viewerComparisonTarget && viewerComparisonTarget.viewerRequestId === viewerRequestId &&
      sameTripoTarget(viewerComparisonTarget.tripoRequestId) && tripoJob && tripoJob.status === "review";
  }
  function prepareViewerComparison(tripoRequest, viewerRequest) {
    clearViewerComparison();
    if (viewerRequest !== viewerRequestId || !sameTripoTarget(tripoRequest) ||
        !tripoJob || tripoJob.status !== "review") return;
    viewerComparisonTarget = { tripoRequestId: tripoRequest, viewerRequestId: viewerRequest,
      rows: tripoImageRows };
    elements["product-3d-viewer-compare"].hidden = false;
  }
  function toggleViewerComparison() {
    if (!sameViewerComparison()) { clearViewerComparison(); return; }
    var panel = elements["product-3d-viewer-reference"];
    if (!panel.hidden) {
      viewerComparisonRequestId += 1;
      var image = elements["product-3d-viewer-reference-image"];
      image.onload = null; image.onerror = null; image.removeAttribute("src"); image.hidden = true;
      elements["product-3d-viewer-reference-photos"].textContent = "";
      elements["product-3d-viewer-reference-label"].textContent = "";
      panel.hidden = true;
    } else {
      var rows = Object.values(viewerComparisonTarget.rows).sort(function (a, b) { return a.selectionIndex - b.selectionIndex; });
      elements["product-3d-viewer-reference-photos"].innerHTML = rows.map(function (row) {
        return "<button type='button' data-viewer-reference='" + esc(row.id) + "' aria-pressed='false'" +
          (row.previewUrl ? "" : " disabled") + ">" + (row.previewUrl
            ? "<img src='" + esc(row.previewUrl) + "' alt='' loading='lazy'>" : "<span>写真を読込中</span>") +
          "<span>" + esc(row.selectionLabel || "画像 ID " + row.id) + "</span></button>";
      }).join("");
      elements["product-3d-viewer-reference-label"].textContent = rows.length
        ? "下の写真を選んで、上下・端子・取付穴・プーリーを照合してください。"
        : "照合できる保存済み写真がありません。";
      panel.hidden = false;
    }
    elements["product-3d-viewer-compare"].setAttribute("aria-expanded", panel.hidden ? "false" : "true");
    elements["product-3d-viewer-shell"].classList.toggle("has-photo-comparison", !panel.hidden);
  }
  async function selectViewerReference(imageId) {
    if (!sameViewerComparison()) { clearViewerComparison(); return; }
    if (elements["product-3d-viewer-reference"].hidden) return;
    var row = viewerComparisonTarget.rows[String(imageId)];
    if (!row || !row.previewUrl || !row.storage_path) return;
    var requestId = ++viewerComparisonRequestId;
    var target = viewerComparisonTarget;
    var image = elements["product-3d-viewer-reference-image"];
    var label = elements["product-3d-viewer-reference-label"];
    function current() {
      return requestId === viewerComparisonRequestId && target === viewerComparisonTarget &&
        sameViewerComparison() && !elements["product-3d-viewer-reference"].hidden;
    }
    image.onload = null; image.onerror = null;
    image.hidden = false; image.src = row.previewUrl;
    image.alt = row.selectionLabel || "画像 ID " + row.id;
    label.textContent = image.alt + " / 元画像を読み込んでいます…";
    Array.from(elements["product-3d-viewer-reference-photos"].querySelectorAll("[data-viewer-reference]")).forEach(function (button) {
      button.setAttribute("aria-pressed", button.dataset.viewerReference === String(imageId) ? "true" : "false");
    });
    try {
      var originalUrl = await signProductImageUrl(row.storage_path);
      if (!current()) { if (target === viewerComparisonTarget && !sameViewerComparison()) clearViewerComparison(); return; }
      if (!originalUrl) throw new Error("Original unavailable");
      image.onload = function () { if (current()) label.textContent = image.alt + " / 元画像（照合専用）"; };
      image.onerror = function () {
        if (!current()) return;
        image.hidden = true; image.removeAttribute("src");
        label.textContent = "元画像を表示できませんでした。3Dの形状確認は未完了です。";
      };
      image.src = originalUrl;
    } catch (_) {
      if (current()) label.textContent = image.alt + " / 元画像を取得できません。縮小写真のみ表示しています。";
      else if (target === viewerComparisonTarget && !sameViewerComparison()) clearViewerComparison();
    }
  }
  function clearViewerExport() {
    viewerExportTarget = null;
    var link = elements["product-3d-viewer-export"];
    if (link) {
      link.hidden = true;
      link.removeAttribute("href");
      link.removeAttribute("download");
    }
    var notice = elements["product-3d-viewer-export-notice"];
    if (notice) { notice.hidden = true; notice.textContent = ""; }
  }
  function prepareViewerExport(source, target, requestId, current, openedAt) {
    var link = elements["product-3d-viewer-export"];
    if (!link || !source.reviewExport || !sessionModelsEnabled || !canManageGlb() ||
        !target || target.context === "customer" || !current() || requestId !== viewerRequestId) return;
    try {
      var url = new URL(source.url);
      // The preparation dialog may use a different kind from the underlying
      // detail pane. Export the reviewed kind, not the return-focus target.
      var exportKind = source.reviewKind || target.kind;
      var prefix = "/storage/v1/object/sign/product-3d/tripo-review/dkd_" + target.productId + "/" + exportKind + "/";
      var file = url.pathname.slice(prefix.length);
      // UI gating does not grant access. The existing authenticated Edge signs
      // only an authorized review object; never mint a URL or copy a session.
      if (!Number.isSafeInteger(target.productId) || target.productId <= 0 || !["rebuilt", "aftermarket_new"].includes(exportKind) ||
          url.origin !== "https://jqoeqximtwfpqwzngutj.supabase.co" || url.username || url.password || url.hash ||
          !url.pathname.startsWith(prefix) || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\.glb$/i.test(file) ||
          !url.searchParams.get("token") || url.searchParams.getAll("token").length !== 1 ||
          Array.from(url.searchParams.keys()).some(function (key) { return key !== "token"; })) return;
      var filename = "D-CATS-product-" + target.productId + "-" + exportKind + "-" + file;
      url.searchParams.set("download", filename);
      viewerExportTarget = { requestId: requestId, current: current, expiresAt: openedAt + 240000 };
      if (Date.now() >= viewerExportTarget.expiresAt) { clearViewerExport(); return; }
      link.href = url.href;
      link.download = filename;
      link.hidden = false;
    } catch (_) { clearViewerExport(); }
  }
  function guardViewerExport(event) {
    var target = viewerExportTarget;
    if (target && target.requestId === viewerRequestId && sessionModelsEnabled && canManageGlb() &&
        target.current() && Date.now() < target.expiresAt) return;
    event.preventDefault();
    clearViewerExport();
    var notice = elements["product-3d-viewer-export-notice"];
    if (notice) {
      notice.textContent = t("product_3d_review_export_stale");
      notice.hidden = false;
    }
  }
  async function showCommonViewer(source, title, focusTarget, requestId, targetStillSelected, returnFocus) {
    clearViewerExport();
    var exportOpenedAt = Date.now();
    clearViewerComparison();
    var viewerOverlay = elements["product-3d-viewer-overlay"];
    if (!viewerOverlay.classList.contains("show")) {
      var previousFocus = returnFocus || document.activeElement;
      viewerReturnFocus = previousFocus && previousFocus !== document.body &&
        typeof previousFocus.focus === "function" ? previousFocus : null;
      viewerFocusTarget = focusTarget;
    }
    viewerOverlay.classList.add("show");
    viewerOverlay.setAttribute("aria-hidden", "false");
    elements["product-3d-viewer-close"].focus();
    elements["product-3d-viewer-title"].textContent = title;
    elements["product-3d-viewer-loading"].textContent = "3Dモデルを読み込んでいます...";
    elements["product-3d-viewer-loading"].hidden = false;
    elements["product-3d-viewer-fullscreen-notice"].hidden = true;
    elements["product-3d-viewer-autorotate"].setAttribute("aria-pressed", "false");
    try {
      if (viewer) { viewer.dispose(); viewer = null; }
      var module = await import("./product-3d-viewer.js?v=1.1.1141");
      if (!targetStillSelected()) {
        if (requestId === viewerRequestId) closeViewer();
        return;
      }
      var createdViewer = await module.createProduct3DViewer({
        host: elements["product-3d-viewer-stage"],
        url: source.url,
        buffer: source.buffer,
        fullscreenElement: elements["product-3d-viewer-shell"] || elements["product-3d-viewer-stage"],
        autoRotate: false
      });
      if (!targetStillSelected()) {
        createdViewer.dispose();
        if (requestId === viewerRequestId) closeViewer();
        return;
      }
      viewer = createdViewer;
      elements["product-3d-viewer-loading"].hidden = true;
      prepareViewerExport(source, focusTarget, requestId, targetStillSelected, exportOpenedAt);
    } catch (error) {
      if (!targetStillSelected()) {
        if (requestId === viewerRequestId) closeViewer();
        return;
      }
      elements["product-3d-viewer-loading"].textContent = "3Dモデルの読込に失敗しました: " + friendlyError(error);
    }
  }
  function keepViewerFocus(event) {
    if (event.key !== "Tab" || !elements["product-3d-viewer-overlay"].classList.contains("show")) return;
    var controls = Array.from(elements["product-3d-viewer-overlay"].querySelectorAll("button, a[href]"))
      .filter(function (node) { return node.isConnected && !node.hidden && !node.disabled && node.getClientRects().length; });
    if (!controls.length) return;
    var first = controls[0];
    var last = controls[controls.length - 1];
    if (!controls.includes(document.activeElement) || (event.shiftKey && document.activeElement === first)) {
      event.preventDefault();
      (event.shiftKey && controls.includes(document.activeElement) ? last : first).focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
  async function toggleViewerFullscreen() {
    if (!viewer) return;
    try {
      await viewer.fullscreen();
      elements["product-3d-viewer-fullscreen-notice"].hidden = true;
    } catch (error) {
      elements["product-3d-viewer-fullscreen-notice"].hidden = false;
      console.warn("Product 3D fullscreen unavailable", error);
    }
  }
  function closeViewer() {
    viewerRequestId += 1;
    clearViewerComparison();
    clearViewerExport();
    if (viewer) { viewer.dispose(); viewer = null; }
    var fullscreenTarget = elements["product-3d-viewer-shell"] || elements["product-3d-viewer-stage"];
    if (document.fullscreenElement === fullscreenTarget && typeof document.exitFullscreen === "function") {
      document.exitFullscreen().catch(function () {});
    }
    var viewerOverlay = elements["product-3d-viewer-overlay"];
    var wasOpen = viewerOverlay.classList.contains("show");
    viewerOverlay.classList.remove("show");
    viewerOverlay.setAttribute("aria-hidden", "true");
    elements["product-3d-viewer-loading"].hidden = true;
    elements["product-3d-viewer-fullscreen-notice"].hidden = true;
    var returnFocus = viewerReturnFocus;
    var focusTarget = viewerFocusTarget;
    viewerReturnFocus = null;
    viewerFocusTarget = null;
    if (wasOpen && sessionModelsEnabled && focusTarget && returnFocus && returnFocus.isConnected &&
        !returnFocus.disabled && !returnFocus.hidden) {
      var current = selectedTarget(focusTarget.context);
      if (productId(current.product) === focusTarget.productId &&
          (focusTarget.context === "customer" || current.kind === focusTarget.kind)) returnFocus.focus();
    }
  }
  function closeCapture() {
    stopCamera();
    if (state.proposalTimer) window.clearTimeout(state.proposalTimer);
    elements["product-3d-capture-overlay"].classList.remove("show");
    elements["product-3d-capture-overlay"].setAttribute("aria-hidden", "true");
  }

  function bind() {
    if (elements["product-3d-viewer-export"]) elements["product-3d-viewer-export"].addEventListener("click", guardViewerExport);
    elements["product-3d-tripo-close"].addEventListener("click", closeTripo);
    elements["product-3d-tripo-kind"].addEventListener("change", changeTripoKind);
    elements["product-3d-tripo-auto-assign"].addEventListener("click", autoAssignTripoImages);
    elements["product-3d-tripo-views"].addEventListener("change", function (event) {
      if (event.target.matches("select")) assignTripoImage(event.target.dataset.tripoView, event.target.value);
    });
    elements["product-3d-tripo-selection"].addEventListener("click", function (event) {
      var button = event.target.closest("[data-tripo-clear-view]");
      if (button) assignTripoImage(button.dataset.tripoClearView, "");
    });
    elements["product-3d-tripo-image-directions"].addEventListener("click", function (event) {
      var button = event.target.closest("[data-tripo-assign]");
      if (button) assignTripoImage(button.dataset.tripoAssign, button.dataset.tripoImageId);
    });
    elements["product-3d-tripo-image-preview-close"].addEventListener("click", clearTripoImagePreview);
    elements["product-3d-tripo-images"].addEventListener("click", function (event) {
      var assignment = event.target.closest("[data-tripo-assign]");
      if (assignment) { assignTripoImage(assignment.dataset.tripoAssign, assignment.dataset.tripoImageId); return; }
      var button = event.target.closest("[data-tripo-image-preview]");
      if (button) showTripoImagePreview(button);
    });
    elements["product-3d-tripo-start"].addEventListener("click", startTripo);
    elements["product-3d-tripo-poll"].addEventListener("click", pollTripo);
    elements["product-3d-tripo-preview"].addEventListener("click", previewTripo);
    elements["product-3d-tripo-publish"].addEventListener("click", publishTripo);
    elements["product-3d-tripo-reject"].addEventListener("click", rejectTripo);
    el("btn-image-action-create-3d").addEventListener("click", function () { openCapture("sales"); });
    el("production-image-action-create-3d").addEventListener("click", function () { openCapture("production"); });
    el("btn-image-action-upload-glb").addEventListener("click", function () { selectGlbForUpload("sales"); });
    el("production-image-action-upload-glb").addEventListener("click", function () { selectGlbForUpload("production"); });
    elements["product-3d-glb-file"].addEventListener("change", uploadSelectedGlb);
    elements["product-3d-local-glb-file"].addEventListener("change", previewLocalGlb);
    elements["product-3d-capture-close"].addEventListener("click", closeCapture);
    elements["product-3d-start-camera"].addEventListener("click", startCamera);
    elements["product-3d-snapshot"].addEventListener("click", function () { captureSnapshot("camera_still"); });
    elements["product-3d-video-supplement"].addEventListener("click", toggleVideoSupplement);
    elements["product-3d-bottom-mode"].addEventListener("click", toggleBottomMode);
    elements["product-3d-submit"].addEventListener("click", submitWorkspace);
    elements["product-3d-capture-dial"].addEventListener("click", function (event) {
      var button = event.target.closest("[data-direction]"); if (!button) return;
      state.currentDirection = button.dataset.direction; renderDial(); drawGuide(state.guide);
    });
    elements["product-3d-viewer-close"].addEventListener("click", closeViewer);
    elements["product-3d-viewer-zoom-in"].addEventListener("click", function () { if (viewer) viewer.zoomIn(); });
    elements["product-3d-viewer-zoom-out"].addEventListener("click", function () { if (viewer) viewer.zoomOut(); });
    elements["product-3d-viewer-reset"].addEventListener("click", function () { if (viewer) viewer.reset(); });
    elements["product-3d-viewer-autorotate"].addEventListener("click", function () {
      if (!viewer) return; var active = this.getAttribute("aria-pressed") !== "true"; viewer.setAutoRotate(active); this.setAttribute("aria-pressed", active ? "true" : "false");
    });
    elements["product-3d-viewer-fullscreen"].addEventListener("click", toggleViewerFullscreen);
    elements["product-3d-viewer-compare"].addEventListener("click", toggleViewerComparison);
    elements["product-3d-viewer-reference-photos"].addEventListener("click", function (event) {
      var button = event.target.closest("[data-viewer-reference]");
      if (button) selectViewerReference(button.dataset.viewerReference);
    });
    document.addEventListener("click", function (event) {
      var media = event.target.closest("[data-product-media]");
      if (media) {
        var context = media.dataset.productMediaContext; var mode = media.dataset.productMedia;
        document.querySelectorAll("[data-product-media-context='" + context + "']").forEach(function (node) {
          if (node.hasAttribute("data-product-media")) { var selected = node.dataset.productMedia === mode; node.classList.toggle("active", selected); node.setAttribute("aria-selected", selected ? "true" : "false"); }
          if (node.hasAttribute("data-product-media-pane")) node.hidden = node.dataset.productMediaPane !== mode;
        });
        if (mode === "model") renderMediaPane(context);
      }
      var create = event.target.closest("[data-create-3d]"); if (create) openCapture(create.dataset.create3d);
      var connection = event.target.closest("[data-tripo-readiness]");
      if (connection) checkTripoReadiness(connection.dataset.tripoReadiness, connection);
      var hunyuan = event.target.closest("[data-hunyuan-readiness]");
      if (hunyuan) checkHunyuanReadiness(hunyuan.dataset.hunyuanReadiness, hunyuan);
      var tripo = event.target.closest("[data-tripo-3d]"); if (tripo) openTripo(tripo.dataset.tripo3d);
      var upload = event.target.closest("[data-upload-3d]"); if (upload) selectGlbForUpload(upload.dataset.upload3d);
      var local = event.target.closest("[data-local-glb]"); if (local) selectLocalGlb(local.dataset.localGlb);
      var replace = event.target.closest("[data-replace-uploaded]");
      if (replace) selectGlbForUpload(replace.dataset.uploadContext, replace.dataset.replaceUploaded);
      var remove = event.target.closest("[data-delete-uploaded]");
      if (remove) deleteUploadedGlb(remove.dataset.uploadContext, remove.dataset.deleteUploaded);
      var open = event.target.closest("[data-open-model]"); if (open) openViewerById(open.dataset.openModel, open.dataset.modelContext, Number(open.dataset.modelProduct));
      var publish = event.target.closest("[data-publish-model]"); if (publish) publishModel(publish.dataset.publishModel, publish.dataset.publishContext);
    });
    window.addEventListener("resize", function () { if (state.stream) drawGuide(state.guide); });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        if (elements["product-3d-viewer-overlay"].classList.contains("show")) closeViewer();
        else if (elements["product-3d-tripo-overlay"].classList.contains("show")) closeTripo();
        else closeCapture();
      } else { keepViewerFocus(event); keepTripoFocus(event); }
    });
  }

  function resetSessionModels() {
    localGlbTarget = null;
    if (elements["product-3d-local-glb-file"]) elements["product-3d-local-glb-file"].value = "";
    modelCacheEpoch += 1;
    modelCache = Object.create(null);
    internalModelCache = Object.create(null);
    modelBadgeCache = Object.create(null);
    Object.keys(mediaAvailabilityRequest).forEach(function (context) { mediaAvailabilityRequest[context] += 1; });
    Object.keys(mediaPaneRequest).forEach(function (context) { mediaPaneRequest[context] += 1; });
    if (badgeRefreshTimer) window.clearTimeout(badgeRefreshTimer);
    badgeRefreshTimer = null;
    glbUploadTarget = null;
    if (elements["product-3d-glb-file"]) {
      elements["product-3d-glb-file"].disabled = false;
      elements["product-3d-glb-file"].value = "";
    }
    closeCapture(); closeViewer(); closeTripo();
    state = freshState();
    document.querySelectorAll(".product-3d-has-badge").forEach(function (badge) { badge.remove(); });
    document.querySelectorAll("[data-product-media-pane='model']").forEach(function (pane) {
      pane.hidden = true;
      var switcher = pane.parentElement && pane.parentElement.querySelector(".product-media-switch");
      var modelTab = switcher && switcher.querySelector("[data-product-media='model']");
      var photoTab = switcher && switcher.querySelector("[data-product-media='photos']");
      var photoPane = pane.parentElement && pane.parentElement.querySelector("[data-product-media-pane='photos']");
      if (modelTab) { modelTab.hidden = true; modelTab.classList.remove("active"); modelTab.setAttribute("aria-selected", "false"); }
      if (photoTab) { photoTab.classList.add("active"); photoTab.setAttribute("aria-selected", "true"); }
      if (photoPane) photoPane.hidden = false;
      var mediaShell = switcher && switcher.closest("[data-product-3d-media-shell]");
      if (mediaShell && mediaShell.dataset.noPhotos === "true") mediaShell.hidden = true;
    });
    ["sales-product-3d-list", "production-product-3d-list", "customer-product-3d-list"].forEach(function (id) {
      var host = el(id); if (host) host.textContent = "";
    });
  }

  function bindSessionBoundary() {
    if (!sb.auth || typeof sb.auth.onAuthStateChange !== "function") return;
    sb.auth.onAuthStateChange(function (event, session) {
      if (["INITIAL_SESSION", "SIGNED_IN", "SIGNED_OUT", "USER_UPDATED"].indexOf(event) < 0) return;
      var userId = event === "SIGNED_OUT" ? null : (session && session.user && session.user.id || null);
      if (event === "SIGNED_IN" && userId === modelAuthUserId) return;
      modelAuthUserId = userId;
      sessionModelsEnabled = !!userId;
      resetSessionModels();
      // Supabase calls auth listeners synchronously; defer all database reads.
      if (sessionModelsEnabled) window.setTimeout(function () {
        if (modelAuthUserId !== userId || !sessionModelsEnabled) return;
        ["sales", "production", "customer"].forEach(refreshMediaAvailability);
        scheduleBadgeRefresh();
      }, 0);
    });
  }

  function init() {
    cacheElements();
    if (!elements["product-3d-capture-overlay"] || typeof sb === "undefined") return;
    bind(); bindSessionBoundary(); renderAll();
    ["sales", "production", "customer"].forEach(refreshMediaAvailability);
    ["list", "production-list", "customer-catalog-list"].forEach(function (id) {
      var host = el(id); if (host) new MutationObserver(scheduleBadgeRefresh).observe(host, { childList: true, subtree: true });
    });
    scheduleBadgeRefresh();
  }
  window.DcatsProduct3D = { openCapture: openCapture, renderMediaPane: renderMediaPane, fetchPublishedModels: fetchPublishedModels, refreshListBadges: refreshListBadges, refreshMediaAvailability: refreshMediaAvailability };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
