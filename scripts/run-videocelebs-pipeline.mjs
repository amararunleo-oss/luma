#!/usr/bin/env node

/**
 * Resumable authorized catalog pipeline.
 *
 * 1. Imports every record from the chronological listing with full detail metadata
 *    and one canonical preview image.
 * 2. Merges popular ordering without re-downloading details or images.
 * 3. Merges top-rated ordering without re-downloading details or images.
 */

import { spawn } from "node:child_process";

const importer = "scripts/import-videocelebs-catalog.mjs";
const shared = [
  "--pages", "all",
  "--delay-ms", "1500",
  "--concurrency", "3",
  "--out", "storage/previews",
  "--catalog", "data/staging/videocelebs/catalog.jsonl",
  "--execute",
  "--resume",
];

function run(label, args) {
  console.log(`\n=== ${label} ===`);
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [importer, ...args, ...shared], {
      cwd: process.cwd(),
      stdio: "inherit",
      windowsHide: true,
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${label} failed (${signal ? `signal ${signal}` : `exit ${code}`}).`));
    });
  });
}

try {
  await run("Latest catalog + canonical previews", ["--listing", "new"]);
  await run("Popular listing positions", ["--listing", "popular", "--listings-only"]);
  await run("Top-rated listing positions", ["--listing", "top-rated", "--listings-only"]);
  console.log("\nCatalog pipeline complete.");
} catch (error) {
  console.error(`Pipeline error: ${error.message}`);
  process.exitCode = 1;
}
