#!/usr/bin/env node

import { existsSync } from "node:fs";
import process from "node:process";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID?.trim();
const apiToken = process.env.CLOUDFLARE_D1_API_TOKEN?.trim();
if (!accountId || !databaseId || !apiToken) throw new Error("Cloudflare D1 environment variables are required.");

async function query(sql) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/d1/database/${encodeURIComponent(databaseId)}/query`, {
    method: "POST",
    headers: { authorization: `Bearer ${apiToken}`, "content-type": "application/json" },
    body: JSON.stringify({ sql }),
    signal: AbortSignal.timeout(30_000),
  });
  const payload = await response.json();
  if (!response.ok || !payload.success || !payload.result?.[0]?.success) throw new Error(payload.errors?.[0]?.message || `D1 returned HTTP ${response.status}`);
  return payload.result[0].results?.[0] ?? {};
}

const summary = await query(`
  SELECT
    COUNT(*) AS active_videos,
    SUM(CASE WHEN trim(display_title) = '' THEN 1 ELSE 0 END) AS missing_titles,
    SUM(CASE WHEN year IS NULL OR year < 1900 THEN 1 ELSE 0 END) AS missing_years,
    SUM(CASE WHEN duration_seconds <= 0 THEN 1 ELSE 0 END) AS missing_durations,
    SUM(CASE WHEN trim(thumbnail_key) = '' THEN 1 ELSE 0 END) AS missing_thumbnails,
    SUM(CASE WHEN embed_id <= 0 THEN 1 ELSE 0 END) AS missing_embeds,
    SUM(CASE WHEN work_id IS NULL THEN 1 ELSE 0 END) AS missing_works,
    SUM(CASE WHEN NOT EXISTS (SELECT 1 FROM video_actresses va WHERE va.video_id = videos.id) THEN 1 ELSE 0 END) AS missing_actresses,
    SUM(CASE WHEN NOT EXISTS (SELECT 1 FROM video_tags vt WHERE vt.video_id = videos.id) THEN 1 ELSE 0 END) AS missing_tags
  FROM videos WHERE is_active = 1
`);
const entities = await query(`
  SELECT
    (SELECT COUNT(*) FROM actresses WHERE video_count > 0) AS actresses,
    (SELECT COUNT(*) FROM works w WHERE EXISTS (SELECT 1 FROM videos v WHERE v.work_id = w.id AND v.is_active = 1)) AS works,
    (SELECT COUNT(*) FROM tags WHERE video_count > 0) AS tags,
    (SELECT COUNT(*) FROM (SELECT slug FROM videos WHERE is_active = 1 GROUP BY slug HAVING COUNT(*) > 1)) AS duplicate_video_slugs,
    (SELECT COUNT(*) FROM (SELECT source_id FROM videos WHERE is_active = 1 GROUP BY source_id HAVING COUNT(*) > 1)) AS duplicate_source_ids
`);

console.log("Catalog SEO audit");
for (const [key, value] of Object.entries({ ...summary, ...entities })) console.log(`${key}: ${Number(value).toLocaleString("en-US")}`);

const critical = ["missing_titles", "missing_thumbnails", "missing_embeds", "missing_works", "missing_actresses", "duplicate_video_slugs", "duplicate_source_ids"];
if (critical.some((key) => Number({ ...summary, ...entities }[key]) > 0)) {
  console.error("Critical SEO/data issues found.");
  process.exitCode = 1;
} else {
  console.log("No critical SEO/data integrity issues found.");
}
