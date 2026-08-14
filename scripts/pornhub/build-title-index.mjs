#!/usr/bin/env node

import { createReadStream, existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { inspectPornhubRow, parseArgs } from "./single-video-utils.mjs";

const options = parseArgs(process.argv.slice(2));
const input = path.resolve(options.input ?? "C:/projects/pornhub.com-db/pornhub.com-db.csv");
const output = path.resolve(options.out ?? "data/staging/pornhub/title-index.sqlite");
const batchSize = Math.max(1_000, Number(options["batch-size"] ?? 25_000));
const rebuild = Boolean(options.rebuild);

if (!existsSync(input)) throw new Error(`CSV not found: ${input}`);
await mkdir(path.dirname(output), { recursive: true });
if (rebuild) {
  await rm(output, { force: true });
  await rm(`${output}-wal`, { force: true });
  await rm(`${output}-shm`, { force: true });
}

const database = new DatabaseSync(output);
database.exec(`
  PRAGMA journal_mode=WAL;
  PRAGMA synchronous=NORMAL;
  PRAGMA temp_store=MEMORY;
  CREATE TABLE IF NOT EXISTS index_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE VIRTUAL TABLE IF NOT EXISTS video_titles USING fts5(
    title,
    source_id UNINDEXED,
    byte_offset UNINDEXED,
    byte_length UNINDEXED,
    published_at UNINDEXED,
    views UNINDEXED,
    rating UNINDEXED,
    categories UNINDEXED,
    tokenize='unicode61 remove_diacritics 2'
  );
`);
const storedInput = database.prepare("SELECT value FROM index_meta WHERE key = 'input'").get()?.value;
if (storedInput && path.resolve(storedInput) !== input) throw new Error(`Index belongs to a different CSV (${storedInput}). Use --rebuild.`);
const startOffset = Number(database.prepare("SELECT value FROM index_meta WHERE key = 'offset'").get()?.value ?? 0);
const startRows = Number(database.prepare("SELECT value FROM index_meta WHERE key = 'rows'").get()?.value ?? 0);
const insert = database.prepare("INSERT INTO video_titles(title, source_id, byte_offset, byte_length, published_at, views, rating, categories) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
const setMeta = database.prepare("INSERT INTO index_meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");

let offset = startOffset;
let rows = startRows;
let indexed = Number(database.prepare("SELECT count(*) AS count FROM video_titles").get().count);
let pending = [];
const startedAt = Date.now();

function flush(nextOffset) {
  if (!pending.length) return;
  database.exec("BEGIN IMMEDIATE");
  try {
    for (const item of pending) insert.run(item.title, item.sourceId, item.byteOffset, item.byteLength, item.publishedAt ?? "", item.views, item.rating, item.sourceCategories.join(";"));
    setMeta.run("input", input);
    setMeta.run("offset", String(nextOffset));
    setMeta.run("rows", String(rows));
    setMeta.run("updated_at", new Date().toISOString());
    database.exec("COMMIT");
    indexed += pending.length;
    pending = [];
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

async function run() {
  console.log(`${startOffset ? "Resuming" : "Building"} title index at ${(startOffset / 1024 ** 3).toFixed(2)} GiB.`);
  const stream = createReadStream(input, { start: startOffset, highWaterMark: 1024 * 1024 });
  let remainder = Buffer.alloc(0);
  for await (const chunk of stream) {
    const data = remainder.length ? Buffer.concat([remainder, chunk]) : chunk;
    let cursor = 0;
    let newline;
    while ((newline = data.indexOf(10, cursor)) !== -1) {
      let end = newline;
      if (end > cursor && data[end - 1] === 13) end -= 1;
      const byteOffset = offset;
      const byteLength = newline + 1 - cursor;
      const line = data.subarray(cursor, end).toString("utf8");
      const inspected = inspectPornhubRow(line);
      rows += 1;
      offset += byteLength;
      if (inspected) pending.push({ ...inspected, byteOffset, byteLength });
      cursor = newline + 1;
      if (pending.length >= batchSize) flush(offset);
      if (rows % 250_000 === 0) {
        const rate = Math.round((rows - startRows) / Math.max(1, (Date.now() - startedAt) / 1000));
        console.log(`${rows.toLocaleString("en-US")} rows · ${indexed.toLocaleString("en-US")} indexed · ${rate.toLocaleString("en-US")} rows/s`);
      }
    }
    remainder = data.subarray(cursor);
  }
  if (remainder.length) {
    const inspected = inspectPornhubRow(remainder.toString("utf8"));
    rows += 1;
    if (inspected) pending.push({ ...inspected, byteOffset: offset, byteLength: remainder.length });
    offset += remainder.length;
  }
  flush(offset);
  setMeta.run("completed_at", new Date().toISOString());
  database.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  console.log(`Index ready: ${indexed.toLocaleString("en-US")} searchable videos in ${output}`);
}

try {
  await run();
} finally {
  database.close();
}

