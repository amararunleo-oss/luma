#!/usr/bin/env node

import { existsSync } from "node:fs";
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID?.trim();
const apiToken = process.env.CLOUDFLARE_D1_API_TOKEN?.trim();
const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.trim().replace(/\/$/, "");
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
if (!accountId || !databaseId || !apiToken || !redisUrl || !redisToken) throw new Error("D1 and Upstash environment variables are required.");

const d1Response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/d1/database/${encodeURIComponent(databaseId)}/query`, {
  method: "POST",
  headers: { authorization: `Bearer ${apiToken}`, "content-type": "application/json" },
  body: JSON.stringify({ sql: "SELECT sync_version, COUNT(*) AS records, SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) AS active FROM pornhub_catalog_videos GROUP BY sync_version ORDER BY active DESC LIMIT 1" }),
  signal: AbortSignal.timeout(30_000),
});
const d1Payload = await d1Response.json();
if (!d1Response.ok || !d1Payload.success || !d1Payload.result?.[0]?.success) throw new Error(d1Payload.errors?.[0]?.message || `D1 returned HTTP ${d1Response.status}`);
const d1 = d1Payload.result[0].results?.[0] ?? {};

const redisResponse = await fetch(`${redisUrl}/pipeline`, {
  method: "POST",
  headers: { authorization: `Bearer ${redisToken}`, "content-type": "application/json" },
  body: JSON.stringify([["GET", "actrexx:pornhub:catalog:manifest"]]),
  signal: AbortSignal.timeout(30_000),
});
const redisPayload = await redisResponse.json();
if (!redisResponse.ok || redisPayload?.[0]?.error || !redisPayload?.[0]?.result) throw new Error(redisPayload?.[0]?.error || "Redis manifest is missing.");
const manifest = JSON.parse(redisPayload[0].result);

console.log("Pornhub production catalog status");
console.log(`D1 active/version: ${Number(d1.active ?? 0).toLocaleString("en-US")} / ${d1.sync_version ?? "missing"}`);
console.log(`Redis records/version/chunks: ${Number(manifest.records ?? 0).toLocaleString("en-US")} / ${manifest.version ?? "missing"} / ${manifest.chunks?.length ?? 0}`);
if (String(d1.sync_version) !== String(manifest.version) || Number(d1.active) !== Number(manifest.records)) {
  console.error("D1 and Redis are not on the same catalog version.");
  process.exitCode = 1;
} else console.log("D1 and Redis catalog versions match.");

