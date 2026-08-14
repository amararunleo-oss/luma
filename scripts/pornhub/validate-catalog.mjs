#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

function args(argv) { const result = {}; for (let i = 0; i < argv.length; i += 1) { const token = argv[i]; if (!token.startsWith("--")) continue; const key = token.slice(2); result[key] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true; } return result; }
const options = args(process.argv.slice(2));
const input = path.resolve(options.input ?? "data/staging/pornhub/selected.jsonl");
const output = path.resolve(options.out ?? "data/staging/pornhub/validated.jsonl");
const concurrency = Math.max(1, Math.min(20, Number(options.concurrency ?? 6)));
const timeoutMs = Math.max(2_000, Number(options["timeout-ms"] ?? 12_000));
const retries = Math.max(0, Number(options.retries ?? 2));
const records = (await readFile(input, "utf8")).split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));

async function probe(url, kind) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers = kind === "thumbnail" ? { Range: "bytes=0-1023", Accept: "image/*" } : { Range: "bytes=0-4095", Accept: "text/html" };
      const response = await fetch(url, { headers, redirect: "follow", signal: controller.signal });
      const contentType = response.headers.get("content-type") ?? ""; await response.body?.cancel();
      if (response.ok && (kind !== "thumbnail" || contentType.startsWith("image/"))) return { ok: true, status: response.status, finalUrl: response.url, contentType };
      if (![408, 425, 429, 500, 502, 503, 504].includes(response.status)) return { ok: false, status: response.status, finalUrl: response.url, contentType };
    } catch (error) { if (attempt === retries) return { ok: false, status: 0, error: error.name }; }
    finally { clearTimeout(timer); }
    await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
  }
  return { ok: false, status: 0 };
}

let cursor = 0; let completed = 0; const valid = []; const rejected = [];
async function worker() {
  while (true) {
    const index = cursor++; if (index >= records.length) return;
    const record = records[index];
    let thumbnail = await probe(record.thumbnailUrl, "thumbnail");
    if (!thumbnail.ok && record.thumbnailFallbackUrl && record.thumbnailFallbackUrl !== record.thumbnailUrl) thumbnail = await probe(record.thumbnailFallbackUrl, "thumbnail");
    const embed = await probe(record.embedUrl, "embed");
    const checked = { ...record, thumbnailUrl: thumbnail.ok ? thumbnail.finalUrl : record.thumbnailUrl, validation: { checkedAt: new Date().toISOString(), thumbnail, embed } };
    if (thumbnail.ok && embed.ok) valid.push(checked); else rejected.push(checked);
    completed += 1; if (completed % 100 === 0) console.log(`Validated ${completed.toLocaleString()}/${records.length.toLocaleString()} · ${valid.length.toLocaleString()} valid`);
  }
}
await Promise.all(Array.from({ length: concurrency }, () => worker()));
valid.sort((a, b) => a.popularityRank - b.popularityRank); rejected.sort((a, b) => a.popularityRank - b.popularityRank);
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, `${valid.map((record) => JSON.stringify(record)).join("\n")}\n`, "utf8");
await writeFile(path.join(path.dirname(output), "validation-rejected.jsonl"), `${rejected.map((record) => JSON.stringify(record)).join("\n")}\n`, "utf8");
console.log(`Validation complete: ${valid.length.toLocaleString()} valid, ${rejected.length.toLocaleString()} rejected.`);
