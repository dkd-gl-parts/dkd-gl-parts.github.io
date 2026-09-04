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
  'return "<div class=\'component-pn\'>" + esc(localized) + "</div>";'
].forEach((fragment) => requireFragment(localizedNameSource, fragment, "localized component name"));
if (localizedNameSource.includes("component-sub")) throw new Error("localized component name must not repeat the Japanese source name");

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

[
  'production_detail_title: "Details"',
  'production_core_part_number: "Core Part No."',
  'production_pallet: "Pallet"',
  'production_media_label: "Product Media"',
  'image_count: "{n} images"',
  'production_detail_title: "详情"',
  'production_core_part_number: "CORE零件编号"',
  'image_count: "{n} 张"'
].forEach((fragment) => requireFragment(app, fragment, "production chrome translation"));

const productionDetailSource = sourceBetween(app, "async function renderProductionDetail", "function productionImageKinds");
[
  't("btn_edit_part")',
  'productionKv(t("production_core_part_number")',
  'productionKv(t("production_pallet")',
  't("production_media_label")',
  't("product_3d_photos")',
  't("product_3d_model")'
].forEach((fragment) => requireFragment(productionDetailSource, fragment, "localized production detail"));

const productionImagesSource = sourceBetween(app, "function renderProductionImages", "function salesImageKinds");
requireFragment(productionImagesSource, 'tf("image_count", { n: images.length })', "localized production image count");
requireFragment(html, 'data-i18n="production_detail_title"', "localized production detail title");

requireFragment(html, 'content="v1.1.892"', "release version");
requireFragment(app, 'var APP_VERSION       = "v1.1.892"', "runtime version");

console.log("Component language switching verified.");
