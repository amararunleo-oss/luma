# Pornhub embed catalog import

This pipeline reads the official pipe-delimited embed dump as a stream. It does not download videos or thumbnails and never loads the 17 GB file into memory.

## 1. Speed benchmark

```powershell
npm run pornhub:benchmark -- --input "C:\projects\pornhub.com-db\pornhub.com-db.csv"
```

The benchmark scans 250,000 rows and writes a temporary selection/report under `data/staging/pornhub-benchmark`. Multiply its elapsed time by roughly 20 for a first full-scan estimate.

## 2. Select 10,000 records

```powershell
npm run pornhub:select -- --input "C:\projects\pornhub.com-db\pornhub.com-db.csv" --target 10000 --min-year 2023 --max-year 2026 --out data/staging/pornhub
```

The 2023–2026 range is also the script default. Records without a reliable date in the official thumbnail URL are rejected rather than treated as recent. The command checkpoints every 500,000 rows. Re-running the exact command resumes from `scan.checkpoint.json.gz`; a changed target or year range automatically invalidates the old checkpoint. Use `--no-resume` for a clean scan or `--no-checkpoint` for a one-shot run.

For a quick recent-tail test without scanning from byte zero, pass `--start-byte <offset>`. The first partial row at that byte is safely rejected and subsequent complete rows are processed normally.

Outputs:

- `selected.jsonl`: import-ready metadata and official embed/thumbnail URLs.
- `categories.json`: every source category discovered in the dump with its count.
- `report.json`: selected counts for 25 curated collections and rejection statistics.

The selection is balanced across popular, recent, reliable top-rated and diversity lanes. Ambiguous-age, non-consensual, leaked and real-person deepfake terms are excluded conservatively.

## 3. Optional live URL validation

```powershell
npm run pornhub:validate -- --input data/staging/pornhub/selected.jsonl --out data/staging/pornhub/validated.jsonl --concurrency 6 --retries 2
```

Validation is network-heavy and is intentionally separate. It verifies the embed page and thumbnail, retries transient errors, uses the small thumbnail as fallback, and writes failures to `validation-rejected.jsonl`.

## 4. Backfill a partially valid selection

Keep the first selection and validation untouched. Select fresh candidates into a separate directory while excluding every source ID already considered, validate that batch, and merge only enough valid records to reach the final target:

```powershell
npm run pornhub:select -- --input "C:\projects\pornhub.com-db\pornhub.com-db.csv" --out data/staging/pornhub-backfill --target 7000 --min-year 2023 --max-year 2026 --min-views 400000 --min-rating 78 --min-votes 25 --max-title-duplicates 2 --max-performer-videos 30 --exclude data/staging/pornhub/selected.jsonl --checkpoint-every 250000 --no-resume

npm run pornhub:validate -- --input data/staging/pornhub-backfill/selected.jsonl --out data/staging/pornhub-backfill/validated.jsonl --concurrency 6 --timeout-ms 12000 --retries 2

npm run pornhub:merge -- --base data/staging/pornhub/validated.jsonl --add data/staging/pornhub-backfill/validated.jsonl --out data/staging/pornhub/final.jsonl --target 10000 --max-title-duplicates 2 --max-performer-videos 30
```

The merge preserves all valid base records, de-duplicates source IDs and embed URLs, applies title and performer caps to additions, and writes a sidecar report next to `final.jsonl`.
