# Luma

Luma is a production Next.js catalog deployed on Vercel. Catalog metadata stays
in Cloudflare D1 and canonical preview images stay in Cloudflare R2; video files
are not stored by this application.

## Local development

Requirements: Node.js 22.13 or newer.

```bash
npm install
npm run dev
```

Without remote D1 variables, local development intentionally uses the small
built-in sample catalog. Copy `.env.example` to `.env.local` and add the D1
variables to use the full remote catalog locally.

## Vercel deployment

Import the GitHub repository into Vercel. The framework preset is pinned to
Next.js and the standard commands are:

```text
Install: npm install
Build: npm run build
Output: Next.js default
```

Add the following variables to both Preview and Production environments:

- `NEXT_PUBLIC_SITE_URL`: final HTTPS site origin.
- `CLOUDFLARE_ACCOUNT_ID`: Cloudflare account ID.
- `CLOUDFLARE_D1_DATABASE_ID`: production D1 database UUID.
- `CLOUDFLARE_D1_API_TOKEN`: server-only token with D1 Read and D1 Write.
- `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_ENDPOINT`:
  server-only S3 credentials used by the fallback `/media` proxy.

For the fastest image delivery, expose the R2 bucket through a custom domain and
set `NEXT_PUBLIC_MEDIA_BASE_URL`. When that variable is present, R2 credentials
are not required for public image reads, though the health monitor still benefits
from them.

Advertising, legal, reporting and monitoring variables are documented in
`.env.example`. Set `ADMIN_USERNAME` and a strong `ADMIN_PASSWORD` to protect
the operations console with HTTP Basic authentication. Never add real
`.env.local` or `.env.r2` files to Git.

The Vercel prebuild guard stops a production deployment when required catalog or
media variables are missing, preventing an accidental sample-data launch.

## Catalog import

Run the complete resumable metadata and preview pipeline:

```bash
npm run catalog:import:all
```

The importer keeps normalized metadata under `data/staging/videocelebs/` and one
canonical preview per record under `storage/previews/`. Both directories are
deliberately excluded from Git.

Build a D1-compatible catalog snapshot:

```bash
npm run catalog:db:build
```

The generated `data/staging/videocelebs/local-sync.sql` can be imported into the
production D1 database with Wrangler or the Cloudflare D1 import API. After the
import, add that database UUID and a scoped API token to Vercel.

## R2 previews

Copy `.env.r2.example` to `.env.r2`, then upload and verify the canonical files:

```bash
npm run r2:thumbnails:upload
npm run r2:thumbnails:verify
```

Uploads are resumable, preserve catalog keys, and do not delete remote objects.

## Validation

```bash
npm run lint
npm run build
node tests/rendered-html.test.mjs
```

Source authorization and deliberately excluded media types are documented in
`RIGHTS.md`.
