#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { parseArgs } from "./single-video-utils.mjs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const options = parseArgs(process.argv.slice(2));
const inputPath = path.resolve(options.input ?? "data/staging/pornhub/final.jsonl");
const statePath = path.resolve(options.state ?? "data/staging/pornhub/production-sync.state.json");
const execute = Boolean(options.execute);
const d1BatchSize = Math.max(10, Math.min(100, Number(options["d1-batch"] ?? 50)));
const redisChunkSize = Math.max(100, Math.min(500, Number(options["redis-chunk"] ?? 250)));
const delayMs = Math.max(0, Number(options["delay-ms"] ?? 250));
const expectedCount = Math.max(1, Number(options["expected-count"] ?? 10_000));

const source = await readFile(inputPath, "utf8");
const lines = source.split(/\r?\n/).filter(Boolean);
const records = lines.map((line, index) => {
  try { return JSON.parse(line); }
  catch { throw new Error(`Invalid JSON on input line ${index + 1}.`); }
});
if (records.length !== expectedCount && !options["allow-count-mismatch"]) {
  throw new Error(`Expected ${expectedCount.toLocaleString("en-US")} records but found ${records.length.toLocaleString("en-US")}. Pass --allow-count-mismatch only after reviewing the input.`);
}

const sourceIds = new Set();
const slugs = new Set();
for (const [index, record] of records.entries()) {
  const required = [record.sourceId, record.slug, record.title, record.embedUrl, record.thumbnailUrl, record.publishedAt];
  if (required.some((value) => !String(value ?? "").trim())) throw new Error(`Record ${index + 1} is missing required production metadata.`);
  if (!Array.isArray(record.collections) || !record.collections.length) throw new Error(`Record ${index + 1} has no curated collection.`);
  if (sourceIds.has(String(record.sourceId))) throw new Error(`Duplicate source ID: ${record.sourceId}`);
  if (slugs.has(record.slug)) throw new Error(`Duplicate slug: ${record.slug}`);
  sourceIds.add(String(record.sourceId));
  slugs.add(record.slug);
}

const digest = createHash("sha256").update(source).digest("hex");
const version = digest.slice(0, 16);
const estimatedCompressed = gzipSync(source).byteLength;
console.log("Pornhub production sync plan");
console.log(`Input: ${inputPath}`);
console.log(`Records: ${records.length.toLocaleString("en-US")}`);
console.log(`Version: ${version}`);
console.log(`Raw / estimated gzip: ${(Buffer.byteLength(source) / 1024 ** 2).toFixed(2)} MiB / ${(estimatedCompressed / 1024 ** 2).toFixed(2)} MiB`);
console.log(`D1: ${Math.ceil(records.length / d1BatchSize).toLocaleString("en-US")} batched HTTP request(s), ${records.length.toLocaleString("en-US")} idempotent row upserts`);
console.log(`Redis: ${Math.ceil(records.length / redisChunkSize).toLocaleString("en-US")} compressed chunks plus one manifest`);
if (!execute) {
  console.log("Dry run complete. Add --execute to mutate D1 and Upstash.");
  process.exit(0);
}

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID?.trim();
const apiToken = process.env.CLOUDFLARE_D1_API_TOKEN?.trim();
const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.trim().replace(/\/$/, "");
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
if (!accountId || !databaseId || !apiToken) throw new Error("Cloudflare D1 variables are missing from .env.local.");
if (!redisUrl || !redisToken) throw new Error("Upstash Redis variables are missing from .env.local.");

async function d1(body) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/d1/database/${encodeURIComponent(databaseId)}/query`, {
    method: "POST",
    headers: { authorization: `Bearer ${apiToken}`, "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  const payload = await response.json();
  const results = payload.result ?? [];
  if (!response.ok || !payload.success || results.some((item) => !item.success)) {
    throw new Error(payload.errors?.[0]?.message || results.find((item) => !item.success)?.error || `D1 returned HTTP ${response.status}`);
  }
  return results;
}

async function redisPipeline(commands) {
  const response = await fetch(`${redisUrl}/pipeline`, {
    method: "POST",
    headers: { authorization: `Bearer ${redisToken}`, "content-type": "application/json" },
    body: JSON.stringify(commands),
    signal: AbortSignal.timeout(60_000),
  });
  const payload = await response.json();
  if (!response.ok || !Array.isArray(payload) || payload.some((item) => item.error)) {
    throw new Error(payload?.find?.((item) => item.error)?.error || `Upstash returned HTTP ${response.status}`);
  }
  return payload;
}

await d1({ sql: `CREATE TABLE IF NOT EXISTS pornhub_catalog_videos (
  source_id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  published_at TEXT NOT NULL,
  collections_json TEXT NOT NULL,
  popularity_rank INTEGER NOT NULL,
  sync_version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)` });
await d1({ sql: "CREATE INDEX IF NOT EXISTS idx_pornhub_catalog_version_status ON pornhub_catalog_videos(sync_version, status, popularity_rank)" });

let state = {};
try { state = JSON.parse(await readFile(statePath, "utf8")); } catch { state = {}; }
let offset = state.digest === digest ? Math.max(0, Number(state.d1Offset ?? 0)) : 0;
const upsertSql = `INSERT INTO pornhub_catalog_videos(source_id, slug, title, payload_json, published_at, collections_json, popularity_rank, sync_version, status)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
  ON CONFLICT(source_id) DO UPDATE SET slug=excluded.slug, title=excluded.title, payload_json=excluded.payload_json,
  published_at=excluded.published_at, collections_json=excluded.collections_json, popularity_rank=excluded.popularity_rank,
  sync_version=excluded.sync_version, status='active', updated_at=CURRENT_TIMESTAMP`;

await mkdir(path.dirname(statePath), { recursive: true });
while (offset < records.length) {
  const batch = records.slice(offset, offset + d1BatchSize).map((record, relativeIndex) => ({
    sql: upsertSql,
    params: [String(record.sourceId), record.slug, record.title, JSON.stringify(record), record.publishedAt, JSON.stringify(record.collections), Number(record.popularityRank ?? offset + relativeIndex + 1), version],
  }));
  await d1({ batch });
  offset += batch.length;
  await writeFile(statePath, `${JSON.stringify({ digest, version, d1Offset: offset, records: records.length, updatedAt: new Date().toISOString() }, null, 2)}\n`, "utf8");
  console.log(`D1 ${offset.toLocaleString("en-US")}/${records.length.toLocaleString("en-US")}`);
  if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
}
await d1({ sql: "UPDATE pornhub_catalog_videos SET status='inactive', updated_at=CURRENT_TIMESTAMP WHERE sync_version <> ? AND status='active'", params: [version] });

const manifestKey = "actrexx:pornhub:catalog:manifest";
let previousManifest = null;
try {
  const previous = await redisPipeline([["GET", manifestKey]]);
  if (previous[0]?.result) previousManifest = JSON.parse(previous[0].result);
} catch { previousManifest = null; }

const chunks = [];
for (let offsetIndex = 0; offsetIndex < records.length; offsetIndex += redisChunkSize) {
  const chunkRecords = records.slice(offsetIndex, offsetIndex + redisChunkSize);
  const serialized = chunkRecords.map((record) => JSON.stringify(record)).join("\n");
  const value = `gz:${gzipSync(serialized).toString("base64")}`;
  const key = `actrexx:pornhub:catalog:${version}:${chunks.length}`;
  chunks.push({ key, value, records: chunkRecords.length, bytes: Buffer.byteLength(value) });
}
for (let index = 0; index < chunks.length; index += 8) {
  const group = chunks.slice(index, index + 8);
  const requestBytes = group.reduce((sum, item) => sum + item.bytes, 0);
  if (requestBytes > 8 * 1024 * 1024) throw new Error("Redis pipeline would exceed the safe 8 MiB request budget. Lower --redis-chunk.");
  await redisPipeline(group.map((item) => ["SET", item.key, item.value]));
  console.log(`Redis chunks ${Math.min(index + group.length, chunks.length)}/${chunks.length}`);
}
const manifest = {
  schema: 1,
  version,
  digest,
  records: records.length,
  chunks: chunks.map((item) => item.key),
  publishedAt: new Date().toISOString(),
};
await redisPipeline([["SET", manifestKey, JSON.stringify(manifest)]]);

if (previousManifest?.version && previousManifest.version !== version && Array.isArray(previousManifest.chunks)) {
  for (let index = 0; index < previousManifest.chunks.length; index += 100) {
    await redisPipeline([["DEL", ...previousManifest.chunks.slice(index, index + 100)]]);
  }
}
await writeFile(statePath, `${JSON.stringify({ digest, version, d1Offset: records.length, records: records.length, redisPublished: true, completedAt: new Date().toISOString() }, null, 2)}\n`, "utf8");
console.log(`Production sync complete: ${records.length.toLocaleString("en-US")} records, version ${version}.`);
