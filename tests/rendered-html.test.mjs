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
  assert.match(drawer, /Popular actresses/);
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
  assert.match(css, /\.browse-drawer nav > a/);
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
  assert.match(robots, /disallow: \["\/api\/", "\/admin\/", "\/search"\]/);
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
  assert.ok((repository.match(/shouldCache: \((?:result|outcome)\) => (?:result|outcome)\.database/g) ?? []).length >= 8);
  assert.match(watchPage, /export const revalidate = 86_400/);
  assert.match(watchPage, /return \[\]/);
  assert.doesNotMatch(layout, /requestOrigin/);
  assert.doesNotMatch(d1, /cache: "no-store"/);
  assert.match(upstash, /cache: "default"/);
  assert.match(upstash, /const CACHE_SCHEMA_VERSION = "v2"/);
  assert.match(upstash, /const inFlight = new Map/);
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
  assert.match(globalFormats, /const instantActive = publicPage && !isReels/);
  assert.match(globalFormats, /const fullpageActive = device === "mobile" \? isWatch : monetizedRoute/);
  assert.match(globalFormats, /device === "desktop" && <AdSlot active=\{monetizedRoute\} key=\{`sticky-\$\{pathname\}`\} placement="desktop-sticky"/);
  assert.match(globalFormats, /!isReels && <AdSlot active=\{instantActive\} key=\{`instant-\$\{pathname\}`\} placement="catalog-instant"/);
  assert.doesNotMatch(globalFormats, /directoryRoutes/);
  assert.match(globalFormats, /placement="catalog-instant"/);
  assert.match(globalFormats, /placement="watch-slider"/);
  assert.match(globalFormats, /device === "desktop" && <AdSlot active=\{isWatch\} key=\{`slider-\$\{pathname\}`\} placement="watch-slider"/);
  assert.match(globalFormats, /device === "mobile" && isCatalog && <MobilePopunder \/>/);
  assert.match(globalFormats, /device === "desktop" && !isReels && <DesktopPopunder \/>/);
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
  assert.match(css, /\.ad-slot-overlay\[data-placement="fullpage"\] \.ad-zone-host > ins > \*, \.ad-slot-overlay\[data-placement="fullpage"\] iframe \{ max-width:none; max-height:none; pointer-events:auto; \}/);
  assert.match(css, /\.ad-slot-infeed \{ min-height:250px; grid-column:1 \/ -1/);
  assert.doesNotMatch(adSlot, /\|\| "101"/);
  assert.match(productionCheck, /Advertising is enabled but configuration is incomplete/);
  assert.match(productionCheck, /optionalPlacements/);
  assert.match(adCheck, /ADS_TXT is missing/);
  assert.match(adsTxtRoute, /status: 404/);
  assert.doesNotMatch(favicon, /M27 18v27h17|LUMA/i);
  assert.match(socialImage, /ACTREXX/);
  assert.doesNotMatch(socialImage, /LUMA/i);
  const chrome = await source("components/site-chrome.tsx");
  assert.match(watchPage, /placement="below-player"/);
  assert.match(watchPage, /placement="watch-outstream"/);
  assert.ok(chrome.indexOf('placement="sidebar"') < chrome.indexOf("Popular actresses"));
});

test("keeps vertical reels isolated, bounded, and VAST-enabled", async () => {
  const [page, feed, vast, home, repository, envExample, sitemap] = await Promise.all([
    source("app/reels/page.tsx"),
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
  assert.match(feed, /root\.scrollTo\(\{ top: adSlide\.offsetTop, behavior: "auto" \}\)/);
  assert.match(feed, /index === activeIndex && <VerticalVastSlide/);
  assert.match(feed, /key=\{`reels-instant-\$\{activeIndex\}`\} placement="catalog-instant"/);
  assert.match(feed, /Math\.abs\(index - activeIndex\) <= 1/);
  assert.match(feed, /reels-feed-locked/);
  assert.match(feed, /if \(adActive && \["ArrowDown", "PageDown", "ArrowUp", "PageUp", " "\]/);
  assert.match(feed, /Swipe up to explore/);
  assert.match(feed, /navigator\.share/);
  assert.match(feed, /className="reel-share"/);
  assert.match(vast, /import\("@dailymotion\/vast-client"\)/);
  assert.match(vast, /trackImpression\(\)/);
  assert.match(vast, /Math\.ceil\(vastSkipDelay\) : 10/);
  assert.match(vast, /skipSeconds \?\? 10/);
  assert.doesNotMatch(vast, /VERTICAL_AD_CAP_MS|sessionStorage/);
  assert.match(vast, /onUnavailable\(checkpoint\);/);
  assert.doesNotMatch(page, /<SiteHeader/);
  assert.match(home, /beforeHeading=\{<PopularNow videos=\{popular\} \/>\}/);
  assert.match(repository, /export async function getPopularVideos\(limit = 100\)/);
  assert.match(envExample, /NEXT_PUBLIC_EXOCLICK_VERTICAL_VAST_TAG_URL=/);
  assert.match(sitemap, /"\/reels"/);
});
