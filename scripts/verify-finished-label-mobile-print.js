const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const styles = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const launcher = fs.readFileSync(path.join(root, "scripts", "start-td4420tn-print-station.ps1"), "utf8");
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

assert(app.includes('var APP_VERSION       = "v1.1.668";'), "app version is not v1.1.668");
assert(html.includes('content="v1.1.668"'), "HTML version is not v1.1.668");
assert(html.includes('data-finished-label-mode="station"'), "Windows print-station mode is missing");
[
  "finished-label-mobile-print-rule",
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
  "finished_label_mobile_print_queue_saved"
].forEach((key) => {
  assert((app.match(new RegExp(`${key}:`, "g")) || []).length === 3, `${key} is not translated in all three languages`);
});

const mobileDetection = functionSource("isFinishedLabelMobilePrintClient");
assert(mobileDetection.includes("userAgentData.mobile") && mobileDetection.includes("Android|iPhone|iPad"), "mobile print detection is incomplete");
const enqueue = functionSource("enqueueFinishedLabelPrintJob");
assert(enqueue.includes('sb.rpc("enqueue_finished_label_print_job"'), "mobile jobs do not use the secure queue RPC");
assert(enqueue.includes("target_request_key: finishedLabelPrintRequestKey()"), "mobile queue idempotency key is missing");
const save = functionSource("saveFinishedLabelIssue");
assert(save.includes("if (!remotePrint)") && save.includes('enqueueFinishedLabelPrintJob(record, "finished_product", "initial", null)'), "finished-label registration does not branch to the mobile queue");
assert(save.indexOf("if (!remotePrint)") < save.indexOf('window.open("", "_blank")'), "mobile registration can still open a print popup");
const preview = functionSource("previewCurrentFinishedLabel");
assert(preview.includes('enqueueFinishedLabelPrintJob(finishedLabelLastIssuedRecord, "finished_product", "initial", null)'), "failed mobile submission cannot be retried without issuing a new serial");
const reprint = functionSource("executeFinishedLabelHistoryReprint");
assert(reprint.includes('enqueueFinishedLabelPrintJob(record, labelType === "box" ? "box" : "finished_product", "reprint", reason)'), "mobile reprints are not queued with their reason");
const box = functionSource("executeFinishedBoxLabelIssue");
assert(box.includes('enqueueFinishedLabelPrintJob(record, "box", eventType, reason)'), "box-label mobile printing is not queued");
assert(functionSource("confirmFinishedLabelReprint").includes("if (!finishedLabelUsesRemotePrintQueue())"), "mobile reprints can still be blocked by popup rules");

const station = functionSource("processNextFinishedLabelPrintJob");
assert(station.includes('sb.rpc("claim_finished_label_print_job"'), "print station does not claim jobs atomically");
assert(station.includes('sb.rpc("finish_finished_label_print_job"'), "print station does not report completion");
assert(functionSource("printFinishedLabelStationFrame").includes('addEventListener("afterprint"'), "print jobs are completed before the OS print flow returns");
assert(functionSource("retryFinishedLabelPrintStationJob").includes('sb.rpc("retry_finished_label_print_job"'), "failed station jobs cannot be retried");
assert(functionSource("loadFinishedLabelPrintStationHistory").includes('sb.rpc("list_finished_label_print_jobs"'), "print-station history is not loaded through an RPC");

assert(styles.includes(".finished-label-print-station") && styles.includes(".finished-label-station-job"), "print-station layout is missing");
assert(styles.includes("grid-template-columns: repeat(3, minmax(0, 1fr))"), "three print-mode cards are not laid out consistently");
assert(launcher.includes("--kiosk-printing") && launcher.includes("TD-4420TN-PrintStation"), "Windows launcher does not use a dedicated kiosk-printing profile");
assert(guide.includes("45 × 20 mm") && guide.includes("80 × 60 mm") && guide.includes("既定のプリンター"), "print-station setup guide is incomplete");

console.log("Finished-label mobile print queue checks passed.");
