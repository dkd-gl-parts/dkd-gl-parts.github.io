const fs = require("fs");
const vm = require("vm");

const app = fs.readFileSync("app.js", "utf8");
const html = fs.readFileSync("index.html", "utf8");
const css = fs.readFileSync("styles.css", "utf8");
const legacySource = fs.readFileSync("legacy-i18n.js", "utf8");

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

function extractTranslations() {
  const start = app.indexOf("var TRANSLATIONS = ");
  const currentLang = app.indexOf("\nvar currentLang", start);
  const source = app.slice(start, currentLang);
  const close = source.lastIndexOf("\n};");
  const context = {};
  vm.createContext(context);
  vm.runInContext(source.slice(0, close + 3).replace(/^var TRANSLATIONS\s*=\s*/, "TRANSLATIONS = "), context);
  return context.TRANSLATIONS;
}

function extractLegacyTranslations() {
  const context = {};
  vm.createContext(context);
  vm.runInContext(legacySource.replace(/^var DCATS_LEGACY_UI_TRANSLATIONS\s*=\s*/, "DCATS_LEGACY_UI_TRANSLATIONS = "), context);
  return context.DCATS_LEGACY_UI_TRANSLATIONS;
}

function plain(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#43;/g, "+")
    .replace(/&times;/g, "x")
    .replace(/&#43;/g, "+")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function addCandidate(set, value) {
  const text = plain(String(value || "").replace(/\\n|\\t/g, " "));
  if (!text || text.length > 300 || !/[ぁ-んァ-ヶ一-龠]/.test(text)) return;
  set.add(text);
}

function extractJsCandidates(source, set) {
  for (const line of source.split(/\r?\n/)) {
    const literal = /(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)')/g;
    let match;
    while ((match = literal.exec(line))) {
      const raw = match[1] == null ? match[2] : match[1];
      if (!/[ぁ-んァ-ヶ一-龠]/.test(raw)) continue;
      if (/[<>]/.test(raw)) {
        for (const textMatch of raw.matchAll(/>([^<>]*[ぁ-んァ-ヶ一-龠][^<>]*)</g)) addCandidate(set, textMatch[1]);
        for (const attrMatch of raw.matchAll(/(?:placeholder|title|aria-label)=(?:"|')([^"']*[ぁ-んァ-ヶ一-龠][^"']*)(?:"|')/g)) {
          addCandidate(set, attrMatch[1]);
        }
      } else {
        addCandidate(set, raw);
      }
    }
  }
}

const translations = extractTranslations();
const legacy = extractLegacyTranslations();
const jaKeys = Object.keys(translations.ja || {}).sort();
const enKeys = Object.keys(translations.en || {}).sort();
const zhKeys = Object.keys(translations.zh || {}).sort();
assert(JSON.stringify(jaKeys) === JSON.stringify(enKeys), "Japanese and English translation keys must match");
assert(JSON.stringify(jaKeys) === JSON.stringify(zhKeys), "Japanese and Chinese translation keys must match");
assert(legacy && legacy.en && legacy.zh, "Supplemental English and Chinese UI dictionaries are required");
assert(JSON.stringify(Object.keys(legacy.en).sort()) === JSON.stringify(Object.keys(legacy.zh).sort()), "Supplemental English and Chinese source literals must match");

const coveredJa = new Set(Object.values(translations.ja || {}).map(plain).filter(Boolean));
const staticHtml = html
  .replace(/<!--[^]*?-->/g, "")
  .replace(/<script[^]*?<\/script>/gi, "")
  .replace(/<style[^]*?<\/style>/gi, "");
const directLiterals = [];
for (const match of staticHtml.matchAll(/>([^<>]*[ぁ-んァ-ヶ一-龠][^<>]*)</g)) directLiterals.push(plain(match[1]));
for (const match of staticHtml.matchAll(/(?:placeholder|title|aria-label|value)="([^"]*[ぁ-んァ-ヶ一-龠][^"]*)"/g)) directLiterals.push(plain(match[1]));
const uncovered = Array.from(new Set(directLiterals)).filter((value) => {
  return value && !coveredJa.has(value) && (!legacy.en[value] || !legacy.zh[value]);
});
assert(!uncovered.length, `Static UI literals are missing supplemental translations: ${uncovered.slice(0, 8).join(" / ")}`);

const dynamicCandidates = new Set();
extractJsCandidates(app.slice(app.indexOf("\nvar currentLang")), dynamicCandidates);
const uncoveredDynamic = Array.from(dynamicCandidates).filter((value) => {
  return !coveredJa.has(value) && (!legacy.en[value] || !legacy.zh[value]);
});
assert(!uncoveredDynamic.length, `Dynamic UI literals are missing supplemental translations: ${uncoveredDynamic.slice(0, 8).join(" / ")}`);

assert(html.indexOf("legacy-i18n.js") >= 0, "Supplemental translation asset is not loaded");
assert(html.indexOf("legacy-i18n.js") < html.indexOf('<script src="app.js?v='), "Supplemental translations must load before app.js");
assert(app.includes("function applyLegacyUiI18n(root)"), "Legacy UI translation bridge is missing");
assert(app.includes("new MutationObserver(function(mutations)"), "Dynamic UI translation observer is missing");
assert(app.includes('attributeFilter: ["placeholder", "title", "aria-label"]'), "Dynamic attribute translation observer is missing");
assert(app.includes('document.documentElement.lang = currentLang === "zh" ? "zh-CN" : currentLang;'), "Document language must follow the selected UI language");
const componentNameBlockStart = app.indexOf("function componentLocalizedNameHtml(name)");
const componentNameBlockEnd = app.indexOf("\nasync function ", componentNameBlockStart);
const componentNameBlock = app.slice(componentNameBlockStart, componentNameBlockEnd);
assert(!componentNameBlock.includes("component-sub"), "Localized component rows must not repeat the Japanese source name");

[
  'html[lang="en"] .screen',
  "overflow-wrap: anywhere",
  ".production-component-summary-table th",
  "minmax(340px, .85fr)",
  ".production-core-meta"
].forEach((fragment) => assert(css.includes(fragment), `English layout contract is missing: ${fragment}`));

console.log(`OK: ${jaKeys.length} shared keys and ${Object.keys(legacy.en).length} supplemental UI literals verified`);
