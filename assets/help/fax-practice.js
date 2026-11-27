"use strict";

const yen = new Intl.NumberFormat("ja-JP");
const tokyoDate = new Intl.DateTimeFormat("ja-JP",{ timeZone:"Asia/Tokyo", year:"numeric", month:"2-digit", day:"2-digit" });
const select = selector => document.querySelector(selector);
const setText = (selector, value) => { select(selector).textContent = value; };
const printButton = select("[data-print]");
const orderView = document.body.dataset.practice === "order";

function showCheck(o) {
  const qty = o.quantities;
  setText("[data-order-number]",o.id);
  setText("[data-reference]","対象 "+o.id);
  setText("[data-continued-id]",o.id);
  setText("[data-piece-count]","計"+qty.reduce((a,b)=>a+b,0)+"点・税込"+yen.format(o.total)+"円");
  setText("[data-money]","数量 "+qty.join("・")+"、商品計"+yen.format(o.subtotal)+"円、送料"+yen.format(o.shipping)+"円、税"+yen.format(o.tax)+"円、税込"+yen.format(o.total)+"円。");
}

// Old printed TR references used a fixed arithmetic exercise.
function legacyCheck(id) {
  const m=/^TR-(\d{4})(\d{2})(\d{2})-[0-3]([0-3])([0-9A-F]{8})$/.exec(id || "");
  if (!m) return null;
  const date = new Date(m[1]+"-"+m[2]+"-"+m[3]+"T03:00:00Z");
  if (!Number.isFinite(+date) || tokyoDate.format(date).replaceAll("/","")!==m[1]+m[2]+m[3]) return null;
  const quantities=[1+parseInt(m[5][0],16)%2,1+parseInt(m[5][1],16)%3];
  const price=[[12000,3500],[18000,4500],[12000,4500],[18000,3500]][Number(m[4])];
  const subtotal=price[0]*quantities[0]+price[1]*quantities[1];
  return { id, quantities, subtotal, shipping:0, tax:subtotal/10, total:subtotal+subtotal/10 };
}

function checkPage() {
  const key=location.hash.startsWith("#case-") ? location.hash.slice(6) : history.state?.practiceOrder;
  if (key) history.replaceState({practiceOrder:key},"",location.pathname+location.search);
  const legacy=legacyCheck(key);
  if (legacy) showCheck(legacy);
  else if (/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(key || "")) {
    setText("[data-reference]","注文書との照合待ちです。元の注文書を開いたままにしてください。");
    printButton.disabled=true;
    const channel=new BroadcastChannel("fax-check-"+key);
    channel.onmessage=({data})=>{
      if (data?.type==="summary") { showCheck(data.order); printButton.disabled=false; }
      if (data?.type==="clear") location.replace(location.pathname);
    };
    channel.postMessage({type:"request"});
    window.addEventListener("pagehide",()=>channel.close(),{once:true});
  }
  printButton.addEventListener("click",()=>window.print());
}

function orderPage() {
  const sheet=select(".sheet"), preview=select("[data-preview]"), repeat=select("[data-repeat]");
  let master=null, current=null, prepared=false, epoch=0, channels=[];
  function clear(message) {
    epoch++;
    channels.forEach(c=>{c.postMessage({type:"clear"});c.close();});
    channels=[];
    current=null; master=null;
    sheet.hidden=true; printButton.disabled=true; preview.disabled=true; repeat.hidden=true;
    sheet.querySelectorAll(".value,[data-buyer],[data-order-number],[data-line-total],.total,[data-delivery]").forEach(el=>{el.textContent="";});
    select("[data-check-link]").removeAttribute("href");
    setText(".screen-note",message);
  }
  function render(o) {
    current=o;
    const d=o.destination;
    const fields={"得意先コード":o.buyer.source_customer_code,"発注担当":o.buyer.contact_name || "登録なし","発注日":tokyoDate.format(o.date),
      "お届け先":[d.company_name,d.recipient_name!==d.company_name?d.recipient_name:""].filter(Boolean).join("　"),
      "郵便番号と住所":"〒"+d.postal_code+" "+d.prefecture_name+d.address_line_1+" "+d.address_line_2,"電話番号":d.phone_number,
      "希望納期":tokyoDate.format(new Date(+o.date+86400000))};
    setText("[data-order-number]",o.id);
    setText("[data-buyer]",o.buyer.customer_name);
    setText("[data-delivery]",o.carrier+"・同梱1箱。"+(o.returns?"コア返却便 "+o.returns:"コア返却なし"));
    const totals=document.querySelectorAll("[data-line-total]");
    o.lines.forEach((l,i)=>{
      fields["商品名"+(i+1)]=l.name+(l.core?"・コア返却":"");
      fields["品番"+(i+1)]=l.code;
      totals[i].textContent=l.qty+"点 × "+yen.format(l.price)+"円 ＝ "+yen.format(l.amount)+"円";
    });
    for (const [key,value] of Object.entries(fields)) setText('[aria-label="'+key+'"]',value);
    const grand=document.createElement("strong");
    grand.textContent="合計 "+yen.format(o.total)+"円";
    select(".total").replaceChildren("商品計 "+yen.format(o.subtotal)+"円　送料 "+yen.format(o.shipping)+"円　消費税 "+yen.format(o.tax)+"円",document.createElement("br"),grand);

    const key=crypto.randomUUID(),channel=new BroadcastChannel("fax-check-"+key);
    const summary={id:o.id,quantities:o.lines.map(l=>l.qty),subtotal:o.subtotal,shipping:o.shipping,tax:o.tax,total:o.total};
    channel.onmessage=({data})=>{ if (data?.type==="request") channel.postMessage({type:"summary",order:summary}); };
    channels.push(channel);
    if (channels.length>16) channels.shift().close();
    select("[data-check-link]").href="fax-practice-check.html#case-"+key;
    sheet.hidden=false;
  }
  function markPrepared() {
    prepared=true; repeat.hidden=false; printButton.textContent="新しい注文を印刷";
  }
  async function next(print) {
    const seq=++epoch;
    printButton.disabled=true; preview.disabled=true; repeat.disabled=true;
    sheet.hidden=true;
    setText(".screen-note","得意先・在庫・送料を確認しています。");
    try {
      const snapshot=master || await loadPracticeMaster();
      if (seq!==epoch) return;
      master=snapshot;
      const result=await quotePracticeOrder(master,current);
      if (seq!==epoch) return;
      render(result);
      setText(".screen-note","発注元は共通です。新規印刷で直送先・商品を切り替えます。");
      prepared=false; repeat.hidden=true; printButton.textContent="表示中を印刷";
      printButton.disabled=false; preview.disabled=false; repeat.disabled=false;
      if (print) { markPrepared(); window.print(); }
    } catch (error) {
      if (seq!==epoch) return;
      clear(error.message || "登録データを取得できません。");
      preview.disabled=false; preview.textContent="再読込";
    }
  }
  if (typeof practiceClient==="undefined") { clear("D-CATSに接続できません。このページを再読込してください。"); return; }
  practiceClient.auth.onAuthStateChange((event,session)=>{
    if (event==="SIGNED_OUT" || (master && master.owner!==session?.user?.id)) {
      clear("D-CATSにログインして、この注文書を開き直してください。");
    }
  });
  window.addEventListener("pageshow",e=>{if(e.persisted) location.reload();});
  window.addEventListener("afterprint",()=>{if(current && !sheet.hidden) markPrepared();});
  repeat.addEventListener("click",()=>{if(current && !sheet.hidden) window.print();});
  preview.addEventListener("click",()=>{preview.textContent="別の例を表示";next(false);});
  printButton.addEventListener("click",()=>{
    if (prepared) next(true);
    else if (current) { markPrepared(); window.print(); }
  });
  next(false);
}
if (orderView) orderPage(); else checkPage();
