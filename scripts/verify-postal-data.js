const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const directory = path.join(root, "assets", "postal");
const manifestPath = path.join(directory, "manifest.json");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

assert(fs.existsSync(manifestPath), "postal manifest is missing");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
assert(manifest.schema_version === 1, "postal schema version is unsupported");
assert(/^20\d{2}-\d{2}-\d{2}$/.test(manifest.data_version), "postal data version is invalid");
assert(manifest.source_page === "https://www.post.japanpost.jp/service/search/zipcode/download/utf-zip.html", "postal source page must be Japan Post");
assert(manifest.source_archive === "https://www.post.japanpost.jp/service/search/zipcode/download/utf/zip/utf_ken_all.zip", "postal source archive must be Japan Post");
assert(Array.isArray(manifest.shards) && manifest.shards.length === 10, "postal data must have ten prefix shards");

let postalCodeCount = 0;
let addressCount = 0;
let sourceRowCount = 0;
let totalBytes = 0;
const prefectures = new Set();
let knownAddressFound = false;

manifest.shards.forEach((metadata, prefix) => {
  assert(metadata.prefix === String(prefix), `postal shard ${prefix} has the wrong prefix`);
  assert(metadata.file === `postal-${prefix}.json`, `postal shard ${prefix} has an unexpected file name`);
  const filePath = path.join(directory, metadata.file);
  assert(fs.existsSync(filePath), `postal shard ${prefix} is missing`);
  const content = fs.readFileSync(filePath);
  assert(content.length === metadata.bytes, `postal shard ${prefix} byte count changed`);
  assert(sha256(content) === metadata.sha256, `postal shard ${prefix} checksum changed`);
  const shard = JSON.parse(content.toString("utf8"));
  assert(shard.v === manifest.data_version, `postal shard ${prefix} version changed`);
  assert(Array.isArray(shard.c) && shard.z && typeof shard.z === "object", `postal shard ${prefix} structure is invalid`);
  let shardAddressCount = 0;
  Object.entries(shard.z).forEach(([postalCode, rows]) => {
    assert(new RegExp(`^${prefix}\\d{6}$`).test(postalCode), `invalid postal code in shard ${prefix}: ${postalCode}`);
    assert(Array.isArray(rows) && rows.length > 0, `postal code ${postalCode} has no addresses`);
    rows.forEach((row) => {
      assert(Array.isArray(row) && row.length === 2, `postal code ${postalCode} has an invalid address row`);
      const city = shard.c[row[0]];
      assert(Array.isArray(city) && city.length === 3, `postal code ${postalCode} has an invalid city reference`);
      assert(/^([1-9]|[1-3]\d|4[0-7])$/.test(city[0]), `postal code ${postalCode} has an invalid prefecture code`);
      assert(city[1] && city[2], `postal code ${postalCode} has incomplete address text`);
      assert(row[1] !== "以下に掲載がない場合", `postal code ${postalCode} exposes the Japan Post placeholder town`);
      prefectures.add(`${city[0]}:${city[1]}`);
      if (postalCode === "1000001" && city[1] === "東京都" && city[2] === "千代田区" && row[1] === "千代田") knownAddressFound = true;
      shardAddressCount += 1;
    });
  });
  assert(Object.keys(shard.z).length === metadata.postal_code_count, `postal shard ${prefix} code count changed`);
  assert(shardAddressCount === metadata.address_count, `postal shard ${prefix} address count changed`);
  postalCodeCount += metadata.postal_code_count;
  addressCount += metadata.address_count;
  sourceRowCount += metadata.source_row_count;
  totalBytes += content.length;
});

assert(postalCodeCount === manifest.postal_code_count && postalCodeCount >= 100000, "postal code total is invalid");
assert(sourceRowCount === manifest.source_row_count && sourceRowCount >= 100000, "postal source row total is invalid");
assert(prefectures.size === 47 && manifest.prefecture_count === 47, "postal prefecture coverage is incomplete");
assert(knownAddressFound, "known postal code 1000001 is missing");
assert(totalBytes < 12 * 1024 * 1024, `postal browser data is unexpectedly large: ${totalBytes} bytes`);

console.log(`postal data guard passed (${manifest.data_version}, ${postalCodeCount} codes, ${addressCount} addresses, ${totalBytes} bytes)`);
