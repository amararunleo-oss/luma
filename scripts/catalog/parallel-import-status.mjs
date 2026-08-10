#!/usr/bin/env node

import { stat } from "node:fs/promises";
import { activeManifest, projectPath, readJson, scanJsonl } from "./parallel-common.mjs";

const { manifest } = await activeManifest();
console.log(`Parallel run ${manifest.runId} · ${manifest.status}`);
console.log(`Base checkpoint ${manifest.baseLastCompletedPage}/${manifest.totalPages}`);
let complete = 0;
for (const worker of manifest.workers) {
  let state = null;
  let lines = 0;
  try { state = await readJson(projectPath(worker.state)); } catch (error) { if (error.code !== "ENOENT") throw error; }
  try { await stat(projectPath(worker.catalog)); ({ lines } = await scanJsonl(projectPath(worker.catalog), () => {})); } catch (error) { if (error.code !== "ENOENT") throw error; }
  const last = Math.min(worker.endPage, Number(state?.lastCompletedPage ?? worker.startPage - 1));
  const pagesDone = Math.max(0, last - worker.startPage + 1);
  const percent = Math.floor((pagesDone / worker.pages) * 100);
  const done = pagesDone >= worker.pages && !state?.partialPage;
  if (done) complete += 1;
  console.log(`Worker ${worker.id}: ${done ? "complete" : state ? "running/incomplete" : "not started"} · ${pagesDone}/${worker.pages} pages (${percent}%) · ${lines} JSONL rows`);
}
console.log(`${complete}/${manifest.workers.length} workers complete.`);
