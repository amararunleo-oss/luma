import { sql } from "drizzle-orm";
import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const works = sqliteTable("works", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type", { enum: ["movie", "tv_show"] }).notNull(),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  sortTitle: text("sort_title").notNull(),
  initial: text("initial").notNull(),
  description: text("description").notNull().default(""),
  year: integer("year"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_works_type_slug_unique").on(table.type, table.slug),
  index("idx_works_type_initial_sort").on(table.type, table.initial, table.sortTitle),
]);

export const videos = sqliteTable("videos", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sourceId: integer("source_id").notNull(),
  slug: text("slug").notNull(),
  originalTitle: text("original_title").notNull(),
  displayTitle: text("display_title").notNull(),
  description: text("description").notNull().default(""),
  type: text("type", { enum: ["movie", "tv_show"] }).notNull(),
  workId: integer("work_id").references(() => works.id, { onDelete: "set null" }),
  year: integer("year"),
  durationSeconds: integer("duration_seconds").notNull().default(0),
  rating: integer("rating").notNull().default(0),
  popularityRank: integer("popularity_rank"),
  thumbnailKey: text("thumbnail_key").notNull(),
  thumbnailWidth: integer("thumbnail_width").notNull().default(280),
  thumbnailHeight: integer("thumbnail_height").notNull().default(210),
  playerAspectRatio: real("player_aspect_ratio").notNull().default(16 / 9),
  embedId: integer("embed_id").notNull(),
  sourceUrl: text("source_url").notNull(),
  publishedAt: text("published_at"),
  firstSeenAt: text("first_seen_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
}, (table) => [
  uniqueIndex("idx_videos_source_id_unique").on(table.sourceId),
  uniqueIndex("idx_videos_slug_unique").on(table.slug),
  index("idx_videos_latest").on(table.isActive, table.firstSeenAt, table.id),
  index("idx_videos_popular").on(table.isActive, table.popularityRank, table.id),
  index("idx_videos_rating").on(table.isActive, table.rating, table.id),
  index("idx_videos_work").on(table.workId, table.isActive, table.id),
  index("idx_videos_year").on(table.year, table.isActive, table.id),
]);

export const actresses = sqliteTable("actresses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  sortName: text("sort_name").notNull(),
  initial: text("initial").notNull(),
  description: text("description").notNull().default(""),
  videoCount: integer("video_count").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_actresses_slug_unique").on(table.slug),
  index("idx_actresses_initial_sort").on(table.initial, table.sortName),
]);

export const tags = sqliteTable("tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  videoCount: integer("video_count").notNull().default(0),
}, (table) => [uniqueIndex("idx_tags_slug_unique").on(table.slug)]);

export const videoActresses = sqliteTable("video_actresses", {
  videoId: integer("video_id").notNull().references(() => videos.id, { onDelete: "cascade" }),
  actressId: integer("actress_id").notNull().references(() => actresses.id, { onDelete: "cascade" }),
  position: integer("position").notNull().default(0),
}, (table) => [
  primaryKey({ columns: [table.videoId, table.actressId] }),
  index("idx_video_actresses_actress_video").on(table.actressId, table.videoId),
]);

export const videoTags = sqliteTable("video_tags", {
  videoId: integer("video_id").notNull().references(() => videos.id, { onDelete: "cascade" }),
  tagId: integer("tag_id").notNull().references(() => tags.id, { onDelete: "cascade" }),
}, (table) => [
  primaryKey({ columns: [table.videoId, table.tagId] }),
  index("idx_video_tags_tag_video").on(table.tagId, table.videoId),
]);

export const videoListings = sqliteTable("video_listings", {
  videoId: integer("video_id").notNull().references(() => videos.id, { onDelete: "cascade" }),
  listing: text("listing", { enum: ["latest", "popular", "top_rated"] }).notNull(),
  position: integer("position"),
  seenAt: text("seen_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  primaryKey({ columns: [table.videoId, table.listing] }),
  index("idx_video_listings_listing_position").on(table.listing, table.position, table.videoId),
]);

export const syncState = sqliteTable("sync_state", {
  source: text("source").primaryKey(),
  listing: text("listing").notNull(),
  lastPage: integer("last_page").notNull().default(0),
  lastSourceId: integer("last_source_id"),
  status: text("status").notNull().default("idle"),
  error: text("error"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const contentReports = sqliteTable("content_reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  videoId: integer("video_id").references(() => videos.id, { onDelete: "set null" }),
  videoSlug: text("video_slug").notNull(),
  category: text("category", { enum: ["unavailable", "thumbnail", "metadata", "duplicate", "legal", "other"] }).notNull(),
  details: text("details").notNull().default(""),
  contactEmail: text("contact_email"),
  reporterHash: text("reporter_hash").notNull(),
  status: text("status", { enum: ["open", "reviewing", "resolved", "dismissed"] }).notNull().default("open"),
  adminNote: text("admin_note").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_content_reports_status_created").on(table.status, table.createdAt),
  index("idx_content_reports_reporter_created").on(table.reporterHash, table.createdAt),
  index("idx_content_reports_video").on(table.videoId, table.createdAt),
]);

export const videoHealthChecks = sqliteTable("video_health_checks", {
  videoId: integer("video_id").primaryKey().references(() => videos.id, { onDelete: "cascade" }),
  embedStatus: text("embed_status", { enum: ["unknown", "ok", "broken", "blocked", "timeout"] }).notNull().default("unknown"),
  thumbnailStatus: text("thumbnail_status", { enum: ["unknown", "ok", "missing", "error"] }).notNull().default("unknown"),
  responseTimeMs: integer("response_time_ms"),
  failureCount: integer("failure_count").notNull().default(0),
  lastError: text("last_error").notNull().default(""),
  lastCheckedAt: text("last_checked_at"),
  nextCheckAt: text("next_check_at"),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("idx_video_health_next_check").on(table.nextCheckAt, table.embedStatus),
  index("idx_video_health_embed_status").on(table.embedStatus, table.failureCount),
]);

export const monitorRuns = sqliteTable("monitor_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  status: text("status", { enum: ["running", "completed", "failed"] }).notNull().default("running"),
  checkedCount: integer("checked_count").notNull().default(0),
  brokenCount: integer("broken_count").notNull().default(0),
  error: text("error").notNull().default(""),
  startedAt: text("started_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  completedAt: text("completed_at"),
}, (table) => [index("idx_monitor_runs_started").on(table.startedAt)]);

// Lightweight registry for individually curated Pornhub additions. Runtime pages
// read the deploy-time JSON catalog, while this table provides a durable remote
// audit/backup without rewriting the large primary catalog.
export const pornhubManualVideos = sqliteTable("pornhub_manual_videos", {
  sourceId: text("source_id").primaryKey(),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  payloadJson: text("payload_json").notNull(),
  publishedAt: text("published_at").notNull(),
  collectionsJson: text("collections_json").notNull(),
  status: text("status", { enum: ["active", "inactive"] }).notNull().default("active"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("idx_pornhub_manual_slug_unique").on(table.slug)]);

export const pornhubCatalogVideos = sqliteTable("pornhub_catalog_videos", {
  sourceId: text("source_id").primaryKey(),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
  payloadJson: text("payload_json").notNull(),
  publishedAt: text("published_at").notNull(),
  collectionsJson: text("collections_json").notNull(),
  popularityRank: integer("popularity_rank").notNull(),
  syncVersion: text("sync_version").notNull(),
  status: text("status", { enum: ["active", "inactive"] }).notNull().default("active"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_pornhub_catalog_slug_unique").on(table.slug),
  index("idx_pornhub_catalog_version_status").on(table.syncVersion, table.status, table.popularityRank),
]);
