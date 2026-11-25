const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const configPath = "config/supabase-origin.json";

// These are generated fields in the static output. The tracked copies are
// also served directly by GitHub Pages, so keep them in sync before committing.
const targets = [
  ["app.js", "origin", 1],
  ["index.html", "origin", 2],
  ["_headers", "origin", 1],
  ["scanflow/app.js", "origin", 1],
  ["scanflow/config.public.json", "origin", 2],
  ["scanflow/local-review/index.html", "origin", 1],
  ["scanflow/local-review/owner-auth.js", "origin", 1],
  ["assets/concierge-pet/concierge-admin.js", "escapedOrigin", 1],
  ["assets/concierge-pet/concierge-requests.js", "hostname", 1],
  ["product-3d.js", "origin", 1],
  ["product-3d-prepared-inputs.js", "hostname", 3],
];

function endpoint(value) {
  if (typeof value !== "string") throw new Error("Expected an HTTPS origin in " + configPath);
  const url = new URL(value);
  if (url.protocol !== "https:" || url.port || value !== url.origin) {
    throw new Error("Expected an HTTPS origin without a path, port or credentials in " + configPath);
  }
  return {
    origin: url.origin,
    hostname: url.hostname,
    escapedOrigin: url.origin.replace(/[./]/g, "\\$&"),
  };
}

function renderSupabaseOrigin(sourceRoot, configuredOrigin) {
  const read = (file) => fs.readFileSync(path.join(sourceRoot, file), "utf8");
  const app = read("app.js");
  const generated = app.match(/^var SUPABASE_URL = "([^"]+)";$/m);
  if (!generated) throw new Error("Missing generated SUPABASE_URL in app.js");
  const previous = endpoint(generated[1]);
  const next = endpoint(configuredOrigin ?? JSON.parse(read(configPath)).origin);

  const hasScanflow = fs.existsSync(path.join(sourceRoot, "scanflow"));
  const deployedTargets = targets.filter(([file]) => hasScanflow || !file.startsWith("scanflow/"));
  return new Map(deployedTargets.map(([file, field, count]) => {
    const content = file === "app.js" ? app : read(file);
    const parts = content.split(previous[field]);
    if (parts.length !== count + 1) {
      throw new Error("Unexpected number of generated Supabase endpoint fields in " + file);
    }
    return [file, parts.join(next[field])];
  }));
}

function writeSupabaseOrigin(output, rendered) {
  for (const [file, content] of rendered) {
    fs.writeFileSync(path.join(output, file), content);
  }
}

if (require.main === module) {
  const mode = process.argv[2];
  const rendered = renderSupabaseOrigin(root);
  if (mode === "--write") {
    writeSupabaseOrigin(root, rendered);
  } else if (mode === "--check") {
    for (const [file, content] of rendered) {
      if (fs.readFileSync(path.join(root, file), "utf8") !== content) {
        throw new Error("Generated Supabase endpoint is out of sync in " + file +
          ". Run node scripts/sync-supabase-origin.js --write.");
      }
    }
  } else {
    throw new Error("Use --check or --write");
  }
}

module.exports = { renderSupabaseOrigin, writeSupabaseOrigin };
