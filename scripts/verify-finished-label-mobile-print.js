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

assert(app.includes('var APP_VERSION       = "v1.1.688";'), "app version is not v1.1.688");
assert(html.includes('content="v1.1.688"'), "HTML version is not v1.1.688");
assert(html.includes('data-finished-label-mode="station"'), "Windows print-station mode is missing");
assert(html.includes('id="dcats-auto-notice"') && html.includes('aria-live="polite"'), "auto-dismiss print notice is missing or inaccessible");
[
  "finished-label-mobile-print-rule",
  "finished-label-mobile-print-status",
  "finished-label-mobile-destination-options",
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
  "finished_label_mobile_station_error",
  "finished_label_print_destination",
  "finished_label_print_destination_ready",
  "finished_label_print_destination_stopped"
].forEach((key) => {
  assert((app.match(new RegExp(`${key}:`, "g")) || []).length === 3, `${key} is not translated in all three languages`);
});

const mobileDetection = functionSource("isFinishedLabelMobilePrintClient");
assert(mobileDetection.includes("userAgentData.mobile") && mobileDetection.includes("Android|iPhone|iPad"), "mobile print detection is incomplete");
const enqueue = functionSource("enqueueFinishedLabelPrintJob");
assert(enqueue.includes('sb.rpc("enqueue_finished_label_print_job"'), "mobile jobs do not use the secure queue RPC");
assert(enqueue.includes("target_request_key: finishedLabelPrintRequestKey()"), "mobile queue idempotency key is missing");
assert(enqueue.includes("loadFinishedLabelPrintDestinations") && enqueue.includes("target_printer_code: printerCode"), "mobile jobs are not routed through the selected destination");
assert(functionSource("loadFinishedLabelPrintDestinations").includes('sb.rpc("list_finished_label_print_stations"'), "mobile cannot load the printer master");
assert(functionSource("selectedFinishedLabelPrintDestination").includes("site_code === siteCode"), "mobile destination selection is not site-specific");
assert(functionSource("saveFinishedLabelPrintSiteCode").includes("currentUser.id"), "saved site selection is not isolated by signed-in user");
{
  const routingSandbox = {
    finishedLabelSelectedSiteCode: "PH",
    finishedLabelPrintDestinations: [
      { site_code: "JP", label_target: "finished_product", printer_code: "TD-4420TN-45X20", is_default: true },
      { site_code: "JP", label_target: "box", printer_code: "TD-4420TN-80X60", is_default: true },
      { site_code: "PH", label_target: "finished_product", printer_code: "PH-TD-4420TN-45X20" },
      { site_code: "PH", label_target: "box", printer_code: "PH-TD-4420TN-80X60" }
    ],
    savedFinishedLabelPrintSiteCode() { return ""; }
  };
  vm.createContext(routingSandbox);
  vm.runInContext(`${functionSource("selectedFinishedLabelPrintDestination")}\n${functionSource("finishedLabelPrinterCode")}\nthis.codeFor = finishedLabelPrinterCode;`, routingSandbox);
  assert(routingSandbox.codeFor("finished_product") === "PH-TD-4420TN-45X20", "Philippines finished labels are routed to the wrong printer");
  assert(routingSandbox.codeFor("box") === "PH-TD-4420TN-80X60", "Philippines box labels are routed to the wrong printer");
}
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
assert(save.includes('showDcatsAutoNotice(t("finished_label_mobile_queue_saved"))') && save.includes('alert(finishedLabelMobilePrintErrorText(queueError'), "registration success is not auto-dismissed or its error is no longer blocking");
const preview = functionSource("previewCurrentFinishedLabel");
assert(preview.includes('enqueueAndWaitForFinishedLabelPrint(finishedLabelLastIssuedRecord, "finished_product", "initial", null)'), "failed mobile printing cannot be retried without issuing a new serial");
assert(preview.includes('showDcatsAutoNotice(t("finished_label_mobile_print_queue_saved"))'), "registration retry success is not auto-dismissed");
const reprint = functionSource("executeFinishedLabelHistoryReprint");
assert(reprint.includes('enqueueAndWaitForFinishedLabelPrint(record, labelType === "box" ? "box" : "finished_product", "reprint", reason)'), "mobile reprints are not tracked through completion with their reason");
assert(reprint.includes('showDcatsAutoNotice(t("finished_label_mobile_print_queue_saved"))'), "reprint success is not auto-dismissed");
const box = functionSource("executeFinishedBoxLabelIssue");
assert(box.includes('enqueueAndWaitForFinishedLabelPrint(record, "box", eventType, reason)'), "box-label mobile printing is not tracked through completion");
assert(box.includes('showDcatsAutoNotice(t("finished_label_mobile_print_queue_saved"))'), "box-label success is not auto-dismissed");
assert(functionSource("retryFinishedBoxLabelQueue").includes('showDcatsAutoNotice(t("finished_label_mobile_print_queue_saved"))'), "box-label retry success is not auto-dismissed");
assert(functionSource("confirmFinishedLabelReprint").includes("if (!finishedLabelUsesRemotePrintQueue())"), "mobile reprints can still be blocked by popup rules");

const autoNotice = functionSource("showDcatsAutoNotice");
assert(autoNotice.includes("window.clearTimeout") && autoNotice.includes("window.setTimeout"), "repeated print notices do not reset their auto-dismiss timer");
assert(autoNotice.includes("notice.hidden = false") && autoNotice.includes("notice.hidden = true"), "print notice does not show and dismiss automatically");
assert(!app.includes('alert(t("finished_label_mobile_print_queue_saved"))'), "a blocking mobile print-success popup remains");
{
  const notice = { hidden: true, textContent: "" };
  const timers = new Map();
  let nextTimerId = 1;
  const noticeSandbox = {
    dcatsAutoNoticeTimer: null,
    document: { getElementById(id) { return id === "dcats-auto-notice" ? notice : null; } },
    window: {
      setTimeout(callback, delay) {
        const id = nextTimerId++;
        timers.set(id, { callback, delay });
        return id;
      },
      clearTimeout(id) { timers.delete(id); }
    },
    Math,
    Number,
    String
  };
  vm.createContext(noticeSandbox);
  vm.runInContext(`${autoNotice}\nthis.showNotice = showDcatsAutoNotice;`, noticeSandbox);
  noticeSandbox.showNotice("印刷しました");
  assert(notice.hidden === false && notice.textContent === "印刷しました", "print success notice does not become visible");
  assert(timers.size === 1 && [...timers.values()][0].delay === 2800, "print success notice has the wrong auto-dismiss delay");
  noticeSandbox.showNotice("再印刷しました", 2000);
  assert(timers.size === 1 && notice.textContent === "再印刷しました", "a repeated print notice does not replace the previous timer and message");
  [...timers.values()][0].callback();
  assert(notice.hidden === true && notice.textContent === "", "print success notice remains visible after its timer completes");
}

const station = functionSource("processNextFinishedLabelPrintJob");
assert(station.includes('sb.rpc("claim_finished_label_print_job"'), "print station does not claim jobs atomically");
assert(station.includes('sb.rpc("finish_finished_label_print_job"'), "print station does not report completion");
assert(functionSource("printFinishedLabelStationFrame").includes('addEventListener("afterprint"'), "print jobs are completed before the OS print flow returns");
assert(functionSource("retryFinishedLabelPrintStationJob").includes('sb.rpc("retry_finished_label_print_job"'), "failed station jobs cannot be retried");
assert(functionSource("loadFinishedLabelPrintStationHistory").includes('sb.rpc("list_finished_label_print_jobs"'), "print-station history is not loaded through an RPC");
assert(functionSource("requestedFinishedLabelPrintStationTarget").includes("dcats_print_station") && functionSource("openRequestedFinishedLabelPrintStation").includes("resumeFinishedLabelPrintStationIfEnabled()"), "dedicated Windows station does not auto-start receiving");
assert(functionSource("openRequestedPrintStationAfterAuth").includes("requestedFinishedLabelPrintStationTarget") && !functionSource("openRequestedPrintStationAfterAuth").includes("automaticFinishedLabelPrintStationTarget") && functionSource("openRequestedPrintStationAfterAuth").includes("openRequestedFinishedLabelPrintStation"), "a saved legacy print-station preference can override normal update restoration");
assert(functionSource("signOutCurrentDevice").includes('scope: "local"'), "D-CATS logout can revoke the Windows print-agent session");
assert(functionSource("signOutAllDevices").includes('scope: "global"'), "security-sensitive logout does not revoke every user session");
assert(!app.includes("sb.auth.signOut();"), "an implicit Supabase logout remains in the browser application");
assert(functionSource("doLogout").includes("signOutCurrentDevice()"), "manual or inactivity logout does not preserve the print-agent session");
assert(functionSource("loadProfile").includes("signOutAllDevices()"), "blocked-profile logout does not revoke other device sessions");
assert(functionSource("doResetPassword").includes("signOutAllDevices()"), "post-password-change logout does not revoke other device sessions");
{
  let explicitTarget = "";
  let openCalls = 0;
  const updateRestoreSandbox = {
    requestedFinishedLabelPrintStationTarget() { return explicitTarget; },
    openRequestedFinishedLabelPrintStation() { openCalls += 1; return Promise.resolve(); },
    console: { warn() {} },
    window: { setTimeout(callback) { callback(); } }
  };
  vm.createContext(updateRestoreSandbox);
  vm.runInContext(`${functionSource("openRequestedPrintStationAfterAuth")}\nthis.openAfterAuth = openRequestedPrintStationAfterAuth;`, updateRestoreSandbox);
  assert(updateRestoreSandbox.openAfterAuth() === false && openCalls === 0, "normal update restoration is still redirected to the legacy Windows print-station screen");
  explicitTarget = "finished_product";
  assert(updateRestoreSandbox.openAfterAuth() === true && openCalls === 1, "the explicit dedicated print-station URL no longer opens its requested screen");
}
assert(functionSource("startFinishedLabelPrintStation").includes("saveFinishedLabelPrintStationPreference(true)"), "starting the receiver does not persist its active state");
assert(functionSource("pauseFinishedLabelPrintStation").includes("finishedLabelPrintStationRunning = false") && !functionSource("pauseFinishedLabelPrintStation").includes("saveFinishedLabelPrintStationPreference(false)"), "leaving the station screen clears its saved active state");
assert(functionSource("stopFinishedLabelPrintStation").includes("pauseFinishedLabelPrintStation()") && functionSource("stopFinishedLabelPrintStation").includes("saveFinishedLabelPrintStationPreference(false)"), "the explicit Stop action does not clear its active state");
assert(functionSource("setFinishedLabelPrintMode").includes("pauseFinishedLabelPrintStation()") && !functionSource("setFinishedLabelPrintMode").includes("stopFinishedLabelPrintStation()"), "switching label screens disables automatic resume");
assert(functionSource("returnFromFinishedLabelMgmtToMenu").includes('setFinishedLabelPrintMode("")') && functionSource("returnFromFinishedLabelMgmtToMenu").includes("showAuthenticatedHome()"), "returning to the menu does not preserve the receiver preference");
assert(functionSource("resumeFinishedLabelPrintStationIfEnabled").includes("automaticFinishedLabelPrintStationTarget") && functionSource("resumeFinishedLabelPrintStationIfEnabled").includes("startFinishedLabelPrintStation()"), "reopening the station screen does not resume a saved receiver");
assert(station.includes("scheduleFinishedLabelPrintStation(claimedJob ? 0 : FINISHED_LABEL_PRINT_STATION_POLL_MS)"), "queued labels are not drained automatically without another button press");
assert(functionSource("isFinishedLabelDedicatedPrintStationActive").includes('finishedLabelPrintMode === "station"') && functionSource("resetAutoLogoutTimer").includes("isFinishedLabelDedicatedPrintStationActive()"), "the dedicated station will be logged out after eight unattended hours");

assert(styles.includes(".finished-label-print-station") && styles.includes(".finished-label-station-job"), "print-station layout is missing");
assert(styles.includes("grid-template-columns: repeat(3, minmax(0, 1fr))"), "three print-mode cards are not laid out consistently");
assert(styles.includes(".finished-label-mobile-print-rule.success") && styles.includes(".finished-label-mobile-print-rule.error"), "mobile print result states are not styled");
assert(styles.includes(".finished-label-mobile-destination-option.active") && styles.includes("@media (max-width: 600px)"), "mobile destination cards are not styled responsively");
assert(styles.includes(".dcats-auto-notice") && styles.includes(".dcats-auto-notice[hidden]") && styles.includes("env(safe-area-inset-bottom)"), "auto-dismiss notice is not styled safely for mobile screens");
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
  const startButton = { disabled: false };
  const stopButton = { disabled: true };
  const sandbox = {
    FINISHED_LABEL_PRINT_STATION_STORAGE_KEY: "dcats_finished_label_print_station_v1",
    currentUser: { id: "station-user" },
    finishedLabelPrintStationRunning: true,
    finishedLabelPrintStationBusy: false,
    receiverStartCalls: 0,
    localStorage: {
      getItem(key) { return storage.has(key) ? storage.get(key) : null; },
      setItem(key, value) { storage.set(key, String(value)); },
      removeItem(key) { storage.delete(key); }
    },
    document: {
      getElementById(id) {
        if (id === "finished-label-station-target") return target;
        if (id === "btn-finished-label-station-start") return startButton;
        if (id === "btn-finished-label-station-stop") return stopButton;
        return null;
      }
    },
    requestedFinishedLabelPrintStationTarget() { return ""; },
    canViewFinishedLabelMgmt() { return true; },
    updateFinishedLabelPrintStationTarget() {},
    startFinishedLabelPrintStation() { sandbox.receiverStartCalls += 1; },
    clearFinishedLabelPrintStationTimer() {},
    resetAutoLogoutTimer() {},
    setFinishedLabelPrintStationState() {},
    JSON,
    String
  };
  vm.createContext(sandbox);
  vm.runInContext([
    functionSource("savedFinishedLabelPrintStationPreference"),
    functionSource("saveFinishedLabelPrintStationPreference"),
    functionSource("automaticFinishedLabelPrintStationTarget"),
    functionSource("resumeFinishedLabelPrintStationIfEnabled"),
    functionSource("pauseFinishedLabelPrintStation"),
    functionSource("stopFinishedLabelPrintStation"),
    "this.savePreference = saveFinishedLabelPrintStationPreference;",
    "this.savedPreference = savedFinishedLabelPrintStationPreference;",
    "this.automaticTarget = automaticFinishedLabelPrintStationTarget;",
    "this.resumeReceiver = resumeFinishedLabelPrintStationIfEnabled;",
    "this.pauseReceiver = pauseFinishedLabelPrintStation;",
    "this.stopReceiver = stopFinishedLabelPrintStation;"
  ].join("\n"), sandbox);
  sandbox.savePreference(true);
  assert(sandbox.automaticTarget() === "finished_product", "an active receiver is not restored after refresh");
  assert(sandbox.resumeReceiver() === true && sandbox.receiverStartCalls === 1, "an active receiver is not restarted when the station screen reopens");
  sandbox.pauseReceiver();
  assert(sandbox.savedPreference() && sandbox.savedPreference().enabled === true, "leaving the station screen removes the saved receiver state");
  target.value = "box";
  sandbox.savePreference(true);
  assert(sandbox.savedPreference().label_target === "box", "the selected label roll is not persisted");
  sandbox.currentUser = { id: "another-user" };
  assert(sandbox.automaticTarget() === "", "a receiver preference can leak to another signed-in user");
  sandbox.currentUser = { id: "station-user" };
  sandbox.stopReceiver();
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
