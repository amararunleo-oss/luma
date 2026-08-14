# Pornhub 10K production sync

This sync publishes the validated `data/staging/pornhub/final.jsonl` catalog to both Cloudflare D1 and Upstash Redis without committing the 23+ MB source catalog to Git.

## Safety and quota model

- D1 receives 10,000 idempotent row upserts in resumable 50-row batches. Rerunning does not create duplicates.
- Upstash receives gzip-compressed 250-record chunks and one manifest. The manifest is switched only after every new chunk succeeds.
- A normal 10K catalog uses roughly 40 Redis chunks and only tens of Redis write commands, not 10,000 commands.
- The runtime performs one manifest read plus one `MGET` per cold server instance, then keeps the parsed catalog in memory.
- If Redis is temporarily unavailable, production falls back to the small committed featured catalog instead of failing the site.
- The script never uploads thumbnails and does not use R2.

## 1. Confirm the final catalog

```powershell
cd C:\projects\vidceleb
(Get-Content data\staging\pornhub\final.jsonl | Measure-Object -Line).Lines
```

Expected output: `10000`.

## 2. Dry-run the plan

```powershell
npm run pornhub:sync:production -- --input data/staging/pornhub/final.jsonl --expected-count 10000
```

This checks JSON, required metadata, categories, source-ID uniqueness and slug uniqueness. It prints record count, content version, estimated compressed size, D1 batches and Redis chunks. It performs no remote writes.

## 3. Execute the production sync

```powershell
npm run pornhub:sync:production -- --input data/staging/pornhub/final.jsonl --expected-count 10000 --d1-batch 50 --redis-chunk 250 --delay-ms 250 --execute
```

If the terminal closes during D1 upload, run the exact same command again. It resumes using:

`data/staging/pornhub/production-sync.state.json`

After D1 completes, Redis chunks are published under a new content-hash version and the manifest switches atomically. Old-version chunks are removed only after the new manifest is live.

Do not run multiple copies of the sync command simultaneously.

## 4. Verify D1 and Redis

```powershell
npm run pornhub:sync:verify
```

Expected result:

```text
D1 active/version: 10,000 / <version>
Redis records/version/chunks: 10,000 / <same-version> / <chunk-count>
D1 and Redis catalog versions match.
```

## 5. Deploy the runtime integration

The scripts and Redis runtime loader must be deployed once through Git/Vercel:

```powershell
npm run build
git add package.json db/schema.ts lib/pornhub-local-catalog.ts scripts/pornhub/sync-production-catalog.mjs scripts/pornhub/verify-production-catalog.mjs docs/PORNHUB_BULK_PRODUCTION_SYNC.md
git commit -m "Add quota-safe Pornhub catalog sync"
git push origin main
```

The Redis data may be uploaded before or after this deployment. Before upload, the deployed app continues using the committed featured fallback. Once the manifest exists, a new production server instance loads all 10K records.

## 6. Sitemap behavior

Normal and video sitemaps use the same catalog loader as listing and watch pages. After deployment sees the Redis manifest, sitemap descriptors and entries include the 10K records automatically. Do not submit 10,000 URLs individually and do not repeatedly submit IndexNow for the historical catalog.

Submit the sitemap index once if it has never been submitted:

```text
https://www.actrexx.online/sitemap.xml
```

For later individual additions, continue using the single-video workflow and changed-URL IndexNow submission.

## Environment variables required in local `.env.local` and Vercel

```text
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_D1_DATABASE_ID
CLOUDFLARE_D1_API_TOKEN
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

Never commit their values.
