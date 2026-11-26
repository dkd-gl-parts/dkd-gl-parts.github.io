"use strict";

const customerDestinations = [
  ["東部演習センター　入荷係", "埼玉県演習市東町1-2-3"],
  ["西部演習工場　部品係", "大阪府演習市西町2-3-4"],
  ["南部演習倉庫　整備課", "福岡県演習市南町3-4-5"],
  ["北部演習工場　受入係", "北海道演習市北町4-5-6"]
];
const products = [
  ["TR-ST-001", "スターター（新品）", 12000, "台"],
  ["TR-PT-002", "補修部品（新品）", 3500, "個"],
  ["TR-AL-003", "オルタネーター（新品）", 18000, "台"],
  ["TR-RG-004", "レギュレーター（新品）", 4500, "個"]
];
const pairs = [[0, 1], [2, 3], [0, 3], [2, 1]];
const yen = new Intl.NumberFormat("ja-JP");
const tokyoDate = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit"
});
const idPattern = /^TR-(\d{4})(\d{2})(\d{2})-([0-3])([0-3])([0-9A-F]{8})$/;
const orderView = document.body.dataset.practice === "order";
const printButton = document.querySelector("[data-print]");
const repeatButton = document.querySelector("[data-repeat]");
const substitutions = new Map();
let current = null;
let preparedForPrint = false;

function orderFromId(id) {
  const match = idPattern.exec(id || "");
  if (!match) return null;
  const [, year, month, day, shipIndex, pairIndex, nonce] = match;
  const date = new Date(year + "-" + month + "-" + day + "T03:00:00Z");
  if (!Number.isFinite(date.getTime()) || tokyoDate.format(date).replaceAll("/", "") !== year + month + day) return null;
  const quantity = [1 + parseInt(nonce[0],16) % 2, 1 + parseInt(nonce[1],16) % 3];
  const lines = pairs[Number(pairIndex)].map((key, i) => {
    const [code, name, price, unit] = products[key];
    return { code, name, price, unit, qty: quantity[i], amount: price * quantity[i] };
  });
  const subtotal = lines.reduce((sum, line) => sum + line.amount, 0);
  return { id, date, ship: Number(shipIndex), pair: Number(pairIndex), lines, subtotal, tax: subtotal / 10 };
}

function differentIndex(previous, value, size) {
  return previous === undefined ? value % size : (previous + 1 + value % (size - 1)) % size;
}
function freshOrder() {
  const [nonce, a, b] = crypto.getRandomValues(new Uint32Array(3));
  const ship = differentIndex(current?.ship, a, customerDestinations.length);
  const pair = differentIndex(current?.pair, b, pairs.length);
  const stamp = tokyoDate.format(new Date()).replaceAll("/", "");
  return orderFromId("TR-" + stamp + "-" + ship + pair + nonce.toString(16).toUpperCase().padStart(8,"0"));
}
function setText(selector, value) {
  document.querySelector(selector).textContent = value;
}
function editable(label) {
  return document.querySelector('[aria-label="' + label + '"][contenteditable]');
}
function fillField(label, value, key) {
  const el = editable(label);
  el.textContent = substitutions.get(key) ?? value;
  if (key) el.dataset.substitution = key;
}
function useOrder(order) {
  current = order;
  const total = yen.format(order.subtotal + order.tax);
  setText("[data-order-number]", order.id);
  if (!orderView) {
    setText("[data-reference]", "対象 " + order.id);
    setText("[data-piece-count]", "計" + order.lines.reduce((sum,l) => sum+l.qty, 0) + "点・税込" + total + "円");
    setText("[data-money]", "数量 " + order.lines.map(l=>l.qty).join("・") + "、税抜" + yen.format(order.subtotal) + "円、税" + yen.format(order.tax) + "円、税込" + total + "円。");
    return;
  }

  document.querySelector("[data-check-link]").hash = "case-" + order.id;
  const [shipName, address] = customerDestinations[order.ship];
  const shipKey = "ship-" + order.ship;
  fillField("お届け先", shipName, shipKey + "-name");
  fillField("郵便番号と住所", "〒000-0000 " + address + "（架空）", shipKey + "-address");
  fillField("試験用電話番号", "000-0000-000" + (order.ship+1), shipKey + "-phone");
  fillField("発注日", tokyoDate.format(order.date));
  const due = new Date(order.date);
  due.setUTCDate(due.getUTCDate() + 1 + order.ship);
  fillField("希望納期", tokyoDate.format(due));
  const totals = document.querySelectorAll("[data-line-total]");
  order.lines.forEach((l, i) => {
    fillField("商品名" + (i+1), l.name, l.code+"-name");
    fillField("品番" + (i+1), l.code, l.code+"-code");
    totals[i].textContent = l.qty + l.unit + " × " + yen.format(l.price) + "円 ＝ " + yen.format(l.amount) + "円";
  });
  const grand = document.createElement("strong");
  grand.textContent = "合計 " + total + "円";
  document.querySelector(".total").replaceChildren("小計 " + yen.format(order.subtotal) + "円　消費税 " + yen.format(order.tax) + "円", document.createElement("br"), grand, "（送料・コア代金 0円）");
}
function rememberId() {
  if (current) history.replaceState({ practiceOrder:current.id }, "");
}
function nextOrder() {
  useOrder(freshOrder());
  rememberId();
  preparedForPrint = false;
  printButton.textContent = "表示中を印刷";
  repeatButton.hidden = true;
}
function markPrepared() {
  preparedForPrint = true;
  printButton.textContent = "新しい注文を印刷";
  repeatButton.hidden = false;
}
const caseLink = location.hash.startsWith("#case-");
const initial = orderView ? null : orderFromId(caseLink ? location.hash.slice(6) : history.state?.practiceOrder);
if (caseLink) history.replaceState(null, "", location.pathname + location.search);
if (initial || orderView) {
  useOrder(initial || freshOrder());
  rememberId();
}
window.addEventListener("hashchange", rememberId);
if (orderView) {
  document.addEventListener("input", event => {
    const key = event.target.dataset.substitution;
    if (key) substitutions.set(key, event.target.textContent);
  });
  document.querySelector("[data-preview]").addEventListener("click", nextOrder);
  repeatButton.addEventListener("click", () => window.print());
  window.addEventListener("afterprint", markPrepared);
}
printButton.addEventListener("click", () => {
  if (orderView) {
    if (preparedForPrint) nextOrder();
    markPrepared();
  }
  window.print();
});
