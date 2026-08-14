import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";

const root = process.cwd();
const input = path.resolve(root, process.argv[2] || "data/staging/pornhub/final.jsonl");
const aliases = JSON.parse(await readFile(path.join(root, "lib/pornhub-category-aliases.json"), "utf8"));
const risky = ["underage", "minor", "young girl", "teen", "schoolgirl", "school girl", "barely legal", "lolita", "child", "college girl"];
const normalize = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const counts = Object.fromEntries(Object.keys(aliases).map((slug) => [slug, 0]));
let records = 0;
let safeRecords = 0;

const lines = readline.createInterface({ input: createReadStream(input), crlfDelay: Infinity });
for await (const line of lines) {
  if (!line.trim()) continue;
  records += 1;
  const record = JSON.parse(line);
  const rawValues = [record.title, record.description, ...(record.tags || []), ...(record.sourceCategories || [])].map((value) => String(value || "").toLowerCase());
  if (risky.some((term) => rawValues.some((value) => value.includes(term)))) continue;
  safeRecords += 1;
  const values = new Set([...(record.collections || []), ...(record.tags || []), ...(record.sourceCategories || [])].map(normalize));
  for (const [slug, terms] of Object.entries(aliases)) {
    if ([slug, ...terms].map(normalize).some((term) => values.has(term) || [...values].some((value) => value.includes(term)))) counts[slug] += 1;
  }
}

console.log(JSON.stringify({ input, records, safeRecords, excludedBySafetyFilter: records - safeRecords, categories: counts }, null, 2));
