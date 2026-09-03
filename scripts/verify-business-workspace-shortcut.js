const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const workflow = fs.readFileSync(path.join(root, ".github", "workflows", "search-performance-guard.yml"), "utf8");
const shortcutPath = path.join(root, "assets", "integrations", "dcats-business-workspace.lnk");
const shortcutBytes = fs.readFileSync(shortcutPath);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sourceBetween(startText, endText) {
  const start = source.indexOf(startText);
  const end = source.indexOf(endText, start + startText.length);
  if (start < 0 || end < start) throw new Error(`${startText} could not be isolated`);
  return source.slice(start, end);
}

for (const id of [
  "sales-order-business-workspace-open",
  "dcats-business-workspace-overlay",
  "dcats-business-workspace-title",
  "dcats-business-workspace-close",
  "dcats-business-workspace-shortcut",
  "dcats-business-workspace-b2-title",
  "dcats-business-workspace-b2-state",
  "dcats-business-workspace-b2-directory",
  "dcats-business-workspace-b2-select",
  "dcats-business-workspace-message",
  "dcats-business-workspace-cancel"
]) {
  assert(html.includes(`id="${id}"`), `Business workspace UI is missing: ${id}`);
}

const driveUrl = "https://drive.google.com/drive/folders/1JLtJIHpZS5SdDAusy4yc0RijxN0YwoSQ";
assert(html.includes(`href="${driveUrl}"`), "The shared Google Drive folder link is missing");
assert(source.includes(`var DCATS_BUSINESS_WORKSPACE_URL = "${driveUrl}"`), "The shortcut target does not match the shared folder");
assert(source.includes('var DCATS_BUSINESS_WORKSPACE_SHORTCUT_URL = "assets/integrations/dcats-business-workspace.lnk"'), "The Windows .lnk asset is not configured");
assert(shortcutBytes.length > 100 && shortcutBytes.readUInt32LE(0) === 0x4c, "The Windows .lnk asset is invalid");
assert(source.includes('startIn: "desktop"'), "The save picker must start on the Windows desktop");
assert(source.includes('var DCATS_BUSINESS_WORKSPACE_SHORTCUT_FILENAME = "D-CATS\\u696d\\u52d9\\u9023\\u643a.lnk"'), "The shortcut needs a stable Japanese file name");
assert(source.includes('suggestedName: DCATS_BUSINESS_WORKSPACE_SHORTCUT_FILENAME'), "The save picker must use the shortcut file name constant");
assert(source.includes('typeof window.showSaveFilePicker === "function"'), "Chromium desktop save support is missing");
assert(source.includes("downloadDcatsBusinessWorkspaceShortcut(contents)"), "Unsupported browsers need a download fallback");
assert(source.includes('pickerError.name === "AbortError"'), "Cancelling the picker must not be reported as an error");
assert(source.includes('var DCATS_B2_EXPORT_DIRECTORY_NAME = "01_D-CATS\\u767a\\u884c"'), "The B2 issue-folder name is not fixed");
assert(source.includes('id: "dcats-b2-csv-export"'), "The B2 folder picker does not have a stable browser identity");
assert(source.includes('mode: "readwrite"'), "The B2 folder picker must request write access");
assert(source.includes('selectedHandle.name === DCATS_BUSINESS_WORKSPACE_DIRECTORY_NAME'), "Selecting the D-CATS workspace root is not supported");
assert(source.includes('selectedHandle.name === DCATS_B2_DIRECTORY_NAME'), "Selecting the B2 parent folder is not supported");
assert(source.includes('selectedHandle.name === DCATS_B2_EXPORT_DIRECTORY_NAME'), "Selecting the B2 issue folder is not supported");
assert(source.includes('storeDcatsB2ExportDirectory(targetHandle)'), "The B2 folder handle is not persisted per browser profile");

for (const fragment of [
  ".sales-order-business-workspace-button",
  ".form-card.dcats-business-workspace-card",
  ".dcats-business-workspace-actions",
  ".dcats-business-workspace-b2",
  ".dcats-business-workspace-b2-state.ready",
  ".dcats-business-workspace-message.error"
]) {
  assert(css.includes(fragment), `Business workspace layout is missing: ${fragment}`);
}

assert(workflow.includes('"scripts/verify-business-workspace-shortcut.js"'), "The shortcut verifier is not in the workflow path filter");
assert(workflow.includes("node scripts/verify-business-workspace-shortcut.js"), "The shortcut verifier is not executed by CI");

const featureSource = sourceBetween("var DCATS_BUSINESS_WORKSPACE_URL", "function updateSalesOrderSelectionButtons");
const elements = {
  "dcats-business-workspace-shortcut": { disabled: false },
  "dcats-business-workspace-message": { textContent: "", className: "" }
};
let pickerOptions;
let writtenContents = null;
const testShortcutBytes = Uint8Array.from([0x4c, 0, 0, 0, 1, 2, 3, 4]);
const context = {
  APP_VERSION: "v-test",
  Blob,
  encodeURIComponent,
  fetch: async (url, options) => {
    assert(url.includes("assets/integrations/dcats-business-workspace.lnk?dcats_version=v-test"), "The versioned .lnk asset was not requested");
    assert(options.cache === "no-store", "The .lnk asset must bypass stale browser cache");
    return { ok: true, arrayBuffer: async () => testShortcutBytes.buffer };
  },
  t: (key) => ({
    business_workspace_save_checking: "保存先確認中",
    business_workspace_created: "作成しました",
    business_workspace_created_notice: "作成しました",
    business_workspace_downloaded: "ダウンロードしました",
    business_workspace_cancelled: "キャンセルしました",
    business_workspace_failed: "作成できませんでした"
  })[key] || key,
  URL: {
    createObjectURL: () => "blob:test",
    revokeObjectURL: () => {}
  },
  document: {
    activeElement: null,
    body: { appendChild: () => {} },
    createElement: () => ({ click: () => {}, remove: () => {} }),
    getElementById: (id) => elements[id] || null
  },
  showDcatsAutoNotice: () => {},
  window: {
    setTimeout: (callback) => callback(),
    showSaveFilePicker: async (options) => {
      pickerOptions = options;
      return {
        createWritable: async () => ({
          write: async (value) => { writtenContents = new Uint8Array(value); },
          close: async () => {}
        })
      };
    }
  }
};
vm.runInNewContext(featureSource, context);

(async () => {
  await context.createDcatsBusinessWorkspaceShortcut();
  assert(pickerOptions.startIn === "desktop", "The shortcut picker did not start on the desktop");
  assert(pickerOptions.suggestedName === "D-CATS業務連携.lnk", "The shortcut file name changed");
  assert(writtenContents && Buffer.from(writtenContents).equals(Buffer.from(testShortcutBytes)), "The binary Windows shortcut was not written intact");
  assert(elements["dcats-business-workspace-shortcut"].disabled === false, "The shortcut button remained disabled");
  assert(elements["dcats-business-workspace-message"].textContent.includes("作成しました"), "Successful creation is not confirmed");
  console.log("Business workspace shortcut verification passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
