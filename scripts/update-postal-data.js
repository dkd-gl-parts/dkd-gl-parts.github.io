const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const SOURCE_PAGE = "https://www.post.japanpost.jp/service/search/zipcode/download/utf-zip.html";
const SOURCE_ARCHIVE = "https://www.post.japanpost.jp/service/search/zipcode/download/utf/zip/utf_ken_all.zip";
const PLACEHOLDER_TOWNS = new Set(["以下に掲載がない場合"]);

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function parseCsvLine(line) {
  const fields = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      fields.push(value);
      value = "";
    } else {
      value += character;
    }
  }
  fields.push(value);
  return fields;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function writeIfChanged(file, content) {
  if (fs.existsSync(file) && fs.readFileSync(file, "utf8") === content) return false;
  fs.writeFileSync(file, content, "utf8");
  return true;
}

async function sourceUpdatedAt(explicitDate) {
  if (explicitDate) return explicitDate;
  const response = await fetch(SOURCE_PAGE, { headers: { "user-agent": "D-CATS postal data updater" } });
  if (!response.ok) throw new Error(`Could not read Japan Post update page: HTTP ${response.status}`);
  const html = await response.text();
  const match = html.match(/(20\d{2})年\s*(\d{1,2})月\s*(\d{1,2})日更新/);
  if (!match) throw new Error("Japan Post update date could not be detected");
  return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
}

function compactTown(value) {
  const town = String(value || "").trim();
  return PLACEHOLDER_TOWNS.has(town) ? "" : town;
}

async function main() {
  const root = path.resolve(__dirname, "..");
  const input = path.resolve(argument("--input", ""));
  const output = path.resolve(argument("--output", path.join(root, "assets", "postal")));
  if (!input || !fs.existsSync(input)) throw new Error("Use --input with the extracted utf_ken_all.csv file");

  const updatedAt = await sourceUpdatedAt(argument("--updated-at", ""));
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(updatedAt)) throw new Error(`Invalid source update date: ${updatedAt}`);
  const csvBuffer = fs.readFileSync(input);
  const lines = csvBuffer.toString("utf8").replace(/^\ufeff/, "").split(/\r?\n/).filter(Boolean);
  const shards = Array.from({ length: 10 }, () => ({ cities: [], cityIndexes: new Map(), entries: new Map(), sourceRows: 0 }));
  const prefectures = new Set();
  let acceptedRows = 0;

  for (const line of lines) {
    const fields = parseCsvLine(line);
    if (fields.length < 9) throw new Error(`Malformed CSV row ${acceptedRows + 1}`);
    const municipalityCode = String(fields[0] || "").trim().padStart(5, "0");
    const postalCode = String(fields[2] || "").trim();
    const prefectureName = String(fields[6] || "").trim();
    const cityName = String(fields[7] || "").trim();
    const townName = compactTown(fields[8]);
    if (!/^\d{5}$/.test(municipalityCode) || !/^\d{7}$/.test(postalCode) || !prefectureName || !cityName) {
      throw new Error(`Invalid postal row: ${line.slice(0, 160)}`);
    }
    const prefectureCode = String(parseInt(municipalityCode.slice(0, 2), 10));
    const shard = shards[Number(postalCode[0])];
    const cityKey = `${prefectureCode}\u0000${prefectureName}\u0000${cityName}`;
    let cityIndex = shard.cityIndexes.get(cityKey);
    if (cityIndex == null) {
      cityIndex = shard.cities.length;
      shard.cityIndexes.set(cityKey, cityIndex);
      shard.cities.push([prefectureCode, prefectureName, cityName]);
    }
    const addresses = shard.entries.get(postalCode) || [];
    if (!addresses.some((address) => address[0] === cityIndex && address[1] === townName)) {
      addresses.push([cityIndex, townName]);
      shard.entries.set(postalCode, addresses);
    }
    shard.sourceRows += 1;
    prefectures.add(`${prefectureCode}:${prefectureName}`);
    acceptedRows += 1;
  }

  const postalCodeCount = shards.reduce((total, shard) => total + shard.entries.size, 0);
  if (acceptedRows < 100000 || acceptedRows > 200000) throw new Error(`Unexpected source row count: ${acceptedRows}`);
  if (postalCodeCount < 100000 || postalCodeCount > 150000) throw new Error(`Unexpected postal code count: ${postalCodeCount}`);
  if (prefectures.size !== 47) throw new Error(`Expected 47 prefectures, found ${prefectures.size}`);

  fs.mkdirSync(output, { recursive: true });
  const shardMetadata = [];
  let changed = false;
  shards.forEach((shard, prefix) => {
    const entries = {};
    [...shard.entries.keys()].sort().forEach((postalCode) => {
      entries[postalCode] = shard.entries.get(postalCode);
    });
    const payload = JSON.stringify({ v: updatedAt, c: shard.cities, z: entries }) + "\n";
    const fileName = `postal-${prefix}.json`;
    changed = writeIfChanged(path.join(output, fileName), payload) || changed;
    shardMetadata.push({
      prefix: String(prefix),
      file: fileName,
      postal_code_count: shard.entries.size,
      address_count: [...shard.entries.values()].reduce((total, rows) => total + rows.length, 0),
      source_row_count: shard.sourceRows,
      bytes: Buffer.byteLength(payload),
      sha256: sha256(payload)
    });
  });

  const manifest = {
    schema_version: 1,
    data_version: updatedAt,
    source_name: "日本郵便 住所の郵便番号（1レコード1行・UTF-8形式）",
    source_page: SOURCE_PAGE,
    source_archive: SOURCE_ARCHIVE,
    source_updated_at: updatedAt,
    source_csv_sha256: sha256(csvBuffer),
    source_row_count: acceptedRows,
    postal_code_count: postalCodeCount,
    prefecture_count: prefectures.size,
    shards: shardMetadata
  };
  changed = writeIfChanged(path.join(output, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n") || changed;

  const knownShard = JSON.parse(fs.readFileSync(path.join(output, "postal-1.json"), "utf8"));
  const knownRows = knownShard.z["1000001"] || [];
  if (!knownRows.some((row) => {
    const city = knownShard.c[row[0]] || [];
    return city[1] === "東京都" && city[2] === "千代田区" && row[1] === "千代田";
  })) throw new Error("Known postal code 1000001 did not match 東京都千代田区千代田");

  console.log(JSON.stringify({ changed, updated_at: updatedAt, source_rows: acceptedRows, postal_codes: postalCodeCount, output }, null, 2));
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exit(1);
});
