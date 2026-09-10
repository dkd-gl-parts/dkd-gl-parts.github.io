const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const headers = fs.readFileSync(path.join(root, "_headers"), "utf8");
const packagePath = path.join(root, "assets", "downloads", "D-CATS-TD4420TN-Setup.zip");
const hashPath = path.join(root, "assets", "downloads", "D-CATS-TD4420TN-Setup.sha256.txt");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert((html.match(/assets\/downloads\/D-CATS-TD4420TN-Setup\.zip/g) || []).length === 3, "setup package is not linked from the hub, terminal screen, and setup guide");
assert(html.includes('href="dcats-label-printer://setup"'), "installed setup tool cannot be reopened from D-CATS");
assert(html.includes('href="dcats-label-printer://status"'), "installed print-station status cannot be opened");
for (const target of ["finished_product", "box"]) {
  assert(html.includes(`href="dcats-label-printer://calibrate/${target}"`), `${target} calibration action is missing`);
  assert(html.includes(`href="dcats-label-printer://test/${target}"`), `${target} test-print action is missing`);
  assert(html.includes(`data-finished-label-device-state="${target}"`), `${target} cloud readiness state is missing`);
}
assert(html.includes("finished-label-station-compatibility") && html.includes("<details"), "legacy browser-driver printing is not separated as compatibility mode");
assert((html.match(/data-label-printer-setup-guide-open/g) || []).length === 2, "setup and reconfiguration buttons do not open the guided flow");
assert(html.includes('role="tablist"') && html.includes('data-label-printer-setup-view="first"') && html.includes('data-label-printer-setup-view="installed"'), "setup guide does not separate first-time and installed-PC paths");
for (const step of ["download", "extract", "run", "configure"]) {
  assert(html.includes(`finished_label_setup_guide_${step}_title`), `setup guide is missing the ${step} step`);
}
assert(app.includes('finished_label_station_mode_desc: "スマホから送信された印刷待ちをTD-4420TNへ直接出力"'), "Japanese station description still claims browser-driver output");
for (const phrase of ["TD-4420TN設定ナビ", "TD-4420TN Setup Guide", "TD-4420TN设置导航"]) {
  assert(app.includes(phrase), `setup guide language is missing: ${phrase}`);
}
assert(app.includes("openFinishedLabelSetupGuide") && app.includes("closeFinishedLabelSetupGuide") && app.includes("setFinishedLabelSetupGuideView"), "setup guide interactions are incomplete");
assert(app.includes('FINISHED_LABEL_SETUP_STATUS_URL = "http://127.0.0.1:37643/status"'), "setup guide does not probe the local Windows print station");
assert(app.includes('targetAddressSpace: "loopback"'), "setup probe does not declare its loopback destination to Chromium");
assert(headers.includes("connect-src 'self' http://127.0.0.1:37643") && headers.includes("loopback-network=(self)"), "deployment policy does not permit the scoped loopback setup probe");
assert(app.includes("probeFinishedLabelSetup") && app.includes("selectFinishedLabelSetupGuideFromDetection"), "automatic setup-state detection is incomplete");
for (const state of ["configured", "attention", "unavailable", "pc_only"]) {
  assert(app.includes(`finished_label_setup_detection_${state}_title`), `setup detection is missing the ${state} state`);
}
assert(html.includes('id="btn-finished-label-setup-detection-retry"') && html.includes("data-label-printer-setup-state-badge"), "setup detection status or retry control is missing");
assert(app.includes('sessionStorage.setItem("dcats_label_printer_setup_downloaded", "1")'), "setup package download progress is not retained for the current session");
assert(app.includes('sb.rpc("list_finished_label_print_stations", { target_label_target: null })'), "station overview does not load both media destinations");
assert(app.includes("renderFinishedLabelAgentOverview") && app.includes("finished-label-device-profile-state"), "station readiness is not rendered by media profile");
assert(app.includes("prepareFinishedLabelCompatibilityStation") && app.includes("loadFinishedLabelPrintDestinations(labelTarget, true)"), "compatibility receiver can start without a resolved printer code");
assert(styles.includes(".finished-label-setup-strip") && styles.includes(".finished-label-device-profile-list") && styles.includes(".finished-label-setup-guide-steps"), "first-PC setup layout or guide is missing");
assert(styles.includes(".finished-label-setup-detection.configured") && styles.includes(".finished-label-setup-detection.attention") && styles.includes(".finished-label-setup-detection.unavailable"), "setup detection states are not visually distinct");
assert(/\.finished-label-mode-card\s*\{[^}]*border-radius:\s*8px/s.test(styles), "mode cards exceed the 8px radius rule");
assert(fs.existsSync(packagePath) && fs.statSync(packagePath).size > 10000, "first-PC setup package is missing or empty");
assert(fs.existsSync(hashPath) && /^[A-F0-9]{64}\s+D-CATS-TD4420TN-Setup\.zip\s*$/i.test(fs.readFileSync(hashPath, "utf8")), "setup package checksum is missing or invalid");
const listedHash = fs.readFileSync(hashPath, "utf8").trim().split(/\s+/)[0].toUpperCase();
const packageHash = crypto.createHash("sha256").update(fs.readFileSync(packagePath)).digest("hex").toUpperCase();
assert(listedHash === packageHash, "setup package checksum does not match the downloadable ZIP");

console.log("Label-printer onboarding verification passed.");
