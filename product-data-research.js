(function(root) {
  "use strict";
  var state = { seq: 0, current: null, drafts: new Map(), saving: false };
  var partPattern = /^[A-Za-z0-9][A-Za-z0-9 ./_-]{3,79}$/;
  var byId = function(id) { return document.getElementById(id); };
  var text = function(value) { return String(value == null ? "" : value).trim(); };
  var escape = function(value) { return text(value).replace(/[&<>"']/g, function(c) { return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); };
  function norm(value) { return text(value).toUpperCase().replace(/[-\s\u3000]/g, ""); }
  function matchKey(value) { return norm(value).replace(/^([AM])0+([0-9])T/, "$1$2T").replace(/^0+/, ""); }
  function missingFields(product) {
    var evidence = product.research_registration_evidence || {};
    var missing = [];
    if (!text(product.category_code)) missing.push("カテゴリ");
    if (!text(product.manufacturer) || text(product.manufacturer).length > 80 || /^(不明|未確認|unknown|n\/?a|[-?？])$/i.test(text(product.manufacturer))) missing.push("確認済みメーカー");
    if (!partPattern.test(text(product.genuine_part_number)) && !partPattern.test(text(product.manufacturer_part_number))) missing.push("確認済みの純正品番またはメーカー品番");
    if (text(product.genuine_part_number) && !partPattern.test(text(product.genuine_part_number))) missing.push("純正品番の形式");
    if (text(product.manufacturer_part_number) && !partPattern.test(text(product.manufacturer_part_number))) missing.push("メーカー品番の形式");
    if (norm(product.genuine_part_number) && norm(product.genuine_part_number) === norm(product.manufacturer_part_number)) missing.push("純正品番とメーカー品番の区別");
    if (!partPattern.test(text(evidence.input_part_number))) missing.push("元の取込品番");
    if (["catalog", "partsfan", "web", "document"].indexOf(evidence.source_type) < 0) missing.push("出典の種類");
    if (text(evidence.source_reference).length < 5 || text(evidence.source_reference).length > 1000) missing.push("出典URLまたは資料・ページ");
    if (evidence.identity_confirmed !== true) missing.push("取込品番と同一商品であることの確認");
    if ([matchKey(product.genuine_part_number), matchKey(product.manufacturer_part_number)].indexOf(matchKey(evidence.input_part_number)) < 0) missing.push("取込品番に対応する確認済み品番（品番訂正は取込側で実施）");
    return missing;
  }
  function dialog() {
    var host = byId("product-data-research");
    if (host) return host;
    host = document.createElement("dialog");
    host.id = "product-data-research";
    host.className = "product-data-research";
    host.setAttribute("aria-labelledby", "pdr-title");
    host.innerHTML = "<header><h2 id='pdr-title'>不足データを探す</h2><button type='button' data-pdr-close aria-label='調査画面を閉じる'>閉じる</button></header>" +
      "<p id='pdr-token'></p><p class='pdr-notice'>情報不足は「要調査」です。確認済みの必要情報が揃うまで商品マスタ・在庫は登録しません。検索結果は互換性や同一商品の確定情報ではありません。</p>" +
      "<section aria-label='商品・カタログ調査'><label for='pdr-query'>調べる品番（別品番も検索可）</label><div class='pdr-actions'><input id='pdr-query' maxlength='80'><button type='button' data-pdr-search>既存商品・カタログを調べる</button></div>" +
      "<div class='pdr-actions'><button type='button' data-pdr-copy>取込品番をコピー</button><a href='https://partsfan.com/search/jp/' target='_blank' rel='noopener noreferrer'>Partsfanで調べる ↗</a><a id='pdr-web' target='_blank' rel='noopener noreferrer'>ネットで調べる ↗</a></div>" +
      "<p>Partsfanにはコピーした品番を入力してください。外部サイトの結果は自動登録しません。</p><p id='pdr-search-status' role='status' aria-live='polite'></p><div id='pdr-results'></div></section>" +
      "<section aria-label='確認済み情報による正式登録'><h3>確認した情報で商品マスタへ正式登録</h3><p>既存商品が見つかった場合は新規登録せず、既存商品を再照合します。登録だけでは在庫は増えません。</p>" +
      "<div class='pdr-fields'><label>カテゴリ（必須）<select id='pdr-category'></select></label><label>メーカー（必須）<input id='pdr-manufacturer' maxlength='80' placeholder='不明の場合は登録不可'></label>" +
      "<label>純正品番<input id='pdr-genuine' maxlength='80' placeholder='確認した品番のみ'></label><label>メーカー品番<input id='pdr-mfr-part' maxlength='80' placeholder='確認した品番のみ'></label>" +
      "<label>出典の種類（必須）<select id='pdr-source-type'><option value=''>選択してください</option><option value='catalog'>社内カタログ</option><option value='partsfan'>Partsfan</option><option value='web'>ネット検索で確認した資料</option><option value='document'>原票・現物ラベルなど</option></select></label>" +
      "<label>出典URL／資料名・ページ（必須）<textarea id='pdr-source-reference' maxlength='1000' rows='2'></textarea></label></div>" +
      "<label class='pdr-confirm'><input id='pdr-confirmed' type='checkbox'>取込品番と同一の商品で、メーカー・品番・カテゴリを出典で確認しました（互換候補だけではチェックしない）</label>" +
      "<p id='pdr-gate' role='status' aria-live='polite'></p><p id='pdr-save-status' role='status' aria-live='polite'></p><div class='pdr-actions'><button type='button' id='pdr-save' class='btn-primary' disabled>正式登録して再照合</button><button type='button' data-pdr-close>要調査のまま閉じる</button></div></section>";
    document.body.appendChild(host);
    function changed(event) {
      if (event.target.id !== "pdr-confirmed" && event.target.id !== "pdr-query") byId("pdr-confirmed").checked = false;
      rememberAndCheck();
    }
    host.addEventListener("input", changed);
    host.addEventListener("change", changed);
    host.addEventListener("cancel", function(event) { if (state.saving) event.preventDefault(); });
    host.addEventListener("close", function() {
      // A native close event is queued; it must not clear a newly reopened dialog.
      if (host.open) return;
      state.seq += 1; state.current = null;
    });
    host.addEventListener("click", function(event) {
      if (event.target.closest("[data-pdr-close]")) { if (!state.saving) host.close(); }
      if (event.target.closest("[data-pdr-search]")) search();
      if (event.target.closest("[data-pdr-copy]")) {
        navigator.clipboard.writeText(state.current.token).then(function() { byId("pdr-search-status").textContent = "取込品番をコピーしました。"; }).catch(function() { byId("pdr-search-status").textContent = "コピーできませんでした。上の取込品番を選択してコピーしてください。"; });
      }
      var catalog = event.target.closest("[data-pdr-catalog]");
      if (catalog) adoptCatalog(Number(catalog.dataset.pdrCatalog));
      var existing = event.target.closest("[data-pdr-existing]");
      if (existing) resolve(state.current.products[Number(existing.dataset.pdrExisting)]);
      if (event.target.id === "pdr-save") save();
      if (event.target.closest("[data-pdr-registered]") && state.current.registeredId) resolve({ dkd_shohin_id: state.current.registeredId });
    });
    return host;
  }
  function productInput() {
    return {
      category_code: byId("pdr-category").value,
      manufacturer: text(byId("pdr-manufacturer").value),
      genuine_part_number: text(byId("pdr-genuine").value),
      manufacturer_part_number: text(byId("pdr-mfr-part").value),
      research_registration_evidence: {
        input_part_number: state.current.token,
        source_type: byId("pdr-source-type").value,
        source_reference: text(byId("pdr-source-reference").value),
        identity_confirmed: byId("pdr-confirmed").checked
      }
    };
  }
  function rememberAndCheck() {
    if (!state.current) return;
    state.drafts.set(state.current.token, productInput());
    var missing = missingFields(productInput());
    var blocked = !state.current.searchOK || state.current.searching || state.current.products.length > 0 || !root.canEdit();
    byId("pdr-gate").textContent = missing.length ? "要調査・登録／在庫登録不可：" + missing.join("、") :
      blocked ? "新規登録不可：既存商品・検索状態・登録権限を確認してください。" : "必要情報は揃っています。正式登録時にサーバーで再検証します。在庫登録はその後の再照合が必要です。";
    byId("pdr-save").disabled = state.saving || blocked || missing.length > 0 || !!state.current.registeredId;
    var recovery = byId("pdr-registered");
    if (!recovery && state.current.registeredId) {
      recovery = document.createElement("button");
      recovery.id = "pdr-registered";
      recovery.type = "button";
      recovery.setAttribute("data-pdr-registered", "1");
      recovery.textContent = "登録済み商品を再照合（新規登録しない）";
      byId("pdr-save").parentNode.appendChild(recovery);
    }
    if (recovery) { recovery.hidden = !state.current.registeredId; recovery.disabled = state.saving; }
    byId("pdr-query").disabled = state.saving;
    byId("product-data-research").querySelectorAll("[data-pdr-search],[data-pdr-existing],[data-pdr-catalog]").forEach(function(button) { button.disabled = state.saving; });
    byId("product-data-research").querySelectorAll(".pdr-fields input,.pdr-fields select,.pdr-fields textarea,#pdr-confirmed").forEach(function(input) { input.disabled = state.saving || !!state.current.registeredId; });
  }
  async function search() {
    var current = state.current;
    if (!current || state.saving) return;
    var query = text(byId("pdr-query").value);
    if (!partPattern.test(query)) { byId("pdr-search-status").textContent = "品番を英数字で始まる4～80文字で入力してください。"; return; }
    var seq = ++state.seq;
    current.searchOK = false;
    current.searching = true;
    current.products = [];
    current.catalog = [];
    byId("pdr-search-status").textContent = "商品マスタを全カテゴリで確認し、カタログを検索しています…";
    byId("pdr-results").textContent = "";
    rememberAndCheck();
    try {
      var results = await Promise.all([
        root.fetchCoreProductMasterMatches(query, "", 20, { exactOnly: true }),
        root.sb.from("catalog_vehicle_applications").select("id,source_name,source_code,source_record_key,catalog_manufacturer,genuine_part_number,manufacturer_part_number,part_name,vehicle_model,engine")
          .or("normalized_genuine_part_number.eq." + norm(query) + ",normalized_manufacturer_part_number.eq." + norm(query)).order("id").limit(20)
      ]);
      if (seq !== state.seq || current !== state.current) return;
      if (results[0].error) throw results[0].error;
      if (results[1].error) throw results[1].error;
      current.products = results[0].data || [];
      current.catalog = results[1].data || [];
      current.searchOK = true;
      var html = "<h3>既存商品 " + current.products.length + " 件</h3>";
      current.products.forEach(function(p, i) {
        html += "<div class='pdr-result'><strong>" + escape(p.genuine_part_number || p.manufacturer_part_number) + "</strong><span>" + escape([p.manufacturer_part_number,p.manufacturer,root.tCat(p.category_code || p.category),"DKD " + p.dkd_shohin_id].filter(Boolean).join(" / ")) + "</span><button type='button' data-pdr-existing='" + i + "'>この既存商品を再照合</button></div>";
      });
      html += "<h3>カタログ候補 " + current.catalog.length + " 件</h3>";
      current.catalog.forEach(function(p, i) {
        html += "<div class='pdr-result'><strong>" + escape([p.genuine_part_number,p.manufacturer_part_number].filter(Boolean).join(" / ")) + "</strong><span>" + escape([p.catalog_manufacturer,p.part_name,p.vehicle_model,p.engine,p.source_name || p.source_code].filter(Boolean).join(" / ")) + "</span><button type='button' data-pdr-catalog='" + i + "'>確認用入力欄へ（未登録）</button></div>";
      });
      byId("pdr-results").innerHTML = html;
      byId("pdr-search-status").textContent = "検索完了（各先頭20件）。既存商品があれば新規登録せず再照合してください。0件でも未登録とは断定せず、別品番・出典を確認してください。";
    } catch (error) {
      if (seq !== state.seq || current !== state.current) return;
      byId("pdr-search-status").textContent = "調査できませんでした。登録せず再検索してください：" + (error.message || String(error));
    } finally {
      if (seq === state.seq && current === state.current) { current.searching = false; rememberAndCheck(); }
    }
  }
  function adoptCatalog(index) {
    var row = state.current.catalog[index];
    if (!row || state.saving || state.current.registeredId) return;
    byId("pdr-genuine").value = row.genuine_part_number || "";
    byId("pdr-mfr-part").value = row.manufacturer_part_number || "";
    byId("pdr-manufacturer").value = row.catalog_manufacturer || "";
    byId("pdr-source-type").value = "catalog";
    byId("pdr-source-reference").value = ["catalog_vehicle_applications:" + row.id, row.source_name || row.source_code, row.source_record_key].filter(Boolean).join(" / ");
    byId("pdr-confirmed").checked = false;
    rememberAndCheck();
  }
  async function resolve(product) {
    var current = state.current;
    if (!current || state.saving || !product) return;
    state.saving = true;
    rememberAndCheck();
    try {
      // Fresh master read is mandatory after registration or candidate adoption.
      var fresh = await root.sb.from("core_products").select(root.CORE_PRODUCT_FAST_SELECT || "*").eq("dkd_shohin_id", product.dkd_shohin_id).single();
      if (fresh.error) throw fresh.error;
      await current.onResolved(fresh.data);
      byId("product-data-research").close();
    } catch (error) {
      byId("pdr-save-status").textContent = "再照合未完了（在庫未登録）：" + (error.message || String(error)) + "。既存商品を再検索して再照合してください。";
    } finally { state.saving = false; if (state.current) rememberAndCheck(); }
  }
  async function save() {
    var current = state.current;
    if (!current || state.saving || byId("pdr-save").disabled) return;
    var payload = productInput();
    if (missingFields(payload).length || !root.canEdit() || !current.searchOK || current.products.length) return;
    state.saving = true;
    rememberAndCheck();
    byId("pdr-save-status").textContent = "必須情報と重複を確認して正式登録しています（在庫未登録）…";
    try {
      var result = await root.sb.rpc("register_researched_product", { p_product: payload });
      if (result.error) throw result.error;
      current.registeredId = result.data;
      if (!current.registeredId) throw new Error("登録した商品IDを確認できません。");
      byId("pdr-save-status").textContent = "商品マスタ登録完了。取込品番を再照合しています（在庫未登録）。";
      state.saving = false;
      await resolve({ dkd_shohin_id: current.registeredId });
    } catch (error) {
      // An uncertain response is NOT permission to repeat a master insert.
      current.searchOK = false;
      byId("pdr-save-status").textContent = "登録結果を確認してください（在庫未登録）：" + (error.message || String(error)) + "。再検索して既存商品を確認するまで再登録できません。";
    } finally { state.saving = false; if (state.current) rememberAndCheck(); }
  }
  async function open(options) {
    if (!options || !partPattern.test(text(options.token)) || typeof options.onResolved !== "function") return;
    if (state.saving) return;
    var host = dialog();
    var draft = state.drafts.get(text(options.token)) || {};
    state.current = { token: text(options.token), onResolved: options.onResolved, products: [], catalog: [], searchOK: false, searching: false, registeredId: null };
    var categories = byId("manufacturing-cost-category");
    byId("pdr-category").innerHTML = categories ? categories.innerHTML : "<option value=''>カテゴリを選択</option>";
    var emptyCategory = byId("pdr-category").querySelector("option[value='']");
    if (emptyCategory) emptyCategory.textContent = "カテゴリを選択してください";
    byId("pdr-category").value = draft.category_code || options.category || "";
    byId("pdr-token").textContent = "元の取込品番：" + state.current.token;
    byId("pdr-query").value = state.current.token;
    byId("pdr-web").href = "https://www.google.com/search?q=" + encodeURIComponent('"' + state.current.token + '" 自動車 部品');
    byId("pdr-manufacturer").value = draft.manufacturer || "";
    byId("pdr-genuine").value = draft.genuine_part_number || "";
    byId("pdr-mfr-part").value = draft.manufacturer_part_number || "";
    byId("pdr-source-type").value = (draft.research_registration_evidence || {}).source_type || "";
    byId("pdr-source-reference").value = (draft.research_registration_evidence || {}).source_reference || "";
    byId("pdr-confirmed").checked = false;
    byId("pdr-save-status").textContent = "";
    if (!host.open) host.showModal();
    rememberAndCheck();
    await search();
  }
  root.DcatsProductResearch = { open: open, missingFields: missingFields, matchKey: matchKey };
})(window);
