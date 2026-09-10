const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const packagePath = path.join(root, "assets", "downloads", "D-CATS-TD4420TN-Setup.zip");
const hashPath = path.join(root, "assets", "downloads", "D-CATS-TD4420TN-Setup.sha256.txt");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert((html.match(/assets\/downloads\/D-CATS-TD4420TN-Setup\.zip/g) || []).length === 2, "setup package is not linked from the hub and terminal screen");
assert(html.includes('href="dcats-label-printer://setup"'), "installed setup tool cannot be reopened from D-CATS");
assert(html.includes('href="dcats-label-printer://status"'), "installed print-station status cannot be opened");
for (const target of ["finished_product", "box"]) {
  assert(html.includes(`href="dcats-label-printer://calibrate/${target}"`), `${target} calibration action is missing`);
  assert(html.includes(`href="dcats-label-printer://test/${target}"`), `${target} test-print action is missing`);
  assert(html.includes(`data-finished-label-device-state="${target}"`), `${target} cloud readiness state is missing`);
}
assert(html.includes("finished-label-station-compatibility") && html.includes("<details"), "legacy browser-driver printing is not separated as compatibility mode");
assert(app.includes('finished_label_station_mode_desc: "スマホから送信された印刷待ちをTD-4420TNへ直接出力"'), "Japanese station description still claims browser-driver output");
assert(app.includes('sb.rpc("list_finished_label_print_stations", { target_label_target: null })'), "station overview does not load both media destinations");
assert(app.includes("renderFinishedLabelAgentOverview") && app.includes("finished-label-device-profile-state"), "station readiness is not rendered by media profile");
assert(app.includes("prepareFinishedLabelCompatibilityStation") && app.includes("loadFinishedLabelPrintDestinations(labelTarget, true)"), "compatibility receiver can start without a resolved printer code");
assert(styles.includes(".finished-label-setup-strip") && styles.includes(".finished-label-device-profile-list"), "first-PC setup layout is missing");
assert(/\.finished-label-mode-card\s*\{[^}]*border-radius:\s*8px/s.test(styles), "mode cards exceed the 8px radius rule");
assert(fs.existsSync(packagePath) && fs.statSync(packagePath).size > 10000, "first-PC setup package is missing or empty");
assert(fs.existsSync(hashPath) && /^[A-F0-9]{64}\s+D-CATS-TD4420TN-Setup\.zip\s*$/i.test(fs.readFileSync(hashPath, "utf8")), "setup package checksum is missing or invalid");

console.log("Label-printer onboarding verification passed.");
