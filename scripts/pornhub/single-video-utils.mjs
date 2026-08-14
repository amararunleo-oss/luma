import { open, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { matchCollections, rejectionReason, COLLECTIONS } from "./taxonomy.mjs";

export function parseArgs(argv) {
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

export function splitList(value, limit = 36) {
  return [...new Set(String(value ?? "").split(";").map((item) => item.trim()).filter(Boolean))].slice(0, limit);
}

export function numeric(value) {
  const parsed = Number(String(value ?? "").replaceAll(",", ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function slugify(value) {
  return String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 150);
}

function hashNumber(value) {
  let hash = 1469598103934665603n;
  for (const byte of Buffer.from(value)) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 1099511628211n);
  }
  return Number(hash % 8_000_000_000_000_000n) + 1_000_000_000_000_000;
}

function wilson(likes, dislikes) {
  const count = likes + dislikes;
  if (!count) return 0;
  const z = 1.96;
  const probability = likes / count;
  return (probability + z * z / (2 * count) - z * Math.sqrt((probability * (1 - probability) + z * z / (4 * count)) / count)) / (1 + z * z / count);
}

export function dateFromUrls(urls) {
  const value = urls.join(" ");
  const separated = value.match(/\/(20\d{2})\/(0?[1-9]|1[0-2])\/(0?[1-9]|[12]\d|3[01])(?:\/|_|-)/)
    ?? value.match(/\/(20\d{2})[_-](0?[1-9]|1[0-2])[_-](0?[1-9]|[12]\d|3[01])(?:\/|_|-)/);
  const compact = value.match(/\/(20\d{2})(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\//);
  const match = separated ?? compact;
  if (!match) return null;
  const date = new Date(`${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}T00:00:00.000Z`);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}

function viewKeyFrom(embedCode) {
  return embedCode.match(/\/embed\/([a-zA-Z0-9_-]+)/)?.[1] ?? null;
}

function embedUrlFrom(embedCode, viewKey) {
  const source = embedCode.match(/\bsrc=["']([^"']+)/i)?.[1];
  if (source) return source.startsWith("//") ? `https:${source}` : source;
  return viewKey ? `https://www.pornhub.com/embed/${viewKey}` : null;
}

function iframeAspectRatio(embedCode) {
  const width = numeric(embedCode.match(/\bwidth=["']?(\d+)/i)?.[1]);
  const height = numeric(embedCode.match(/\bheight=["']?(\d+)/i)?.[1]);
  const ratio = height > 0 ? width / height : 0;
  return Number.isFinite(ratio) && ratio >= 1 && ratio <= 3 ? ratio : 16 / 9;
}

export function inspectPornhubRow(line) {
  const fields = line.split("|");
  if (fields.length < 13) return null;
  const [embedCode, smallThumbnail, smallGallery, titleRaw, , categoriesRaw, , , viewsRaw, likesRaw, dislikesRaw, largeThumbnail, largeGallery] = fields;
  const sourceId = viewKeyFrom(embedCode);
  const title = titleRaw.trim();
  if (!sourceId || !title) return null;
  const likes = numeric(likesRaw);
  const dislikes = numeric(dislikesRaw);
  const votes = likes + dislikes;
  return {
    sourceId,
    title,
    publishedAt: dateFromUrls([largeThumbnail, smallThumbnail, largeGallery, smallGallery]),
    views: numeric(viewsRaw),
    rating: votes ? Math.round(likes / votes * 100) : 0,
    sourceCategories: splitList(categoriesRaw, 24),
  };
}

export function parsePornhubRow(line, policy = {}) {
  const fields = line.split("|");
  if (fields.length < 13) return { error: "bad_column_count" };
  const [embedCode, smallThumbnail, smallGallery, titleRaw, tagsRaw, categoriesRaw, performersRaw, durationRaw, viewsRaw, likesRaw, dislikesRaw, largeThumbnail, largeGallery] = fields;
  const title = titleRaw.trim();
  const sourceId = viewKeyFrom(embedCode);
  const embedUrl = embedUrlFrom(embedCode, sourceId);
  const tags = splitList(tagsRaw, 36);
  const sourceCategories = splitList(categoriesRaw, 24);
  const performers = splitList(performersRaw, 16);
  const galleryUrls = splitList(largeGallery || smallGallery, 4);
  const thumbnailUrl = (largeThumbnail || smallThumbnail || galleryUrls[0] || "").trim();
  const thumbnailFallbackUrl = (smallThumbnail || galleryUrls[0] || "").trim();
  const durationSeconds = numeric(durationRaw);
  const views = numeric(viewsRaw);
  const likes = numeric(likesRaw);
  const dislikes = numeric(dislikesRaw);
  if (!title || !sourceId || !embedUrl || !thumbnailUrl) return { error: "missing_required_field" };
  if (durationSeconds < 60 || durationSeconds > 7200) return { error: "duration_out_of_range" };
  const searchable = [title, ...tags, ...sourceCategories].join(" ");
  const blocked = rejectionReason(searchable);
  if (blocked) return { error: blocked, safetyBlocked: true };
  const manualCollections = splitList(policy.collections ?? "", 20).map(slugify);
  const knownCollections = new Set(COLLECTIONS.map((item) => item.slug));
  const invalidCollections = manualCollections.filter((slug) => !knownCollections.has(slug));
  if (invalidCollections.length) return { error: `unknown_collection:${invalidCollections.join(",")}` };
  const collections = [...new Set([...matchCollections(searchable).map((item) => item.slug), ...manualCollections])];
  if (!collections.length) return { error: "no_curated_collection" };
  const publishedAt = dateFromUrls([largeThumbnail, smallThumbnail, largeGallery, smallGallery]);
  if (!publishedAt) return { error: "missing_publish_date" };
  const publishedYear = new Date(publishedAt).getUTCFullYear();
  const minYear = Number(policy.minYear ?? 2024);
  const maxYear = Number(policy.maxYear ?? new Date().getUTCFullYear());
  if (!policy.allowOld && (publishedYear < minYear || publishedYear > maxYear)) return { error: `outside_year_range:${publishedYear}` };
  const votes = likes + dislikes;
  const ratingRatio = votes ? likes / votes : 0;
  const qualityWarnings = [];
  if (views < Number(policy.minViews ?? 400_000)) qualityWarnings.push(`views_below_${Number(policy.minViews ?? 400_000)}`);
  if (votes < Number(policy.minVotes ?? 25)) qualityWarnings.push(`votes_below_${Number(policy.minVotes ?? 25)}`);
  if (ratingRatio * 100 < Number(policy.minRating ?? 78)) qualityWarnings.push(`rating_below_${Number(policy.minRating ?? 78)}`);
  const record = {
    source: "pornhub",
    sourceId,
    sourceNumericId: hashNumber(`pornhub:${sourceId}`),
    slug: `${slugify(title) || "video"}-${sourceId.toLowerCase()}`,
    title,
    description: `${title}. Embedded adult video available from the original publisher.`,
    embedUrl,
    sourceUrl: `https://www.pornhub.com/view_video.php?viewkey=${encodeURIComponent(sourceId)}`,
    playerAspectRatio: iframeAspectRatio(embedCode),
    thumbnailUrl,
    thumbnailFallbackUrl,
    galleryUrls,
    tags,
    sourceCategories,
    performers,
    durationSeconds,
    views,
    likes,
    dislikes,
    rating: Math.round(ratingRatio * 100),
    ratingWilson: wilson(likes, dislikes),
    publishedAt,
    collections,
    primaryCollection: collections[0],
    selectionLane: "manual",
    validation: { checkedAt: null, thumbnail: null, embed: null },
  };
  return { record, qualityWarnings };
}

export async function readCsvRow(filePath, byteOffset, byteLength) {
  const handle = await open(filePath, "r");
  try {
    const buffer = Buffer.alloc(byteLength);
    const { bytesRead } = await handle.read(buffer, 0, byteLength, byteOffset);
    return buffer.subarray(0, bytesRead).toString("utf8").replace(/[\r\n]+$/, "");
  } finally {
    await handle.close();
  }
}

export async function readJsonl(filePath) {
  try {
    return (await readFile(filePath, "utf8")).split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

export async function upsertJsonl(filePath, record) {
  const records = await readJsonl(filePath);
  const withoutDuplicate = records.filter((item) => String(item.sourceId) !== String(record.sourceId) && item.slug !== record.slug);
  const next = [...withoutDuplicate, record].sort((a, b) => Date.parse(b.publishedAt ?? "") - Date.parse(a.publishedAt ?? "") || String(a.slug).localeCompare(String(b.slug)));
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${next.map((item) => JSON.stringify(item)).join("\n")}\n`, "utf8");
  return next;
}

export async function probeUrl(url, kind, timeoutMs = 12_000) {
  const headers = kind === "thumbnail" ? { Range: "bytes=0-1023", Accept: "image/*" } : { Range: "bytes=0-4095", Accept: "text/html" };
  try {
    const response = await fetch(url, { headers, redirect: "follow", signal: AbortSignal.timeout(timeoutMs) });
    const contentType = response.headers.get("content-type") ?? "";
    await response.body?.cancel();
    return { ok: response.ok && (kind !== "thumbnail" || contentType.startsWith("image/")), status: response.status, finalUrl: response.url, contentType };
  } catch (error) {
    return { ok: false, status: 0, error: error?.name ?? "FetchError" };
  }
}

