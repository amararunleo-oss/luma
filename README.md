# Luma video catalog

A Next.js-compatible Vinext catalog backed by Cloudflare D1 and R2. The source
importer stores normalized metadata plus one canonical preview image per video;
video files are never downloaded.

## Prerequisites

- Node.js `>=22.13.0`

## Quick Start

```bash
npm install
npm run dev
npm run build
```

This starter does not use `wrangler.jsonc`.

## Catalog import

Run the complete, resumable pipeline:

```bash
npm run catalog:import:all
```

It imports the chronological catalog with detail metadata and one player poster,
then merges Popular and Top Rated ordering without downloading the same images
again. State is stored per listing under `data/staging/videocelebs/`; canonical
images are sharded under `storage/previews/<prefix>/<source-id>/poster`.

To refresh localhost with the records imported so far, run this in a separate
terminal and reload the browser:

```bash
npm run catalog:sync:local
```

Local development serves the canonical files directly from `storage/previews`;
production continues to use the immutable R2 media route.

### Repair and upload thumbnails to R2

Repair any source poster that failed validation by using its ID-matched listing
thumbnail, then confirm local catalog/file parity:

```bash
npm run catalog:thumbnails:repair -- --execute
npm run r2:thumbnails:plan
```

For Cloudflare R2, create a Standard-storage bucket named `site-creator-r2`,
bind it to the Worker as `THUMBNAILS`, and create an Object Read & Write S3 API
token restricted to that bucket. Copy `.env.r2.example` to the ignored
`.env.r2` file and enter the account ID, access key, and secret. Uploads are
resumable by key and size and never delete remote objects:

```bash
npm run r2:thumbnails:upload
npm run r2:thumbnails:verify
```

The uploader stores objects with their catalog key (`previews/v1/.../poster`),
correct image content type, one-year immutable caching, and source/checksum
metadata. Rerunning the upload skips objects already present at the same size;
pass `-- --force` only when every remote object must be replaced.

The source authorization represented by the project owner and the deliberately
excluded asset types are documented in `RIGHTS.md`.

## Included shape

- application routes and UI under `app/`
- reusable catalog components under `components/`
- normalized D1 schema under `db/`
- resumable source importer under `scripts/`
- `.openai/hosting.json` declares the D1 `DB` and R2 `THUMBNAILS` bindings
- `worker/index.ts` serves immutable local preview keys from R2

## Workspace Auth Headers

Signed-in visitors receive both `oai-authenticated-user-id` and `oai-authenticated-user-email`. Private Sites require every visitor to sign in; public Sites may also have anonymous visitors, for whom neither header is present.

The user ID is stable for the same user on the same Site and different across Sites. Email and name are intended for display or contact purposes.

SIWC-authenticated workspace sites may also receive
`oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty
`name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by
`oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const userId = requestHeaders.get("oai-authenticated-user-id");
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs
optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send
  anonymous visitors through Sign in with ChatGPT.
- Use `chatGPTSignInPath(returnTo)` and `chatGPTSignOutPath(returnTo)` for
  browser links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in
  or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because
  they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the
OAuth cookies, and identity header injection. Do not implement app routes for
those reserved paths. Routes that do not import and call the helper remain
anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the
Sites hosting platform's access policy controls for workspace-wide restrictions,
or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write
actions tied to the current ChatGPT user. Leave public content anonymous.

## Useful Commands

- `npm run dev`: start local development
- `npm run build`: verify the vinext build output
- `npm test`: build the starter and verify its rendered loading skeleton
- `npm run db:generate`: generate Drizzle migrations after schema changes

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
