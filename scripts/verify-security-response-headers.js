const fs = require("fs");
const path = require("path");

const sourceRoot = path.resolve(__dirname, "..");
const root = process.argv[2] ? path.resolve(process.cwd(), process.argv[2]) : sourceRoot;
const headers = fs.readFileSync(path.join(root, "_headers"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

function headerValue(name) {
  const match = headers.match(new RegExp(`^\\s+${name}:\\s*(.+)$`, "im"));
  expect(match, `Missing ${name} header`);
  return match[1].trim();
}

function directives(value) {
  return new Map(value.split(";").map((part) => part.trim()).filter(Boolean).map((part) => {
    const separator = part.indexOf(" ");
    return separator < 0 ? [part, ""] : [part.slice(0, separator), part.slice(separator + 1).trim()];
  }));
}

expect(/^\/\*\s*$/m.test(headers), "Security headers must apply to every path");

const responseCsp = headerValue("Content-Security-Policy");
const metaTagMatch = html.match(/<meta\b[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/i);
expect(metaTagMatch, "Missing fallback meta Content-Security-Policy");
const metaContentMatch = metaTagMatch[0].match(/\bcontent="([^"]+)"/i);
expect(metaContentMatch, "Fallback meta Content-Security-Policy must use a quoted content attribute");

const responseDirectives = directives(responseCsp);
const metaDirectives = directives(metaContentMatch[1]);

for (const [name, value] of metaDirectives) {
  expect(responseDirectives.get(name) === value, `Response CSP must preserve meta directive: ${name}`);
}

expect(responseDirectives.get("frame-ancestors") === "'none'", "CSP must deny framing");
expect(responseDirectives.has("upgrade-insecure-requests"), "CSP must upgrade insecure subresources");
expect(!/(?:^|\s)'(?:unsafe-inline|unsafe-eval)'(?:\s|;|$)/i.test(responseCsp), "CSP must not allow unsafe inline or JavaScript eval execution");
expect(responseDirectives.get("script-src") === "'self' 'wasm-unsafe-eval'", "Only self-hosted scripts and reviewed Wasm decoders may execute");
expect(responseDirectives.get("script-src-attr") === "'none'", "Inline handlers must remain blocked");
expect(responseDirectives.get("worker-src") === "'self' blob:", "Decoder workers must remain local");

const hsts = headerValue("Strict-Transport-Security");
const maxAge = Number((hsts.match(/max-age=(\d+)/i) || [])[1]);
expect(Number.isFinite(maxAge) && maxAge >= 31536000, "HSTS max-age must be at least one year");
expect(/includeSubDomains/i.test(hsts), "HSTS must include subdomains");

expect(headerValue("X-Content-Type-Options").toLowerCase() === "nosniff", "nosniff must be enabled");
expect(headerValue("X-Frame-Options").toUpperCase() === "DENY", "X-Frame-Options must deny framing");
expect(headerValue("Referrer-Policy").toLowerCase() === "no-referrer", "Referrer policy must not disclose source URLs");

const permissions = headerValue("Permissions-Policy");
expect(/(?:^|,\s*)camera=\(self\)/i.test(permissions), "Permissions-Policy must limit camera access to this origin");
for (const feature of ["microphone", "geolocation", "payment", "usb"]) {
  expect(new RegExp(`(?:^|,\\s*)${feature}=\\(\\)`, "i").test(permissions), `Permissions-Policy must disable ${feature}`);
}

// The order toolbar link must resolve in both a source checkout and the static deployment.
const helpLink = html.match(/<a class="sales-order-help-link" href="(assets\/help\/fax-order\.html)\?v=\d+" target="_blank" rel="noopener noreferrer"[^>]*>/);
expect(helpLink, "The FAX order help must open a versioned, same-origin document in a separate tab");
const helpPath = path.join(root, helpLink[1]);
const help = fs.readFileSync(helpPath, "utf8");
const helpStyle = help.match(/<link rel="stylesheet" href="(fax-order\.css)\?v=\d+">/);
expect(helpStyle && fs.statSync(path.join(path.dirname(helpPath), helpStyle[1])).isFile(), "The FAX order help stylesheet must be deployed");
expect(/<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'self';/.test(help), "The FAX order help must restrict active content");
expect(!/<(?:script|style|iframe)\b|\s(?:on[a-z]+|style)\s*=/i.test(help), "The FAX order help must remain a static document with external CSS");
expect(/^\/assets\/help\/\*\r?\n\s+Cache-Control: no-cache\s*$/m.test(headers), "The FAX order help needs revalidation on updates");

async function verifyPagesApiRoutes() {
  const families = ["rest","auth","storage","functions"];
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "_routes.json"), "utf8"));
  expect(manifest.version === 1, "Pages Functions require a version 1 routes manifest");
  expect(JSON.stringify(manifest.include) === JSON.stringify(families.map((name) => `/${name}/v1/*`)),
    "Pages Functions must run only on the four API route families");
  expect(Array.isArray(manifest.exclude) && manifest.exclude.length === 0,
    "The Pages Functions route manifest must leave the API paths enabled");

  if (root !== sourceRoot) {
    expect(!fs.existsSync(path.join(root, "functions")), "Pages Functions source must stay outside the static build");
    for (const name of families) {
      expect(!fs.existsSync(path.join(root, name, "v1")), `API route must not contain static files: ${name}/v1`);
    }
  }

  let referenceSource;
  for (const name of families) {
    const file = path.join(sourceRoot, "functions", name, "v1", "[[path]].js");
    const source = fs.readFileSync(file, "utf8");
    referenceSource ??= source;
    expect(source === referenceSource, "The four Pages Functions must use the same forwarding handler");
    const { onRequest } = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
    const request = new Request(`https://dcats.example/${name}/v1/example/nested?id=1`, {
      method: "POST", headers: { "content-type": "application/json" }, body: "{}",
    });
    const response = new Response("worker response", { status: 202 });
    let requests = 0;
    const upstream = { fetch(forwarded) {
      expect(forwarded === request, `Pages Function altered the request: ${name}`);
      requests++;
      return Promise.resolve(response);
    } };
    expect(await onRequest({ request, env: { API: upstream } }) === response && requests === 1,
      `Pages Function did not return the bound Worker's response: ${name}`);

    const fallback = await onRequest({ request, env: {} });
    expect(fallback.status === 404 && fallback.headers.get("content-type") === "application/json"
      && await fallback.text() === '{"message":"not found"}',
      `Pages Function did not return the expected JSON 404 without a binding: ${name}`);
  }
}

verifyPagesApiRoutes().then(() => {
  console.log("Security response header contract: OK");
  console.log("Pages API routes and static build separation: OK");
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
