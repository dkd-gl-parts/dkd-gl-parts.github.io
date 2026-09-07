const fs = require("fs");
const path = require("path");
const acorn = require("acorn");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const styles = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "site.webmanifest"), "utf8"));

function requiredMatch(source, pattern, label) {
  const match = source.match(pattern);
  if (!match) throw new Error(`${label} is missing`);
  return match[1];
}

const appVersion = requiredMatch(app, /var\s+APP_VERSION\s*=\s*"(v[^\"]+)"/, "APP_VERSION");
const metaVersion = requiredMatch(html, /name="dcats-app-version"\s+content="(v[^\"]+)"/, "version meta");
const legacyVersion = requiredMatch(html, /Legacy updater compatibility: var APP_VERSION = "(v[^\"]+)"/, "legacy updater version");
const scriptVersion = "v" + requiredMatch(html, /<script\s+src="app\.js\?v=([^\"]+)"/, "app.js cache version");
const installScriptVersion = "v" + requiredMatch(html, /<script\s+src="install-app\.js\?v=([^\"]+)"/, "install-app.js cache version");
const legacyI18nVersion = "v" + requiredMatch(html, /<script\s+src="legacy-i18n\.js\?v=([^\"]+)"/, "legacy-i18n.js cache version");
const conciergeScriptVersion = "v" + requiredMatch(html, /<script\s+src="assets\/concierge-pet\/concierge-pet\.js\?v=([^\"]+)"/, "concierge-pet.js cache version");
const styleVersion = "v" + requiredMatch(html, /<link\s+rel="stylesheet"\s+href="styles\.css\?v=([^&\"]+)/, "styles.css cache version");
const conciergeStyleVersion = "v" + requiredMatch(html, /<link\s+rel="stylesheet"\s+href="assets\/concierge-pet\/concierge-pet\.css\?v=([^\"]+)"/, "concierge-pet.css cache version");
const manifestVersion = "v" + requiredMatch(html, /<link\s+rel="manifest"\s+href="site\.webmanifest\?v=([^&\"]+)/, "manifest cache version");

const reviewedStaticScripts = new Map([
  ["https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.115.0/dist/umd/supabase.js", {
    integrity: "sha384-CLZeq1dk8+Uzrs7TVvBUdlFoV5F0DMqgRoeHa8g5wJcuPe5SkVfEvdxB0ZuzlnBQ",
    crossorigin: "anonymous",
  }],
  ["https://cdn.jsdelivr.net/npm/jsbarcode@3.12.3/dist/JsBarcode.all.min.js", {
    integrity: "sha384-vmcSy8TM1KhZWBIKMKTR8AxbrJQCuConAolGY+42odu9ZGIzw8L8xAT/u7ul4X2U",
    crossorigin: "anonymous",
  }],
]);
const reviewedDynamicScript = Object.freeze({
  src: "https://cdn.jsdelivr.net/npm/@zxing/browser@0.2.0/umd/zxing-browser.min.js",
  integrity: "sha384-HRtzk9lZgkbSgvUyQrnfC/GxiXZgwaNyD7hC9wcXlsBpDhkS80ISl73juef2FRuf",
});

function decodeHtmlAttribute(value, violations) {
  const decoded = value
    .replace(/&#(\d+);/g, (_, digits) => String.fromCodePoint(Number(digits)))
    .replace(/&#x([0-9a-f]+);/gi, (_, digits) => String.fromCodePoint(parseInt(digits, 16)))
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&colon;/gi, ":")
    .replace(/&sol;/gi, "/");
  if (/&(?:#(?:x[0-9a-f]+|\d+)|[a-z][a-z0-9]+);/i.test(decoded)) {
    violations.push(`script src contains an unsupported HTML entity: ${value}`);
  }
  return decoded;
}

function parseScriptAttributes(rawAttributes, violations) {
  const attributes = new Map();
  let cursor = 0;
  while (cursor < rawAttributes.length) {
    while (/\s/.test(rawAttributes[cursor] || "")) cursor += 1;
    if (cursor >= rawAttributes.length || rawAttributes[cursor] === "/") break;
    const nameMatch = rawAttributes.slice(cursor).match(/^[^\s"'<>\/=]+/);
    if (!nameMatch) {
      violations.push(`unable to parse script attribute near: ${rawAttributes.slice(cursor, cursor + 30)}`);
      break;
    }
    const name = nameMatch[0].toLowerCase();
    cursor += nameMatch[0].length;
    while (/\s/.test(rawAttributes[cursor] || "")) cursor += 1;
    let value = "";
    if (rawAttributes[cursor] === "=") {
      cursor += 1;
      while (/\s/.test(rawAttributes[cursor] || "")) cursor += 1;
      const quote = rawAttributes[cursor];
      if (quote === '"' || quote === "'") {
        cursor += 1;
        const end = rawAttributes.indexOf(quote, cursor);
        if (end < 0) {
          violations.push(`unterminated quoted script attribute: ${name}`);
          break;
        }
        value = rawAttributes.slice(cursor, end);
        cursor = end + 1;
      } else {
        const valueMatch = rawAttributes.slice(cursor).match(/^[^\s"'`=<>]+/);
        if (!valueMatch) {
          violations.push(`script attribute ${name} has an invalid unquoted value`);
          break;
        }
        value = valueMatch[0];
        cursor += value.length;
      }
    }
    if (attributes.has(name)) violations.push(`script tag repeats the ${name} attribute`);
    attributes.set(name, value);
  }
  return attributes;
}

function parseScriptTags(source, violations) {
  const tags = [];
  const opener = /<script\b/gi;
  let match;
  while ((match = opener.exec(source)) !== null) {
    let cursor = opener.lastIndex;
    let quote = null;
    while (cursor < source.length) {
      const char = source[cursor];
      if (quote) {
        if (char === quote) quote = null;
      } else if (char === '"' || char === "'") {
        quote = char;
      } else if (char === ">") {
        break;
      }
      cursor += 1;
    }
    if (cursor >= source.length) {
      violations.push("script tag is missing its closing angle bracket");
      break;
    }
    tags.push(parseScriptAttributes(source.slice(opener.lastIndex, cursor), violations));
    opener.lastIndex = cursor + 1;
  }
  return tags;
}

function isExternalScriptSource(source, violations) {
  const decoded = decodeHtmlAttribute(source, violations);
  try {
    const parsed = new URL(decoded, "https://dcats.invalid/");
    return parsed.protocol !== "https:" || parsed.origin !== "https://dcats.invalid";
  } catch {
    violations.push(`script src is not a valid URL: ${source}`);
    return true;
  }
}

function walkJavaScript(rootNode) {
  const nodes = [];
  const pending = [rootNode];
  while (pending.length) {
    const node = pending.pop();
    if (!node || typeof node !== "object") continue;
    if (typeof node.type === "string") nodes.push(node);
    for (const [key, value] of Object.entries(node)) {
      if (key === "start" || key === "end" || key === "loc") continue;
      if (Array.isArray(value)) pending.push(...value);
      else if (value && typeof value === "object") pending.push(value);
    }
  }
  return nodes;
}

function memberPropertyName(member, bindings) {
  if (!member || member.type !== "MemberExpression") return null;
  if (!member.computed && member.property.type === "Identifier") return member.property.name;
  return staticString(member.property, bindings);
}

function staticString(node, bindings, depth = 0) {
  if (!node || depth > 20) return null;
  if (node.type === "Literal" && typeof node.value === "string") return node.value;
  if (node.type === "TemplateLiteral") {
    let value = node.quasis[0].value.cooked;
    for (let index = 0; index < node.expressions.length; index += 1) {
      const expression = staticString(node.expressions[index], bindings, depth + 1);
      if (expression === null) return null;
      value += expression + node.quasis[index + 1].value.cooked;
    }
    return value;
  }
  if (node.type === "BinaryExpression" && node.operator === "+") {
    const left = staticString(node.left, bindings, depth + 1);
    const right = staticString(node.right, bindings, depth + 1);
    return left === null || right === null ? null : left + right;
  }
  if (node.type === "Identifier" && bindings.has(node.name)) {
    return staticString(bindings.get(node.name), bindings, depth + 1);
  }
  return null;
}

function validateScriptSupplyChain(htmlSource, appSource) {
  const violations = [];
  const externalTags = parseScriptTags(htmlSource, violations).filter((attributes) => {
    return attributes.has("src") && isExternalScriptSource(attributes.get("src"), violations);
  });
  if (externalTags.length !== reviewedStaticScripts.size) {
    violations.push(`expected ${reviewedStaticScripts.size} reviewed static external scripts, found ${externalTags.length}`);
  }
  const seenStaticSources = new Set();
  for (const attributes of externalTags) {
    const src = decodeHtmlAttribute(attributes.get("src"), violations);
    const reviewed = reviewedStaticScripts.get(src);
    if (!reviewed) {
      violations.push(`unreviewed static external script: ${src}`);
      continue;
    }
    if (seenStaticSources.has(src)) violations.push(`duplicate static external script: ${src}`);
    seenStaticSources.add(src);
    const attributeNames = [...attributes.keys()].sort().join(",");
    if (attributeNames !== "crossorigin,integrity,src" ||
        attributes.get("integrity") !== reviewed.integrity ||
        attributes.get("crossorigin").toLowerCase() !== reviewed.crossorigin) {
      violations.push(`static external script attributes do not match the reviewed SRI contract: ${src}`);
    }
  }
  for (const src of reviewedStaticScripts.keys()) {
    if (!seenStaticSources.has(src)) violations.push(`reviewed static external script is missing: ${src}`);
  }

  let syntaxTree;
  try {
    syntaxTree = acorn.parse(appSource, { ecmaVersion: "latest", sourceType: "script" });
  } catch (error) {
    violations.push(`app.js structural parse failed: ${error.message}`);
    return violations;
  }
  const nodes = walkJavaScript(syntaxTree);
  const bindings = new Map();
  const duplicateBindings = new Set();
  for (const node of nodes) {
    if (node.type !== "VariableDeclarator" || node.id.type !== "Identifier" || !node.init) continue;
    if (bindings.has(node.id.name)) duplicateBindings.add(node.id.name);
    else bindings.set(node.id.name, node.init);
  }
  duplicateBindings.forEach((name) => bindings.delete(name));

  const scriptCreations = [];
  const dynamicExternalAssignments = [];
  const srcAttributeCalls = [];
  for (const node of nodes) {
    if (node.type === "CallExpression" && memberPropertyName(node.callee, bindings) === "createElement" &&
        (staticString(node.arguments[0], bindings) || "").toLowerCase() === "script") {
      scriptCreations.push(node);
    }
    if (node.type === "CallExpression") {
      const method = memberPropertyName(node.callee, bindings);
      const attributeIndex = method === "setAttributeNS" ? 1 : 0;
      if ((method === "setAttribute" || method === "setAttributeNS") &&
          (staticString(node.arguments[attributeIndex], bindings) || "").toLowerCase() === "src") {
        srcAttributeCalls.push(node);
      }
      if (node.callee.type === "MemberExpression" && node.callee.object.type === "Identifier" &&
          node.callee.object.name === "Reflect" && method === "set" &&
          (staticString(node.arguments[1], bindings) || "").toLowerCase() === "src") {
        const url = staticString(node.arguments[2], bindings);
        if (url && isExternalScriptSource(url, violations)) dynamicExternalAssignments.push(url);
      }
    }
    if (node.type === "AssignmentExpression" && node.operator === "=" &&
        memberPropertyName(node.left, bindings) === "src") {
      const url = staticString(node.right, bindings);
      if (url && isExternalScriptSource(url, violations)) dynamicExternalAssignments.push(url);
    }
  }
  if (scriptCreations.length !== 1) {
    violations.push(`expected one reviewed dynamic script element creation, found ${scriptCreations.length}`);
  }
  if (srcAttributeCalls.length !== 0) {
    violations.push("dynamic script sources must not use setAttribute/setAttributeNS");
  }
  if (dynamicExternalAssignments.length !== 1 || dynamicExternalAssignments[0] !== reviewedDynamicScript.src) {
    violations.push(`dynamic external scripts must be exactly the reviewed ZXing source (found ${dynamicExternalAssignments.join(", ") || "none"})`);
  }
  const reviewedDynamicBlock = [
    '    script = document.createElement("script");',
    '    script.id = "dcats-zxing-browser";',
    `    script.src = "${reviewedDynamicScript.src}";`,
    `    script.integrity = "${reviewedDynamicScript.integrity}";`,
    '    script.crossOrigin = "anonymous";',
  ].join("\n");
  if (!appSource.replace(/\r\n/g, "\n").includes(reviewedDynamicBlock)) {
    violations.push("reviewed ZXing creation, exact-version URL, SRI, and anonymous CORS block is missing");
  }
  return violations;
}

function expectSupplyChainMutationRejected(label, htmlSource, appSource) {
  if (validateScriptSupplyChain(htmlSource, appSource).length === 0) {
    throw new Error(`script supply-chain self-test accepted ${label}`);
  }
}

const supplyChainViolations = validateScriptSupplyChain(html, app);
if (supplyChainViolations.length) {
  throw new Error(`Script supply-chain contract failed:\n- ${supplyChainViolations.join("\n- ")}`);
}
expectSupplyChainMutationRejected(
  "a single-quoted static script",
  `${html}\n<script src='https://cdn.jsdelivr.net/npm/unreviewed@1/index.js'></script>`,
  app,
);
expectSupplyChainMutationRejected(
  "an unquoted, reordered, mixed-case static script",
  `${html}\n<SCRIPT async SRC=https://cdn.jsdelivr.net/npm/unreviewed@1/index.js></SCRIPT>`,
  app,
);
expectSupplyChainMutationRejected(
  "a second script element using another variable",
  html,
  `${app}\nvar extraLoader = document.createElement('script'); extraLoader.src = "https://cdn.jsdelivr.net/npm/unreviewed@1/index.js";`,
);
expectSupplyChainMutationRejected(
  "a setAttribute script source",
  html,
  `${app}\nvar extraLoader = document.createElement('script'); extraLoader.setAttribute('src', 'https://cdn.jsdelivr.net/npm/unreviewed@1/index.js');`,
);
expectSupplyChainMutationRejected(
  "an assembled external script URL",
  html,
  `${app}\nconst dcatsUnreviewedUrl = "https://cdn." + "jsdelivr.net/npm/unreviewed@1/index.js"; var extraLoader = document.createElement('script'); extraLoader.src = dcatsUnreviewedUrl;`,
);

const versions = { metaVersion, legacyVersion, scriptVersion, installScriptVersion, legacyI18nVersion, conciergeScriptVersion, styleVersion, conciergeStyleVersion, manifestVersion };
Object.entries(versions).forEach(([label, version]) => {
  if (version !== appVersion) {
    throw new Error(`${label} ${version} must match ${appVersion}`);
  }
});

const requiredInstallIcons = [
  "assets/icons/apple-touch-icon-v4.png",
  "assets/icons/icon-192-v4.png",
  "assets/icons/icon-512-v4.png",
  "assets/icons/icon-maskable-512-v4.png",
  "apple-touch-icon.png",
];
requiredInstallIcons.forEach((file) => {
  if (!fs.existsSync(path.join(root, file))) throw new Error(`Missing install icon: ${file}`);
});
if (!html.includes('href="assets/icons/apple-touch-icon-v4.png"')) {
  throw new Error("Apple touch icon must use the cache-safe versioned filename");
}
const manifestIconSources = (manifest.icons || []).map((icon) => icon.src);
for (const source of requiredInstallIcons.slice(1, 4)) {
  if (!manifestIconSources.includes(source)) throw new Error(`Manifest install icon is missing: ${source}`);
}
if (manifest.id !== "/" || manifest.start_url !== "/" || manifest.scope !== "/") {
  throw new Error("Manifest identity, start_url, and scope must be rooted at D-CATS");
}

if (!app.includes('url.searchParams.set("_dcats_refresh", String(Date.now()))')) {
  throw new Error("manual refresh must request a fresh index document");
}

const loginBrandLockups = html.match(/class="login-brand-lockup"/g) || [];
if (loginBrandLockups.length !== 3) {
  throw new Error("login, forgot-password, and reset-password screens must share the brand lockup");
}
if (!styles.includes(".login-brand-lockup { display: inline-flex;") ||
    !styles.includes(".reg-card { background: #fff;") ||
    !styles.includes("width: calc(100% - 40px);")) {
  throw new Error("authentication brand lockup and narrow-screen card sizing are required");
}

console.log(`app release asset guard passed (${appVersion})`);
