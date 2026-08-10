#!/usr/bin/env node

import { closeSync, createReadStream, existsSync, openSync, readSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

for (const envFile of [".env.r2", ".env.local"]) {
  if (existsSync(envFile)) process.loadEnvFile(envFile);
}

const options = parseOptions(process.argv.slice(2));
const execute = Boolean(options.execute);
const verify = Boolean(options.verify);
const force = Boolean(options.force);
const concurrency = positiveInteger(options.concurrency, 12, "--concurrency");
if (concurrency > 32) throw new Error("--concurrency cannot exceed 32.");
const catalogPath = path.resolve(options.catalog ?? "data/staging/videocelebs/catalog.json");
const previewRoot = path.resolve(options.out ?? "storage/previews");
const records = JSON.parse(await readFile(catalogPath, "utf8"));
const items = [];
const seenKeys = new Set();
const missingLocal = [];

for (const record of records) {
  const key = String(record.thumbnailKey ?? "");
  if (!/^previews\/v1\/\d{3}\/\d+\/poster$/.test(key)) throw new Error(`Invalid R2 key for source ${record.id}.`);
  if (seenKeys.has(key)) throw new Error(`Duplicate R2 key: ${key}`);
  seenKeys.add(key);
  const file = path.resolve(previewRoot, key.replace(/^previews\/v1\//, ""));
  if (!file.startsWith(`${previewRoot}${path.sep}`)) throw new Error(`Local media path escaped preview root for ${record.id}.`);
  try {
    const details = statSync(file);
    if (!details.isFile() || details.size === 0) throw new Error("not a non-empty file");
    items.push({
      id: Number(record.id),
      key,
      file,
      size: details.size,
      contentType: record.thumbnailContentType || detectContentType(file),
      sha256: record.thumbnailSha256 || "unknown",
    });
  } catch (error) {
    if (error.code !== "ENOENT" && error.message !== "not a non-empty file") throw error;
    missingLocal.push({ id: record.id, key });
  }
}

const totalBytes = items.reduce((sum, item) => sum + item.size, 0);
console.log(`Local plan: ${items.length} objects, ${formatBytes(totalBytes)}, ${missingLocal.length} missing.`);
if (missingLocal.length) throw new Error(`Local catalog/image parity failed. Repair missing thumbnails before R2 upload (first missing: ${missingLocal[0].key}).`);
if (!execute && !verify) {
  console.log("Dry run complete. Use --execute to upload or --verify to compare with R2.");
  process.exit(0);
}

const config = r2Config();
const client = new S3Client({
  region: "auto",
  endpoint: config.endpoint,
  credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
});

let remote = await listRemote(client, config.bucket);
console.log(`Remote before: ${remote.size} objects under previews/v1/.`);

if (execute) {
  const pending = force ? items : items.filter((item) => remote.get(item.key) !== item.size);
  const skipped = items.length - pending.length;
  console.log(`Upload queue: ${pending.length}; already matching by key and size: ${skipped}.`);
  let completed = 0;
  const failures = [];
  await runPool(pending, concurrency, async (item) => {
    try {
      await client.send(new PutObjectCommand({
        Bucket: config.bucket,
        Key: item.key,
        Body: createReadStream(item.file),
        ContentLength: item.size,
        ContentType: item.contentType,
        CacheControl: "public, max-age=31536000, immutable",
        Metadata: { "source-id": String(item.id), sha256: item.sha256 },
      }));
      completed += 1;
      if (completed % 250 === 0 || completed === pending.length) console.log(`Uploaded ${completed}/${pending.length}.`);
    } catch (error) {
      failures.push({ key: item.key, error: error.message });
      console.error(`FAILED ${item.key}: ${error.message}`);
    }
  });
  console.log(`Upload complete: ${completed} uploaded, ${skipped} skipped, ${failures.length} failed.`);
  if (failures.length) process.exitCode = 1;
  remote = await listRemote(client, config.bucket);
}

const localByKey = new Map(items.map((item) => [item.key, item.size]));
const missingRemote = items.filter((item) => !remote.has(item.key));
const sizeMismatch = items.filter((item) => remote.has(item.key) && remote.get(item.key) !== item.size);
const extraRemote = [...remote.keys()].filter((key) => !localByKey.has(key));
const remoteBytes = [...remote.values()].reduce((sum, size) => sum + size, 0);
console.log(`R2 verification: ${remote.size} objects, ${formatBytes(remoteBytes)}; missing ${missingRemote.length}; size mismatch ${sizeMismatch.length}; extra ${extraRemote.length}.`);
if (missingRemote.length || sizeMismatch.length) process.exitCode = 1;

function parseOptions(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    if (["--execute", "--verify", "--force"].includes(option)) parsed[option.slice(2)] = true;
    else if (["--catalog", "--out", "--concurrency"].includes(option)) parsed[option.slice(2)] = argv[++index];
    else throw new Error(`Unknown argument: ${option}`);
  }
  return parsed;
}

function positiveInteger(value, fallback, label) {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${label} must be a positive integer.`);
  return parsed;
}

function r2Config() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_BUCKET_NAME?.trim();
  const missing = [
    ["CLOUDFLARE_ACCOUNT_ID", accountId],
    ["R2_ACCESS_KEY_ID", accessKeyId],
    ["R2_SECRET_ACCESS_KEY", secretAccessKey],
    ["R2_BUCKET_NAME", bucket],
  ].filter(([, value]) => !value).map(([name]) => name);
  if (missing.length) throw new Error(`Missing R2 configuration: ${missing.join(", ")}. Copy .env.r2.example to .env.r2 and fill it in.`);
  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    endpoint: process.env.R2_ENDPOINT?.trim() || `https://${accountId}.r2.cloudflarestorage.com`,
  };
}

async function listRemote(client, bucket) {
  const objects = new Map();
  let continuationToken;
  do {
    const page = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: "previews/v1/", ContinuationToken: continuationToken }));
    for (const object of page.Contents ?? []) {
      if (object.Key && Number.isFinite(Number(object.Size))) objects.set(object.Key, Number(object.Size));
    }
    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (continuationToken);
  return objects;
}

async function runPool(items, size, worker) {
  let cursor = 0;
  async function consume() {
    while (cursor < items.length) await worker(items[cursor++]);
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length || 1) }, consume));
}

function detectContentType(file) {
  const descriptor = openSync(file, "r");
  try {
    const buffer = Buffer.alloc(12);
    readSync(descriptor, buffer, 0, buffer.length, 0);
    if (buffer[0] === 0xff && buffer[1] === 0xd8) return "image/jpeg";
    if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
    throw new Error(`Unsupported image content: ${file}`);
  } finally {
    closeSync(descriptor);
  }
}

function formatBytes(bytes) {
  return `${(bytes / 1_000_000_000).toFixed(3)} GB (${(bytes / 1_073_741_824).toFixed(3)} GiB)`;
}
