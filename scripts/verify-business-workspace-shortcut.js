const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const workflow = fs.readFileSync(path.join(root, ".github", "workflows", "search-performance-guard.yml"), "utf8");

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
  "dcats-business-workspace-message",
  "dcats-business-workspace-cancel"
]) {
  assert(html.includes(`id="${id}"`), `Business workspace UI is missing: ${id}`);
}

const driveUrl = "https://drive.google.com/drive/folders/1JLtJIHpZS5SdDAusy4yc0RijxN0YwoSQ";
assert(html.includes(`href="${driveUrl}"`), "The shared Google Drive folder link is missing");
assert(source.includes(`var DCATS_BUSINESS_WORKSPACE_URL = "${driveUrl}"`), "The shortcut target does not match the shared folder");
assert(source.includes('"[InternetShortcut]\\r\\nURL=" + DCATS_BUSINESS_WORKSPACE_URL'), "The Windows .url shortcut payload is missing");
assert(source.includes('startIn: "desktop"'), "The save picker must start on the Windows desktop");
assert(source.includes('suggestedName: "D-CATS業務連携.url"'), "The shortcut needs a stable Japanese file name");
assert(source.includes('typeof window.showSaveFilePicker === "function"'), "Chromium desktop save support is missing");
assert(source.includes("downloadDcatsBusinessWorkspaceShortcut(contents)"), "Unsupported browsers need a download fallback");
assert(source.includes('pickerError.name === "AbortError"'), "Cancelling the picker must not be reported as an error");

for (const fragment of [
  ".sales-order-business-workspace-button",
  ".form-card.dcats-business-workspace-card",
  ".dcats-business-workspace-actions",
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
let writtenContents = "";
const context = {
  Blob,
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
          write: async (value) => { writtenContents = String(value); },
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
  assert(pickerOptions.suggestedName === "D-CATS業務連携.url", "The shortcut file name changed");
  assert(writtenContents.includes(`[InternetShortcut]\r\nURL=${driveUrl}\r\n`), "The generated shortcut points somewhere else");
  assert(elements["dcats-business-workspace-shortcut"].disabled === false, "The shortcut button remained disabled");
  assert(elements["dcats-business-workspace-message"].textContent.includes("作成しました"), "Successful creation is not confirmed");
  console.log("Business workspace shortcut verification passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
