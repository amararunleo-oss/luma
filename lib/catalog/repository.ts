import { env } from "cloudflare:workers";
import { actresses as seedActresses, slugify, tags as seedTags, videos as seedVideos, years as seedYears, type Video, type VideoType } from "@/lib/videos";

export const DEFAULT_PAGE_SIZE = 24;

const POPULAR_ACTRESS_SLUGS = [
  "sydney-sweeney",
  "ana-de-armas",
  "alexandra-daddario",
  "margot-robbie",
  "dakota-johnson",
  "monica-bellucci",
  "kate-winslet",
  "eva-green",
  "angelina-jolie",
  "jennifer-lawrence",
  "scarlett-johansson",
  "salma-hayek",
] as const;

export type CatalogOrder = "latest" | "popular" | "rating" | "oldest";
export type DurationFilter = "short" | "medium" | "long";

export type QueryOptions = {
  page?: number;
  pageSize?: number;
  sort?: "latest" | "popular" | "top-rated" | "rating";
  type?: VideoType;
  actressSlug?: string;
  tagSlug?: string;
  workSlug?: string;
  year?: number;
  search?: string;
  order?: CatalogOrder;
  duration?: DurationFilter;
  minRating?: number;
};

export type DirectoryKind = "actress" | "movie" | "tv_show";

type DirectoryOptions = {
  kind: DirectoryKind;
  letter?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

type D1Result<T> = { results?: T[] };
type Statement = { bind(...values: unknown[]): Statement; all<T>(): Promise<D1Result<T>>; first<T>(): Promise<T | null> };
type Database = { prepare(query: string): Statement };

type VideoRow = {
  id: number;
  slug: string;
  title: string;
  sceneTitle: string;
  workTitle: string | null;
  description: string;
  year: number | null;
  durationSeconds: number;
  type: "movie" | "tv_show";
  rating: number;
  popularityRank: number | null;
  thumbnailKey: string;
  playerAspectRatio: number;
  embedId: number;
  publishedAt: string | null;
  actressNames: string | null;
  tagNames: string | null;
};

export type DirectoryEntry = { name: string; slug: string; initial: string; count: number; description: string };
export type DirectoryPage = { items: DirectoryEntry[]; total: number; page: number; pageSize: number; database: boolean };
export type SearchSuggestion = {
  id: string;
  label: string;
  href: string;
  meta: string;
  group: "videos" | "actresses" | "movies" | "tvShows";
  image?: string;
};
export type SearchSuggestions = {
  query: string;
  videos: SearchSuggestion[];
  actresses: SearchSuggestion[];
  movies: SearchSuggestion[];
  tvShows: SearchSuggestion[];
};
export type CatalogPage = { items: Video[]; total: number; page: number; pageSize: number; database: boolean };
export type CatalogSitemap = {
  videos: { slug: string; updatedAt: string }[];
  actresses: { slug: string; updatedAt: string }[];
  works: { slug: string; type: "movie" | "tv_show"; updatedAt: string }[];
  tags: { slug: string }[];
  years: number[];
};

function database() {
  return (env as unknown as { DB?: Database }).DB ?? null;
}

function duration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function thumbnailUrl(key: string) {
  if (key.startsWith("/")) return key;
  return `/media/${key.replace(/^media\//, "")}`;
}

function searchTerm(value?: string) {
  return value?.trim().replace(/\s+/g, " ").slice(0, 80).toLowerCase() ?? "";
}

const SEARCH_ALIASES: Record<string, string[]> = {
  naked: ["nude"],
  nudity: ["nude"],
  boobs: ["topless", "cleavage"],
  tits: ["topless", "cleavage"],
  breasts: ["topless", "cleavage"],
  "big butt": ["butt"],
  "big ass": ["butt"],
  ass: ["butt"],
  booty: ["butt"],
  doggystyle: ["sex", "explicit"],
  "doggy style": ["sex", "explicit"],
  blowjob: ["sex", "explicit"],
  oral: ["sex", "explicit"],
  babe: ["sexy"],
  hot: ["sexy"],
  lingerie: ["underwear"],
  "see-through": ["see thru"],
  strip: ["striptease"],
};

function expandedSearchTerms(value?: string) {
  const primary = searchTerm(value);
  return [...new Set([primary, ...(SEARCH_ALIASES[primary] ?? [])])].filter((term) => term.length >= 2).slice(0, 4);
}

function toVideo(row: VideoRow): Video {
  return {
    id: row.id,
    rank: row.popularityRank ?? 999999,
    slug: row.slug,
    title: row.title,
    sceneTitle: row.sceneTitle,
    workTitle: row.workTitle ?? row.sceneTitle,
    description: row.description,
    year: row.year ?? 0,
    duration: duration(row.durationSeconds),
    type: row.type === "tv_show" ? "TV Show" : "Movie",
    rating: row.rating,
    actresses: row.actressNames ? row.actressNames.split("|").filter(Boolean) : [],
    tags: row.tagNames ? row.tagNames.split("|").filter(Boolean) : [],
    embedUrl: `https://videocelebs.net/embed/${row.embedId}`,
    thumbnail: thumbnailUrl(row.thumbnailKey),
    publishedAt: row.publishedAt ?? undefined,
    playerAspectRatio: Number(row.playerAspectRatio) || 16 / 9,
  };
}

function whereClause(options: QueryOptions) {
  const where = ["v.is_active = 1"];
  const values: unknown[] = [];
  if (options.sort === "latest") where.push("EXISTS (SELECT 1 FROM video_listings vl WHERE vl.video_id = v.id AND vl.listing = 'latest')");
  if (options.sort === "popular") where.push("EXISTS (SELECT 1 FROM video_listings vl WHERE vl.video_id = v.id AND vl.listing = 'popular')");
  if (options.sort === "top-rated") where.push("EXISTS (SELECT 1 FROM video_listings vl WHERE vl.video_id = v.id AND vl.listing = 'top_rated')");
  if (options.type) { where.push("v.type = ?"); values.push(options.type === "TV Show" ? "tv_show" : "movie"); }
  if (options.actressSlug) { where.push("EXISTS (SELECT 1 FROM video_actresses va2 JOIN actresses a2 ON a2.id = va2.actress_id WHERE va2.video_id = v.id AND a2.slug = ?)"); values.push(options.actressSlug); }
  if (options.tagSlug) { where.push("EXISTS (SELECT 1 FROM video_tags vt2 JOIN tags t2 ON t2.id = vt2.tag_id WHERE vt2.video_id = v.id AND t2.slug = ?)"); values.push(options.tagSlug); }
  if (options.workSlug) { where.push("w.slug = ?"); values.push(options.workSlug); }
  if (options.year) { where.push("v.year = ?"); values.push(options.year); }
  if (options.minRating) { where.push("v.rating >= ?"); values.push(options.minRating); }
  if (options.duration === "short") where.push("v.duration_seconds > 0 AND v.duration_seconds < 300");
  if (options.duration === "medium") where.push("v.duration_seconds >= 300 AND v.duration_seconds < 900");
  if (options.duration === "long") where.push("v.duration_seconds >= 900");
  if (options.search?.trim()) {
    const terms = expandedSearchTerms(options.search);
    const predicate = "(lower(v.original_title) LIKE ? OR lower(v.display_title) LIKE ? OR lower(v.description) LIKE ? OR lower(w.title) LIKE ? OR EXISTS (SELECT 1 FROM video_actresses vas JOIN actresses aas ON aas.id = vas.actress_id WHERE vas.video_id = v.id AND lower(aas.name) LIKE ?) OR EXISTS (SELECT 1 FROM video_tags vts JOIN tags ts ON ts.id = vts.tag_id WHERE vts.video_id = v.id AND lower(ts.name) = ?))";
    where.push(`(${terms.map(() => predicate).join(" OR ")})`);
    for (const search of terms) values.push(...Array(5).fill(`%${search}%`), search);
  }
  return { sql: where.join(" AND "), values };
}

function fallback(options: QueryOptions): CatalogPage {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.max(1, Math.min(48, options.pageSize ?? DEFAULT_PAGE_SIZE));
  let items = [...seedVideos];
  if (options.sort === "latest") items = [];
  if (options.type) items = items.filter((video) => video.type === options.type);
  if (options.actressSlug) items = items.filter((video) => video.actresses.some((name) => slugify(name) === options.actressSlug));
  if (options.tagSlug) items = items.filter((video) => video.tags.some((name) => slugify(name) === options.tagSlug));
  if (options.workSlug) items = items.filter((video) => slugify(video.workTitle) === options.workSlug);
  if (options.year) items = items.filter((video) => video.year === options.year);
  if (options.minRating) items = items.filter((video) => video.rating >= options.minRating!);
  if (options.duration) {
    const seconds = (video: Video) => {
      const [minutes = 0, remainder = 0] = video.duration.split(":").map(Number);
      return minutes * 60 + remainder;
    };
    items = items.filter((video) => options.duration === "short" ? seconds(video) < 300 : options.duration === "medium" ? seconds(video) >= 300 && seconds(video) < 900 : seconds(video) >= 900);
  }
  if (options.search?.trim()) {
    const terms = expandedSearchTerms(options.search);
    items = items.filter((video) => terms.some((term) => [video.title, video.sceneTitle, video.workTitle, video.description, ...video.actresses, ...video.tags].some((value) => value.toLowerCase().includes(term))));
  }
  const fallbackOrder = options.order ?? (options.sort === "top-rated" || options.sort === "rating" ? "rating" : options.sort === "popular" ? "popular" : "latest");
  if (fallbackOrder === "rating") items.sort((a, b) => b.rating - a.rating || b.id - a.id);
  else if (fallbackOrder === "popular") items.sort((a, b) => a.rank - b.rank);
  else if (fallbackOrder === "oldest") items.sort((a, b) => a.year - b.year || a.id - b.id);
  else items.sort((a, b) => b.id - a.id);
  const total = items.length;
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize, database: false };
}

export async function listVideos(options: QueryOptions = {}): Promise<CatalogPage> {
  const db = database();
  if (!db) return fallback(options);
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.max(1, Math.min(48, options.pageSize ?? DEFAULT_PAGE_SIZE));
  const where = whereClause(options);
  const orderBy = options.order === "rating"
    ? "v.rating DESC, v.id DESC"
    : options.order === "popular"
      ? "COALESCE(v.popularity_rank, 999999) ASC, v.id DESC"
      : options.order === "oldest"
        ? "COALESCE(v.year, 9999) ASC, v.id ASC"
        : options.order === "latest"
          ? "COALESCE(v.published_at, v.first_seen_at) DESC, v.id DESC"
          : options.sort === "top-rated"
    ? "COALESCE((SELECT vl.position FROM video_listings vl WHERE vl.video_id = v.id AND vl.listing = 'top_rated'), 999999) ASC, v.id DESC"
    : options.sort === "rating"
    ? "v.rating DESC, v.id DESC"
    : options.sort === "popular"
      ? "COALESCE((SELECT vl.position FROM video_listings vl WHERE vl.video_id = v.id AND vl.listing = 'popular'), v.popularity_rank, 999999) ASC, v.id DESC"
      : "COALESCE((SELECT vl.seen_at FROM video_listings vl WHERE vl.video_id = v.id AND vl.listing = 'latest'), v.published_at, v.first_seen_at) DESC, v.id DESC";
  try {
    const countRow = await db.prepare(`SELECT COUNT(*) AS total FROM videos v LEFT JOIN works w ON w.id = v.work_id WHERE ${where.sql}`).bind(...where.values).first<{ total: number }>();
    const statement = db.prepare(`
      SELECT
        v.source_id AS id,
        v.slug,
        v.original_title AS title,
        v.display_title AS sceneTitle,
        w.title AS workTitle,
        v.description,
        v.year,
        v.duration_seconds AS durationSeconds,
        v.type,
        v.rating,
        v.popularity_rank AS popularityRank,
        v.thumbnail_key AS thumbnailKey,
        v.player_aspect_ratio AS playerAspectRatio,
        v.embed_id AS embedId,
        v.published_at AS publishedAt,
        (SELECT group_concat(name, '|') FROM (SELECT a.name FROM video_actresses va JOIN actresses a ON a.id = va.actress_id WHERE va.video_id = v.id ORDER BY va.position)) AS actressNames,
        (SELECT group_concat(name, '|') FROM (SELECT t.name FROM video_tags vt JOIN tags t ON t.id = vt.tag_id WHERE vt.video_id = v.id ORDER BY t.name)) AS tagNames
      FROM videos v
      LEFT JOIN works w ON w.id = v.work_id
      WHERE ${where.sql}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `).bind(...where.values, pageSize, (page - 1) * pageSize);
    const result = await statement.all<VideoRow>();
    return { items: (result.results ?? []).map(toVideo), total: Number(countRow?.total ?? 0), page, pageSize, database: true };
  } catch {
    return fallback(options);
  }
}

export async function getVideoBySlug(slug: string) {
  const db = database();
  if (!db) return seedVideos.find((video) => video.slug === slug);
  try {
    const result = await db.prepare(`
      SELECT
        v.source_id AS id, v.slug, v.original_title AS title, v.display_title AS sceneTitle,
        w.title AS workTitle, v.description, v.year, v.duration_seconds AS durationSeconds,
        v.type, v.rating, v.popularity_rank AS popularityRank, v.thumbnail_key AS thumbnailKey,
        v.player_aspect_ratio AS playerAspectRatio,
        v.embed_id AS embedId,
        v.published_at AS publishedAt,
        (SELECT group_concat(name, '|') FROM (SELECT a.name FROM video_actresses va JOIN actresses a ON a.id = va.actress_id WHERE va.video_id = v.id ORDER BY va.position)) AS actressNames,
        (SELECT group_concat(name, '|') FROM (SELECT t.name FROM video_tags vt JOIN tags t ON t.id = vt.tag_id WHERE vt.video_id = v.id ORDER BY t.name)) AS tagNames
      FROM videos v LEFT JOIN works w ON w.id = v.work_id
      WHERE v.slug = ? AND v.is_active = 1 LIMIT 1
    `).bind(slug).first<VideoRow>();
    return result ? toVideo(result) : undefined;
  } catch {
    return seedVideos.find((video) => video.slug === slug);
  }
}

function relatedScore(current: Video, candidate: Video) {
  const currentActresses = new Set(current.actresses.map(slugify));
  const currentTags = new Set(current.tags.map(slugify));
  const sharedActresses = candidate.actresses.filter((name) => currentActresses.has(slugify(name))).length;
  const sharedTags = candidate.tags.filter((name) => currentTags.has(slugify(name))).length;
  const yearDistance = Math.abs(current.year - candidate.year);
  return sharedActresses * 100
    + (slugify(current.workTitle) === slugify(candidate.workTitle) ? 80 : 0)
    + sharedTags * 14
    + (current.type === candidate.type ? 5 : 0)
    + Math.max(0, 8 - yearDistance);
}

export async function getRelatedVideos(video: Video, limit = 8): Promise<Video[]> {
  const safeLimit = Math.max(1, Math.min(12, limit));
  const db = database();
  if (!db) {
    return seedVideos
      .filter((candidate) => candidate.id !== video.id)
      .map((candidate) => ({ candidate, score: relatedScore(video, candidate) }))
      .filter((item) => item.score > 5)
      .sort((a, b) => b.score - a.score || b.candidate.rating - a.candidate.rating || b.candidate.id - a.candidate.id)
      .slice(0, safeLimit)
      .map((item) => item.candidate);
  }
  try {
    const result = await db.prepare(`
      WITH current_video AS (
        SELECT id, work_id, type, year FROM videos WHERE source_id = ? AND is_active = 1 LIMIT 1
      )
      SELECT
        v.source_id AS id,
        v.slug,
        v.original_title AS title,
        v.display_title AS sceneTitle,
        w.title AS workTitle,
        v.description,
        v.year,
        v.duration_seconds AS durationSeconds,
        v.type,
        v.rating,
        v.popularity_rank AS popularityRank,
        v.thumbnail_key AS thumbnailKey,
        v.player_aspect_ratio AS playerAspectRatio,
        v.embed_id AS embedId,
        v.published_at AS publishedAt,
        (SELECT group_concat(name, '|') FROM (SELECT a.name FROM video_actresses va JOIN actresses a ON a.id = va.actress_id WHERE va.video_id = v.id ORDER BY va.position)) AS actressNames,
        (SELECT group_concat(name, '|') FROM (SELECT t.name FROM video_tags vt JOIN tags t ON t.id = vt.tag_id WHERE vt.video_id = v.id ORDER BY t.name)) AS tagNames,
        (
          CASE WHEN v.work_id IS NOT NULL AND v.work_id = c.work_id THEN 80 ELSE 0 END
          + 100 * (SELECT COUNT(*) FROM video_actresses candidate_va JOIN video_actresses current_va ON current_va.actress_id = candidate_va.actress_id AND current_va.video_id = c.id WHERE candidate_va.video_id = v.id)
          + 14 * (SELECT COUNT(*) FROM video_tags candidate_vt JOIN video_tags current_vt ON current_vt.tag_id = candidate_vt.tag_id AND current_vt.video_id = c.id WHERE candidate_vt.video_id = v.id)
          + CASE WHEN v.type = c.type THEN 5 ELSE 0 END
          + MAX(0, 8 - ABS(COALESCE(v.year, 0) - COALESCE(c.year, 0)))
        ) AS relevance
      FROM videos v
      JOIN current_video c
      LEFT JOIN works w ON w.id = v.work_id
      WHERE v.is_active = 1
        AND v.id <> c.id
        AND (
          (v.work_id IS NOT NULL AND v.work_id = c.work_id)
          OR EXISTS (SELECT 1 FROM video_actresses candidate_va JOIN video_actresses current_va ON current_va.actress_id = candidate_va.actress_id AND current_va.video_id = c.id WHERE candidate_va.video_id = v.id)
          OR EXISTS (SELECT 1 FROM video_tags candidate_vt JOIN video_tags current_vt ON current_vt.tag_id = candidate_vt.tag_id AND current_vt.video_id = c.id WHERE candidate_vt.video_id = v.id)
          OR (v.type = c.type AND ABS(COALESCE(v.year, 0) - COALESCE(c.year, 0)) <= 3)
        )
      ORDER BY relevance DESC, v.rating DESC, v.id DESC
      LIMIT ?
    `).bind(video.id, safeLimit).all<VideoRow>();
    return (result.results ?? []).map(toVideo);
  } catch {
    return seedVideos
      .filter((candidate) => candidate.id !== video.id)
      .map((candidate) => ({ candidate, score: relatedScore(video, candidate) }))
      .filter((item) => item.score > 5)
      .sort((a, b) => b.score - a.score || b.candidate.rating - a.candidate.rating)
      .slice(0, safeLimit)
      .map((item) => item.candidate);
  }
}

function seedWorks(type: VideoType): DirectoryEntry[] {
  const map = new Map<string, DirectoryEntry>();
  seedVideos.filter((video) => video.type === type).forEach((video) => {
    const slug = slugify(video.workTitle);
    const current = map.get(slug);
    map.set(slug, { name: video.workTitle, slug, initial: video.workTitle[0]?.toUpperCase() ?? "#", count: (current?.count ?? 0) + 1, description: `Celebrity scenes from ${video.workTitle}.` });
  });
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function getActressDirectory(letter?: string): Promise<DirectoryEntry[]> {
  const normalized = letter?.toUpperCase();
  const db = database();
  if (db) {
    try {
      const query = normalized ? "SELECT name, slug, initial, video_count AS count, description FROM actresses WHERE initial = ? ORDER BY sort_name" : "SELECT name, slug, initial, video_count AS count, description FROM actresses ORDER BY sort_name";
      const result = normalized ? await db.prepare(query).bind(normalized).all<DirectoryEntry>() : await db.prepare(query).all<DirectoryEntry>();
      return result.results ?? [];
    } catch { /* use seed */ }
  }
  return seedActresses.filter((item) => !normalized || item.name[0]?.toUpperCase() === normalized).map((item) => ({ ...item, initial: item.name[0]?.toUpperCase() ?? "#", description: `Movie and television scenes featuring ${item.name}.` }));
}

export async function getActressBySlug(slug: string): Promise<DirectoryEntry | undefined> {
  const db = database();
  if (db) {
    try {
      const item = await db.prepare("SELECT name, slug, initial, video_count AS count, description FROM actresses WHERE slug = ? AND video_count > 0 LIMIT 1").bind(slug).first<DirectoryEntry>();
      return item ?? undefined;
    } catch { /* use seed */ }
  }
  const actress = seedActresses.find((item) => item.slug === slug);
  return actress ? { ...actress, initial: actress.name[0]?.toUpperCase() ?? "#", description: `Movie and television scenes featuring ${actress.name}.` } : undefined;
}

export async function getWorkDirectory(type: VideoType, letter?: string): Promise<DirectoryEntry[]> {
  const normalized = letter?.toUpperCase();
  const db = database();
  if (db) {
    try {
      const values: unknown[] = [type === "TV Show" ? "tv_show" : "movie"];
      const letterSql = normalized ? " AND w.initial = ?" : "";
      if (normalized) values.push(normalized);
      const result = await db.prepare(`SELECT w.title AS name, w.slug, w.initial, COUNT(v.id) AS count, w.description FROM works w LEFT JOIN videos v ON v.work_id = w.id AND v.is_active = 1 WHERE w.type = ?${letterSql} GROUP BY w.id ORDER BY w.sort_title`).bind(...values).all<DirectoryEntry>();
      return result.results ?? [];
    } catch { /* use seed */ }
  }
  return seedWorks(type).filter((item) => !normalized || item.initial === normalized);
}

export async function getWorkBySlug(type: VideoType, slug: string): Promise<DirectoryEntry | undefined> {
  const db = database();
  if (db) {
    try {
      const dbType = type === "TV Show" ? "tv_show" : "movie";
      const item = await db.prepare(`
        SELECT w.title AS name, w.slug, w.initial, COUNT(v.id) AS count, w.description
        FROM works w JOIN videos v ON v.work_id = w.id AND v.is_active = 1
        WHERE w.type = ? AND w.slug = ?
        GROUP BY w.id LIMIT 1
      `).bind(dbType, slug).first<DirectoryEntry>();
      return item ?? undefined;
    } catch { /* use seed */ }
  }
  return seedWorks(type).find((item) => item.slug === slug);
}

export async function listDirectory(options: DirectoryOptions): Promise<DirectoryPage> {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.max(12, Math.min(60, options.pageSize ?? 36));
  const letter = /^[A-Z]$/.test(options.letter ?? "") ? options.letter : undefined;
  const term = searchTerm(options.search);
  const db = database();
  if (db) {
    try {
      if (options.kind === "actress") {
        const conditions = ["video_count > 0"];
        const values: unknown[] = [];
        if (letter) { conditions.push("initial = ?"); values.push(letter); }
        if (term) { conditions.push("lower(name) LIKE ?"); values.push(`%${term}%`); }
        const where = conditions.join(" AND ");
        const count = await db.prepare(`SELECT COUNT(*) AS total FROM actresses WHERE ${where}`).bind(...values).first<{ total: number }>();
        const result = await db.prepare(`
          SELECT name, slug, initial, video_count AS count, description
          FROM actresses WHERE ${where}
          ORDER BY CASE WHEN lower(name) = ? THEN 0 WHEN lower(name) LIKE ? THEN 1 ELSE 2 END, sort_name
          LIMIT ? OFFSET ?
        `).bind(...values, term, `${term}%`, pageSize, (page - 1) * pageSize).all<DirectoryEntry>();
        return { items: result.results ?? [], total: Number(count?.total ?? 0), page, pageSize, database: true };
      }
      const dbType = options.kind === "tv_show" ? "tv_show" : "movie";
      const conditions = ["w.type = ?", "EXISTS (SELECT 1 FROM videos active_v WHERE active_v.work_id = w.id AND active_v.is_active = 1)"];
      const values: unknown[] = [dbType];
      if (letter) { conditions.push("w.initial = ?"); values.push(letter); }
      if (term) { conditions.push("lower(w.title) LIKE ?"); values.push(`%${term}%`); }
      const where = conditions.join(" AND ");
      const count = await db.prepare(`SELECT COUNT(*) AS total FROM works w WHERE ${where}`).bind(...values).first<{ total: number }>();
      const result = await db.prepare(`
        SELECT w.title AS name, w.slug, w.initial, COUNT(v.id) AS count, w.description
        FROM works w LEFT JOIN videos v ON v.work_id = w.id AND v.is_active = 1
        WHERE ${where}
        GROUP BY w.id
        ORDER BY CASE WHEN lower(w.title) = ? THEN 0 WHEN lower(w.title) LIKE ? THEN 1 ELSE 2 END, w.sort_title
        LIMIT ? OFFSET ?
      `).bind(...values, term, `${term}%`, pageSize, (page - 1) * pageSize).all<DirectoryEntry>();
      return { items: result.results ?? [], total: Number(count?.total ?? 0), page, pageSize, database: true };
    } catch { /* use seed */ }
  }
  const source = options.kind === "actress"
    ? seedActresses.map((item) => ({ ...item, initial: item.name[0]?.toUpperCase() ?? "#", description: `Movie and television scenes featuring ${item.name}.` }))
    : seedWorks(options.kind === "tv_show" ? "TV Show" : "Movie");
  const filtered = source.filter((item) => (!letter || item.initial === letter) && (!term || item.name.toLowerCase().includes(term)));
  return { items: filtered.slice((page - 1) * pageSize, page * pageSize), total: filtered.length, page, pageSize, database: false };
}

function emptySearch(query = ""): SearchSuggestions {
  return { query, videos: [], actresses: [], movies: [], tvShows: [] };
}

export async function searchCatalog(query: string, limitPerGroup = 5): Promise<SearchSuggestions> {
  const term = searchTerm(query);
  if (term.length < 2) return emptySearch(term);
  const terms = expandedSearchTerms(term);
  const limit = Math.max(1, Math.min(8, limitPerGroup));
  const db = database();
  if (db) {
    try {
      const contains = `%${term}%`;
      const prefix = `${term}%`;
      const videoPredicate = "(lower(v.display_title) LIKE ? OR lower(v.original_title) LIKE ? OR lower(v.description) LIKE ? OR lower(w.title) LIKE ? OR EXISTS (SELECT 1 FROM video_actresses va JOIN actresses a ON a.id = va.actress_id WHERE va.video_id = v.id AND lower(a.name) LIKE ?) OR EXISTS (SELECT 1 FROM video_tags vt JOIN tags t ON t.id = vt.tag_id WHERE vt.video_id = v.id AND lower(t.name) = ?))";
      const videoWhere = terms.map(() => videoPredicate).join(" OR ");
      const videoValues = terms.flatMap((search) => [...Array(5).fill(`%${search}%`), search]);
      const [videoResult, actressResult, movieResult, tvResult] = await Promise.all([
        db.prepare(`
          SELECT v.source_id AS id, v.slug, v.display_title AS label, v.year, v.type, v.thumbnail_key AS thumbnailKey
          FROM videos v LEFT JOIN works w ON w.id = v.work_id
          WHERE v.is_active = 1 AND (${videoWhere})
          ORDER BY CASE WHEN lower(v.display_title) = ? THEN 0 WHEN lower(v.display_title) LIKE ? THEN 1 ELSE 2 END,
            CASE WHEN v.popularity_rank IS NULL THEN 1 ELSE 0 END, v.popularity_rank, v.rating DESC, v.id DESC
          LIMIT ?
        `).bind(...videoValues, term, prefix, limit).all<{ id: number; slug: string; label: string; year: number | null; type: "movie" | "tv_show"; thumbnailKey: string }>(),
        db.prepare(`
          SELECT id, name AS label, slug, video_count AS count FROM actresses
          WHERE video_count > 0 AND lower(name) LIKE ?
          ORDER BY CASE WHEN lower(name) = ? THEN 0 WHEN lower(name) LIKE ? THEN 1 ELSE 2 END, video_count DESC, sort_name
          LIMIT ?
        `).bind(contains, term, prefix, limit).all<{ id: number; label: string; slug: string; count: number }>(),
        db.prepare(`
          SELECT w.id, w.title AS label, w.slug, COUNT(v.id) AS count FROM works w
          JOIN videos v ON v.work_id = w.id AND v.is_active = 1
          WHERE w.type = 'movie' AND lower(w.title) LIKE ? GROUP BY w.id
          ORDER BY CASE WHEN lower(w.title) = ? THEN 0 WHEN lower(w.title) LIKE ? THEN 1 ELSE 2 END, count DESC, w.sort_title
          LIMIT ?
        `).bind(contains, term, prefix, limit).all<{ id: number; label: string; slug: string; count: number }>(),
        db.prepare(`
          SELECT w.id, w.title AS label, w.slug, COUNT(v.id) AS count FROM works w
          JOIN videos v ON v.work_id = w.id AND v.is_active = 1
          WHERE w.type = 'tv_show' AND lower(w.title) LIKE ? GROUP BY w.id
          ORDER BY CASE WHEN lower(w.title) = ? THEN 0 WHEN lower(w.title) LIKE ? THEN 1 ELSE 2 END, count DESC, w.sort_title
          LIMIT ?
        `).bind(contains, term, prefix, limit).all<{ id: number; label: string; slug: string; count: number }>(),
      ]);
      return {
        query: term,
        videos: (videoResult.results ?? []).map((item) => ({ id: `video-${item.id}`, label: item.label, href: `/watch/${item.slug}`, meta: `${item.year ?? ""} · ${item.type === "tv_show" ? "TV Show" : "Movie"}`, group: "videos", image: thumbnailUrl(item.thumbnailKey) })),
        actresses: (actressResult.results ?? []).map((item) => ({ id: `actress-${item.id}`, label: item.label, href: `/actress/${item.slug}`, meta: "Actress", group: "actresses" })),
        movies: (movieResult.results ?? []).map((item) => ({ id: `movie-${item.id}`, label: item.label, href: `/movie/title/${item.slug}`, meta: "Movie", group: "movies" })),
        tvShows: (tvResult.results ?? []).map((item) => ({ id: `tv-${item.id}`, label: item.label, href: `/tv-show/title/${item.slug}`, meta: "TV Show", group: "tvShows" })),
      };
    } catch { /* use seed */ }
  }
  const matches = seedVideos.filter((video) => terms.some((search) => [video.title, video.sceneTitle, video.workTitle, video.description, ...video.actresses, ...video.tags].some((value) => value.toLowerCase().includes(search))));
  const actresses = seedActresses.filter((item) => item.name.toLowerCase().includes(term)).slice(0, limit);
  const movieEntries = seedWorks("Movie").filter((item) => item.name.toLowerCase().includes(term)).slice(0, limit);
  const tvEntries = seedWorks("TV Show").filter((item) => item.name.toLowerCase().includes(term)).slice(0, limit);
  return {
    query: term,
    videos: matches.slice(0, limit).map((video) => ({ id: `video-${video.id}`, label: video.sceneTitle, href: `/watch/${video.slug}`, meta: `${video.year} · ${video.type}`, group: "videos", image: video.thumbnail })),
    actresses: actresses.map((item) => ({ id: `actress-${item.slug}`, label: item.name, href: `/actress/${item.slug}`, meta: "Actress", group: "actresses" })),
    movies: movieEntries.map((item) => ({ id: `movie-${item.slug}`, label: item.name, href: `/movie/title/${item.slug}`, meta: "Movie", group: "movies" })),
    tvShows: tvEntries.map((item) => ({ id: `tv-${item.slug}`, label: item.name, href: `/tv-show/title/${item.slug}`, meta: "TV Show", group: "tvShows" })),
  };
}

export async function getTaxonomy() {
  const db = database();
  if (db) {
    try {
      const actressOrder = POPULAR_ACTRESS_SLUGS.map((slug, index) => `WHEN '${slug}' THEN ${index}`).join(" ");
      const actressPlaceholders = POPULAR_ACTRESS_SLUGS.map(() => "?").join(",");
      const [actressResult, tagResult, yearResult] = await Promise.all([
        db.prepare(`SELECT name, slug, initial, video_count AS count, description FROM actresses WHERE video_count > 0 AND slug IN (${actressPlaceholders}) ORDER BY CASE slug ${actressOrder} ELSE 999 END LIMIT 10`).bind(...POPULAR_ACTRESS_SLUGS).all<DirectoryEntry>(),
        db.prepare("SELECT name, slug, video_count AS count FROM tags WHERE video_count > 0 ORDER BY video_count DESC, name").all<{ name: string; slug: string; count: number }>(),
        db.prepare("SELECT year, COUNT(*) AS count FROM videos WHERE is_active = 1 AND year IS NOT NULL GROUP BY year ORDER BY year DESC").all<{ year: number; count: number }>(),
      ]);
      return {
        actresses: actressResult.results ?? [],
        tags: tagResult.results ?? [],
        years: yearResult.results ?? [],
      };
    } catch { /* use seed */ }
  }
  return {
    actresses: await getActressDirectory(),
    tags: seedTags,
    years: seedYears.map((year) => ({ year, count: seedVideos.filter((video) => video.year === year).length })),
  };
}

export async function getCatalogSitemap(): Promise<CatalogSitemap> {
  const db = database();
  if (db) {
    try {
      const [videoResult, actressResult, workResult, tagResult, yearResult] = await Promise.all([
        db.prepare("SELECT slug, updated_at AS updatedAt FROM videos WHERE is_active = 1 ORDER BY id").all<{ slug: string; updatedAt: string }>(),
        db.prepare("SELECT slug, updated_at AS updatedAt FROM actresses WHERE video_count >= 2 ORDER BY id").all<{ slug: string; updatedAt: string }>(),
        db.prepare("SELECT w.slug, w.type, MAX(w.updated_at) AS updatedAt FROM works w JOIN videos v ON v.work_id = w.id AND v.is_active = 1 GROUP BY w.id HAVING COUNT(v.id) >= 2 ORDER BY w.id").all<{ slug: string; type: "movie" | "tv_show"; updatedAt: string }>(),
        db.prepare("SELECT slug FROM tags WHERE video_count >= 3 ORDER BY id").all<{ slug: string }>(),
        db.prepare("SELECT DISTINCT year FROM videos WHERE is_active = 1 AND year IS NOT NULL ORDER BY year DESC").all<{ year: number }>(),
      ]);
      return {
        videos: videoResult.results ?? [],
        actresses: actressResult.results ?? [],
        works: workResult.results ?? [],
        tags: tagResult.results ?? [],
        years: (yearResult.results ?? []).map((item) => item.year),
      };
    } catch { /* use seed */ }
  }
  const timestamp = new Date(0).toISOString();
  const actresses = [...new Set(seedVideos.flatMap((video) => video.actresses))];
  const works = [...new Map(seedVideos.map((video) => [`${video.type}:${video.workTitle}`, video])).values()];
  return {
    videos: seedVideos.map((video) => ({ slug: video.slug, updatedAt: timestamp })),
    actresses: actresses.map((name) => ({ slug: slugify(name), updatedAt: timestamp })),
    works: works.map((video) => ({ slug: slugify(video.workTitle), type: video.type === "Movie" ? "movie" : "tv_show", updatedAt: timestamp })),
    tags: seedTags.map((tag) => ({ slug: tag.slug })),
    years: seedYears,
  };
}
