"use strict";
const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const acorn = require("acorn");
const {parseHTML} = require("linkedom");
const app = fs.readFileSync("app.js", "utf8");
const css = fs.readFileSync("styles.css", "utf8");
const names = ["render", "esc", "renderProductKindPill", "renderProductKindPills", "renderBadgeSlotHtml", "renderResultBadgeSlots"];
const functions = acorn.parse(app, {ecmaVersion:"latest"}).body.filter(n => n.type === "FunctionDeclaration" && names.includes(n.id.name));
assert.equal(functions.length, names.length);
const source = functions.map(n => app.slice(n.start, n.end)).join("\n");
let checks = 1;
const eq = (a,b,label) => {assert.deepEqual(a,b,label); checks++;};
const items = [];
for(let mask=0;mask<64;mask++) items.push({id:mask+1,genuine_part_number:"27060-E"+String(mask).padStart(4,"0"),
 manufacturer:"SAWAFUJI",manufacturer_part_number:"0201-152-"+String(mask).padStart(4,"0"),
 genuine_part_number_2:mask&16?"OEM-SECOND-"+mask:null,image_count:mask&1?12:0,
 sl:mask&2?["SL-"+mask,"SL-SECOND-"+mask]:[],kikan:!!(mask&4),catalog:!!(mask&8),both:!!(mask&32)});
for(const language of ["ja","en","zh"]){
 const {document} = parseHTML('<input id="q" value="27060"><div id="count-bar"></div><div id="list"></div><div id="load-more-wrap"></div>');
 const labels = {ja:{rebuilt:"リビルト",aftermarket_new:"社外新品",catalog_spec:"カタログ",image_none_short:"画像なし",image_has:"画像あり",kikan_section:"互換",category:"オルタネータ"},
  en:{rebuilt:"Rebuilt",aftermarket_new:"Aftermarket New",catalog_spec:"Catalog",image_none_short:"No image",image_has:"Images",kikan_section:"Compatibility",category:"Alternator"},
  zh:{rebuilt:"再制造",aftermarket_new:"副厂新品",catalog_spec:"目录",image_none_short:"无图片",image_has:"有图片",kikan_section:"互换",category:"发电机"}}[language];
 const scope = {document,currentFilter:"all",searchSlOnly:false,currentProduct:items[0],
  productSearchTotalCount:items.length,productSearchHasMore:false,productSearchFetchedCount:items.length,productSearchLimit:100,SEARCH_FETCH_LIMIT:500,
  syncSearchClearButtonState:()=>{},getFiltered:()=>items,setCspStyle:()=>{},tf:()=>String(items.length),t:key=>labels[key]||key,
  getProductImageCount:p=>p.image_count,slPartLabelsForProduct:p=>p.sl,productHasSlPart:p=>p.sl.length>0,
  hasProductKikanCompatible:p=>p.kikan,productHasCatalogData:p=>p.catalog,productDkdId:p=>p.id,
  productCategoryLabel:()=>labels.category,productKindClass:k=>k,productKindLabel:k=>labels[k],productKindSortValue:k=>k==="rebuilt"?0:1,
  productKindSummaryHasKind:(s,k)=>!!s.kinds[k],productKindSummaryForProduct:p=>({kinds:p.both?{rebuilt:{},aftermarket_new:{}}:{rebuilt:{}}})};
 vm.runInNewContext(source,scope);scope.render();
 const cards=[...document.querySelectorAll("#list .card")];eq(cards.length,64,"all state combinations render");
 cards.forEach((card,i)=>{
  const p=items[i],body=card.querySelector(".card-left");
  eq([...body.children].map(e=>e.className),["card-pn card-pn-primary","card-category-row","product-kind-list compact","card-mfr","card-reference-row"],"five stable tracks");
  eq(card.querySelectorAll(".card-category-row .badge-img").length,p.image_count?1:0,"image count in category track");
  eq(card.querySelectorAll(".card-category-row .badge-sl").length,p.sl.length?1:0,"SL state in category track");
  eq(card.querySelectorAll(".card-category-row .badge-kikan").length,p.kikan?1:0,"compatibility in category track");
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
