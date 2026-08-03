const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");

function functionSource(name, nextName) {
  const start = source.indexOf(`async function ${name}`);
  const end = source.indexOf(nextName, start + 1);
  if (start < 0 || end < start) throw new Error(`${name} could not be isolated`);
  return source.slice(start, end);
}

function sourceBetween(startText, endText) {
  const start = source.indexOf(startText);
  const end = source.indexOf(endText, start + 1);
  if (start < 0 || end < start) throw new Error(`${startText} could not be isolated`);
  return source.slice(start, end);
}

const validationSandbox = {
  normalizeAsciiWidth: (value) => String(value || "").replace(/[\uFF01-\uFF5E]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xFEE0)),
  t: (key) => key,
  tf: (key) => key
};
const normalizeSource = sourceBetween("function normalizeComponentPartNumberInput", "function normalizeComponentManufacturerInput");
const validationSource = sourceBetween("function componentPartNumberSpec", "function setComponentPartNumberInputState");
vm.runInNewContext(`${normalizeSource}\n${validationSource}\nvalidationResults = {
  period: componentPartNumberValidation("4.5", "manufacturer"),
  fullWidthPeriod: componentPartNumberValidation("４．５", "manufacturer"),
  comma: componentPartNumberValidation("4,5", "manufacturer"),
  multiplication: componentPartNumberValidation("4×5", "manufacturer"),
  letterX: componentPartNumberValidation("4X5", "manufacturer"),
  invalidSlash: componentPartNumberValidation("4/5", "manufacturer"),
  periodKey: normalizedComponentPartKey("4.5"),
  integerKey: normalizedComponentPartKey("45"),
  multiplicationKey: normalizedComponentPartKey("4×5"),
  letterXKey: normalizedComponentPartKey("4X5")
};`, validationSandbox);
if (validationSandbox.validationResults.period.errors.length || validationSandbox.validationResults.period.value !== "4.5" ||
    validationSandbox.validationResults.fullWidthPeriod.errors.length || validationSandbox.validationResults.fullWidthPeriod.value !== "4.5" ||
    validationSandbox.validationResults.comma.errors.length || validationSandbox.validationResults.multiplication.errors.length ||
    validationSandbox.validationResults.letterX.errors.length || !validationSandbox.validationResults.invalidSlash.errors.length ||
    validationSandbox.validationResults.periodKey !== "4.5" || validationSandbox.validationResults.integerKey !== "45" ||
    validationSandbox.validationResults.multiplicationKey !== "4×5" || validationSandbox.validationResults.letterXKey !== "4X5" ||
    validationSandbox.validationResults.multiplicationKey === validationSandbox.validationResults.letterXKey) {
  throw new Error("component manufacturer part numbers must distinguish multiplication signs from the letter X");
}

const lookupSource = functionSource("lookupComponentPartNumberPair", "async function reconcileComponentAddPartNumbers");
if (!lookupSource.includes('/[.,×]/.test(String(mfrValue || ""))')) {
  throw new Error("period, comma, or multiplication-sign part numbers must bypass punctuation-stripping candidate replacement");
}

const inputEventSource = sourceBetween("function bindComponentPartNumberInputEvents", "function componentPartNumberSpec");
const inputHandlers = {};
let pendingNormalize = null;
let normalizeCount = 0;
let stateChangeCount = 0;
let commitCount = 0;
const imeInput = {
  value: "",
  addEventListener(type, handler) { inputHandlers[type] = handler; }
};
const inputEventSandbox = {
  normalizeComponentPartNumberElement: (el) => {
    normalizeCount += 1;
    el.value = String(el.value || "").replace(/[\uFF01-\uFF5E]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xFEE0)).toUpperCase();
    return el.value;
  },
  setTimeout: (handler) => { pendingNormalize = handler; return 1; },
  clearTimeout: () => { pendingNormalize = null; }
};
vm.runInNewContext(`${inputEventSource}; bind = bindComponentPartNumberInputEvents;`, inputEventSandbox);
inputEventSandbox.bind(imeInput, () => { stateChangeCount += 1; }, () => { commitCount += 1; });
imeInput.value = "９Ｘ９１３３Ｘ";
inputHandlers.compositionstart();
inputHandlers.input({ isComposing: true, inputType: "insertCompositionText" });
if (normalizeCount || imeInput.value !== "９Ｘ９１３３Ｘ") {
  throw new Error("component part-number input must not rewrite an active IME composition");
}
inputHandlers.compositionend();
inputHandlers.input({ isComposing: false, inputType: "insertText" });
if (normalizeCount || typeof pendingNormalize !== "function") {
  throw new Error("component part-number input must defer normalization until the IME follow-up input completes");
}
pendingNormalize();
if (normalizeCount !== 1 || imeInput.value !== "9X9133X" || commitCount) {
  throw new Error("IME-confirmed component part number must normalize exactly once without duplication");
}
imeInput.value = "４．５";
inputHandlers.blur();
if (imeInput.value !== "4.5" || normalizeCount !== 2 || commitCount !== 1 || stateChangeCount < 2) {
  throw new Error("component part-number blur must normalize and commit the final value");
}
if (!source.includes("bindComponentPartNumberInputEvents(el, updateComponentAddPartNumberInputState, reconcileComponentAddPartNumbers)")) {
  throw new Error("manual component add inputs must use the IME-safe part-number binding");
}

const addSource = functionSource("addAssemblyComponentForCurrent", "function componentEditInput");
if (!addSource.includes('normalizeComponentManufacturerInput(currentProduct.manufacturer) || "UNKNOWN"') ||
    !addSource.includes('t("component_assy_mfr_pn_required")') ||
    addSource.includes("if (!targetManufacturer || !targetManufacturerPartNumber)")) {
  throw new Error("manual component add must allow a missing ASSY manufacturer and validate only the ASSY part number");
}
if (!addSource.includes("if (componentAddSaving) return;") ||
    !addSource.includes("componentAddSaving = true;") ||
    !addSource.includes("finally {") ||
    !addSource.includes("componentAddSaving = false;")) {
  throw new Error("manual component add must hold an immediate in-flight lock until every exit path completes");
}

const refreshSource = sourceBetween("function setAppRefreshControlsDisabled", 'window.addEventListener("pagehide"');
let replaceCount = 0;
const refreshButton = { disabled: false };
const refreshEvent = {
  preventDefault() {},
  stopPropagation() {},
  stopImmediatePropagation() {}
};
const refreshSandbox = {
  appManualRefreshInProgress: false,
  componentAddSaving: false,
  appUpdateReloadTimer: 1,
  document: { querySelectorAll: () => [refreshButton] },
  window: {
    location: {
      href: "https://dcats.example.test/",
      replace: () => { replaceCount += 1; },
      reload: () => { replaceCount += 1; }
    }
  },
  URL,
  clearTimeout() {},
  saveAppRestoreState() {}
};
vm.runInNewContext(`${refreshSource}; refresh = manualRefreshApp;`, refreshSandbox);
refreshSandbox.refresh(refreshEvent);
refreshSandbox.refresh(refreshEvent);
if (replaceCount !== 1 || !refreshButton.disabled) {
  throw new Error("the app update action must accept only its first click while navigation is pending");
}
refreshSandbox.appManualRefreshInProgress = false;
refreshSandbox.componentAddSaving = true;
refreshSandbox.refresh(refreshEvent);
if (replaceCount !== 1) {
  throw new Error("the app update action must not reload while a component registration is in flight");
}

const values = {
  "component-add-name": "B接点",
  "component-add-mfr": "",
  "component-add-mfr-pn": "4×5",
  "component-add-genuine-pn": "",
  "component-add-position": "",
  "component-add-qty": "1",
  "component-add-unit-price": "",
  "component-add-replacement-rate": "",
  "component-add-manufacturing-memo": "",
  "component-add-interchange": "",
  "component-add-procurement-category": "",
  "component-add-start": "",
  "component-add-end": ""
};
const elements = {
  "component-add-error": { textContent: "" },
  "btn-component-add": { disabled: false, textContent: "" }
};
let rpcCall = null;
let rpcCallCount = 0;
let alertMessage = "";
let dkdLookupGate = null;

const sandbox = {
  componentAddSaving: false,
  currentProduct: {
    dkd_shohin_id: 36628,
    manufacturer: null,
    manufacturer_part_number: "SM-760-04",
    genuine_part_number: "31200-6F6-014"
  },
  document: {
    getElementById(id) {
      if (!elements[id]) elements[id] = { value: values[id] || "", classList: { toggle() {} }, title: "" };
      return elements[id];
    }
  },
  canManageComponentsInCurrentContext: () => true,
  selectedProductKind: () => "rebuilt",
  resolveCurrentCoreDkdShohinId: async () => {
    if (dkdLookupGate) await dkdLookupGate;
    return 36628;
  },
  normalizeComponentManufacturerInput: (value) => String(value || "").trim().toUpperCase(),
  normalizeComponentPartNumberInput: (value) => String(value || "").trim().toUpperCase(),
  normalizeComponentPartNumberElement: (el) => { if (el) el.value = String(el.value || "").trim().toUpperCase(); },
  componentAddValue: (id) => String(values[id] || "").trim(),
  setComponentAddValue: (id, value) => { values[id] = value || ""; },
  componentPartNumberValidation: (value, kind) => ({
    value: String(value || "").trim().toUpperCase(),
    errors: kind === "manufacturer" && !String(value || "").trim() ? ["component required"] : [],
    warnings: []
  }),
  reconcileComponentAddPartNumbers: async () => null,
  validateComponentPartNumberInputs: (manufacturerPartNumber, genuinePartNumber) => ({
    manufacturerPartNumber: String(manufacturerPartNumber || "").trim().toUpperCase(),
    genuinePartNumber: String(genuinePartNumber || "").trim().toUpperCase(),
    errors: [],
    warnings: []
  }),
  updateComponentAddPartNumberInputState: () => {},
  uniqueTextValues: (rows) => rows,
  confirmComponentPartNumberWarnings: () => true,
  canonicalComponentNameForStorage: (value) => value,
  componentNameMasterValidationMessage: () => "",
  applyComponentProcurementRateDefault: () => {},
  normalizeComponentReplacementRateElement: () => null,
  nullableIntFromInput: () => null,
  selectedComponentVariantId: () => 101,
  sb: {
    rpc: async (name, payload) => {
      rpcCallCount += 1;
      rpcCall = { name, payload };
      return { data: 999, error: null };
    }
  },
  writeLog: async () => {},
  recordComponentNameCandidateUsageForCurrent: () => {},
  clearComponentAddForm: () => {},
  closeComponentAddForm: () => {},
  loadAssemblyComponentsForCurrent: async () => {},
  alert: (message) => { alertMessage = message; },
  t: (key) => ({
    err_perm: "permission",
    component_catalog_locked_save: "catalog locked",
    component_mfr_pn_required: "component part required",
    component_assy_mfr_pn_required: "target ASSY part required",
    component_replacement_rate_digits: "digits",
    component_replacement_rate_range: "range",
    component_add_loading: "adding",
    component_add: "add",
    component_add_failed: "failed"
  })[key] || key
};

vm.runInNewContext(`${addSource}; result = addAssemblyComponentForCurrent;`, sandbox);

(async () => {
  let releaseDkdLookup;
  dkdLookupGate = new Promise((resolve) => { releaseDkdLookup = resolve; });
  const firstAdd = sandbox.result();
  const repeatedAdd = sandbox.result();
  if (!elements["btn-component-add"].disabled || !sandbox.componentAddSaving) {
    throw new Error("manual component add must lock before its first asynchronous lookup");
  }
  releaseDkdLookup();
  await Promise.all([firstAdd, repeatedAdd]);
  dkdLookupGate = null;
  if (rpcCallCount !== 1 || sandbox.componentAddSaving || elements["btn-component-add"].disabled) {
    throw new Error("repeated component add clicks must produce one RPC and release the lock afterward");
  }
  if (!rpcCall || rpcCall.name !== "add_manual_assembly_component") {
    throw new Error("manual component add must reach the RPC when only the ASSY manufacturer is missing");
  }
  if (rpcCall.payload.target_manufacturer !== "UNKNOWN" ||
      rpcCall.payload.target_manufacturer_part_number !== "SM-760-04" ||
      rpcCall.payload.component_manufacturer_part_number !== "4×5") {
    throw new Error("manual component add must preserve ASSY and component part numbers while defaulting the ASSY manufacturer");
  }
  if (elements["component-add-error"].textContent || alertMessage) {
    throw new Error("manual component add must not show a required-field error for the valid component part number");
  }

  rpcCall = null;
  sandbox.currentProduct.manufacturer_part_number = "";
  await sandbox.result();
  if (rpcCall || elements["component-add-error"].textContent !== "target ASSY part required") {
    throw new Error("a genuinely missing ASSY manufacturer part number must show the dedicated master-data error");
  }

  console.log("component manual add guard passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
