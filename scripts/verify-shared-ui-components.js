const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

function requireFragment(source, fragment, label) {
  if (!source.includes(fragment)) throw new Error(`${label} is missing: ${fragment}`);
}

[
  ["--dcats-customer-green: #154c3d", "customer semantic color"],
  ["--dcats-brand-red: #d6001d", "internal brand color"],
  ["--dcats-control-height: 40px", "regular control height"],
  ["--dcats-control-height-compact: 34px", "compact control height"],
  ["--dcats-control-radius: 6px", "control radius"],
  ["--dcats-card-radius: 8px", "card radius"],
  ["--dcats-type-heading: 18px", "heading size"],
  ["--dcats-type-body: 14px", "body size"],
  ["--dcats-type-supporting: 12px", "supporting size"],
  ["--dcats-border: #cbd5df", "border color"],
  ["--dcats-focus: #2f6fed", "focus color"],
  ["--dcats-space-2: 8px", "8px spacing base"]
].forEach(([fragment, label]) => requireFragment(css, fragment, label));

[
  'id="screen-customer-portal" class="screen dcats-ui-screen"',
  'id="screen-customer-shipping" class="screen dcats-ui-screen"',
  'id="screen-customer-users" class="screen dcats-ui-screen"',
  'id="screen-customer-catalog" class="screen dcats-ui-screen"',
  'id="screen-customer-orders" class="screen dcats-ui-screen"',
  'id="screen-search" class="screen dcats-ui-screen"',
  'id="screen-production-search" class="screen dcats-ui-screen"'
].forEach((fragment) => requireFragment(html, fragment, "shared UI font screen"));

[
  [".page-header { position: sticky;", "shared header"],
  ["min-height: 48px", "shared header height"],
  [".dcats-ui-screen { font-family: var(--dcats-font-ui); }", "shared UI font family"],
  [".dcats-ui-screen textarea { font-family: inherit; }", "shared form-control font inheritance"],
  ["#screen-search .card-pn,", "sales product-code font override"],
  ["#screen-production-search .kikan-pn,", "manufacturing product-code font override"],
  ["font-variant-numeric: tabular-nums", "product-code numeric alignment"],
  ["height: var(--dcats-control-height-compact); border: 1px solid var(--dcats-border)", "compact internal search input"],
  [".btn-search { min-height: var(--dcats-control-height-compact)", "compact internal primary action"],
  ["background: var(--dcats-brand-red); color: #fff", "internal primary color"],
  [".customer-order-tabs button { min-width: 112px; min-height: var(--dcats-control-height)", "regular customer tabs"],
  [".customer-order-form-grid select { height: var(--dcats-control-height); }", "regular customer form controls"],
  [".customer-order-submit-button { min-height: var(--dcats-control-height); border: 1px solid var(--dcats-customer-green)", "customer primary action"],
  ["#screen-search .card { margin-bottom: 6px; border-color: var(--dcats-border); border-radius: var(--dcats-card-radius)", "internal card geometry"],
  ["--dcats-font-ui: \"Noto Sans JP\", \"Yu Gothic UI\", \"Yu Gothic\", Meiryo, sans-serif", "shared UI font stack"],
  [".production-category-filter .form-select { height: var(--dcats-control-height-compact)", "manufacturing compact filter"],
  [".production-ranking-tools .btn-sm-edit { min-height: var(--dcats-control-height-compact)", "manufacturing compact actions"],
  [".production-card { background: #fff; border: 1px solid var(--dcats-border); border-radius: var(--dcats-card-radius)", "manufacturing card geometry"],
  [".production-card.selected { border-color: #e58a96; background: var(--dcats-brand-red-soft); box-shadow: inset 3px 0 0 var(--dcats-brand-red); }", "manufacturing selected state"],
  [".production-detail-title { font-size: var(--dcats-type-heading)", "manufacturing heading typography"],
  [".production-section { border: 1px solid var(--dcats-border); border-radius: var(--dcats-card-radius)", "manufacturing section geometry"],
  ["#screen-production-search .production-detail { max-width: none; min-height: 100%; padding-top: 12px; padding-bottom: 8px; }", "manufacturing viewport-fit detail spacing"],
  ["#screen-production-search .detail-maker-offset-standard,", "manufacturing detail offset removal"],
  ["#screen-production-search .detail-maker-offset-ac { margin-top: 0; }", "manufacturing compact detail columns"],
  ["#screen-production-search textarea:focus-visible", "manufacturing focus treatment"],
  [".customer-order-history-list { border: 1px solid var(--dcats-border); border-radius: var(--dcats-card-radius)", "customer card geometry"],
  ["#screen-customer-orders textarea:focus-visible", "shared customer focus treatment"],
  ["outline: 2px solid var(--dcats-focus)", "shared focus width"]
].forEach(([fragment, label]) => requireFragment(css, fragment, label));

const salesCardMono = css.indexOf('.card-pn     { font-size: 13px; color: #444; margin-top: 3px; font-family: monospace;');
const sharedUiOverride = css.indexOf('#screen-search .card-pn,');
if (salesCardMono < 0 || sharedUiOverride <= salesCardMono) {
  throw new Error("shared UI product-code font override must follow the legacy monospace rule");
}

requireFragment(css, '.log-json       { font-family: monospace;', "technical log font exception");
requireFragment(css, '.finished-label-layout-preview .serial-label-number { margin-top: 5px; font-family: Consolas', "technical serial font exception");

if (/\.customer-order-submit-button\s*\{[^}]*var\(--dcats-brand-red\)/s.test(css)) {
  throw new Error("customer order submit must use the customer green semantic color");
}

console.log("shared customer/internal/manufacturing UI component and font guard passed");
