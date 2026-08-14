import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { Redis } from "@upstash/redis";
import { AGE_RISK_TERMS, ADULT_CATEGORIES, adultCategoryBySlugOrName, adultCategoryMatchTerms } from "@/lib/adult-taxonomy";
import { slugify, type Video } from "@/lib/videos";

type SourceRecord = {
  sourceNumericId: number;
  slug: string;
  title: string;
  description?: string;
  embedUrl: string;
  playerAspectRatio?: number;
  thumbnailUrl: string;
  thumbnailFallbackUrl?: string;
  tags?: string[];
  sourceCategories?: string[];
  performers?: string[];
  durationSeconds?: number;
  views?: number;
  rating?: number;
  publishedAt?: string;
  collections?: string[];
  primaryCollection?: string;
  popularityRank?: number;
};

export type LocalPornhubQuery = {
  page?: number;
  pageSize?: number;
  tagSlug?: string;
  tagSlugs?: readonly string[];
  year?: number;
  minYear?: number;
  search?: string;
  order?: "latest" | "popular" | "rating" | "oldest";
  duration?: "short" | "medium" | "long";
  minRating?: number;
};

export type LocalPornhubPage = { items: Video[]; total: number; page: number; pageSize: number; database: false };

function normalized(value: string) {
  return slugify(value.trim());
}

function safeSourceRecord(record: SourceRecord) {
  const values = [record.title, record.description ?? "", ...(record.tags ?? []), ...(record.sourceCategories ?? [])].map((value) => value.toLowerCase());
  return !AGE_RISK_TERMS.some((term) => values.some((value) => value.includes(term)));
}

function durationLabel(seconds = 0) {
  const safe = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function yearFromDate(value?: string) {
  const year = Number(value?.slice(0, 4));
  return Number.isFinite(year) ? year : 0;
}

function readableTag(value: string) {
  return value.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function toVideo(record: SourceRecord): Video {
  const collections = [...new Set((record.collections ?? []).map(normalized).filter(Boolean))];
  const tags = [...new Set([...(record.tags ?? []), ...(record.sourceCategories ?? []), ...collections].map(readableTag))];
  return {
    id: Number(record.sourceNumericId),
    rank: Math.max(1, Number(record.popularityRank ?? 999999)),
    slug: record.slug,
    title: record.title,
    sceneTitle: record.title,
    workTitle: record.title,
    description: record.description?.trim() || `${record.title}. Embedded adult video provided by the original publisher.`,
    year: yearFromDate(record.publishedAt),
    duration: durationLabel(record.durationSeconds),
    type: "Movie",
    rating: Math.max(0, Math.min(100, Math.round(record.rating ?? 0))),
    actresses: [...new Set(record.performers ?? [])],
    tags,
    embedUrl: record.embedUrl,
    thumbnail: record.thumbnailUrl || record.thumbnailFallbackUrl || "",
    publishedAt: record.publishedAt,
    playerAspectRatio: 16 / 9,
    source: "pornhub",
    sourceCategories: record.sourceCategories ?? [],
    collections,
    views: Math.max(0, Number(record.views ?? 0)),
  };
}

let recordsPromise: Promise<Video[]> | undefined;
let recordsBySlugPromise: Promise<Map<string, Video>> | undefined;
const filteredCatalogCache = new Map<string, Video[]>();

type RemoteCatalogManifest = { schema: number; version: string; records: number; chunks: string[] };

async function remotePornhubContents() {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token || process.env.NODE_ENV !== "production") return "";
  try {
    const redis = new Redis({ url, token, cache: "default" });
    const storedManifest = await redis.get<RemoteCatalogManifest | string>("actrexx:pornhub:catalog:manifest");
    const manifest = typeof storedManifest === "string" ? JSON.parse(storedManifest) as RemoteCatalogManifest : storedManifest;
    if (!manifest || manifest.schema !== 1 || !Array.isArray(manifest.chunks) || !manifest.chunks.length) return "";
    const storedChunks = await redis.mget<(string | null)[]>(...manifest.chunks);
    if (!storedChunks || storedChunks.length !== manifest.chunks.length || storedChunks.some((item) => typeof item !== "string")) return "";
    const contents = storedChunks.map((item) => {
      const value = item as string;
      return value.startsWith("gz:") ? gunzipSync(Buffer.from(value.slice(3), "base64")).toString("utf8") : value;
    }).join("\n");
    const count = contents.split(/\r?\n/).filter(Boolean).length;
    return count === manifest.records ? contents : "";
  } catch (error) {
    console.warn("Remote Pornhub catalog unavailable; using deploy-time fallback.", error instanceof Error ? error.message : error);
    return "";
  }
}

export function getLocalPornhubVideos() {
  recordsPromise ??= Promise.all([
    process.env.NODE_ENV === "production"
      ? remotePornhubContents().then((contents) => contents || readFile(path.join(process.cwd(), "data/catalog/pornhub-featured.jsonl"), "utf8").catch(() => ""))
      : readFile(path.join(process.cwd(), "data/staging/pornhub/final.jsonl"), "utf8").catch(() => readFile(path.join(process.cwd(), "data/catalog/pornhub-featured.jsonl"), "utf8")).catch(() => ""),
    readFile(path.join(process.cwd(), "data/catalog/pornhub-manual.jsonl"), "utf8").catch(() => ""),
    readFile(path.join(process.cwd(), "data/staging/pornhub/manual.jsonl"), "utf8").catch(() => ""),
  ]).then((sources) => {
    const unique = new Map<string, SourceRecord>();
    for (const contents of sources) {
      for (const line of contents.split(/\r?\n/).filter(Boolean)) {
        const record = JSON.parse(line) as SourceRecord;
        unique.set(String(record.sourceNumericId), record);
      }
    }
    return [...unique.values()].filter(safeSourceRecord).map(toVideo);
  }).catch(() => []);
  return recordsPromise;
}

function searchableValues(video: Video) {
  return [video.title, video.description, ...video.actresses, ...video.tags, ...(video.sourceCategories ?? []), ...(video.collections ?? [])]
    .map(normalized)
    .filter(Boolean);
}

function categoryValues(video: Video) {
  return [...video.tags, ...(video.sourceCategories ?? []), ...(video.collections ?? [])]
    .map(normalized)
    .filter(Boolean);
}

function categoryTerms(slugs: readonly string[]) {
  const terms = new Set<string>();
  for (const slug of slugs) {
    const category = adultCategoryBySlugOrName(slug);
    const values = category ? adultCategoryMatchTerms(category) : [normalized(slug)];
    values.forEach((value) => terms.add(normalized(value)));
  }
  return terms;
}

function matchesCategory(video: Video, requested: readonly string[]) {
  if (!requested.length) return true;
  const terms = categoryTerms(requested);
  const values = categoryValues(video);
  return [...terms].some((term) => values.some((value) => value === term || `-${value}-`.includes(`-${term}-`)));
}

function searchTerms(query: string) {
  const phrase = normalized(query);
  const category = adultCategoryBySlugOrName(query) ?? ADULT_CATEGORIES.find((item) => adultCategoryMatchTerms(item).some((term) => phrase.includes(term)));
  const noise = new Set(["best", "top", "hot", "new", "latest", "watch", "porn", "adult", "video", "videos"]);
  const tokens = phrase.split("-").filter((token) => token.length > 2 && !noise.has(token));
  return { phrase, categoryTerms: category ? adultCategoryMatchTerms(category) : [], tokens };
}

function searchScore(video: Video, query: string) {
  const { phrase, categoryTerms, tokens } = searchTerms(query);
  const haystack = searchableValues(video);
  const title = normalized(video.sceneTitle);
  const phraseMatch = haystack.some((value) => value.includes(phrase));
  const categoryMatch = categoryTerms.some((term) => haystack.some((value) => value === term || value.includes(term)));
  const tokenMatches = tokens.filter((token) => haystack.some((value) => value.includes(token))).length;
  const tokenMatch = tokens.length > 0 && tokenMatches === tokens.length;
  if (!phraseMatch && !categoryMatch && !tokenMatch) return 0;
  return (title.includes(phrase) ? 80 : 0) + (phraseMatch ? 40 : 0) + (categoryMatch ? 30 : 0) + tokenMatches * 8 + Math.log10(Math.max(1, video.views ?? 0));
}

function durationSeconds(video: Video) {
  const parts = video.duration.split(":").map(Number);
  return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
}

export async function listLocalPornhubVideos(options: LocalPornhubQuery = {}): Promise<LocalPornhubPage | null> {
  const all = await getLocalPornhubVideos();
  if (!all.length) return null;
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.max(1, Math.min(48, options.pageSize ?? 25));
  const requested = [...(options.tagSlugs ?? []), ...(options.tagSlug ? [options.tagSlug] : [])];
  const order = options.order ?? "popular";
  const cacheKey = options.search?.trim() ? "" : JSON.stringify({ requested: [...requested].sort(), year: options.year ?? null, minYear: options.minYear ?? null, minRating: options.minRating ?? null, duration: options.duration ?? null, order });
  let items = cacheKey ? filteredCatalogCache.get(cacheKey) : undefined;
  if (!items) {
    items = all.filter((video) => matchesCategory(video, requested));
    if (options.search?.trim()) items = items.map((video) => ({ video, score: searchScore(video, options.search!) })).filter(({ score }) => score > 0).sort((a, b) => b.score - a.score).map(({ video }) => video);
    if (options.year) items = items.filter((video) => video.year === options.year);
    if (options.minYear) items = items.filter((video) => video.year >= options.minYear!);
    if (options.minRating) items = items.filter((video) => video.rating >= options.minRating!);
    if (options.duration) items = items.filter((video) => {
      const seconds = durationSeconds(video);
      return options.duration === "short" ? seconds < 300 : options.duration === "medium" ? seconds >= 300 && seconds < 900 : seconds >= 900;
    });
    if (!options.search?.trim()) items.sort(order === "rating"
      ? (a, b) => b.rating - a.rating || (b.views ?? 0) - (a.views ?? 0)
      : order === "latest"
        ? (a, b) => Date.parse(b.publishedAt ?? "") - Date.parse(a.publishedAt ?? "") || b.id - a.id
        : order === "oldest"
          ? (a, b) => Date.parse(a.publishedAt ?? "") - Date.parse(b.publishedAt ?? "") || a.id - b.id
          : (a, b) => (b.views ?? 0) - (a.views ?? 0) || a.rank - b.rank);
    if (cacheKey) {
      if (filteredCatalogCache.size >= 80) filteredCatalogCache.delete(filteredCatalogCache.keys().next().value!);
      filteredCatalogCache.set(cacheKey, items);
    }
  }
  const total = items.length;
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize, database: false };
}

export async function getLocalPornhubVideo(slug: string) {
  recordsBySlugPromise ??= getLocalPornhubVideos().then((videos) => new Map(videos.map((video) => [video.slug, video])));
  return (await recordsBySlugPromise).get(slug);
}

export async function getLocalPornhubRelated(video: Video, limit = 8) {
  if (video.source !== "pornhub") return null;
  const tags = new Set(searchableValues(video));
  return (await getLocalPornhubVideos())
    .filter((candidate) => candidate.id !== video.id)
    .map((candidate) => ({ candidate, score: searchableValues(candidate).reduce((score, value) => score + (tags.has(value) ? 10 : 0), 0) + (candidate.rating / 20) }))
    .filter(({ score }) => score >= 10)
    .sort((a, b) => b.score - a.score || (b.candidate.views ?? 0) - (a.candidate.views ?? 0))
    .slice(0, Math.max(1, Math.min(12, limit)))
    .map(({ candidate }) => candidate);
}

export async function searchLocalPornhubVideos(query: string, limit = 8) {
  const term = query.trim();
  if (term.length < 2) return [];
  const all = await getLocalPornhubVideos();
  return all.map((video) => ({ video, score: searchScore(video, term) })).filter(({ score }) => score > 0).sort((a, b) => b.score - a.score || (b.video.views ?? 0) - (a.video.views ?? 0)).slice(0, limit).map(({ video }) => video);
}

export async function localPornhubCategoryCounts() {
  const all = await getLocalPornhubVideos();
  return Object.fromEntries(ADULT_CATEGORIES.map((category) => [category.slug, all.filter((video) => matchesCategory(video, [category.slug])).length]));
}
