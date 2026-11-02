(function(root) {
  "use strict";
  var words = {
    ja: { title: "箱マスタ", help: "箱の呼び名と対応する出荷サイズを登録します。同じ出荷サイズの箱を出荷指示書に表示します。", code: "箱コード", name: "箱の呼び名", size: "対応出荷サイズ", length: "内寸・長さ (mm)", width: "内寸・幅 (mm)", height: "内寸・高さ (mm)", sort: "表示順", active: "使用する", edit: "編集", create: "新しい箱", save: "保存", saving: "保存中…", close: "閉じる", reload: "再読み込み", empty: "箱がまだ登録されていません。", loading: "読み込み中…", saved: "箱マスタを保存しました。", error: "箱マスタを読み込めませんでした。", invalid: "箱コード・呼び名・出荷サイズ・内寸を確認してください。内寸は3辺をすべて入力するか、すべて空欄にしてください。", denied: "箱マスタを変更する権限がありません。", dimensions: "内寸", unknown: "未設定", stopped: "使用しない" },
    en: { title: "Packing boxes", help: "Register box names and their shipping sizes. Boxes matching the product shipping size appear on the dispatch sheet.", code: "Box code", name: "Box name", size: "Shipping size", length: "Inside length (mm)", width: "Inside width (mm)", height: "Inside height (mm)", sort: "Display order", active: "In use", edit: "Edit", create: "New box", save: "Save", saving: "Saving…", close: "Close", reload: "Reload", empty: "No boxes have been registered.", loading: "Loading…", saved: "Packing box saved.", error: "Could not load packing boxes.", invalid: "Check the code, name, size and dimensions. Enter all three inside dimensions or leave all three blank.", denied: "You cannot edit packing boxes.", dimensions: "Inside dimensions", unknown: "Not set", stopped: "Not in use" },
    zh: { title: "包装箱主数据", help: "登记箱名及对应的发货尺寸。出货指示单会显示与商品发货尺寸相同的箱。", code: "箱代码", name: "箱名称", size: "对应发货尺寸", length: "内长 (mm)", width: "内宽 (mm)", height: "内高 (mm)", sort: "显示顺序", active: "使用", edit: "编辑", create: "新增包装箱", save: "保存", saving: "保存中…", close: "关闭", reload: "重新读取", empty: "尚未登记包装箱。", loading: "读取中…", saved: "包装箱已保存。", error: "无法读取包装箱。", invalid: "请确认代码、名称、发货尺寸与内尺寸。内尺寸须全部填写或全部留空。", denied: "没有编辑包装箱的权限。", dimensions: "内尺寸", unknown: "未设置", stopped: "不使用" }
  };
  function esc(value) { return String(value == null ? "" : value).replace(/[&<>"']/g, function(c) { return {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]; }); }
  function integer(value, min, max, optional) {
    var text = String(value == null ? "" : value).trim();
    if (!text && optional) return null;
    if (!/^[0-9]+$/.test(text)) throw new Error("invalid");
    var number = Number(text);
    if (!Number.isSafeInteger(number) || number < min || number > max) throw new Error("invalid");
    return number;
  }
  function validate(values) {
    var code = String(values.box_code || "").trim().toUpperCase();
    var name = String(values.box_name || "").trim();
    if (!/^[A-Z0-9][A-Z0-9_-]{0,15}$/.test(code) || !name || Array.from(name).length > 40) throw new Error("invalid");
    var dims = ["inner_length_mm", "inner_width_mm", "inner_height_mm"].map(function(key) { return integer(values[key], 1, 5000, true); });
    if (dims.filter(function(n) { return n !== null; }).length % 3 !== 0) throw new Error("invalid");
    return {box_code: code, box_name: name, shipping_size_cm: integer(values.shipping_size_cm, 1, 500),
      inner_length_mm: dims[0], inner_width_mm: dims[1], inner_height_mm: dims[2],
      display_order: integer(values.display_order, 0, 9999), is_active: values.is_active === true};
  }
  function create(options) {
    var overlay = options.overlay, content = options.content;
    var rows = [], sequence = 0, saving = false, selected = null, trigger = null, owner = null;
    function t(key) { return (words[options.language()] || words.ja)[key]; }
    function live(token, actor) { return token === sequence && actor === options.currentUserId() && options.canRead() && !overlay.hidden; }
    function message(text, error) {
      var host = content.querySelector("[data-box-message]");
      if (host) { host.textContent = text; host.className = "packing-box-message" + (error ? " error" : ""); }
    }
    function form(row) {
      selected = row || null;
      var form = content.querySelector("form");
      if (!form) return;
      form.reset();
      ["box_code", "box_name", "shipping_size_cm", "inner_length_mm", "inner_width_mm", "inner_height_mm", "display_order"].forEach(function(key) {
        form.elements[key].value = row && row[key] != null ? row[key] : key === "display_order" ? "0" : "";
      });
      form.elements.box_code.readOnly = !!row;
      form.elements.is_active.checked = !row || row.is_active;
    }
    function list() {
      var host = content.querySelector("[data-box-list]");
      if (!rows.length) { host.innerHTML = "<p>" + esc(t("empty")) + "</p>"; return; }
      host.innerHTML = "<table><thead><tr>" + ["code","name","size","dimensions","active","edit"].map(function(k) { return "<th>"+esc(t(k))+"</th>"; }).join("")+"</tr></thead><tbody>"+rows.map(function(row) {
        var dims = [row.inner_length_mm,row.inner_width_mm,row.inner_height_mm];
        return "<tr><td>"+esc(row.box_code)+"</td><th scope='row'>"+esc(row.box_name)+"</th><td>"+esc(row.shipping_size_cm)+"</td><td>"+esc(dims.every(Boolean)?dims.join(" × ")+" mm":t("unknown"))+"</td><td>"+esc(t(row.is_active?"active":"stopped"))+"</td><td>"+(options.canEdit()?"<button type='button' data-box-edit='"+esc(row.box_code)+"'>"+esc(t("edit"))+"</button>":"—")+"</td></tr>";
      }).join("")+"</tbody></table>";
    }
    async function load() {
      var token = ++sequence, actor = owner;
      content.querySelector("[data-box-list]").textContent = t("loading");
      try {
        var result = await options.client.rpc("list_packing_boxes");
        if (!live(token, actor)) return;
        if (result.error) throw result.error;
        rows = Array.isArray(result.data) ? result.data : [];
        list();
      } catch (error) { if (live(token, actor)) { content.querySelector("[data-box-list]").textContent = t("error"); message(error.message || t("error"), true); } }
    }
    function close() {
      ++sequence;overlay.hidden = true;
      if (trigger && trigger.isConnected) trigger.focus();
      trigger = null;owner = null;
    }
    async function save(event) {
      event.preventDefault();
      if (saving || !options.canEdit() || owner !== options.currentUserId()) { if (!saving) message(t("denied"),true); return; }
      var values = {}, fields = event.currentTarget.elements;
      ["box_code","box_name","shipping_size_cm","inner_length_mm","inner_width_mm","inner_height_mm","display_order"].forEach(function(key) { values[key] = fields[key].value; });
      values.is_active = fields.is_active.checked;
      try { values = validate(values); } catch (_) { message(t("invalid"),true); return; }
      saving = true;
      var token = sequence, actor = owner, button = fields.namedItem("save");
      var disabledFields = Array.from(event.currentTarget.querySelectorAll("input,button"));
      disabledFields.forEach(function(field) { field.disabled = true; });
      button.disabled = true;button.textContent = t("saving");
      try {
        var result = await options.client.rpc("save_packing_box", {target_box:values,target_expected_revision:selected ? selected.revision : null});
        if (!live(token,actor)) return;
        if (result.error) throw result.error;
        if (!result.data || result.data.box_code !== values.box_code) throw new Error(t("error"));
        message(t("saved"),false);form(result.data);await load();
        if (options.onSaved && owner === options.currentUserId()) Promise.resolve(options.onSaved()).catch(function() {});
      } catch (error) { if (live(token,actor)) message(error.message || t("error"),true); }
      finally { saving = false;disabledFields.forEach(function(field) { if (field.isConnected) field.disabled = false; });if (button.isConnected) button.textContent = t("save"); }
    }
    function open(source) {
      if (!options.canRead() || saving) return;
      owner = options.currentUserId();trigger = source || null;
      content.innerHTML = "<header><h2 id='packing-boxes-title'>"+esc(t("title"))+"</h2><button type='button' data-box-close>"+esc(t("close"))+"</button></header><p>"+esc(t("help"))+"</p><div data-box-message role='status' aria-live='polite'></div><div class='packing-box-table' data-box-list></div><div class='packing-box-tools'><button type='button' data-box-reload>"+esc(t("reload"))+"</button>"+(options.canEdit()?"<button type='button' data-box-new>"+esc(t("create"))+"</button>":"")+"</div>"+(options.canEdit()?"<form class='packing-box-form'>"+["box_code","box_name","shipping_size_cm","inner_length_mm","inner_width_mm","inner_height_mm","display_order"].map(function(key) {
        var label = {box_code:"code",box_name:"name",shipping_size_cm:"size",inner_length_mm:"length",inner_width_mm:"width",inner_height_mm:"height",display_order:"sort"}[key];
        return "<label><span>"+esc(t(label))+"</span><input name='"+key+"'"+(key==="box_code"?" maxlength='16' autocapitalize='characters'":key==="box_name"?" maxlength='80'":" inputmode='numeric'")+(["box_code","box_name","shipping_size_cm","display_order"].indexOf(key)>=0?" required":"")+"></label>";
      }).join("")+"<label class='packing-box-active'><input type='checkbox' name='is_active'><span>"+esc(t("active"))+"</span></label><button type='submit' name='save'>"+esc(t("save"))+"</button></form>":"");
      overlay.hidden = false;
      var inputForm = content.querySelector("form");if (inputForm) inputForm.addEventListener("submit", save);
      form(null);content.querySelector("[data-box-close]").focus();load();
    }
    overlay.addEventListener("click", function(event) {
      if (event.target === overlay || event.target.closest("[data-box-close]")) close();
      var edit = event.target.closest("[data-box-edit]");
      if (edit && !saving) { form(rows.find(function(row) {return row.box_code === edit.dataset.boxEdit;}));var input = content.querySelector("[name=box_name]");if (input) input.focus(); }
      if (event.target.closest("[data-box-reload]") && !saving) load();
      if (event.target.closest("[data-box-new]") && !saving) form(null);
    });
    overlay.addEventListener("keydown", function(event) {
      if (event.key === "Escape") {event.preventDefault();close();}
      if (event.key !== "Tab") return;
      var inputs = Array.from(content.querySelectorAll("button:not(:disabled),input:not(:disabled)")).filter(function(el) {return el.getClientRects().length;});
      var first=inputs[0],last=inputs[inputs.length-1];
      if (event.shiftKey && document.activeElement===first) {event.preventDefault();last.focus();}
      else if (!event.shiftKey && document.activeElement===last) {event.preventDefault();first.focus();}
    });
    return {open:open,close:close};
  }
  var api = {create:create,validate:validate};
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.DcatsPackingBoxes = api;
})(typeof window !== "undefined" ? window : globalThis);
