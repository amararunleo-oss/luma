import { createReadStream, createWriteStream } from "node:fs";
import { once } from "node:events";
import { resolve } from "node:path";
import { createInterface } from "node:readline";

const inputPath = resolve(process.argv[2] ?? "data/staging/videocelebs/local-sync.sql");
const outputPath = resolve(process.argv[3] ?? "data/staging/videocelebs/local-sync.d1.sql");
const transactionStatements = new Set(["BEGIN TRANSACTION;", "COMMIT;"]);

const input = createReadStream(inputPath, { encoding: "utf8" });
const output = createWriteStream(outputPath, { encoding: "utf8" });
const lines = createInterface({ input, crlfDelay: Infinity });

let kept = 0;
let removed = 0;

for await (const line of lines) {
  if (transactionStatements.has(line.trim())) {
    removed += 1;
    continue;
  }

  if (!output.write(`${line}\n`)) {
    await once(output, "drain");
  }
  kept += 1;
}

output.end();
await once(output, "finish");

if (removed !== transactionStatements.size) {
  throw new Error(`Expected to remove 2 transaction statements, removed ${removed}.`);
}

console.log(`Prepared D1 import SQL: ${outputPath}`);
console.log(`Kept ${kept.toLocaleString()} lines; removed ${removed} transaction wrapper lines.`);
