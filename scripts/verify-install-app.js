const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const install = fs.readFileSync(path.join(root, "install-app.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const headers = fs.readFileSync(path.join(root, "_headers"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "site.webmanifest"), "utf8"));

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

function pngDimensions(file) {
  const data = fs.readFileSync(path.join(root, file));
  expect(data.length >= 24 && data.subarray(1, 4).toString("ascii") === "PNG", `${file} must be a PNG`);
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

expect(html.includes('id="btn-install-app"'), "Login install button is missing");
expect(html.includes('id="app-install-dialog"'), "Install guidance dialog is missing");
expect(html.includes('id="app-install-intro-guide"'), "Post-login install explanation is missing");
expect(html.includes('id="btn-install-dialog-start"'), "Post-login install action is missing");
expect(html.includes('class="app-install-verification-note"'), "Verified shortcut-launch guidance is missing");
expect(html.includes('id="btn-install-ios-coachmark"'), "iPhone Share-button navigation action is missing");
expect(html.includes('id="app-install-share-coachmark"'), "iPhone Share-button coachmark is missing");
expect(html.includes('class="app-install-toolbar-demo app-install-toolbar-compact"'), "iPhone compact Safari toolbar preview is missing");
expect(html.includes('class="app-install-toolbar-target app-install-more-glyph"'), "iPhone More-button target is missing");
expect(html.includes('id="app-install-ios-browser-guide"'), "Non-Safari iPhone guidance is missing");
expect(html.includes('id="btn-install-copy-url"'), "Non-Safari URL-copy action is missing");
expect(html.includes('data-i18n="app_install_ios_missing_note"'), "Safari Edit Actions fallback is missing");
expect(html.includes('data-i18n="app_install_direct_share_note"'), "Direct Share-button Safari fallback is missing");
expect(!html.includes('id="btn-install-dialog-confirmed"'), "Manual self-confirmation must not be treated as verified installation");
const appVersionMatch = app.match(/var\s+APP_VERSION\s*=\s*"v([^"]+)"/);
expect(appVersionMatch, "D-CATS app version is missing");
expect(html.includes(`src="install-app.js?v=${appVersionMatch[1]}"`), "Install runtime is missing or unversioned");
expect(html.includes('name="apple-mobile-web-app-capable" content="yes"'), "iOS standalone metadata is missing");
expect(html.includes('href="assets/icons/apple-touch-icon-v4.png"'), "Versioned Apple touch icon is missing");
expect((html.match(/data-install-entry/g) || []).length === 4, "Install action slots must exist on login, internal home, customer home, and sales management");
expect((html.match(/data-i18n="app_install_short_action"/g) || []).length === 3, "Authenticated header install actions must have a readable compact label");
expect(install.includes("var installAllowed = false;"), "Install access must default to denied");
expect(install.includes('var INSTALL_CAMPAIGN_ID = "dcats-icon-v4-verified";'), "Install prompting must be tied to the verified icon campaign");
expect(install.includes('var INSTALL_GUIDE_REVISION = "safari-v2";'), "The corrected compact Safari guidance must prompt incomplete users again");
expect(install.includes("window.localStorage"), "Install completion must persist on the device");
expect(install.includes("window.sessionStorage"), "Install prompting must be limited to once per login session");
expect(install.includes("function publishInstallVerification(method)"), "Verified browser installation and shortcut launch must be queued for logging");
expect(install.includes("window.DCATS_INSTALL_EVENT_QUEUE"), "Install verification events must survive until authentication is ready");
expect(install.includes("function maybeOpenLoginPrompt()"), "Eligible users must receive a post-login install prompt");
expect(install.includes("function openShareCoachmark()"), "iPhone guidance must open a Share-button coachmark");
expect(install.includes("function maybeRestoreShareCoachmark()"), "iPhone guidance must survive a page reload during manual installation");
expect(install.includes('window.addEventListener("dcats:install-access"'), "Install access must follow the authenticated-user event");
expect(install.includes("!installAllowed || isStandalone()"), "Install entries must remain hidden without approved access");
expect(install.includes("if (!installAllowed)"), "Install button must reject unauthorized interaction");
expect(app.includes("function canUseInstallApp()"), "App must define the install audience");
expect(app.includes("return !!currentUser && !!userProfile;"), "Install access must include every authenticated D-CATS user");
expect(app.includes("function syncInstallAppAccess()"), "App must synchronize install access after authentication changes");
expect(app.includes('new CustomEvent("dcats:install-access"'), "App must publish the install access event");
expect(app.includes("detail: { allowed: allowed }"), "Install access must use the authenticated-user audience check");
expect(app.includes("function flushInstallVerificationEvents()"), "App must persist verified shortcut events after authentication");
expect(app.includes('action: standaloneLaunch ? "pwa_launch_verified" : "pwa_install_confirmed"'), "App must distinguish shortcut launches from browser install completion");
expect(app.includes('target_type: "pwa_shortcut"'), "Verified install logs must use a specific audit target");

function verifyInstallAudience() {
  const start = app.indexOf("function canUseInstallApp()");
  const end = app.indexOf("function flushInstallVerificationEvents()", start);
  expect(start >= 0 && end > start, "Install audience function could not be isolated");
  const source = app.slice(start, end);
  const roles = ["system_admin", "sales_editor", "production_editor", "all_viewer", "customer_viewer", "external_viewer"];
  roles.forEach((role) => {
    const sandbox = { currentUser: { id: `user-${role}` }, userProfile: { role }, allowed: false };
    vm.runInNewContext(`${source}\nallowed = canUseInstallApp();`, sandbox);
    expect(sandbox.allowed === true, `Install access must include authenticated ${role} users`);
  });
  for (const unauthenticated of [
    { currentUser: null, userProfile: null },
    { currentUser: { id: "missing-profile" }, userProfile: null },
    { currentUser: null, userProfile: { role: "system_admin" } }
  ]) {
    const sandbox = { ...unauthenticated, allowed: true };
    vm.runInNewContext(`${source}\nallowed = canUseInstallApp();`, sandbox);
    expect(sandbox.allowed === false, "Install access must remain hidden until authentication and profile loading finish");
  }
}

verifyInstallAudience();

function verifyInstallRoleGate() {
  const listeners = {};
  const entries = [{ hidden: true }, { hidden: true }, { hidden: true }, { hidden: true }];
  const buttons = [{ addEventListener() {} }, { addEventListener() {} }, { addEventListener() {} }, { addEventListener() {} }];
  const dialog = { hidden: true, querySelectorAll() { return []; } };
  const introGuide = { hidden: true };
  const iosGuide = { hidden: true };
  const iosBrowserGuide = { hidden: true };
  const manualGuide = { hidden: true };
  const guideActions = { hidden: true };
  const startButton = { listeners: {}, addEventListener(type, handler) { this.listeners[type] = handler; }, focus() {} };
  const coachmarkButton = { hidden: true, listeners: {}, addEventListener(type, handler) { this.listeners[type] = handler; }, focus() {} };
  const coachmarkCloseButton = { listeners: {}, addEventListener(type, handler) { this.listeners[type] = handler; }, focus() {} };
  const shareCoachmark = {
    hidden: true,
    querySelectorAll(selector) { return selector === "[data-install-coachmark-close]" ? [coachmarkCloseButton] : []; },
    querySelector(selector) { return selector === "[data-install-coachmark-close]" ? coachmarkCloseButton : null; }
  };
  const installUrlInput = { value: "https://dcats.daiko-denki.co.jp/", selected: false, focus() {}, select() { this.selected = true; } };
  const copyUrlButton = { listeners: {}, addEventListener(type, handler) { this.listeners[type] = handler; } };
  const copyDone = { hidden: true };
  const copyFailed = { hidden: true };
  const storage = () => {
    const values = new Map();
    return {
      getItem(key) { return values.has(key) ? values.get(key) : null; },
      setItem(key, value) { values.set(key, String(value)); },
      removeItem(key) { values.delete(key); }
    };
  };
  const localStorage = storage();
  const sessionStorage = storage();
  let standalone = false;
  const media = (query) => ({
    matches: query === "(max-width: 900px)" || (standalone && query === "(display-mode: standalone)"),
    addEventListener() {}
  });
  const document = {
    activeElement: null,
    body: { classList: { add() {}, remove() {} } },
    querySelectorAll(selector) { return selector === "[data-install-entry]" ? entries : buttons; },
    getElementById(id) {
      if (id === "app-install-dialog") return dialog;
      if (id === "app-install-intro-guide") return introGuide;
      if (id === "app-install-ios-guide") return iosGuide;
      if (id === "app-install-ios-browser-guide") return iosBrowserGuide;
      if (id === "app-install-manual-guide") return manualGuide;
      if (id === "app-install-guide-actions") return guideActions;
      if (id === "btn-install-dialog-start") return startButton;
      if (id === "btn-install-ios-coachmark") return coachmarkButton;
      if (id === "app-install-share-coachmark") return shareCoachmark;
      if (id === "app-install-url") return installUrlInput;
      if (id === "btn-install-copy-url") return copyUrlButton;
      if (id === "app-install-copy-done") return copyDone;
      if (id === "app-install-copy-failed") return copyFailed;
      if (id === "btn-install-dialog-close") return { focus() {} };
      return null;
    },
    addEventListener() {},
    execCommand(command) { return command === "copy"; }
  };
  const navigator = { userAgent: "Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Mobile/15E148 GSA/382.0 Safari/604.1", platform: "iPhone", maxTouchPoints: 5, standalone: false };
  const window = {
    matchMedia: media,
    navigator,
    location: { origin: "https://dcats.daiko-denki.co.jp" },
    localStorage,
    sessionStorage,
    addEventListener(type, handler) { listeners[type] = handler; }
  };

  vm.runInNewContext(install, { window, document, console, Array });
  expect(entries.every((entry) => entry.hidden), "Install entries must be hidden before authentication");
  listeners["dcats:install-access"]({ detail: { allowed: false } });
  expect(entries.every((entry) => entry.hidden), "Install entries must be hidden before authenticated-user access is granted");
  listeners["dcats:install-access"]({ detail: { allowed: true } });
  expect(entries.every((entry) => !entry.hidden), "Install entries must be visible for every authenticated user on eligible devices");
  expect(dialog.hidden === false && introGuide.hidden === false, "Install explanation must open after eligible login");
  expect(sessionStorage.getItem("dcats_install_prompted_dcats-icon-v4-verified_safari-v2") === "1", "Install prompt must be recorded for the corrected guide revision");
  listeners["dcats:install-access"]({ detail: { allowed: false } });
  expect(entries.every((entry) => entry.hidden), "Install entries must be hidden immediately after access is revoked");
  expect(dialog.hidden, "Install explanation must close on logout");
  expect(sessionStorage.getItem("dcats_install_prompted_dcats-icon-v4-verified_safari-v2") === null, "Logout must allow the prompt on the next login");
  listeners["dcats:install-access"]({ detail: { allowed: true } });
  expect(dialog.hidden === false, "Install explanation must return on the next login when incomplete");
  startButton.listeners.click();
  expect(iosBrowserGuide.hidden === false && iosGuide.hidden && coachmarkButton.hidden, "Google app and embedded iPhone browsers must route to Safari transfer guidance");
  copyUrlButton.listeners.click();
  expect(installUrlInput.value === "https://dcats.daiko-denki.co.jp/" && installUrlInput.selected, "Safari transfer guidance must provide a copyable D-CATS URL");
  expect(copyDone.hidden === false && copyFailed.hidden, "Successful URL copy must show the next Safari instruction");
  listeners["dcats:install-access"]({ detail: { allowed: false } });
  navigator.userAgent = "Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Version/18.0 Mobile Safari/604.1";
  listeners["dcats:install-access"]({ detail: { allowed: true } });
  startButton.listeners.click();
  expect(iosGuide.hidden === false && coachmarkButton.hidden === false, "iPhone install flow must reveal the visual Share-button navigation action");
  coachmarkButton.listeners.click();
  expect(dialog.hidden && shareCoachmark.hidden === false, "Share-button navigation must replace the dialog with a bottom-screen coachmark");
  expect(sessionStorage.getItem("dcats_install_coachmark_dcats-icon-v4-verified_safari-v2") === "1", "More-menu navigation must survive a page reload while installation is in progress");
  listeners.appinstalled();
  expect(dialog.hidden && shareCoachmark.hidden, "Browser-confirmed installation must close install guidance");
  expect(localStorage.getItem("dcats_install_complete_dcats-icon-v4-verified") === "1", "Browser-confirmed installation must persist for the verified icon campaign");
  expect(window.DCATS_INSTALL_EVENT_QUEUE.length === 1, "Browser-confirmed installation must be queued for authenticated audit logging");
  expect(window.DCATS_INSTALL_EVENT_QUEUE[0].method === "browser_appinstalled", "Install audit queue must record the browser confirmation method");
  listeners["dcats:install-access"]({ detail: { allowed: false } });
  listeners["dcats:install-access"]({ detail: { allowed: true } });
  expect(dialog.hidden, "Completed installations must not prompt again");
  standalone = true;
  listeners["dcats:install-access"]({ detail: { allowed: false } });
  listeners["dcats:install-access"]({ detail: { allowed: true } });
  expect(entries.every((entry) => entry.hidden), "Install entries must remain hidden when launched from a shortcut");
  expect(window.DCATS_INSTALL_EVENT_QUEUE.some((event) => event.method === "standalone_launch"), "Shortcut launch must be queued for authenticated audit logging");
}

verifyInstallRoleGate();

function verifyInstallAuditLogging() {
  const start = app.indexOf("function flushInstallVerificationEvents()");
  const end = app.indexOf("function syncInstallAppAccess()", start);
  expect(start >= 0 && end > start, "Install audit logging function could not be isolated");
  const calls = [];
  const sandbox = {
    currentUser: { id: "test-user" },
    canUseInstallApp() { return true; },
    installVerificationLoggedIds: {},
    installVerificationPendingIds: {},
    window: {
      DCATS_INSTALL_EVENT_QUEUE: [
        { id: "install-1", method: "browser_appinstalled", campaign_id: "dcats-icon-v4-verified", display_mode: "browser", detected_at: "2026-08-26T00:00:00.000Z" },
        { id: "launch-1", method: "standalone_launch", campaign_id: "dcats-icon-v4-verified", display_mode: "standalone", detected_at: "2026-08-26T00:01:00.000Z" }
      ]
    },
    logUserActivity(eventType, options) {
      calls.push({ eventType, options });
      return { then(handler) { handler({ error: null }); } };
    },
    Array,
    String
  };
  vm.runInNewContext(app.slice(start, end) + "\nflushInstallVerificationEvents();", sandbox);
  expect(calls.length === 2, "Both browser installation and shortcut launch must be audit logged");
  expect(calls.every((call) => call.eventType === "screen_open" && call.options.target_type === "pwa_shortcut"), "Install verification must use the approved activity event contract");
  expect(calls.some((call) => call.options.action === "pwa_install_confirmed"), "Browser installation completion audit is missing");
  expect(calls.some((call) => call.options.action === "pwa_launch_verified"), "Shortcut launch verification audit is missing");
  expect(sandbox.window.DCATS_INSTALL_EVENT_QUEUE.length === 0, "Successfully logged install events must leave the retry queue");
}

verifyInstallAuditLogging();

for (const fragment of [
  'window.addEventListener("beforeinstallprompt"',
  "event.preventDefault()",
  "await promptEvent.prompt()",
  "await promptEvent.userChoice",
  'window.addEventListener("appinstalled"',
  'window.matchMedia("(display-mode: standalone)")',
  "window.navigator.standalone === true",
  "function isIos()",
  "function isAndroid()",
  "function isNarrowViewport()",
  "function isIosSafari()",
  '"ios-browser"',
  "function copyInstallUrl()",
  "var INSTALL_COACHMARK_KEY",
  "function openShareCoachmark()",
  "function maybeRestoreShareCoachmark()",
  'publishInstallVerification("standalone_launch")',
  'markInstallConfirmed("browser_appinstalled")',
]) {
  expect(install.includes(fragment), `Install runtime contract is missing: ${fragment}`);
}

for (const key of [
  "app_install_action",
  "app_install_short_action",
  "app_install_note",
  "app_install_title",
  "app_install_intro",
  "app_install_repeat_note",
  "app_install_primary",
  "app_install_later",
  "app_install_verification_title",
  "app_install_verification_note",
  "app_install_close_guide",
  "app_install_ios_safari_required",
  "app_install_browser_required_title",
  "app_install_browser_required_note",
  "app_install_browser_step_copy",
  "app_install_browser_step_safari",
  "app_install_browser_step_add",
  "app_install_url_label",
  "app_install_copy_url",
  "app_install_copy_done",
  "app_install_copy_failed",
  "app_install_ios_step_share",
  "app_install_ios_step_add_home",
  "app_install_ios_step_confirm",
  "app_install_ios_missing_title",
  "app_install_ios_missing_note",
  "app_install_direct_share_note",
  "app_install_manual_step_install",
  "app_install_toolbar_hint",
  "app_install_nav_start",
  "app_install_nav_step",
  "app_install_nav_title",
  "app_install_nav_next",
  "app_install_nav_close",
]) {
  const matches = app.match(new RegExp(`${key}:`, "g")) || [];
  expect(matches.length === 3, `${key} must be translated in Japanese, English, and Chinese`);
}

expect(styles.includes(".app-install-entry[hidden]"), "Hidden install controls must remain hidden");
expect(styles.includes(".app-install-header-entry[hidden]"), "Hidden header install controls must remain hidden");
expect(styles.includes(".app-install-dialog-card"), "Install dialog styling is missing");
expect(styles.includes(".app-install-verification-note"), "Verified shortcut-launch guidance styling is missing");
expect(styles.includes(".app-install-toolbar-demo"), "iPhone browser toolbar preview styling is missing");
expect(styles.includes(".app-install-toolbar-address"), "iPhone compact Safari address-bar styling is missing");
expect(styles.includes(".app-install-more-glyph"), "iPhone More-button styling is missing");
expect(styles.includes(".app-install-browser-warning"), "Non-Safari warning styling is missing");
expect(styles.includes(".app-install-copy-row"), "Non-Safari URL-copy styling is missing");
expect(styles.includes(".app-install-missing-action-note"), "Safari Edit Actions fallback styling is missing");
expect(styles.includes(".app-install-share-coachmark"), "iPhone Share-button coachmark styling is missing");
expect(styles.includes(".app-install-coachmark-pointer"), "iPhone Share-button pointer styling is missing");
expect(styles.includes("right: 7%;"), "iPhone coachmark pointer must target the bottom-right More button");
expect(styles.includes(".app-install-header-button span { display: inline;"), "Mobile install action must not collapse to an unexplained icon");
expect(styles.includes("body.app-install-dialog-open"), "Install dialog scroll lock is missing");
expect(/\/site\.webmanifest\r?\n\s+Cache-Control: no-cache/.test(headers), "Manifest must be revalidated after releases");
expect(/\/apple-touch-icon\.png\r?\n\s+Cache-Control: no-cache/.test(headers), "Root Apple touch icon must be revalidated");
expect(/\/assets\/icons\/\*-v4\.png\r?\n\s+Cache-Control: public, max-age=31536000, immutable/.test(headers), "Versioned install icons must be immutable");

expect(manifest.id === "/", "Manifest must define a stable D-CATS app id");
expect(manifest.start_url === "/" && manifest.scope === "/", "Manifest launch URL and scope must use the site root");
expect(manifest.display === "standalone", "Manifest must launch as a standalone app");

const iconContracts = [
  ["assets/icons/icon-192-v4.png", 192, "any"],
  ["assets/icons/icon-512-v4.png", 512, "any"],
  ["assets/icons/icon-maskable-512-v4.png", 512, "maskable"],
];
for (const [source, size, purpose] of iconContracts) {
  const icon = (manifest.icons || []).find((candidate) => candidate.src === source);
  expect(icon, `Manifest icon is missing: ${source}`);
  expect(icon.sizes === `${size}x${size}` && icon.type === "image/png" && icon.purpose === purpose, `Manifest icon metadata is invalid: ${source}`);
  const dimensions = pngDimensions(source);
  expect(dimensions.width === size && dimensions.height === size, `Manifest icon dimensions are invalid: ${source}`);
}

for (const source of ["apple-touch-icon.png", "assets/icons/apple-touch-icon-v4.png"]) {
  const dimensions = pngDimensions(source);
  expect(dimensions.width === 180 && dimensions.height === 180, `${source} must be 180x180`);
}

console.log("D-CATS install experience contract: OK");
