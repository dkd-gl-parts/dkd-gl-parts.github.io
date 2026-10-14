(function (global) {
  "use strict";
  var VIEWS = { front: "正面", rear: "背面", left: "左側", right: "右側", upper: "真上", bottom: "底面" };
  var COPY = {
    ja: { front:"正面", rear:"背面", left:"左側", right:"右側", upper:"真上", bottom:"底面", clear:"解除", unselected:"未選択", assign:"画像 ID {id}を{view}に指定", expand:"画像 ID {id}を拡大表示", clearView:"{view}の選択を解除", count:"選択済み {n} / 6。向きの選択だけでは送信・生成しません。", loading:"同じ社外新品SLの写真を読み込んでいます…", empty:"この社外新品SLの写真がありません。別の商品・区分の写真は使用しません。", preparing:"{view}を端末内で準備しています（外部送信なし）…", success:"6枚と向きの指定のZIPをダウンロードしました。ZIPをCodexへ添付するか保存先を伝えてください。fal送信・生成・課金はまだ行っていません。", failure:"準備できませんでした。画像の取得・サイズ・重複を確認してください。外部送信・生成は行っていません。", sourceFailure:"写真を取得できませんでした。対象商品・区分とログイン状態を確認してください。外部送信・生成は行っていません。" },
    en: { front:"Front", rear:"Rear", left:"Left", right:"Right", upper:"Top", bottom:"Bottom", clear:"Clear", unselected:"Not selected", assign:"Assign image ID {id} to {view}", expand:"Enlarge image ID {id}", clearView:"Clear {view} selection", count:"Selected {n} / 6. Assigning directions does not upload or generate.", loading:"Loading photos of the same new aftermarket SL variant…", empty:"No photos for this new aftermarket SL variant. Other products and variants will not be used.", preparing:"Preparing {view} on this device (no external upload)…", success:"Downloaded the ZIP with six photos and directions. Attach it to Codex or provide its saved path. No fal upload, generation or charge has occurred.", failure:"Preparation failed. Check photo access, size and duplicates. No external upload or generation has occurred.", sourceFailure:"Photos could not be retrieved. Check product, variant and login status. No external upload or generation has occurred." },
    zh: { front:"正面", rear:"背面", left:"左侧", right:"右侧", upper:"顶面", bottom:"底面", clear:"清除", unselected:"未选择", assign:"将图片 ID {id}指定为{view}", expand:"放大图片 ID {id}", clearView:"清除{view}选择", count:"已选择 {n} / 6。指定方向不会上传或生成。", loading:"正在加载同一全新副厂SL型号的照片…", empty:"此全新副厂SL型号没有照片。不会使用其他商品或型号。", preparing:"正在本机准备{view}（不向外部上传）…", success:"已下载含六张照片和方向的ZIP。请附加到Codex或告知保存路径。尚未向fal上传、生成或收费。", failure:"准备失败。请检查照片访问、大小及重复情况。未向外部上传或生成。", sourceFailure:"无法获取照片。请检查商品、型号及登录状态。未向外部上传或生成。" }
  };
  function copy(key, values) {
    var lang = typeof document !== "undefined" && document.documentElement ? document.documentElement.lang : "ja";
    var text = COPY[/^zh/.test(lang) ? "zh" : /^en/.test(lang) ? "en" : "ja"][key];
    return text.replace(/\{(\w+)\}/g, function (_, name) { return String(values[name]); });
  }
  var MAX_FILE = 8 * 1024 * 1024, MAX_TOTAL = 32 * 1024 * 1024;
  function eligible(target) { return target && target.productId === 2639 && target.kind === "aftermarket_new"; }
  function validRow(row) {
    return row && Number.isSafeInteger(row.id) && row.id > 0 && row.product_variant_id === 15825 &&
      typeof row.storage_path === "string" && /^(sl_42|dkd_2639\/aftermarket_new)\/[A-Za-z0-9_-]+\.(jpe?g|png|webp)$/i.test(row.storage_path);
  }
  function choose(selection, view, id, rows) {
    if (!Object.prototype.hasOwnProperty.call(VIEWS, view) || (id && !rows[id])) return false;
    Object.keys(VIEWS).forEach(function (key) { if (key !== view && id && selection[key] === id) selection[key] = ""; });
    selection[view] = id; return true;
  }
  function ready(selection, rows) {
    var ids = Object.keys(VIEWS).map(function (view) { return selection[view]; });
    return ids.every(function (id) { return id && rows[id] && rows[id].previewUrl; }) && new Set(ids).size === 6;
  }
  function crc32(bytes) {
    var crc = 0xffffffff;
    for (var i = 0; i < bytes.length; i++) { crc ^= bytes[i]; for (var j = 0; j < 8; j++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
    return (crc ^ 0xffffffff) >>> 0;
  }
  function zip(files) {
    var chunks = [], central = [], offset = 0, total = 0;
    if (!Array.isArray(files) || files.length !== 7) throw new Error("Invalid package");
    var names = new Set();
    files.forEach(function (file) {
      if (!/^(front|rear|left|right|upper|bottom)\.jpg$|^manifest\.json$/.test(file.name) || names.has(file.name) ||
          !(file.bytes instanceof Uint8Array) || !file.bytes.length || file.bytes.length > MAX_FILE) throw new Error("Invalid package file");
      names.add(file.name); total += file.bytes.length; if (total > MAX_TOTAL) throw new Error("Package too large");
      var name = new TextEncoder().encode(file.name), crc = crc32(file.bytes);
      var head = new Uint8Array(30 + name.length), hv = new DataView(head.buffer);
      hv.setUint32(0, 0x04034b50, true); hv.setUint16(4, 20, true); hv.setUint32(14, crc, true);
      hv.setUint32(18, file.bytes.length, true); hv.setUint32(22, file.bytes.length, true); hv.setUint16(26, name.length, true); head.set(name, 30);
      var entry = new Uint8Array(46 + name.length), ev = new DataView(entry.buffer);
      ev.setUint32(0, 0x02014b50, true); ev.setUint16(4, 20, true); ev.setUint16(6, 20, true); ev.setUint32(16, crc, true);
      ev.setUint32(20, file.bytes.length, true); ev.setUint32(24, file.bytes.length, true); ev.setUint16(28, name.length, true); ev.setUint32(42, offset, true); entry.set(name, 46);
      chunks.push(head, file.bytes); central.push(entry); offset += head.length + file.bytes.length;
    });
    var centralSize = central.reduce(function (sum, entry) { return sum + entry.length; }, 0);
    var end = new Uint8Array(22), endView = new DataView(end.buffer);
    endView.setUint32(0, 0x06054b50, true); endView.setUint16(8, files.length, true); endView.setUint16(10, files.length, true);
    endView.setUint32(12, centralSize, true); endView.setUint32(16, offset, true);
    return new Blob(chunks.concat(central, [end]), { type: "application/zip" });
  }
  function hash(bytes) {
    return crypto.subtle.digest("SHA-256", bytes).then(function (value) { return Array.from(new Uint8Array(value), function (n) { return n.toString(16).padStart(2, "0"); }).join(""); });
  }
  function bounded(promise) {
    var timer;
    return Promise.race([promise, new Promise(function (_, reject) { timer = setTimeout(function () { reject(new Error("Photo preparation timeout")); }, 30000); })])
      .finally(function () { clearTimeout(timer); });
  }
  async function normalize(blob) {
    if (!(blob instanceof Blob) || blob.size < 12 || blob.size > MAX_FILE || !/^image\/(jpeg|png|webp)$/.test(blob.type)) throw new Error("Invalid photo");
    var bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
    try {
      if (bitmap.width < 128 || bitmap.height < 128 || bitmap.width > 5000 || bitmap.height > 5000 || bitmap.width * bitmap.height > 16000000) throw new Error("Invalid dimensions");
      var canvas = document.createElement("canvas"); canvas.width = bitmap.width; canvas.height = bitmap.height;
      canvas.getContext("2d").drawImage(bitmap, 0, 0);
      var output = await new Promise(function (resolve) { canvas.toBlob(resolve, "image/jpeg", .95); });
      canvas.width = 1; canvas.height = 1;
      if (!output || output.size < 12 || output.size > MAX_FILE) throw new Error("Invalid prepared photo");
      return { bytes: new Uint8Array(await output.arrayBuffer()), width: bitmap.width, height: bitmap.height };
    } finally { bitmap.close(); }
  }
  function create(root) {
    var context = null, epoch = 0, busy = false, rows = Object.create(null), selection = Object.create(null);
    var gallery = root.querySelector("[data-fal-gallery]"), preview = root.querySelector("[data-fal-preview]"), status = root.querySelector("[data-fal-status]");
    var exportButton = root.querySelector("[data-fal-export]"), large = root.querySelector("[data-fal-large]"), largeImage = root.querySelector("[data-fal-large-image]");
    var largeId = "", urls = new Set(), languageObserver = typeof MutationObserver === "function" ? new MutationObserver(function () { if (current(epoch)) render(); }) : null;
    function current(revision) { return context && revision === epoch && eligible(context.target) && context.isCurrent(); }
    function message(text) { status.textContent = text; }
    function node(tag, text) { var item = document.createElement(tag); if (text) item.textContent = text; return item; }
    function buttons(host, id) {
      Object.keys(VIEWS).forEach(function (view) {
        var button = node("button", copy(view)); button.type = "button"; button.dataset.falAssign = view; button.dataset.falImageId = id;
        button.setAttribute("aria-label", copy("assign", { id:id, view:copy(view) }));
        button.setAttribute("aria-pressed", selection[view] === id ? "true" : "false"); button.disabled = busy || !rows[id].previewUrl;
        host.appendChild(button);
      });
    }
    function render() {
      preview.textContent = "";
      Object.keys(VIEWS).forEach(function (view) {
        var figure = node("figure"), id = selection[view], row = id && rows[id]; figure.appendChild(node("strong", copy(view)));
        if (row && row.previewUrl) { var img = node("img"); img.src = row.previewUrl; img.alt = copy(view) + " / ID " + id; figure.appendChild(img); }
        figure.appendChild(node("figcaption", row ? "ID " + id : copy("unselected")));
        if (row) { var clear = node("button", copy("clear")); clear.type = "button"; clear.dataset.falClear = view; clear.disabled = busy; clear.setAttribute("aria-label", copy("clearView", {view:copy(view)})); figure.appendChild(clear); }
        preview.appendChild(figure);
      });
      Array.from(root.querySelectorAll("[data-fal-assign]")).forEach(function (button) {
        var id = button.dataset.falImageId; button.disabled = busy || !rows[id] || !rows[id].previewUrl;
        button.textContent = copy(button.dataset.falAssign); button.setAttribute("aria-label", copy("assign", {id:id,view:copy(button.dataset.falAssign)}));
        button.setAttribute("aria-pressed", selection[button.dataset.falAssign] === id ? "true" : "false");
      });
      exportButton.disabled = busy || !current(epoch) || !ready(selection, rows);
      if (!busy) message(copy("count", {n:Object.keys(VIEWS).filter(function (view) { return selection[view]; }).length}));
    }
    function close() {
      if (languageObserver) languageObserver.disconnect();
      epoch++; context = null; busy = false; rows = Object.create(null); selection = Object.create(null); largeId = "";
      root.hidden = true; gallery.textContent = ""; preview.textContent = ""; large.hidden = true; largeImage.removeAttribute("src"); exportButton.disabled = true;
      urls.forEach(function (url) { URL.revokeObjectURL(url); }); urls.clear(); message("");
    }
    function open(value) {
      close(); if (!value || !eligible(value.target) || typeof value.isCurrent !== "function" || typeof value.readPhoto !== "function" || !value.isCurrent()) return;
      context = value; root.hidden = false; render(); message(copy("loading"));
      if (languageObserver) languageObserver.observe(document.documentElement, {attributes:true,attributeFilter:["lang"]});
    }
    function setRows(items) {
      if (!current(epoch)) return;
      rows = Object.create(null); selection = Object.create(null); gallery.textContent = "";
      (items || []).filter(validRow).forEach(function (row) {
        var id = String(row.id); if (rows[id]) return;
        rows[id] = { id: row.id, storage_path: row.storage_path, product_variant_id: row.product_variant_id, previewUrl: null };
        var figure = node("figure"), expand = node("button"); expand.type = "button"; expand.dataset.falExpand = id; expand.setAttribute("aria-label", copy("expand", {id:id}));
        var img = node("img"); img.dataset.falThumbnail = id; img.alt = "ID " + id; img.loading = "lazy"; expand.appendChild(img); figure.appendChild(expand); figure.appendChild(node("figcaption", "ID " + id));
        var actions = node("div"); actions.className = "product-3d-fal-photo-directions"; buttons(actions, id); figure.appendChild(actions); gallery.appendChild(figure);
      });
      render(); if (!Object.keys(rows).length) message(copy("empty"));
    }
    function updatePreview(id, url) {
      id = String(id); if (!current(epoch) || !rows[id] || typeof url !== "string" || !url) return;
      rows[id].previewUrl = url; var image = root.querySelector("[data-fal-thumbnail='" + id + "']"); if (image) image.src = url; render();
    }
    async function exportPhotos() {
      if (busy || !current(epoch) || !ready(selection, rows)) return;
      var revision = epoch, owner = context, ids = Object.assign({}, selection); busy = true; render();
      var files = [], images = [], total = 0, resultMessage = "";
      urls.forEach(function (url) { URL.revokeObjectURL(url); }); urls.clear();
      try {
        for (var view of Object.keys(VIEWS)) {
          if (!current(revision)) return;
          message(copy("preparing", {view:copy(view)}));
          var row = Object.assign({}, rows[ids[view]]), raw = await bounded(owner.readPhoto(row));
          if (!current(revision)) return;
          if (!(raw instanceof Blob) || raw.size < 12 || raw.size > MAX_FILE) throw new Error("Photo unavailable");
          var originalSha = await hash(await raw.arrayBuffer()); if (!current(revision)) return;
          var prepared = await bounded(normalize(raw)); if (!current(revision)) return;
          var sha = await hash(prepared.bytes); if (!current(revision)) return;
          if (images.some(function (image) { return image.sha256 === sha || image.original_sha256 === originalSha; })) throw new Error("Duplicate photos");
          total += prepared.bytes.length; if (total > MAX_TOTAL) throw new Error("Package too large");
          files.push({ name: view + ".jpg", bytes: prepared.bytes }); images.push({ view: view, image_id: row.id, file: view + ".jpg", sha256: sha, original_sha256: originalSha, bytes: prepared.bytes.length, width: prepared.width, height: prepared.height });
        }
        var manifest = { schema: "dcats-fal-six-view-photo-package-v1", product_id: 2639, product_variant_id: 15825, product_kind: "aftermarket_new", genuine_part_number: "27060-30220", images: images, generation_allowed: false, source_urls_included: false, metadata_stripped: true };
        files.push({ name: "manifest.json", bytes: new TextEncoder().encode(JSON.stringify(manifest, null, 2)) });
        var packageBlob = zip(files); if (!current(revision)) return;
        var url = URL.createObjectURL(packageBlob); urls.add(url);
        var link = node("a"); link.href = url; link.download = "D-CATS_27060-30220_6views.zip"; root.appendChild(link); link.click(); link.remove();
        resultMessage = copy("success");
      } catch (_) { resultMessage = copy("failure"); }
      finally { if (current(revision)) { busy = false; render(); if (resultMessage) message(resultMessage); } }
    }
    root.addEventListener("click", function (event) {
      var button = event.target.closest("button"); if (!button || !root.contains(button) || busy || !current(epoch)) return;
      if (button.hasAttribute("data-fal-export")) { exportPhotos(); return; }
      if (button.dataset.falAssign) { if (choose(selection, button.dataset.falAssign, button.dataset.falImageId, rows)) render(); }
      else if (button.dataset.falClear) { choose(selection, button.dataset.falClear, "", rows); render(); }
      else if (button.dataset.falExpand && rows[button.dataset.falExpand] && rows[button.dataset.falExpand].previewUrl) {
        largeId = button.dataset.falExpand; largeImage.src = rows[largeId].previewUrl; largeImage.alt = "ID " + largeId;
        large.querySelector("[data-fal-large-label]").textContent = "ID " + largeId; var directions = large.querySelector("[data-fal-large-directions]"); directions.textContent = ""; buttons(directions, largeId); large.hidden = false;
      } else if (button.hasAttribute("data-fal-large-close")) {
        large.hidden = true; largeImage.removeAttribute("src"); var trigger = root.querySelector("[data-fal-expand='" + largeId + "']"); largeId = ""; if (trigger) trigger.focus();
      }
    });
    function fail() { if (current(epoch)) { setRows([]); message(copy("sourceFailure")); } }
    return { open: open, close: close, setRows: setRows, updatePreview: updatePreview, exportPhotos: exportPhotos, fail: fail };
  }
  global.DcatsFalPhotoSelection = { create: create, eligible: eligible, validRow: validRow, choose: choose, ready: ready, zip: zip, crc32: crc32, copy:copy, views: Object.freeze(VIEWS) };
})(typeof window === "undefined" ? globalThis : window);
