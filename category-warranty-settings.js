/* Shared category and warranty editor. Server validates every mutation. */
(function(global) {
  'use strict';
  var state = null;
  var serial = 0;
  function el(id) { return document.getElementById(id); }
  function text(key) { return state && state.context ? state.context.t(key) : key; }
  function esc(value) { return String(value == null ? '' : value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function current(s) { return state === s && s.context.currentActor() === s.context.actor && s.context.allowed(); }
  function message(key, error) {
    if (!state) return;
    state.message = key; state.error = !!error;
    var node = el('finished-warranty-policy-message');
    if (node) { node.textContent = text(key); node.classList.toggle('error', !!error); }
  }
  function changed(row) {
    return row.isNew || row.show_to_customers !== row.original.show_to_customers || ['label_ja','label_en','label_zh'].some(function(k){return row[k] !== row.original[k];}) ||
      ['rebuilt','aftermarket_new'].some(function(kind){return ['months','distance'].some(function(k){return row[kind][k] !== row.original[kind][k];});});
  }
  function dirty() { return !!state && state.rows.some(changed); }
  function sync() {
    if (!state) return;
    var busy = state.loading || state.saving;
    el('finished-warranty-policy-save').disabled = busy || state.unknown || !state.revision || !dirty();
    el('category-warranty-add').disabled = busy || state.unknown || !state.revision || !state.canCategories || !state.canWarranty;
    el('category-warranty-reload').disabled = busy;
    el('finished-warranty-policy-close').disabled = state.saving;
    el('finished-warranty-policy-cancel').disabled = state.saving;
    el('category-warranty-count').textContent = state.rows.length + ' ' + text('cw_count');
    var body = el('finished-warranty-policy-body');
    if (body) body.querySelectorAll('input,button').forEach(function(input) {
      input.disabled = busy || state.unknown || (input.dataset.cwName || input.dataset.cwPublic ? !state.canCategories : input.dataset.cwPolicy ? !state.canWarranty : false);
    });
  }
  function render() {
    if (!state) return;
    var body = el('finished-warranty-policy-body');
    if (!body) return;
    var tr = state.context.t;
    document.querySelectorAll('#finished-warranty-policy-overlay [data-i18n]').forEach(function(n){n.textContent=tr(n.dataset.i18n);});
    el('finished-warranty-policy-close').setAttribute('aria-label',text('btn_close'));
    if (state.loading) body.innerHTML = '<tr><td colspan="3">' + esc(text('cw_loading')) + '</td></tr>';
    else body.innerHTML = state.rows.map(function(row) {
      var names = '<div class="category-warranty-names">' + ['ja','en','zh'].map(function(lang) {
        return '<label><span>' + esc(text('cw_' + lang)) + '</span><input type="text" maxlength="100" autocomplete="off" data-cw-name="label_' + lang + '" data-cw-code="' + esc(row.category_code) + '" value="' + esc(row['label_' + lang]) + '" aria-label="' + esc((row.label_ja || text('cw_new')) + ' ' + text('cw_' + lang)) + '"></label>';
      }).join('') + '</div>';
      names += '<label class="category-warranty-publish"><input type="checkbox" data-cw-public="1" data-cw-code="' + esc(row.category_code) + '"' + (row.show_to_customers ? ' checked' : '') + ' aria-label="' + esc((row.label_ja || text('cw_new')) + ' ' + text('cw_customer_publication')) + '"><span>' + esc(text('cw_customer_publication')) + '</span></label>';
      if (row.isNew) names += '<button type="button" class="category-warranty-remove" data-cw-remove="' + esc(row.category_code) + '">' + esc(text('cw_remove')) + '</button>';
      function kindCell(kind) {
        var kindLabel = text(kind === 'rebuilt' ? 'product_kind_rebuilt' : 'product_kind_aftermarket_new');
        var label = (row.label_ja || text('cw_new')) + ' ' + kindLabel + ' ';
        return '<td class="finished-warranty-policy-cell category-warranty-kind ' + kind + '"><div class="finished-warranty-policy-kind">' + esc(kindLabel) + '</div><div class="finished-warranty-policy-inputs">' +
          '<label><span>' + esc(text('sales_warranty_periodInput')) + '</span><input type="number" inputmode="numeric" min="1" max="120" step="1" data-cw-policy="months" data-cw-kind="' + kind + '" data-cw-code="' + esc(row.category_code) + '" value="' + esc(row[kind].months) + '" placeholder="' + esc(text('cw_unset')) + '" aria-label="' + esc(label + text('sales_warranty_periodInput')) + '"></label>' +
          '<label><span>' + esc(text('sales_warranty_distanceInput')) + '</span><input type="number" inputmode="numeric" min="1" max="10000000" step="1" data-cw-policy="distance" data-cw-kind="' + kind + '" data-cw-code="' + esc(row.category_code) + '" value="' + esc(row[kind].distance) + '" aria-label="' + esc(label + text('sales_warranty_distanceInput')) + '"></label></div></td>';
      }
      return '<tr data-cw-row="' + esc(row.category_code) + '"><th scope="row">' + names + '</th>' + kindCell('rebuilt') + kindCell('aftermarket_new') + '</tr>';
    }).join('') || '<tr><td colspan="3">' + esc(text(state.revision ? 'cw_empty' : 'cw_loadError')) + '</td></tr>';
    message(state.message || '',state.error);
    sync();
  }
  function adopt(s, payload) {
    if (!payload || !Array.isArray(payload.categories) || !Array.isArray(payload.policies) || !/^[a-f0-9]{32}$/.test(payload.revision) || typeof payload.can_edit_categories !== 'boolean' || typeof payload.can_edit_warranty !== 'boolean') throw Error('invalid settings response');
    var codes = new Set();
    s.rows = payload.categories.map(function(category) {
      if (!category || typeof category.category_code !== 'string' || typeof category.show_to_customers !== 'boolean' || codes.has(category.category_code) || ['ja','en','zh'].some(function(lang){return typeof category['label_' + lang] !== 'string';})) throw Error('invalid category');
      codes.add(category.category_code);
      var row = {category_code:category.category_code,label_ja:category.label_ja,label_en:category.label_en,label_zh:category.label_zh,show_to_customers:category.show_to_customers,isNew:false};
      ['rebuilt','aftermarket_new'].forEach(function(kind) {
        var policy = payload.policies.find(function(p){return p.category_code === row.category_code && p.product_kind === kind;});
        row[kind] = {months:policy ? String(policy.warranty_months) : '',distance:policy && policy.warranty_distance_km != null ? String(policy.warranty_distance_km) : ''};
      });
      row.original = JSON.parse(JSON.stringify(row));
      return row;
    });
    s.revision = payload.revision; s.canCategories=payload.can_edit_categories; s.canWarranty=payload.can_edit_warranty; s.unknown=false;
  }
  async function load() {
    var s = state;
    if (!s || !current(s) || s.loading || s.saving) return;
    if (dirty() && !global.confirm(text('cw_reloadConfirm'))) return;
    s.loading=true; s.revision=''; s.rows=[]; message('cw_loading'); render();
    try {
      var result=await s.context.rpc('get_category_warranty_settings');
      if (!current(s)) { if (state === s) reset(); return; }
      if (result.error) throw Error('load failed');
      adopt(s,result.data); message('');
    } catch(error) {
      if (!current(s)) { if (state === s) reset(); return; }
      s.revision=''; s.rows=[]; message('cw_loadError',true);
    } finally { if (current(s)) {s.loading=false;render();} }
  }
  async function open(context) {
    if (!context || context.actor !== context.currentActor() || !context.allowed()) return;
    if (state && state.saving) return;
    if (state && current(state)) return;
    state={context:context,rows:[],revision:'',loading:false,saving:false,unknown:false,canCategories:false,canWarranty:false,message:'',error:false,opener:document.activeElement,id:++serial};
    el('finished-warranty-policy-overlay').classList.add('show');
    await load();
    if (state && current(state)) el('finished-warranty-policy-close').focus();
  }
  function reset() {
    state=null;serial+=1;
    var overlay=el('finished-warranty-policy-overlay'); if(overlay)overlay.classList.remove('show');
    var body=el('finished-warranty-policy-body');if(body)body.textContent='';
  }
  function close() {
    if (!state || state.saving) return;
    if (dirty() && !state.unknown && !global.confirm(text('cw_closeConfirm'))) return;
    var opener=state.opener;reset();if(opener && opener.isConnected)opener.focus();
  }
  function invalid(key,row,selector) {
    message(key,true);
    var tr=Array.from(el('finished-warranty-policy-body').querySelectorAll('[data-cw-row]')).find(function(n){return n.dataset.cwRow===row.category_code;});
    var input=tr && tr.querySelector(selector);if(input)input.focus();
    return null;
  }
  function collect() {
    var categories=[],policies=[],seen=new Set();
    for(var row of state.rows) {
      var names={category_code:row.category_code,label_ja:row.label_ja.trim(),label_en:row.label_en.trim() || row.label_ja.trim(),label_zh:row.label_zh.trim() || row.label_ja.trim(),show_to_customers:row.show_to_customers};
      if (!names.label_ja) return invalid('cw_required',row,'[data-cw-name="label_ja"]');
      if (['label_ja','label_en','label_zh'].some(function(k){return Array.from(names[k]).length>100 || /[\x00-\x1F\x7F]/.test(names[k]);})) return invalid('cw_nameInvalid',row,'[data-cw-name]');
      if (seen.has(names.label_ja.toLocaleLowerCase())) return invalid('cw_duplicate',row,'[data-cw-name="label_ja"]');
      seen.add(names.label_ja.toLocaleLowerCase());
      if (row.isNew || names.show_to_customers!==row.original.show_to_customers || ['label_ja','label_en','label_zh'].some(function(k){return names[k]!==row.original[k];})) categories.push(names);
      for (var kind of ['rebuilt','aftermarket_new']) {
        var p=row[kind];
        if (!row.isNew && p.months===row.original[kind].months && p.distance===row.original[kind].distance) continue;
        var input=Array.from(document.querySelectorAll('[data-cw-policy="months"]')).find(function(n){return n.dataset.cwCode===row.category_code && n.dataset.cwKind===kind;});
        if (!/^\d+$/.test(p.months) || !Number.isInteger(Number(p.months)) || Number(p.months)<1 || Number(p.months)>120 || (input && input.validity.badInput)) return invalid('cw_monthsInvalid',row,'[data-cw-kind="' + kind + '"][data-cw-policy="months"]');
        var distanceInput=input && input.closest('td').querySelector('[data-cw-policy="distance"]');
        if ((p.distance!=='' && (!/^\d+$/.test(p.distance) || !Number.isInteger(Number(p.distance)) || Number(p.distance)<1 || Number(p.distance)>10000000)) || (distanceInput && distanceInput.validity.badInput)) return invalid('cw_distanceInvalid',row,'[data-cw-kind="' + kind + '"][data-cw-policy="distance"]');
        policies.push({category_code:row.category_code,product_kind:kind,warranty_months:Number(p.months),warranty_distance_km:p.distance===''?null:Number(p.distance)});
      }
    }
    return {categories:categories,policies:policies};
  }
  async function save() {
    var s=state;if(!s || !current(s) || s.loading || s.saving || s.unknown || !s.revision)return;
    var changes=collect();if(!changes)return;
    if(!changes.categories.length && !changes.policies.length){message('cw_unchanged');return;}
    if ((changes.categories.length && !s.canCategories) || (changes.policies.length && !s.canWarranty)) {message('cw_denied',true);return;}
    s.saving=true;message('cw_saving');sync();
    var payload;
    try {
      var result=await s.context.rpc('save_category_warranty_settings',{target_changes:changes,target_expected_revision:s.revision});
      if(!current(s)){if(state===s)reset();return;}
      if(result.error){
        var code=String(result.error.code || '');
        if(code==='40001'){s.unknown=true;message('cw_conflict',true);}
        else if(code==='42501'){message('cw_denied',true);}
        else if(/^(22|23|40|42|55)/.test(code) || code==='P0001'){message(result.error.message || 'cw_loadError',true);}
        else {s.unknown=true;message('cw_unknown',true);}
      } else {adopt(s,result.data);payload=result.data;message('cw_saved');}
    } catch(error) {
      if(current(s)){s.unknown=true;message('cw_unknown',true);}else if(state===s)reset();
    } finally {if(current(s)){s.saving=false;render();}}
    if(payload && current(s) && s.context.onSaved)s.context.onSaved(payload);
  }
  function add() {
    if(!state || !current(state) || state.loading || state.saving || state.unknown || !state.revision || !state.canCategories || !state.canWarranty)return;
    var code='custom_' + global.crypto.randomUUID().replace(/-/g,'');
    var row={category_code:code,label_ja:'',label_en:'',label_zh:'',show_to_customers:false,isNew:true,rebuilt:{months:'12',distance:''},aftermarket_new:{months:'12',distance:''}};
    row.original=JSON.parse(JSON.stringify(row));state.rows.push(row);message('');render();
    var nodes=el('finished-warranty-policy-body').querySelectorAll('[data-cw-name="label_ja"]');nodes[nodes.length-1].focus();
  }
  var body=el('finished-warranty-policy-body');
  if(body) {
    body.addEventListener('input',function(event){
      var input=event.target;if(!state || !current(state) || state.loading || state.saving || state.unknown)return;
      var row=state.rows.find(function(r){return r.category_code===input.dataset.cwCode;});if(!row)return;
      if(input.dataset.cwPublic && state.canCategories)row.show_to_customers=!!input.checked;
      if(input.dataset.cwName && state.canCategories)row[input.dataset.cwName]=input.value;
      if(input.dataset.cwPolicy && state.canWarranty)row[input.dataset.cwKind][input.dataset.cwPolicy]=input.value;
      sync();
    });
    body.addEventListener('click',function(event){
      var button=event.target.closest('[data-cw-remove]');if(!button || !state || !current(state) || state.saving || state.loading || state.unknown)return;
      state.rows=state.rows.filter(function(r){return !r.isNew || r.category_code!==button.dataset.cwRemove;});render();
      el('category-warranty-add').focus();
    });
  }
  el('category-warranty-add').addEventListener('click',add);
  el('category-warranty-reload').addEventListener('click',load);
  document.addEventListener('keydown',function(event){
    if(!state || !el('finished-warranty-policy-overlay').classList.contains('show'))return;
    if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close();}
    if(event.key==='Tab'){
      var nodes=Array.from(el('finished-warranty-policy-overlay').querySelectorAll('button:not([disabled]),input:not([disabled])')).filter(function(n){return n.getClientRects().length;});
      var first=nodes[0],last=nodes[nodes.length-1];if(!first){event.preventDefault();return;}
      if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus();}
    }
  });
  global.DcatsCategoryWarrantySettings={open:open,close:close,save:save,render:render,reset:reset,isOpen:function(){return !!state;}};
})(window);
