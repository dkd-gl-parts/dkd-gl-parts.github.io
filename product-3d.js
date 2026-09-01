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
  var modelCache = Object.create(null);
  var internalModelCache = Object.create(null);
  var modelBadgeCache = Object.create(null);
  var badgeRefreshTimer = null;

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
    [
      "product-3d-capture-overlay", "product-3d-capture-close", "product-3d-capture-context",
      "product-3d-camera-stage", "product-3d-camera-video", "product-3d-guide-canvas",
      "product-3d-analysis-canvas", "product-3d-camera-placeholder", "product-3d-direction-callout",
      "product-3d-live-feedback", "product-3d-start-camera", "product-3d-snapshot",
      "product-3d-video-supplement", "product-3d-bottom-mode", "product-3d-capture-count",
      "product-3d-capture-dial", "product-3d-analysis-progress", "product-3d-analysis-results",
      "product-3d-quality-score", "product-3d-quality-list", "product-3d-submit-status", "product-3d-submit",
      "product-3d-viewer-overlay", "product-3d-viewer-close", "product-3d-viewer-title",
      "product-3d-viewer-stage", "product-3d-viewer-loading", "product-3d-viewer-reset",
      "product-3d-viewer-autorotate", "product-3d-viewer-fullscreen"
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
    return String(product.manufacturer_part_number || product.genuine_part_number || product.daiko_part_number || ("商品 " + productId(product)));
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

  async function fetchPublishedModels(dkdId) {
    if (!dkdId) return [];
    var key = String(dkdId);
    if (modelCache[key]) return modelCache[key];
    var result = await sb.from("product_3d_models")
      .select("id,dkd_shohin_id,product_kind,revision,status,published_model_path,thumbnail_path,model_bytes,triangle_count,published_at")
      .eq("dkd_shohin_id", dkdId).eq("status", "published").order("revision", { ascending: false });
    if (result.error) { console.warn("published 3D lookup failed", result.error); return []; }
    modelCache[key] = result.data || [];
    return modelCache[key];
  }
  async function fetchInternalModels(dkdId) {
    if (!dkdId) return [];
    var key = String(dkdId);
    if (internalModelCache[key]) return internalModelCache[key];
    var result = await sb.from("product_3d_models")
      .select("id,dkd_shohin_id,product_kind,revision,status,published_model_path,thumbnail_path,model_bytes,triangle_count,published_at,additional_capture_instructions,failure_message,updated_at")
      .eq("dkd_shohin_id", dkdId).order("revision", { ascending: false });
    if (result.error) { console.warn("internal 3D lookup failed", result.error); return []; }
    internalModelCache[key] = result.data || [];
    return internalModelCache[key];
  }
  function visibleProductNodes() {
    return Array.from(document.querySelectorAll("#list [data-dkd-id], #production-list [data-dkd-id], [data-customer-catalog-dkd]"));
  }
  async function refreshListBadges() {
    var nodes = visibleProductNodes();
    var ids = Array.from(new Set(nodes.map(function (node) {
      return Number(node.dataset.dkdId || node.dataset.customerCatalogDkd);
    }).filter(Boolean)));
    var missing = ids.filter(function (id) { return !Object.prototype.hasOwnProperty.call(modelBadgeCache, String(id)); });
    if (missing.length) {
      var batch = missing.slice(0, 300);
      var result = await sb.from("product_3d_models").select("dkd_shohin_id").eq("status", "published").in("dkd_shohin_id", batch);
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
    var target = selectedTarget(context);
    var hostId = { sales: "sales-product-3d-list", production: "production-product-3d-list", customer: "customer-product-3d-list" }[context];
    var host = el(hostId);
    if (!host || !target.product) return;
    host.innerHTML = "<div class='product-3d-loading-card'>3Dモデルを確認しています…</div>";
    var internal = context !== "customer" && canReview3D();
    var manageable = context !== "customer" && !!target.kind && canManage3D();
    var publishable = context !== "customer" && canPublish3D();
    var models = internal ? await fetchInternalModels(productId(target.product)) : await fetchPublishedModels(productId(target.product));
    var visible = context === "customer" ? models : models.filter(function (model) { return model.product_kind === target.kind; });
    if (!visible.length) {
      var createAction = manageable ? "<button type='button' data-create-3d='" + context + "'>3Dモデルを作成</button>" : "";
      host.innerHTML = "<div class='product-3d-empty-card'><span class='product-3d-cube'>3D</span><strong>公開済み3Dモデルはありません</strong>" + createAction + "</div>";
      return;
    }
    function modelCardHtml(model) {
      var size = model.model_bytes ? (model.model_bytes / 1048576).toFixed(1) + " MB" : "";
      var status = modelStatusLabel(model.status);
      var canOpen = model.published_model_path && (model.status === "published" || model.status === "review" || model.status === "archived");
      var action = canOpen ? "<button type='button' class='product-3d-card-action' data-open-model='" + model.id + "' data-model-context='" + context + "' data-model-product='" + productId(target.product) + "'>確認</button>" : "";
      if (publishable && model.status === "review") action += "<button type='button' class='product-3d-card-action publish' data-publish-model='" + model.id + "' data-publish-context='" + context + "'>公開</button>";
      if (manageable && ["draft", "needs_capture", "failed"].indexOf(model.status) >= 0) action += "<button type='button' class='product-3d-card-action' data-create-3d='" + context + "'>撮影を再開</button>";
      var note = model.failure_message || (model.additional_capture_instructions && model.additional_capture_instructions.length ? "追加撮影: " + model.additional_capture_instructions.join(" / ") : "");
      return "<div class='product-3d-model-card'><span class='product-3d-cube'>3D</span><span><strong>" + esc(kindLabel(model.product_kind)) + " 3Dモデル <i data-model-status='" + esc(model.status) + "'>" + esc(status) + "</i></strong><small>rev." + model.revision + " " + size + (note ? " / " + esc(note) : "") + "</small></span><span class='product-3d-card-actions'>" + action + "</span></div>";
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
    host.innerHTML = visible.map(modelCardHtml).join("");
  }
  function modelStatusLabel(status) {
    return ({ draft: "撮影途中", waiting: "待機", processing: "処理中", needs_capture: "要追加撮影", failed: "失敗", review: "確認待ち", published: "公開済み", archived: "旧版" })[status] || status;
  }
  async function publishModel(modelId, context) {
    if (!canPublish3D()) { deny3D("publish_product_3d_model"); return; }
    if (!window.confirm("確認中の3Dモデルを得意先にも公開します。公開してよろしいですか？")) return;
    var result = await sb.rpc("publish_product_3d_model", { target_model_id: Number(modelId) });
    if (result.error) { alert("3Dモデルを公開できませんでした: " + friendlyError(result.error)); return; }
    var dkdId = String(result.data.dkd_shohin_id);
    delete modelCache[dkdId]; delete internalModelCache[dkdId]; delete modelBadgeCache[dkdId];
    await renderMediaPane(context || "sales"); scheduleBadgeRefresh();
  }
  async function openViewerById(modelId, context, dkdId) {
    var requestId = ++viewerRequestId;
    var target = selectedTarget(context || "sales");
    var internal = context !== "customer" && canReview3D();
    var models = internal ? await fetchInternalModels(dkdId || productId(target.product)) : await fetchPublishedModels(dkdId || productId(target.product));
    if (requestId !== viewerRequestId) return;
    var model = models.find(function (row) { return String(row.id) === String(modelId); });
    if (!model) return;
    var signed = await sb.storage.from(BUCKET).createSignedUrl(model.published_model_path, 600);
    if (requestId !== viewerRequestId) return;
    if (signed.error) { alert("3Dモデルを開けませんでした: " + friendlyError(signed.error)); return; }
    elements["product-3d-viewer-overlay"].classList.add("show");
    elements["product-3d-viewer-overlay"].setAttribute("aria-hidden", "false");
    elements["product-3d-viewer-title"].textContent = productTitle(target.product) + " / " + kindLabel(model.product_kind);
    elements["product-3d-viewer-loading"].hidden = false;
    try {
      if (viewer) { viewer.dispose(); viewer = null; }
      var module = await import("./product-3d-viewer.js?v=1.1.776");
      var createdViewer = await module.createProduct3DViewer({
        host: elements["product-3d-viewer-stage"],
        url: signed.data.signedUrl,
        fullscreenElement: elements["product-3d-viewer-shell"] || elements["product-3d-viewer-stage"],
        autoRotate: false
      });
      if (requestId !== viewerRequestId) { createdViewer.dispose(); return; }
      viewer = createdViewer;
      elements["product-3d-viewer-loading"].hidden = true;
    } catch (error) {
      if (requestId !== viewerRequestId) return;
      elements["product-3d-viewer-loading"].textContent = "3Dモデルの読込に失敗しました: " + friendlyError(error);
    }
  }
  function closeViewer() {
    viewerRequestId += 1;
    if (viewer) { viewer.dispose(); viewer = null; }
    elements["product-3d-viewer-overlay"].classList.remove("show");
    elements["product-3d-viewer-overlay"].setAttribute("aria-hidden", "true");
    elements["product-3d-viewer-loading"].hidden = true;
  }
  function closeCapture() {
    stopCamera();
    if (state.proposalTimer) window.clearTimeout(state.proposalTimer);
    elements["product-3d-capture-overlay"].classList.remove("show");
    elements["product-3d-capture-overlay"].setAttribute("aria-hidden", "true");
  }

  function bind() {
    el("btn-image-action-create-3d").addEventListener("click", function () { openCapture("sales"); });
    el("production-image-action-create-3d").addEventListener("click", function () { openCapture("production"); });
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
    elements["product-3d-viewer-reset"].addEventListener("click", function () { if (viewer) viewer.reset(); });
    elements["product-3d-viewer-autorotate"].addEventListener("click", function () {
      if (!viewer) return; var active = this.getAttribute("aria-pressed") !== "true"; viewer.setAutoRotate(active); this.setAttribute("aria-pressed", active ? "true" : "false");
    });
    elements["product-3d-viewer-fullscreen"].addEventListener("click", function () { if (viewer) viewer.fullscreen(); });
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
      var open = event.target.closest("[data-open-model]"); if (open) openViewerById(open.dataset.openModel, open.dataset.modelContext, Number(open.dataset.modelProduct));
      var publish = event.target.closest("[data-publish-model]"); if (publish) publishModel(publish.dataset.publishModel, publish.dataset.publishContext);
    });
    window.addEventListener("resize", function () { if (state.stream) drawGuide(state.guide); });
    document.addEventListener("keydown", function (event) { if (event.key === "Escape") { closeCapture(); closeViewer(); } });
  }

  function init() {
    cacheElements();
    if (!elements["product-3d-capture-overlay"] || typeof sb === "undefined") return;
    bind(); renderAll();
    ["list", "production-list", "customer-catalog-list"].forEach(function (id) {
      var host = el(id); if (host) new MutationObserver(scheduleBadgeRefresh).observe(host, { childList: true, subtree: true });
    });
    scheduleBadgeRefresh();
  }
  window.DcatsProduct3D = { openCapture: openCapture, renderMediaPane: renderMediaPane, fetchPublishedModels: fetchPublishedModels, refreshListBadges: refreshListBadges };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
