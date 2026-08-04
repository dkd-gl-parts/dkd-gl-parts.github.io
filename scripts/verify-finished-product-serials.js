const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const styles = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const printCss = fs.readFileSync(path.join(root, "print.css"), "utf8");
const printRuntime = fs.readFileSync(path.join(root, "label-print-window.js"), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function functionSource(name) {
  const start = app.indexOf(`function ${name}(`);
  assert(start >= 0, `${name} is missing`);
  const brace = app.indexOf("{", start);
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = brace; index < app.length; index += 1) {
    const char = app[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return app.slice(start, index + 1);
    }
  }
  throw new Error(`${name} could not be parsed`);
}

assert(app.includes('sb.rpc("issue_finished_product_serials"'), "issuance RPC call is missing");
assert(app.includes('sb.rpc("record_finished_product_label_print"'), "audited label-print RPC call is missing");
assert(!app.includes('.from("finished_label_issues").insert('), "browser still inserts finished-label batches directly");
assert(!app.includes("quickchart.io/qr"), "production labels still depend on an external QR service");
assert(html.includes('id="finished-label-quantity" type="number" min="1" max="100"'), "quantity guard is missing from the form");
assert(html.includes('id="finished-label-print-count"') && html.includes('min="1" max="1"') && html.includes('value="1" readonly'), "one-label-per-unit rule is missing");
assert(html.includes('id="finished-label-layout-preview"'), "live 45x20 label layout preview is missing");
assert(html.includes('id="finished-label-layout-qr-value"'), "QR payload preview is missing");
assert(html.indexOf('id="btn-finished-label-save"') < html.indexOf('id="finished-label-layout-preview"'), "register-and-print action is not visible above the label details");
assert(html.includes('data-i18n="finished_label_g_part_number">G品番'), "selected-product summary does not expose the G part number");
assert(html.includes('id="finished-label-mode-hub"'), "finished registration label-screen chooser is missing");
assert(html.includes('data-finished-label-mode="product"') && html.includes('data-finished-label-mode="box"'), "separate product and box label entries are missing");
assert(html.includes('id="btn-finished-label-save"') && html.includes('data-i18n="finished_label_issue_save">登録・印刷</button>'), "register-and-print button label is not concise");
assert(html.includes('data-i18n="finished_label_preview" disabled>印刷</button>'), "finished-label print button label is not concise");
assert(html.includes('id="btn-finished-label-load-more"') && html.includes('data-i18n="btn_load_more" hidden>さらに表示</button>'), "finished-label search load-more action is missing");
assert(html.includes('id="finished-label-search" type="search" inputmode="latin" lang="en" enterkeyhint="search" autocapitalize="characters" autocomplete="off" spellcheck="false"'), "finished-label search input is not configured for immediate half-width alphanumeric entry");
assert(html.includes('data-i18n="finished_label_layout_title">完品シール レイアウト</h4>'), "finished-label layout title is inconsistent");
assert(!html.includes("製品本体シール"), "obsolete 製品本体シール name remains in the screen");
assert(html.includes('data-i18n="finished_label_hub_title"'), "label-screen chooser title is not localized");
assert(html.includes('data-i18n="finished_label_component_default_hint"'), "component default hint is not localized");
assert(html.includes('data-i18n-aria-label="finished_label_preview_aria"'), "finished-label preview aria label is not localized");
assert(html.includes('data-i18n-aria-label="finished_box_label_preview_aria"'), "box-label preview aria label is not localized");
assert(functionSource("applyI18n").includes('[data-i18n-aria-label]'), "localized aria labels are not applied");
const languageSource = functionSource("applyLanguage");
assert(languageSource.includes('isScreenActive("finished-label-mgmt")'), "active finished-label screen is not rerendered after a language change");
assert(languageSource.includes("renderFinishedLabelComponents()") && languageSource.includes("renderFinishedLabelHistory()"), "dynamic finished-label content is not rerendered after a language change");
[
  "finished_label_hub_title",
  "finished_label_component_picker_prompt",
  "finished_label_variant_stock",
  "finished_label_print_setup",
  "finished_box_label_print_setup",
  "finished_label_count_summary",
  "finished_label_priority_both_kinds"
].forEach((key) => {
  assert((app.match(new RegExp(`${key}:`, "g")) || []).length === 3, `${key} is not translated in all three languages`);
});
const finishedLabelStart = app.indexOf("function enterFinishedLabelMgmt");
const finishedLabelEnd = app.indexOf("// 完品出荷・保証管理", finishedLabelStart);
const finishedLabelSource = app.slice(finishedLabelStart, finishedLabelEnd);
[
  "品番を選択してください。",
  "追加できる登録済み部品はありません",
  "一部のみ初回印刷済みです。管理者に確認してください。",
  "ラベル汚損・貼り替え",
  "左側の発行履歴から箱シール対象を選択してください。"
].forEach((copy) => assert(!finishedLabelSource.includes(`\"${copy}\"`), `dynamic UI copy is still hard-coded: ${copy}`));
assert(functionSource("setFinishedLabelPrintMode").includes('t(isBox ? "finished_box_label_screen_title"'), "label mode titles do not follow the selected language");
assert(functionSource("renderFinishedLabelCategoryOptions").includes("tCat(row[0])"), "finished-label category options are not localized");
assert(functionSource("buildFinishedLabelPrintHtml").includes("esc(currentLang)"), "finished-label print document language is hard-coded");
assert(functionSource("buildFinishedBoxLabelPrintHtml").includes('tf("finished_box_label_print_setup"'), "box-label print instructions are not localized");
const readinessSource = functionSource("loadFinishedLabelProductReadiness");
assert(readinessSource.includes("fetchProductionPartRegistrationCountMap(products)"), "finished-label result priority does not read registered component kinds");
assert(readinessSource.includes('.from("core_product_variants")') && readinessSource.includes('["rebuilt", "aftermarket_new"]'), "finished-label result priority does not inspect both product kinds");
assert(functionSource("finishedLabelProductPriority").includes("hasBothComponents"), "products with rebuilt and new components are not given the highest priority");
const resultRenderSource = functionSource("renderFinishedLabelResults");
assert(resultRenderSource.includes("finishedLabelProducts.slice(0, finishedLabelVisibleLimit)"), "finished-label results are not capped before rendering");
assert(resultRenderSource.includes("loadMore.hidden = visibleProducts.length >= finishedLabelProducts.length"), "finished-label load-more visibility is not tied to remaining results");
assert(functionSource("showMoreFinishedLabelProducts").includes("FINISHED_LABEL_PAGE_STEP"), "finished-label load-more does not advance in fixed pages");
assert(functionSource("searchFinishedLabelProducts").includes("normalizeFinishedLabelSearchInput(qEl)"), "finished-label search does not normalize the visible input before querying");
assert(functionSource("searchFinishedLabelProducts").includes('if (!q && finishedLabelPrintMode !== "box")'), "blank finished-label search is not stopped before loading production candidates");
assert(app.includes('if (finishedLabelPrintMode === "box") searchFinishedLabelProducts();'), "opening the finished-label screen still performs a blank product search");
assert(app.includes('finishedLabelSearchInput.addEventListener("compositionend"') && app.includes('finishedLabelSearchInput.addEventListener("input"'), "finished-label search does not normalize typing and IME-confirmed input");
assert(app.includes('finishedLabelSearchInput.addEventListener("focus"') && app.includes("finishedLabelAsciiKeyFromEvent(e)"), "finished-label search does not switch to direct ASCII handling on focus");
assert(app.includes('finishedLabelSearchInput.addEventListener("beforeinput"') && app.includes("finishedLabelSearchSuppressComposition"), "IME follow-up input is not suppressed after direct ASCII insertion");
assert(app.includes("restoreFinishedLabelSearchCommittedInput();\n    releaseFinishedLabelSearchCompositionSuppression(80);"), "IME composition completion can duplicate a directly inserted character");
assert(/@page\s*{[^}]*size:\s*45mm\s+20mm/i.test(printCss), "print page is not fixed at 45x20mm");
assert(/\.serial-label\s*{[^}]*width:\s*45mm;[^}]*height:\s*20mm;/i.test(printCss), "label dimensions are not exact");
assert(/\.serial-label-field-name\s*{[^}]*font-size:/i.test(printCss), "print field hierarchy is missing");
const componentLoadSource = functionSource("loadFinishedLabelComponentCandidates");
assert(componentLoadSource.includes('.from("assembly_component_usage_details")'), "product-scoped registered components are not loaded");
assert(componentLoadSource.includes('.eq("dkd_shohin_id", productDkdId(product))'), "component candidates are not limited to the selected product");
assert(componentLoadSource.includes('.eq("product_kind", normalizeProductKind(variant.product_kind))'), "component candidates are not limited to the selected product kind");
assert(componentLoadSource.includes('Number(row.replacement_rate) === 100'), "100-percent components are not selected by default");
assert(functionSource("addFinishedLabelSelectedComponent").includes("belongsToSelectedProduct"), "additional components are not guarded by the selected product candidate list");
assert(functionSource("openFinishedLabelComponentRegistration").includes('componentReturnScreen = "finished-label-mgmt"'), "category-based component registration is not available from the finished-label screen");
const productSelectionSource = functionSource("selectFinishedLabelProduct");
assert(productSelectionSource.indexOf("renderFinishedLabelCategoryOptions") < productSelectionSource.indexOf("loadFinishedLabelComponentCandidates"), "registered product components are not loaded after product selection");
assert(productSelectionSource.includes('.from("core_products").select(CORE_PRODUCT_FAST_SELECT)'), "selected products are not refreshed from the authoritative product master");
assert(functionSource("applyFinishedLabelTemplate").includes("finishedLabelComponentCandidates"), "100-percent component reset is not based on registered product components");
const previewProductNoSource = functionSource("finishedLabelPreviewProductNo");
assert(previewProductNoSource.includes("product.gltek_part_number"), "G part number is missing from the finished-label preview");
assert(!previewProductNoSource.includes("product.manufacturer_part_number"), "finished-label preview still falls back to the manufacturer part number");
assert(functionSource("readFinishedLabelRecord").includes("if (!p.gltek_part_number)"), "finished-label printing is not blocked when the G part number is missing");
assert(html.includes('id="pf-mfr" type="text" list="manufacturer-options" autocomplete="off"'), "manual manufacturer selection can still use browser history suggestions");
const manufacturerOptionsStart = html.indexOf('id="manufacturer-options"');
const manufacturerOptions = html.slice(manufacturerOptionsStart, html.indexOf('</datalist>', manufacturerOptionsStart));
assert(!/value=["'](?:\u5927\u5149|DKS|DAIKO)/i.test(manufacturerOptions), "DKS remains in the manual manufacturer choices");
const dksManufacturerSandbox = {};
vm.createContext(dksManufacturerSandbox);
vm.runInContext(`${functionSource("normalizeManualManufacturerSelection")}; ${functionSource("isDksManagedManufacturer")}; ${functionSource("manualDksManufacturerSelectionBlocked")}; this.isDks = isDksManagedManufacturer; this.blocked = manualDksManufacturerSelectionBlocked;`, dksManufacturerSandbox);
assert(dksManufacturerSandbox.isDks("\u5927\u5149") && dksManufacturerSandbox.isDks("\u5927\u5149\u30b5\u30fc\u30d3\u30b9") && dksManufacturerSandbox.isDks("\uff24\uff2b\uff33"), "DKS manufacturer aliases are not normalized consistently");
assert(dksManufacturerSandbox.blocked("\u5927\u5149", null, true), "manual product add accepts DKS as a manufacturer");
assert(dksManufacturerSandbox.blocked("\u5927\u5149", "DENSO", false), "manual product edit can change a manufacturer to DKS");
assert(!dksManufacturerSandbox.blocked("\u5927\u5149", "\u5927\u5149", false), "an unchanged existing DKS identity cannot be preserved");
assert(functionSource("setCoreProductFormFields").includes("clearDksManualCopy"), "adding from an existing DKS product still copies its manufacturer identity");
const productManufacturerPanelSource = functionSource("setGltekProductAddPanel");
assert(productManufacturerPanelSource.includes("lockExistingDksIdentity") && productManufacturerPanelSource.includes("manufacturerPartEl.readOnly = lockExistingManufacturerIdentity"), "existing DKS manufacturer fields are not read-only in manual edit");
assert(functionSource("saveCoreProductForm").includes("manualDksManufacturerSelectionBlocked"), "core-product saves do not reject new manual DKS manufacturer assignments");
assert(functionSource("savePartForm").includes("manualDksManufacturerSelectionBlocked"), "part saves do not reject new manual DKS manufacturer assignments");
const productSaveSource = functionSource("saveCoreProductForm");
assert(productSaveSource.includes('if (!isGltekAdd && !isDksManagedManufacturer(manufacturer))'), "existing DKS products still trigger automatic G-number issuance during manual edits");
assert(productSaveSource.includes('var gltekAutoIssueContext = addingProduct ? "product_add" : "product_edit";'), "product save does not distinguish add and edit G-number checks");
assert(productSaveSource.includes('if (!isGltekAdd && !isDksManagedManufacturer(manufacturer))') && productSaveSource.includes('context: gltekAutoIssueContext'), "eligible external-product add and edit saves do not check G-number issuance");
assert(productSaveSource.includes('gltekAutoIssueFailureText(gltekAutoIssueContext'), "G-number issuance failures do not identify whether the part number was added or edited");
const ensureGltekSource = functionSource("ensureGltekPartNumberIssuedForDkdId");
assert(ensureGltekSource.indexOf("if (product.gltek_part_number)") < ensureGltekSource.indexOf("if (!canIssueGltekPartNumber())"), "existing G numbers are not checked before issue permission");
const issuedPatches = [];
let issueRpcCount = 0;
let canIssueGNumber = false;
let issueLookupProduct = { dkd_shohin_id: 101, gltek_part_number: "G0101-00001" };
const issueSandbox = {
  canIssueGltekPartNumber() { return canIssueGNumber; },
  async fetchCoreProductForGltekIssue() { return { data: issueLookupProduct, error: null }; },
  applyGltekPartNumberIssueResult(id, result) { issuedPatches.push({ id, result }); },
  gltekAutoIssuePermissionError() { return new Error("permission"); },
  gltekAutoIssueMissingSourceError() { return new Error("missing-source"); },
  async callGltekPartNumberIssueRpc() {
    issueRpcCount += 1;
    return { data: { action: "issued", gltek_part_number: "G0101-00002" }, error: null };
  }
};
vm.createContext(issueSandbox);
vm.runInContext(`${ensureGltekSource.replace(/^function /, "async function ")}; this.ensureGNumber = ensureGltekPartNumberIssuedForDkdId;`, issueSandbox);

(async function verifyProductSaveGNumberChecks() {
  let outcome = await issueSandbox.ensureGNumber(101, {});
  assert(outcome.reason === "existing" && issueRpcCount === 0, "an existing G number is reissued or blocked by issue permission");

  canIssueGNumber = true;
  issueLookupProduct = { dkd_shohin_id: 102, manufacturer: "DENSO", manufacturer_part_number: "104210-0001", gltek_part_number: null };
  outcome = await issueSandbox.ensureGNumber(102, {});
  assert(outcome.result && outcome.result.gltek_part_number === "G0101-00002" && issueRpcCount === 1, "a missing G number is not issued for an authorized save");

  canIssueGNumber = false;
  issueLookupProduct = { dkd_shohin_id: 103, manufacturer: "DENSO", manufacturer_part_number: "104210-0002", gltek_part_number: null };
  outcome = await issueSandbox.ensureGNumber(103, {});
  assert(outcome.error && outcome.error.message === "permission" && issueRpcCount === 1, "a missing G number is silently skipped without issue permission");
})().catch((error) => {
  process.nextTick(() => { throw error; });
});
assert(styles.includes("grid-template-columns: 280px minmax(0, 1fr)") && styles.includes("grid-template-columns: minmax(470px, 1.08fr) minmax(360px, .92fr)"), "desktop no-scroll label workspace layout is missing");
assert(styles.includes("table-layout: fixed") && styles.includes("overflow-x: hidden; overflow-y: auto"), "component columns can still force horizontal scrolling in the compact layout");
assert(styles.includes(".finished-label-toolbar .finished-label-print-action") && styles.includes("font-size: 15px"), "finished-label print actions are not visually enlarged");
assert(styles.includes(".finished-label-print-action.missing-g-number"), "missing G part number is not visible on the register-and-print action");
const saveButtonSource = functionSource("updateFinishedLabelSaveButton");
assert(saveButtonSource.includes('finished_label_g_number_missing_value') && saveButtonSource.includes('missing-g-number'), "register-and-print does not explain a missing G part number");
assert(functionSource("saveFinishedLabelIssue").includes('alert(t("finished_label_g_part_number_required"))'), "register-and-print does not explain why a product without a G part number cannot print");
const saveButtonClasses = new Set();
const saveButton = {
  disabled: false,
  textContent: "",
  title: "",
  ariaDisabled: "",
  classList: { toggle(name, active) { if (active) saveButtonClasses.add(name); else saveButtonClasses.delete(name); } },
  setAttribute(name, value) { if (name === "aria-disabled") this.ariaDisabled = value; }
};
const saveButtonSandbox = {
  document: { getElementById(id) { return id === "btn-finished-label-save" ? saveButton : null; } },
  t(key) { return key; }
};
vm.createContext(saveButtonSandbox);
vm.runInContext(`${saveButtonSource}; this.updateSave = updateFinishedLabelSaveButton;`, saveButtonSandbox);
saveButtonSandbox.updateSave({ gltek_part_number: "" });
assert(!saveButton.disabled && saveButton.textContent === "finished_label_g_number_missing_value" && saveButtonClasses.has("missing-g-number"), "missing G part number is not presented as an actionable explanation");
saveButtonSandbox.updateSave({ gltek_part_number: "G0101-00001" });
assert(!saveButton.disabled && saveButton.textContent === "finished_label_issue_save" && !saveButtonClasses.has("missing-g-number"), "valid G part number does not restore register-and-print");
saveButtonSandbox.updateSave(null);
assert(saveButton.disabled && saveButton.ariaDisabled === "true", "register-and-print is enabled before a product is selected");

const searchInputSandbox = {};
vm.createContext(searchInputSandbox);
vm.runInContext(`${functionSource("normalizeAsciiWidth")}; ${functionSource("normalizeFinishedLabelSearchValue")}; this.normalizeSearch = normalizeFinishedLabelSearchValue;`, searchInputSandbox);
assert(searchInputSandbox.normalizeSearch("ｇ０１０１－００００１") === "G0101-00001", "full-width G part number is not normalized to half-width alphanumeric text");
assert(searchInputSandbox.normalizeSearch(" １０４２１０―１２３４ abc テスト ") === "104210-1234ABC", "finished-label search does not remove non-alphanumeric text after width normalization");

const directKeySandbox = {};
vm.createContext(directKeySandbox);
vm.runInContext(`${functionSource("finishedLabelAsciiKeyFromEvent")}; ${functionSource("insertFinishedLabelAsciiKey")}; this.asciiKey = finishedLabelAsciiKeyFromEvent; this.insertKey = insertFinishedLabelAsciiKey;`, directKeySandbox);
assert(directKeySandbox.asciiKey({ code: "KeyE", key: "Process", isComposing: true }) === "E", "IME-active E key is not handled as direct half-width E");
assert(directKeySandbox.asciiKey({ code: "KeyA", key: "あ", isComposing: true }) === "A", "IME-active A key is not handled as direct half-width A");
assert(directKeySandbox.asciiKey({ code: "Digit5" }) === "5", "top-row number key is not handled as direct half-width input");
assert(directKeySandbox.asciiKey({ code: "Numpad7" }) === "7", "numpad key is not handled as direct half-width input");
assert(directKeySandbox.asciiKey({ code: "Minus" }) === "-", "hyphen key is not handled as direct half-width input");
assert(directKeySandbox.asciiKey({ code: "KeyV", ctrlKey: true }) === "", "paste shortcut is incorrectly intercepted");
const directInput = {
  value: "G01-0001",
  selectionStart: 1,
  selectionEnd: 3,
  setRangeText(value, start, end) {
    this.value = this.value.slice(0, start) + value + this.value.slice(end);
    this.selectionStart = this.selectionEnd = start + value.length;
  }
};
directKeySandbox.insertKey(directInput, "A");
assert(directInput.value === "GA-0001" && directInput.selectionStart === 2, "direct ASCII insertion does not preserve selection and caret behavior");

const committedInputSandbox = {};
vm.createContext(committedInputSandbox);
vm.runInContext(`${functionSource("captureFinishedLabelSearchInputState")}; ${functionSource("restoreFinishedLabelSearchInputState")}; ${functionSource("isFinishedLabelSearchCompositionFollowup")}; this.capture = captureFinishedLabelSearchInputState; this.restore = restoreFinishedLabelSearchInputState; this.isFollowup = isFinishedLabelSearchCompositionFollowup;`, committedInputSandbox);
assert(committedInputSandbox.isFollowup({ inputType: "insertCompositionText", isComposing: true }, true), "active IME composition input is not identified as a duplicate follow-up");
assert(committedInputSandbox.isFollowup({ inputType: "insertText", data: "Ｅ" }, false), "IME final insertText is not identified as a duplicate follow-up");
assert(!committedInputSandbox.isFollowup({ inputType: "deleteContentBackward" }, false), "backspace is incorrectly suppressed after direct ASCII input");
assert(!committedInputSandbox.isFollowup({ inputType: "insertFromPaste" }, false), "paste is incorrectly suppressed after direct ASCII input");
const committedInput = {
  value: "EA1-",
  selectionStart: 4,
  selectionEnd: 4,
  setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; }
};
const committedState = committedInputSandbox.capture(committedInput);
committedInput.value = "EA1-Ｅ";
committedInput.selectionStart = committedInput.selectionEnd = 5;
committedInputSandbox.restore(committedInput, committedState);
assert(committedInput.value === "EA1-" && committedInput.selectionStart === 4, "IME follow-up text is not restored to the single committed ASCII value");

const readinessSandbox = {
  finishedLabelPrintMode: "product",
  finishedLabelBoxReadinessMap: {},
  finishedLabelProductReadinessMap: {
    both_components: { rebuiltComponents: 2, aftermarketNewComponents: 1, hasRebuiltVariant: true, hasAftermarketNewVariant: true },
    both_variants: { rebuiltComponents: 1, aftermarketNewComponents: 0, hasRebuiltVariant: true, hasAftermarketNewVariant: true },
    rebuilt_only: { rebuiltComponents: 3, aftermarketNewComponents: 0, hasRebuiltVariant: true, hasAftermarketNewVariant: false },
    variants_only: { rebuiltComponents: 0, aftermarketNewComponents: 0, hasRebuiltVariant: true, hasAftermarketNewVariant: true },
    empty: {}
  },
  finishedLabelInstructionMap: {},
  productDkdId(product) { return product.id; }
};
vm.createContext(readinessSandbox);
vm.runInContext(`${functionSource("finishedLabelProductPriority")}; ${functionSource("sortFinishedLabelProducts")}; this.sortReady = sortFinishedLabelProducts;`, readinessSandbox);
const readinessOrder = readinessSandbox.sortReady([
  { id: "empty" },
  { id: "rebuilt_only" },
  { id: "both_components" },
  { id: "variants_only" },
  { id: "both_variants" }
]).map((product) => product.id);
assert(readinessOrder.join(",") === "both_components,both_variants,rebuilt_only,variants_only,empty", "finished-label readiness priority order is incorrect");

const qrInputs = [];
const sandbox = {
  APP_VERSION: "v-test",
  currentLang: "en",
  t(key) {
    return {
      btn_print: "Print",
      finished_label_print_setup: "Finished Label: 2 units"
    }[key] || key;
  },
  tf(key, vars) {
    let value = {
      btn_print: "Print",
      finished_label_print_setup: "Finished Label: {n} units"
    }[key] || key;
    Object.keys(vars || {}).forEach((name) => {
      value = value.replace(new RegExp(`\\{${name}\\}`, "g"), vars[name]);
    });
    return value;
  },
  esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  },
  finishedProductSerialQrDataUrl(value) {
    qrInputs.push(value);
    return `data:image/png;base64,${Buffer.from(value).toString("base64")}`;
  }
};
vm.createContext(sandbox);
vm.runInContext(`${functionSource("buildFinishedLabelMarkup")}; ${functionSource("buildFinishedLabelPrintHtml")}; this.build = buildFinishedLabelPrintHtml;`, sandbox);

const serials = ["M2026-0000001", "M2026-0000002"];
const output = sandbox.build({
  issueCode: "FB2026-0000001",
  productNo: "104210-4120",
  units: serials.map((manufacturing_serial, index) => ({ id: index + 1, manufacturing_serial, gltek_part_number: "G0101-00001" }))
});

assert((output.match(/class='serial-label'/g) || []).length === 2, "one label per finished unit was not generated");
assert((output.match(/<span>PRODUCT ID<\/span>/g) || []).length === 2, "product-label marker is missing");
assert((output.match(/GLTEK PART NO\./g) || []).length === 2, "GLTEK part-number heading is missing");
assert((output.match(/G0101-00001/g) || []).length === 2, "GLTEK PART NO. does not display the G part number");
assert((output.match(/MFG SERIAL \/ S\/N/g) || []).length === 2, "manufacturing-serial heading is missing");
assert(!output.includes("化粧箱"), "obsolete box-label copy is still generated");
assert(qrInputs.length === 2 && qrInputs.every((value, index) => value === serials[index]), "QR payload is not serial-only");
assert(serials.every((serial) => output.includes(serial)), "human-readable manufacturing serial is missing");
assert(output.includes("label-print-window.js?dcats_version=v-test"), "finished-label print runtime is missing or unversioned");
assert(!output.includes("onclick="), "finished-label print window uses a CSP-blocked inline handler");

let printCount = 0;
let focusCount = 0;
let printClickHandler = null;
const printRuntimeButton = {
  bound: "",
  getAttribute(name) {
    return name === "data-dcats-print-bound" ? this.bound : null;
  },
  setAttribute(name, value) {
    if (name === "data-dcats-print-bound") this.bound = value;
  },
  addEventListener(type, handler) {
    if (type === "click") printClickHandler = handler;
  }
};
const printRuntimeSandbox = {
  document: {
    readyState: "complete",
    getElementById(id) {
      return id === "dcats-print-now" ? printRuntimeButton : null;
    }
  },
  window: {
    focus() { focusCount += 1; },
    print() { printCount += 1; }
  }
};
vm.createContext(printRuntimeSandbox);
vm.runInContext(printRuntime, printRuntimeSandbox);
assert(typeof printClickHandler === "function", "finished-label print button is not bound inside its own window");
assert(printRuntimeButton.bound === "true", "finished-label print runtime does not mark the button as bound");
printClickHandler();
assert(printCount === 1 && focusCount === 1, "finished-label print button does not invoke printing");

const directPrintWindow = {
  closed: false,
  focus() { focusCount += 1; },
  print() { printCount += 1; }
};
const directPrintSandbox = { console: { warn() {} } };
vm.createContext(directPrintSandbox);
vm.runInContext(`${functionSource("printFinishedLabelWindow")}; ${functionSource("bindFinishedLabelPrintButton")}; this.printWindow = printFinishedLabelWindow; this.bindButton = bindFinishedLabelPrintButton;`, directPrintSandbox);
assert(directPrintSandbox.printWindow(directPrintWindow), "finished-label window print request is rejected");
assert(printCount === 2 && focusCount === 2, "finished-label registration does not invoke the print dialog directly");

let parentClickHandler = null;
const parentBoundButton = {
  bound: "",
  getAttribute() { return this.bound; },
  setAttribute(name, value) { this.bound = value; },
  addEventListener(type, handler) { if (type === "click") parentClickHandler = handler; }
};
const parentBoundWindow = {
  closed: false,
  document: { getElementById() { return parentBoundButton; } },
  focus() { focusCount += 1; },
  print() { printCount += 1; }
};
assert(directPrintSandbox.bindButton(parentBoundWindow), "parent window does not bind the label print action");
assert(typeof parentClickHandler === "function" && parentBoundButton.bound === "true", "parent-bound print action is missing");
parentClickHandler();
assert(printCount === 3 && focusCount === 3, "parent-bound print button does not invoke printing");
assert(functionSource("printFinishedLabelWindowWhenReady").includes('win.addEventListener("load"'), "automatic printing does not wait for print assets");
assert(functionSource("printFinishedLabelWindowWhenReady").includes("win.document.fonts.ready"), "automatic printing does not wait for fonts");
assert(functionSource("openFinishedLabelPrintPreview").includes("printFinishedLabelWindowWhenReady(win)"), "finished-label printing starts before assets are ready");

const saveSource = functionSource("saveFinishedLabelIssue");
assert(saveSource.indexOf('if (!printWindow)') < saveSource.indexOf('sb.rpc("issue_finished_product_serials"'), "finished-product registration can proceed after a blocked print window");
assert(saveSource.includes("printWindow.document.close()"), "finished-product registration loading window is left open");

const longOutput = sandbox.build({
  issueCode: "FB2026-0000002",
  productNo: "GEXTENDEDCODE01-00001",
  units: [{ id: 3, manufacturing_serial: "M2026-0000003" }]
});
assert(longOutput.includes("serial-label-product long"), "long GLTEK part numbers do not receive the adaptive type size");

console.log("Finished-product serial issuance, one-label rule, and product-scoped component defaults passed.");
