#!/usr/bin/env node

import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs, probeUrl, readJsonl, upsertJsonl } from "./single-video-utils.mjs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const options = parseArgs(process.argv.slice(2));
const slug = String(options.slug ?? "").trim();
if (!slug) throw new Error("Provide --slug from the local add command.");
if (!options.execute) throw new Error("Dry-run protection: add --execute to publish the selected record.");
const stagingPath = path.resolve(options.input ?? "data/staging/pornhub/manual.jsonl");
const productionPath = path.resolve(options.out ?? "data/catalog/pornhub-manual.jsonl");
const staging = await readJsonl(stagingPath);
const record = staging.find((item) => item.slug === slug);
if (!record) throw new Error(`Local manual record not found: ${slug}`);

const [thumbnail, embed] = await Promise.all([probeUrl(record.thumbnailUrl, "thumbnail"), probeUrl(record.embedUrl, "embed")]);
if (!thumbnail.ok || !embed.ok) throw new Error(`Live validation failed (thumbnail=${thumbnail.status}, embed=${embed.status}).`);
record.thumbnailUrl = thumbnail.finalUrl || record.thumbnailUrl;
record.validation = { checkedAt: new Date().toISOString(), thumbnail, embed };

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID?.trim();
const apiToken = process.env.CLOUDFLARE_D1_API_TOKEN?.trim();
if (!accountId || !databaseId || !apiToken) throw new Error("Cloudflare D1 environment variables are missing from .env.local.");

async function d1(sql, params = []) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/d1/database/${encodeURIComponent(databaseId)}/query`, {
    method: "POST",
    headers: { authorization: `Bearer ${apiToken}`, "content-type": "application/json" },
    body: JSON.stringify({ sql, params }),
    signal: AbortSignal.timeout(30_000),
  });
  const payload = await response.json();
  if (!response.ok || !payload.success || !payload.result?.[0]?.success) throw new Error(payload.errors?.[0]?.message || `D1 returned HTTP ${response.status}`);
  return payload.result[0];
}

await d1(`CREATE TABLE IF NOT EXISTS pornhub_manual_videos (
  source_id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  published_at TEXT NOT NULL,
  collections_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`);
await d1(`INSERT INTO pornhub_manual_videos(source_id, slug, title, payload_json, published_at, collections_json, status)
  VALUES (?, ?, ?, ?, ?, ?, 'active')
  ON CONFLICT(source_id) DO UPDATE SET slug=excluded.slug, title=excluded.title, payload_json=excluded.payload_json,
  published_at=excluded.published_at, collections_json=excluded.collections_json, status='active', updated_at=CURRENT_TIMESTAMP`,
  [String(record.sourceId), record.slug, record.title, JSON.stringify(record), record.publishedAt, JSON.stringify(record.collections ?? [])]);

const productionRecords = await upsertJsonl(productionPath, record);
const origin = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.actrexx.online").origin;
const changedUrls = [new URL(`/watch/${record.slug}`, origin).toString(), ...record.collections.map((item) => new URL(`/porn-category/${item}`, origin).toString())];
const notifyPath = path.resolve("data/staging/pornhub/indexnow-single-video.txt");
await mkdir(path.dirname(notifyPath), { recursive: true });
await writeFile(notifyPath, `${[...new Set(changedUrls)].join("\n")}\n`, "utf8");

console.log(`Published registry row to D1 and promoted ${record.title}.`);
console.log(`Production catalog: ${productionPath} (${productionRecords.length} manual record(s))`);
console.log("Redis writes: 0 (a new Vercel deployment starts a fresh in-memory catalog; remote invalidation is unnecessary)." );
console.log("Sitemap: automatic after deployment through the shared catalog loader." );
console.log("Next: npm run build, commit/push the production catalog, wait for deployment, then run:");
console.log(`npm run seo:indexnow -- --file "${notifyPath}"`);

