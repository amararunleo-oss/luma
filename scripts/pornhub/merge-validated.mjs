#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

function args(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    result[key] = argv[index + 1] && !argv[index + 1].startsWith("--") ? argv[++index] : true;
  }
  return result;
}

function normalizedKey(value) {
  return String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

async function records(filePath) {
  return (await readFile(filePath, "utf8")).split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

const options = args(process.argv.slice(2));
const basePath = path.resolve(options.base ?? "data/staging/pornhub/validated.jsonl");
const addPath = path.resolve(options.add ?? "data/staging/pornhub-backfill/validated.jsonl");
const outputPath = path.resolve(options.out ?? "data/staging/pornhub/final.jsonl");
const target = Math.max(1, Number(options.target ?? 10_000));
const maxTitleDuplicates = Math.max(1, Number(options["max-title-duplicates"] ?? 2));
const maxPerformerVideos = Math.max(1, Number(options["max-performer-videos"] ?? 30));

const [base, additions] = await Promise.all([records(basePath), records(addPath)]);
const merged = [];
const sourceIds = new Set();
const embedUrls = new Set();
const titleCounts = new Map();
const performerCounts = new Map();
let duplicateRejected = 0;
let titleRejected = 0;
let performerRejected = 0;

function accept(record, preserveBase = false) {
  const sourceId = String(record.sourceId ?? "");
  const embedUrl = String(record.embedUrl ?? "");
  if (!sourceId || !embedUrl || sourceIds.has(sourceId) || embedUrls.has(embedUrl)) { duplicateRejected += 1; return false; }
  const titleKey = normalizedKey(record.title);
  const performerKeys = [...new Set((record.performers ?? []).map(normalizedKey).filter(Boolean))];
  if (!preserveBase && (titleCounts.get(titleKey) ?? 0) >= maxTitleDuplicates) { titleRejected += 1; return false; }
  if (!preserveBase && performerKeys.some((key) => (performerCounts.get(key) ?? 0) >= maxPerformerVideos)) { performerRejected += 1; return false; }
  sourceIds.add(sourceId); embedUrls.add(embedUrl);
  titleCounts.set(titleKey, (titleCounts.get(titleKey) ?? 0) + 1);
  for (const key of performerKeys) performerCounts.set(key, (performerCounts.get(key) ?? 0) + 1);
  merged.push(record);
  return true;
}

for (const record of base) {
  if (merged.length >= target) break;
  accept(record, true);
}
for (const record of additions) {
  if (merged.length >= target) break;
  accept(record);
}

const generatedAt = new Date().toISOString();
const finalRecords = merged.map((record, index) => ({ ...record, popularityRank: index + 1, mergedAt: generatedAt }));
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${finalRecords.map((record) => JSON.stringify(record)).join("\n")}\n`, "utf8");
await writeFile(`${outputPath}.report.json`, `${JSON.stringify({ generatedAt, target, base: { path: basePath, records: base.length }, additions: { path: addPath, records: additions.length }, output: { path: outputPath, records: finalRecords.length }, rejected: { duplicate: duplicateRejected, titleLimit: titleRejected, performerLimit: performerRejected } }, null, 2)}\n`, "utf8");

console.log(`Merged ${finalRecords.length.toLocaleString()}/${target.toLocaleString()} validated records into ${outputPath}.`);
console.log(`Rejected during merge: ${duplicateRejected.toLocaleString()} duplicate, ${titleRejected.toLocaleString()} title-limit, ${performerRejected.toLocaleString()} performer-limit.`);
if (finalRecords.length < target) {
  console.error(`Still need ${(target - finalRecords.length).toLocaleString()} additional validated records.`);
  process.exitCode = 2;
}
