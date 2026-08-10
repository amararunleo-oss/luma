# Parallel catalog import

Use this workflow only after stopping the normal all-pages importer. The main catalog remains unchanged while workers run.

## 1. Stop and prepare

Stop the current importer with `Ctrl+C`, then run:

```powershell
npm run catalog:parallel:prepare -- --confirm-stopped --workers 3 --delay-ms 1000 --concurrency 3
```

Preparation reads the latest completed `new` checkpoint, splits only the remaining pages into non-overlapping ranges, and prints one command per worker.

## 2. Run workers

Open three PowerShell terminals and run one command in each:

```powershell
npm run catalog:parallel:worker -- --worker 1
npm run catalog:parallel:worker -- --worker 2
npm run catalog:parallel:worker -- --worker 3
```

If a worker stops, rerun its same command. Its isolated checkpoint resumes within its assigned range.

Check progress at any time:

```powershell
npm run catalog:parallel:status
```

## 3. Merge

After all workers report complete and every worker terminal has exited:

```powershell
npm run catalog:parallel:merge -- --confirm-stopped
```

The merge validates every assigned page, rejects malformed/out-of-range rows, merges duplicate source IDs and listing metadata, writes replacement files first, backs up the previous main files, and then replaces the main catalog and checkpoint. Worker files and backups are retained.

Do not run `catalog:db:build` or `catalog:sync:local` before the merge succeeds.
