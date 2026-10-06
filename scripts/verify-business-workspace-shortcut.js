const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { createHash } = require("crypto");
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
  "dcats-business-workspace-b2-warning",
  "dcats-business-workspace-b2-permission-hint",
  "dcats-business-workspace-message",
  "dcats-business-workspace-cancel"
]) {
  assert(html.includes(`id="${id}"`), `Business workspace UI is missing: ${id}`);
}

const driveUrl = "https://drive.google.com/drive/folders/1JLtJIHpZS5SdDAusy4yc0RijxN0YwoSQ";
assert(html.includes(`href="${driveUrl}"`), "The shared Google Drive folder link is missing");
assert(source.includes(`var DCATS_BUSINESS_WORKSPACE_URL = "${driveUrl}"`), "The shortcut target does not match the shared folder");
const assetPath = "assets/integrations/dcats-business-workspace.lnk";
const target = "G:\\.shortcut-targets-by-id\\1JLtJIHpZS5SdDAusy4yc0RijxN0YwoSQ\\D-CATS業務連携";
assert(source.includes(`var DCATS_BUSINESS_WORKSPACE_SHORTCUT_URL = "${assetPath}"`), "The download must use the verified folder-link asset");
assert(source.includes('var DCATS_BUSINESS_WORKSPACE_SHORTCUT_FILENAME = "D-CATS\\u696d\\u52d9\\u9023\\u643a.lnk"'), "The folder shortcut needs a stable Japanese file name");
assert(html.includes("フォルダのショートカットを取得"), "The UI must describe download rather than claiming desktop placement");
assert(html.includes("PC上のGoogle Drive（G:）") && html.includes(`title="${target}"`), "The PC-specific target must be explicit");
assert(html.includes("Google Drive（Web）"), "The web-folder action must be distinct from the PC-folder shortcut");
const binary = fs.readFileSync(path.join(root, assetPath));
assert(createHash("sha256").update(binary).digest("hex") === "8d5f4312b2ac441aea976b06c66d3615f8fb22a1a8a43bc1da37b49487327764", "The Windows-verified shortcut bytes changed; regenerate and read back on the approved PC");
assert(binary.readUInt32LE(0) === 76 && binary.subarray(4, 20).toString("hex") === "0114020000000000c000000000000046", "The asset must be a Windows Shell Link");
assert(binary.readUInt32LE(20) === 0x740195 && binary.readUInt32LE(24) === 0x10 && binary.readUInt32LE(60) === 1, "The link must target a folder with tracking disabled, no arguments or elevation");
let offset = 78 + binary.readUInt16LE(76);
function unicodeString() {
  const length = binary.readUInt16LE(offset);
  offset += 2;
  const value = binary.subarray(offset, offset + length * 2).toString("utf16le");
  offset += length * 2;
  return value;
}
assert(unicodeString() === "D-CATS business-exchange shared folder (Google Drive G:)", "The description is unexpected");
assert(unicodeString() === target, "The working directory must be the approved folder");
assert(offset + 4 === binary.length && binary.readUInt32LE(offset) === 0, "Machine IDs, tracker blocks and other ExtraData must not be distributed");
const headers = fs.readFileSync(path.join(root, "_headers"), "utf8");
const attachmentHeaders = headers.split(`/` + assetPath)[1]?.split(/\r?\n\r?\n/)[0] || "";
assert(attachmentHeaders.includes("Content-Type: application/octet-stream") && attachmentHeaders.includes("filename*=UTF-8''D-CATS%E6%A5%AD%E5%8B%99%E9%80%A3%E6%90%BA.lnk") && attachmentHeaders.includes("Cache-Control: no-cache"), "The folder asset must download with an explicit UTF-8 filename and no stale cache");
const shortcutSource = sourceBetween("function downloadDcatsBusinessWorkspaceShortcut", "function updateSalesOrderSelectionButtons");
assert(!shortcutSource.includes("showSaveFilePicker") && !shortcutSource.includes("showDirectoryPicker"), "Shortcut writes must not use the browser's restricted file API");
assert(!shortcutSource.includes("fetch(") && !shortcutSource.includes("createWritable") && !shortcutSource.includes("createObjectURL"), "Shortcut creation must use a direct attachment download, without file writes or blob URLs");
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
  "dcats-business-workspace-b2-state": { textContent: "", className: "" },
  "dcats-business-workspace-b2-directory": { textContent: "" },
  "dcats-business-workspace-b2-permission-hint": { textContent: "" },
  "dcats-business-workspace-b2-select": { textContent: "", disabled: false },
  "dcats-business-workspace-overlay": {
    classList: { add: (value) => visibleClasses.add(value), remove: (value) => visibleClasses.delete(value) }
  }
};
const timers = [];
const anchors = [];
let downloads = 0;
let failClick = false;
let failAppend = false;
const context = {
  APP_VERSION: "v-test",
  fetch: () => { throw new Error("Shortcut creation must not make network requests"); },
  t: (key) => ({
    business_workspace_downloaded: "Download started",
    business_workspace_failed: "Download failed"
  })[key] || key,
  document: {
    activeElement: null,
    body: { appendChild: () => { if (failAppend) throw new Error("DOM unavailable"); } },
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
  context.createDcatsBusinessWorkspaceShortcut();
  assert(downloads === 1, "One click must request one download");
  assert(anchors[0].download === "D-CATS業務連携.lnk", "The folder shortcut filename changed");
  assert(anchors[0].href === assetPath + "?v=v-test", "The attachment must be same-origin and versioned");
  assert(elements["dcats-business-workspace-message"].textContent === "Download started", "The UI must confirm initiation, not unverified desktop placement");
  context.createDcatsBusinessWorkspaceShortcut();
  assert(downloads === 1, "Rapid repeat clicks must not create duplicate downloads");
  flushTimers();
  assert(anchors[0].removed, "The download anchor must be cleaned up");
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
  assert(anchors[2].removed, "Failed downloads must clean up their anchor");
  assert(!elements["dcats-business-workspace-shortcut"].disabled, "Failed downloads must allow an explicit retry");
  failClick = false;
  failAppend = true;
  context.createDcatsBusinessWorkspaceShortcut();
  assert(downloads === 2, "DOM failure must not trigger a download");
  assert(anchors[3].removed, "DOM failures must also clean up the temporary anchor");
  assert(elements["dcats-business-workspace-message"].textContent === "Download failed", "DOM failure must be reported");
  flushTimers();
  failAppend = false;
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

  // A remembered picker location is not proof of a stored handle or write permission.
  context.window.indexedDB = {};
  context.window.showDirectoryPicker = () => { throw new Error("Displaying the save-folder state must not open a picker"); };
  context.storeDcatsB2ExportDirectory = () => { throw new Error("Displaying the state must not replace the stored handle"); };
  let reads = 0;
  let failRead = true;
  let permission = "granted";
  const storedHandle = {
    name: "01_D-CATS発行",
    queryPermission: async (options) => {
      assert(options.mode === "readwrite", "State display must check write permission");
      return permission;
    },
    requestPermission: () => { throw new Error("State display must not prompt for permission"); }
  };
  context.dcatsB2ExportDirectoryLoaded = false;
  context.readStoredDcatsB2ExportDirectory = async () => {
    reads += 1;
    if (failRead) throw new Error("Synthetic storage read failure");
    return storedHandle;
  };
  context.openDcatsBusinessWorkspace({ currentTarget: trigger });
  await new Promise(resolve => setImmediate(resolve));
  assert(elements["dcats-business-workspace-b2-state"].textContent === "business_workspace_b2_read_failed", "Read failure must be distinct from a missing registration");
  assert(!context.dcatsB2ExportDirectoryLoaded, "Read failure must not cache an empty setting");
  context.closeDcatsBusinessWorkspace();
  failRead = false;
  context.openDcatsBusinessWorkspace({ currentTarget: trigger });
  await new Promise(resolve => setImmediate(resolve));
  assert(reads === 2 && context.dcatsB2ExportDirectoryHandle === storedHandle, "Reopening after failure must recover the original stored handle");
  assert(elements["dcats-business-workspace-b2-state"].textContent === "business_workspace_b2_ready", "A granted stored handle must render as allowed");
  assert(elements["dcats-business-workspace-b2-directory"].textContent.endsWith("01_D-CATS発行"), "The registered folder name must remain visible");
  assert(elements["dcats-business-workspace-b2-select"].textContent === "business_workspace_b2_change", "Allowed folders must only offer optional reselection");
  permission = "prompt";
  await context.refreshDcatsB2ExportDirectoryState();
  assert(elements["dcats-business-workspace-b2-state"].textContent === "business_workspace_b2_permission", "Existing registration with lost permission must remain distinct from missing registration");
  assert(elements["dcats-business-workspace-b2-directory"].textContent.endsWith("01_D-CATS発行"), "Permission loss must not hide the registered folder");
  context.dcatsB2ExportDirectoryLoaded = false;
  context.readStoredDcatsB2ExportDirectory = async () => null;
  await context.refreshDcatsB2ExportDirectoryState();
  assert(elements["dcats-business-workspace-b2-state"].textContent === "business_workspace_b2_unset", "No stored handle must require explicit confirmation");
  assert(elements["dcats-business-workspace-b2-directory"].textContent === "", "No registration must not invent an actual registered path");
  assert(!elements["dcats-business-workspace-b2-select"].disabled, "A missing registration must allow explicit confirmation");
  context.closeDcatsBusinessWorkspace();
  console.log("Business workspace verification passed (shortcut binary/headers/download/cleanup/focus, CSV folder guards, stored handle display, permission loss, missing registration, read-failure recovery without picker or writes).");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
