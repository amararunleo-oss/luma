#!/usr/bin/env node

import { existsSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { DatabaseSync } from "node:sqlite";
import { parseArgs, parsePornhubRow, probeUrl, readCsvRow, upsertJsonl } from "./single-video-utils.mjs";

const options = parseArgs(process.argv.slice(2));
const csv = path.resolve(options.input ?? "C:/projects/pornhub.com-db/pornhub.com-db.csv");
const indexPath = path.resolve(options.index ?? "data/staging/pornhub/title-index.sqlite");
const outputPath = path.resolve(options.out ?? "data/staging/pornhub/manual.jsonl");
if (!existsSync(csv)) throw new Error(`CSV not found: ${csv}`);
if (!existsSync(indexPath)) throw new Error(`Search index not found. Run: npm run pornhub:video:index -- --input "${csv}"`);

const terminal = createInterface({ input, output });
const database = new DatabaseSync(indexPath, { readOnly: true });

function ftsQuery(value) {
  const tokens = String(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return tokens.map((token) => `"${token.replaceAll('"', '""')}"`).join(" AND ");
}

async function chooseMatch(query) {
  const expression = ftsQuery(query);
  if (!expression) throw new Error("Enter at least one searchable word.");
  const matches = database.prepare(`
    SELECT title, source_id, byte_offset, byte_length, published_at, views, rating, categories, bm25(video_titles) AS score
    FROM video_titles WHERE video_titles MATCH ? ORDER BY score LIMIT 20
  `).all(expression);
  if (!matches.length) return null;
  console.log(`\nFound ${matches.length} match(es) in ${csv}:\n`);
  matches.forEach((item, index) => {
    const year = String(item.published_at || "unknown").slice(0, 4);
    console.log(`${index + 1}. ${item.title}`);
    console.log(`   ID ${item.source_id} · ${year} · ${Number(item.views).toLocaleString("en-US")} views · ${item.rating}% · ${item.categories || "uncategorized"}`);
    console.log(`   CSV byte ${Number(item.byte_offset).toLocaleString("en-US")}`);
  });
  const selectedValue = options.pick ?? await terminal.question(`\nSelect 1-${matches.length} (or 0 to cancel): `);
  const selectedIndex = Number(selectedValue) - 1;
  if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= matches.length) return null;
  return matches[selectedIndex];
}

try {
  const query = String(options.query ?? await terminal.question("Pornhub video title: ")).trim();
  const match = await chooseMatch(query);
  if (!match) {
    console.log("No video selected; nothing changed.");
    process.exitCode = 1;
  } else {
    const line = await readCsvRow(csv, Number(match.byte_offset), Number(match.byte_length));
    const parsed = parsePornhubRow(line, {
      minYear: Number(options["min-year"] ?? 2024),
      maxYear: Number(options["max-year"] ?? new Date().getUTCFullYear()),
      minViews: Number(options["min-views"] ?? 400_000),
      minRating: Number(options["min-rating"] ?? 78),
      minVotes: Number(options["min-votes"] ?? 25),
      allowOld: Boolean(options["allow-old"]),
      collections: options.categories,
    });
    if (parsed.error) throw new Error(`Video rejected by catalog policy: ${parsed.error}`);
    const record = parsed.record;
    console.log("\nCandidate preview");
    console.log(`Title: ${record.title}`);
    console.log(`Slug: ${record.slug}`);
    console.log(`Published: ${record.publishedAt}`);
    console.log(`Categories: ${record.collections.join(", ")}`);
    console.log(`Views/rating: ${record.views.toLocaleString("en-US")} / ${record.rating}%`);
    console.log(`Embed: ${record.embedUrl}`);
    if (parsed.qualityWarnings.length) console.log(`Quality warnings: ${parsed.qualityWarnings.join(", ")}`);
    const confirmed = options.yes || /^y(?:es)?$/i.test(await terminal.question("\nValidate and add to LOCAL catalog? [y/N] "));
    if (!confirmed) console.log("Cancelled; nothing changed.");
    else {
      const [thumbnail, embed] = await Promise.all([probeUrl(record.thumbnailUrl, "thumbnail"), probeUrl(record.embedUrl, "embed")]);
      if (!thumbnail.ok) throw new Error(`Thumbnail validation failed (HTTP ${thumbnail.status}).`);
      if (!embed.ok) throw new Error(`Embed validation failed (HTTP ${embed.status}).`);
      record.thumbnailUrl = thumbnail.finalUrl || record.thumbnailUrl;
      record.validation = { checkedAt: new Date().toISOString(), thumbnail, embed };
      const records = await upsertJsonl(outputPath, record);
      console.log(`\nLocal add complete: ${record.title}`);
      console.log(`Catalog: ${outputPath} (${records.length} manual record(s))`);
      console.log(`Local URL: http://localhost:3000/watch/${record.slug}`);
      console.log(`Next: npm run pornhub:video:publish -- --slug "${record.slug}" --execute`);
    }
  }
} finally {
  database.close();
  terminal.close();
}

