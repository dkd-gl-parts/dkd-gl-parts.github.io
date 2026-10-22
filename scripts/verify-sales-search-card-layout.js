"use strict";
const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const acorn = require("acorn");
const {parseHTML} = require("linkedom");
const app = fs.readFileSync("app.js", "utf8");
const css = fs.readFileSync("styles.css", "utf8");
const names = ["render", "renderSearchCardImageKinds", "esc", "renderProductKindPill", "renderProductKindPills", "renderBadgeSlotHtml", "renderResultBadgeSlots"];
const functions = acorn.parse(app, {ecmaVersion:"latest"}).body.filter(n => n.type === "FunctionDeclaration" && names.includes(n.id.name));
assert.equal(functions.length, names.length);
const source = functions.map(n => app.slice(n.start, n.end)).join("\n");
let checks = 1;
const eq = (a,b,label) => {assert.deepEqual(a,b,label); checks++;};
const items = [];
for(let mask=0;mask<64;mask++) items.push({id:mask+1,genuine_part_number:"27060-E"+String(mask).padStart(4,"0"),
 manufacturer:"SAWAFUJI",manufacturer_part_number:"0201-152-"+String(mask).padStart(4,"0"),
 genuine_part_number_2:mask&16?"OEM-SECOND-"+mask:null,image_count:mask&1?12:0,search_image_kind_info:{context:"sales",counts:mask&1?{rebuilt:5,aftermarket_new:7}:{}},
 sl:mask&2?["SL-"+mask,"SL-SECOND-"+mask]:[],kikan:!!(mask&4),catalog:!!(mask&8),both:!!(mask&32)});
for(const language of ["ja","en","zh"]){
 const {document} = parseHTML('<input id="q" value="27060"><div id="count-bar"></div><div id="list"></div><div id="load-more-wrap"></div>');
 const labels = {ja:{rebuilt:"リビルト",aftermarket_new:"社外新品",product_kind_new_short:"新品",catalog_spec:"カタログ",image_none_short:"画像なし",image_has:"画像あり",kikan_section:"互換",category:"オルタネータ"},
  en:{rebuilt:"Rebuilt",aftermarket_new:"Aftermarket New",product_kind_new_short:"New",catalog_spec:"Catalog",image_none_short:"No image",image_has:"Images",kikan_section:"Compatibility",category:"Alternator"},
  zh:{rebuilt:"再制造",aftermarket_new:"副厂新品",product_kind_new_short:"新品",catalog_spec:"目录",image_none_short:"无图片",image_has:"有图片",kikan_section:"互换",category:"发电机"}}[language];
 const scope = {document,currentFilter:"all",searchSlOnly:false,currentProduct:items[0],
  productSearchTotalCount:items.length,productSearchHasMore:false,productSearchFetchedCount:items.length,productSearchLimit:100,SEARCH_FETCH_LIMIT:500,
  syncSearchClearButtonState:()=>{},getFiltered:()=>items,setCspStyle:()=>{},tf:()=>String(items.length),t:key=>labels[key]||key,
  isCustomerViewer:()=>false,isCustomerPortalSearchMode:()=>false,getProductImageCount:p=>p.image_count,slPartLabelsForProduct:p=>p.sl,productHasSlPart:p=>p.sl.length>0,
  hasProductKikanCompatible:p=>p.kikan,productHasCatalogData:p=>p.catalog,productDkdId:p=>p.id,
  productCategoryLabel:()=>labels.category,productKindClass:k=>k,productKindLabel:k=>labels[k],productKindSortValue:k=>k==="rebuilt"?0:1,
  productKindSummaryHasKind:(s,k)=>!!s.kinds[k],productKindSummaryForProduct:p=>({kinds:p.both?{rebuilt:{},aftermarket_new:{}}:{rebuilt:{}}})};
 vm.runInNewContext(source,scope);scope.render();
 const cards=[...document.querySelectorAll("#list .card")];eq(cards.length,64,"all state combinations render");
 cards.forEach((card,i)=>{
  const p=items[i],body=card.querySelector(".card-left");
  eq([...body.children].map(e=>e.className),["card-pn card-pn-primary","card-category-row","product-kind-list compact","card-mfr","card-kind-images"],"five stable tracks");
  eq(card.querySelectorAll(".card-category-row .badge-img").length,0,"total image badge replaced with kind-specific footer");
  eq(card.querySelectorAll(".card-media-sl .badge-sl").length,p.sl.length?1:0,"SL state below catalog");
  eq(card.querySelectorAll(".card-category-row .badge-kikan").length,p.kikan?1:0,"compatibility in category track");
  eq(card.querySelectorAll(".card-kind-images .product-kind-pill").length,p.image_count?2:0,"kind-specific images retained");
  if(p.both)eq(card.querySelector(".product-kind-list .aftermarket_new").textContent,labels.product_kind_new_short,"new label is short on search card");
  eq(card.querySelectorAll(".card-media-catalog").length,p.catalog?1:0,"catalog marker retained");
  eq(card.querySelector(".card-pn").getAttribute("title"),p.genuine_part_number,"full primary part retained");
  eq(card.getAttribute("role"),"button","selection semantics retained");
  eq(card.getAttribute("tabindex"),"0","keyboard focus retained");
  eq(card.getAttribute("data-id"),String(p.id),"selection identity retained");
  eq(card.querySelectorAll(".card-reference-row .card-sub").length,p.genuine_part_number_2?1:0,"OEM2 retained");
  eq(card.querySelectorAll(".card-reference-row .card-sl").length,p.sl.length?1:0,"SL number retained");
  if(p.sl.length)eq(card.querySelector(".card-reference-row .card-sl").title,"SL: "+p.sl.join(" / "),"all SL numbers accessible");
 });
 items[0].genuine_part_number='<img src=x onerror="bad()">';scope.render();
 eq(document.querySelectorAll(".card img").length,0,"part text is escaped, not markup");
 eq(document.querySelector(".card-pn").title,items[0].genuine_part_number,"escaped full title retained");
 items[0].genuine_part_number="27060-E0000";
}
assert.match(css,/#screen-search \.card-left\s*\{[^}]*grid-template-rows:\s*21px 20px 21px 17px 14px/);checks++;
assert.match(css,/#screen-search \.card-category-row \.badge-slot\.slot-empty\s*\{\s*display:\s*none/);checks++;
assert.match(css,/#screen-search \.card-category-row \.card-badges-inline\s*\{[^}]*flex-direction:\s*row/);checks++;
assert.match(css,/#screen-search \.card-reference-row > span\s*\{[^}]*text-overflow:\s*ellipsis/);checks++;
console.log(JSON.stringify({passed:true,checks,languages:3,state_combinations:64}));

// Exercise the existing batched image lookup, including visibility and kind separation.
(async function() {
 const lookupNames=["normalizeProductKind","imageContextMatches","coreProductImageIdentity","uniqueCoreProductImageRows",
  "fetchProductImageCountMapForContext","applyProductImageCountMapForContext","refreshSalesImageCacheForProduct","renderSearchCardImageKinds","esc"];
 const lookupSource=acorn.parse(app,{ecmaVersion:"latest"}).body.filter(n=>n.type==="FunctionDeclaration"&&lookupNames.includes(n.id.name)).map(n=>app.slice(n.start,n.end)).join("\n");
 let customer=false,failed=false,queries=0;
 let rows=[
  {dkd_shohin_id:1,product_kind:"rebuilt",storage_path:"r.jpg",show_in_sales:true,show_in_customer:true},
  {dkd_shohin_id:1,product_kind:"rebuilt",storage_path:"r.jpg",show_in_sales:true,show_in_customer:true},
  {dkd_shohin_id:1,product_kind:"aftermarket_new",storage_path:"n.jpg",show_in_sales:true,show_in_customer:false},
  {dkd_shohin_id:1,product_kind:"aftermarket_new",storage_path:"private.jpg",image_origin:"production",show_in_sales:false,show_in_customer:false},
  {dkd_shohin_id:1,product_kind:"unknown",storage_path:"x.jpg",show_in_sales:true,show_in_customer:true},
  {dkd_shohin_id:2,image_url:"legacy.jpg"}
 ];
 const scope={console:{warn:()=>{}},imageProductKindOptions:()=>["rebuilt","aftermarket_new"],productSearchCardDkdIds:ps=>ps.map(p=>p.id),
  productDkdId:p=>p.id,productImageCacheKeys:p=>["dkd:"+p.id],setProductImageCache:()=>{},setProductionImageCache:()=>{},
  customerImageCountMap:{},customerImageThumbnailMap:{},isCustomerViewer:()=>customer,isCustomerPortalSearchMode:()=>false,
  t:k=>({product_kind_new_short:"新品",image_has:"画像あり"}[k]||k),productKindLabel:()=>"リビルト",productKindClass:k=>k,
  fetchAllCoreProductImagesForContext:async()=>({data:rows,error:failed?{message:"offline"}:null}),
  sb:{from:()=>{queries++;const q={select:()=>q,in:()=>q,order:()=>q,then:fn=>Promise.resolve(fn({data:failed?null:rows,error:failed?{message:"offline"}:null}))};return q;}}};
 vm.runInNewContext(lookupSource,scope);
 const products=[{id:1},{id:2}];
 const sales=await scope.fetchProductImageCountMapForContext(products,"sales");
 eq(JSON.parse(JSON.stringify(sales.kindCounts)),{"dkd:1":{rebuilt:1,aftermarket_new:1},"dkd:2":{rebuilt:1}},"deduplicate, reject unknown and hidden, legacy is rebuilt only");
 eq(queries,1,"no per-card or per-kind requests");
 scope.applyProductImageCountMapForContext(products,sales,"sales");
 eq((scope.renderSearchCardImageKinds(products[0]).match(/aria-label=/g)||[]).length,2,"both kinds render independently");
 for(const counts of [{},{rebuilt:3},{aftermarket_new:4},{rebuilt:3,aftermarket_new:4}]){
  products[0].search_image_kind_info={context:"sales",counts};
  const html=scope.renderSearchCardImageKinds(products[0]);
  const {document}=parseHTML(html);
  for(const kind of ["rebuilt","aftermarket_new"])eq(document.querySelectorAll("[data-image-kind='"+kind+"'] .product-kind-pill").length,counts[kind]?1:0,"only actual kind gets an image label");
 }
 customer=true;
 eq((scope.renderSearchCardImageKinds(products[0]).match(/aria-label=/g)||[]).length,0,"customer cannot reuse sales cache");
 const publicImages=await scope.fetchProductImageCountMapForContext(products,"customer");
 eq(JSON.parse(JSON.stringify(publicImages.kindCounts)),{"dkd:1":{rebuilt:1}},"customer publication remains required");
 scope.applyProductImageCountMapForContext(products,publicImages,"customer");
 eq((scope.renderSearchCardImageKinds(products[0]).match(/aria-label=/g)||[]).length,1,"customer uses published kind counts only");
 failed=true;
 const failure=await scope.fetchProductImageCountMapForContext(products,"customer");
 scope.applyProductImageCountMapForContext(products,failure,"customer");
 eq((scope.renderSearchCardImageKinds(products[0]).match(/aria-label=/g)||[]).length,0,"lookup failure does not assert image presence");
 failed=false;customer=false;rows=[{product_kind:"aftermarket_new",image_url:"only-new.jpg"}];
 await scope.refreshSalesImageCacheForProduct(products[0]);
 eq(JSON.parse(JSON.stringify(products[0].search_image_kind_info)),{context:"sales",counts:{aftermarket_new:1}},"edit refresh replaces old image kind counts");
 console.log(JSON.stringify({passed:true,checks,visibility_and_kind_lookup:true}));
})().catch(error=>{console.error(error);process.exitCode=1;});
