#!/usr/bin/env node

import { copyFile, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const catalogPath = path.resolve(process.argv[2] ?? "data/staging/videocelebs/catalog.jsonl");
const compactPath = catalogPath.replace(/\.jsonl$/i, ".json");

function titleTaxonomy(title) {
  const sourceTitle = String(title ?? "");
  if (!/\s+(?:-|\u2013|\u2014)\s+/u.test(sourceTitle)) return { actresses: [], tags: [] };
  const creditText = sourceTitle.split(/\s+(?:-|\u2013|\u2014)\s+/u)[0] ?? "";
  const entries = creditText.split(/\s*,\s*|\s+&\s+/u).map((value) => value.trim()).filter(Boolean);
  const actresses = entries
    .map((value) => value.replace(/\s+(?:nude|sexy)(?:\s+debut)?\s*$/i, "").trim())
    .filter((value) => value && !/^(?:etc|ect)\.?$/i.test(value));
  const tags = [...new Set(entries.flatMap((value) => value.match(/\b(?:nude|sexy)\b/gi) ?? []).map((value) => value.toLowerCase()))];
  return { actresses: [...new Set(actresses)], tags };
}

const source = await readFile(catalogPath, "utf8");
const records = new Map();
for (const line of source.split(/\r?\n/)) {
  if (!line.trim()) continue;
  const record = JSON.parse(line);
  records.set(Number(record.id), record);
}

let actressRepairs = 0;
let tagRepairs = 0;
for (const record of records.values()) {
  const inferred = titleTaxonomy(record.title);
  const catalogStatus = !record.workSourceUrl && !/\s+(?:-|\u2013|\u2014)\s+/u.test(record.title) ? "excluded_non_scene" : "active";
  record.catalogStatus = catalogStatus;
  if (!record.year) record.year = Number(record.title?.match(/(?:19|20)\d{2}/)?.[0] ?? 0) || null;
  const existingActresses = (record.actresses ?? []).filter((value) => value && !/^(?:etc|ect)\.?$/i.test(value));
  const hasBrokenActress = existingActresses.some((value) => /\\$/.test(value));
  if (catalogStatus === "excluded_non_scene") {
    record.actresses = [];
    record.tags = [];
  } else if ((!existingActresses.length || hasBrokenActress) && inferred.actresses.length) {
    record.actresses = inferred.actresses;
    actressRepairs += 1;
  } else {
    record.actresses = existingActresses;
  }
  if (catalogStatus !== "excluded_non_scene" && !(record.tags ?? []).length && inferred.tags.length) {
    record.tags = inferred.tags;
    tagRepairs += 1;
  }
  if (!record.metadataStatus) record.metadataStatus = existingActresses.length && (record.tags ?? []).length ? "source" : "title_fallback";
}

const sorted = [...records.values()].sort((a, b) => Number(b.id) - Number(a.id));
const stamp = new Date().toISOString().replace(/[-:.]/g, "").replace("T", "-").replace("Z", "Z");
const jsonlBackup = `${catalogPath}.before-title-taxonomy-${stamp}`;
const compactBackup = `${compactPath}.before-title-taxonomy-${stamp}`;
const jsonlTemp = `${catalogPath}.tmp-${process.pid}`;
const compactTemp = `${compactPath}.tmp-${process.pid}`;

await Promise.all([
  copyFile(catalogPath, jsonlBackup),
  copyFile(compactPath, compactBackup),
  writeFile(jsonlTemp, `${sorted.map((record) => JSON.stringify(record)).join("\n")}\n`, "utf8"),
  writeFile(compactTemp, `${JSON.stringify(sorted, null, 2)}\n`, "utf8"),
]);
await rename(jsonlTemp, catalogPath);
await rename(compactTemp, compactPath);

console.log(`Rebuilt ${sorted.length} unique records.`);
console.log(`Repaired actress taxonomy on ${actressRepairs} records and tag taxonomy on ${tagRepairs} records.`);
console.log(`Backups: ${path.relative(process.cwd(), jsonlBackup)}, ${path.relative(process.cwd(), compactBackup)}`);
