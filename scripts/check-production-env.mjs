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

console.log("Vercel production environment is configured.");
