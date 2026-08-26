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
expect(install.includes("window.localStorage"), "Install completion must persist on the device");
expect(install.includes("window.sessionStorage"), "Install prompting must be limited to once per login session");
expect(install.includes("function publishInstallVerification(method)"), "Verified browser installation and shortcut launch must be queued for logging");
expect(install.includes("window.DCATS_INSTALL_EVENT_QUEUE"), "Install verification events must survive until authentication is ready");
expect(install.includes("function maybeOpenLoginPrompt()"), "Eligible users must receive a post-login install prompt");
expect(install.includes('window.addEventListener("dcats:install-access"'), "Install access must follow the authenticated role event");
expect(install.includes("!installAllowed || isStandalone()"), "Install entries must remain hidden without approved access");
expect(install.includes("if (!installAllowed)"), "Install button must reject unauthorized interaction");
expect(app.includes("function canUseInstallApp()"), "App must define the install audience");
expect(app.includes("!!userProfile && !isExternalViewer() && canViewProductSearch()"), "Install access must require an internal sales-management user");
expect(app.includes("function syncInstallAppAccess()"), "App must synchronize install access after authentication changes");
expect(app.includes('new CustomEvent("dcats:install-access"'), "App must publish the install access event");
expect(app.includes("detail: { allowed: allowed }"), "Install access must use the sales-management audience check");
expect(app.includes("function flushInstallVerificationEvents()"), "App must persist verified shortcut events after authentication");
expect(app.includes('action: standaloneLaunch ? "pwa_launch_verified" : "pwa_install_confirmed"'), "App must distinguish shortcut launches from browser install completion");
expect(app.includes('target_type: "pwa_shortcut"'), "Verified install logs must use a specific audit target");

function verifyInstallRoleGate() {
  const listeners = {};
  const entries = [{ hidden: true }, { hidden: true }, { hidden: true }, { hidden: true }];
  const buttons = [{ addEventListener() {} }, { addEventListener() {} }, { addEventListener() {} }, { addEventListener() {} }];
  const dialog = { hidden: true, querySelectorAll() { return []; } };
  const introGuide = { hidden: true };
  const iosGuide = { hidden: true };
  const manualGuide = { hidden: true };
  const guideActions = { hidden: true };
  const startButton = { listeners: {}, addEventListener(type, handler) { this.listeners[type] = handler; }, focus() {} };
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
      if (id === "app-install-manual-guide") return manualGuide;
      if (id === "app-install-guide-actions") return guideActions;
      if (id === "btn-install-dialog-start") return startButton;
      if (id === "app-install-ios-safari-note") return { hidden: true };
      if (id === "btn-install-dialog-close") return { focus() {} };
      return null;
    },
    addEventListener() {}
  };
  const window = {
    matchMedia: media,
    navigator: { userAgent: "D-CATS test", platform: "Win32", maxTouchPoints: 0, standalone: false },
    localStorage,
    sessionStorage,
    addEventListener(type, handler) { listeners[type] = handler; }
  };

  vm.runInNewContext(install, { window, document, console, Array });
  expect(entries.every((entry) => entry.hidden), "Install entries must be hidden before authentication");
  listeners["dcats:install-access"]({ detail: { allowed: false } });
  expect(entries.every((entry) => entry.hidden), "Install entries must be hidden for unauthorized users");
  listeners["dcats:install-access"]({ detail: { allowed: true } });
  expect(entries.every((entry) => !entry.hidden), "Install entries must be visible for authorized sales-management users on eligible devices");
  expect(dialog.hidden === false && introGuide.hidden === false, "Install explanation must open after eligible login");
  expect(sessionStorage.getItem("dcats_install_prompted_dcats-icon-v4-verified") === "1", "Install prompt must be recorded for the current login session");
  listeners["dcats:install-access"]({ detail: { allowed: false } });
  expect(entries.every((entry) => entry.hidden), "Install entries must be hidden immediately after access is revoked");
  expect(dialog.hidden, "Install explanation must close on logout");
  expect(sessionStorage.getItem("dcats_install_prompted_dcats-icon-v4-verified") === null, "Logout must allow the prompt on the next login");
  listeners["dcats:install-access"]({ detail: { allowed: true } });
  expect(dialog.hidden === false, "Install explanation must return on the next login when incomplete");
  listeners.appinstalled();
  expect(dialog.hidden, "Browser-confirmed installation must close the install explanation");
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
  "app_install_ios_step_share",
  "app_install_manual_step_install",
]) {
  const matches = app.match(new RegExp(`${key}:`, "g")) || [];
  expect(matches.length === 3, `${key} must be translated in Japanese, English, and Chinese`);
}

expect(styles.includes(".app-install-entry[hidden]"), "Hidden install controls must remain hidden");
expect(styles.includes(".app-install-header-entry[hidden]"), "Hidden header install controls must remain hidden");
expect(styles.includes(".app-install-dialog-card"), "Install dialog styling is missing");
expect(styles.includes(".app-install-verification-note"), "Verified shortcut-launch guidance styling is missing");
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
