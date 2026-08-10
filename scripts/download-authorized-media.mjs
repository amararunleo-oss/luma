#!/usr/bin/env node

/**
 * Downloads only explicitly approved media URLs from a user-supplied manifest.
 *
 * This is intentionally not a crawler: it does not discover links, copy pages,
 * use cookies, bypass access controls, or download entries without rights data.
 */

import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { access, mkdir, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";

const HELP = `
Authorized media downloader

Usage:
  npm run media:download -- \\
    --manifest authorized-media.json \\
    --out downloads \\
    --allow-host media.your-domain.example \\
    --execute

Options:
  --manifest <file>       JSON manifest path (required)
  --out <directory>       Output directory (default: ./authorized-downloads)
  --allow-host <host>     Allowed HTTPS hostname; repeat for multiple hosts
  --max-mb <number>       Per-file limit in MiB (default: 500)
  --concurrency <number>  Parallel downloads, 1-6 (default: 3)
  --execute               Perform downloads; otherwise validation-only dry run
  --help                  Show this help

Each manifest item must include:
  id, url, filename, mediaType (video|image|audio), and license fields:
  approved=true, type, rightsholder, proof.
`;

function parseArgs(argv) {
  const result = {
    manifest: "",
    out: "authorized-downloads",
    allowedHosts: [],
    maxMb: 500,
    concurrency: 3,
    execute: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--execute") result.execute = true;
    else if (arg === "--help" || arg === "-h") result.help = true;
    else if (arg === "--manifest") result.manifest = argv[++index] ?? "";
    else if (arg === "--out") result.out = argv[++index] ?? "";
    else if (arg === "--allow-host") result.allowedHosts.push((argv[++index] ?? "").toLowerCase());
    else if (arg === "--max-mb") result.maxMb = Number(argv[++index]);
    else if (arg === "--concurrency") result.concurrency = Number(argv[++index]);
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return result;
}

function validateOptions(options) {
  if (!options.manifest) throw new Error("--manifest is required.");
  if (!options.out) throw new Error("--out must not be empty.");
  if (options.allowedHosts.length === 0) {
    throw new Error("At least one --allow-host is required.");
  }
  if (options.allowedHosts.some((host) => !/^[a-z0-9.-]+$/.test(host))) {
    throw new Error("Every --allow-host must be a hostname without a scheme or path.");
  }
  if (!Number.isFinite(options.maxMb) || options.maxMb <= 0) {
    throw new Error("--max-mb must be a positive number.");
  }
  if (!Number.isInteger(options.concurrency) || options.concurrency < 1 || options.concurrency > 6) {
    throw new Error("--concurrency must be an integer from 1 to 6.");
  }
}

function displayUrl(value) {
  const url = new URL(value);
  return `${url.protocol}//${url.host}${url.pathname}`;
}

function isAllowedHost(hostname, allowedHosts) {
  const normalized = hostname.toLowerCase();
  return allowedHosts.some(
    (allowed) => normalized === allowed || normalized.endsWith(`.${allowed}`),
  );
}

function validateItem(item, index, allowedHosts, outputRoot) {
  const label = `items[${index}]`;
  if (!item || typeof item !== "object") throw new Error(`${label} must be an object.`);
  for (const field of ["id", "url", "filename", "mediaType"]) {
    if (typeof item[field] !== "string" || !item[field].trim()) {
      throw new Error(`${label}.${field} is required.`);
    }
  }

  if (!item.license || item.license.approved !== true) {
    throw new Error(`${label}.license.approved must be true.`);
  }
  for (const field of ["type", "rightsholder", "proof"]) {
    if (typeof item.license[field] !== "string" || !item.license[field].trim()) {
      throw new Error(`${label}.license.${field} is required.`);
    }
  }

  if (!["video", "image", "audio"].includes(item.mediaType)) {
    throw new Error(`${label}.mediaType must be video, image, or audio.`);
  }

  let sourceUrl;
  try {
    sourceUrl = new URL(item.url);
  } catch {
    throw new Error(`${label}.url is not a valid URL.`);
  }
  if (sourceUrl.protocol !== "https:") throw new Error(`${label}.url must use HTTPS.`);
  if (!isAllowedHost(sourceUrl.hostname, allowedHosts)) {
    throw new Error(`${label}.url host is not allowlisted: ${sourceUrl.hostname}`);
  }

  if (path.isAbsolute(item.filename)) throw new Error(`${label}.filename must be relative.`);
  const destination = path.resolve(outputRoot, item.filename);
  const rootPrefix = `${outputRoot}${path.sep}`;
  if (!destination.startsWith(rootPrefix)) {
    throw new Error(`${label}.filename escapes the output directory.`);
  }

  if (item.sha256 && !/^[a-f0-9]{64}$/i.test(item.sha256)) {
    throw new Error(`${label}.sha256 must be a 64-character hex digest.`);
  }

  return { ...item, sourceUrl, destination };
}

async function loadManifest(filePath, allowedHosts, outputRoot) {
  const source = await readFile(filePath, "utf8");
  const manifest = JSON.parse(source);
  if (manifest.version !== 1) throw new Error("Manifest version must be 1.");
  if (!Array.isArray(manifest.items) || manifest.items.length === 0) {
    throw new Error("Manifest must contain a non-empty items array.");
  }

  const ids = new Set();
  const destinations = new Set();
  return manifest.items.map((item, index) => {
    const validated = validateItem(item, index, allowedHosts, outputRoot);
    if (ids.has(validated.id)) throw new Error(`Duplicate id: ${validated.id}`);
    if (destinations.has(validated.destination)) {
      throw new Error(`Duplicate destination: ${validated.filename}`);
    }
    ids.add(validated.id);
    destinations.add(validated.destination);
    return validated;
  });
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function fetchAllowed(url, allowedHosts, redirectCount = 0) {
  if (redirectCount > 5) throw new Error("Too many redirects.");
  if (!isAllowedHost(url.hostname, allowedHosts)) {
    throw new Error(`Redirected to a non-allowlisted host: ${url.hostname}`);
  }

  const response = await fetch(url, {
    method: "GET",
    redirect: "manual",
    credentials: "omit",
    headers: {
      Accept: "video/*, image/*, audio/*, application/octet-stream;q=0.5",
      "User-Agent": "AuthorizedMediaDownloader/1.0",
    },
  });

  if ([301, 302, 303, 307, 308].includes(response.status)) {
    const location = response.headers.get("location");
    if (!location) throw new Error(`Redirect ${response.status} has no Location header.`);
    const nextUrl = new URL(location, url);
    if (nextUrl.protocol !== "https:") throw new Error("Redirect downgraded from HTTPS.");
    return fetchAllowed(nextUrl, allowedHosts, redirectCount + 1);
  }

  return response;
}

function expectedMimePrefix(mediaType) {
  return `${mediaType}/`;
}

async function downloadItem(item, options) {
  if (await exists(item.destination)) {
    throw new Error(`Refusing to overwrite ${item.filename}`);
  }

  await mkdir(path.dirname(item.destination), { recursive: true });
  const partial = `${item.destination}.part-${process.pid}`;
  const maxBytes = Math.floor(options.maxMb * 1024 * 1024);

  try {
    const response = await fetchAllowed(item.sourceUrl, options.allowedHosts);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (!response.body) throw new Error("Response has no body.");

    const contentType = (response.headers.get("content-type") ?? "")
      .split(";", 1)[0]
      .trim()
      .toLowerCase();
    if (contentType && contentType !== "application/octet-stream" && !contentType.startsWith(expectedMimePrefix(item.mediaType))) {
      throw new Error(`Unexpected content type: ${contentType}`);
    }

    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (contentLength > maxBytes) {
      throw new Error(`Content-Length exceeds ${options.maxMb} MiB.`);
    }

    let received = 0;
    const hash = createHash("sha256");
    const meter = new Transform({
      transform(chunk, _encoding, callback) {
        received += chunk.length;
        if (received > maxBytes) {
          callback(new Error(`Download exceeded ${options.maxMb} MiB.`));
          return;
        }
        hash.update(chunk);
        callback(null, chunk);
      },
    });

    await pipeline(response.body, meter, createWriteStream(partial, { flags: "wx" }));
    const digest = hash.digest("hex");
    if (item.sha256 && digest.toLowerCase() !== item.sha256.toLowerCase()) {
      throw new Error("SHA-256 verification failed.");
    }

    await rename(partial, item.destination);
    return { bytes: received, sha256: digest };
  } catch (error) {
    await rm(partial, { force: true });
    throw error;
  }
}

async function runPool(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;

  async function runWorker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      try {
        results[index] = { ok: true, value: await worker(items[index], index) };
      } catch (error) {
        results[index] = { ok: false, error };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runWorker));
  return results;
}

function formatBytes(bytes) {
  const units = ["B", "KiB", "MiB", "GiB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(HELP);
    return;
  }
  validateOptions(options);

  const outputRoot = path.resolve(options.out);
  const manifestPath = path.resolve(options.manifest);
  const items = await loadManifest(manifestPath, options.allowedHosts, outputRoot);

  console.log(`Validated ${items.length} approved manifest item(s).`);
  for (const item of items) {
    console.log(`- ${item.id}: ${displayUrl(item.url)} -> ${item.filename}`);
  }

  if (!options.execute) {
    console.log("\nDry run only. Add --execute to download after reviewing the plan.");
    return;
  }

  await mkdir(outputRoot, { recursive: true });
  const results = await runPool(items, options.concurrency, async (item) => {
    console.log(`Downloading ${item.id}...`);
    return downloadItem(item, options);
  });

  let failed = 0;
  results.forEach((result, index) => {
    const item = items[index];
    if (result.ok) {
      console.log(`OK ${item.id}: ${formatBytes(result.value.bytes)}, sha256=${result.value.sha256}`);
    } else {
      failed += 1;
      console.error(`FAILED ${item.id}: ${result.error?.message ?? result.error}`);
    }
  });

  if (failed > 0) {
    throw new Error(`${failed} download(s) failed.`);
  }
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
});
