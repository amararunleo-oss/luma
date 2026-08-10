#!/usr/bin/env node

import { open, readFile, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { activeManifest, parseOptions, positiveInteger, projectPath, readJson, writeJsonAtomic } from "./parallel-common.mjs";

const options = parseOptions(process.argv.slice(2));
const workerId = positiveInteger(options.worker, 0, "--worker");
const { manifest } = await activeManifest();
if (!["prepared", "running"].includes(manifest.status)) throw new Error(`Parallel run is ${manifest.status}; workers cannot start.`);
const worker = manifest.workers.find((item) => item.id === workerId);
if (!worker) throw new Error(`Worker ${workerId} is not present in the active manifest.`);
const directory = projectPath(worker.directory);
const lockPath = path.join(directory, "worker.lock");

async function processAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch { return false; }
}

try {
  const lock = JSON.parse(await readFile(lockPath, "utf8"));
  if (!options["force-unlock"] && await processAlive(Number(lock.pid))) throw new Error(`Worker ${workerId} is already running as PID ${lock.pid}.`);
  await rm(lockPath, { force: true });
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

const lockHandle = await open(lockPath, "wx");
await lockHandle.writeFile(`${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })}\n`);
await lockHandle.close();

try {
  const importer = path.resolve("scripts/import-videocelebs-catalog.mjs");
  const args = [
    importer,
    "--listing", "new",
    "--start-page", String(worker.startPage),
    "--pages", String(worker.pages),
    "--delay-ms", String(manifest.delayMs),
    "--concurrency", String(manifest.concurrency),
    "--out", manifest.outputDirectory,
    "--catalog", worker.catalog,
    "--execute",
    "--resume",
  ];
  console.log(`Worker ${workerId}: pages ${worker.startPage}-${worker.endPage}`);
  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: process.cwd(), stdio: "inherit", windowsHide: true });
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
  if (exitCode !== 0) throw new Error(`Worker ${workerId} importer exited with code ${exitCode}. Rerun the same command to resume.`);

  const state = await readJson(projectPath(worker.state));
  if (state.partialPage || state.lastCompletedPage < worker.endPage) throw new Error(`Worker ${workerId} stopped at page ${state.lastCompletedPage}; expected ${worker.endPage}. Rerun it to resume.`);
  await writeJsonAtomic(projectPath(worker.marker), { worker: workerId, startPage: worker.startPage, endPage: worker.endPage, completedAt: new Date().toISOString() });
  console.log(`Worker ${workerId} complete: pages ${worker.startPage}-${worker.endPage}`);
} finally {
  await rm(lockPath, { force: true });
}
