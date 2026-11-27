"use strict";

// Same project, SDK and auth storage as the order-entry application.
const practiceClient = supabase.createClient("https://jqoeqximtwfpqwzngutj.supabase.co", "sb_publishable_TXdCwBQOD_s3N0TqFCDOAw_8B44a0kv", {
  auth: { storageKey: "sb-jqoeqximtwfpqwzngutj-auth-token", detectSessionInUrl: false }
});
const prefectures = "北海道 青森県 岩手県 宮城県 秋田県 山形県 福島県 茨城県 栃木県 群馬県 埼玉県 千葉県 東京都 神奈川県 新潟県 富山県 石川県 福井県 山梨県 長野県 岐阜県 静岡県 愛知県 三重県 滋賀県 京都府 大阪府 兵庫県 奈良県 和歌山県 鳥取県 島根県 岡山県 広島県 山口県 徳島県 香川県 愛媛県 高知県 福岡県 佐賀県 長崎県 熊本県 大分県 宮崎県 鹿児島県 沖縄県".split(" ");

async function rows(query) {
  const result = await query;
  if (result.error) throw new Error("D-CATSの登録データを取得できません。接続と閲覧権限を確認してください。");
  return result.data;
}
function delivery(customer) {
  const address = (customer.address1 || "").trim();
  const prefecture = prefectures.find(name => address.startsWith(name));
  const phone = customer.phone1 || customer.phone2 || "";
  if (!prefecture || !/^\d{7}$/.test((customer.postal_code || "").replace(/\D/g,"")) ||
      !/^\d{10,11}$/.test(phone.replace(/\D/g,""))) return null;
  return { destination_type:"address", company_name:customer.customer_name, recipient_name:customer.contact_name || customer.customer_name,
    postal_code:customer.postal_code, phone_number:phone, prefecture_name:prefecture, prefecture_code:prefectures.indexOf(prefecture)+1,
    address_line_1:address.slice(prefecture.length).trim(), address_line_2:customer.address2 || "" };
}
async function loadPracticeMaster() {
  const identity = await practiceClient.auth.getUser();
  if (!identity.data.user) throw new Error("D-CATSにログインしてから、この注文書を開き直してください。");
  const access = await rows(practiceClient.rpc("get_customer_order_feature_status"));
  if (!access?.internal_management) throw new Error("通常受注を利用できる社内アカウントで開いてください。");
  const [customers, variants, categories] = await Promise.all([
    rows(practiceClient.from("sales_customers").select("id,source_customer_code,billing_customer_code,customer_name,contact_name,postal_code,address1,address2,phone1,phone2")
      .eq("is_active",true).eq("source_code","hanbaiou").order("source_customer_code").order("id").limit(100)),
    rows(practiceClient.from("core_product_variants").select("dkd_shohin_id,product_kind,stock_qty,core_products!inner(category_code,manufacturer_part_number,genuine_part_number,product_base_prices!inner(product_kind))")
      .eq("is_active",true).in("product_kind",["rebuilt","aftermarket_new"]).gt("stock_qty",0)
      .gt("core_products.shipping_size_cm",0).eq("core_products.product_base_prices.is_current",true)
      .gt("core_products.product_base_prices.base_price_jpy",0).order("stock_qty",{ascending:false}).order("product_variant_id").limit(100)),
    rows(practiceClient.from("assy_categories").select("category_code,label_ja").eq("is_active",true))
  ]);
  const buyers = customers.filter(c => c.customer_name && c.source_customer_code &&
    (!c.billing_customer_code?.trim() || c.billing_customer_code.trim() === c.source_customer_code));
  const buyer = buyers.find(c => c.contact_name?.trim()) || buyers[0];
  if (!buyer) throw new Error("発注元と請求先が一致する販売王の登録得意先がありません。");
  const destinations = customers.filter(c => c.id !== buyer.id).map(delivery).filter(d => d?.address_line_1);
  if (!destinations.length) throw new Error("直送に使える郵便番号・住所・電話付きの登録先がありません。");
  const seen = new Set();
  const candidates = variants.filter(v => {
    const product = v.core_products;
    const code = product.manufacturer_part_number || product.genuine_part_number;
    if (!code || seen.has(code) || !product.product_base_prices.some(p => p.product_kind === v.product_kind)) return false;
    seen.add(code);
    return true;
  });
  if (candidates.length < 2) throw new Error("在庫・基準価格・出荷サイズが登録された2品番が必要です。");
  return { owner:identity.data.user.id, buyer, destinations, candidates,
    categories:new Map(categories.map(c => [c.category_code,c.label_ja])) };
}

function randomBelow(size) { return crypto.getRandomValues(new Uint32Array(1))[0] % size; }
function shuffled(values) {
  const result = values.slice();
  for (let i=result.length-1; i>0; i--) {
    const j=randomBelow(i+1);
    [result[i],result[j]]=[result[j],result[i]];
  }
  return result;
}
async function quotePracticeOrder(master, previous) {
  const options = master.destinations.filter(d => d !== previous?.destination);
  const destination = options.length ? options[randomBelow(options.length)] : master.destinations[0];
  const pool = shuffled(master.candidates);
  // Prefer at least one different item on consecutive sheets.
  pool.sort((a,b) => Number(previous?.keys.includes(a.dkd_shohin_id) || false) - Number(previous?.keys.includes(b.dkd_shohin_id) || false));
  for (let i=0; i<Math.min(pool.length-1,10); i++) {
    const selected = pool.slice(i,i+2);
    const items = selected.map(v => ({dkd_shohin_id:v.dkd_shohin_id, product_kind:v.product_kind, quantity:1+randomBelow(Math.min(2,v.stock_qty))}));
    const {data:q,error} = await practiceClient.rpc("preview_internal_customer_order", {
      target_sales_customer_id:master.buyer.id, target_items:items, target_shipping_address:destination,
      target_shipping_method:null, target_core_return_shipping_method:null
    });
    if (error) {
      if (error.code === "P0001" && /在庫が不足|価格を確定できない|注文できない品番/.test(error.message)) continue;
      throw new Error(error.code === "P0001" ? error.message : "通常受注の見積を取得できません。接続と受注権限を確認してください。");
    }
    if (!q?.valid || q.items?.length !== 2) throw new Error("通常受注の見積明細を確認できません。");
    const date = new Date();
    return { id:"FX-"+tokyoDate.format(date).replaceAll("/","")+"-"+crypto.randomUUID().slice(0,8).toUpperCase(),
      date, keys:selected.map(v=>v.dkd_shohin_id), buyer:master.buyer, destination,
      shipping:q.shipping_fee_jpy, tax:q.tax_jpy, subtotal:q.subtotal_jpy, total:q.total_jpy,
      carrier:[q.outbound_shipping_method.carrier_name,q.outbound_shipping_method.service_name].join(" "),
      returns:q.core_return_required ? [q.core_return_shipping_method.carrier_name,q.core_return_shipping_method.service_name].join(" ") : "",
      lines:q.items.map(l=>({name:(master.categories.get(l.category_code)||l.category_code)+"（"+(l.product_kind==="rebuilt"?"リビルト品":"社外新品")+"）",
        code:l.manufacturer_part_number||l.genuine_part_number,qty:l.quantity,price:l.unit_price_jpy,amount:l.line_total_jpy,core:l.core_return_required})) };
  }
  throw new Error("在庫と得意先別価格がそろう2品番の見積を作成できません。");
}
