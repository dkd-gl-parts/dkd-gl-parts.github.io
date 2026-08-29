const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

function requireFragment(source, fragment, label) {
  if (!source.includes(fragment)) throw new Error(`${label} is missing: ${fragment}`);
}

function sourceBetween(source, startText, endText) {
  const start = source.indexOf(startText);
  const end = source.indexOf(endText, start + startText.length);
  if (start < 0 || end < start) throw new Error(`${startText} could not be isolated`);
  return source.slice(start, end);
}

[
  'id="lang-sw-components"',
  'class="lang-btn" data-lang="ja"',
  'class="lang-btn" data-lang="en"',
  'class="lang-btn" data-lang="zh"'
].forEach((fragment) => requireFragment(html, fragment, "component language switcher"));

const languageSource = sourceBetween(app, "async function applyLanguage", "function markAppUpdateActivity");
[
  'var componentScreenActive = isScreenActive("components")',
  'if (currentProduct && !componentScreenActive) { renderPanelStatic(); }',
  "updateComponentsReturnButton();",
  "updateComponentsContextHeader();",
  "renderComponentAddPanel();",
  "renderAssemblyComponentRows();",
  'reverseOverlay.classList.contains("show")',
  "renderComponentReverseVehicleMakerOptions"
].forEach((fragment) => requireFragment(languageSource, fragment, "component language refresh"));

const localizedNameSource = sourceBetween(app, "function componentLocalizedNameText", "function componentRowNameText");
[
  'if (!text || currentLang === "ja") return text;',
  "componentNameOptionLabel(text) || text",
  'currentLang !== "ja"',
  "<div class='component-sub'>"
].forEach((fragment) => requireFragment(localizedNameSource, fragment, "localized component name"));

[
  '"B接点": "B Contact"',
  '"ロックワッシャー": "Lock Washer"',
  '"リヤカバー": "Rear Cover"',
  '"メタル": "Metal Bearing"',
  '"B接点": "B触点"',
  '"ロックワッシャー": "锁紧垫圈"'
].forEach((fragment) => requireFragment(app, fragment, "manual component translation fallback"));

const displayTranslationSource = sourceBetween(app, "async function loadComponentDisplayNameTranslations", "function componentRowNameText");
[
  'sb.rpc("get_component_name_master_candidates"',
  'target_lang: lang',
  'component_name_en',
  'component_name_zh',
  'componentDisplayNameTranslationCache[cacheKey] = labels'
].forEach((fragment) => requireFragment(displayTranslationSource, fragment, "master-backed component translation"));

const productionSource = sourceBetween(app, "function renderProductionComponents", "async function loadProductionComponentSummaryForRow");
requireFragment(productionSource, 'componentLocalizedNameHtml(partName)', "production component summary localization");
requireFragment(app, 'loadComponentDisplayNameTranslations(componentCatalogCategoryCode(row))', "production translation preload");
requireFragment(app, 'await translationPromise;', "translation preload wait");

const componentRowsSource = sourceBetween(app, "function renderAssemblyComponentRows()", "async function loadAssemblyComponentsForCurrent()");
requireFragment(componentRowsSource, "componentRowNameHtml(row)", "component list localization");
requireFragment(app, 'loadComponentDisplayNameTranslations(componentCatalogCategoryCode(currentProduct))', "component translation preload");

[
  'id="component-name-master-untranslated-only"',
  'id="component-name-translation-overlay"',
  'id="component-name-translation-en"',
  'id="component-name-translation-zh"'
].forEach((fragment) => requireFragment(html, fragment, "translation maintenance UI"));

const managementSource = sourceBetween(app, "function componentNameMasterManageRows", "function componentCompatRelationLabel");
[
  'component-name-master-untranslated-only',
  'data-component-name-master-edit',
  'function openComponentNameTranslationForm',
  'async function saveComponentNameTranslation',
  'component_name_en: normalizeComponentNameText',
  'component_name_zh: normalizeComponentNameText'
].forEach((fragment) => requireFragment(managementSource, fragment, "translation maintenance logic"));

const alternativesSource = sourceBetween(app, "function renderComponentAlternatives", "function closeComponentAlternativeForm");
requireFragment(alternativesSource, 'componentLocalizedNameText(part.part_name || "")', "alternative component localization");

const parallelSource = sourceBetween(app, "async function loadParallelDiffForCurrent", "function isCurrentDetailLoad");
requireFragment(parallelSource, 'componentLocalizedNameText(row.base_component_name || "-")', "parallel base localization");
requireFragment(parallelSource, 'componentLocalizedNameText(row.target_component_name || "-")', "parallel target localization");

requireFragment(html, 'content="v1.1.808"', "release version");
requireFragment(app, 'var APP_VERSION       = "v1.1.808"', "runtime version");

console.log("Component language switching verified.");
