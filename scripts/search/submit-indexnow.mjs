#!/usr/bin/env node

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import process from "node:process";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const args = process.argv.slice(2);
const paths = [];
let file;
for (let index = 0; index < args.length; index += 1) {
  if (args[index] === "--url" && args[index + 1]) paths.push(args[++index]);
  else if (args[index] === "--file" && args[index + 1]) file = args[++index];
  else throw new Error(`Unknown or incomplete option: ${args[index]}`);
}

if (file) {
  const lines = (await readFile(file, "utf8")).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  paths.push(...lines);
}

const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim();
const key = process.env.INDEXNOW_KEY?.trim();
if (!configuredOrigin || configuredOrigin === "https://example.com") throw new Error("NEXT_PUBLIC_SITE_URL must be the final production origin.");
if (!key || !/^[A-Za-z0-9-]{8,128}$/.test(key)) throw new Error("INDEXNOW_KEY must contain 8-128 letters, numbers or hyphens.");
const origin = new URL(configuredOrigin).origin;
const urls = [...new Set(paths.map((value) => new URL(value, origin)).filter((url) => url.origin === origin).map((url) => url.toString()))];
if (!urls.length) throw new Error("Provide changed URLs with --url or --file. Do not submit the full historical catalog through IndexNow.");

for (let offset = 0; offset < urls.length; offset += 10_000) {
  const urlList = urls.slice(offset, offset + 10_000);
  const response = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: new URL(origin).host,
      key,
      keyLocation: `${origin}/indexnow-key.txt`,
      urlList,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (![200, 202].includes(response.status)) throw new Error(`IndexNow returned HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);
  console.log(`IndexNow accepted ${urlList.length.toLocaleString("en-US")} changed URL(s) with HTTP ${response.status}.`);
}
