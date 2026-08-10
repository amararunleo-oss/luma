#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const catalogPath = path.resolve(process.argv[2] ?? "data/staging/videocelebs/catalog.jsonl");
const outputPath = path.resolve(process.argv[3] ?? "data/staging/videocelebs/local-sync.sql");

function quote(value) {
  if (value === null || value === undefined || value === "") return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function slugify(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function initial(value) {
  return /^[a-z]/i.test(value) ? value[0].toUpperCase() : "#";
}

async function readLatestRecords() {
  const source = await readFile(catalogPath, "utf8");
  const records = new Map();
  let incompleteLines = 0;
  for (const line of source.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const record = JSON.parse(line);
      records.set(Number(record.id), record);
    } catch {
      incompleteLines += 1;
    }
  }
  return { records: [...records.values()], incompleteLines };
}

const { records: sourceRecords, incompleteLines } = await readLatestRecords();
const records = sourceRecords
  .filter((record) => record.detailStatus === "ok" && record.catalogStatus !== "excluded_non_scene" && ["downloaded", "existing"].includes(record.thumbnailStatus))
  .sort((a, b) => Number(a.listings?.latest?.position ?? Number.MAX_SAFE_INTEGER) - Number(b.listings?.latest?.position ?? Number.MAX_SAFE_INTEGER));

const works = new Map();
const actresses = new Map();
const tags = new Map();

for (const record of records) {
  const workTitle = record.workTitle || record.displayTitle || record.title;
  const workSlug = record.workSlug || slugify(workTitle);
  const type = record.type === "tv_show" ? "tv_show" : "movie";
  works.set(`${type}:${workSlug}`, { type, title: workTitle, slug: workSlug, year: record.year ?? null });
  for (const name of record.actresses ?? []) actresses.set(slugify(name), name);
  for (const name of record.tags ?? []) tags.set(slugify(name), name);
}

const lines = [
  "PRAGMA foreign_keys=ON;",
  "BEGIN TRANSACTION;",
  "UPDATE videos SET is_active=0, updated_at=CURRENT_TIMESTAMP;",
  "DELETE FROM video_listings WHERE listing IN ('latest','popular','top_rated');",
];

for (const work of works.values()) {
  lines.push(`INSERT INTO works (type,title,slug,sort_title,initial,description,year) VALUES (${quote(work.type)},${quote(work.title)},${quote(work.slug)},${quote(work.title.toLowerCase())},${quote(initial(work.title))},${quote(`Celebrity scenes from ${work.title}.`)},${quote(work.year)}) ON CONFLICT(type,slug) DO UPDATE SET title=excluded.title,sort_title=excluded.sort_title,initial=excluded.initial,description=excluded.description,year=COALESCE(works.year,excluded.year),updated_at=CURRENT_TIMESTAMP;`);
}

for (const [slug, name] of actresses) {
  if (!slug) continue;
  lines.push(`INSERT INTO actresses (name,slug,sort_name,initial,description) VALUES (${quote(name)},${quote(slug)},${quote(name.toLowerCase())},${quote(initial(name))},${quote(`Movie and television scenes featuring ${name}.`)}) ON CONFLICT(slug) DO UPDATE SET name=excluded.name,sort_name=excluded.sort_name,initial=excluded.initial,description=excluded.description,updated_at=CURRENT_TIMESTAMP;`);
}

for (const [slug, name] of tags) {
  if (!slug) continue;
  lines.push(`INSERT INTO tags (name,slug) VALUES (${quote(name)},${quote(slug)}) ON CONFLICT(slug) DO UPDATE SET name=excluded.name;`);
}

for (const record of records) {
  const type = record.type === "tv_show" ? "tv_show" : "movie";
  const workTitle = record.workTitle || record.displayTitle || record.title;
  const workSlug = record.workSlug || slugify(workTitle);
  const latest = record.listings?.latest;
  const popular = record.listings?.popular;
  const firstSeenAt = latest?.seenAt || record.publishedAt || record.importedAt || new Date().toISOString();
  lines.push(`INSERT INTO videos (source_id,slug,original_title,display_title,description,type,work_id,year,duration_seconds,rating,popularity_rank,thumbnail_key,thumbnail_width,thumbnail_height,player_aspect_ratio,embed_id,source_url,published_at,first_seen_at,is_active) VALUES (${quote(record.id)},${quote(record.slug)},${quote(record.originalTitle || record.title)},${quote(record.displayTitle || workTitle)},${quote(record.description || "")},${quote(type)},(SELECT id FROM works WHERE type=${quote(type)} AND slug=${quote(workSlug)}),${quote(record.year)},${quote(record.durationSeconds ?? 0)},${quote(record.rating ?? 0)},${quote(popular?.position)},${quote(record.thumbnailKey)},${quote(record.thumbnailWidth ?? 0)},${quote(record.thumbnailHeight ?? 0)},${quote(record.playerAspectRatio ?? 16 / 9)},${quote(record.id)},${quote(record.sourcePageUrl)},${quote(record.publishedAt)},${quote(firstSeenAt)},1) ON CONFLICT(source_id) DO UPDATE SET slug=excluded.slug,original_title=excluded.original_title,display_title=excluded.display_title,description=excluded.description,type=excluded.type,work_id=excluded.work_id,year=excluded.year,duration_seconds=excluded.duration_seconds,rating=excluded.rating,popularity_rank=COALESCE(excluded.popularity_rank,videos.popularity_rank),thumbnail_key=excluded.thumbnail_key,thumbnail_width=excluded.thumbnail_width,thumbnail_height=excluded.thumbnail_height,player_aspect_ratio=excluded.player_aspect_ratio,embed_id=excluded.embed_id,source_url=excluded.source_url,published_at=excluded.published_at,updated_at=CURRENT_TIMESTAMP,is_active=1;`);
  lines.push(`DELETE FROM video_actresses WHERE video_id=(SELECT id FROM videos WHERE source_id=${quote(record.id)});`);
  const seenActresses = new Set();
  for (const [position, name] of (record.actresses ?? []).entries()) {
    const slug = slugify(name);
    if (!slug || seenActresses.has(slug)) continue;
    seenActresses.add(slug);
    lines.push(`INSERT INTO video_actresses (video_id,actress_id,position) VALUES ((SELECT id FROM videos WHERE source_id=${quote(record.id)}),(SELECT id FROM actresses WHERE slug=${quote(slug)}),${position});`);
  }
  lines.push(`DELETE FROM video_tags WHERE video_id=(SELECT id FROM videos WHERE source_id=${quote(record.id)});`);
  const seenTags = new Set();
  for (const name of record.tags ?? []) {
    const slug = slugify(name);
    if (!slug || seenTags.has(slug)) continue;
    seenTags.add(slug);
    lines.push(`INSERT INTO video_tags (video_id,tag_id) VALUES ((SELECT id FROM videos WHERE source_id=${quote(record.id)}),(SELECT id FROM tags WHERE slug=${quote(slug)}));`);
  }
  for (const [listing, value] of Object.entries(record.listings ?? {})) {
    if (!["latest", "popular", "top_rated"].includes(listing)) continue;
    lines.push(`INSERT INTO video_listings (video_id,listing,position,seen_at) VALUES ((SELECT id FROM videos WHERE source_id=${quote(record.id)}),${quote(listing)},${quote(value.position)},${quote(value.seenAt || firstSeenAt)}) ON CONFLICT(video_id,listing) DO UPDATE SET position=excluded.position,seen_at=excluded.seen_at;`);
  }
}

lines.push("UPDATE actresses SET video_count=(SELECT COUNT(*) FROM video_actresses WHERE actress_id=actresses.id);");
lines.push("UPDATE tags SET video_count=(SELECT COUNT(*) FROM video_tags WHERE tag_id=tags.id);");
lines.push(`INSERT INTO sync_state (source,listing,last_page,last_source_id,status,updated_at) VALUES ('videocelebs','latest',0,${quote(records.at(-1)?.id)},'local-snapshot',CURRENT_TIMESTAMP) ON CONFLICT(source) DO UPDATE SET listing=excluded.listing,last_source_id=excluded.last_source_id,status=excluded.status,updated_at=CURRENT_TIMESTAMP;`);
lines.push("COMMIT;", "PRAGMA optimize;");

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${lines.join("\n")}\n`, "utf8");
console.log(`Wrote ${records.length} unique videos, ${works.size} works, ${actresses.size} actresses and ${tags.size} tags to ${outputPath}.`);
if (incompleteLines) console.log(`Ignored ${incompleteLines} incomplete JSONL line(s) while the importer was appending.`);
