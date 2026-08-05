const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const styles = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const launcher = fs.readFileSync(path.join(root, "scripts", "start-td4420tn-print-station.ps1"), "utf8");
const installer = fs.readFileSync(path.join(root, "scripts", "install-td4420tn-print-station.ps1"), "utf8");
const guide = fs.readFileSync(path.join(root, "docs", "TD-4420TN-mobile-print-station.md"), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function functionSource(name) {
  const marker = `function ${name}(`;
  const start = app.indexOf(marker);
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

assert(app.includes('var APP_VERSION       = "v1.1.670";'), "app version is not v1.1.670");
assert(html.includes('content="v1.1.670"'), "HTML version is not v1.1.670");
assert(html.includes('data-finished-label-mode="station"'), "Windows print-station mode is missing");
[
  "finished-label-mobile-print-rule",
  "finished-label-mobile-print-status",
  "finished-label-print-station",
  "finished-label-station-target",
  "finished-label-station-printer-code",
  "btn-finished-label-station-start",
  "btn-finished-label-station-stop",
  "finished-label-station-frame",
  "finished-label-station-history"
].forEach((id) => assert(html.includes(`id="${id}"`), `${id} is missing`));

[
  "finished_label_station_mode_name",
  "finished_label_station_start",
  "finished_label_station_retry",
  "finished_label_mobile_rule_title",
  "finished_label_mobile_issue_save",
  "finished_label_mobile_queue_retry",
  "finished_label_mobile_print_queue_saved",
  "finished_label_mobile_printed",
  "finished_label_mobile_status_retrying",
  "finished_label_mobile_timeout",
  "finished_label_mobile_station_error"
].forEach((key) => {
  assert((app.match(new RegExp(`${key}:`, "g")) || []).length === 3, `${key} is not translated in all three languages`);
});

const mobileDetection = functionSource("isFinishedLabelMobilePrintClient");
assert(mobileDetection.includes("userAgentData.mobile") && mobileDetection.includes("Android|iPhone|iPad"), "mobile print detection is incomplete");
const enqueue = functionSource("enqueueFinishedLabelPrintJob");
assert(enqueue.includes('sb.rpc("enqueue_finished_label_print_job"'), "mobile jobs do not use the secure queue RPC");
assert(enqueue.includes("target_request_key: finishedLabelPrintRequestKey()"), "mobile queue idempotency key is missing");
const waitForPrint = functionSource("waitForFinishedLabelPrintJob");
assert(functionSource("getFinishedLabelPrintJobStatus").includes('sb.rpc("get_finished_label_print_job_status"'), "mobile cannot track its exact print job");
assert(waitForPrint.includes('status === "sent"') && waitForPrint.includes('status === "error"'), "mobile does not wait for terminal print status");
assert(waitForPrint.includes("FINISHED_LABEL_MOBILE_PRINT_TIMEOUT_MS"), "mobile print completion has no bounded timeout");
assert(waitForPrint.includes("finished_label_mobile_status_retrying") && waitForPrint.includes("continue;"), "transient status failures are not retried");
const enqueueAndWait = functionSource("enqueueAndWaitForFinishedLabelPrint");
assert(enqueueAndWait.includes('"queued", "claimed", "timeout"') && enqueueAndWait.includes("resumable ? existing"), "a timed-out mobile job can be duplicated instead of resumed");
const save = functionSource("saveFinishedLabelIssue");
assert(save.includes("if (!remotePrint)") && save.includes('enqueueAndWaitForFinishedLabelPrint(record, "finished_product", "initial", null)'), "finished-label registration does not wait for mobile print completion");
assert(save.indexOf("if (!remotePrint)") < save.indexOf('window.open("", "_blank")'), "mobile registration can still open a print popup");
const preview = functionSource("previewCurrentFinishedLabel");
assert(preview.includes('enqueueAndWaitForFinishedLabelPrint(finishedLabelLastIssuedRecord, "finished_product", "initial", null)'), "failed mobile printing cannot be retried without issuing a new serial");
const reprint = functionSource("executeFinishedLabelHistoryReprint");
assert(reprint.includes('enqueueAndWaitForFinishedLabelPrint(record, labelType === "box" ? "box" : "finished_product", "reprint", reason)'), "mobile reprints are not tracked through completion with their reason");
const box = functionSource("executeFinishedBoxLabelIssue");
assert(box.includes('enqueueAndWaitForFinishedLabelPrint(record, "box", eventType, reason)'), "box-label mobile printing is not tracked through completion");
assert(functionSource("confirmFinishedLabelReprint").includes("if (!finishedLabelUsesRemotePrintQueue())"), "mobile reprints can still be blocked by popup rules");

const station = functionSource("processNextFinishedLabelPrintJob");
assert(station.includes('sb.rpc("claim_finished_label_print_job"'), "print station does not claim jobs atomically");
assert(station.includes('sb.rpc("finish_finished_label_print_job"'), "print station does not report completion");
assert(functionSource("printFinishedLabelStationFrame").includes('addEventListener("afterprint"'), "print jobs are completed before the OS print flow returns");
assert(functionSource("retryFinishedLabelPrintStationJob").includes('sb.rpc("retry_finished_label_print_job"'), "failed station jobs cannot be retried");
assert(functionSource("loadFinishedLabelPrintStationHistory").includes('sb.rpc("list_finished_label_print_jobs"'), "print-station history is not loaded through an RPC");
assert(functionSource("requestedFinishedLabelPrintStationTarget").includes("dcats_print_station") && functionSource("openRequestedFinishedLabelPrintStation").includes("startFinishedLabelPrintStation()"), "dedicated Windows station does not auto-start receiving");
assert(functionSource("openRequestedPrintStationAfterAuth").includes("automaticFinishedLabelPrintStationTarget") && functionSource("openRequestedPrintStationAfterAuth").includes("openRequestedFinishedLabelPrintStation"), "saved print station is not resumed after authentication or refresh");
assert(functionSource("startFinishedLabelPrintStation").includes("saveFinishedLabelPrintStationPreference(true)"), "starting the receiver does not persist its active state");
assert(functionSource("stopFinishedLabelPrintStation").includes("saveFinishedLabelPrintStationPreference(false)"), "stopping the receiver does not clear its active state");
assert(station.includes("scheduleFinishedLabelPrintStation(claimedJob ? 0 : FINISHED_LABEL_PRINT_STATION_POLL_MS)"), "queued labels are not drained automatically without another button press");
assert(functionSource("isFinishedLabelDedicatedPrintStationActive").includes('finishedLabelPrintMode === "station"') && functionSource("resetAutoLogoutTimer").includes("isFinishedLabelDedicatedPrintStationActive()"), "the dedicated station will be logged out after eight unattended hours");

assert(styles.includes(".finished-label-print-station") && styles.includes(".finished-label-station-job"), "print-station layout is missing");
assert(styles.includes("grid-template-columns: repeat(3, minmax(0, 1fr))"), "three print-mode cards are not laid out consistently");
assert(styles.includes(".finished-label-mobile-print-rule.success") && styles.includes(".finished-label-mobile-print-rule.error"), "mobile print result states are not styled");
assert(launcher.includes("--kiosk-printing") && launcher.includes("TD-4420TN-PrintStation"), "Windows launcher does not use a dedicated kiosk-printing profile");
assert(launcher.includes("dcats_print_station=td4420tn") && launcher.includes("label_target=$LabelTarget"), "Windows launcher does not request automatic station startup");
assert(launcher.includes("[switch]$Watch") && launcher.includes("Get-CimInstance Win32_Process") && launcher.includes("while ($true)") && launcher.includes("DcatsTD4420TNPrintStationWatchdog"), "Windows launcher cannot recover safely after Edge closes");
assert(installer.includes('[Environment]::GetFolderPath("Startup")') && installer.includes("[switch]$PreventSleep") && installer.includes("Copy-Item"), "Windows automatic-start installer is incomplete");
assert(installer.includes("TD[- ]?4420TN") && installer.includes("WorkOffline") && installer.includes("LegacyDefaultPrinterMode"), "Windows printer validation is incomplete");
assert(installer.includes("[string]$PrinterName") && installer.includes("SetDefaultPrinter") && installer.includes("Multiple TD-4420TN printers were found"), "Windows default-printer setup is incomplete");
assert(guide.includes("45 × 20 mm") && guide.includes("80×60mm") && guide.includes("既定のプリンター") && guide.includes("スマホだけで完結") && guide.includes("8時間無操作ログアウト") && guide.includes("更新やブラウザー再起動後も受信中へ自動復帰"), "print-station setup guide is incomplete");

function verifyRuntimeStationPreference() {
  const storage = new Map();
  const target = { value: "finished_product" };
  const sandbox = {
    FINISHED_LABEL_PRINT_STATION_STORAGE_KEY: "dcats_finished_label_print_station_v1",
    currentUser: { id: "station-user" },
    localStorage: {
      getItem(key) { return storage.has(key) ? storage.get(key) : null; },
      setItem(key, value) { storage.set(key, String(value)); },
      removeItem(key) { storage.delete(key); }
    },
    document: { getElementById(id) { return id === "finished-label-station-target" ? target : null; } },
    requestedFinishedLabelPrintStationTarget() { return ""; },
    JSON,
    String
  };
  vm.createContext(sandbox);
  vm.runInContext([
    functionSource("savedFinishedLabelPrintStationPreference"),
    functionSource("saveFinishedLabelPrintStationPreference"),
    functionSource("automaticFinishedLabelPrintStationTarget"),
    "this.savePreference = saveFinishedLabelPrintStationPreference;",
    "this.savedPreference = savedFinishedLabelPrintStationPreference;",
    "this.automaticTarget = automaticFinishedLabelPrintStationTarget;"
  ].join("\n"), sandbox);
  sandbox.savePreference(true);
  assert(sandbox.automaticTarget() === "finished_product", "an active receiver is not restored after refresh");
  target.value = "box";
  sandbox.savePreference(true);
  assert(sandbox.savedPreference().label_target === "box", "the selected label roll is not persisted");
  sandbox.currentUser = { id: "another-user" };
  assert(sandbox.automaticTarget() === "", "a receiver preference can leak to another signed-in user");
  sandbox.currentUser = { id: "station-user" };
  sandbox.savePreference(false);
  assert(sandbox.automaticTarget() === "", "an explicitly stopped receiver restarts unexpectedly");
}

verifyRuntimeStationPreference();

async function verifyRuntimeStatusTracking() {
  const observedResponses = [
    { data: null, error: new Error("temporary network failure") },
    { data: { job_id: 701, status: "queued" }, error: null },
    { data: { job_id: 701, status: "claimed" }, error: null },
    { data: { job_id: 701, status: "sent", sent_at: "2026-08-04T07:20:00Z" }, error: null }
  ];
  const rpcCalls = [];
  const statusMessages = [];
  const sandbox = {
    sb: {
      async rpc(name, args) {
        rpcCalls.push({ name, args });
        return observedResponses.shift();
      }
    },
    window: { setTimeout(callback) { callback(); return 1; } },
    finishedLabelLastQueuedJob: null,
    FINISHED_LABEL_MOBILE_PRINT_TIMEOUT_MS: 120000,
    FINISHED_LABEL_MOBILE_PRINT_POLL_MS: 1,
    renderFinishedLabelMobilePrintRule() {},
    setFinishedLabelMobilePrintStatus(state, message) { statusMessages.push({ state, message }); },
    t(key) { return key; },
    tf(key, vars) { return `${key}:${vars.message || ""}`; },
    console,
    Date,
    Error,
    Object,
    Number,
    String,
    Promise
  };
  vm.createContext(sandbox);
  vm.runInContext([
    functionSource("finishedLabelPrintDelay"),
    functionSource("finishedLabelPrintStatusError"),
    `async ${functionSource("getFinishedLabelPrintJobStatus")}`,
    `async ${functionSource("waitForFinishedLabelPrintJob")}`,
    "this.runFinishedLabelWait = waitForFinishedLabelPrintJob;"
  ].join("\n"), sandbox);
  const result = await sandbox.runFinishedLabelWait({ job_id: 701, issue_id: 91, label_target: "finished_product", status: "queued" });
  assert(result.status === "sent", "mobile status tracking does not resolve after the Windows station sends the job");
  assert(rpcCalls.length === 4 && rpcCalls.every((call) => call.name === "get_finished_label_print_job_status" && call.args.target_job_id === 701), "mobile status tracking does not retry and poll the exact job ID");
  assert(statusMessages.some((row) => row.message === "finished_label_mobile_status_retrying") && statusMessages.some((row) => row.state === "success"), "mobile status UI does not recover from a transient failure and reach success");
}

verifyRuntimeStatusTracking().then(() => {
  console.log("Finished-label smartphone-complete print checks passed.");
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
