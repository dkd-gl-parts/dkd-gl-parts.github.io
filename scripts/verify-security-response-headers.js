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
expect(!/unsafe-inline|unsafe-eval/i.test(responseCsp), "CSP must not allow unsafe inline or eval execution");

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

console.log("Security response header contract: OK");
