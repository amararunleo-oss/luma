#!/usr/bin/env node

import { existsSync } from "node:fs";
import process from "node:process";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const strict = process.argv.includes("--strict");
const enabled = process.env.NEXT_PUBLIC_ADS_ENABLED === "true";
const placements = ["CATALOG", "CATALOG_MOBILE", "SIDEBAR", "PLAYER", "PLAYER_MOBILE", "OUTSTREAM"];
const optionalPlacements = ["STICKY", "INSTANT", "VIDEO_SLIDER", "DESKTOP_FPI", "MOBILE_FPI"];
const issues = [];
const warnings = [];

for (const placement of placements) {
  const zone = process.env[`NEXT_PUBLIC_EXOCLICK_${placement}_ZONE_ID`]?.trim();
  const className = process.env[`NEXT_PUBLIC_EXOCLICK_${placement}_CLASS`]?.trim();
  if (!zone || !className) issues.push(`${placement.toLowerCase()} zone is missing`);
  else if (!/^\d+$/.test(zone) || !/^[a-z][a-z0-9_-]+$/i.test(className)) issues.push(`${placement.toLowerCase()} zone values are invalid`);
}

for (const placement of optionalPlacements) {
  const zone = process.env[`NEXT_PUBLIC_EXOCLICK_${placement}_ZONE_ID`]?.trim();
  const className = process.env[`NEXT_PUBLIC_EXOCLICK_${placement}_CLASS`]?.trim();
  if (!zone && !className) {
    warnings.push(`${placement.toLowerCase()} placement is not configured`);
  } else if (!zone || !className) {
    issues.push(`${placement.toLowerCase()} placement must include both zone ID and async class`);
  } else if (!/^\d+$/.test(zone) || !/^[a-z][a-z0-9_-]+$/i.test(className)) {
    issues.push(`${placement.toLowerCase()} zone values are invalid`);
  }
}

if (!process.env.ADS_TXT?.trim()) warnings.push("ADS_TXT is missing; /ads.txt will return 404 until authorized seller records are supplied");
if (!process.env.SITE_CONTACT_EMAIL?.trim()) issues.push("SITE_CONTACT_EMAIL is missing");
if (!process.env.SITE_DMCA_EMAIL?.trim()) issues.push("SITE_DMCA_EMAIL is missing");

console.log(`Ads enabled: ${enabled ? "yes" : "no"}`);
console.log(`Provider: ExoClick async ad-provider.js (magsrv and pemsrv)`);
console.log(`Lazy loading: enabled`);
console.log(`Restricted ad types: ${process.env.NEXT_PUBLIC_EXOCLICK_BLOCK_AD_TYPES?.trim() || "none beyond zone-level filters"}`);

if (warnings.length) {
  console.log("Warnings:");
  warnings.forEach((warning) => console.log(`- ${warning}`));
}

if (issues.length) {
  console.log("Setup remaining:");
  issues.forEach((issue) => console.log(`- ${issue}`));
  if (strict || enabled) process.exitCode = 1;
} else {
  console.log("ExoClick configuration is complete.");
}
