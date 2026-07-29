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

const addSource = functionSource("addAssemblyComponentForCurrent", "function componentEditInput");
if (!addSource.includes('normalizeComponentManufacturerInput(currentProduct.manufacturer) || "UNKNOWN"') ||
    !addSource.includes('t("component_assy_mfr_pn_required")') ||
    addSource.includes("if (!targetManufacturer || !targetManufacturerPartNumber)")) {
  throw new Error("manual component add must allow a missing ASSY manufacturer and validate only the ASSY part number");
}

const values = {
  "component-add-name": "B接点",
  "component-add-mfr": "",
  "component-add-mfr-pn": "A-2050-9",
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
let alertMessage = "";

const sandbox = {
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
  resolveCurrentCoreDkdShohinId: async () => 36628,
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
  await sandbox.result();
  if (!rpcCall || rpcCall.name !== "add_manual_assembly_component") {
    throw new Error("manual component add must reach the RPC when only the ASSY manufacturer is missing");
  }
  if (rpcCall.payload.target_manufacturer !== "UNKNOWN" ||
      rpcCall.payload.target_manufacturer_part_number !== "SM-760-04" ||
      rpcCall.payload.component_manufacturer_part_number !== "A-2050-9") {
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
