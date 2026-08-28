const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const headers = fs.readFileSync(path.join(root, "_headers"), "utf8");

function expectFragment(source, fragment, message) {
  if (!source.includes(fragment)) throw new Error(message);
}

function functionSource(name) {
  const patterns = [`async function ${name}(`, `function ${name}(`];
  const start = patterns.map((pattern) => app.indexOf(pattern)).find((index) => index >= 0);
  if (start === undefined) throw new Error(`Missing function ${name}`);
  const bodyStart = app.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < app.length; index += 1) {
    if (app[index] === "{") depth += 1;
    if (app[index] === "}") depth -= 1;
    if (depth === 0) return app.slice(start, index + 1);
  }
  throw new Error(`Unclosed function ${name}`);
}

expectFragment(
  app,
  'new URL("index.html", document.baseURI || window.location.href)',
  "Update checks must request the index document directly"
);
expectFragment(app, 'cache: "no-store"', "Update checks must bypass the browser cache");
expectFragment(app, '"Cache-Control": "no-cache, no-store, max-age=0"', "Update checks must send an explicit no-cache request header");
expectFragment(app, 'window.addEventListener("focus"', "Window focus must trigger an update check");
expectFragment(app, 'window.addEventListener("pageshow"', "Back-forward cache restoration must trigger an update check");
expectFragment(app, 'window.addEventListener("online"', "Network recovery must trigger an update check");
expectFragment(app, 'window.location.assign(retryUrl.toString())', "A stalled refresh must retry navigation");
expectFragment(app, 'clearTimeout(appUpdateNavigationRetryTimer)', "Successful navigation must cancel the retry timer");

for (const route of ["/", "/index.html"]) {
  const escaped = route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const routeBlock = new RegExp(`^${escaped}\\r?\\n(?:[ \\t]+[^\\r\\n]+\\r?\\n)*[ \\t]+Cache-Control:\\s*no-cache, no-store, must-revalidate`, "m");
  if (!routeBlock.test(headers)) throw new Error(`${route} must disable HTML caching`);
}

async function verifyNetworkCheck() {
  let fetchedUrl = "";
  let fetchedOptions = null;
  let scheduledVersion = "";
  const sandbox = {
    APP_VERSION: "v1.1.800",
    appUpdateDetected: false,
    appUpdateCheckInProgress: false,
    location: { protocol: "https:" },
    window: { location: { href: "https://dcats.example.test/?screen=production" } },
    document: { baseURI: "https://dcats.example.test/?screen=production" },
    URL,
    console,
    fetch: async (url, options) => {
      fetchedUrl = url;
      fetchedOptions = options;
      return { ok: true, text: async () => '<meta name="dcats-app-version" content="v1.1.801">' };
    },
    DOMParser: class {
      parseFromString() {
        return { querySelector: () => ({ getAttribute: () => "v1.1.801" }) };
      }
    },
    scheduleAppUpdateReload: (version) => { scheduledVersion = version; }
  };
  vm.runInNewContext(`${functionSource("appVersionNumber")}; ${functionSource("checkForAppUpdate")}; runCheck = checkForAppUpdate;`, sandbox);
  await sandbox.runCheck();

  const requestUrl = new URL(fetchedUrl);
  if (requestUrl.pathname !== "/index.html" || !requestUrl.searchParams.has("_dcats_version_check")) {
    throw new Error("Update checks must use a cache-busted index.html request");
  }
  if (!fetchedOptions || fetchedOptions.cache !== "no-store" || fetchedOptions.credentials !== "same-origin") {
    throw new Error("Update checks must request a fresh same-origin response");
  }
  if (!sandbox.appUpdateDetected || scheduledVersion !== "v1.1.801" || sandbox.appUpdateCheckInProgress) {
    throw new Error("A newer version must schedule one reload and release the in-flight lock");
  }
}

verifyNetworkCheck()
  .then(() => console.log("Edge automatic update contract: OK"))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
