# Single Pornhub video: terminal workflow

This workflow adds one official Pornhub embed from the authorized CSV without rescanning or rewriting the full production catalog. It keeps the remote free quotas predictable: one D1 upsert per published video, zero Redis writes, no thumbnail upload, and only changed URLs submitted to IndexNow.

## What each stage changes

| Stage | Local files | Cloudflare D1 | Upstash Redis | Sitemap / production |
| --- | --- | --- | --- | --- |
| Build title index | ignored SQLite index | none | none | none |
| Search + local add | ignored `manual.jsonl` | none | none | local UI only |
| Publish | committed manual catalog | one idempotent row upsert | zero writes | ready for next Git/Vercel deploy |
| Notify | none | none | none | changed watch/category URLs sent to IndexNow |

The thumbnail stays on the publisher URL supplied by the CSV, so R2 storage and write quotas are not used. A fresh Vercel deployment starts a fresh catalog process, so writing a Redis cache-buster for every video would only waste quota.

## 1. One-time searchable index

Run this once. It streams the 17 GB CSV and stores only searchable title metadata plus the original byte offset. If interrupted, run the same command again; it resumes from its last committed batch.

```powershell
cd C:\projects\vidceleb
npm run pornhub:video:index -- --input "C:/projects/pornhub.com-db/pornhub.com-db.csv"
```

To deliberately rebuild it from zero after replacing the CSV:

```powershell
npm run pornhub:video:index -- --input "C:/projects/pornhub.com-db/pornhub.com-db.csv" --rebuild
```

Generated index (Git-ignored): `data/staging/pornhub/title-index.sqlite`.

## 2. Find a title and add it locally

Interactive command:

```powershell
npm run pornhub:video:add -- --query "exact or partial video name"
```

The command:

1. shows up to 20 CSV matches with source ID, year, views, rating, categories and CSV byte position;
2. asks which match to use;
3. applies the safety and 2024-current-year policy;
4. derives strict site collections from the source tags/categories;
5. shows a complete preview and asks for confirmation;
6. validates the thumbnail and embed over the network;
7. writes only `data/staging/pornhub/manual.jsonl`.

For a non-interactive repeatable selection:

```powershell
npm run pornhub:video:add -- --query "video name" --pick 1 --yes
```

Defaults match the curated catalog quality policy: at least 400,000 views, 78% rating and 25 votes. Falling below those values is shown as a warning, not silently hidden. Safety blocks and missing required metadata are always rejected.

If the source tags do not map to a known collection, explicitly supply one or more reviewed collection slugs:

```powershell
npm run pornhub:video:add -- --query "video name" --categories "romantic,doggy-style"
```

Valid collection slugs are defined in `scripts/pornhub/taxonomy.mjs`. Older content is rejected by default. A deliberate exception requires `--allow-old`; do not use it for the normal recent catalog.

Start the site and open the URL printed by the add command:

```powershell
npm run dev
```

## 3. Promote one approved local video

Copy the slug printed by the local command:

```powershell
npm run pornhub:video:publish -- --slug "video-slug-from-previous-command" --execute
```

This validates the media again, upserts exactly one row in D1 table `pornhub_manual_videos`, promotes the record to `data/catalog/pornhub-manual.jsonl`, and creates an ignored changed-URL file for IndexNow. The D1 write is idempotent: rerunning the same slug updates the same source row and does not create a duplicate.

The production runtime reads the committed catalog; the D1 table is the durable manual publishing registry/audit copy. Category pages and watch pages both use the record's derived collections. Normal and video sitemaps read the same shared loader, so no XML file is manually edited.

## 4. Validate, deploy, then notify search engines

```powershell
npm run build
git status --short
git add data/catalog/pornhub-manual.jsonl db/schema.ts lib/pornhub-local-catalog.ts package.json scripts/pornhub docs/PORNHUB_SINGLE_VIDEO_WORKFLOW.md
git commit -m "Add curated Pornhub video"
git push origin main
```

Wait for the Vercel deployment to become ready and verify the printed production watch URL. Then submit only the changed URLs:

```powershell
npm run seo:indexnow -- --file "data/staging/pornhub/indexnow-single-video.txt"
```

Do not resubmit the entire sitemap for every single video. Its sitemap index and video sitemap update automatically with the deployment. Google will discover the changed sitemap naturally; IndexNow covers participating engines such as Bing and Yandex.

## Category and SEO guarantees

- Categories come from the same strict taxonomy used by the production category pages.
- A source record can belong to multiple matching collections, and all corresponding category URLs are included in the small IndexNow notification file.
- The watch page receives title, description, thumbnail, `uploadDate`, embed URL and duration through the existing `VideoObject` implementation.
- Duplicate source IDs and slugs are replaced idempotently in both local and production manual JSONL files.
- No local CSV or SQLite index is committed or deployed.

## Troubleshooting

**Index not found** — run the one-time index command in section 1.

**No matches** — use fewer distinctive title words. FTS search requires all entered words to match.

**`outside_year_range`** — the record is outside the default 2024-current-year catalog.

**`no_curated_collection`** — review the source metadata, then pass a valid `--categories` value only if the classification is genuinely correct.

**Thumbnail/embed validation failed** — do not publish it. Retry later in case the publisher temporarily throttled the request.

**D1 environment missing** — confirm `.env.local` contains `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_DATABASE_ID`, and `CLOUDFLARE_D1_API_TOKEN`. Secrets are read locally and never printed.

**IndexNow fails immediately after push** — wait until the new Vercel deployment serves the watch URL, then rerun only the notify command.
