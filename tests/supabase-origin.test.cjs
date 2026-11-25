const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { renderSupabaseOrigin } = require("../scripts/sync-supabase-origin.js");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const baseline = JSON.parse(read("config/supabase-origin.json")).origin;
const alternate = "https://gateway.example.test";
const storageKey = 'storageKey: "sb-jqoeqximtwfpqwzngutj-auth-token"';

test("GitHub Pages files match the configured origin", () => {
  const rendered = renderSupabaseOrigin(root);
  assert.equal(rendered.size, 11);
  for (const [file, content] of rendered) assert.equal(content, read(file), file);
  assert.match(rendered.get("app.js"), /createClient\(SUPABASE_URL, SUPABASE_KEY, \{\s*auth:/);
  assert.ok(rendered.get("app.js").includes(storageKey));
});

test("one origin updates the endpoints, CSP and strict URL checks", () => {
  const rendered = renderSupabaseOrigin(root, alternate);
  const host = new URL(baseline).hostname;
  const newHost = new URL(alternate).hostname;
  for (const [file, content] of rendered) {
    assert.ok(content.includes(newHost) || content.includes(newHost.replaceAll(".", "\\.")), file);
    assert.ok(!content.includes(host) && !content.includes(host.replaceAll(".", "\\.")), file);
  }
  assert.ok(rendered.get("app.js").includes(storageKey));
  assert.ok(rendered.get("scanflow/app.js").includes(storageKey.replace(": ", ":")));
  const scanflow = JSON.parse(rendered.get("scanflow/config.public.json"));
  assert.equal(scanflow.supabaseUrl, alternate);
  assert.equal(scanflow.apiUrl, alternate + "/functions/v1/scanflow-api");
  assert.ok(rendered.get("scanflow/local-review/index.html").includes("connect-src 'self' " + alternate + "/auth/v1/"));
  assert.ok(rendered.get("_headers").includes(alternate + " https://zipcloud.ibsnet.co.jp"));
  assert.ok(rendered.get("index.html").includes('rel="preconnect" href="' + alternate + '"'));
});

test("invalid origins are rejected before generating deployment files", () => {
  for (const input of ["http://gateway.example.test", alternate + "/rest/v1",
    alternate + ":8443", "https://user@gateway.example.test", alternate + "?other=1"]) {
    assert.throws(() => renderSupabaseOrigin(root, input), /Expected an HTTPS origin/);
  }
});
