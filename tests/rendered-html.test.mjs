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
  const [drawer, navigationApi, filters, css] = await Promise.all([
    source("components/navigation/browse-drawer.tsx"),
    source("app/api/navigation/route.ts"),
    source("components/catalog-filters.tsx"),
    source("app/globals.css"),
  ]);

  assert.match(drawer, /createPortal\(drawer, document\.body\)/);
  assert.match(drawer, /aria-expanded=\{open\}/);
  assert.match(drawer, /Popular celebrities/);
  assert.match(drawer, /Popular tags/);
  assert.match(drawer, /<details>/);
  assert.match(drawer, /fetch\("\/api\/navigation"/);
  assert.match(navigationApi, /s-maxage=3600/);
  assert.match(navigationApi, /actresses\.slice\(0, 10\)/);
  assert.match(navigationApi, /tags\.slice\(0, 18\)/);
  assert.match(filters, /mobile-filter-backdrop/);
  assert.match(filters, /aria-controls="catalog-filter-form"/);
  assert.match(css, /height:100dvh/);
  assert.match(css, /translate3d/);
  assert.match(css, /\.drawer-taxonomy-links \{ max-height:224px/);
  assert.match(css, /\.browse-drawer > nav > a/);
  assert.match(css, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});

test("redirects thumbnail bytes directly to R2 instead of proxying them through Vercel", async () => {
  const [thumbnail, mediaRoute, storage] = await Promise.all([
    source("components/media/thumbnail.tsx"),
    source("app/media/[...key]/route.ts"),
    source("lib/cloudflare/r2-s3.ts"),
  ]);

  assert.match(thumbnail, /unoptimized/);
  assert.match(mediaRoute, /status: 307/);
  assert.match(mediaRoute, /location/);
  assert.match(mediaRoute, /cdn-cache-control/);
  assert.match(mediaRoute, /signedR2ObjectUrl/);
  assert.match(storage, /getSignedUrl/);
  assert.doesNotMatch(mediaRoute, /getR2Object/);
  assert.match(mediaRoute, /s-maxage=86400/);
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
  assert.match(css, /\.browse-trigger \{ order:4;/);
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

test("wires the validated local adult catalog into listings, search, categories, and watch pages", async () => {
  const [repository, localCatalog, aliases, watch, adultListing] = await Promise.all([
    source("lib/catalog/repository.ts"),
    source("lib/pornhub-local-catalog.ts"),
    source("lib/pornhub-category-aliases.json"),
    source("app/watch/[slug]/page.tsx"),
    source("app/porn-videos/page.tsx"),
  ]);
  assert.match(repository, /options\.catalog === "porn"/);
  assert.match(repository, /listLocalPornhubVideos/);
  assert.match(repository, /searchLocalPornhubVideos/);
  assert.match(localCatalog, /data\/staging\/pornhub\/final\.jsonl/);
  assert.match(localCatalog, /source: "pornhub"/);
  assert.match(aliases, /"doggy-style"/);
  assert.match(aliases, /"hentai-anime"/);
  assert.match(watch, /"@type": "VideoObject"/);
  assert.match(watch, /uploadDate: videoUploadDate\(video\)/);
  assert.match(watch, /embedUrl: video\.embedUrl/);
  assert.match(adultListing, /AdultCategoryStrip/);
});

test("keeps metadata and iframe props serializable without development warnings", async () => {
  const [layout, player] = await Promise.all([
    source("app/layout.tsx"),
    source("components/player/player-gate.tsx"),
  ]);
  assert.match(layout, /authors: \[\{ name: SITE\.name, url: origin \}\]/);
  assert.doesNotMatch(layout, /authors:.*url: base/);
  assert.match(player, /"use client"/);
  assert.match(player, /allowFullScreen/);
  assert.match(player, /allow="autoplay; encrypted-media; fullscreen; picture-in-picture"/);
  assert.match(player, /scrolling="no"/);
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
  assert.match(filters, /window\.location\.assign\(search \? `\$\{basePath\}\?\$\{search\}` : basePath\)/);
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
  const [indexRoute, childRoute, videoRoute, sitemapHelpers, repository, robots] = await Promise.all([
    source("app/sitemap.xml/route.ts"),
    source("app/sitemaps/[id]/route.ts"),
    source("app/video-sitemaps/[id]/route.ts"),
    source("lib/sitemaps.ts"),
    source("lib/catalog/repository.ts"),
    source("app/robots.ts"),
  ]);

  assert.match(indexRoute, /<sitemapindex/);
  assert.match(childRoute, /parseSitemapId/);
  assert.match(sitemapHelpers, /SITEMAP_CHUNK_SIZE = 10_000/);
  assert.match(sitemapHelpers, /VIDEO_SITEMAP_CHUNK_SIZE = 4_000/);
  assert.match(sitemapHelpers, /video-media/);
  assert.match(sitemapHelpers, /videos/);
  assert.match(sitemapHelpers, /actresses/);
  assert.match(sitemapHelpers, /works/);
  assert.match(robots, /sitemap\.xml/);
  assert.match(robots, /disallow: \["\/api\/", "\/admin\/"\]/);
  assert.match(robots, /Googlebot/);
  assert.match(robots, /GPTBot/);
  assert.match(videoRoute, /xmlns:video="http:\/\/www\.google\.com\/schemas\/sitemap-video\/1\.1"/);
  assert.match(videoRoute, /<video:thumbnail_loc>/);
  assert.match(videoRoute, /<video:player_loc allow_embed="yes">/);
  assert.match(videoRoute, /<video:publication_date>/);
  assert.match(videoRoute, /<video:family_friendly>no<\/video:family_friendly>/);
  assert.match(repository, /export async function getVideoSitemapChunk/);
});

test("publishes curated collection pages without generating arbitrary combinations", async () => {
  const [definitions, indexPage, detailPage, links, sitemap] = await Promise.all([
    source("lib/collections.ts"),
    source("app/collections/page.tsx"),
    source("app/collections/[slug]/page.tsx"),
    source("components/collections/collection-links.tsx"),
    source("lib/sitemaps.ts"),
  ]);
  assert.match(definitions, /COLLECTION_MINIMUM_VIDEOS = 8/);
  assert.match(definitions, /popular-movie-scenes/);
  assert.match(definitions, /sydney-sweeney-scenes/);
  assert.match(detailPage, /collectionBySlug/);
  assert.match(detailPage, /result\.total >= COLLECTION_MINIMUM_VIDEOS/);
  assert.match(detailPage, /"@type": "CollectionPage"/);
  assert.match(indexPage, /<CollectionLinks/);
  assert.match(links, /\/collections\/\$\{collection\.slug\}/);
  assert.match(sitemap, /"\/collections"/);
});

test("keeps search history local and shows quick suggestions without backend writes", async () => {
  const search = await source("components/search/live-search.tsx");
  assert.match(search, /SEARCH_HISTORY_KEY = "actrexx:search-history"/);
  assert.match(search, /window\.localStorage\.setItem/);
  assert.match(search, /window\.localStorage\.removeItem/);
  assert.match(search, /Recent searches/);
  assert.match(search, /Quick suggestions/);
  assert.match(search, /saveSearch\(query\)/);
});

test("stores compressed catalog cache envelopes in Upstash as readable strings", async () => {
  const cache = await source("lib/cache/upstash.ts");
  assert.match(cache, /connection\.set\(fullKey, payload/);
  assert.match(cache, /payload\.startsWith\("gz:"\)/);
  assert.match(cache, /payload\.startsWith\("json:"\)/);
  assert.doesNotMatch(cache, /connection\.set\(fullKey, envelope/);
});

test("protects Vercel compute without persisting transient D1 fallbacks", async () => {
  const [repository, watchPage, layout, d1, upstash] = await Promise.all([
    source("lib/catalog/repository.ts"),
    source("app/watch/[slug]/page.tsx"),
    source("app/layout.tsx"),
    source("lib/cloudflare/d1-http.ts"),
    source("lib/cache/upstash.ts"),
  ]);
  assert.doesNotMatch(repository, /unstable_cache/);
  assert.match(repository, /type DatabaseResult<T> = \{ value: T; database: boolean \}/);
  assert.ok((repository.match(/shouldCache: \((?:result|outcome)\) => (?:result|outcome)\.database/g) ?? []).length >= 6);
  assert.match(repository, /withLocalCatalogCache/);
  assert.match(watchPage, /export const revalidate = 86_400/);
  assert.match(watchPage, /return \[\]/);
  assert.doesNotMatch(layout, /requestOrigin/);
  assert.doesNotMatch(d1, /cache: "no-store"/);
  assert.match(upstash, /cache: "default"/);
  assert.match(upstash, /const CACHE_SCHEMA_VERSION = "v3"/);
  assert.match(upstash, /const inFlight = new Map/);
});

test("keeps the homepage adult library one most-viewed list instead of category rails", async () => {
  const [previewScript, previewReader, home, catalog, watchPage] = await Promise.all([
    source("scripts/pornhub/build-home-preview.mjs"),
    source("lib/pornhub-local-preview.ts"),
    source("components/home/home-discovery.tsx"),
    source("components/catalog.tsx"),
    source("app/watch/[slug]/page.tsx"),
  ]);
  assert.match(previewScript, /year >= 2024 && year <= 2026/);
  assert.match(previewScript, /hasStrictTaxonomyTerm/);
  assert.doesNotMatch(previewScript, /\[record\.title, \.\.\.\(record\.tags/);
  assert.match(previewScript, /function selectMostViewed/);
  assert.match(previewScript, /best: selectMostViewed\("best", bestLimit\)/);
  assert.match(previewReader, /pussyLicking: PornhubPreviewItem\[\]/);

  // One adult section only, rendered as a 20 item grid rather than a slider. The
  // remaining category sections stay in the preview file for the featured
  // fallback catalog, so they must not be rendered back onto the homepage.
  assert.match(home, /const ADULT_LIST_SIZE = 20/);
  assert.match(home, /preview\.sections\.best\.slice\(0, ADULT_LIST_SIZE\)/);
  assert.match(home, /Best from Pornhub/);
  assert.match(home, /className="video-grid"/);
  assert.doesNotMatch(home, /preview\.sections\.(romantic|babe|anime|doggy|pussyLicking|stepFantasy|blowjob)/);
  assert.equal(home.match(/<HomeVideoRail/g).length, 1);

  // Both the header link and the button under the grid lead to the paginated
  // adult listing, and the celebrity rail links to every year rather than one.
  assert.match(home, /const ADULT_LIST_HREF = "\/porn-videos\/latest"/);
  assert.match(home, /className="home-list-more-button" href=\{ADULT_LIST_HREF\}/);
  assert.match(home, /href="\/latest"/);
  assert.doesNotMatch(home, /\/latest\?year=/);

  // Celebrity cards show the year, adult cards never do.
  assert.match(home, /year: video\.year/);
  assert.match(home, /source: "pornhub"/);
  assert.match(catalog, /video-meta">\{video\.source !== "pornhub"/);

  assert.match(watchPage, /getRelatedVideos\(video, 10\)/);
  assert.match(watchPage, /!isPornhub/);
});

test("suppresses non-embeddable adult videos everywhere and paginates the full adult catalog", async () => {
  const [blocklist, reader, localCatalog, previewScript, home, listing, hub, category, filters] = await Promise.all([
    source("data/catalog/pornhub-blocklist.json"),
    source("lib/pornhub-blocklist.ts"),
    source("lib/pornhub-local-catalog.ts"),
    source("scripts/pornhub/build-home-preview.mjs"),
    source("components/home/home-discovery.tsx"),
    source("app/porn-videos/[listing]/page.tsx"),
    source("app/porn-videos/page.tsx"),
    source("app/porn-category/[slug]/page.tsx"),
    source("components/catalog-filters.tsx"),
  ]);

  // The blocklist is applied to the single catalog reader, so listings, search,
  // related videos, categories and watch pages all inherit it.
  assert.match(blocklist, /"blocked":/);
  assert.match(reader, /export function getPornhubBlocklist/);

  // Preview ids are alphanumeric source viewkeys. Number() on them yields NaN, so
  // a separate numericId is carried and React keys use the slug.
  assert.match(previewScript, /numericId: Number\(record\.sourceNumericId\) \|\| 0/);
  assert.match(home, /id: item\.numericId \|\| index \+ 1/);
  assert.match(home, /<Fragment key=\{video\.slug\}>/);
  assert.doesNotMatch(home, /Number\(item\.id\)/);
  assert.match(localCatalog, /getPornhubBlocklist\(\)/);
  assert.match(localCatalog, /blocked\.ids\.has\(String\(record\.sourceId \?\? ""\)\)/);
  assert.match(localCatalog, /blocked\.slugs\.has\(record\.slug\)/);
  assert.match(previewScript, /blocked\.ids\.has/);

  // D1 and the Redis catalog chunks are separate sources from the local JSONL, so the
  // blocklist is enforced on every read path rather than only in the file reader.
  assert.match(reader, /export function isBlockedSlug/);
  const repo = await source("lib/catalog/repository.ts");
  assert.match(repo, /export async function getVideoBySlug\(slug: string\) \{\s*if \(isBlockedSlug\(await blocklist\(\), slug\)\) return undefined;/);
  assert.match(repo, /async function withoutBlocked\(page: CatalogPage\)/);
  assert.match(repo, /return withoutBlocked\(await listVideosRemoteCached\(options\)\)/);
  assert.match(repo, /return related\.filter\(\(item\) => !isBlockedSlug\(list, item\.slug\)\)/);
  assert.match(repo, /const keepUnblocked = /);
  assert.match(repo, /getCatalogSitemapChunkUnfiltered/);
  assert.match(repo, /getVideoSitemapChunkUnfiltered/);

  // A full pass over the catalog is long, so it checkpoints and resumes.
  assert.match(previewScript, /blocked\.slugs\.has/);
  const verifier = await source("scripts/pornhub/verify-embeds.mjs");
  assert.match(verifier, /embed-verification\.checkpoint\.json/);
  assert.match(verifier, /const resume = options\["no-resume"\] !== true/);
  assert.match(verifier, /slug: item\.slug,/);

  // The adult listings page through the whole catalog instead of 2024 onwards.
  assert.doesNotMatch(listing, /minYear: 2024/);
  assert.doesNotMatch(hub, /minYear: 2024/);
  assert.doesNotMatch(category, /minYear: 2024/);
  assert.match(category, /hideYear: true/);

  // Newest to oldest is fixed on the listing the homepage links to, and the year
  // control is gone from the adult filter set.
  assert.match(listing, /lockOrder: true/);
  assert.match(listing, /order: undefined/);
  assert.match(listing, /hideYear: true, hideOrder: lockOrder/);
  assert.match(hub, /hideYear: true/);
  assert.match(filters, /hideOrder = false/);
  assert.match(filters, /\{!hideOrder && <label htmlFor="filter-order">/);
});

test("verifies embed playability without letting a bad marker empty the catalog", async () => {
  const [verifier, validator, packageJson] = await Promise.all([
    source("scripts/pornhub/verify-embeds.mjs"),
    source("scripts/pornhub/validate-catalog.mjs"),
    source("package.json"),
  ]);

  // The HTTP validator cannot see a refusing player, so the verifier reads the
  // whole document and classifies the player payload instead.
  assert.match(validator, /Range: "bytes=0-4095"/);
  assert.match(verifier, /await response\.text\(\)/);
  assert.match(verifier, /const DISABLED_MARKERS/);
  assert.match(verifier, /const PLAYABLE_PATTERNS/);

  // Tri-state: only positive refusal evidence blocks, anything unrecognised is
  // reported and left alone.
  assert.match(verifier, /return \{ state: "blocked"/);
  assert.match(verifier, /return \{ state: "unknown"/);

  // Writing is opt-in and abandoned when too much of the sample is classified as
  // blocked, which is what a wrong marker looks like.
  assert.match(verifier, /const write = options\.write === true/);
  assert.match(verifier, /blockRatio > maxBlockRatio/);
  assert.match(verifier, /Refusing to write/);
  assert.match(verifier, /Dry run\. Re-run with --write/);

  assert.match(packageJson, /"pornhub:embeds:verify"/);
  assert.match(packageJson, /"pornhub:embeds:block"/);
});

test("auto-advances the popular hero without trapping motion-sensitive or paused users", async () => {
  const [hero, home, chrome, styles] = await Promise.all([
    source("components/home/popular-hero.tsx"),
    source("app/page.tsx"),
    source("components/site-chrome.tsx"),
    source("app/globals.css"),
  ]);

  assert.match(home, /import \{ PopularHero \}/);
  assert.doesNotMatch(home, /PopularNow/);
  assert.doesNotMatch(styles, /popular-now/);

  // Auto-advance is a smooth scrollTo over a native scroll-snap track, so swipe
  // and momentum stay native rather than being reimplemented.
  assert.match(hero, /const AUTO_ADVANCE_MS = 5_500/);
  assert.match(hero, /behavior: instant \|\| reducedMotion\(\) \? "instant" : "smooth"/);

  // scroll-snap-stop:always would forbid passing intermediate snap points, which
  // blocks the wrap back to the first slide, and hover must only pause for a mouse
  // because touch fires pointerenter without a matching pointerleave.
  assert.doesNotMatch(styles, /\.popular-hero-slide \{[^}]*scroll-snap-stop/);
  assert.match(hero, /goTo\(next, next === 0\)/);
  assert.match(hero, /event\.pointerType === "mouse"/);
  assert.match(styles, /\.popular-hero-viewport \{[^}]*scroll-snap-type:x mandatory/);
  assert.match(styles, /\.popular-hero-dot\.active/);

  // Mobile keeps the exact 16:9 source ratio and stays horizontal, never portrait.
  assert.match(styles, /\.popular-hero-slide \{ height:auto; aspect-ratio:16 \/ 9; \}/);
  assert.doesNotMatch(styles, /aspect-ratio:4 \/ 5/);
  assert.match(styles, /--popular-hero-height:max\(240px,calc\(75vh - var\(--popular-hero-chrome\)\)\)/);
  assert.match(styles, /\.popular-hero-slide \{ width:100%; height:var\(--popular-hero-height\)/);
  assert.doesNotMatch(styles, /popular-hero-toggle/);

  // No pause button, so auto-advance must still stop for reduced motion, pointer
  // and keyboard interaction, and background tabs.
  assert.doesNotMatch(hero, /Pause|paused/);
  assert.match(hero, /interacting \|\| reducedMotion\(\)/);
  assert.match(hero, /prefers-reduced-motion: reduce/);
  assert.match(hero, /if \(document\.hidden\) return;/);
  assert.match(hero, /onPointerDown=\{\(\) => setInteracting\(true\)\}/);
  assert.match(hero, /onFocusCapture=\{\(\) => setInteracting\(true\)\}/);
  assert.match(hero, /aria-roledescription="carousel"/);
  assert.match(hero, /aria-roledescription="slide"/);

  // Slide calls to action replace the removed header links.
  assert.match(hero, /href=\{`\/swipe-videos#\$\{video\.slug\}`\}>.*Swipe videos<\/Link>/);
  assert.match(hero, /href="\/most-popular">Open in popular page/);
  assert.doesNotMatch(hero, /View popular scenes|Watch scene|Open in swipe videos/);

  // Slide headings sit under the section h2, which sits under the homepage h1.
  assert.match(hero, /<h2 id="popular-hero-title">/);
  assert.match(hero, /<h3>\{video\.sceneTitle\}<\/h3>/);

  // Source viewkeys are alphanumeric, so keys and Video.id must not go through
  // Number() on them.
  assert.match(hero, /key=\{video\.slug\}/);
  assert.doesNotMatch(hero, /key=\{video\.id\}/);

  assert.match(chrome, /className="sidebar-home-link" href="\/"/);
  assert.match(styles, /\.sidebar-home-link \{[^}]*border-radius:var\(--control-radius\)/);
});

test("gives every boxed surface a shared corner radius token", async () => {
  const styles = await source("app/globals.css");

  for (const token of ["--card-radius", "--control-radius", "--panel-radius", "--inner-radius", "--pill-radius"]) {
    assert.match(styles, new RegExp(`${token}:`), `${token} should be declared`);
  }

  // Every boxed surface reads a token instead of a one-off value, so the whole site
  // shares one radius vocabulary.
  const tokenised = [
    ["controls", ["\\.browse-trigger", "\\.mobile-search-trigger", "\\.catalog-filters", "\\.select-menu-trigger", "\\.catalog-navigation > section", "\\.status-page a, \\.status-page button", "\\.home-list-more-button"]],
    ["panels", ["\\.search-popover", "\\.select-menu-popover", "\\.report-modal", "\\.popular-hero-viewport"]],
    ["chips", ["\\.drawer-tag-links a", "\\.sidebar-category-links a", "\\.adult-category-strip > div:last-child a", "\\.reels-chrome-link"]],
    ["tiles", ["\\.catalog-navigation-icon", "\\.sidebar-home-icon", "\\.browse-drawer > nav > a > span", "\\.search-result > img"]],
    ["cards", ["\\.video-thumb", "\\.home-rail-media", "\\.player-frame", "\\.adult-category-grid > a", "\\.collection-link-grid > a"]],
  ];
  for (const [group, selectors] of tokenised) {
    for (const selector of selectors) {
      assert.match(styles, new RegExp(`${selector} \\{[^}]*border-radius:\\s*var\\(--`), `${selector} (${group}) should use a radius token`);
    }
  }

  // The drawer is flush to the left edge and the navigation panel is clipped by its
  // rounded parent, so those stay deliberate rather than uniform.
  assert.match(styles, /\.browse-drawer \{[^}]*border-radius:0 var\(--panel-radius\) var\(--panel-radius\) 0/);
  assert.match(styles, /\.catalog-navigation > section \{[^}]*overflow:hidden/);
});

test("scopes search from the header dropdown through to the advanced search page", async () => {
  const [scopes, api, live, page, tabs, repository, selectMenu, styles] = await Promise.all([
    source("lib/search-scope.ts"),
    source("app/api/search/route.ts"),
    source("components/search/live-search.tsx"),
    source("app/search/page.tsx"),
    source("components/search/search-scope-tabs.tsx"),
    source("lib/catalog/repository.ts"),
    source("components/ui/select-menu.tsx"),
    source("app/globals.css"),
  ]);

  // One scope list drives the header dropdown, the API and the results page.
  for (const scope of ["all", "celebrity", "movies", "tv-shows", "porn"]) {
    assert.match(scopes, new RegExp(`value: "${scope}"`), `${scope} scope should exist`);
  }
  assert.match(scopes, /export function searchScope\(value: string \| string\[\] \| undefined\): SearchScopeDefinition/);

  // The header keeps the accessible dropdown rather than a native select, and the
  // chosen scope reaches both the suggestion request and the results link.
  assert.doesNotMatch(live, /<select\b/i);
  assert.match(live, /<SelectMenu\b/);
  assert.match(live, /name="scope"/);
  assert.match(live, /onValueChange=\{setScope\}/);
  assert.match(live, /\/api\/search\?q=\$\{encodeURIComponent\(query\.trim\(\)\)\}&scope=/);
  assert.match(live, /href=\{resultsHref\}/);
  assert.match(selectMenu, /onValueChange\?\.\(value\)/);
  assert.match(styles, /\.select-menu-scope \.select-menu-trigger/);

  // Suggestions are narrowed by kind and group, so a scope cannot leak the wrong
  // kind of result.
  assert.match(api, /parseSearchScope/);
  assert.match(repository, /searchCatalog\(query: string, limitPerGroup = 5, scope: SearchScope = "all"\)/);
  assert.match(repository, /kind: item\.type === "tv_show" \? "tv_show" : "movie"/);
  assert.match(repository, /kind: "adult" as const/);
  assert.match(repository, /definition\.kinds\.includes\(item\.kind\)/);
  assert.match(repository, /definition\.groups\.includes\(group\)/);

  // The results page is a real advanced search: scope plus the shared filter bar,
  // with crawlable scope links instead of a client-only control.
  assert.match(page, /Advanced search/);
  assert.match(page, /\.\.\.definition\.query, \.\.\.filterQueryOptions\(filters\)/);
  assert.match(page, /<SearchScopeTabs term=\{term\} scope=\{scope\} \/>/);
  assert.match(page, /hideType: Boolean\(definition\.query\.type\)/);
  assert.match(page, /hideYear: definition\.query\.catalog === "porn"/);
  assert.match(page, /robots: \{ index: false, follow: true \}/);
  assert.match(tabs, /aria-current=\{item\.value === scope \? "page" : undefined\}/);
  assert.match(styles, /\.search-scope-tabs a\.active/);
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

  // The results page must stay crawlable so its noindex is actually read. Blocking it
  // in robots.txt while the footer and 404 link to it produces "Blocked by robots.txt"
  // and leaves the noindex unseen.
  const robots = await source("app/robots.ts");
  assert.doesNotMatch(robots, /"\/search"/);
  assert.match(robots, /disallow: \["\/api\/", "\/admin\/"\]/);
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
  assert.match(schema, /"WebPage"/);
  assert.doesNotMatch(schema, /"VideoObject"/);
  assert.match(actressPage, /beforeGrid={<EntityContext/);
  assert.match(moviePage, /collectionSchema/);
  assert.match(watchPage, /isPartOf/);
  assert.match(packageJson, /"seo:audit"/);
  assert.doesNotMatch(context, /openai|anthropic|generateText|chat\.completions/i);
});

test("publishes complete VideoObject data only on canonical watch pages", async () => {
  const [watchPage, schema, repository] = await Promise.all([
    source("app/watch/[slug]/page.tsx"),
    source("lib/structured-data.ts"),
    source("lib/catalog/repository.ts"),
  ]);

  assert.match(watchPage, /"@type": "VideoObject"/);
  assert.match(watchPage, /description: enrichedDescription/);
  assert.match(watchPage, /embedUrl: video\.embedUrl/);
  assert.match(watchPage, /uploadDate: videoUploadDate\(video\)/);
  assert.match(schema, /CATALOG_LAUNCH_DATE/);
  assert.match(repository, /COALESCE\(v\.published_at, v\.first_seen_at\) AS publishedAt/);
});

test("keeps ExoClick configuration valid and uses a fresh document lifecycle for monetized navigation", async () => {
  const [adSlot, globalFormats, mobilePopunder, desktopPopunder, revenueLink, catalog, catalogFilters, liveSearch, drawer, directory, watchPage, layout, css, envExample, productionCheck, adCheck, adsTxtRoute, favicon, socialImage] = await Promise.all([
    source("components/ads/ad-slot.tsx"),
    source("components/ads/global-ad-formats.tsx"),
    source("components/ads/mobile-popunder.tsx"),
    source("components/ads/desktop-popunder.tsx"),
    source("components/navigation/revenue-link.tsx"),
    source("components/catalog.tsx"),
    source("components/catalog-filters.tsx"),
    source("components/search/live-search.tsx"),
    source("components/navigation/browse-drawer.tsx"),
    source("components/directory/entity-directory.tsx"),
    source("app/watch/[slug]/page.tsx"),
    source("app/layout.tsx"),
    source("app/globals.css"),
    source(".env.example"),
    source("scripts/check-production-env.mjs"),
    source("scripts/ads/check-exoclick.mjs"),
    source("app/ads.txt/route.ts"),
    source("public/favicon.svg"),
    source("public/og-source.svg"),
  ]);

  assert.match(adSlot, /NEXT_PUBLIC_ADS_ENABLED === "true"/);
  assert.match(adSlot, /a\.magsrv\.com\/ad-provider\.js/);
  assert.match(adSlot, /IntersectionObserver/);
  assert.match(adSlot, /isNearViewport\(element\)/);
  assert.match(adSlot, /window\.addEventListener\("scroll", activateIfNear/);
  assert.match(adSlot, /\[active, device, format, visible\]/);
  assert.doesNotMatch(adSlot, /status === "empty"/);
  assert.match(adSlot, /validZone/);
  assert.match(adSlot, /NEXT_PUBLIC_EXOCLICK_CATALOG_MOBILE_ZONE_ID/);
  assert.match(adSlot, /NEXT_PUBLIC_EXOCLICK_OUTSTREAM_ZONE_ID/);
  assert.match(adSlot, /NEXT_PUBLIC_EXOCLICK_STICKY_ZONE_ID/);
  assert.match(adSlot, /NEXT_PUBLIC_EXOCLICK_INSTANT_ZONE_ID/);
  assert.match(adSlot, /NEXT_PUBLIC_EXOCLICK_VIDEO_SLIDER_ZONE_ID/);
  assert.match(adSlot, /NEXT_PUBLIC_EXOCLICK_DESKTOP_FPI_ZONE_ID/);
  assert.match(adSlot, /NEXT_PUBLIC_EXOCLICK_MOBILE_FPI_ZONE_ID/);
  assert.match(adSlot, /NEXT_PUBLIC_EXOCLICK_MOBILE_INSTANT_ZONE_ID/);
  assert.match(adSlot, /NEXT_PUBLIC_EXOCLICK_MOBILE_INFEED_ZONE_ID/);
  assert.match(adSlot, /"watch-outstream": \{\s+zoneId: process\.env\.NEXT_PUBLIC_EXOCLICK_MOBILE_INFEED_ZONE_ID/);
  assert.match(adSlot, /a\.pemsrv\.com\/ad-provider\.js/);
  assert.match(adSlot, /matchMedia\("\(max-width: 820px\)"\)/);
  assert.match(adSlot, /Device \| null/);
  assert.match(adSlot, /!device \|\| failed \|\| !validZone/);
  assert.doesNotMatch(adSlot, /failed \|\| status === "empty"/);
  assert.doesNotMatch(adSlot, /usePathname|useSearchParams|routeKey/);
  assert.match(adSlot, /zone\.dataset\.processed === "true"/);
  assert.match(adSlot, /host\.replaceChildren\(zone\)/);
  assert.match(adSlot, /scheduleServe\(\)/);
  assert.match(adSlot, /hasRenderedCreative/);
  assert.match(adSlot, /creativeDisplayed-/);
  assert.match(adSlot, /format === "overlay" \? undefined/);
  assert.match(adSlot, /EMPTY_RETRY_DELAY_MS/);
  assert.match(adSlot, /MAX_EMPTY_RETRIES = 2/);
  assert.match(adSlot, /document\.visibilityState !== "visible"/);
  assert.match(adSlot, /const retryVisibleEmptyZone = \(\) =>/);
  assert.match(adSlot, /document\.addEventListener\("visibilitychange", resumeEmptyRetry\)/);
  assert.match(adSlot, /window\.addEventListener\("pageshow", resumeEmptyRetry\)/);
  assert.match(adSlot, /window\.addEventListener\("online", resumeEmptyRetry\)/);
  assert.match(adSlot, /window\.addEventListener\("scroll", resumeEmptyRetry/);
  assert.match(adSlot, /needsEmptyRetry = true;\s+emptyRetryTimer = window\.setTimeout\(retryVisibleEmptyZone/);
  assert.doesNotMatch(adSlot, /servedOverlayZoneRef|RETRY_AFTER_MS|mountZone\(true\)/);
  assert.doesNotMatch(adSlot, /data-ex_av/);
  assert.match(globalFormats, /const publicPage = !pathname\.startsWith\("\/admin"\)/);
  assert.match(globalFormats, /const instantActive = monetizedRoute && !isReels/);
  assert.match(globalFormats, /const fullpageActive = device === "mobile" \? isWatch : monetizedRoute/);
  assert.match(globalFormats, /device === "desktop" && <AdSlot active=\{monetizedRoute\} key=\{`sticky-\$\{pathname\}`\} placement="desktop-sticky"/);
  assert.match(globalFormats, /!isReels && <AdSlot active=\{instantActive\} key=\{`instant-\$\{pathname\}`\} placement="catalog-instant"/);
  assert.doesNotMatch(globalFormats, /directoryRoutes/);
  assert.match(globalFormats, /placement="catalog-instant"/);
  assert.match(globalFormats, /placement="watch-slider"/);
  assert.match(globalFormats, /device === "desktop" && <AdSlot active=\{isWatch\} key=\{`slider-\$\{pathname\}`\} placement="watch-slider"/);
  assert.match(globalFormats, /device === "mobile" && isCatalog && <MobilePopunder \/>/);
  assert.match(globalFormats, /device === "desktop" && monetizedRoute && !isReels && <DesktopPopunder \/>/);
  assert.match(globalFormats, /active=\{fullpageActive\} key=\{`fullpage-\$\{pathname\}`\} placement="fullpage"/);
  assert.match(mobilePopunder, /NEXT_PUBLIC_EXOCLICK_MOBILE_POPUNDER_ZONE_ID/);
  assert.match(mobilePopunder, /a\.pemsrv\.com\/popunder1000\.js/);
  assert.match(mobilePopunder, /actrexx-mobile-pop/);
  assert.match(mobilePopunder, /matchMedia\("\(max-width: 820px\)"\)/);
  assert.match(mobilePopunder, /script\.addEventListener\("error"/);
  assert.match(desktopPopunder, /NEXT_PUBLIC_EXOCLICK_DESKTOP_POPUNDER_ZONE_ID/);
  assert.match(desktopPopunder, /NEXT_PUBLIC_EXOCLICK_DESKTOP_POPUNDER_FREQUENCY_PERIOD \|\| "10"/);
  assert.match(desktopPopunder, /NEXT_PUBLIC_EXOCLICK_DESKTOP_POPUNDER_FREQUENCY_COUNT \|\| "3"/);
  assert.match(mobilePopunder, /NEXT_PUBLIC_EXOCLICK_MOBILE_POPUNDER_FREQUENCY_PERIOD \|\| "10"/);
  assert.match(mobilePopunder, /NEXT_PUBLIC_EXOCLICK_MOBILE_POPUNDER_FREQUENCY_COUNT \|\| "3"/);
  assert.match(desktopPopunder, /matchMedia\("\(min-width: 821px\)"\)/);
  assert.match(desktopPopunder, /actrexx-desktop-pop/);
  assert.match(desktopPopunder, /a\.pemsrv\.com\/popunder1000\.js/);
  assert.match(desktopPopunder, /window\.ad_new_tab = true/);
  assert.match(mobilePopunder, /window\.ad_new_tab = true/);
  assert.match(adSlot, /zone\.dataset\.sub = String\(placementSubIds\[placement\]\)/);
  assert.match(adSlot, /zone\.dataset\.keywords = keywords/);
  assert.match(revenueLink, /return <a/);
  assert.match(revenueLink, /actrexx-mobile-pop/);
  assert.match(revenueLink, /actrexx-desktop-pop/);
  assert.doesNotMatch(revenueLink, /next\/link/);
  assert.match(catalog, /navigation\/revenue-link/);
  assert.match(catalogFilters, /window\.location\.assign/);
  assert.match(liveSearch, /window\.location\.assign/);
  assert.match(liveSearch, /placement="search-compact"/);
  assert.match(drawer, /placement="drawer-compact"/);
  assert.match(directory, /placement="catalog-top"/);
  assert.match(directory, /placement="catalog-footer"/);
  assert.match(catalog, /placement="catalog-footer"/);
  assert.match(catalog, /mobilePaginationItems\(page, pages\)/);
  assert.match(catalog, /Math\.min\(4, total\)/);
  assert.match(catalog, /\(index \+ 1\) % 4 === 0 && index < visible\.length - 1 && <AdSlot placement="mobile-infeed"/);
  assert.match(watchPage, /placement="watch-footer"/);
  assert.match(layout, /<GlobalAdFormats \/>/);
  assert.doesNotMatch(layout, /AdRouteSync/);
  assert.match(envExample, /NEXT_PUBLIC_EXOCLICK_BLOCK_AD_TYPES=/);
  assert.match(envExample, /NEXT_PUBLIC_EXOCLICK_MOBILE_FPI_ZONE_ID=/);
  assert.match(envExample, /NEXT_PUBLIC_EXOCLICK_MOBILE_INSTANT_ZONE_ID=/);
  assert.match(envExample, /NEXT_PUBLIC_EXOCLICK_MOBILE_POPUNDER_ZONE_ID=/);
  assert.match(envExample, /NEXT_PUBLIC_EXOCLICK_DESKTOP_POPUNDER_ZONE_ID=/);
  assert.match(envExample, /NEXT_PUBLIC_EXOCLICK_DRAWER_MOBILE_ZONE_ID=/);
  assert.match(envExample, /NEXT_PUBLIC_EXOCLICK_SEARCH_MOBILE_ZONE_ID=/);
  assert.match(envExample, /NEXT_PUBLIC_EXOCLICK_MOBILE_INFEED_ZONE_ID=/);
  assert.match(css, /\.pagination-mobile-pages \{ display:none; \}/);
  assert.match(css, /\.pagination-mobile-pages a \{ width:34px; height:34px; \}/);
  assert.match(css, /\.pagination \+ \.content-end-ad \{ margin-top:20px; padding-top:14px; \}/);
  assert.match(css, /\.ad-slot:not\(\.ad-slot-overlay\) iframe/);
  assert.match(css, /\.ad-slot\[data-state="empty"\] \{ min-height:0; height:0; padding:0; border:0; margin-block:0; overflow:hidden; \}/);
  assert.match(css, /\.ad-slot\[data-state="idle"\], \.ad-slot\[data-state="loading"\] \{ min-height:0; height:0/);
  assert.match(css, /\.content-end-ad:not\(:has\(> \.ad-slot\[data-state="loaded"\]\)\), \.watch-banner:not/);
  assert.match(css, /\.ad-slot-overlay \.ad-zone-host \{ width:auto; max-width:none/);
  assert.match(css, /\.ad-slot-overlay\[data-placement="fullpage"\] \{ width:100vw; height:100vh; height:100dvh; position:fixed/);
  assert.match(css, /\.ad-slot-overlay\[data-placement="fullpage"\] \.ad-zone-host, \.ad-slot-overlay\[data-placement="fullpage"\] \.ad-zone-host > ins \{ width:100%; height:100%/);
  assert.match(css, /\.ad-slot-overlay\[data-placement="fullpage"\] \.ad-zone-host > ins > \*, \.ad-slot-overlay\[data-placement="fullpage"\] iframe, \.ad-slot-overlay\[data-placement="fullpage"\] img \{ max-width:none; max-height:none; pointer-events:auto; \}/);
  assert.match(css, /\.ad-slot-infeed \{ min-height:250px; grid-column:1 \/ -1/);
  assert.doesNotMatch(adSlot, /\|\| "101"/);
  assert.match(productionCheck, /Advertising is enabled but configuration is incomplete/);
  assert.match(productionCheck, /optionalPlacements/);
  assert.match(adCheck, /Ads\.txt:/);
  assert.match(adsTxtRoute, /status: 404/);
  assert.doesNotMatch(favicon, /M27 18v27h17|LUMA/i);
  assert.match(socialImage, /ACTREXX/);
  assert.doesNotMatch(socialImage, /LUMA/i);
  const chrome = await source("components/site-chrome.tsx");
  assert.match(watchPage, /placement="below-player"/);
  assert.match(watchPage, /placement="watch-outstream"/);
  assert.ok(chrome.indexOf('placement="sidebar"') < chrome.indexOf("Popular actresses"));
});

test("keeps vertical swipe videos isolated, bounded, and VAST-enabled", async () => {
  const [page, feed, vast, home, repository, envExample, sitemap] = await Promise.all([
    source("app/swipe-videos/page.tsx"),
    source("components/reels/reels-feed.tsx"),
    source("components/reels/vertical-vast-slide.tsx"),
    source("app/page.tsx"),
    source("lib/catalog/repository.ts"),
    source(".env.example"),
    source("lib/sitemaps.ts"),
  ]);

  assert.match(page, /getPopularVideos\(200\)/);
  assert.match(page, /NEXT_PUBLIC_EXOCLICK_VERTICAL_VAST_TAG_URL/);
  assert.match(feed, /const AD_INTERVAL = 3/);
  assert.match(feed, /const pendingAd = items\.findIndex/);
  assert.match(feed, /index === activeIndex && <VerticalVastSlide/);

  // Jumps must be instant. scrollTo({ behavior: "auto" }) inherits the smooth
  // computed scroll-behavior, so direct scrollTop assignment is used instead, and
  // the ad slide is pinned before paint so it never shows halfway scrolled.
  assert.match(feed, /root\.scrollTop = slide\.offsetTop/);
  assert.equal(feed.match(/root\.scrollTo\(/g).length, 1);
  assert.match(feed, /root\.scrollTo\(\{ top: slide\.offsetTop, behavior: "smooth" \}\)/);
  assert.match(feed, /useLayoutEffect\(\(\) => \{\s*if \(!adActive\) return;/);
  assert.match(feed, /pinToIndex\(pendingAd\)/);
  assert.match(feed, /window\.addEventListener\("orientationchange", repin\)/);

  // A single pin loses to the coasting gesture that reached the ad, so the position
  // is re-asserted across frames and on every scroll while the ad is locked in.
  assert.match(feed, /root\.addEventListener\("scroll", enforce/);
  assert.match(feed, /if \(Math\.abs\(root\.scrollTop - top\) > 1\) root\.scrollTop = top;/);
  assert.match(feed, /if \(frames < 40\) frame = window\.requestAnimationFrame\(settle\)/);
  assert.match(feed, /viewport\?\.addEventListener\("resize", repin\)/);
  assert.match(feed, /key=\{`reels-instant-\$\{activeIndex\}`\} placement="catalog-instant"/);
  assert.match(feed, /Math\.abs\(index - activeIndex\) <= 1/);
  assert.match(feed, /reels-feed-locked/);
  assert.match(feed, /if \(adActive && \["ArrowDown", "PageDown", "ArrowUp", "PageUp", " "\]/);
  assert.match(feed, /Swipe up to explore/);
  assert.match(feed, /navigator\.share/);
  assert.match(feed, /className="reel-share"/);
  assert.match(vast, /import\("@dailymotion\/vast-client"\)/);
  assert.match(vast, /trackImpression\(\)/);
  assert.match(vast, /Math\.ceil\(vastSkipDelay\) : FALLBACK_SKIP_SECONDS/);
  assert.doesNotMatch(vast, /VERTICAL_AD_CAP_MS|sessionStorage/);
  assert.match(vast, /onUnavailable\(checkpoint\);/);

  // The feed is scroll-locked on an ad slide, so the slide always has an exit:
  // a mount watchdog, plus a countdown that never starts from a null state.
  assert.match(vast, /const AD_LOAD_BUDGET_MS = 6_000/);
  assert.match(vast, /if \(alive && !impressedRef\.current\) onUnavailable\(checkpoint\);/);
  assert.match(vast, /useState\(FALLBACK_SKIP_SECONDS\)/);
  assert.match(vast, /disabled=\{skipSeconds > 0\}/);
  assert.doesNotMatch(vast, /skipSeconds === null/);
  assert.doesNotMatch(page, /<SiteHeader/);

  // Indexable page, so it needs a heading even though the chrome is hidden.
  assert.match(page, /<h1 className="sr-only">Popular celebrity swipe videos<\/h1>/);

  // The reels route hides the site chrome, so it carries its own way back out.
  assert.match(feed, /className="reels-chrome-link" href="\/"/);
  assert.match(feed, /aria-label="Leave swipe videos"/);

  assert.match(home, /<PopularHero videos=\{popular\} \/>/);
  assert.match(home, /<HomeDiscovery latest=\{result\.items\} preview=\{preview!\} \/>/);
  assert.match(repository, /export async function getPopularVideos\(limit = 100\)/);
  assert.match(envExample, /NEXT_PUBLIC_EXOCLICK_VERTICAL_VAST_TAG_URL=/);
  assert.match(sitemap, /"\/swipe-videos"/);
});
