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

function duration(seconds) {
  const value = Math.max(0, Number(seconds) || 0);
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const remainder = value % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function readableTitle(value) {
  const title = String(value ?? "").trim();
  const letters = [...title].filter((character) => /\p{L}/u.test(character));
  if (title.length < 8 || title.length > 118 || letters.length < 5) return false;
  const latin = letters.filter((character) => /[A-Za-z]/.test(character)).length;
  return latin / letters.length >= 0.7;
}

function normalizedTaxonomyValues(record) {
  return [...(record.tags ?? []), ...(record.sourceCategories ?? []), ...(record.collections ?? [])]
    .map((value) => String(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim())
    .filter(Boolean);
}

// Homepage category rails intentionally ignore titles/descriptions. A title can
// casually mention a term without the video actually belonging to that category.
function hasStrictTaxonomyTerm(record, terms) {
  const values = normalizedTaxonomyValues(record);
  return terms.some((term) => {
    const normalizedTerm = term.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    return values.some((value) => value === normalizedTerm || ` ${value} `.includes(` ${normalizedTerm} `));
  });
}

const AGE_RISK_TERMS = ["underage", "minor", "young girl", "teen", "schoolgirl", "school girl", "barely legal", "lolita", "child", "college girl"];

function isAdultSafe(record) {
  const values = [record.title, record.description, ...(record.tags ?? []), ...(record.sourceCategories ?? [])].map((value) => String(value ?? "").toLowerCase());
  return !AGE_RISK_TERMS.some((term) => values.some((value) => value.includes(term)));
}

function score(record) {
  const year = Number(String(record.publishedAt ?? "").slice(0, 4)) || 0;
  return Math.log10(Math.max(1, Number(record.views) || 0)) * 1_000
    + (Number(record.rating) || 0) * 12
    + Math.max(0, year - 2022) * 70
    + (record.validation?.embed?.ok ? 40 : 0)
    + (record.validation?.thumbnail?.ok ? 40 : 0);
}

function seed(value) {
  let result = 2166136261;
  for (const character of value) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function shuffled(values, key) {
  let state = seed(key) || 1;
  const random = () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  const output = [...values];
  for (let index = output.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [output[index], output[target]] = [output[target], output[index]];
  }
  return output;
}

function item(record) {
  return {
    id: String(record.sourceId),
    numericId: Number(record.sourceNumericId) || 0,
    slug: String(record.slug),
    title: String(record.title).trim(),
    thumbnail: String(record.thumbnailUrl),
    thumbnailFallback: String(record.thumbnailFallbackUrl ?? ""),
    duration: duration(record.durationSeconds),
    year: Number(String(record.publishedAt ?? "").slice(0, 4)) || 0,
    rating: Math.round(Number(record.rating) || 0),
    views: Math.max(0, Number(record.views) || 0),
    tags: [...new Set([...(record.tags ?? []), ...(record.sourceCategories ?? []), ...(record.collections ?? [])])].slice(0, 20),
    collections: (record.collections ?? []).slice(0, 8),
    publishedAt: String(record.publishedAt ?? ""),
  };
}

const options = args(process.argv.slice(2));
const input = path.resolve(options.input ?? "data/staging/pornhub/final.jsonl");
const output = path.resolve(options.out ?? "data/catalog/pornhub-home-preview.json");
const recordsOutput = path.resolve(options["records-out"] ?? "data/catalog/pornhub-featured.jsonl");
const limit = Math.max(5, Number(options.limit ?? 10));
const bestLimit = Math.max(limit, Number(options["best-limit"] ?? 20));

// Videos that answer HTTP 200 but refuse to play inside an embed. The validator
// cannot see that, so they are suppressed by id/slug here and in the runtime
// catalog reader.
const blocked = await readFile(path.resolve(options.blocklist ?? "data/catalog/pornhub-blocklist.json"), "utf8")
  .then((value) => {
    const entries = JSON.parse(value).blocked;
    const list = Array.isArray(entries) ? entries : [];
    return {
      ids: new Set(list.map((entry) => String(entry.sourceId ?? "").trim()).filter(Boolean)),
      slugs: new Set(list.map((entry) => String(entry.slug ?? "").trim()).filter(Boolean)),
    };
  })
  .catch(() => ({ ids: new Set(), slugs: new Set() }));

const records = (await readFile(input, "utf8"))
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => JSON.parse(line))
  .filter((record) => !blocked.ids.has(String(record.sourceId ?? "")) && !blocked.slugs.has(String(record.slug ?? "")))
  .filter((record) => {
    const year = Number(String(record.publishedAt ?? "").slice(0, 4));
    return year >= 2024 && year <= 2026;
  })
  .filter((record) => record.validation?.embed?.ok && record.validation?.thumbnail?.ok && readableTitle(record.title) && isAdultSafe(record))
  .sort((left, right) => Date.parse(right.publishedAt ?? "") - Date.parse(left.publishedAt ?? "") || score(right) - score(left));

const used = new Set();
const featured = new Map();
function select(name, predicate) {
  const candidateLimit = Math.max(160, limit * 24);
  const candidates = records.filter((record) => !used.has(String(record.sourceId)) && predicate(record)).slice(0, candidateLimit);
  const selected = [2026, 2025, 2024].flatMap((year) => shuffled(
    candidates.filter((record) => Number(String(record.publishedAt ?? "").slice(0, 4)) === year),
    `${name}:${year}:${records.length}`,
  )).slice(0, limit);
  for (const record of selected) {
    const sourceId = String(record.sourceId);
    used.add(sourceId);
    featured.set(sourceId, record);
  }
  return selected.map(item);
}

// The homepage renders this as its only adult list: newest year first
// (2026 -> 2025 -> 2024) and most viewed first inside each year. Unlike the
// category rails it reads the whole eligible set instead of a recency-capped
// candidate window, otherwise the view ordering would be biased to new uploads.
function selectMostViewed(name, count) {
  const selected = [2026, 2025, 2024]
    .flatMap((year) => records
      .filter((record) => !used.has(String(record.sourceId)) && Number(String(record.publishedAt ?? "").slice(0, 4)) === year)
      .sort((left, right) => (Number(right.views) || 0) - (Number(left.views) || 0) || score(right) - score(left)))
    .slice(0, count);
  for (const record of selected) {
    const sourceId = String(record.sourceId);
    used.add(sourceId);
    featured.set(sourceId, record);
  }
  console.log(`${name}: newest-year-first, most viewed first (${selected.length})`);
  return selected.map(item);
}

const sections = {
  best: selectMostViewed("best", bestLimit),
  romantic: select("romantic", (record) => hasStrictTaxonomyTerm(record, ["romantic", "romance", "passionate", "sensual", "love making"])),
  babe: select("babe", (record) => hasStrictTaxonomyTerm(record, ["babe", "beautiful", "brunette", "blonde", "redhead", "sexy woman", "hot woman"])),
  anime: select("anime", (record) => hasStrictTaxonomyTerm(record, ["hentai anime", "hentai", "anime", "animated", "cartoon"])),
  doggy: select("doggy", (record) => hasStrictTaxonomyTerm(record, ["doggy style", "doggy", "doggystyle", "rear entry"])),
  pussyLicking: select("pussy-licking", (record) => hasStrictTaxonomyTerm(record, ["pussy licking", "pussy lick", "licking pussy", "eating pussy", "cunnilingus"])),
  stepFantasy: select("step-fantasy", (record) => hasStrictTaxonomyTerm(record, ["step family roleplay", "step fantasy", "stepmom", "step mom", "stepsister", "step sister", "stepfamily", "step family"])),
  blowjob: select("blowjob", (record) => hasStrictTaxonomyTerm(record, ["blowjob", "blow job", "deepthroat", "deep throat", "sucking dick"])),
};

await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${JSON.stringify({ generatedAt: new Date().toISOString(), sourceRecords: records.length, sections }, null, 2)}\n`, "utf8");
await mkdir(path.dirname(recordsOutput), { recursive: true });
await writeFile(recordsOutput, `${[...featured.values()].map((record) => JSON.stringify(record)).join("\n")}\n`, "utf8");

for (const [name, values] of Object.entries(sections)) console.log(`${name}: ${values.length}`);
console.log(`Wrote local homepage preview to ${output}.`);
console.log(`Wrote ${featured.size} featured fallback records to ${recordsOutput}.`);
