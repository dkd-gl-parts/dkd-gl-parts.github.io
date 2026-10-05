const fs = require("fs");
const path = require("path");
const vm = require("vm");
const YAML = require("yaml");

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
assert(!fs.existsSync(path.join(root, "assets", "integrations", "dcats-business-workspace.lnk")), "The machine-specific G-drive shortcut must not be distributed");
assert(source.includes('var DCATS_BUSINESS_WORKSPACE_SHORTCUT_FILENAME = "D-CATS\\u696d\\u52d9\\u9023\\u643a.url"'), "The portable shortcut needs a stable Japanese file name");
assert(html.includes("デスクトップ用ショートカットを取得"), "The UI must describe download rather than claiming desktop placement");
const shortcutSource = sourceBetween("function downloadDcatsBusinessWorkspaceShortcut", "function updateSalesOrderSelectionButtons");
assert(!shortcutSource.includes("showSaveFilePicker") && !shortcutSource.includes("showDirectoryPicker"), "Shortcut writes must not use the browser's restricted file API");
assert(!shortcutSource.includes("fetch(") && !shortcutSource.includes("createWritable"), "Shortcut creation must not fetch a machine-specific asset or write an unapproved path");
assert(shortcutSource.includes("link.download = DCATS_BUSINESS_WORKSPACE_SHORTCUT_FILENAME"), "The shortcut must use an explicit download filename");
assert(source.includes('var DCATS_B2_EXPORT_DIRECTORY_NAME = "01_D-CATS\\u767a\\u884c"'), "The B2 issue-folder name is not fixed");
assert(source.includes('id: "dcats-b2-csv-export"'), "The B2 folder picker does not have a stable browser identity");
assert(source.includes('mode: "readwrite"'), "The B2 folder picker must request write access");
assert(source.includes('selectedHandle.name === DCATS_BUSINESS_WORKSPACE_DIRECTORY_NAME'), "Selecting the D-CATS workspace root is not supported");
assert(source.includes('selectedHandle.name === DCATS_B2_DIRECTORY_NAME'), "Selecting the B2 parent folder is not supported");
assert(source.includes('selectedHandle.name === DCATS_B2_EXPORT_DIRECTORY_NAME'), "Selecting the B2 issue folder is not supported");
assert(source.includes('storeDcatsB2ExportDirectory(targetHandle)'), "The B2 folder handle is not persisted per browser profile");
assert(source.includes('var DCATS_HANBAIOU_DIRECTORY_NAME = "\\u8ca9\\u58f2\\u738b"'), "The Sales King workspace folder name is not fixed");
assert(source.includes('id: "dcats-hanbaiou-csv-export"'), "The Sales King folder picker does not have a stable browser identity");
assert(source.includes('storeDcatsHanbaiouExportDirectory(targetHandle)'), "The Sales King folder handle is not persisted per browser profile");
assert(html.includes('business_workspace_hanbaiou_path'), "The Sales King shared save path is not shown in the export screen");

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

const pullRequestTrigger = YAML.parse(workflow).on?.pull_request;
assert(pullRequestTrigger === null || (
  typeof pullRequestTrigger === "object" && !Array.isArray(pullRequestTrigger) &&
  Object.keys(pullRequestTrigger).length === 0
), "The shortcut verifier must run on all pull requests without path filters");
assert(workflow.includes("node scripts/verify-business-workspace-shortcut.js"), "The shortcut verifier is not executed by CI");

const featureSource = sourceBetween("var DCATS_BUSINESS_WORKSPACE_URL", "function updateSalesOrderSelectionButtons");
const visibleClasses = new Set();
let shortcutFocused = false;
let triggerFocused = false;
const elements = {
  "dcats-business-workspace-shortcut": { disabled: false, focus: () => { shortcutFocused = true; } },
  "dcats-business-workspace-message": { textContent: "", className: "" },
  "dcats-business-workspace-overlay": {
    classList: { add: (value) => visibleClasses.add(value), remove: (value) => visibleClasses.delete(value) }
  }
};
const timers = [];
const blobs = [];
const anchors = [];
const revoked = [];
let downloads = 0;
let failClick = false;
let failBlob = false;
const context = {
  Blob,
  fetch: () => { throw new Error("Shortcut creation must not make network requests"); },
  t: (key) => ({
    business_workspace_downloaded: "Download started",
    business_workspace_failed: "Download failed"
  })[key] || key,
  URL: {
    createObjectURL: (blob) => {
      if (failBlob) throw new Error("Blob unavailable");
      blobs.push(blob);
      return `blob:test-${blobs.length}`;
    },
    revokeObjectURL: (url) => revoked.push(url)
  },
  document: {
    activeElement: null,
    body: { appendChild: () => {} },
    createElement: (tag) => {
      assert(tag === "a", "Shortcut creation must use a download link");
      const anchor = {
        removed: false,
        click: () => {
          if (failClick) throw new Error("Download rejected");
          downloads += 1;
        },
        remove: () => { anchor.removed = true; }
      };
      anchors.push(anchor);
      return anchor;
    },
    getElementById: (id) => elements[id] || null
  },
  window: {
    setTimeout: (callback) => { timers.push(callback); },
    showSaveFilePicker: () => { throw new Error("Restricted file API must not run"); }
  }
};
vm.runInNewContext(featureSource, context);

function flushTimers() {
  while (timers.length) timers.shift()();
}

(async () => {
  const expected = `[InternetShortcut]\r\nURL=${driveUrl}\r\n`;
  assert(context.dcatsBusinessWorkspaceShortcutContents() === expected, "The shortcut must contain only the fixed shared-folder URL, with Windows line endings");
  context.createDcatsBusinessWorkspaceShortcut();
  assert(downloads === 1, "One click must request one download");
  assert(anchors[0].download === "D-CATS業務連携.url", "The portable shortcut filename changed");
  assert(await blobs[0].text() === expected, "The downloaded shortcut content differs from the fixed URL");
  assert(blobs[0].type === "text/plain;charset=utf-8", "The shortcut must be a plain-text InternetShortcut");
  assert(elements["dcats-business-workspace-message"].textContent === "Download started", "The UI must confirm initiation, not unverified desktop placement");
  context.createDcatsBusinessWorkspaceShortcut();
  assert(downloads === 1, "Rapid repeat clicks must not create duplicate downloads");
  flushTimers();
  assert(anchors[0].removed && revoked.includes(anchors[0].href), "Download anchors and object URLs must be cleaned up");
  assert(!elements["dcats-business-workspace-shortcut"].disabled, "The shortcut button must become available again");

  delete context.window.showSaveFilePicker;
  context.createDcatsBusinessWorkspaceShortcut();
  assert(downloads === 2, "Browsers without a file picker must support the same download");
  flushTimers();

  failClick = true;
  context.createDcatsBusinessWorkspaceShortcut();
  assert(elements["dcats-business-workspace-message"].className.endsWith(" error"), "A rejected download must have an error state");
  assert(elements["dcats-business-workspace-message"].textContent === "Download failed", "A rejected download must not report success");
  flushTimers();
  assert(anchors[2].removed && revoked.includes(anchors[2].href), "Failed downloads must clean up their anchor and blob URL");
  assert(!elements["dcats-business-workspace-shortcut"].disabled, "Failed downloads must allow an explicit retry");
  failClick = false;
  failBlob = true;
  context.createDcatsBusinessWorkspaceShortcut();
  assert(downloads === 2, "Blob failure must not trigger a download");
  assert(elements["dcats-business-workspace-message"].textContent === "Download failed", "Blob failure must be reported");
  flushTimers();
  failBlob = false;
  context.createDcatsBusinessWorkspaceShortcut();
  assert(downloads === 3, "An explicit retry after failure must work");
  assert(!elements["dcats-business-workspace-message"].className.endsWith(" error"), "A successful retry must clear the old error state");
  flushTimers();

  const trigger = { focus: () => { triggerFocused = true; } };
  context.openDcatsBusinessWorkspace({ currentTarget: trigger });
  assert(visibleClasses.has("show") && shortcutFocused, "The menu must open the workspace and focus the shortcut action");
  assert(elements["dcats-business-workspace-message"].textContent === "", "Reopening the dialog must clear stale messages");
  context.closeDcatsBusinessWorkspace();
  assert(!visibleClasses.has("show") && triggerFocused, "Closing the workspace must restore focus to the menu action");
  console.log("Business workspace shortcut verification passed (portable URL, download, repeat-click guard, cleanup, failures, retry, modal focus, CSV save-folder guards).");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
