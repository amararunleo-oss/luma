#!/usr/bin/env node

import { spawn } from "node:child_process";
import { rm, writeFile } from "node:fs/promises";

const importer = "scripts/import-videocelebs-catalog.mjs";
const shared = [
  "--pages", "all",
  "--delay-ms", "500",
  "--concurrency", "1",
  "--out", "storage/previews",
  "--catalog", "data/staging/videocelebs/catalog.jsonl",
  "--execute",
  "--resume",
  "--listings-only",
];

function run(listing, label) {
  console.log(`\n=== ${label} ===`);
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [importer, "--listing", listing, ...shared], {
      cwd: process.cwd(),
      stdio: "inherit",
      windowsHide: true,
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${label} failed (${signal ? `signal ${signal}` : `exit ${code}`}). Rerun the same command to resume.`));
    });
  });
}

const pidFile = "data/staging/videocelebs/rankings-import.pid";
await writeFile(pidFile, `${process.pid}\n`, "utf8");

try {
  await run("popular", "Popular listing positions");
  await run("top-rated", "Top-rated listing positions");
  console.log("\nRanking import complete. Run catalog:sync:local to refresh the local UI.");
} catch (error) {
  console.error(`Ranking pipeline error: ${error.message}`);
  process.exitCode = 1;
} finally {
  await rm(pidFile, { force: true });
}
