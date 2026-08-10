#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const options = parseOptions(process.argv.slice(2));
const catalogPath = path.resolve(options.catalog ?? "data/staging/videocelebs/catalog.json");
const jsonlPath = catalogPath.replace(/\.json$/i, ".jsonl");
const outputRoot = path.resolve(options.out ?? "storage/previews");
const execute = Boolean(options.execute);
const concurrency = positiveInteger(options.concurrency, 3, "--concurrency");
const delayMs = positiveInteger(options["delay-ms"], 500, "--delay-ms");
if (concurrency > 6) throw new Error("--concurrency cannot exceed 6.");
if (delayMs < 250) throw new Error("--delay-ms must be at least 250.");

const records = JSON.parse(await readFile(catalogPath, "utf8"));
const candidates = [];
for (const record of records) {
  const destination = destinationFor(record);
  const missing = !(await exists(destination));
  if (record.thumbnailStatus === "failed" || missing) candidates.push({ record, destination });
}

console.log(`Found ${candidates.length} thumbnail fallback candidate(s).`);
if (!execute) {
  for (const { record } of candidates) console.log(`${record.id}: ${record.sourceListingImageUrl ?? "missing listing fallback URL"}`);
  console.log("Dry run complete. Add --execute to download safe listing fallbacks and update both catalog files.");
  process.exit(0);
}

const results = await runPool(candidates, concurrency, async ({ record, destination }) => {
  const sourceUrl = fallbackUrlFor(record);
  const existing = await readFile(destination).catch((error) => error.code === "ENOENT" ? null : Promise.reject(error));
  if (existing) return { record, metadata: validateImage(existing), status: "existing", sourceUrl };

  const response = await fetchWithRetry(sourceUrl, record.sourcePageUrl);
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > 5 * 1024 * 1024) throw new Error("Fallback image exceeded 5 MiB.");
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > 5 * 1024 * 1024) throw new Error("Fallback image exceeded 5 MiB.");
  const metadata = validateImage(buffer);
  await mkdir(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.part-${process.pid}`;
  try {
    await writeFile(temporary, buffer, { flag: "wx" });
    await rename(temporary, destination);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
  return { record, metadata, status: "downloaded", sourceUrl };
});

let repaired = 0;
let failed = 0;
const byId = new Map(records.map((record) => [Number(record.id), record]));
for (const result of results) {
  if (!result.ok) {
    failed += 1;
    console.error(`FAILED ${result.item.record.id}: ${result.error.message}`);
    continue;
  }
  const { record, metadata, status, sourceUrl } = result.value;
  byId.set(Number(record.id), {
    ...record,
    thumbnailStatus: status,
    thumbnailError: null,
    thumbnailWidth: metadata.width,
    thumbnailHeight: metadata.height,
    thumbnailBytes: metadata.bytes,
    thumbnailContentType: metadata.contentType,
    thumbnailSha256: metadata.sha256,
    thumbnailSourceUrl: sourceUrl,
    thumbnailVariant: "listing_fallback",
    thumbnailRepairedAt: new Date().toISOString(),
  });
  repaired += 1;
  console.log(`OK ${record.id}: ${metadata.width}x${metadata.height} ${status}`);
}

const updated = records.map((record) => byId.get(Number(record.id)));
await writeAtomic(catalogPath, `${JSON.stringify(updated, null, 2)}\n`);
await writeAtomic(jsonlPath, `${updated.map((record) => JSON.stringify(record)).join("\n")}\n`);
console.log(`Repaired ${repaired} thumbnail(s); ${failed} remain failed.`);
if (failed > 0) process.exitCode = 1;

function parseOptions(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const option = argv[index];
    if (option === "--execute") parsed.execute = true;
    else if (["--catalog", "--out", "--concurrency", "--delay-ms"].includes(option)) parsed[option.slice(2)] = argv[++index];
    else throw new Error(`Unknown argument: ${option}`);
  }
  return parsed;
}

function positiveInteger(value, fallback, label) {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${label} must be a positive integer.`);
  return parsed;
}

function destinationFor(record) {
  if (!/^previews\/v1\/\d{3}\/\d+\/poster$/.test(record.thumbnailKey ?? "")) throw new Error(`Invalid thumbnail key for ${record.id}.`);
  const destination = path.resolve(outputRoot, record.thumbnailKey.replace(/^previews\/v1\//, ""));
  if (!destination.startsWith(`${outputRoot}${path.sep}`)) throw new Error(`Thumbnail destination escaped output root for ${record.id}.`);
  return destination;
}

function fallbackUrlFor(record) {
  const url = new URL(record.sourceListingImageUrl);
  if (url.protocol !== "https:" || url.hostname !== "videocelebs.net") throw new Error(`Fallback URL escaped the authorized source for ${record.id}.`);
  const expected = new RegExp(`^/contents/videos_screenshots/\\d+/${record.id}/280x210/[^/]+\\.(?:jpe?g|webp)$`, "i");
  if (!expected.test(url.pathname)) throw new Error(`Listing fallback path does not match source ID ${record.id}.`);
  return url.href;
}

async function fetchWithRetry(url, referer) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    await wait(delayMs);
    try {
      const response = await fetch(url, {
        redirect: "follow",
        signal: AbortSignal.timeout(30_000),
        headers: { Accept: "image/webp,image/jpeg;q=0.9", Referer: referer, "User-Agent": "LumaAuthorizedCatalogRepair/1.0" },
      });
      if (response.ok) {
        const finalUrl = new URL(response.url);
        if (finalUrl.protocol !== "https:" || finalUrl.hostname !== "videocelebs.net") throw new Error("Fallback redirect escaped the authorized source.");
        return response;
      }
      lastError = new Error(`HTTP ${response.status} for ${url}`);
      if (![408, 425, 429, 500, 502, 503, 504].includes(response.status)) throw lastError;
      await response.body?.cancel();
    } catch (error) {
      lastError = error;
      if (attempt === 4) break;
    }
    await wait(Math.min(15_000, 1000 * (2 ** (attempt - 1))));
  }
  throw lastError;
}

function validateImage(buffer) {
  const dimensions = jpegDimensions(buffer) ?? webpDimensions(buffer);
  if (!dimensions) throw new Error("Fallback is not a supported JPEG or WebP image.");
  if (dimensions.width < 280 || dimensions.height < 150) throw new Error(`Fallback dimensions are unexpectedly small (${dimensions.width}x${dimensions.height}).`);
  return {
    ...dimensions,
    bytes: buffer.length,
    contentType: buffer[0] === 0xff && buffer[1] === 0xd8 ? "image/jpeg" : "image/webp",
    sha256: createHash("sha256").update(buffer).digest("hex"),
  };
}

function jpegDimensions(buffer) {
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) { offset += 1; continue; }
    const marker = buffer[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (offset + 2 > buffer.length) break;
    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) break;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return { width: buffer.readUInt16BE(offset + 5), height: buffer.readUInt16BE(offset + 3) };
    }
    offset += length;
  }
  return null;
}

function webpDimensions(buffer) {
  if (buffer.subarray(0, 4).toString("ascii") !== "RIFF" || buffer.subarray(8, 12).toString("ascii") !== "WEBP") return null;
  const chunk = buffer.subarray(12, 16).toString("ascii");
  if (chunk === "VP8 " && buffer.length >= 30 && buffer[23] === 0x9d && buffer[24] === 0x01 && buffer[25] === 0x2a) return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
  if (chunk === "VP8L" && buffer.length >= 25 && buffer[20] === 0x2f) {
    const bits = buffer.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (chunk === "VP8X" && buffer.length >= 30) return { width: 1 + buffer[24] + (buffer[25] << 8) + (buffer[26] << 16), height: 1 + buffer[27] + (buffer[28] << 8) + (buffer[29] << 16) };
  return null;
}

async function runPool(items, size, worker) {
  let cursor = 0;
  const results = new Array(items.length);
  async function consume() {
    while (cursor < items.length) {
      const index = cursor++;
      try { results[index] = { ok: true, value: await worker(items[index]), item: items[index] }; }
      catch (error) { results[index] = { ok: false, error, item: items[index] }; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, consume));
  return results;
}

async function writeAtomic(file, contents) {
  const temporary = `${file}.tmp-${process.pid}`;
  await writeFile(temporary, contents, "utf8");
  await rename(temporary, file);
}

async function exists(file) {
  try { return (await stat(file)).isFile(); }
  catch (error) { if (error.code === "ENOENT") return false; throw error; }
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
