"use strict";

// Same project, SDK and auth storage as the order-entry application.
const practiceClient = supabase.createClient("https://jqoeqximtwfpqwzngutj.supabase.co", "sb_publishable_TXdCwBQOD_s3N0TqFCDOAw_8B44a0kv", {
  auth: { storageKey: "sb-jqoeqximtwfpqwzngutj-auth-token", detectSessionInUrl: false }
});
const practiceCustomer = { source: "dcats_test", code: "DEV-ORDER-001" };

async function rows(query) {
  const result = await query;
  if (result.error) throw new Error("D-CATSの登録データを取得できません。接続と閲覧権限を確認してください。");
  return result.data;
}
function practiceDestinations(buyer) {
  // The prefecture is a real freight zone. All delivery details are training fixtures.
  return [
    { prefecture_code:13, prefecture_name:"東京都", postal:"100-0005", town:"千代田区丸の内", office:"演習倉庫A" },
    { prefecture_code:27, prefecture_name:"大阪府", postal:"530-0001", town:"大阪市北区梅田", office:"演習倉庫B" },
    { prefecture_code:23, prefecture_name:"愛知県", postal:"460-0008", town:"名古屋市中区栄", office:"演習倉庫C" }
  ].map(site => ({
    destination_type:"address", company_name:buyer.customer_name,
    recipient_name:site.office + "（架空・出荷禁止）",
    postal_code:site.postal, phone_number:"000-0000-0000",
    prefecture_code:site.prefecture_code, prefecture_name:site.prefecture_name,
    address_line_1:site.town+" 演習用架空番地・出荷禁止", address_line_2:site.office
  }));
}
async function loadPracticeMaster() {
  const identity = await practiceClient.auth.getUser();
  if (!identity.data.user) throw new Error("D-CATSにログインしてから、この注文書を開き直してください。");
  const access = await rows(practiceClient.rpc("get_customer_order_feature_status"));
  if (!access?.internal_management) throw new Error("通常受注を利用できる社内アカウントで開いてください。");
  const [customers, variants, categories] = await Promise.all([
    rows(practiceClient.from("sales_customers").select("id,source_code,source_customer_code,billing_customer_code,customer_name,contact_name,is_active")
      .eq("is_active",true).eq("source_code",practiceCustomer.source).eq("source_customer_code",practiceCustomer.code).limit(2)),
    rows(practiceClient.from("core_product_variants").select("dkd_shohin_id,product_kind,stock_qty,core_products!inner(category_code,manufacturer_part_number,genuine_part_number,product_base_prices!inner(product_kind))")
      .eq("is_active",true).in("product_kind",["rebuilt","aftermarket_new"]).gt("stock_qty",0)
      .gt("core_products.shipping_size_cm",0).eq("core_products.product_base_prices.is_current",true)
      .gt("core_products.product_base_prices.base_price_jpy",0).order("stock_qty",{ascending:false}).order("product_variant_id").limit(100)),
    rows(practiceClient.from("assy_categories").select("category_code,label_ja").eq("is_active",true))
  ]);
  const buyer = customers.length === 1 ? customers[0] : null;
  if (!buyer?.id || !buyer.is_active || buyer.source_code !== practiceCustomer.source ||
      buyer.source_customer_code !== practiceCustomer.code || !buyer.customer_name?.trim() ||
      (buyer.billing_customer_code?.trim() && buyer.billing_customer_code.trim() !== practiceCustomer.code)) {
    throw new Error("指定の開発テスト得意先（DEV-ORDER-001）と請求先を確認できません。");
  }
  const destinations = practiceDestinations(buyer);
  const seen = new Set();
  const candidates = variants.filter(v => {
    const product = v.core_products;
    const code = product.genuine_part_number || product.manufacturer_part_number;
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
    const service=q.outbound_shipping_method;
    const delivery=await rows(practiceClient.rpc("get_customer_order_delivery_quote", {
      target_postal_code:destination.postal_code, target_address:destination.prefecture_name+destination.address_line_1,
      target_carrier_name:service.carrier_name, target_service_name:service.service_name, target_shipping_date:null
    }));
    if (!delivery?.available || !delivery.earliest_delivery_date) throw new Error(delivery?.message || "演習先の最短着日を確認できません。");
    const date = new Date();
    return { id:"FX-"+tokyoDate.format(date).replaceAll("/","")+"-"+crypto.randomUUID().slice(0,8).toUpperCase(),
      date, due:delivery.requested_date_supported===false ? "指定不可" : delivery.earliest_delivery_date.replaceAll("-","/"), keys:selected.map(v=>v.dkd_shohin_id), buyer:master.buyer, destination,
      shipping:q.shipping_fee_jpy, tax:q.tax_jpy, subtotal:q.subtotal_jpy, total:q.total_jpy,
      carrier:[q.outbound_shipping_method.carrier_name,q.outbound_shipping_method.service_name].join(" "),
      returns:q.core_return_required ? [q.core_return_shipping_method.carrier_name,q.core_return_shipping_method.service_name].join(" ") : "",
      lines:q.items.map(l=>({name:(master.categories.get(l.category_code)||l.category_code)+"（"+(l.product_kind==="rebuilt"?"リビルト品":"社外新品")+"）",
        code:l.genuine_part_number||l.manufacturer_part_number,qty:l.quantity,price:l.unit_price_jpy,amount:l.line_total_jpy,core:l.core_return_required})) };
  }
  throw new Error("在庫と得意先別価格がそろう2品番の見積を作成できません。");
}
