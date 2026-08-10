#!/usr/bin/env node

import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { activeManifest, activeRunPath, parallelRoot, parseOptions, positiveInteger, projectPath, readJson, relative, stagingRoot, writeJsonAtomic } from "./parallel-common.mjs";

const options = parseOptions(process.argv.slice(2));
if (!options["confirm-stopped"]) throw new Error("Stop the current importer first, then rerun with --confirm-stopped.");

const workersRequested = positiveInteger(options.workers, 3, "--workers");
const delayMs = positiveInteger(options["delay-ms"], 1000, "--delay-ms");
const concurrency = positiveInteger(options.concurrency, 3, "--concurrency");
if (workersRequested > 6) throw new Error("--workers cannot exceed 6.");
if (delayMs < 500) throw new Error("--delay-ms must be at least 500.");
if (concurrency > 4) throw new Error("--concurrency cannot exceed 4.");

try {
  const active = await activeManifest();
  if (active.manifest.status !== "merged") throw new Error(`Parallel run ${active.manifest.runId} is still ${active.manifest.status}. Complete or archive it before preparing another run.`);
} catch (error) {
  if (!String(error.message).startsWith("No prepared parallel run")) throw error;
}

const statePath = path.join(stagingRoot, "state-new.json");
const mainCatalog = path.join(stagingRoot, "catalog.jsonl");
const state = await readJson(statePath);
const mainCatalogStat = await stat(mainCatalog);
if (state.listing !== "new") throw new Error("state-new.json does not describe the new listing.");
if (state.partialPage) throw new Error(`Page ${state.partialPage} is partial. Resume the normal importer until it completes that page, then stop it.`);
const lastCompletedPage = positiveInteger(state.lastCompletedPage, 0, "lastCompletedPage");
const totalPages = positiveInteger(state.totalPages, 0, "totalPages");
if (lastCompletedPage >= totalPages) throw new Error("The new catalog listing is already complete; no parallel ranges remain.");

const firstPage = lastCompletedPage + 1;
const remainingPages = totalPages - lastCompletedPage;
const workerCount = Math.min(workersRequested, remainingPages);
const baseSize = Math.floor(remainingPages / workerCount);
const extra = remainingPages % workerCount;
const runId = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
const runDirectory = path.join(parallelRoot, "runs", runId);
// A fresh project will not have parallel/runs yet. Create the complete parent
// chain while retaining a unique timestamped directory for this run.
await mkdir(runDirectory, { recursive: true });

let cursor = firstPage;
const workers = Array.from({ length: workerCount }, (_, index) => {
  const pages = baseSize + (index < extra ? 1 : 0);
  const startPage = cursor;
  const endPage = startPage + pages - 1;
  cursor = endPage + 1;
  const directory = path.join(runDirectory, `worker-${index + 1}`);
  return { id: index + 1, startPage, endPage, pages, directory: relative(directory), catalog: relative(path.join(directory, "catalog.jsonl")), state: relative(path.join(directory, "state-new.json")), marker: relative(path.join(directory, "completed.json")) };
});
for (const worker of workers) await mkdir(projectPath(worker.directory), { recursive: true });

const manifestPath = path.join(runDirectory, "manifest.json");
const manifest = {
  version: 1,
  runId,
  status: "prepared",
  createdAt: new Date().toISOString(),
  listing: "new",
  mainCatalog: relative(mainCatalog),
  mainState: relative(statePath),
  mainCatalogSizeAtPrepare: mainCatalogStat.size,
  mainCatalogModifiedAtPrepare: mainCatalogStat.mtime.toISOString(),
  mainStateUpdatedAtPrepare: state.updatedAt,
  outputDirectory: "storage/previews",
  baseLastCompletedPage: lastCompletedPage,
  firstPage,
  totalPages,
  remainingPages,
  delayMs,
  concurrency,
  workers,
};
await writeJsonAtomic(manifestPath, manifest);
await writeJsonAtomic(activeRunPath, { runId, manifest: relative(manifestPath), createdAt: manifest.createdAt });

console.log(`Prepared parallel run ${runId}`);
console.log(`Frozen main checkpoint: ${lastCompletedPage}/${totalPages}`);
console.log(`Remaining pages: ${remainingPages} across ${workerCount} workers`);
for (const worker of workers) console.log(`Worker ${worker.id}: pages ${worker.startPage}-${worker.endPage} (${worker.pages})`);
console.log("\nOpen one PowerShell terminal per worker and run:");
for (const worker of workers) console.log(`npm run catalog:parallel:worker -- --worker ${worker.id}`);
console.log("\nDo not restart the original all-pages importer and do not run catalog:sync:local until merge succeeds.");
