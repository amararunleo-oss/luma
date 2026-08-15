#!/usr/bin/env node

// Detects adult videos whose embed page answers HTTP 200 but refuses to play
// ("This video cannot be viewed here. Watch this on Pornhub.com").
//
// validate-catalog.mjs only reads the first 4KB and checks response.ok, which
// proves the page exists, not that it plays. This script fetches the whole embed
// document and classifies it from the player payload.
//
// Classification is deliberately tri-state. A page is only blocked on positive
// evidence of refusal; anything unrecognised becomes "unknown" and is reported
// rather than blocked, so a wrong marker cannot empty the catalog.
//
//   node scripts/pornhub/verify-embeds.mjs                      # dry run, featured set
//   node scripts/pornhub/verify-embeds.mjs --write              # update the blocklist
//   node scripts/pornhub/verify-embeds.mjs --input data/staging/pornhub/final.jsonl --limit 500

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

function args(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    result[key] = argv[index + 1] && !argv[index + 1].startsWith("--") ? argv[++index] : true;
  }
  return result;
}

const options = args(process.argv.slice(2));
const input = path.resolve(options.input ?? "data/catalog/pornhub-featured.jsonl");
const blocklistPath = path.resolve(options.blocklist ?? "data/catalog/pornhub-blocklist.json");
const reportPath = path.resolve(options.report ?? "data/staging/pornhub/embed-verification.json");
const sampleDir = path.resolve(options["sample-dir"] ?? "data/staging/pornhub/embed-samples");
const concurrency = Math.max(1, Math.min(12, Number(options.concurrency ?? 4)));
const timeoutMs = Math.max(2_000, Number(options["timeout-ms"] ?? 20_000));
const retries = Math.max(0, Number(options.retries ?? 1));
const limit = Number(options.limit) > 0 ? Number(options.limit) : Infinity;
const sampleLimit = Math.max(0, Number(options.sample ?? 5));
const maxBlockRatio = Math.min(1, Math.max(0.01, Number(options["max-block-ratio"] ?? 0.25)));
const write = options.write === true;

// Positive evidence that the embed refuses to play. Checked first.
const DISABLED_MARKERS = [
  "cannot be viewed here",
  "watch this on pornhub.com",
  "video has been removed",
  "video has been flagged",
  "this video is not available",
  "this video is unavailable",
  "video is disabled",
  "embed_disabled",
  "embeddisabled",
  "playbacknotallowed",
];

// Positive evidence that the player received real media to play.
const PLAYABLE_PATTERNS = [
  { name: "videoUrl", pattern: /"videoUrl"\s*:\s*"(?:https?:)?\\?\/\\?\// },
  { name: "hlsUrl", pattern: /hls_?url["']?\s*[:=]\s*["'](?:https?:)?\\?\/\\?\//i },
  { name: "mediaDefinitions", pattern: /mediaDefinitions[\s\S]{0,6000}?(?:https?:)?\\?\/\\?\/[^"'\s]*\.(?:m3u8|mp4)/i },
];

function classify(html) {
  const haystack = html.toLowerCase();
  const disabled = DISABLED_MARKERS.find((marker) => haystack.includes(marker));
  if (disabled) return { state: "blocked", evidence: disabled };
  const playable = PLAYABLE_PATTERNS.find((candidate) => candidate.pattern.test(html));
  if (playable) return { state: "ok", evidence: playable.name };
  return { state: "unknown", evidence: "no playable media and no refusal notice" };
}

async function fetchEmbed(url) {
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        headers: {
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "en-US,en;q=0.9",
        },
        redirect: "follow",
        signal: controller.signal,
      });
      const html = await response.text();
      return { ok: response.ok, status: response.status, finalUrl: response.url, html };
    } catch (error) {
      if (attempt === retries) return { ok: false, status: 0, error: error.name === "AbortError" ? "timeout" : (error.cause?.code ?? error.name), html: "" };
      await new Promise((resolve) => setTimeout(resolve, 700 * 2 ** attempt));
    } finally {
      clearTimeout(timer);
    }
  }
  return { ok: false, status: 0, error: "unreachable", html: "" };
}

const records = (await readFile(input, "utf8"))
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => JSON.parse(line))
  .filter((record) => record.embedUrl)
  .slice(0, limit === Infinity ? undefined : limit);

if (!records.length) throw new Error(`No records with an embedUrl in ${input}.`);
console.log(`Checking ${records.length.toLocaleString("en-US")} embeds from ${input} with concurrency ${concurrency}.`);

const results = [];
let cursor = 0;
let samples = 0;

async function worker() {
  while (true) {
    const index = cursor++;
    if (index >= records.length) return;
    const record = records[index];
    const response = await fetchEmbed(record.embedUrl);
    const outcome = response.html
      ? classify(response.html)
      : { state: "unreachable", evidence: response.error ?? `HTTP ${response.status}` };
    results.push({
      sourceId: String(record.sourceId ?? ""),
      slug: String(record.slug ?? ""),
      title: String(record.title ?? "").slice(0, 120),
      embedUrl: record.embedUrl,
      status: response.status,
      finalUrl: response.finalUrl ?? "",
      state: outcome.state,
      evidence: outcome.evidence,
    });
    // Keep a few raw documents so the marker lists can be corrected against
    // reality instead of guesswork.
    if (outcome.state !== "ok" && response.html && samples < sampleLimit) {
      samples += 1;
      await mkdir(sampleDir, { recursive: true });
      await writeFile(path.join(sampleDir, `${outcome.state}-${record.sourceId}.html`), response.html, "utf8");
    }
    if (results.length % 25 === 0) console.log(`  ${results.length.toLocaleString("en-US")}/${records.length.toLocaleString("en-US")} checked`);
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));

const counts = results.reduce((totals, item) => ({ ...totals, [item.state]: (totals[item.state] ?? 0) + 1 }), {});
const blocked = results.filter((item) => item.state === "blocked");
const unknown = results.filter((item) => item.state === "unknown");
const unreachable = results.filter((item) => item.state === "unreachable");
const blockRatio = blocked.length / results.length;

await mkdir(path.dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify({ checkedAt: new Date().toISOString(), input, counts, blockRatio, results }, null, 2)}\n`, "utf8");

console.log("");
console.log(`ok:          ${counts.ok ?? 0}`);
console.log(`blocked:     ${blocked.length}`);
console.log(`unknown:     ${unknown.length}`);
console.log(`unreachable: ${unreachable.length}`);
console.log(`Report written to ${reportPath}.`);
if (samples) console.log(`Saved ${samples} raw sample document(s) to ${sampleDir}.`);

if (unreachable.length === results.length) {
  console.error("");
  console.error("Every embed was unreachable, so nothing was classified. Run this from a network that can reach the source site.");
  process.exitCode = 1;
} else if (!counts.ok && unknown.length) {
  console.error("");
  console.error("Nothing matched a playable marker. The PLAYABLE_PATTERNS list is probably wrong for the current embed markup.");
  console.error(`Inspect the saved samples in ${sampleDir} and correct the markers before trusting this run.`);
  process.exitCode = 1;
} else if (unknown.length) {
  console.log("");
  console.log(`${unknown.length} embed(s) matched neither a playable nor a refusal marker. They were left untouched; review them in the report.`);
}

if (!blocked.length) {
  console.log("");
  console.log("No refusing embeds found. Blocklist unchanged.");
} else {
  console.log("");
  for (const item of blocked.slice(0, 20)) console.log(`  blocked ${item.sourceId} · ${item.evidence} · ${item.title}`);
  if (blocked.length > 20) console.log(`  ... and ${blocked.length - 20} more`);

  if (blockRatio > maxBlockRatio) {
    console.error("");
    console.error(`Refusing to write: ${(blockRatio * 100).toFixed(1)}% of checked embeds were classified as blocked, above the ${(maxBlockRatio * 100).toFixed(0)}% safety limit.`);
    console.error("That usually means a marker is matching normal pages. Review the report, then re-run with a higher --max-block-ratio if the result is genuinely correct.");
    process.exitCode = 1;
  } else if (!write) {
    console.log("");
    console.log("Dry run. Re-run with --write to add these to the blocklist.");
  } else {
    const existing = await readFile(blocklistPath, "utf8").then((value) => JSON.parse(value)).catch(() => ({}));
    const entries = Array.isArray(existing.blocked) ? existing.blocked : [];
    const known = new Set(entries.map((entry) => String(entry.sourceId ?? "").trim()).filter(Boolean));
    const added = blocked
      .filter((item) => item.sourceId && !known.has(item.sourceId))
      .map((item) => ({
        sourceId: item.sourceId,
        reason: "embed-disabled",
        addedAt: new Date().toISOString().slice(0, 10),
        note: `verify-embeds: ${item.evidence}`,
      }));
    await writeFile(blocklistPath, `${JSON.stringify({ ...existing, blocked: [...entries, ...added] }, null, 2)}\n`, "utf8");
    console.log("");
    console.log(`Added ${added.length} new entr${added.length === 1 ? "y" : "ies"} to ${blocklistPath} (${blocked.length - added.length} already listed).`);
    console.log("Run `npm run pornhub:preview` to rebuild the homepage preview and featured fallback without them.");
  }
}
