#!/usr/bin/env node

if (process.env.VERCEL !== "1") {
  console.log("Production environment validation skipped outside Vercel.");
  process.exit(0);
}

const required = [
  "NEXT_PUBLIC_SITE_URL",
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_D1_DATABASE_ID",
  "CLOUDFLARE_D1_API_TOKEN",
];

const hasPublicMedia = Boolean(process.env.NEXT_PUBLIC_MEDIA_BASE_URL?.trim());
if (!hasPublicMedia) {
  required.push("R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME", "R2_ENDPOINT");
}

const missing = required.filter((key) => !process.env[key]?.trim());
if (missing.length) {
  console.error(`Missing required Vercel environment variables: ${missing.join(", ")}`);
  console.error("Add them for Production and Preview deployments, then redeploy.");
  process.exit(1);
}

try {
  const siteUrl = new URL(process.env.NEXT_PUBLIC_SITE_URL);
  if (siteUrl.protocol !== "https:") throw new Error("HTTPS required");
} catch {
  console.error("NEXT_PUBLIC_SITE_URL must be a valid HTTPS origin.");
  process.exit(1);
}

if (process.env.NEXT_PUBLIC_ADS_ENABLED === "true") {
  const adVariables = [
    "NEXT_PUBLIC_EXOCLICK_CATALOG_ZONE_ID",
    "NEXT_PUBLIC_EXOCLICK_CATALOG_CLASS",
    "NEXT_PUBLIC_EXOCLICK_CATALOG_MOBILE_ZONE_ID",
    "NEXT_PUBLIC_EXOCLICK_CATALOG_MOBILE_CLASS",
    "NEXT_PUBLIC_EXOCLICK_SIDEBAR_ZONE_ID",
    "NEXT_PUBLIC_EXOCLICK_SIDEBAR_CLASS",
    "NEXT_PUBLIC_EXOCLICK_PLAYER_ZONE_ID",
    "NEXT_PUBLIC_EXOCLICK_PLAYER_CLASS",
    "NEXT_PUBLIC_EXOCLICK_PLAYER_MOBILE_ZONE_ID",
    "NEXT_PUBLIC_EXOCLICK_PLAYER_MOBILE_CLASS",
    "NEXT_PUBLIC_EXOCLICK_OUTSTREAM_ZONE_ID",
    "NEXT_PUBLIC_EXOCLICK_OUTSTREAM_CLASS",
  ];
  const missingAds = adVariables.filter((key) => !process.env[key]?.trim());
  if (missingAds.length) {
    console.error(`Advertising is enabled but configuration is incomplete: ${missingAds.join(", ")}`);
    process.exit(1);
  }
  const zoneVariables = adVariables.filter((key) => key.endsWith("ZONE_ID"));
  const classVariables = adVariables.filter((key) => key.endsWith("CLASS"));
  if (zoneVariables.some((key) => !/^\d+$/.test(process.env[key])) || classVariables.some((key) => !/^[a-z][a-z0-9_-]+$/i.test(process.env[key]))) {
    console.error("ExoClick zone IDs or async classes are invalid. Copy them exactly from the generated zone snippets.");
    process.exit(1);
  }

  const optionalPlacements = ["STICKY", "INSTANT", "VIDEO_SLIDER", "DESKTOP_FPI", "MOBILE_FPI"];
  for (const placement of optionalPlacements) {
    const zoneKey = `NEXT_PUBLIC_EXOCLICK_${placement}_ZONE_ID`;
    const classKey = `NEXT_PUBLIC_EXOCLICK_${placement}_CLASS`;
    const zone = process.env[zoneKey]?.trim();
    const className = process.env[classKey]?.trim();
    if (Boolean(zone) !== Boolean(className)) {
      console.error(`Optional advertising placement ${placement} must include both ${zoneKey} and ${classKey}.`);
      process.exit(1);
    }
    if ((zone && !/^\d+$/.test(zone)) || (className && !/^[a-z][a-z0-9_-]+$/i.test(className))) {
      console.error(`Optional advertising placement ${placement} has an invalid zone ID or async class.`);
      process.exit(1);
    }
  }

  if (!process.env.ADS_TXT?.trim()) {
    console.warn("ADS_TXT is not configured; /ads.txt will return 404 until authorized seller records are supplied.");
  }
}

console.log("Vercel production environment is configured.");
