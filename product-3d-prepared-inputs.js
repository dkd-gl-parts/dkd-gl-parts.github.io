(function () {
  "use strict";
  var labels = { front: "正面", left: "左側", back: "背面", right: "右側" };
  var views = Object.keys(labels), hashPattern = /^[a-f0-9]{64}$/;
  var MAX_BYTES = 20 * 1024 * 1024;
  function digest(bytes) {
    return crypto.subtle.digest("SHA-256", bytes).then(function (hash) {
      return Array.from(new Uint8Array(hash), function (b) { return b.toString(16).padStart(2, "0"); }).join("");
    });
  }
  function validPlan(plan, target) {
    if (!plan || plan.product_id !== target.productId || plan.product_kind !== target.kind ||
        plan.generation_allowed !== false || typeof plan.ready !== "boolean" ||
        typeof plan.plan_id !== "string" || !/^[a-z0-9-]{1,80}$/.test(plan.plan_id) ||
        !hashPattern.test(plan.plan_sha256) || !Array.isArray(plan.images) || plan.images.length !== 4) return false;
    var ids = new Set(), hashes = new Set();
    return plan.images.every(function (image, index) {
      if (!image || image.view !== views[index] || !Number.isSafeInteger(image.id) || image.id < 1 ||
          ids.has(image.id) || hashes.has(image.sha256) || !hashPattern.test(image.sha256) ||
          !Number.isSafeInteger(image.bytes) || image.bytes < 12 || image.bytes > MAX_BYTES ||
          typeof image.stored !== "boolean" || ![0, 90, 180, 270].includes(image.rotation_clockwise) ||
          !Number.isSafeInteger(image.width) || !Number.isSafeInteger(image.height) ||
          image.width < 1 || image.height < 1 || image.width > 8192 || image.height > 8192 ||
          image.width * image.height > 12500000) return false;
      ids.add(image.id); hashes.add(image.sha256); return true;
    }) && plan.ready === plan.images.every(function (image) { return image.stored; });
  }
  function previewUrl(url) {
    try {
      var parsed = new URL(url);
      return parsed.protocol === "https:" && parsed.hostname === "jqoeqximtwfpqwzngutj.supabase.co" &&
        !parsed.username && !parsed.password && !parsed.port &&
        parsed.pathname.startsWith("/storage/v1/object/sign/product-3d/tripo-input-review/");
    } catch (_) { return false; }
  }
  function create(root) {
    var context = null, epoch = 0, busy = false, plan = null, mode = "browser", workerRef = null, abortRef = null;
    var status = root.querySelector("[data-prepared-status]"), gallery = root.querySelector("[data-prepared-gallery]");
    var check = root.querySelector("[data-prepared-check]"), file = root.querySelector("[data-prepared-file]");
    var upload = root.querySelector("[data-prepared-upload]");
    var auto = root.querySelector("[data-prepared-auto]"), manual = root.querySelector("[data-prepared-manual]");
    function current(revision) { return context && revision === epoch && context.isCurrent(); }
    function message(value) { status.textContent = value; }
    function controls() {
      check.disabled = busy; file.disabled = busy || !plan || plan.ready; upload.disabled = busy || !plan || plan.ready;
      if (auto) auto.disabled = busy || typeof Worker !== "function" || Boolean(plan && plan.ready && mode === "browser");
      if (manual) manual.disabled = busy;
    }
    function clear() {
      if (abortRef) abortRef.abort(); abortRef = null;
      if (workerRef) workerRef.terminate(); workerRef = null;
      epoch++; context = null; plan = null; busy = false; root.hidden = true;
      mode = "browser";
      gallery.textContent = ""; message(""); file.value = ""; controls();
    }
    function render(value, revision) {
      gallery.textContent = "";
      value.images.forEach(function (image) {
        var figure = document.createElement("figure"), caption = document.createElement("figcaption");
        caption.textContent = labels[image.view] + " / ID " + image.id + " / 追加回転 " + image.rotation_clockwise + "°";
        figure.appendChild(caption);
        if (image.preview_url) {
          if (!previewUrl(image.preview_url)) throw new Error("Unexpected preview target");
          var img = document.createElement("img"); img.alt = labels[image.view] + "の検証済み整列写真";
          img.addEventListener("error", function () {
            if (current(revision)) message("写真を表示できません。画像確認は未完了です。状態確認で再取得してください。");
          });
          img.src = image.preview_url; figure.appendChild(img);
        } else {
          var note = document.createElement("p"); note.textContent = image.stored ? "照合済み・プレビュー未取得" : "未登録";
          figure.appendChild(note);
        }
        gallery.appendChild(figure);
      });
    }
    async function refresh() {
      if (busy || !context || !context.isCurrent()) return;
      var revision = epoch; busy = true; plan = null; gallery.textContent = "";
      controls(); message("元写真と整列ファイルを照合しています…");
      try {
        var result = await context.invoke("input_plan", mode === "browser" ? { preparation_mode: "browser" } : {});
        if (!current(revision)) return;
        if (!validPlan(result, context.target)) throw new Error("Invalid reviewed plan");
        plan = result;
        if (plan.ready) {
          var preview = await context.invoke("input_preview", { plan_sha256: plan.plan_sha256 });
          if (!current(revision)) return;
          if (!validPlan(preview, context.target) || !preview.ready || preview.plan_sha256 !== plan.plan_sha256 ||
              !preview.images.every(function (image) { return previewUrl(image.preview_url); })) throw new Error("Invalid verified preview");
          render(preview, revision);
          message("4枚の実ファイルを照合済み。原本は不変更です。有料再生成はまだ開始できません。");
        } else {
          render(plan, revision);
          message(mode === "browser" ? "保存済み写真から整列・非公開登録できます。原本変更・Tripo送信・課金は行いません。" : "整列済みJPEG4枚を選択して非公開登録できます。原本の再登録・Tripo送信・課金は行いません。");
        }
      } catch (_) {
        if (current(revision)) {
          plan = null; gallery.textContent = "";
          message("整列画像を確認できませんでした。原本や登録済みファイルを上書きせず状態を確認してください。");
        }
      } finally { if (current(revision)) { busy = false; controls(); } }
    }
    async function uploadFiles(suppliedFiles) {
      if (busy || !plan || !context || !context.isCurrent()) return;
      var revision = epoch, approved = plan, files = Array.isArray(suppliedFiles) ? suppliedFiles : Array.from(file.files || []);
      file.value = "";
      if (files.length !== 4 || files.some(function (item) {
        return item.size > MAX_BYTES || item.size < 12 || (item.type && item.type !== "image/jpeg");
      })) { message("検証済みの整列JPEG4枚を選択してください。"); return; }
      busy = true; controls(); message("4枚の内容を照合しています。まだ送信していません…");
      try {
        var matched = new Map();
        for (var selected of files) {
          var bytes = await selected.arrayBuffer(), hash = await digest(bytes);
          if (!current(revision)) return;
          var image = approved.images.find(function (item) { return item.sha256 === hash && item.bytes === bytes.byteLength; });
          if (!image || matched.has(image.view)) throw new Error("Selected image mismatch");
          matched.set(image.view, selected);
        }
        // Verify ALL files before requesting a capability or transmitting bytes.
        for (var input of approved.images) {
          if (!current(revision)) return;
          message(labels[input.view] + "を非公開登録しています（課金なし）…");
          var grant = await context.invoke("input_upload", { plan_sha256: approved.plan_sha256, view: input.view });
          if (!current(revision)) return;
          if (grant.plan_sha256 !== approved.plan_sha256 || typeof grant.already_present !== "boolean") throw new Error("Invalid upload grant");
          if (grant.already_present) continue;
          var expectedPath = "tripo-input-review/dkd_" + context.target.productId + "/" + context.target.kind + "/" + approved.plan_id + "/" + input.view + "-" + input.id + "-" + input.sha256 + ".jpg";
          if (grant.bucket !== "product-3d" || grant.path !== expectedPath || grant.sha256 !== input.sha256 ||
              grant.bytes !== input.bytes || grant.content_type !== "image/jpeg" ||
              typeof grant.token !== "string" || !grant.token) throw new Error("Invalid upload grant");
          var result = await context.storage.from("product-3d").uploadToSignedUrl(grant.path, grant.token, matched.get(input.view),
            { contentType: "image/jpeg", cacheControl: "300" });
          if (!current(revision)) return;
          if (result.error) throw new Error("Upload outcome unconfirmed");
        }
        busy = false; await refresh();
      } catch (_) {
        if (current(revision)) message("登録を停止しました。部分登録は保持しています。再送・上書きせず「状態確認」で結果を確認してください。");
      } finally { if (current(revision)) { busy = false; controls(); } }
    }
    function validSourceUrl(value) {
      try {
        var url = new URL(value);
        return url.protocol === "https:" && url.hostname === "jqoeqximtwfpqwzngutj.supabase.co" &&
          !url.username && !url.password && !url.port &&
          url.pathname.startsWith("/storage/v1/object/sign/product-images/dkd_2639/aftermarket_new/");
      } catch (_) { return false; }
    }
    async function downloadOriginal(image, signal) {
      if (!validSourceUrl(image.source_url) || !hashPattern.test(image.source_sha256) ||
          !Number.isSafeInteger(image.source_bytes) || image.source_bytes < 12 || image.source_bytes > MAX_BYTES) throw new Error("Invalid original reference");
      var response = await fetch(image.source_url, { signal: signal, credentials: "omit", redirect: "error", cache: "no-store" });
      if (!response.ok || (response.headers.get("content-type") || "").split(";")[0] !== "image/jpeg") throw new Error("Original unavailable");
      var reader = response.body.getReader(), chunks = [], total = 0;
      try {
        for (;;) {
          var part = await reader.read(); if (part.done) break;
          total += part.value.length;
          if (total > image.source_bytes) { await reader.cancel(); throw new Error("Original too large"); }
          chunks.push(part.value);
        }
      } finally { reader.releaseLock(); }
      if (total !== image.source_bytes) throw new Error("Original size changed");
      var bytes = new Uint8Array(total), offset = 0;
      chunks.forEach(function (chunk) { bytes.set(chunk, offset); offset += chunk.length; });
      if (await digest(bytes) !== image.source_sha256) throw new Error("Original content changed");
      return bytes.buffer;
    }
    function prepareOne(image, bytes, signal) {
      return new Promise(function (resolve, reject) {
        var worker = new Worker("product-3d-input-worker.mjs?v=1.1.1124", { type: "module" });
        workerRef = worker;
        var timer = setTimeout(function () { stop(new Error("Preparation timeout")); }, 120000);
        function cancel() { stop(new Error("Preparation cancelled")); }
        function stop(error, result) {
          clearTimeout(timer); signal.removeEventListener("abort", cancel); worker.terminate();
          if (workerRef === worker) workerRef = null;
          if (error) reject(error); else resolve(result);
        }
        signal.addEventListener("abort", cancel, { once: true });
        worker.onerror = function () { stop(new Error("Preparation worker failed")); };
        worker.onmessage = function (event) {
          if (!event.data || event.data.ok !== true || !(event.data.bytes instanceof ArrayBuffer)) stop(new Error("Preparation mismatch"));
          else stop(null, new File([event.data.bytes], image.view + "-" + image.id + ".jpg", { type: "image/jpeg" }));
        };
        worker.postMessage({ bytes: bytes, source_sha256: image.source_sha256, source_bytes: image.source_bytes,
          rotation_clockwise: image.rotation_clockwise, sha256: image.sha256, output_bytes: image.bytes,
          width: image.width, height: image.height }, [bytes]);
      });
    }
    async function prepareFromSaved() {
      if (busy || !context || !context.isCurrent() || typeof Worker !== "function") return;
      var revision = epoch, abort = new AbortController(); abortRef = abort; mode = "browser";
      var guard = setInterval(function () {
        if (!current(revision)) { abort.abort(); if (epoch === revision) clear(); }
      }, 250);
      busy = true; plan = null; gallery.textContent = ""; controls();
      message("保存済み原本を確認しています。Tripo送信・課金は行いません…");
      try {
        var reviewed = await context.invoke("input_plan", { preparation_mode: "browser" });
        if (!current(revision)) return;
        if (!validPlan(reviewed, context.target) || reviewed.preparation_mode !== "browser") throw new Error("Unexpected preparation plan");
        plan = reviewed;
        if (reviewed.ready) { busy = false; await refresh(); return; }
        var sources = await context.invoke("input_sources", { plan_sha256: reviewed.plan_sha256 });
        if (!current(revision)) return;
        if (!validPlan(sources, context.target) || sources.plan_sha256 !== reviewed.plan_sha256 || sources.preparation_mode !== "browser") throw new Error("Original plan changed");
        var files = [];
        for (var index = 0; index < reviewed.images.length; index++) {
          var image = sources.images[index], expected = reviewed.images[index];
          if (image.id !== expected.id || image.sha256 !== expected.sha256 || image.bytes !== expected.bytes ||
              image.rotation_clockwise !== expected.rotation_clockwise || image.width !== expected.width || image.height !== expected.height) throw new Error("Input binding changed");
          if (!current(revision)) return;
          message(labels[image.view] + "を端末内で整列しています（" + (index + 1) + "/4）。登録・Tripo送信はまだ行っていません…");
          var bytes = await downloadOriginal(image, abort.signal);
          if (!current(revision)) return;
          files.push(await prepareOne(image, bytes, abort.signal));
          if (!current(revision)) return;
        }
        // Existing upload path validates ALL four hashes before any capability.
        busy = false; await uploadFiles(files);
      } catch (_) {
        if (current(revision)) message("画像準備を停止しました。原本は不変更です。自動再試行せず、状態確認または手動登録を使用してください。");
      } finally {
        clearInterval(guard);
        if (abortRef === abort) abortRef = null;
        if (current(revision)) { busy = false; controls(); }
      }
    }
    check.addEventListener("click", refresh); upload.addEventListener("click", function () { return uploadFiles(); });
    if (auto) auto.addEventListener("click", prepareFromSaved);
    if (manual) manual.addEventListener("click", function () { if (busy) return; mode = "offline"; return refresh(); });
    return { close: clear, open: function (options) {
      clear();
      if (!options || options.target.productId !== 2639 || options.target.kind !== "aftermarket_new" || !options.isCurrent()) return;
      context = options; root.hidden = false;
      message("端面を含む4方向の整列済み入力候補です。状態確認だけでは画像送信・課金はありません。"); controls();
    } };
  }
  window.DcatsPreparedInputs = Object.freeze({ create: create, validPlan: validPlan, digest: digest });
}());
