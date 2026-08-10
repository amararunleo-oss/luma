#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const projectRoot = process.cwd();

function quote(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function slugify(value) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function initial(value) {
  return /^[a-z]/i.test(value) ? value[0].toUpperCase() : "#";
}

function durationSeconds(value) {
  const parts = String(value).split(":").map(Number);
  return parts.length === 2 ? parts[0] * 60 + parts[1] : 0;
}

async function loadVideos() {
  const source = await readFile(path.join(projectRoot, "lib/videos.ts"), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`;
  return (await import(moduleUrl)).videos;
}

async function main() {
  const videos = await loadVideos();
  const sourceCatalog = JSON.parse(await readFile(path.join(projectRoot, "data/videocelebs/catalog.json"), "utf8"));
  const sourceById = new Map(sourceCatalog.map((item) => [Number(item.id), item]));
  const lines = ["BEGIN TRANSACTION;"];

  const works = new Map();
  const actresses = new Map();
  const tags = new Map();
  for (const video of videos) {
    const workSlug = slugify(video.workTitle);
    works.set(`${video.type}:${workSlug}`, { title: video.workTitle, slug: workSlug, type: video.type === "TV Show" ? "tv_show" : "movie", year: video.year });
    video.actresses.forEach((name) => actresses.set(slugify(name), name));
    video.tags.forEach((name) => tags.set(slugify(name), name));
  }

  for (const work of works.values()) {
    lines.push(`INSERT INTO works (type,title,slug,sort_title,initial,description,year) VALUES (${quote(work.type)},${quote(work.title)},${quote(work.slug)},${quote(work.title.toLowerCase())},${quote(initial(work.title))},${quote(`Celebrity scenes from ${work.title}.`)},${quote(work.year)}) ON CONFLICT(type,slug) DO UPDATE SET title=excluded.title,sort_title=excluded.sort_title,initial=excluded.initial,description=excluded.description,year=excluded.year,updated_at=CURRENT_TIMESTAMP;`);
  }
  for (const [slug, name] of actresses) {
    lines.push(`INSERT INTO actresses (name,slug,sort_name,initial,description) VALUES (${quote(name)},${quote(slug)},${quote(name.toLowerCase())},${quote(initial(name))},${quote(`Movie and television scenes featuring ${name}.`)}) ON CONFLICT(slug) DO UPDATE SET name=excluded.name,sort_name=excluded.sort_name,initial=excluded.initial,description=excluded.description,updated_at=CURRENT_TIMESTAMP;`);
  }
  for (const [slug, name] of tags) {
    lines.push(`INSERT INTO tags (name,slug) VALUES (${quote(name)},${quote(slug)}) ON CONFLICT(slug) DO UPDATE SET name=excluded.name;`);
  }

  for (const video of videos) {
    const source = sourceById.get(Number(video.id));
    const type = video.type === "TV Show" ? "tv_show" : "movie";
    const workSlug = slugify(video.workTitle);
    lines.push(`INSERT INTO videos (source_id,slug,original_title,display_title,description,type,work_id,year,duration_seconds,rating,popularity_rank,thumbnail_key,thumbnail_width,thumbnail_height,embed_id,source_url,first_seen_at,is_active) VALUES (${quote(video.id)},${quote(video.slug)},${quote(video.title)},${quote(video.sceneTitle)},${quote(video.description)},${quote(type)},(SELECT id FROM works WHERE type=${quote(type)} AND slug=${quote(workSlug)}),${quote(video.year)},${quote(durationSeconds(video.duration))},${quote(video.rating)},${quote(video.rank)},${quote(video.thumbnail)},280,210,${quote(video.id)},${quote(source?.sourcePageUrl ?? `https://videocelebs.net/embed/${video.id}`)},${quote(source?.importedAt ?? new Date().toISOString())},1) ON CONFLICT(source_id) DO UPDATE SET slug=excluded.slug,original_title=excluded.original_title,display_title=excluded.display_title,description=excluded.description,type=excluded.type,work_id=excluded.work_id,year=excluded.year,duration_seconds=excluded.duration_seconds,rating=excluded.rating,popularity_rank=excluded.popularity_rank,thumbnail_key=excluded.thumbnail_key,embed_id=excluded.embed_id,source_url=excluded.source_url,updated_at=CURRENT_TIMESTAMP,is_active=1;`);
    lines.push(`DELETE FROM video_actresses WHERE video_id=(SELECT id FROM videos WHERE source_id=${quote(video.id)});`);
    video.actresses.forEach((name, position) => lines.push(`INSERT INTO video_actresses (video_id,actress_id,position) VALUES ((SELECT id FROM videos WHERE source_id=${quote(video.id)}),(SELECT id FROM actresses WHERE slug=${quote(slugify(name))}),${position});`));
    lines.push(`DELETE FROM video_tags WHERE video_id=(SELECT id FROM videos WHERE source_id=${quote(video.id)});`);
    video.tags.forEach((name) => lines.push(`INSERT INTO video_tags (video_id,tag_id) VALUES ((SELECT id FROM videos WHERE source_id=${quote(video.id)}),(SELECT id FROM tags WHERE slug=${quote(slugify(name))}));`));
    lines.push(`INSERT INTO video_listings (video_id,listing,position,seen_at) VALUES ((SELECT id FROM videos WHERE source_id=${quote(video.id)}),'popular',${quote(video.rank)},${quote(source?.importedAt ?? new Date().toISOString())}) ON CONFLICT(video_id,listing) DO UPDATE SET position=excluded.position,seen_at=excluded.seen_at;`);
  }

  lines.push("UPDATE actresses SET video_count=(SELECT COUNT(*) FROM video_actresses WHERE actress_id=actresses.id);");
  lines.push("UPDATE tags SET video_count=(SELECT COUNT(*) FROM video_tags WHERE tag_id=tags.id);");
  lines.push("INSERT INTO sync_state (source,listing,last_page,last_source_id,status,updated_at) VALUES ('videocelebs','popular',1,NULL,'seeded',CURRENT_TIMESTAMP) ON CONFLICT(source) DO UPDATE SET listing=excluded.listing,last_page=excluded.last_page,status=excluded.status,updated_at=CURRENT_TIMESTAMP;");
  lines.push("COMMIT;");
  lines.push("PRAGMA optimize;");

  const output = path.join(projectRoot, "db/seeds/0000_sample.sql");
  await mkdir(path.dirname(output), { recursive: true });
  await writeFile(output, `${lines.join("\n")}\n`, "utf8");
  console.log(`Wrote ${videos.length} videos to ${output}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
