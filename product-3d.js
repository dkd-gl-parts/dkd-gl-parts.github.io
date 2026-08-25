(function () {
  "use strict";

  var BUCKET = "product-3d";
  var MIN_CAPTURES = 6;
  var RECOMMENDED_CAPTURES = 12;
  var MAX_CAPTURE_EDGE = 2560;
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
    return kind === "aftermarket_new" ? kind : "rebuilt";
  }
  function kindLabel(kind) {
    return cleanKind(kind) === "aftermarket_new" ? "新品" : "リビルト";
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
      : (context === "customer" ? "rebuilt" : (typeof selectedImageActionKind === "function" ? selectedImageActionKind("sales") : (typeof selectedProductKind === "function" ? selectedProductKind() : "rebuilt")));
    return { product: product, kind: cleanKind(kind) };
  }

  async function openCapture(context) {
    if (state.busy) return;
    var target = selectedTarget(context || "sales");
    if (!target.product || !productId(target.product)) {
      alert("3Dモデルを作成する商品を選択してください。");
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
    var objectUrl = URL.createObjectURL(blob);
    try {
      return { image: await loadImage(objectUrl), blob: blob, objectUrl: objectUrl };
    } catch (error) {
      URL.revokeObjectURL(objectUrl);
      throw error;
    }
  }

  async function startCamera() {
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
  function liveAnalyzeLoop() {
    if (!state.stream) return;
    var video = elements["product-3d-camera-video"];
    if (video.readyState >= 2) {
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
    var bg = borderColor(pixels, w, h);
    var silhouette = boundingSilhouette(pixels, w, h, bg);
    var fill = silhouette.width * silhouette.height;
    var issues = [];
    if (sharpness < 95) issues.push("ブレ・ピンぼけ");
    if (mean < 58 || dark / luminance.length > 0.42) issues.push("暗すぎます");
    if (white / luminance.length > 0.23) issues.push("白飛びしています");
    if (fill < 0.15) issues.push("商品が遠すぎます");
    if (fill > 0.82) issues.push("商品が近すぎます");
    if (silhouette.clipped) issues.push("商品が画面から切れています");
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
      silhouette: silhouette,
      hash: hash,
      sourceKind: sourceKind
    };
  }

  function borderColor(pixels, w, h) {
    var r = 0, g = 0, b = 0, count = 0, step = Math.max(1, Math.floor(Math.min(w, h) / 30));
    for (var x = 0; x < w; x += step) {
      [[x, 0], [x, h - 1]].forEach(function (point) { var i = (point[1] * w + point[0]) * 4; r += pixels[i]; g += pixels[i + 1]; b += pixels[i + 2]; count += 1; });
    }
    for (var y = 0; y < h; y += step) {
      [[0, y], [w - 1, y]].forEach(function (point) { var i = (point[1] * w + point[0]) * 4; r += pixels[i]; g += pixels[i + 1]; b += pixels[i + 2]; count += 1; });
    }
    return [r / count, g / count, b / count];
  }
  function boundingSilhouette(pixels, w, h, bg) {
    var minX = w, minY = h, maxX = 0, maxY = 0, count = 0;
    var sumX = 0, sumY = 0, sumXX = 0, sumYY = 0, sumXY = 0;
    for (var y = 0; y < h; y += 2) for (var x = 0; x < w; x += 2) {
      var i = (y * w + x) * 4;
      var d = Math.abs(pixels[i] - bg[0]) + Math.abs(pixels[i + 1] - bg[1]) + Math.abs(pixels[i + 2] - bg[2]);
      if (d > 78) {
        minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
        count += 1; sumX += x; sumY += y; sumXX += x * x; sumYY += y * y; sumXY += x * y;
      }
    }
    if (!count) return { x: 0.25, y: 0.25, width: 0.5, height: 0.5, centerX: 0.5, centerY: 0.5, tilt: 0, clipped: false };
    var pad = 3;
    var centerXpx = sumX / count, centerYpx = sumY / count;
    var covarianceXX = sumXX / count - centerXpx * centerXpx;
    var covarianceYY = sumYY / count - centerYpx * centerYpx;
    var covarianceXY = sumXY / count - centerXpx * centerYpx;
    var tilt = 0.5 * Math.atan2(2 * covarianceXY, covarianceXX - covarianceYY) * 180 / Math.PI;
    return {
      x: minX / w, y: minY / h, width: (maxX - minX) / w, height: (maxY - minY) / h,
      centerX: (minX + maxX) / (2 * w), centerY: (minY + maxY) / (2 * h), tilt: Number(tilt.toFixed(1)),
      clipped: minX <= pad || minY <= pad || maxX >= w - pad || maxY >= h - pad
    };
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
    var guide = accepted.find(function (row) { return row.direction === analysis.direction; }) || accepted[0];
    if (guide && Math.abs(Number(analysis.silhouette.tilt || 0) - Number(guide.silhouette.tilt || 0)) > 18) analysis.issues.push("商品が枠に対して傾きすぎています");
    analysis.accepted = analysis.issues.length === 0;
    analysis.score = Math.max(0, Math.min(100, Math.round(100 - analysis.issues.length * 19 - (analysis.sharpness < 160 ? 8 : 0))));
  }

  async function captureSnapshot(sourceKind) {
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
      var path = captureStoragePath(analysis.direction);
      var upload = await sb.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (upload.error) throw upload.error;
      pendingPath = path;
      var registration = await registerAnalysis(analysis, path, await contentSha256(blob));
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
        perceptual_hash: analysis.hash,
        browser_analyzer_version: "pilot-1"
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
    state.bottomMode = !state.bottomMode;
    state.currentDirection = state.bottomMode ? "bottom" : nextDirection();
    elements["product-3d-bottom-mode"].classList.toggle("active", state.bottomMode);
    elements["product-3d-bottom-mode"].textContent = state.bottomMode ? "通常方向へ戻る" : "反転して底面";
    drawGuide(state.guide);
  }

  async function submitWorkspace() {
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
      var result = await sb.from("product_3d_models").select("dkd_shohin_id").eq("status", "published").in("dkd_shohin_id", missing.slice(0, 300));
      if (!result.error) {
        missing.forEach(function (id) { modelBadgeCache[String(id)] = false; });
        (result.data || []).forEach(function (row) { modelBadgeCache[String(row.dkd_shohin_id)] = true; });
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
    var internal = context !== "customer" && typeof canManageAllImages === "function" && canManageAllImages();
    var models = internal ? await fetchInternalModels(productId(target.product)) : await fetchPublishedModels(productId(target.product));
    var visible = context === "customer" ? models : models.filter(function (model) { return model.product_kind === target.kind; });
    if (!visible.length) {
      var createAction = context === "customer" ? "" : "<button type='button' data-create-3d='" + context + "'>3Dモデルを作成</button>";
      host.innerHTML = "<div class='product-3d-empty-card'><span class='product-3d-cube'>3D</span><strong>公開済み3Dモデルはありません</strong>" + createAction + "</div>";
      return;
    }
    host.innerHTML = visible.map(function (model) {
      var size = model.model_bytes ? (model.model_bytes / 1048576).toFixed(1) + " MB" : "";
      var status = modelStatusLabel(model.status);
      var canOpen = model.published_model_path && (model.status === "published" || model.status === "review");
      var action = canOpen ? "<button type='button' class='product-3d-card-action' data-open-model='" + model.id + "' data-model-context='" + context + "' data-model-product='" + productId(target.product) + "'>確認</button>" : "";
      if (internal && model.status === "review") action += "<button type='button' class='product-3d-card-action publish' data-publish-model='" + model.id + "' data-publish-context='" + context + "'>公開</button>";
      if (internal && (model.status === "needs_capture" || model.status === "failed")) action += "<button type='button' class='product-3d-card-action' data-create-3d='" + context + "'>撮影を再開</button>";
      var note = model.failure_message || (model.additional_capture_instructions && model.additional_capture_instructions.length ? "追加撮影: " + model.additional_capture_instructions.join(" / ") : "");
      return "<div class='product-3d-model-card'><span class='product-3d-cube'>3D</span><span><strong>" + esc(kindLabel(model.product_kind)) + " 3Dモデル <i data-model-status='" + esc(model.status) + "'>" + esc(status) + "</i></strong><small>rev." + model.revision + " " + size + (note ? " / " + esc(note) : "") + "</small></span><span class='product-3d-card-actions'>" + action + "</span></div>";
    }).join("");
  }
  function modelStatusLabel(status) {
    return ({ draft: "撮影中", waiting: "待機", processing: "処理中", needs_capture: "要追加撮影", failed: "失敗", review: "確認待ち", published: "公開済み", archived: "旧版" })[status] || status;
  }
  async function publishModel(modelId, context) {
    if (!window.confirm("確認中の3Dモデルを得意先にも公開します。公開してよろしいですか？")) return;
    var result = await sb.rpc("publish_product_3d_model", { target_model_id: Number(modelId) });
    if (result.error) { alert("3Dモデルを公開できませんでした: " + friendlyError(result.error)); return; }
    var dkdId = String(result.data.dkd_shohin_id);
    delete modelCache[dkdId]; delete internalModelCache[dkdId]; delete modelBadgeCache[dkdId];
    await renderMediaPane(context || "sales"); scheduleBadgeRefresh();
  }
  async function openViewerById(modelId, context, dkdId) {
    var target = selectedTarget(context || "sales");
    var internal = context !== "customer" && typeof canManageAllImages === "function" && canManageAllImages();
    var models = internal ? await fetchInternalModels(dkdId || productId(target.product)) : await fetchPublishedModels(dkdId || productId(target.product));
    var model = models.find(function (row) { return String(row.id) === String(modelId); });
    if (!model) return;
    var signed = await sb.storage.from(BUCKET).createSignedUrl(model.published_model_path, 600);
    if (signed.error) { alert("3Dモデルを開けませんでした: " + friendlyError(signed.error)); return; }
    elements["product-3d-viewer-overlay"].classList.add("show");
    elements["product-3d-viewer-overlay"].setAttribute("aria-hidden", "false");
    elements["product-3d-viewer-title"].textContent = productTitle(target.product) + " / " + kindLabel(model.product_kind);
    elements["product-3d-viewer-loading"].hidden = false;
    try {
      if (viewer) viewer.dispose();
      var module = await import("./product-3d-viewer.js?v=1.1.757");
      viewer = await module.createProduct3DViewer({
        host: elements["product-3d-viewer-stage"],
        url: signed.data.signedUrl,
        fullscreenElement: elements["product-3d-viewer-shell"] || elements["product-3d-viewer-stage"],
        autoRotate: false
      });
      elements["product-3d-viewer-loading"].hidden = true;
    } catch (error) {
      elements["product-3d-viewer-loading"].textContent = "3Dモデルの読込に失敗しました: " + friendlyError(error);
    }
  }
  function closeViewer() {
    elements["product-3d-viewer-overlay"].classList.remove("show");
    elements["product-3d-viewer-overlay"].setAttribute("aria-hidden", "true");
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
