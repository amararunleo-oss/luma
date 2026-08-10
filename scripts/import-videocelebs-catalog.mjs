#!/usr/bin/env node

/**
 * Imports authorized VideoCelebs metadata and one canonical wide preview image per video.
 *
 * Deliberately excluded:
 * - video files and get_file URLs
 * - iframe screenshots
 * - preview sprite/contact-sheet images (the single player poster is allowed)
 * - hotlinking in the application
 */

import { appendFile, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";

const SOURCE_ORIGIN = "https://videocelebs.net";
const DEFAULT_OUT = "storage/previews";
const DEFAULT_CATALOG = "data/staging/videocelebs/catalog.jsonl";
let minimumRequestIntervalMs = 1500;
let nextRequestAt = 0;
let requestGate = Promise.resolve();

const HELP = `
Authorized VideoCelebs catalog importer

Usage:
  npm run catalog:import -- --listing popular --pages 1 --limit 10 --execute
  npm run catalog:import -- --listing new --pages all --execute --resume
  npm run catalog:import -- --listing top-rated --pages all --execute --resume

Options:
  --listing <name>         new, popular or top-rated (default: new)
  --start-page <number>    First listing page (default: 1)
  --pages <number|all>     Number of pages (default: 1)
  --limit <number>         Stop after this many new/updated records
  --delay-ms <number>      Delay between listing requests (default: 1500)
  --concurrency <number>   Parallel preview downloads, 1-4 (default: 3)
  --details                Fetch detail metadata (enabled by default)
  --no-details             Listing-only audit; cannot be used with --execute
  --listings-only          Write ranking/listing order for already imported records
  --resume                 Continue after the last completed page in state.json
  --out <directory>        Canonical preview folder (default: ${DEFAULT_OUT})
  --catalog <file>         Append-only JSONL catalog (default: ${DEFAULT_CATALOG})
  --execute                Download previews and write catalog
  --help                   Show this help

Without --execute the importer fetches and validates listings but does not write files.
`;

function parseArgs(argv) {
  const options = {
    listing: "new",
    startPage: 1,
    pages: "1",
    limit: null,
    delayMs: 1500,
    concurrency: 3,
    out: DEFAULT_OUT,
    catalog: DEFAULT_CATALOG,
    execute: false,
    details: true,
    listingsOnly: false,
    resume: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--execute") options.execute = true;
    else if (arg === "--details") options.details = true;
    else if (arg === "--no-details") options.details = false;
    else if (arg === "--listings-only") { options.listingsOnly = true; options.details = false; }
    else if (arg === "--resume") options.resume = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--listing") options.listing = argv[++index] ?? "";
    else if (arg === "--start-page") options.startPage = Number(argv[++index]);
    else if (arg === "--pages") options.pages = argv[++index] ?? "";
    else if (arg === "--limit") options.limit = Number(argv[++index]);
    else if (arg === "--delay-ms") options.delayMs = Number(argv[++index]);
    else if (arg === "--concurrency") options.concurrency = Number(argv[++index]);
    else if (arg === "--out") options.out = argv[++index] ?? "";
    else if (arg === "--catalog") options.catalog = argv[++index] ?? "";
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (!['new', 'popular', 'top-rated'].includes(options.listing)) throw new Error("--listing must be new, popular or top-rated.");
  if (!Number.isInteger(options.startPage) || options.startPage < 1) throw new Error("--start-page must be a positive integer.");
  if (options.pages !== "all" && (!Number.isInteger(Number(options.pages)) || Number(options.pages) < 1)) {
    throw new Error("--pages must be a positive integer or all.");
  }
  if (options.limit !== null && (!Number.isInteger(options.limit) || options.limit < 1)) throw new Error("--limit must be a positive integer.");
  if (!Number.isInteger(options.delayMs) || options.delayMs < 500) throw new Error("--delay-ms must be at least 500.");
  if (!Number.isInteger(options.concurrency) || options.concurrency < 1 || options.concurrency > 4) throw new Error("--concurrency must be from 1 to 4.");
  if (!options.out || !options.catalog) throw new Error("Output paths must not be empty.");
  if (options.execute && !options.details && !options.listingsOnly) {
    throw new Error("--execute requires detail metadata unless --listings-only is used.");
  }
  return options;
}

function decodeHtml(value) {
  const named = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  const decoded = value
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (_match, entity) => {
      if (entity[0] === "#") {
        const hex = entity[1]?.toLowerCase() === "x";
        const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : "";
      }
      return named[entity.toLowerCase()] ?? `&${entity};`;
    });
  const replacements = new Map([
    ["â€“", "–"],
    ["â€”", "—"],
    ["â€™", "’"],
    ["â€˜", "‘"],
    ["â€œ", "“"],
    ["â€", "”"],
    ["Â ", " "],
    ["Â", ""],
  ]);
  let repaired = decoded;
  for (const [broken, correct] of replacements) repaired = repaired.replaceAll(broken, correct);
  if (/Ã[\x80-\xBF]/.test(repaired)) {
    const latin1Repair = Buffer.from(repaired, "latin1").toString("utf8");
    const badness = (text) => (text.match(/[ÃÂâ�]/g) ?? []).length;
    if (!latin1Repair.includes("�") && badness(latin1Repair) < badness(repaired)) repaired = latin1Repair;
  }
  return repaired.replace(/\s+/g, " ").trim();
}

function listingUrl(listing, page) {
  if (listing === "popular") {
    return page === 1 ? `${SOURCE_ORIGIN}/most-popular` : `${SOURCE_ORIGIN}/most-popular/page/${page}`;
  }
  if (listing === "top-rated") {
    return page === 1 ? `${SOURCE_ORIGIN}/top-rated` : `${SOURCE_ORIGIN}/top-rated/page/${page}`;
  }
  return page === 1 ? `${SOURCE_ORIGIN}/` : `${SOURCE_ORIGIN}/page/${page}`;
}

function listingKey(listing) {
  if (listing === "new") return "latest";
  return listing.replace("-", "_");
}

function listingPageSize(listing) {
  return listing === "new" ? 10 : 20;
}

function safeSourceUrl(value, purpose) {
  const url = new URL(value, SOURCE_ORIGIN);
  if (url.protocol !== "https:" || url.hostname !== "videocelebs.net") {
    throw new Error(`${purpose} escaped the authorized source host.`);
  }
  if (/\/get_file\/|\.mp4(?:\/|\?|$)/i.test(url.pathname)) {
    throw new Error(`${purpose} points to an excluded video asset.`);
  }
  return url;
}

async function waitForRequestSlot() {
  const previous = requestGate;
  let release;
  requestGate = new Promise((resolve) => { release = resolve; });
  await previous;
  const remaining = Math.max(0, nextRequestAt - Date.now());
  if (remaining > 0) await wait(remaining);
  nextRequestAt = Date.now() + minimumRequestIntervalMs;
  release();
}

async function fetchSource(url, accept, { referer } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    await waitForRequestSlot();
    try {
      const response = await fetch(url, {
        redirect: "follow",
        signal: AbortSignal.timeout(30_000),
        headers: {
          Accept: accept,
          ...(referer ? { Referer: referer } : {}),
          "User-Agent": "LumaAuthorizedCatalogImporter/2.0",
        },
      });
      if (response.ok) {
        safeSourceUrl(response.url, "Redirect");
        return response;
      }
      lastError = new Error(`HTTP ${response.status} for ${url}`);
      if (![408, 425, 429, 500, 502, 503, 504].includes(response.status)) throw lastError;
      await response.body?.cancel();
    } catch (error) {
      lastError = error;
      if (attempt === 4) throw error;
    }
    await wait(Math.min(30_000, 1000 * (2 ** (attempt - 1))));
  }
  throw lastError;
}

function parseTotalPages(html) {
  const match = html.match(/<span class="pages">Page\s+\d+\s+of\s+(\d+)<\/span>/i);
  return match ? Number(match[1]) : 1;
}

function imageIdentityFromListing(source) {
  const url = safeSourceUrl(source, "Listing image");
  const match = url.pathname.match(/^(\/contents\/videos_screenshots\/\d+\/(\d+)\/)(?:source|280x210)\/(\d+\.(?:jpe?g|webp))$/i);
  if (match) {
    const [, prefix, id, filename] = match;
    return {
      id: Number(id),
      fallbackUrl: `${SOURCE_ORIGIN}${prefix}280x210/${filename}`,
      extension: path.extname(filename).toLowerCase() === ".jpeg" ? ".jpg" : path.extname(filename).toLowerCase(),
      requiresDetailIdentity: false,
    };
  }

  // Legacy listing pages use WordPress uploads which do not contain the
  // source ID. Resolve the ID and canonical poster from the detail page.
  if (/^\/wp-content\/uploads\/\d{4}\/\d{2}\/[^/]+\.(?:jpe?g|webp)$/i.test(url.pathname)) {
    const extension = path.extname(url.pathname).toLowerCase();
    return {
      id: null,
      fallbackUrl: url.href,
      extension: extension === ".jpeg" ? ".jpg" : extension,
      requiresDetailIdentity: true,
    };
  }

  throw new Error(`Unsupported listing image path: ${url.pathname}`);
}

function thumbnailKeyForId(id) {
  return `previews/v1/${String(id).padStart(6, "0").slice(0, 3)}/${id}/poster`;
}

function parseCards(html, page, listing) {
  const patterns = [
    /<div class="item big"><div class="first"><a href="([^"]+)"><img src="([^"]+)" alt="([^"]*)"[^>]*\/><\/a><div class="wrap"><div class="rating[^"]*">(\d+)%<\/div><\/div><\/div><div class="title"><h2><a href="[^"]+">([\s\S]*?)<\/a><\/h2><\/div><\/div>/gi,
    /<div class="item"><a href="([^"]+)"><div class="img"><img class="thumb" src="([^"]+)" alt="([^"]*)"[^>]*\/><div class="wrap"><div class="rating[^"]*">(\d+)%<\/div><\/div><\/div><\/a><div class="title"><h2><a href="[^"]+">([\s\S]*?)<\/a><\/h2><\/div><\/div>/gi,
  ];
  const cards = [];
  for (const cardPattern of patterns) {
    let match;
    while ((match = cardPattern.exec(html))) {
      const sourcePageUrl = safeSourceUrl(match[1], "Source page").href;
      const image = imageIdentityFromListing(match[2]);
      const title = decodeHtml(match[5] || match[3]);
      const yearMatch = title.match(/(?:19|20)\d{2}/);
      const sourceSlug = new URL(sourcePageUrl).pathname.replace(/^\//, "").replace(/\.html$/i, "");
      cards.push({
        id: image.id,
        title,
        slug: sourceSlug,
        year: yearMatch ? Number(yearMatch[0]) : null,
        rating: Number(match[4]),
        sourcePageUrl,
        embedUrl: image.id ? `${SOURCE_ORIGIN}/embed/${image.id}` : null,
        sourceListingImageUrl: image.fallbackUrl,
        thumbnailKey: image.id ? thumbnailKeyForId(image.id) : null,
        requiresDetailIdentity: image.requiresDetailIdentity,
        listing: listingKey(listing),
        listingPage: page,
        listingPosition: ((page - 1) * listingPageSize(listing)) + cards.length + 1,
      });
    }
  }
  return cards;
}

function itempropContent(html, itemprop) {
  const pattern = new RegExp("itemprop=[\"']" + itemprop + "[\"']", "i");
  const tag = (html.match(/<meta\b[^>]*>/gi) ?? []).find((candidate) => pattern.test(candidate));
  return tag?.match(/content=["']([^"']*)["']/i)?.[1] ?? null;
}

function scriptStringProperty(html, property) {
  const pattern = new RegExp(`${property}:\\s*'((?:\\\\.|[^'\\\\])*)'`, "i");
  const value = html.match(pattern)?.[1] ?? "";
  return decodeHtml(value.replace(/\\'/g, "'").replace(/\\\\/g, "\\"));
}

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

function detailMetadata(html, record) {
  const hiddenId = Number(html.match(/name=["']video_id["'][^>]*value=["'](\d+)["']/i)?.[1] ?? 0);
  const screenshot = html.match(/(?:https:\/\/videocelebs\.net)?(\/contents\/videos_screenshots\/\d+\/(\d+)\/(?:preview(?:\.mp4)?\.jpg|280x210\/[^"'?]+\.(?:jpe?g|webp)))/i);
  const screenshotId = Number(screenshot?.[2] ?? 0);
  const detailId = hiddenId || screenshotId || Number(record.id);
  if (!Number.isInteger(detailId) || detailId < 1) throw new Error("Detail page does not expose a numeric video source ID.");
  if (hiddenId && screenshotId && hiddenId !== screenshotId) throw new Error(`Detail page source ID mismatch (${hiddenId} vs ${screenshotId}).`);
  if (record.id && Number(record.id) !== detailId) throw new Error(`Listing/detail source ID mismatch (${record.id} vs ${detailId}).`);

  record = {
    ...record,
    id: detailId,
    embedUrl: `${SOURCE_ORIGIN}/embed/${detailId}`,
    thumbnailKey: thumbnailKeyForId(detailId),
    requiresDetailIdentity: false,
  };
  const models = scriptStringProperty(html, "video_models");
  const tagText = scriptStringProperty(html, "video_tags");
  const isoDuration = itempropContent(html, "duration")?.match(/^T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
  const hours = Number(isoDuration?.[1] ?? 0);
  const minutes = Number(isoDuration?.[2] ?? 0);
  const seconds = Number(isoDuration?.[3] ?? 0);
  const rawWork = record.title.split(/\s+[-–—]\s+/).at(-1)?.replace(/\s*\((?:19|20)\d{2}\).*$/, "").trim() || record.title;
  const workLink = html.match(/<a\b[^>]*href=["'](?:https:\/\/videocelebs\.net)?\/(movie|tvshow)\/([^"'?#]+)["'][^>]*>([\s\S]*?)<\/a>/i);
  const normalizedWork = record.title.split(/\s+(?:-|\u2013|\u2014)\s+/u).at(-1)?.replace(/\s*[（(](?:19|20)\d{2}.*$/, "").trim() || rawWork;
  const explicitType = workLink?.[1] === "tvshow" ? "tv_show" : workLink?.[1] === "movie" ? "movie" : null;
  const fallbackType = /\bs\d{1,2}\s*e\d{1,3}|\bseason\s+\d+/i.test(normalizedWork) ? "tv_show" : "movie";
  const type = explicitType ?? fallbackType;
  const linkedWorkTitle = workLink ? decodeHtml(workLink[3]) : "";
  const workTitle = (linkedWorkTitle || (type === "tv_show" ? normalizedWork.replace(/\s+s\d{1,2}.*$/i, "").trim() : normalizedWork))
    .replace(/\s*\(Series\)$/i, "")
    .replace(/\s*\((?:19|20)\d{2}\)$/i, "")
    .trim();
  const inferred = titleTaxonomy(record.title);
  const sourceActresses = models.split(",").map((value) => decodeHtml(value).trim()).filter((value) => value && !/^(?:etc|ect)\.?$/i.test(value));
  const sourceTags = tagText.split(",").map((value) => decodeHtml(value).trim()).filter(Boolean);
  const actresses = sourceActresses.length ? sourceActresses : inferred.actresses;
  const tags = sourceTags.length ? sourceTags : inferred.tags;
  const catalogStatus = !workLink && !/\s+(?:-|\u2013|\u2014)\s+/u.test(record.title) ? "excluded_non_scene" : "active";
  const previewPattern = new RegExp('(?:https:\\/\\/videocelebs\\.net)?(/contents/videos_screenshots/\\d+/' + record.id + '/preview(?:\\.mp4)?\\.jpg)', "i");
  const previewPath = html.match(previewPattern)?.[1] ?? null;
  const playerPadding = Number(html.match(/class=["'][^"']*player-wrap[^"']*["'][^>]*style=["'][^"']*padding-bottom:\s*([\d.]+)%/i)?.[1] ?? 0);
  const sourceDescription = decodeHtml(itempropContent(html, "description") ?? "");
  const publishedAt = itempropContent(html, "uploadDate");
  return {
    ...record,
    originalTitle: record.title,
    displayTitle: normalizedWork,
    workTitle,
    workSlug: workLink?.[2] ?? null,
    workSourceUrl: workLink ? SOURCE_ORIGIN + "/" + workLink[1] + "/" + workLink[2] : null,
    type,
    taxonomyStatus: explicitType ? "source" : "fallback",
    description: sourceDescription || `${normalizedWork}${record.year ? ` (${record.year})` : ""}${actresses.length ? ` featuring ${actresses.join(", ")}` : ""}.`,
    durationSeconds: hours * 3600 + minutes * 60 + seconds,
    publishedAt,
    actresses,
    tags,
    metadataStatus: sourceActresses.length && sourceTags.length ? "source" : "title_fallback",
    catalogStatus,
    previewUrl: previewPath ? SOURCE_ORIGIN + previewPath : record.sourceListingImageUrl,
    previewVariant: previewPath ? "player_poster" : "listing_fallback",
    playerAspectRatio: playerPadding > 0 ? 100 / playerPadding : null,
    detailStatus: "ok",
    detailError: null,
  };
}

async function enrichRecord(record) {
  const response = await fetchSource(safeSourceUrl(record.sourcePageUrl, "Detail page"), "text/html,application/xhtml+xml");
  return detailMetadata(await response.text(), record);
}

async function readCatalog(filePath) {
  const records = new Map();
  try {
    const source = await readFile(filePath, "utf8");
    for (const line of source.split(/\r?\n/)) {
      if (!line.trim()) continue;
      const record = JSON.parse(line);
      records.set(Number(record.id), record);
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  return records;
}

function jpegDimensions(buffer) {
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
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
  if (chunk === "VP8 " && buffer.length >= 30 && buffer[23] === 0x9d && buffer[24] === 0x01 && buffer[25] === 0x2a) {
    return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
  }
  if (chunk === "VP8L" && buffer.length >= 25 && buffer[20] === 0x2f) {
    const bits = buffer.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (chunk === "VP8X" && buffer.length >= 30) {
    return {
      width: 1 + buffer[24] + (buffer[25] << 8) + (buffer[26] << 16),
      height: 1 + buffer[27] + (buffer[28] << 8) + (buffer[29] << 16),
    };
  }
  return null;
}

function validateCanonicalImage(buffer) {
  const jpeg = jpegDimensions(buffer);
  const webp = jpeg ? null : webpDimensions(buffer);
  const dimensions = jpeg ?? webp;
  if (!dimensions) throw new Error("Canonical preview is not a supported JPEG or WebP image.");
  if (dimensions.width < 280 || dimensions.height < 150) throw new Error("Canonical preview dimensions are unexpectedly small.");
  return {
    ...dimensions,
    bytes: buffer.length,
    contentType: jpeg ? "image/jpeg" : "image/webp",
    sha256: createHash("sha256").update(buffer).digest("hex"),
  };
}

async function downloadCanonicalImage(record, outputRoot) {
  const sourceUrl = safeSourceUrl(record.previewUrl, "Canonical preview");
  const expectedPath = new RegExp("^/contents/videos_screenshots/\\d+/" + record.id + "/(?:preview(?:\\.mp4)?\\.jpg|280x210/[^/]+\\.(?:jpe?g|webp))$", "i");
  if (!expectedPath.test(sourceUrl.pathname)) throw new Error("Canonical preview path does not match the video source ID.");
  const destination = path.resolve(outputRoot, record.thumbnailKey.replace(/^previews\/v1\//, ""));
  const rootPrefix = `${path.resolve(outputRoot)}${path.sep}`;
  if (!destination.startsWith(rootPrefix)) throw new Error("Canonical preview destination escaped its output directory.");

  try {
    const existing = await readFile(destination);
    return { destination, status: "existing", ...validateCanonicalImage(existing) };
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  await mkdir(path.dirname(destination), { recursive: true });
  const response = await fetchSource(sourceUrl, "image/webp,image/jpeg;q=0.9", { referer: record.sourcePageUrl });
  const contentType = (response.headers.get("content-type") ?? "").split(";", 1)[0].toLowerCase();
  if (!["image/jpeg", "image/webp"].includes(contentType)) throw new Error(`Unexpected preview content type: ${contentType || "missing"}`);
  if (!response.body) throw new Error("Preview response has no body.");

  const partial = `${destination}.part-${process.pid}`;
  let bytes = 0;
  const maxBytes = 5 * 1024 * 1024;
  const limiter = new Transform({
    transform(chunk, _encoding, callback) {
      bytes += chunk.length;
      callback(bytes > maxBytes ? new Error("Canonical preview exceeded 5 MiB.") : null, chunk);
    },
  });

  try {
    await pipeline(response.body, limiter, createWriteStream(partial, { flags: "wx" }));
    const preview = await readFile(partial);
    const metadata = validateCanonicalImage(preview);
    await rename(partial, destination);
    return { destination, status: "downloaded", ...metadata };
  } catch (error) {
    await rm(partial, { force: true });
    throw error;
  }
}

async function runPool(items, concurrency, worker) {
  let cursor = 0;
  const results = new Array(items.length);
  async function runWorker() {
    while (cursor < items.length) {
      const index = cursor++;
      try {
        results[index] = { ok: true, value: await worker(items[index]) };
      } catch (error) {
        results[index] = { ok: false, error };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runWorker));
  return results;
}

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(HELP);
    return;
  }
  minimumRequestIntervalMs = options.delayMs;

  const outputRoot = path.resolve(options.out);
  const catalogPath = path.resolve(options.catalog);
  const compactCatalogPath = catalogPath.replace(/\.jsonl$/i, ".json");
  const missingCatalogPath = catalogPath.replace(/\.jsonl$/i, `.missing-${options.listing}.jsonl`);
  const statePath = path.join(path.dirname(catalogPath), `state-${options.listing}.json`);
  const existing = await readCatalog(catalogPath);
  let processed = 0;
  let page = options.startPage;
  if (options.resume) {
    try {
      const state = JSON.parse(await readFile(statePath, "utf8"));
      if (state.listing === options.listing && Number.isInteger(state.lastCompletedPage)) page = Math.max(page, state.lastCompletedPage + 1);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  let lastPage = options.pages === "all" ? Number.POSITIVE_INFINITY : options.startPage + Number(options.pages) - 1;

  while (page <= lastPage && (options.limit === null || processed < options.limit)) {
    const url = listingUrl(options.listing, page);
    console.log(`Fetching ${url}`);
    const response = await fetchSource(safeSourceUrl(url, "Listing page"), "text/html,application/xhtml+xml");
    const html = await response.text();
    const totalPages = parseTotalPages(html);
    if (options.pages === "all") lastPage = totalPages;
    const cards = parseCards(html, page, options.listing);
    if (cards.length === 0) throw new Error(`No catalog cards found on page ${page}. Source markup may have changed.`);

    const selected = options.limit === null ? cards : cards.slice(0, Math.max(0, options.limit - processed));
    let remaining = selected;
    if (options.details) {
      console.log(`Enriching ${selected.length} detail record(s)...`);
      const enriched = await runPool(selected, Math.min(2, options.concurrency), enrichRecord);
      remaining = enriched.map((result, index) => {
        if (result.ok) return result.value;
        if (selected[index].requiresDetailIdentity) throw result.error;
        const previous = existing.get(selected[index].id) ?? {};
        return { ...previous, ...selected[index], detailStatus: "failed", detailError: String(result.error?.message ?? result.error) };
      });
    }
    console.log(`Validated ${remaining.length} record(s) on page ${page}/${totalPages}.`);

    if (options.execute) {
      await mkdir(path.dirname(catalogPath), { recursive: true });
      const results = options.listingsOnly
        ? remaining.map((record) => existing.has(record.id)
          ? { ok: true, value: null }
          : { ok: false, error: new Error("Base catalog record is missing; run a detailed import for this source ID.") })
        : await runPool(remaining, options.concurrency, (record) => downloadCanonicalImage(record, outputRoot));
      for (let index = 0; index < remaining.length; index += 1) {
        const record = remaining[index];
        const result = results[index];
        const previous = existing.get(record.id) ?? {};
        const seenAt = new Date().toISOString();
        if (options.listingsOnly) {
          if (!result.ok) {
            await appendFile(missingCatalogPath, `${JSON.stringify({ ...record, error: result.error.message, seenAt })}\n`, "utf8");
            console.log(`MISSING ${record.id}: ${record.title}`);
            continue;
          }
          const finalized = {
            ...previous,
            rating: record.rating,
            listings: {
              ...(previous.listings ?? {}),
              [record.listing]: { page: record.listingPage, position: record.listingPosition, seenAt },
            },
          };
          existing.set(record.id, finalized);
          await appendFile(catalogPath, `${JSON.stringify(finalized)}\n`, "utf8");
          console.log(`LISTED ${record.id}: ${record.title}`);
          continue;
        }
        const finalized = {
          ...previous,
          ...record,
          listings: {
            ...(previous.listings ?? {}),
            [record.listing]: { page: record.listingPage, position: record.listingPosition, seenAt },
          },
          thumbnailStatus: result.ok ? result.value.status : "failed",
          thumbnailError: result.ok ? null : String(result.error?.message ?? result.error),
          thumbnailWidth: result.ok ? result.value.width : previous.thumbnailWidth ?? 0,
          thumbnailHeight: result.ok ? result.value.height : previous.thumbnailHeight ?? 0,
          thumbnailBytes: result.ok ? result.value.bytes : previous.thumbnailBytes ?? 0,
          thumbnailContentType: result.ok ? result.value.contentType : previous.thumbnailContentType ?? null,
          thumbnailSha256: result.ok ? result.value.sha256 : previous.thumbnailSha256 ?? null,
          importedAt: seenAt,
        };
        existing.set(record.id, finalized);
        await appendFile(catalogPath, `${JSON.stringify(finalized)}\n`, "utf8");
        console.log(`${result.ok ? "OK" : "FAILED"} ${record.id}: ${record.title}`);
      }
      const pageComplete = selected.length === cards.length;
      await writeFile(statePath, `${JSON.stringify({
        listing: options.listing,
        lastCompletedPage: pageComplete ? page : page - 1,
        partialPage: pageComplete ? null : page,
        totalPages,
        updatedAt: new Date().toISOString(),
      }, null, 2)}\n`, "utf8");
    }

    processed += remaining.length;
    page += 1;
  }

  if (options.execute) {
    const compact = [...existing.values()].sort((a, b) => b.id - a.id);
    const temporary = `${compactCatalogPath}.tmp-${process.pid}`;
    await writeFile(temporary, `${JSON.stringify(compact, null, 2)}\n`, "utf8");
    await rename(temporary, compactCatalogPath);
    console.log(`Catalog contains ${compact.length} unique record(s): ${compactCatalogPath}`);
  } else {
    console.log("Dry run complete. Add --execute to save metadata and canonical previews.");
  }
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
});
