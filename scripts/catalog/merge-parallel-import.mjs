#!/usr/bin/env node

import { mkdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { activeManifest, parseOptions, projectPath, readJson, mergeRecord, scanJsonl, writeJsonAtomic } from "./parallel-common.mjs";

const options = parseOptions(process.argv.slice(2));
if (!options["confirm-stopped"]) throw new Error("Ensure every importer is stopped, then rerun with --confirm-stopped.");
const { manifestPath, manifest } = await activeManifest();
if (manifest.status === "merged") throw new Error(`Parallel run ${manifest.runId} has already been merged.`);

const frozenState = await readJson(projectPath(manifest.mainState));
const frozenCatalogStat = await stat(projectPath(manifest.mainCatalog));
if (Number(frozenState.lastCompletedPage) !== Number(manifest.baseLastCompletedPage) || frozenState.partialPage || frozenState.updatedAt !== manifest.mainStateUpdatedAtPrepare || frozenCatalogStat.size !== manifest.mainCatalogSizeAtPrepare) {
  throw new Error("The main importer/catalog changed after parallel preparation. Merge was aborted to prevent lost records.");
}

for (const worker of manifest.workers) {
  const state = await readJson(projectPath(worker.state)).catch(() => null);
  const marker = await readJson(projectPath(worker.marker)).catch(() => null);
  if (!state || !marker || state.partialPage || Number(state.lastCompletedPage) < worker.endPage) throw new Error(`Worker ${worker.id} is not complete. Run catalog:parallel:status and resume it.`);
}

const records = new Map();
const mainCatalog = projectPath(manifest.mainCatalog);
const mainScan = await scanJsonl(mainCatalog, (record) => records.set(Number(record.id), mergeRecord(records.get(Number(record.id)), record)));
const workerReport = [];
for (const worker of manifest.workers) {
  const seenPages = new Set();
  const scan = await scanJsonl(projectPath(worker.catalog), (record) => {
    const page = Number(record.listingPage);
    if (!Number.isInteger(page) || page < worker.startPage || page > worker.endPage) throw new Error(`Worker ${worker.id} contains source ID ${record.id} from out-of-range page ${record.listingPage}.`);
    seenPages.add(page);
    records.set(Number(record.id), mergeRecord(records.get(Number(record.id)), record));
  });
  const missingPages = [];
  for (let page = worker.startPage; page <= worker.endPage; page += 1) if (!seenPages.has(page)) missingPages.push(page);
  if (missingPages.length) throw new Error(`Worker ${worker.id} catalog is missing ${missingPages.length} completed page(s), starting with ${missingPages.slice(0, 5).join(", ")}.`);
  workerReport.push({ worker: worker.id, rows: scan.lines, uniquePages: seenPages.size });
}

const sorted = [...records.values()].sort((a, b) => Number(b.id) - Number(a.id));
if (sorted.length < 1) throw new Error("Merged catalog is empty.");
const runDirectory = path.dirname(manifestPath);
const temporaryDirectory = path.join(runDirectory, "merge-temp");
const backupDirectory = path.join(runDirectory, "backup");
await mkdir(temporaryDirectory, { recursive: false });
await mkdir(backupDirectory, { recursive: false });
const mainCompact = mainCatalog.replace(/\.jsonl$/i, ".json");
const mainState = projectPath(manifest.mainState);
const nextJsonl = path.join(temporaryDirectory, "catalog.jsonl");
const nextJson = path.join(temporaryDirectory, "catalog.json");
const nextState = path.join(temporaryDirectory, "state-new.json");
await writeFile(nextJsonl, sorted.map((record) => JSON.stringify(record)).join("\n") + "\n", "utf8");
await writeFile(nextJson, `${JSON.stringify(sorted, null, 2)}\n`, "utf8");
await writeFile(nextState, `${JSON.stringify({ listing: "new", lastCompletedPage: manifest.totalPages, partialPage: null, totalPages: manifest.totalPages, updatedAt: new Date().toISOString() }, null, 2)}\n`, "utf8");

const targets = [
  { target: mainCatalog, replacement: nextJsonl, backup: path.join(backupDirectory, "catalog.jsonl") },
  { target: mainCompact, replacement: nextJson, backup: path.join(backupDirectory, "catalog.json") },
  { target: mainState, replacement: nextState, backup: path.join(backupDirectory, "state-new.json") },
];
const backedUp = [];
try {
  for (const item of targets) {
    await rename(item.target, item.backup);
    backedUp.push(item);
    await rename(item.replacement, item.target);
  }
} catch (error) {
  for (const item of backedUp.reverse()) {
    await rm(item.target, { force: true });
    await rename(item.backup, item.target);
  }
  throw error;
}

const completedManifest = { ...manifest, status: "merged", mergedAt: new Date().toISOString(), merge: { mainRowsRead: mainScan.lines, finalUniqueRecords: sorted.length, workerReport, backupDirectory: path.relative(process.cwd(), backupDirectory).replaceAll(path.sep, "/") } };
await writeJsonAtomic(manifestPath, completedManifest);
await writeJsonAtomic(path.join(runDirectory, "merge-report.json"), completedManifest.merge);
await rm(temporaryDirectory, { recursive: true, force: true });
console.log(`Merge complete: ${sorted.length} unique records.`);
console.log(`Main checkpoint: ${manifest.totalPages}/${manifest.totalPages}`);
console.log(`Recoverable pre-merge files: ${completedManifest.merge.backupDirectory}`);
console.log("Worker part files were retained. You may now run listing enrichment, then build/sync the database.");
