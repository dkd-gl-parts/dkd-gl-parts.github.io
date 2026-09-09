"use strict";

var salesOrderRevision = null;
var salesOrderRevisionSaving = false;
var salesOrderRevisionSearch = 0;

var SALES_ORDER_REVISION_ENTRY_FIELDS = {
  "customer-order-destination-type":"destination_type", "customer-order-yamato-office-code":"yamato_office_code",
  "customer-order-company":"company_name", "customer-order-recipient":"recipient_name",
  "customer-order-phone":"phone_number", "customer-order-postal-code":"postal_code",
  "customer-order-prefecture":"prefecture_code", "customer-order-address1":"address_line_1",
  "customer-order-address2":"address_line_2", "customer-order-delivery-service":"outbound_shipping_method",
  "customer-order-core-return-service":"core_return_shipping_method", "customer-order-delivery-date":"requested_delivery_date",
  "customer-order-delivery-time":"delivery_time_code", "customer-order-note":"customer_note",
  "customer-order-vehicle-name":"vehicle_name", "customer-order-vehicle-model-code":"vehicle_model_code",
  "customer-order-first-registration":"first_registration_month", "customer-order-chassis-number":"chassis_number",
  "customer-order-engine-model":"engine_model", "customer-order-model-designation":"model_designation_number",
  "customer-order-classification":"classification_number"
};

function salesOrderRevisionEntryFields(selector, values) {
  // Clone the entry form's controls so labels, order and limits have one source.
  var clone = document.querySelector(selector).cloneNode(true);
  [clone].concat(Array.from(clone.querySelectorAll("*"))).forEach(function(element) {
    var sourceId = element.id;
    if (sourceId) element.id = sourceId.replace("customer-order-", "revision-entry-");
    ["for", "aria-labelledby", "aria-describedby", "aria-controls"].forEach(function(attribute) {
      if (element.hasAttribute(attribute)) element.setAttribute(attribute, element.getAttribute(attribute).replace(/customer-order-/g, "revision-entry-"));
    });
    if (SALES_ORDER_REVISION_ENTRY_FIELDS[sourceId]) {
      var key = SALES_ORDER_REVISION_ENTRY_FIELDS[sourceId];
      element.dataset.revisionField = key;
      element.disabled = false;
      element.removeAttribute("min");
      element.removeAttribute("max");
      if (element.tagName === "SELECT") {
        if (key === "prefecture_code") element.innerHTML = "<option value=''>選択してください</option>" + SHIPPING_PREFECTURES.map(function(pref) { return "<option value='" + esc(pref[0]) + "'>" + esc(pref[1]) + "</option>"; }).join("");
        if (key === "delivery_time_code") element.innerHTML = Array.from(document.getElementById(sourceId).querySelectorAll("option")).map(function(option) { return "<option value='" + esc(option.value) + "'>" + esc(option.textContent) + "</option>"; }).join("");
      }
      if (element.tagName !== "SELECT") {
        element.value = values[key] || "";
        if (element.tagName === "TEXTAREA") element.textContent = element.value;
        else element.setAttribute("value", element.value);
      }
    }
  });
  clone.querySelectorAll(".customer-order-postal-test").forEach(function(element) { element.remove(); });
  return clone.outerHTML;
}

function salesOrderRevisionInput(key) {
  return document.querySelector("#sales-order-revision-overlay [data-revision-field='" + key + "']");
}

function salesOrderRevisionDestinationType() {
  return salesOrderRevisionValue("destination_type") === "yamato_office" ? "yamato_office" : "address";
}

function applySalesOrderRevisionYamatoOffice(includeRecipientDefaults) {
  var office = customerOrderYamatoOffice(salesOrderRevisionValue("yamato_office_code"));
  if (!office) return;
  var values = {
    postal_code: office.postal_code,
    prefecture_code: office.prefecture_code,
    address_line_1: office.address_line_1,
    address_line_2: ""
  };
  if (includeRecipientDefaults) {
    values.company_name = office.company_name;
    values.phone_number = office.phone_number;
  }
  Object.keys(values).forEach(function(key) {
    var input = salesOrderRevisionInput(key);
    if (!input) return;
    var recipientDefault = key === "company_name" || key === "phone_number";
    if (!recipientDefault || !String(input.value || "").trim()) input.value = values[key] || "";
  });
}

function configureSalesOrderRevisionDestination(options) {
  options = options || {};
  var officePickup = salesOrderRevisionDestinationType() === "yamato_office";
  var overlay = document.getElementById("sales-order-revision-overlay");
  if (overlay) syncCustomerOrderDestinationChoices(overlay, officePickup ? "yamato_office" : "address");
  var panel = document.getElementById("revision-entry-yamato-office-panel");
  var officeSelect = salesOrderRevisionInput("yamato_office_code");
  if (panel) panel.hidden = !officePickup;
  if (officePickup && officeSelect && !customerOrderYamatoOffice(officeSelect.value) && CUSTOMER_ORDER_YAMATO_OFFICES.length) {
    officeSelect.value = CUSTOMER_ORDER_YAMATO_OFFICES[0].code;
  }
  if (officeSelect) officeSelect.disabled = !officePickup || salesOrderRevisionSaving;
  ["postal_code", "address_line_1", "address_line_2"].forEach(function(key) {
    var input = salesOrderRevisionInput(key);
    if (input) input.readOnly = officePickup;
  });
  var prefecture = salesOrderRevisionInput("prefecture_code");
  if (prefecture) prefecture.disabled = officePickup || salesOrderRevisionSaving;
  var postalButton = document.getElementById("revision-entry-postal-lookup");
  if (postalButton) postalButton.disabled = officePickup || salesOrderRevisionSaving;
  if (officePickup) applySalesOrderRevisionYamatoOffice(options.includeRecipientDefaults !== false);
}

function salesOrderRevisionDeliveryAddressText() {
  var prefecture = salesOrderRevisionInput("prefecture_code");
  var address = salesOrderRevisionValue("address_line_1");
  var prefectureName = prefecture && prefecture.selectedIndex >= 0 && prefecture.value
    ? String((prefecture.options[prefecture.selectedIndex] || {}).textContent || "").trim()
    : "";
  return prefectureName + address;
}

function applySalesOrderRevisionDeliveryQuote(quote, method, changed) {
  var state = salesOrderRevision;
  if (!state) return;
  var shippingDate = document.getElementById("revision-entry-shipping-date");
  var date = salesOrderRevisionInput("requested_delivery_date");
  var time = salesOrderRevisionInput("delivery_time_code");
  var message = document.getElementById("revision-entry-delivery-estimate");
  if (!date || !time || !message) return;
  if (shippingDate) shippingDate.value = quote && quote.available === true ? (quote.shipping_date || "") : (state.order.scheduled_shipping_date || "");
  date.removeAttribute("min");
  date.removeAttribute("max");
  message.removeAttribute("data-i18n");
  Array.prototype.forEach.call(time.options || [], function(option) {
    option.disabled = false;
    option.hidden = false;
  });
  if (!method || !quote || quote.available !== true) {
    date.disabled = true;
    time.disabled = true;
    message.textContent = t("customer_order_delivery_unknown");
    message.className = "customer-order-delivery-estimate warning";
    return;
  }

  var allowedTimeCodes = Array.isArray(quote.allowed_time_codes) ? quote.allowed_time_codes.map(String) : [];
  Array.prototype.forEach.call(time.options || [], function(option) {
    var allowed = !option.value || allowedTimeCodes.indexOf(String(option.value)) >= 0;
    option.disabled = !allowed;
    option.hidden = !allowed;
  });
  if (time.value && allowedTimeCodes.indexOf(String(time.value)) < 0) time.value = "";
  if (quote.requested_date_supported !== true) {
    date.value = "";
    time.value = "";
    date.disabled = true;
    time.disabled = true;
    message.textContent = tf("customer_order_delivery_not_specifiable", {
      service: method.service_name,
      start: customerOrderDeliveryDateLabel(quote.earliest_delivery_date),
      end: customerOrderDeliveryDateLabel(quote.earliest_delivery_date)
    });
    message.className = "customer-order-delivery-estimate restricted";
    return;
  }

  date.disabled = false;
  date.min = quote.earliest_delivery_date;
  date.max = quote.max_requested_delivery_date;
  time.disabled = allowedTimeCodes.length === 0;
  if (changed || (date.value && (date.value < date.min || date.value > date.max))) {
    date.value = quote.automatic_requested_delivery_date || quote.earliest_delivery_date;
  }
  var guidance = tf("customer_order_delivery_manual", {
    ship: customerOrderDeliveryDateLabel(quote.shipping_date),
    date: customerOrderDeliveryDateLabel(quote.earliest_delivery_date),
    max: customerOrderDeliveryDateLabel(quote.max_requested_delivery_date),
    service: method.service_name
  });
  if (quote.resolution === "address_city_conservative") {
    guidance += " " + tf("customer_order_delivery_address_conservative", { city: quote.city_name || "" });
  }
  if (quote.precision && quote.precision !== "exact") {
    guidance += " " + tf("customer_order_delivery_estimated_precision", { precision: quote.precision });
  }
  if (quote.warning) guidance += " " + t("customer_order_delivery_warning_prefix") + String(quote.warning);
  message.textContent = guidance;
  message.className = "customer-order-delivery-estimate" + (quote.warning ? " warning" : " ready");
}

async function configureSalesOrderRevisionDelivery(changed) {
  if (!salesOrderRevision) return;
  var state = salesOrderRevision, order = state.order;
  var code = salesOrderRevisionValue("prefecture_code");
  var allServices = [], seen = {};
  (state.rates || []).filter(function(row) { return String(row.prefecture_code || "27") === (code || "27"); }).forEach(function(row) {
    var key = customerOrderDeliveryServiceKey(row);
    if (!seen[key]) { seen[key] = true; allServices.push(row); }
  });
  allServices.sort(function(a,b) { return customerOrderDeliveryServiceSortValue(a) - customerOrderDeliveryServiceSortValue(b) || a.service_name.localeCompare(b.service_name,"ja"); });
  var outboundServices = salesOrderRevisionDestinationType() === "yamato_office"
    ? allServices.filter(function(row) { return row.carrier_name === "ヤマト運輸"; })
    : allServices;
  [["outbound_shipping_method",outboundServices],["core_return_shipping_method",customerOrderCoreReturnDeliveryServices(allServices)]].forEach(function(pair) {
    var input = salesOrderRevisionInput(pair[0]);
    var key = input.value || customerOrderDeliveryServiceKey(order[pair[0]]);
    var rows = pair[1].slice();
    var saved = customerOrderDeliveryServiceFromKey(key);
    var officeOutbound = pair[0] === "outbound_shipping_method" && salesOrderRevisionDestinationType() === "yamato_office";
    if (saved && !officeOutbound && !rows.some(function(row) { return customerOrderDeliveryServiceKey(row) === key; })) rows.push(saved);
    input.innerHTML = customerOrderDeliveryServiceOptionsHtml(rows);
    input.value = key;
    if (!input.value && rows.length) input.value = customerOrderDeliveryServiceKey(rows[0]);
  });
  var coreRequired = state.items.some(salesOrderRevisionItemNeedsCoreReturn);
  document.getElementById("revision-entry-core-return-service-field").hidden = !coreRequired;
  salesOrderRevisionInput("core_return_shipping_method").disabled = !coreRequired;
  var method = customerOrderDeliveryServiceFromKey(salesOrderRevisionValue("outbound_shipping_method"));
  var date = salesOrderRevisionInput("requested_delivery_date"), time = salesOrderRevisionInput("delivery_time_code");
  var message = document.getElementById("revision-entry-delivery-estimate");
  var postalCode = normalizeCustomerOrderPostalCode(salesOrderRevisionValue("postal_code"));
  var addressText = salesOrderRevisionDeliveryAddressText();
  message.removeAttribute("data-i18n");
  if (!method || (postalCode.length !== 7 && !addressText)) {
    state.deliveryQuoteSeq = (state.deliveryQuoteSeq || 0) + 1;
    date.disabled = true;
    time.disabled = true;
    message.textContent = t("customer_order_delivery_wait");
    message.className = "customer-order-delivery-estimate pending";
    return;
  }

  var requestSeq = state.deliveryQuoteSeq = (state.deliveryQuoteSeq || 0) + 1;
  date.disabled = true;
  time.disabled = true;
  message.textContent = t("customer_order_delivery_checking");
  message.className = "customer-order-delivery-estimate pending";
  try {
    var result = await sb.rpc("get_customer_order_delivery_quote", {
      target_postal_code: postalCode.length === 7 ? postalCode : null,
      target_address: addressText || null,
      target_carrier_name: method.carrier_name,
      target_service_name: method.service_name,
      target_shipping_date: order.scheduled_shipping_date || null
    });
    if (state !== salesOrderRevision || requestSeq !== state.deliveryQuoteSeq) return;
    if (result.error) throw result.error;
    var quote = Array.isArray(result.data) ? (result.data[0] || null) : result.data;
    applySalesOrderRevisionDeliveryQuote(quote && typeof quote === "object" ? quote : null, method, changed);
  } catch(error) {
    if (state !== salesOrderRevision || requestSeq !== state.deliveryQuoteSeq) return;
    console.warn("sales order revision delivery quote failed", error);
    applySalesOrderRevisionDeliveryQuote(null, method, false);
  }
}

async function lookupSalesOrderRevisionPostal() {
  if (!salesOrderRevision || salesOrderRevisionSaving) return;
  var state = salesOrderRevision;
  var code = normalizeCustomerOrderPostalCode(salesOrderRevisionValue("postal_code"));
  var status = document.getElementById("revision-entry-postal-status");
  var host = document.getElementById("revision-entry-postal-results");
  host.innerHTML = ""; host.hidden = true;
  if (code.length !== 7) { status.textContent = t("customer_order_postal_lookup_invalid"); return; }
  var seq = state.postalSeq = (state.postalSeq || 0) + 1;
  var addressBefore = salesOrderRevisionValue("address_line_1");
  status.textContent = t("customer_order_postal_lookup_loading");
  try {
    var rows = [];
    try { rows = await lookupCustomerOrderPostalApi(code); } catch(error) {}
    if (!rows.length) rows = await lookupCustomerOrderPostalLocal(code);
    if (state !== salesOrderRevision || seq !== state.postalSeq || salesOrderRevisionSaving || code !== normalizeCustomerOrderPostalCode(salesOrderRevisionValue("postal_code")) || addressBefore !== salesOrderRevisionValue("address_line_1")) return;
    function apply(row) {
      if (salesOrderRevisionSaving) return;
      ["postal_code","prefecture_code","address_line_1"].forEach(function(key) { salesOrderRevisionInput(key).value = row[key] || ""; });
      host.hidden = true; host.innerHTML = "";
      status.textContent = t("customer_order_address_selected");
      configureSalesOrderRevisionDelivery(true);
    }
    if (rows.length === 1) apply(rows[0]);
    else if (rows.length) {
      host.hidden = false;
      host.innerHTML = rows.map(function(row,index) { return "<button type='button' class='customer-order-postal-result' data-revision-postal='" + index + "'>" + esc(row.display_address) + "</button>"; }).join("");
      host.querySelectorAll("button").forEach(function(button) { button.addEventListener("click",function() { apply(rows[Number(button.dataset.revisionPostal)]); }); });
      status.textContent = t("customer_order_postal_lookup_hint");
    } else status.textContent = t("customer_order_postal_lookup_empty");
  } catch(error) { if (state === salesOrderRevision && seq === state.postalSeq) status.textContent = t("customer_order_postal_lookup_error"); }
}

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

function salesOrderRevisionItemProductNeedsCore(item) {
  return !!item && (item.product_core_return_required === true || item.core_return_required === true || item.core_return_handling === "charge_no_return");
}

function salesOrderRevisionItemNeedsCoreReturn(item) {
  return salesOrderRevisionItemProductNeedsCore(item) && item.core_return_handling !== "charge_no_return";
}

function salesOrderRevisionConfiguredCoreCharge(item) {
  return Math.max(0, parseInt(item && item.configured_core_charge_jpy, 10) || 0);
}

function salesOrderRevisionCorePolicy(item, rows) {
  var candidates = (rows || []).filter(function(row) {
    return normalizeProductKind(row && row.product_kind) === normalizeProductKind(item && item.product_kind);
  });
  var exact = item && item.product_variant_id != null
    ? candidates.find(function(row) { return String(row.product_variant_id) === String(item.product_variant_id); })
    : null;
  if (!exact) {
    candidates.sort(function(a, b) {
      return (Number(b.stock_qty) || 0) - (Number(a.stock_qty) || 0) || (Number(a.product_variant_id) || 0) - (Number(b.product_variant_id) || 0);
    });
    exact = candidates[0] || null;
  }
  return coreReturnPolicyForKind(item && item.product_kind, exact ? [exact] : []);
}

function salesOrderRevisionEffectiveUnitPrice(item) {
  var base = Number(item && item.revision_unit_price_jpy);
  if (!Number.isFinite(base)) return 0;
  return base + (item.core_return_handling === "charge_no_return" ? salesOrderRevisionConfiguredCoreCharge(item) : 0);
}

function salesOrderRevisionCoreChoiceHtml(item, index) {
  if (!salesOrderRevisionItemProductNeedsCore(item)) return "";
  var charged = item.core_return_handling === "charge_no_return";
  var charge = salesOrderRevisionConfiguredCoreCharge(item);
  var badge = charged
    ? "<em class='charge-no-return'>" + esc(t("customer_order_core_charge_no_return_status")) + "</em>"
    : "<em>" + esc(t("core_return_required")) + "</em>";
  return badge + "<label class='customer-order-core-choice sales-order-revision-core-choice'><span>" + esc(t("customer_order_core_handling")) + "</span><select aria-label='" + esc(t("customer_order_core_handling")) + "' data-revision-core-handling='" + index + "'>" +
    "<option value='standard'" + (charged ? "" : " selected") + ">" + esc(t("customer_order_core_return_standard")) + "</option>" +
    "<option value='charge_no_return'" + (charged ? " selected" : "") + (charge > 0 ? "" : " disabled") + ">" +
      esc(charge > 0 ? tf("customer_order_core_charge_no_return_label", { amount: customerOrderCurrency(charge) }) : t("customer_order_core_charge_unset")) +
    "</option></select><small>" + esc(t("customer_order_core_charge_note")) + "</small>" +
    (charge > 0 ? "" : "<small class='setup-required'>" + esc(t("customer_order_core_charge_setup")) + "</small>") + "</label>";
}

async function hydrateSalesOrderRevisionCorePolicies(state) {
  var ids = Array.from(new Set(state.items.map(function(item) { return Number(item.dkd_shohin_id); }).filter(Number.isFinite)));
  var rowsByProduct = {};
  await Promise.all(ids.map(async function(dkdId) {
    rowsByProduct[String(dkdId)] = await fetchProductVariantsByDkdId(dkdId);
  }));
  if (state !== salesOrderRevision) return;
  state.items.forEach(function(item) {
    var policy = salesOrderRevisionCorePolicy(item, rowsByProduct[String(item.dkd_shohin_id)] || []);
    if (item.core_return_handling === "charge_no_return" && Number(item.core_charge_jpy) > 0) {
      item.configured_core_charge_jpy = Number(item.core_charge_jpy);
    } else {
      item.configured_core_charge_jpy = policy && policy.charge != null ? Number(policy.charge) : null;
    }
  });
}

function salesOrderRevisionItemHtml(item, index) {
  return "<div class='customer-order-line' data-revision-item='" + index + "'><div class='customer-order-product'><span>" + esc(productCategoryLabel(item) || "") + " / " + esc(customerProductKindLabel(item.product_kind)) + "</span><strong>" + esc(item.genuine_part_number || item.manufacturer_part_number || item.dkd_shohin_id) + "</strong><small>" + esc([item.manufacturer, item.manufacturer_part_number].filter(Boolean).join(" / ")) + "</small>" + salesOrderRevisionCoreChoiceHtml(item, index) + "</div>" +
    "<label class='customer-order-qty'><span>" + esc(t("customer_order_quantity")) + "</span><input aria-label='" + esc(t("customer_order_quantity")) + "' data-revision-quantity type='number' min='1' max='99' step='1' value='" + esc(item.quantity) + "'></label><label class='customer-order-line-metric'><span>" + esc(t("customer_order_unit_price")) + "</span><input aria-label='" + esc(t("customer_order_unit_price")) + "' data-revision-price type='number' min='0' max='100000000' step='1' value='" + esc(item.revision_unit_price_jpy == null ? "" : item.revision_unit_price_jpy) + "'></label>" +
    "<div class='customer-order-line-metric total'><span>" + esc(t("customer_order_subtotal")) + "</span><strong data-revision-total>" + esc(customerOrderCurrency(Number(item.quantity) * salesOrderRevisionEffectiveUnitPrice(item))) + "</strong></div><button type='button' class='customer-order-remove' data-revision-remove='" + index + "' aria-label='この商品を削除' title='この商品を削除'>×</button></div>";
}

function salesOrderRevisionCaptureItems() {
  document.querySelectorAll("#sales-order-revision-overlay [data-revision-item]").forEach(function(row) {
    var item = salesOrderRevision.items[Number(row.dataset.revisionItem)];
    item.quantity = row.querySelector("[data-revision-quantity]").value;
    item.revision_unit_price_jpy = row.querySelector("[data-revision-price]").value;
    var coreChoice = row.querySelector("[data-revision-core-handling]");
    if (coreChoice) item.core_return_handling = coreChoice.value === "charge_no_return" ? "charge_no_return" : "standard";
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
      configureSalesOrderRevisionDelivery(false);
    });
  });
  body.querySelectorAll("input").forEach(function(input) {
    input.addEventListener("input", function() {
      salesOrderRevisionCaptureItems();
      body.querySelectorAll("[data-revision-item]").forEach(function(row) {
        var item = salesOrderRevision.items[Number(row.dataset.revisionItem)];
        row.querySelector("[data-revision-total]").textContent = customerOrderCurrency(Number(item.quantity) * salesOrderRevisionEffectiveUnitPrice(item));
      });
    });
  });
  body.querySelectorAll("[data-revision-core-handling]").forEach(function(select) {
    select.addEventListener("change", function() {
      salesOrderRevisionCaptureItems();
      renderSalesOrderRevisionItems();
      configureSalesOrderRevisionDelivery(false);
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
  closeSalesOrderRevisionEditor();
  var overlay = document.createElement("div");
  overlay.id = "sales-order-revision-overlay";
  overlay.className = "sales-order-revision-overlay show";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-labelledby", "sales-order-revision-title");
  document.body.appendChild(overlay);
  salesOrderRevision = { order: original, items: original.items.map(function(item) {
    var charged = customerOrderCoreHandlingValue(item) === "charge_no_return";
    var billedCharge = charged ? Math.max(0, Number(item.core_charge_jpy) || 0) : 0;
    return Object.assign({}, item, {
      item_id: item.id,
      product_core_return_required: item.core_return_required === true || charged,
      configured_core_charge_jpy: billedCharge || null,
      core_return_handling: charged ? "charge_no_return" : "standard",
      revision_unit_price_jpy: Math.max(0, Number(item.unit_price_jpy) - billedCharge)
    });
  }) };
  overlay.innerHTML = "<div class='sales-order-revision-dialog'><header><h2 id='sales-order-revision-title'>受注修正</h2><button type='button' data-revision-close aria-label='閉じる'>×</button></header><div class='sales-order-revision-body'>読み込み中...</div></div>";
  overlay.querySelector("[data-revision-close]").addEventListener("click", closeSalesOrderRevisionEditor);
  var state = salesOrderRevision;
  try {
    var customers = await loadDetailSalesCustomerOptions();
    state.rates = await ensureSalesShippingRateRows();
    await hydrateSalesOrderRevisionCorePolicies(state);
    if (state !== salesOrderRevision) return;
    var customerOptions = customers.map(function(customer) { return [customer.id, [customer.source_customer_code, customer.customer_name].filter(Boolean).join(" / ")]; });
    if (!customerOptions.some(function(option) { return String(option[0]) === String(original.sales_customer_id); })) customerOptions.push([original.sales_customer_id, original.customer_name]);
    var values = Object.assign({}, original.shipping_address || {}, original.vehicle_information || {}, {
      requested_delivery_date:original.requested_delivery_date,delivery_time_code:original.delivery_time_code,customer_note:original.customer_note
    });
    var categories = [["", "すべて"]].concat(categoryOptions.map(function(category) { return [category.category_code || category.category, categoryOptionLabel(category)]; }));
    overlay.innerHTML = "<form class='sales-order-revision-dialog' id='sales-order-revision-form'><header><div><h2 id='sales-order-revision-title'>受注修正</h2><span>" + esc(original.order_number) + "</span></div><button type='button' data-revision-close aria-label='閉じる'>×</button></header>" +
      "<div class='sales-order-revision-body'><div class='sales-order-revision-workspace'><div class='sales-order-revision-order-pane'>" +
      "<section><h3>得意先</h3>" + salesOrderRevisionSelect("sales_customer_id", "得意先", customerOptions, original.sales_customer_id) + "</section>" +
      "<section><h3>注文内容</h3><div class='sales-order-revision-search'>" + salesOrderRevisionSelect("search_category", "カテゴリ", categories, "") + salesOrderRevisionField("search", "品番", "", "text", 80) + salesOrderRevisionSelect("search_kind", "商品区分", [["rebuilt","リビルト品"],["aftermarket_new","新品"]], "rebuilt") + "<button type='button' id='sales-order-revision-search'>検索</button></div><div id='sales-order-revision-results' aria-live='polite'></div>" +
      "<div id='sales-order-revision-items' class='customer-order-cart-list'></div></section>" +
      "<section><h3>値引・調整</h3><div id='sales-order-revision-adjustments'>" + (original.order_adjustments || []).map(function(adjustment) { return salesOrderPricingAdjustmentRowHtml(adjustment, original.adjustment_masters || []); }).join("") + "</div><button type='button' id='sales-order-revision-adjustment-add'>調整を追加</button>" +
      "<div class='sales-order-revision-shipping-fee'>" + salesOrderRevisionField("shipping_fee_jpy", "送料", original.shipping_fee_jpy, "number") + "</div></section>" +
      "<section><h3>" + esc(t("customer_order_vehicle_title")) + "</h3>" + salesOrderRevisionEntryFields(".customer-order-vehicle-grid", values) + "</section></div>" +
      "<section class='sales-order-revision-delivery-pane'><div class='sales-order-section-heading'><h3>お届け先</h3><button type='button' id='sales-order-revision-new-address'>" + esc(t("customer_order_address_new")) + "</button></div>" +
      salesOrderRevisionEntryFields(".customer-order-shipping-pane > .customer-order-form-grid", values) + "</section></div>" +
      "</div>" +
      "<footer><div id='sales-order-revision-message' role='status' aria-live='polite'></div><button type='button' data-revision-close>取消</button><button type='submit' id='sales-order-revision-save'>変更を保存</button></footer></form>";
    overlay.querySelectorAll("[data-revision-close]").forEach(function(button) { button.addEventListener("click", closeSalesOrderRevisionEditor); });
    Object.keys(SALES_ORDER_REVISION_ENTRY_FIELDS).forEach(function(sourceId) {
      var key = SALES_ORDER_REVISION_ENTRY_FIELDS[sourceId], input = salesOrderRevisionInput(key);
      if (key.indexOf("shipping_method") >= 0) { input.innerHTML = ""; return; }
      if (input.tagName === "SELECT" && values[key] && !Array.from(input.options).some(function(option) { return option.value === String(values[key]); })) {
        var option = document.createElement("option");
        option.value = values[key]; option.textContent = original.delivery_time_label || values[key];
        input.appendChild(option);
      }
      input.value = values[key] || "";
    });
    if (!salesOrderRevisionValue("destination_type")) salesOrderRevisionInput("destination_type").value = "address";
    overlay.querySelector("form").addEventListener("submit", saveSalesOrderRevision);
    overlay.querySelector("#sales-order-revision-search").addEventListener("click", searchSalesOrderRevisionProducts);
    salesOrderRevisionInput("search").addEventListener("keydown", function(event) { if (event.key === "Enter") { event.preventDefault(); searchSalesOrderRevisionProducts(); } });
    overlay.querySelector("#sales-order-revision-adjustment-add").addEventListener("click", function() {
      document.getElementById("sales-order-revision-adjustments").insertAdjacentHTML("beforeend", salesOrderPricingAdjustmentRowHtml({}, original.adjustment_masters || []));
      prepareSalesOrderRevisionAdjustmentButtons();
    });
    overlay.addEventListener("click", function(event) { var button = event.target.closest("[data-pricing-adjustment-remove]"); if (button && !salesOrderRevisionSaving) button.closest("[data-pricing-adjustment]").remove(); });
    document.getElementById("revision-entry-postal-lookup").addEventListener("click", lookupSalesOrderRevisionPostal);
    document.getElementById("revision-entry-postal-results").innerHTML = "";
    document.getElementById("revision-entry-postal-results").hidden = true;
    document.getElementById("revision-entry-postal-status").removeAttribute("data-i18n");
    document.getElementById("revision-entry-postal-status").textContent = t("customer_order_postal_lookup_hint");
    var shippingDateInput = document.getElementById("revision-entry-shipping-date");
    if (shippingDateInput) shippingDateInput.value = original.scheduled_shipping_date || "";
    salesOrderRevisionInput("postal_code").addEventListener("keydown",function(event) { if (event.key === "Enter") { event.preventDefault(); lookupSalesOrderRevisionPostal(); } });
    salesOrderRevisionInput("destination_type").addEventListener("change", function() {
      configureSalesOrderRevisionDestination({ includeRecipientDefaults: true });
      configureSalesOrderRevisionDelivery(true);
    });
    overlay.querySelectorAll("[data-customer-order-destination-choice]").forEach(function(input) {
      input.addEventListener("change", function() {
        if (!input.checked) return;
        var destinationInput = salesOrderRevisionInput("destination_type");
        if (!destinationInput) return;
        destinationInput.value = input.value;
        destinationInput.dispatchEvent(new Event("change", { bubbles: true }));
      });
    });
    salesOrderRevisionInput("yamato_office_code").addEventListener("change", function() {
      applySalesOrderRevisionYamatoOffice(true);
      configureSalesOrderRevisionDelivery(true);
    });
    ["postal_code","address_line_1"].forEach(function(key) { salesOrderRevisionInput(key).addEventListener("input",function() {
      state.postalSeq = (state.postalSeq || 0) + 1;
      document.getElementById("revision-entry-postal-results").hidden = true;
    }); });
    ["prefecture_code","outbound_shipping_method"].forEach(function(key) { salesOrderRevisionInput(key).addEventListener("change",function() {
      if (key === "prefecture_code") {
        state.postalSeq = (state.postalSeq || 0) + 1;
        document.getElementById("revision-entry-postal-results").hidden = true;
      }
      configureSalesOrderRevisionDelivery(true);
    }); });
    document.getElementById("sales-order-revision-new-address").addEventListener("click",function() {
      salesOrderRevisionInput("destination_type").value = "address";
      ["company_name","recipient_name","phone_number","postal_code","prefecture_code","address_line_1","address_line_2","yamato_office_code"].forEach(function(key) { salesOrderRevisionInput(key).value = ""; });
      configureSalesOrderRevisionDestination({ includeRecipientDefaults: false });
      state.postalSeq = (state.postalSeq || 0) + 1;
      document.getElementById("revision-entry-postal-results").hidden = true;
      document.getElementById("revision-entry-postal-status").textContent = t("customer_order_postal_lookup_hint");
      configureSalesOrderRevisionDelivery(false);
      salesOrderRevisionInput("recipient_name").focus();
    });
    renderSalesOrderRevisionItems();
    prepareSalesOrderRevisionAdjustmentButtons();
    configureSalesOrderRevisionDestination({ includeRecipientDefaults: false });
    configureSalesOrderRevisionDelivery(false);
    overlay.querySelector("select").focus();
  } catch(error) {
    if (state === salesOrderRevision) overlay.querySelector(".sales-order-revision-body").textContent = error.message || "受注情報を読み込めませんでした。";
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
  return field ? String(field.value || "").trim() : "";
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
    results.querySelectorAll("[data-revision-add]").forEach(function(button) { button.addEventListener("click", async function() {
      if (salesOrderRevisionSaving) return;
      var row = rows[Number(button.dataset.revisionAdd)];
      salesOrderRevisionCaptureItems();
      if (salesOrderRevision.items.some(function(item) { return String(item.dkd_shohin_id) === String(row.dkd_shohin_id) && item.product_kind === kind; })) { salesOrderRevisionMessage("同じ商品・区分は1行にまとめてください。", true); return; }
      if (salesOrderRevision.items.length >= 100) { salesOrderRevisionMessage("商品は100件までです。",true); return; }
      var variantRows = await fetchProductVariantsByDkdId(row.dkd_shohin_id);
      if (seq !== salesOrderRevisionSearch || state !== salesOrderRevision || salesOrderRevisionSaving) return;
      var policy = salesOrderRevisionCorePolicy({ product_kind: kind }, variantRows);
      salesOrderRevision.items.push(Object.assign({},row,{item_id:null,product_kind:kind,quantity:1,revision_unit_price_jpy:"",product_core_return_required:!!(policy && policy.required),core_return_required:!!(policy && policy.required),configured_core_charge_jpy:policy && policy.charge != null ? Number(policy.charge) : null,core_return_handling:"standard"}));
      renderSalesOrderRevisionItems();
      configureSalesOrderRevisionDelivery(false);
      salesOrderRevisionMessage("追加した商品の単価を入力してください。", false);
    }); });
  } catch(error) { if (seq === salesOrderRevisionSearch && state === salesOrderRevision) results.textContent = error.message || "検索に失敗しました。"; }
}

function readSalesOrderRevision() {
  salesOrderRevisionCaptureItems();
  if (!salesOrderRevision.items.length) throw new Error("商品を1件以上指定してください。");
  var items = salesOrderRevision.items.map(function(item) {
    var quantity = Number(item.quantity), price = Number(item.revision_unit_price_jpy);
    var charge = item.core_return_handling === "charge_no_return" ? salesOrderRevisionConfiguredCoreCharge(item) : 0;
    if (String(item.revision_unit_price_jpy).trim() === "" || !Number.isInteger(quantity) || quantity < 1 || quantity > 99 || !Number.isInteger(price) || price < 0 || price > 100000000 || (price + charge) * quantity > 2000000000) throw new Error("商品の数量・単価を確認してください。");
    if (item.core_return_handling === "charge_no_return" && charge <= 0) throw new Error(t("customer_order_core_charge_setup"));
    return {item_id:item.item_id || null,dkd_shohin_id:item.dkd_shohin_id,product_kind:item.product_kind,quantity:quantity,unit_price_jpy:price,core_return_handling:item.core_return_handling === "charge_no_return" ? "charge_no_return" : "standard"};
  });
  var shipping = Number(salesOrderRevisionValue("shipping_fee_jpy"));
  if (!Number.isInteger(shipping) || shipping < 0 || shipping > 100000000) throw new Error("送料は0円以上の整数で入力してください。");
  var address = {}, vehicle = {};
  ["company_name","recipient_name","postal_code","phone_number","prefecture_code","address_line_1","address_line_2"].forEach(function(key) { address[key] = salesOrderRevisionValue(key); });
  address.destination_type = salesOrderRevisionDestinationType();
  var prefecture = salesOrderRevisionInput("prefecture_code");
  address.prefecture_name = prefecture && prefecture.selectedIndex >= 0 && prefecture.value ? String(prefecture.options[prefecture.selectedIndex].textContent || "").trim() : "";
  if (address.destination_type === "yamato_office") {
    var office = customerOrderYamatoOffice(salesOrderRevisionValue("yamato_office_code"));
    address.yamato_office_code = office ? office.code : "";
    address.yamato_office_name = office ? office.name : "";
  }
  ["vehicle_name","vehicle_model_code","first_registration_month","chassis_number","engine_model","model_designation_number","classification_number"].forEach(function(key) {
    var value = salesOrderRevisionValue(key).normalize("NFKC");
    vehicle[key] = ["vehicle_name","first_registration_month"].includes(key) ? value : value.toUpperCase();
  });
  function method(key) { return customerOrderDeliveryServiceFromKey(salesOrderRevisionValue(key)); }
  var outboundMethod = method("outbound_shipping_method");
  var destinationError = customerOrderDestinationError(address, outboundMethod);
  if (destinationError) throw new Error(destinationError);
  var adjustments = Array.from(document.querySelectorAll("#sales-order-revision-adjustments [data-pricing-adjustment]")).map(function(row) {
    var amount = Number(row.querySelector("[data-pricing-adjustment-amount]").value);
    if (!Number.isInteger(amount) || amount < 1 || amount > 100000000) throw new Error("値引・調整額を確認してください。");
    return {adjustment_code:row.querySelector("[data-pricing-adjustment-code]").value,amount_jpy:amount,note:row.querySelector("[data-pricing-adjustment-note]").value.trim()};
  });
  return {sales_customer_id:Number(salesOrderRevisionValue("sales_customer_id")),items:items,adjustments:adjustments,shipping_fee_jpy:shipping,shipping_address:address,vehicle_information:vehicle,
    outbound_shipping_method:outboundMethod,core_return_shipping_method:method("core_return_shipping_method"),requested_delivery_date:salesOrderRevisionValue("requested_delivery_date"),delivery_time_code:salesOrderRevisionValue("delivery_time_code"),customer_note:salesOrderRevisionValue("customer_note")};
}

async function saveSalesOrderRevision(event) {
  event.preventDefault();
  if (!salesOrderRevision || salesOrderRevisionSaving || !salesOrderCanRevise(salesOrderRevision.order)) return;
  var state = salesOrderRevision;
  var form = document.getElementById("sales-order-revision-form");
  var responseTimer;
  try {
    var revision = readSalesOrderRevision();
    salesOrderRevisionSaving = true;
    form.querySelectorAll("input,select,textarea,button").forEach(function(element) { element.disabled = true; });
    salesOrderRevisionMessage("受注内容・在庫・金額を確認して保存しています。", false);
    var result = await Promise.race([
      sb.rpc("revise_sales_order", {target_order_id:state.order.id,target_revision:revision,target_reason:"受注修正画面から変更",target_expected_version:state.order.version}),
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
    if (form.isConnected) {
      form.querySelectorAll("input,select,textarea,button").forEach(function(element) { element.disabled = false; });
      configureSalesOrderRevisionDestination({ includeRecipientDefaults: false });
      configureSalesOrderRevisionDelivery(false);
    }
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
