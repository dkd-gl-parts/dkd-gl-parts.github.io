"use strict";

var salesOrderRevision = null;
var salesOrderRevisionSaving = false;
var salesOrderRevisionSearch = 0;

function salesOrderCanRevise(order) {
  return canManageSalesOrders() && !!order && !order.completed_at && !order.cancelled_at && ["submitted", "accepted", "shipping_ready"].includes(order.status);
}

function salesOrderRevisionHistoryHtml(history) {
  return "<div><h4>受注修正履歴</h4>" + ((history || []).map(function(entry) {
    return "<p><time>" + esc(new Date(entry.created_at).toLocaleString()) + "</time><br>" + esc(entry.reason) + "</p>";
  }).join("") || "<span>履歴はありません。</span>") + "</div>";
}

function salesOrderRevisionField(key, label, value, type, max) {
  return "<label><span>" + esc(label) + "</span><input data-revision-field='" + esc(key) + "' type='" + (type || "text") + "' value='" + esc(value == null ? "" : value) + "'" + (max ? " maxlength='" + max + "'" : "") + "></label>";
}

function salesOrderRevisionSelect(key, label, options, value) {
  return "<label><span>" + esc(label) + "</span><select data-revision-field='" + key + "'>" + options.map(function(option) {
    return "<option value='" + esc(option[0]) + "'" + (String(option[0]) === String(value || "") ? " selected" : "") + ">" + esc(option[1]) + "</option>";
  }).join("") + "</select></label>";
}

function salesOrderRevisionServiceKey(method) {
  return JSON.stringify([method && method.carrier_name || "", method && method.service_name || ""]);
}

function salesOrderRevisionItemHtml(item, index) {
  return "<tr data-revision-item='" + index + "'><td><strong>" + esc(item.genuine_part_number || item.manufacturer_part_number || item.dkd_shohin_id) + "</strong><small>" + esc([item.manufacturer, item.manufacturer_part_number].filter(Boolean).join(" / ")) + "</small></td><td>" + esc(customerProductKindLabel(item.product_kind)) + "</td>" +
    "<td><input aria-label='数量' data-revision-quantity type='number' min='1' max='99' step='1' value='" + esc(item.quantity) + "'></td><td><input aria-label='単価' data-revision-price type='number' min='0' max='100000000' step='1' value='" + esc(item.unit_price_jpy == null ? "" : item.unit_price_jpy) + "'></td>" +
    "<td data-revision-total>" + esc(customerOrderCurrency(Number(item.quantity) * Number(item.unit_price_jpy))) + "</td><td><button type='button' data-revision-remove='" + index + "' aria-label='この商品を削除' title='この商品を削除'>×</button></td></tr>";
}

function salesOrderRevisionCaptureItems() {
  document.querySelectorAll("#sales-order-revision-overlay [data-revision-item]").forEach(function(row) {
    var item = salesOrderRevision.items[Number(row.dataset.revisionItem)];
    item.quantity = row.querySelector("[data-revision-quantity]").value;
    item.unit_price_jpy = row.querySelector("[data-revision-price]").value;
  });
}

function renderSalesOrderRevisionItems() {
  var body = document.getElementById("sales-order-revision-items");
  body.innerHTML = salesOrderRevision.items.map(salesOrderRevisionItemHtml).join("");
  body.querySelectorAll("[data-revision-remove]").forEach(function(button) {
    button.addEventListener("click", function() {
      salesOrderRevisionCaptureItems();
      salesOrderRevision.items.splice(Number(button.dataset.revisionRemove), 1);
      renderSalesOrderRevisionItems();
    });
  });
  body.querySelectorAll("input").forEach(function(input) {
    input.addEventListener("input", function() {
      salesOrderRevisionCaptureItems();
      body.querySelectorAll("[data-revision-item]").forEach(function(row) {
        var item = salesOrderRevision.items[Number(row.dataset.revisionItem)];
        row.querySelector("[data-revision-total]").textContent = customerOrderCurrency(Number(item.quantity) * Number(item.unit_price_jpy));
      });
    });
  });
}

function salesOrderRevisionMessage(text, error) {
  var message = document.getElementById("sales-order-revision-message");
  if (message) { message.textContent = text || ""; message.classList.toggle("error", !!error); }
}

function prepareSalesOrderRevisionAdjustmentButtons() {
  document.querySelectorAll("#sales-order-revision-adjustments [data-pricing-adjustment-remove]").forEach(function(button) {
    button.textContent = "×";
    button.title = button.getAttribute("aria-label");
  });
}

async function openSalesOrderRevisionEditor() {
  if (!salesOrderCanRevise(salesOrderDetail) || salesOrderRevisionSaving) return;
  var original = JSON.parse(JSON.stringify(salesOrderDetail));
  if (!(original.order_adjustments || []).length && Number(original.order_discount_jpy) > 0) {
    original.order_adjustments = [{adjustment_code:"discount",amount_jpy:original.order_discount_jpy,note:"旧形式から引継ぎ"}];
  }
  var overlay = document.getElementById("sales-order-revision-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "sales-order-revision-overlay";
    overlay.className = "sales-order-revision-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-labelledby", "sales-order-revision-title");
    document.body.appendChild(overlay);
  }
  salesOrderRevision = { order: original, items: original.items.map(function(item) { return Object.assign({}, item, { item_id: item.id }); }) };
  overlay.innerHTML = "<div class='sales-order-revision-dialog'><header><h2 id='sales-order-revision-title'>受注全体を修正</h2><button type='button' data-revision-close aria-label='閉じる'>×</button></header><div class='sales-order-revision-body'>読み込み中...</div></div>";
  overlay.classList.add("show");
  overlay.querySelector("[data-revision-close]").addEventListener("click", closeSalesOrderRevisionEditor);
  var state = salesOrderRevision;
  try {
    var customers = await loadDetailSalesCustomerOptions();
    var rates = await ensureSalesShippingRateRows();
    if (state !== salesOrderRevision) return;
    var customerOptions = customers.map(function(customer) { return [customer.id, [customer.source_customer_code, customer.customer_name].filter(Boolean).join(" / ")]; });
    if (!customerOptions.some(function(option) { return String(option[0]) === String(original.sales_customer_id); })) customerOptions.push([original.sales_customer_id, original.customer_name]);
    var serviceOptions = [];
    (rates || []).concat([original.outbound_shipping_method, original.core_return_shipping_method, {carrier_name:"佐川急便",service_name:"飛脚宅配便"}]).filter(Boolean).forEach(function(rate) {
      var key = salesOrderRevisionServiceKey(rate);
      if (!serviceOptions.some(function(option) { return option[0] === key; })) serviceOptions.push([key, rate.carrier_name + " / " + rate.service_name]);
    });
    var address = original.shipping_address || {};
    var vehicle = original.vehicle_information || {};
    var prefectures = [["", "選択してください"]].concat(SHIPPING_PREFECTURES.map(function(pref) { return Array.isArray(pref) ? pref : [pref.code,pref.name]; }));
    var vehicleFields = [["vehicle_name","車名",80],["vehicle_model_code","車両型式",40],["first_registration_month","初年度登録",7],["chassis_number","車台番号",60],["engine_model","エンジン型式",40],["model_designation_number","型式指定番号",20],["classification_number","類別区分番号",20]];
    var categories = [["", "すべて"]].concat(categoryOptions.map(function(category) { return [category.category_code || category.category, categoryOptionLabel(category)]; }));
    overlay.innerHTML = "<form class='sales-order-revision-dialog' id='sales-order-revision-form'><header><div><h2 id='sales-order-revision-title'>受注全体を修正</h2><span>" + esc(original.order_number) + "</span></div><button type='button' data-revision-close aria-label='閉じる'>×</button></header>" +
      "<div class='sales-order-revision-body'><section><h3>得意先</h3><div class='sales-order-revision-grid'>" + salesOrderRevisionSelect("sales_customer_id", "得意先", customerOptions, original.sales_customer_id) + "</div></section>" +
      "<section><h3>注文商品</h3><div class='sales-order-revision-search'>" + salesOrderRevisionSelect("search_category", "カテゴリ", categories, "") + salesOrderRevisionField("search", "品番", "", "text", 80) + salesOrderRevisionSelect("search_kind", "商品区分", [["rebuilt","リビルト品"],["aftermarket_new","新品"]], "rebuilt") + "<button type='button' id='sales-order-revision-search'>検索</button></div><div id='sales-order-revision-results' aria-live='polite'></div>" +
      "<div class='sales-order-revision-table'><table><thead><tr><th>品番</th><th>区分</th><th>数量</th><th>単価</th><th>小計</th><th></th></tr></thead><tbody id='sales-order-revision-items'></tbody></table></div></section>" +
      "<section><h3>値引・調整</h3><div id='sales-order-revision-adjustments'>" + (original.order_adjustments || []).map(function(adjustment) { return salesOrderPricingAdjustmentRowHtml(adjustment, original.adjustment_masters || []); }).join("") + "</div><button type='button' id='sales-order-revision-adjustment-add'>調整を追加</button></section>" +
      "<section><h3>お届け先</h3><div class='sales-order-revision-grid'>" + salesOrderRevisionField("company_name", "会社名", address.company_name, "text", 200) + salesOrderRevisionField("recipient_name", "担当者名", address.recipient_name, "text", 200) + salesOrderRevisionField("postal_code", "郵便番号", address.postal_code, "text", 8) + salesOrderRevisionField("phone_number", "電話番号", address.phone_number, "tel", 20) + salesOrderRevisionSelect("prefecture_code", "都道府県", prefectures, address.prefecture_code) + salesOrderRevisionField("address_line_1", "住所", address.address_line_1, "text", 200) + salesOrderRevisionField("address_line_2", "建物名等", address.address_line_2, "text", 200) + "</div></section>" +
      "<section><h3>配送条件</h3><div class='sales-order-revision-grid'>" + salesOrderRevisionSelect("outbound_shipping_method", "商品発送便", serviceOptions, salesOrderRevisionServiceKey(original.outbound_shipping_method)) + salesOrderRevisionSelect("core_return_shipping_method", "コア返却便", serviceOptions, salesOrderRevisionServiceKey(original.core_return_shipping_method)) + salesOrderRevisionField("requested_delivery_date", "お届け希望日", original.requested_delivery_date, "date") + salesOrderRevisionSelect("delivery_time_code", "お届け時間帯", [["","指定なし"],["0812","午前中"],["1214","12〜14時"],["1416","14〜16時"],["1618","16〜18時"],["1820","18〜20時"],["1921","19〜21時"],["1821","18〜21時"]], original.delivery_time_code) + salesOrderRevisionField("shipping_fee_jpy", "送料", original.shipping_fee_jpy, "number") + "</div></section>" +
      "<section><h3>車両情報</h3><div class='sales-order-revision-grid'>" + vehicleFields.map(function(field) { return salesOrderRevisionField(field[0], field[1], vehicle[field[0]], field[0] === "first_registration_month" ? "month" : "text", field[2]); }).join("") + "</div></section>" +
      "<section><h3>注文メモ</h3><textarea data-revision-field='customer_note' maxlength='500'>" + esc(original.customer_note || "") + "</textarea></section>" +
      "<section><h3>変更の確認</h3>" + salesOrderRevisionField("reason", "変更理由", "", "text", 240) + "<label class='sales-order-revision-confirm'><input type='checkbox' id='sales-order-revision-confirm'>変更内容を確認しました。変更前の帳票は使わず、必要な帳票・送り状を再発行します。</label></section></div>" +
      "<footer><div id='sales-order-revision-message' role='status' aria-live='polite'></div><button type='button' data-revision-close>取消</button><button type='submit' id='sales-order-revision-save'>変更を保存</button></footer></form>";
    overlay.querySelectorAll("[data-revision-close]").forEach(function(button) { button.addEventListener("click", closeSalesOrderRevisionEditor); });
    overlay.querySelector("form").addEventListener("submit", saveSalesOrderRevision);
    overlay.querySelector("#sales-order-revision-search").addEventListener("click", searchSalesOrderRevisionProducts);
    overlay.querySelector("[data-revision-field='search']").addEventListener("keydown", function(event) { if (event.key === "Enter") { event.preventDefault(); searchSalesOrderRevisionProducts(); } });
    overlay.querySelector("#sales-order-revision-adjustment-add").addEventListener("click", function() {
      var host = document.getElementById("sales-order-revision-adjustments");
      host.insertAdjacentHTML("beforeend", salesOrderPricingAdjustmentRowHtml({}, original.adjustment_masters || []));
      prepareSalesOrderRevisionAdjustmentButtons();
    });
    overlay.addEventListener("click", function(event) { var button = event.target.closest("[data-pricing-adjustment-remove]"); if (button && !salesOrderRevisionSaving) button.closest("[data-pricing-adjustment]").remove(); });
    renderSalesOrderRevisionItems();
    prepareSalesOrderRevisionAdjustmentButtons();
    overlay.querySelector("select").focus();
  } catch(error) {
    if (state === salesOrderRevision) {
      overlay.querySelector(".sales-order-revision-body").textContent = error.message || "受注情報を読み込めませんでした。";
    }
  }
}

function closeSalesOrderRevisionEditor() {
  if (salesOrderRevisionSaving) return;
  salesOrderRevision = null;
  salesOrderRevisionSearch += 1;
  var overlay = document.getElementById("sales-order-revision-overlay");
  if (overlay) overlay.remove();
  var opener = document.getElementById("sales-order-revision-open");
  if (opener) opener.focus();
}

function salesOrderRevisionValue(key) {
  var field = document.querySelector("#sales-order-revision-overlay [data-revision-field='" + key + "']");
  return field ? String(field.value || "").normalize("NFKC").trim() : "";
}

async function searchSalesOrderRevisionProducts() {
  if (!salesOrderRevision || salesOrderRevisionSaving) return;
  var query = salesOrderRevisionValue("search");
  var category = salesOrderRevisionValue("search_category");
  var kind = salesOrderRevisionValue("search_kind");
  var results = document.getElementById("sales-order-revision-results");
  if (!query) { results.textContent = "品番を入力してください。"; return; }
  if (normalizePartQuery(query).length <= 5 && !category) { results.textContent = "5文字以下の品番は、カテゴリを選択して検索してください。"; return; }
  var seq = ++salesOrderRevisionSearch;
  var state = salesOrderRevision;
  results.textContent = "検索中...";
  try {
    var result = await fetchCoreProductMasterMatches(query, category || null, 20, { includeDksProductCode:false, preferPrefix:true });
    if (seq !== salesOrderRevisionSearch || state !== salesOrderRevision) return;
    if (result.error) throw result.error;
    var rows = result.data || [];
    results.innerHTML = rows.length ? rows.map(function(row,index) { return "<div><span><strong>" + esc(row.genuine_part_number || row.manufacturer_part_number || row.dkd_shohin_id) + "</strong> " + esc([row.manufacturer,row.manufacturer_part_number].filter(Boolean).join(" / ")) + "</span><button type='button' data-revision-add='" + index + "'>追加</button></div>"; }).join("") : "該当する商品がありません。";
    results.querySelectorAll("[data-revision-add]").forEach(function(button) { button.addEventListener("click", function() {
      if (salesOrderRevisionSaving) return;
      var row = rows[Number(button.dataset.revisionAdd)];
      salesOrderRevisionCaptureItems();
      if (salesOrderRevision.items.some(function(item) { return String(item.dkd_shohin_id) === String(row.dkd_shohin_id) && item.product_kind === kind; })) { salesOrderRevisionMessage("同じ商品・区分は1行にまとめてください。", true); return; }
      if (salesOrderRevision.items.length >= 100) { salesOrderRevisionMessage("商品は100件までです。",true); return; }
      salesOrderRevision.items.push(Object.assign({},row,{item_id:null,product_kind:kind,quantity:1,unit_price_jpy:""}));
      renderSalesOrderRevisionItems();
      salesOrderRevisionMessage("追加した商品の単価を入力してください。", false);
    }); });
  } catch(error) { if (seq === salesOrderRevisionSearch && state === salesOrderRevision) results.textContent = error.message || "検索に失敗しました。"; }
}

function readSalesOrderRevision() {
  salesOrderRevisionCaptureItems();
  if (!salesOrderRevision.items.length) throw new Error("商品を1件以上指定してください。");
  var items = salesOrderRevision.items.map(function(item) {
    var quantity = Number(item.quantity), price = Number(item.unit_price_jpy);
    if (String(item.unit_price_jpy).trim() === "" || !Number.isInteger(quantity) || quantity < 1 || quantity > 99 || !Number.isInteger(price) || price < 0 || price > 100000000 || price * quantity > 2000000000) throw new Error("商品の数量・単価を確認してください。");
    return {item_id:item.item_id || null,dkd_shohin_id:item.dkd_shohin_id,product_kind:item.product_kind,quantity:quantity,unit_price_jpy:price};
  });
  var shipping = Number(salesOrderRevisionValue("shipping_fee_jpy"));
  if (!Number.isInteger(shipping) || shipping < 0 || shipping > 100000000) throw new Error("送料は0円以上の整数で入力してください。");
  var address = {}, vehicle = {};
  ["company_name","recipient_name","postal_code","phone_number","prefecture_code","address_line_1","address_line_2"].forEach(function(key) { address[key] = salesOrderRevisionValue(key); });
  ["vehicle_name","vehicle_model_code","first_registration_month","chassis_number","engine_model","model_designation_number","classification_number"].forEach(function(key) { vehicle[key] = salesOrderRevisionValue(key); });
  function method(key) { var values = JSON.parse(salesOrderRevisionValue(key)); return {carrier_name:values[0],service_name:values[1]}; }
  var adjustments = Array.from(document.querySelectorAll("#sales-order-revision-adjustments [data-pricing-adjustment]")).map(function(row) {
    var amount = Number(row.querySelector("[data-pricing-adjustment-amount]").value);
    if (!Number.isInteger(amount) || amount < 1 || amount > 100000000) throw new Error("値引・調整額を確認してください。");
    return {adjustment_code:row.querySelector("[data-pricing-adjustment-code]").value,amount_jpy:amount,note:row.querySelector("[data-pricing-adjustment-note]").value.trim()};
  });
  return {sales_customer_id:Number(salesOrderRevisionValue("sales_customer_id")),items:items,adjustments:adjustments,shipping_fee_jpy:shipping,shipping_address:address,vehicle_information:vehicle,
    outbound_shipping_method:method("outbound_shipping_method"),core_return_shipping_method:method("core_return_shipping_method"),requested_delivery_date:salesOrderRevisionValue("requested_delivery_date"),delivery_time_code:salesOrderRevisionValue("delivery_time_code"),customer_note:salesOrderRevisionValue("customer_note")};
}

async function saveSalesOrderRevision(event) {
  event.preventDefault();
  if (!salesOrderRevision || salesOrderRevisionSaving || !salesOrderCanRevise(salesOrderRevision.order)) return;
  var state = salesOrderRevision;
  var form = document.getElementById("sales-order-revision-form");
  var responseTimer;
  try {
    var revision = readSalesOrderRevision();
    var reason = salesOrderRevisionValue("reason");
    if (reason.length < 2) throw new Error("変更理由を2文字以上で入力してください。");
    if (!document.getElementById("sales-order-revision-confirm").checked) throw new Error("変更内容と帳票の再発行を確認してください。");
    salesOrderRevisionSaving = true;
    form.querySelectorAll("input,select,textarea,button").forEach(function(element) { element.disabled = true; });
    salesOrderRevisionMessage("受注内容・在庫・金額を確認して保存しています。", false);
    var result = await Promise.race([
      sb.rpc("revise_sales_order", {target_order_id:state.order.id,target_revision:revision,target_reason:reason,target_expected_version:state.order.version}),
      new Promise(function(resolve, reject) { responseTimer = window.setTimeout(function() { reject(new Error("保存結果を確認できません。最新の受注内容を確認してください。")); }, 45000); })
    ]);
    if (result.error) throw result.error;
    salesOrderDetail = Array.isArray(result.data) ? result.data[0] : result.data;
    salesOrderRevisionSaving = false;
    closeSalesOrderRevisionEditor();
    renderSalesOrderDetail();
    await refreshSalesOrderManagement();
    setSalesOrderDetailMessage("受注を修正しました。変更前の帳票は破棄し、必要な帳票・送り状を再発行してください。", false);
  } catch(error) {
    if (state === salesOrderRevision) salesOrderRevisionMessage(error.message || "保存結果を確認できません。最新の受注内容を確認してください。", true);
  } finally {
    window.clearTimeout(responseTimer);
    salesOrderRevisionSaving = false;
    if (form.isConnected) form.querySelectorAll("input,select,textarea,button").forEach(function(element) { element.disabled = false; });
  }
}

document.addEventListener("keydown", function(event) {
  var overlay = document.getElementById("sales-order-revision-overlay");
  if (!overlay || !salesOrderRevision) return;
  if (event.key === "Escape") { event.preventDefault(); closeSalesOrderRevisionEditor(); }
  if (event.key === "Tab") {
    var targets = Array.from(overlay.querySelectorAll("button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)")).filter(function(element) { return element.getClientRects().length; });
    var first = targets[0], last = targets[targets.length-1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});
