import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("uses the accessible custom catalog dropdown instead of native selects", async () => {
  const [filters, selectMenu, report, css] = await Promise.all([
    source("components/catalog-filters.tsx"),
    source("components/ui/select-menu.tsx"),
    source("components/reports/report-issue.tsx"),
    source("app/globals.css"),
  ]);

  assert.doesNotMatch(filters, /<select\b/i);
  assert.doesNotMatch(report, /<select\b/i);
  assert.match(filters, /<SelectMenu\b/);
  assert.match(report, /<SelectMenu\b/);
  assert.match(selectMenu, /role="combobox"/);
  assert.match(selectMenu, /role="listbox"/);
  assert.match(selectMenu, /role="option"/);
  assert.match(selectMenu, /ArrowDown/);
  assert.match(selectMenu, /ArrowUp/);
  assert.match(selectMenu, /Escape/);
  assert.match(css, /\.select-menu-popover/);
  assert.match(css, /max-height:260px/);
  assert.match(css, /scrollbar-width:thin/);
});

test("keeps full catalog ranking imports resumable and database sync authoritative", async () => {
  const [rankings, importer, databaseBuild, packageJson] = await Promise.all([
    source("scripts/run-videocelebs-rankings.mjs"),
    source("scripts/import-videocelebs-catalog.mjs"),
    source("scripts/catalog/build-staging-sql.mjs"),
    source("package.json"),
  ]);

  assert.match(rankings, /"popular"/);
  assert.match(rankings, /"top-rated"/);
  assert.match(rankings, /"--resume"/);
  assert.match(rankings, /"--listings-only"/);
  assert.match(importer, /metadataStatus/);
  assert.match(importer, /catalogStatus/);
  assert.match(importer, /excluded_non_scene/);
  assert.match(databaseBuild, /UPDATE videos SET is_active=0/);
  assert.match(databaseBuild, /DELETE FROM video_listings/);
  assert.match(databaseBuild, /record\.catalogStatus !== "excluded_non_scene"/);
  assert.match(packageJson, /"catalog:rankings:import"/);
  assert.match(packageJson, /"catalog:metadata:repair"/);
});

test("keeps mobile browse and filters outside fragile header layout behavior", async () => {
  const [drawer, filters, css] = await Promise.all([
    source("components/navigation/browse-drawer.tsx"),
    source("components/catalog-filters.tsx"),
    source("app/globals.css"),
  ]);

  assert.match(drawer, /createPortal\(drawer, document\.body\)/);
  assert.match(drawer, /aria-expanded=\{open\}/);
  assert.match(filters, /mobile-filter-backdrop/);
  assert.match(filters, /aria-controls="catalog-filter-form"/);
  assert.match(css, /height:100dvh/);
  assert.match(css, /translate3d/);
  assert.match(css, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});

test("serves R2 thumbnails through the Vercel-compatible S3 adapter with immutable caching", async () => {
  const [thumbnail, mediaRoute, storage] = await Promise.all([
    source("components/media/thumbnail.tsx"),
    source("app/media/[...key]/route.ts"),
    source("lib/cloudflare/r2-s3.ts"),
  ]);

  assert.match(thumbnail, /unoptimized/);
  assert.match(mediaRoute, /if-none-match/);
  assert.match(mediaRoute, /cdn-cache-control/);
  assert.match(storage, /GetObjectCommand/);
  assert.match(mediaRoute, /max-age=31536000, immutable/);
});

test("does not expose dataset counts in public navigation and directories", async () => {
  const [chrome, directory, catalog] = await Promise.all([
    source("components/site-chrome.tsx"),
    source("components/directory/entity-directory.tsx"),
    source("components/catalog.tsx"),
  ]);

  assert.doesNotMatch(chrome, /counts\./);
  assert.doesNotMatch(chrome, /actress\.count/);
  assert.doesNotMatch(directory, /entry\.count/);
  assert.doesNotMatch(catalog, /\{totalItems\} videos/);
});

test("keeps mobile header controls compact and preserves applied filter values", async () => {
  const [search, filters, css] = await Promise.all([
    source("components/search/live-search.tsx"),
    source("components/catalog-filters.tsx"),
    source("app/globals.css"),
  ]);

  assert.match(search, /mobile-search-trigger/);
  assert.match(search, /aria-controls="header-search-form"/);
  assert.match(filters, /key=\{`year-/);
  assert.match(filters, /values\.year \? `\$\{values\.year\} · Filters`/);
  assert.match(css, /\.live-search\.mobile-open \.header-search/);
  assert.match(css, /\.browse-trigger \{ order:3;/);
});

test("searches source tags, descriptions, and common keyword aliases", async () => {
  const repository = await source("lib/catalog/repository.ts");
  assert.match(repository, /doggystyle: \["sex", "explicit"\]/);
  assert.match(repository, /"big butt": \["butt"\]/);
  assert.match(repository, /babe: \["sexy"\]/);
  assert.match(repository, /lower\(v\.description\) LIKE/);
  assert.match(repository, /JOIN tags t ON/);
  assert.match(repository, /WHERE video_count > 0 ORDER BY video_count DESC, name/);
});

test("keeps metadata and iframe props serializable without development warnings", async () => {
  const [layout, player] = await Promise.all([
    source("app/layout.tsx"),
    source("components/player/player-gate.tsx"),
  ]);
  assert.match(layout, /authors: \[\{ name: SITE\.name, url: origin \}\]/);
  assert.doesNotMatch(layout, /authors:.*url: base/);
  assert.doesNotMatch(player, /allowFullScreen|allowfullscreen/);
  assert.match(player, /allow="autoplay; fullscreen; picture-in-picture"/);
});

test("builds clean absolute filter URLs and renders filtered empty states", async () => {
  const [filters, yearPage, moviePage, tvPage] = await Promise.all([
    source("components/catalog-filters.tsx"),
    source("app/year/[year]/page.tsx"),
    source("app/movie/title/[slug]/page.tsx"),
    source("app/tv-show/title/[slug]/page.tsx"),
  ]);
  assert.match(filters, /new URLSearchParams\(\)/);
  assert.match(filters, /if \(value\) query\.set/);
  assert.match(filters, /router\.push\(search \? `\$\{basePath\}\?\$\{search\}` : basePath\)/);
  assert.match(yearPage, /result\.total === 0 && !hasCatalogFilters\(filters\)/);
  assert.doesNotMatch(moviePage, /result\.total === 0/);
  assert.doesNotMatch(tvPage, /result\.total === 0/);
});

test("contains drawer scrolling and keeps compact card metadata rhythm", async () => {
  const [drawer, css] = await Promise.all([
    source("components/navigation/browse-drawer.tsx"),
    source("app/globals.css"),
  ]);
  assert.match(drawer, /document\.documentElement\.style\.overflow = "hidden"/);
  assert.match(drawer, /event\.key !== "Tab"/);
  assert.match(css, /overscroll-behavior:contain/);
  assert.match(css, /touch-action:pan-y/);
  assert.doesNotMatch(css, /\.video-card h2 \{[^}]*min-height/);
});

test("publishes a cached sitemap index with bounded catalog chunks", async () => {
  const [indexRoute, childRoute, sitemapHelpers, robots] = await Promise.all([
    source("app/sitemap.xml/route.ts"),
    source("app/sitemaps/[id]/route.ts"),
    source("lib/sitemaps.ts"),
    source("app/robots.ts"),
  ]);

  assert.match(indexRoute, /<sitemapindex/);
  assert.match(childRoute, /parseSitemapId/);
  assert.match(sitemapHelpers, /SITEMAP_CHUNK_SIZE = 10_000/);
  assert.match(sitemapHelpers, /videos/);
  assert.match(sitemapHelpers, /actresses/);
  assert.match(sitemapHelpers, /works/);
  assert.match(robots, /sitemap\.xml/);
  assert.match(robots, /disallow: \["\/api\/", "\/admin\/", "\/search"\]/);
});

test("generates page-specific SEO without indexing internal search results", async () => {
  const [templates, searchPage, watchPage, layout] = await Promise.all([
    source("lib/seo-templates.ts"),
    source("app/search/page.tsx"),
    source("app/watch/[slug]/page.tsx"),
    source("app/layout.tsx"),
  ]);

  assert.match(templates, /export function actressSeo/);
  assert.match(templates, /export function watchSeo/);
  assert.match(templates, /Sex Scene/);
  assert.match(templates, /Nude Scene/);
  assert.match(searchPage, /index: false/);
  assert.match(watchPage, /watchSeo\(video\)/);
  assert.match(layout, /GOOGLE_SITE_VERIFICATION/);
  assert.match(layout, /BING_SITE_VERIFICATION/);
});

test("keeps IndexNow scoped to changed canonical URLs", async () => {
  const [route, submitter, packageJson] = await Promise.all([
    source("app/indexnow-key.txt/route.ts"),
    source("scripts/search/submit-indexnow.mjs"),
    source("package.json"),
  ]);

  assert.match(route, /INDEXNOW_KEY/);
  assert.match(submitter, /--url/);
  assert.match(submitter, /--file/);
  assert.match(submitter, /api\.indexnow\.org\/indexnow/);
  assert.match(submitter, /slice\(offset, offset \+ 10_000\)/);
  assert.match(packageJson, /"seo:indexnow"/);
});

test("adds deterministic entity context and structured data without AI calls", async () => {
  const [context, component, schema, actressPage, moviePage, watchPage, packageJson] = await Promise.all([
    source("lib/entity-context.ts"),
    source("components/entity-context.tsx"),
    source("lib/structured-data.ts"),
    source("app/actress/[slug]/page.tsx"),
    source("app/movie/title/[slug]/page.tsx"),
    source("app/watch/[slug]/page.tsx"),
    source("package.json"),
  ]);

  assert.match(context, /export function actressContext/);
  assert.match(context, /export function workContext/);
  assert.match(context, /export function watchDescription/);
  assert.match(component, /entity-context-groups/);
  assert.match(schema, /"CollectionPage"/);
  assert.match(schema, /"ItemList"/);
  assert.match(schema, /"Person"/);
  assert.match(actressPage, /beforeGrid={<EntityContext/);
  assert.match(moviePage, /collectionSchema/);
  assert.match(watchPage, /isPartOf/);
  assert.match(packageJson, /"seo:audit"/);
  assert.doesNotMatch(context, /openai|anthropic|generateText|chat\.completions/i);
});

test("keeps ExoClick disabled until complete validated zone configuration is supplied", async () => {
  const [adSlot, envExample, productionCheck, adCheck, adsTxtRoute] = await Promise.all([
    source("components/ads/ad-slot.tsx"),
    source(".env.example"),
    source("scripts/check-production-env.mjs"),
    source("scripts/ads/check-exoclick.mjs"),
    source("app/ads.txt/route.ts"),
  ]);

  assert.match(adSlot, /NEXT_PUBLIC_ADS_ENABLED === "true"/);
  assert.match(adSlot, /a\.magsrv\.com\/ad-provider\.js/);
  assert.match(adSlot, /IntersectionObserver/);
  assert.match(adSlot, /validZone/);
  assert.match(adSlot, /NEXT_PUBLIC_EXOCLICK_CATALOG_MOBILE_ZONE_ID/);
  assert.match(adSlot, /NEXT_PUBLIC_EXOCLICK_OUTSTREAM_ZONE_ID/);
  assert.match(adSlot, /matchMedia\("\(max-width: 820px\)"\)/);
  assert.doesNotMatch(adSlot, /data-ex_av/);
  assert.match(envExample, /NEXT_PUBLIC_EXOCLICK_BLOCK_AD_TYPES=/);
  assert.doesNotMatch(adSlot, /\|\| "101"/);
  assert.match(productionCheck, /Advertising is enabled but configuration is incomplete/);
  assert.match(adCheck, /ADS_TXT is missing/);
  assert.match(adsTxtRoute, /status: 404/);
  const watchPage = await source("app/watch/[slug]/page.tsx");
  const chrome = await source("components/site-chrome.tsx");
  assert.match(watchPage, /placement="below-player"/);
  assert.match(watchPage, /placement="watch-outstream"/);
  assert.ok(chrome.indexOf('placement="sidebar"') < chrome.indexOf("Popular actresses"));
});
