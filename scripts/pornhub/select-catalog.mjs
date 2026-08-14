#!/usr/bin/env node

import { createReadStream } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { gzip, gunzip } from "node:zlib";
import { promisify } from "node:util";
import { allocateQuotas, LANE_SHARES, matchCollections, rejectionReason } from "./taxonomy.mjs";

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

function args(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    if (key.startsWith("no-")) result[key.slice(3)] = false;
    else if (argv[index + 1] && !argv[index + 1].startsWith("--")) result[key] = argv[++index];
    else result[key] = true;
  }
  return result;
}

const options = args(process.argv.slice(2));
const input = path.resolve(options.input ?? "C:/projects/pornhub.com-db/pornhub.com-db.csv");
const outputDir = path.resolve(options.out ?? "data/staging/pornhub");
const excludePath = options.exclude ? path.resolve(options.exclude) : null;
const target = Math.max(1, Number(options.target ?? 10_000));
const minYear = Math.max(2000, Number(options["min-year"] ?? 2023));
const maxYear = Math.max(minYear, Number(options["max-year"] ?? 2026));
const minViews = Math.max(0, Number(options["min-views"] ?? 400_000));
const minRating = Math.max(0, Math.min(100, Number(options["min-rating"] ?? 78)));
const minVotes = Math.max(0, Number(options["min-votes"] ?? 25));
const maxTitleDuplicates = Math.max(1, Number(options["max-title-duplicates"] ?? 2));
const maxPerformerVideos = Math.max(1, Number(options["max-performer-videos"] ?? 30));
const startByte = Math.max(0, Number(options["start-byte"] ?? 0));
const maxRows = Number(options["max-rows"] ?? 0);
const checkpointEvery = options.checkpoint === false ? 0 : Math.max(0, Number(options["checkpoint-every"] ?? 500_000));
const resume = options.resume !== false;
const benchmark = Boolean(options.benchmark);
const checkpointPath = path.join(outputDir, "scan.checkpoint.json.gz");
const excludedSourceIds = new Set();
if (excludePath) {
  const lines = (await readFile(excludePath, "utf8")).split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    const record = JSON.parse(line);
    if (record.sourceId) excludedSourceIds.add(String(record.sourceId));
  }
  console.log(`Excluding ${excludedSourceIds.size.toLocaleString()} existing source IDs from ${excludePath}.`);
}
const checkpointSignature = `pornhub-select-v4:${target}:${minYear}:${maxYear}:${startByte}:${minViews}:${minRating}:${minVotes}:${maxTitleDuplicates}:${maxPerformerVideos}:${excludePath ?? "none"}:${excludedSourceIds.size}`;
const quotas = allocateQuotas(target);

class TopK {
  constructor(limit, values = []) { this.limit = Math.max(1, limit); this.values = values; this.heapify(); }
  heapify() { for (let index = Math.floor(this.values.length / 2) - 1; index >= 0; index -= 1) this.down(index); }
  down(index) { while (true) { const left = index * 2 + 1; const right = left + 1; let smallest = index; if (left < this.values.length && this.values[left].score < this.values[smallest].score) smallest = left; if (right < this.values.length && this.values[right].score < this.values[smallest].score) smallest = right; if (smallest === index) return; [this.values[index], this.values[smallest]] = [this.values[smallest], this.values[index]]; index = smallest; } }
  up(index) { while (index > 0) { const parent = Math.floor((index - 1) / 2); if (this.values[parent].score <= this.values[index].score) return; [this.values[parent], this.values[index]] = [this.values[index], this.values[parent]]; index = parent; } }
  push(value) { if (this.values.length < this.limit) { this.values.push(value); this.up(this.values.length - 1); return; } if (value.score <= this.values[0].score) return; this.values[0] = value; this.down(0); }
  sorted() { return [...this.values].sort((a, b) => b.score - a.score); }
}

function laneTargets(quota) {
  const entries = Object.entries(LANE_SHARES);
  const targets = Object.fromEntries(entries.map(([lane, share]) => [lane, Math.floor(quota * share)]));
  targets.popular += quota - Object.values(targets).reduce((sum, value) => sum + value, 0);
  return targets;
}

function makePools(saved = {}) {
  return new Map(quotas.map(({ slug, quota }) => {
    const targets = laneTargets(quota);
    return [slug, Object.fromEntries(Object.entries(targets).map(([lane, laneTarget]) => [lane, new TopK(Math.max(12, Math.ceil(laneTarget * 1.7)), saved?.[slug]?.[lane] ?? [])]))];
  }));
}

function splitList(value, limit) {
  return [...new Set(String(value ?? "").split(";").map((item) => item.trim()).filter(Boolean))].slice(0, limit);
}

function number(value) { const parsed = Number(String(value ?? "").replaceAll(",", "")); return Number.isFinite(parsed) ? parsed : 0; }
function slugify(value) { return String(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 150); }
function hashNumber(value) { let hash = 1469598103934665603n; for (const byte of Buffer.from(value)) { hash ^= BigInt(byte); hash = BigInt.asUintN(64, hash * 1099511628211n); } return Number(hash % 8_000_000_000_000_000n) + 1_000_000_000_000_000; }
function stableUnit(value) { let hash = 2166136261; for (const char of value) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); } return (hash >>> 0) / 0xffffffff; }
function wilson(likes, dislikes) { const n = likes + dislikes; if (!n) return 0; const z = 1.96; const p = likes / n; return (p + z * z / (2 * n) - z * Math.sqrt((p * (1 - p) + z * z / (4 * n)) / n)) / (1 + z * z / n); }
function dateFromUrls(urls) {
  const value = urls.join(" ");
  const separated = value.match(/\/(20\d{2})\/(0?[1-9]|1[0-2])\/(0?[1-9]|[12]\d|3[01])(?:\/|_|-)/)
    ?? value.match(/\/(20\d{2})[_-](0?[1-9]|1[0-2])[_-](0?[1-9]|[12]\d|3[01])(?:\/|_|-)/);
  const compact = value.match(/\/(20\d{2})(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\//);
  const match = separated ?? compact;
  if (!match) return null;
  const date = new Date(`${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}T00:00:00.000Z`);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}
function viewKeyFrom(embedCode) { return embedCode.match(/\/embed\/([a-zA-Z0-9_-]+)/)?.[1] ?? null; }
function embedUrlFrom(embedCode, viewKey) { const source = embedCode.match(/\bsrc=["']([^"']+)/i)?.[1]; if (source) return source.startsWith("//") ? `https:${source}` : source; return viewKey ? `https://www.pornhub.com/embed/${viewKey}` : null; }
function iframeAspectRatio(embedCode) {
  const width = number(embedCode.match(/\bwidth=["']?(\d+)/i)?.[1]);
  const height = number(embedCode.match(/\bheight=["']?(\d+)/i)?.[1]);
  const ratio = height > 0 ? width / height : 0;
  return Number.isFinite(ratio) && ratio >= 1 && ratio <= 3 ? ratio : 16 / 9;
}

function parseRow(line) {
  const fields = line.split("|");
  if (fields.length < 13) return { error: "bad_column_count", sourceCategories: [] };
  const [embedCode, smallThumbnail, smallGallery, titleRaw, tagsRaw, categoriesRaw, performersRaw, durationRaw, viewsRaw, likesRaw, dislikesRaw, largeThumbnail, largeGallery] = fields;
  const title = titleRaw.trim();
  const viewKey = viewKeyFrom(embedCode);
  const embedUrl = embedUrlFrom(embedCode, viewKey);
  const tags = splitList(tagsRaw, 36);
  const categories = splitList(categoriesRaw, 24);
  const performers = splitList(performersRaw, 16);
  const gallery = splitList(largeGallery || smallGallery, 4);
  const thumbnailUrl = (largeThumbnail || smallThumbnail || gallery[0] || "").trim();
  const thumbnailFallbackUrl = (smallThumbnail || gallery[0] || "").trim();
  const durationSeconds = number(durationRaw);
  const views = number(viewsRaw);
  const likes = number(likesRaw);
  const dislikes = number(dislikesRaw);
  if (!title || !viewKey || !embedUrl || !thumbnailUrl) return { error: "missing_required_field", sourceCategories: categories };
  if (durationSeconds < 60 || durationSeconds > 7200) return { error: "duration_out_of_range", sourceCategories: categories };
  const searchable = [title, ...tags, ...categories].join(" ");
  const blocked = rejectionReason(searchable);
  if (blocked) return { error: blocked, sourceCategories: categories };
  const matches = matchCollections(searchable);
  if (!matches.length) return { error: "no_curated_collection", sourceCategories: categories };
  const publishedAt = dateFromUrls([largeThumbnail, smallThumbnail, largeGallery, smallGallery]);
  if (!publishedAt) return { error: "missing_publish_date", sourceCategories: categories };
  const publishedYear = new Date(publishedAt).getUTCFullYear();
  if (publishedYear < minYear || publishedYear > maxYear) return { error: "outside_year_range", sourceCategories: categories };
  const votes = likes + dislikes;
  const rating = votes ? likes / votes : 0;
  if (views < minViews) return { error: "below_min_views", sourceCategories: categories };
  if (votes < minVotes) return { error: "below_min_votes", sourceCategories: categories };
  if (rating * 100 < minRating) return { error: "below_min_rating", sourceCategories: categories };
  return {
    sourceCategories: categories,
    record: {
      source: "pornhub", sourceId: viewKey, sourceNumericId: hashNumber(`pornhub:${viewKey}`),
      slug: `${slugify(title) || "video"}-${viewKey.toLowerCase()}`, title,
      description: `${title}. Embedded adult video available from the original publisher.`,
      embedUrl, sourceUrl: `https://www.pornhub.com/view_video.php?viewkey=${encodeURIComponent(viewKey)}`,
      playerAspectRatio: iframeAspectRatio(embedCode),
      thumbnailUrl, thumbnailFallbackUrl, galleryUrls: gallery, tags, sourceCategories: categories, performers,
      durationSeconds, views, likes, dislikes, rating: Math.round(rating * 100), ratingWilson: wilson(likes, dislikes),
      publishedAt, collections: matches.map((item) => item.slug),
    },
  };
}

function scores(record) {
  const votes = record.likes + record.dislikes;
  const publishedMs = record.publishedAt ? new Date(record.publishedAt).valueOf() : 0;
  const age = publishedMs / 86_400_000;
  const year = publishedMs ? new Date(publishedMs).getUTCFullYear() : minYear;
  const recencyBoost = Math.max(0, year - minYear) * 0.35;
  return {
    popular: Math.log10(record.views + 1) * 12 + record.ratingWilson * 8 + recencyBoost,
    recent: age + Math.log1p(record.views) / 20,
    rated: record.ratingWilson * 15 + Math.min(3, Math.log10(votes + 1)) + Math.log10(record.views + 1),
    diverse: stableUnit(record.sourceId) + Math.min(1, Math.log10(record.views + 1) / 8),
  };
}

async function* linesFrom(filePath, start = 0) {
  const stream = createReadStream(filePath, { start, highWaterMark: 1024 * 1024 });
  let pending = Buffer.alloc(0); let offset = start;
  for await (const chunk of stream) {
    const data = pending.length ? Buffer.concat([pending, chunk]) : chunk;
    let cursor = 0; let newline;
    while ((newline = data.indexOf(10, cursor)) !== -1) {
      let end = newline; if (end > cursor && data[end - 1] === 13) end -= 1;
      const consumed = newline + 1 - cursor; offset += consumed;
      yield { line: data.subarray(cursor, end).toString("utf8"), nextOffset: offset };
      cursor = newline + 1;
    }
    pending = data.subarray(cursor);
  }
  if (pending.length) yield { line: pending.toString("utf8"), nextOffset: offset + pending.length };
}

async function loadCheckpoint() {
  if (!resume) return null;
  try {
    const checkpoint = JSON.parse((await gunzipAsync(await readFile(checkpointPath))).toString("utf8"));
    if (checkpoint.signature !== checkpointSignature) {
      console.log("Ignoring an incompatible checkpoint because target/year filters changed.");
      return null;
    }
    return checkpoint;
  } catch { return null; }
}

function normalizedKey(value) {
  return String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function makeSelectionState() {
  return { used: new Set(), titleCounts: new Map(), performerCounts: new Map() };
}

function canClaim(record, selectionState) {
  if (selectionState.used.has(record.sourceId)) return false;
  const titleKey = normalizedKey(record.title);
  if ((selectionState.titleCounts.get(titleKey) ?? 0) >= maxTitleDuplicates) return false;
  const performerKeys = (record.performers ?? []).map(normalizedKey).filter(Boolean);
  if (performerKeys.some((key) => (selectionState.performerCounts.get(key) ?? 0) >= maxPerformerVideos)) return false;
  return true;
}

function claim(record, selectionState) {
  selectionState.used.add(record.sourceId);
  const titleKey = normalizedKey(record.title);
  selectionState.titleCounts.set(titleKey, (selectionState.titleCounts.get(titleKey) ?? 0) + 1);
  for (const performerKey of (record.performers ?? []).map(normalizedKey).filter(Boolean)) {
    selectionState.performerCounts.set(performerKey, (selectionState.performerCounts.get(performerKey) ?? 0) + 1);
  }
}

function pickSelection(pools) {
  const selected = []; const selectionState = makeSelectionState(); const perCollection = {};
  for (const { slug, quota } of quotas) {
    const lanes = pools.get(slug); const targets = laneTargets(quota); const items = [];
    for (const lane of Object.keys(targets)) {
      let added = 0;
      for (const candidate of lanes[lane].sorted()) {
        if (added >= targets[lane] || !canClaim(candidate.record, selectionState)) continue;
        claim(candidate.record, selectionState); items.push({ ...candidate.record, primaryCollection: slug, selectionLane: lane }); added += 1;
      }
    }
    const backfill = Object.values(lanes).flatMap((heap) => heap.sorted()).sort((a, b) => b.score - a.score);
    for (const candidate of backfill) {
      if (items.length >= quota || !canClaim(candidate.record, selectionState)) continue;
      claim(candidate.record, selectionState); items.push({ ...candidate.record, primaryCollection: slug, selectionLane: "backfill" });
    }
    perCollection[slug] = { target: quota, selected: items.length };
    selected.push(...items);
  }
  return { selected: selected.slice(0, target), perCollection, selectionState };
}

await mkdir(outputDir, { recursive: true });
const saved = await loadCheckpoint();
const pools = makePools(saved?.pools);
const globalPool = new TopK(Math.max(100, Math.ceil(target * 1.6)), saved?.globalPool ?? []);
const state = {
  offset: saved?.offset ?? startByte, rows: saved?.rows ?? 0, eligible: saved?.eligible ?? 0,
  rejected: saved?.rejected ?? {}, sourceCategories: saved?.sourceCategories ?? {}, startedAt: saved?.startedAt ?? new Date().toISOString(),
};
const runStarted = Date.now(); let sinceCheckpoint = 0;
if (state.offset) console.log(`Resuming at row ${state.rows.toLocaleString()} (${(state.offset / 1024 ** 3).toFixed(2)} GiB).`);

for await (const { line, nextOffset } of linesFrom(input, state.offset)) {
  state.rows += 1; state.offset = nextOffset; sinceCheckpoint += 1;
  const parsed = parseRow(line);
  for (const category of parsed.sourceCategories ?? []) state.sourceCategories[category] = (state.sourceCategories[category] ?? 0) + 1;
  if (parsed.error) state.rejected[parsed.error] = (state.rejected[parsed.error] ?? 0) + 1;
  else if (excludedSourceIds.has(parsed.record.sourceId)) state.rejected.excluded_existing = (state.rejected.excluded_existing ?? 0) + 1;
  else {
    state.eligible += 1;
    const recordScores = scores(parsed.record);
    globalPool.push({ score: recordScores.popular + recordScores.rated, record: parsed.record });
    for (const collectionSlug of parsed.record.collections) {
      const lanes = pools.get(collectionSlug); if (!lanes) continue;
      for (const [lane, score] of Object.entries(recordScores)) {
        if (lane === "rated" && parsed.record.likes + parsed.record.dislikes < 25) continue;
        if (lane === "recent" && !parsed.record.publishedAt) continue;
        lanes[lane].push({ score, record: parsed.record });
      }
    }
  }
  if (state.rows % 50_000 === 0) {
    const elapsed = (Date.now() - runStarted) / 1000; const rate = Math.round((state.rows - (saved?.rows ?? 0)) / Math.max(1, elapsed));
    console.log(`Scanned ${state.rows.toLocaleString()} rows · ${state.eligible.toLocaleString()} eligible · ${rate.toLocaleString()} rows/s`);
  }
  if (checkpointEvery && sinceCheckpoint >= checkpointEvery) {
    const serialPools = Object.fromEntries([...pools].map(([slug, lanes]) => [slug, Object.fromEntries(Object.entries(lanes).map(([lane, heap]) => [lane, heap.values]))]));
    const payload = await gzipAsync(JSON.stringify({ ...state, signature: checkpointSignature, pools: serialPools, globalPool: globalPool.values }), { level: 3 });
    const temp = `${checkpointPath}.tmp`; await writeFile(temp, payload); await rename(temp, checkpointPath);
    sinceCheckpoint = 0; console.log("Checkpoint saved.");
  }
  if (maxRows && state.rows >= maxRows) break;
}

const selection = pickSelection(pools);
const selectedIds = new Set(selection.selected.map((item) => item.sourceId));
for (const candidate of globalPool.sorted()) {
  if (selection.selected.length >= target || selectedIds.has(candidate.record.sourceId) || !canClaim(candidate.record, selection.selectionState)) continue;
  claim(candidate.record, selection.selectionState);
  selectedIds.add(candidate.record.sourceId);
  selection.selected.push({ ...candidate.record, primaryCollection: candidate.record.collections[0] ?? "adult-videos", selectionLane: "global-backfill" });
}
const { selected, perCollection } = selection;
const generatedAt = new Date().toISOString();
const catalog = selected.map((record, index) => ({ ...record, popularityRank: index + 1, importedAt: generatedAt }));
await writeFile(path.join(outputDir, "selected.jsonl"), `${catalog.map((record) => JSON.stringify(record)).join("\n")}\n`, "utf8");
await writeFile(path.join(outputDir, "categories.json"), `${JSON.stringify(Object.entries(state.sourceCategories).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count), null, 2)}\n`, "utf8");
await writeFile(path.join(outputDir, "report.json"), `${JSON.stringify({ generatedAt, input, target, exclude: excludePath ? { path: excludePath, sourceIds: excludedSourceIds.size } : null, yearRange: { min: minYear, max: maxYear }, quality: { minViews, minRating, minVotes, maxTitleDuplicates, maxPerformerVideos }, scannedRows: state.rows, bytesRead: state.offset, eligibleRows: state.eligible, selectedRows: catalog.length, elapsedSeconds: Math.round((Date.now() - runStarted) / 1000), perCollection, rejected: state.rejected }, null, 2)}\n`, "utf8");
console.log(`Selected ${catalog.length.toLocaleString()} records into ${path.join(outputDir, "selected.jsonl")}.`);
console.log(`Discovered ${Object.keys(state.sourceCategories).length.toLocaleString()} source categories; see categories.json and report.json.`);
if (benchmark) console.log(`Benchmark: ${state.rows.toLocaleString()} rows in ${((Date.now() - runStarted) / 1000).toFixed(1)}s.`);
