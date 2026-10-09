(function () {
  "use strict";
  var labels = { front: "正面", left: "左側", back: "背面", right: "右側" };
  var views = Object.keys(labels), hashPattern = /^[a-f0-9]{64}$/;
  var MAX_BYTES = 20 * 1024 * 1024;
  var REQUEST_KEY = "5e123f39-434b-4ac7-816c-ff7ea12b3290";
  var PLAN_SHA256 = "72a66c307fc89f916f2305abbe97f77874f88a02fc3acab73196c3fbf7b3abaa";
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
    var cost = root.querySelector("[data-prepared-cost]");
    var start = root.querySelector("[data-prepared-start]"), consent = root.querySelector("[data-prepared-consent]");
    var poll = root.querySelector("[data-prepared-poll]"), previewButton = root.querySelector("[data-prepared-preview]");
    var quote = null, job = null, startAttempted = false;
    var auto = root.querySelector("[data-prepared-auto]"), manual = root.querySelector("[data-prepared-manual]");
    function current(revision) { return context && revision === epoch && context.isCurrent(); }
    function message(value) { status.textContent = value; }
    function controls() {
      check.disabled = busy; file.disabled = busy || !plan || plan.ready; upload.disabled = busy || !plan || plan.ready;
      if (auto) auto.disabled = busy || typeof Worker !== "function" || Boolean(plan && plan.ready && mode === "browser");
      if (manual) manual.disabled = busy;
      if (cost) cost.disabled = busy || !plan || !plan.ready;
      var canStart = !busy && !startAttempted && plan && plan.ready && quote && quote.can_start === true &&
        quote.plan_sha256 === PLAN_SHA256 && Date.now() - Date.parse(quote.checked_at) < 300000;
      if (consent) consent.disabled = !canStart;
      if (start) start.disabled = !canStart || !consent || consent.checked !== true;
      if (poll) poll.disabled = busy || mode !== "browser";
      if (previewButton) previewButton.disabled = busy || !job || job.status !== "review";
    }
    function clear() {
      if (abortRef) abortRef.abort(); abortRef = null;
      if (workerRef) workerRef.terminate(); workerRef = null;
      epoch++; context = null; plan = null; busy = false; root.hidden = true;
      quote = null; job = null; startAttempted = false; if (consent) consent.checked = false;
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
      quote = null; if (consent) consent.checked = false;
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
    async function checkCost() {
      if (busy || !plan || !plan.ready || !context || !context.isCurrent()) return;
      var revision = epoch, approved = plan;
      quote = null; if (consent) consent.checked = false;
      busy = true; controls(); message("4枚の実画像と費用・現在残高を確認しています。生成は開始しません…");
      try {
        var connected = mode === "browser" && approved.plan_sha256 === PLAN_SHA256;
        var result = await context.invoke(connected ? "prepared_quote" : "input_check",
          Object.assign({ plan_sha256: approved.plan_sha256 }, connected ? { request_key: REQUEST_KEY } : {}));
        if (!current(revision)) { if (epoch === revision) clear(); return; }
        if (!validPlan(result, context.target) || !result.ready || result.plan_id !== approved.plan_id ||
            result.plan_sha256 !== approved.plan_sha256 || typeof result.can_start !== "boolean" ||
            (connected ? result.request_key !== REQUEST_KEY || ![null,"prepared_paid_approval_required","prepared_already_reserved","insufficient_credits"].includes(result.blocked_reason) ||
              result.can_start !== (result.blocked_reason === null && result.balance_sufficient === true) : result.can_start !== false || result.blocked_reason !== "prepared_generation_not_connected") ||
            !Number.isSafeInteger(result.estimated_credits) || result.estimated_credits < 1 || result.estimated_credits > 100 ||
            (connected && result.estimated_credits !== 30) ||
            typeof result.balance !== "number" || !Number.isFinite(result.balance) || result.balance < 0 ||
            result.balance_sufficient !== (result.balance >= result.estimated_credits) ||
            typeof result.checked_at !== "string" || !Number.isFinite(Date.parse(result.checked_at)) ||
            !result.images.every(function (image, i) {
              var expected = approved.images[i];
              return previewUrl(image.preview_url) && image.id === expected.id && image.sha256 === expected.sha256 &&
                image.bytes === expected.bytes && image.rotation_clockwise === expected.rotation_clockwise &&
                image.width === expected.width && image.height === expected.height;
            })) throw new Error("Invalid prepared cost check");
        render(result, revision);
        quote = connected ? result : null;
        message("推定 " + result.estimated_credits + " クレジット / 確認時の残高 " + result.balance +
          " クレジット。" + (result.balance_sufficient ? "" : "残高が不足しています。") +
          (connected ? result.blocked_reason === "prepared_already_reserved" ? "この再生成要求は実行済みです。状態を確認してください。" : result.can_start ? "生成はまだ開始していません。同意後に一回だけ開始できます。" : "再生成の接続は準備済みです。別の有料実行承認まで開始できません。" :
            "有料再生成の接続は未完了です。画像のTripo送信・生成・課金は行っていません。"));
      } catch (_) {
        if (current(revision)) {
          plan = null; gallery.textContent = "";
          message("画像または残高を確認できませんでした。生成・課金は行っていません。「状態確認」から確認してください。");
        }
      } finally { if (current(revision)) { busy = false; controls(); } }
    }
    function requestBody() { return { request_key: REQUEST_KEY, plan_sha256: PLAN_SHA256 }; }
    function validJob(value) {
      return value && value.request_key === REQUEST_KEY && value.prepared_plan_sha256 === PLAN_SHA256 &&
        ["reserved","submitted","processing","collecting","review","publishing","published","failed","cancelled","held","rejected"].includes(value.status) &&
        value.start_allowed === false && value.publish_allowed === false && value.reject_allowed === false;
    }
    function jobMessage(value) {
      if (value.status === "review") return "再生成GLBを非公開で保存しました。プレビューで形状を確認してください。商品には公開していません。";
      if (["held","reserved","collecting","publishing"].includes(value.status)) return "処理結果の確認が必要です。再生成を繰り返さず、この要求と初回GLBを保持してください。";
      if (["failed","cancelled","rejected"].includes(value.status)) return "再生成は完了しませんでした。自動再試行しません。初回GLBと商品データは保持しています。";
      return "再生成を処理中です。「再生成の状態を確認」で結果を確認できます。追加生成はしません。";
    }
    async function startPrepared() {
      controls();
      if (!context || !context.isCurrent() || !start || start.disabled || !quote || quote.can_start !== true) return;
      var revision = epoch;
      // Once transmitted, uncertainty must never re-enable this request in the
      // current screen. Server request_key UNIQUE protects reopen/concurrency.
      startAttempted = true; quote = null; consent.checked = false; busy = true; controls();
      message("整列済み4枚で一回だけ生成を開始しています。再送しないでください…");
      try {
        var result = await context.invoke("prepared_start", Object.assign(requestBody(), {
          confirm_paid_generation: true, accepted_estimate_credits: 30,
        }));
        if (!current(revision)) { if (epoch === revision) clear(); return; }
        if (!validJob(result)) throw new Error("Unconfirmed prepared submission");
        job = result; message(jobMessage(result));
      } catch (_) {
        if (current(revision)) message("生成開始の結果を確認できません。再送せず「再生成の状態を確認」を使用してください。初回GLBは保持しています。");
      } finally { if (current(revision)) { busy = false; controls(); } }
    }
    async function pollPrepared() {
      if (busy || !context || !context.isCurrent() || mode !== "browser") return;
      var revision = epoch; busy = true; quote = null; if (consent) consent.checked = false; controls();
      message("再生成の保存済み状態を確認しています。新しい生成は開始しません…");
      try {
        var result = await context.invoke("prepared_latest", requestBody());
        if (!current(revision)) { if (epoch === revision) clear(); return; }
        if (result.status === "none") { job = null; message("この整列入力での再生成はまだ開始していません。初回GLBは保持しています。"); return; }
        if (!validJob(result)) throw new Error("Invalid prepared state");
        if (["submitted","processing"].includes(result.status)) {
          result = await context.invoke("prepared_poll", requestBody());
          if (!current(revision)) { if (epoch === revision) clear(); return; }
          if (!validJob(result)) throw new Error("Invalid prepared state");
        }
        job = result; startAttempted = true; message(jobMessage(result));
      } catch (_) {
        if (current(revision)) { job = null; message("再生成の状態を確認できません。新しい生成は開始せず、時間を置いて状態だけ確認してください。"); }
      } finally { if (current(revision)) { busy = false; controls(); } }
    }
    async function previewPrepared() {
      if (busy || !job || job.status !== "review" || !context || !context.isCurrent() || typeof context.preview !== "function") return;
      var revision = epoch; busy = true; controls();
      try {
        var result = await context.invoke("prepared_preview", requestBody());
        if (!current(revision)) { if (epoch === revision) clear(); return; }
        var url = new URL(result.preview_url);
        if (!validJob(result) || result.status !== "review" || url.protocol !== "https:" ||
            url.hostname !== "jqoeqximtwfpqwzngutj.supabase.co" || url.username || url.password || url.port ||
            !url.pathname.startsWith("/storage/v1/object/sign/product-3d/tripo-review/dkd_2639/aftermarket_new/")) throw new Error("Invalid model preview");
        await context.preview(result, previewButton);
      } catch (_) { if (current(revision)) message("GLBプレビューを確認できません。初回モデルと非公開生成結果は保持しています。"); }
      finally { if (current(revision)) { busy = false; controls(); } }
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
        var worker = new Worker("product-3d-input-worker.mjs?v=1.1.1145", { type: "module" });
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
    if (cost) cost.addEventListener("click", checkCost);
    if (consent) consent.addEventListener("change", controls);
    if (start) start.addEventListener("click", startPrepared);
    if (poll) poll.addEventListener("click", pollPrepared);
    if (previewButton) previewButton.addEventListener("click", previewPrepared);
    return { close: clear, open: function (options) {
      clear();
      if (!options || options.target.productId !== 2639 || options.target.kind !== "aftermarket_new" || !options.isCurrent()) return;
      context = options; root.hidden = false;
      message("端面を含む4方向の整列済み入力候補です。状態確認だけでは画像送信・課金はありません。"); controls();
    } };
  }
  window.DcatsPreparedInputs = Object.freeze({ create: create, validPlan: validPlan, digest: digest });
}());
