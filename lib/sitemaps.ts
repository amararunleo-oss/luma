import { getAdultCategoryCounts, getCatalogSitemapChunk, getCatalogSitemapCounts, listVideos, type CatalogSitemapEntry, type CatalogSitemapSection } from "@/lib/catalog/repository";
import { COLLECTIONS } from "@/lib/collections";
import { ADULT_CATEGORIES, ADULT_CATEGORY_MINIMUM_VIDEOS } from "@/lib/adult-taxonomy";

export const SITEMAP_CHUNK_SIZE = 10_000;
// Leave headroom below serverless response-size ceilings when metadata is long.
export const VIDEO_SITEMAP_CHUNK_SIZE = 4_000;
export const STATIC_SITEMAP_PATHS = [
  "",
  "/latest",
  "/actress",
  "/movie",
  "/tv-show",
  "/most-popular",
  "/swipe-videos",
  "/collections",
  ...COLLECTIONS.map((collection) => `/collections/${collection.slug}`),
  "/top-rated",
  "/about",
  "/privacy",
  "/terms",
  "/rights",
  "/contact",
  "/dmca",
  "/2257",
] as const;

export type SitemapDescriptor = { id: string; section: "static" | CatalogSitemapSection | "video-media"; offset: number };

function chunks(section: CatalogSitemapSection, count: number): SitemapDescriptor[] {
  return Array.from({ length: Math.max(1, Math.ceil(count / SITEMAP_CHUNK_SIZE)) }, (_, index) => ({
    id: `${section}-${index}`,
    section,
    offset: index * SITEMAP_CHUNK_SIZE,
  }));
}

export async function getSitemapDescriptors(): Promise<SitemapDescriptor[]> {
  const counts = await getCatalogSitemapCounts();
  return [
    { id: "static", section: "static", offset: 0 },
    ...chunks("videos", counts.videos),
    ...chunks("actresses", counts.actresses),
    ...chunks("works", counts.works),
    ...chunks("taxonomy", counts.taxonomy),
    ...Array.from({ length: Math.max(1, Math.ceil(counts.videos / VIDEO_SITEMAP_CHUNK_SIZE)) }, (_, index) => ({
      id: `videos-${index}`,
      section: "video-media" as const,
      offset: index * VIDEO_SITEMAP_CHUNK_SIZE,
    })),
  ];
}

export function sitemapDescriptorPath(descriptor: SitemapDescriptor) {
  return descriptor.section === "video-media" ? `/video-sitemaps/${descriptor.id}.xml` : `/sitemaps/${descriptor.id}.xml`;
}

export function parseSitemapId(value: string): SitemapDescriptor | null {
  const id = value.replace(/\.xml$/i, "");
  if (id === "static") return { id, section: "static", offset: 0 };
  const match = /^(videos|actresses|works|taxonomy)-(\d+)$/.exec(id);
  if (!match) return null;
  const section = match[1] as CatalogSitemapSection;
  const index = Number(match[2]);
  if (!Number.isSafeInteger(index) || index < 0) return null;
  return { id, section, offset: index * SITEMAP_CHUNK_SIZE };
}

export async function getSitemapEntries(descriptor: SitemapDescriptor): Promise<CatalogSitemapEntry[]> {
  if (descriptor.section === "static") {
    const catalog = await listVideos({ catalog: "porn", page: 1, pageSize: 1 });
    if (catalog.total < ADULT_CATEGORY_MINIMUM_VIDEOS) return STATIC_SITEMAP_PATHS.map((path) => ({ path }));
    const counts = await getAdultCategoryCounts();
    const categoryCounts = ADULT_CATEGORIES.map((category) => ({ category, total: counts[category.slug] ?? 0 }));
    return [
      ...STATIC_SITEMAP_PATHS,
      "/porn-videos",
      "/porn-videos/latest",
      "/porn-videos/popular",
      "/porn-videos/top-rated",
      "/porn-categories",
      ...categoryCounts.filter((item) => item.total >= ADULT_CATEGORY_MINIMUM_VIDEOS).map((item) => `/porn-category/${item.category.slug}`),
    ].map((path) => ({ path }));
  }
  if (descriptor.section === "video-media") return [];
  return getCatalogSitemapChunk(descriptor.section, descriptor.offset, SITEMAP_CHUNK_SIZE);
}

export function parseVideoSitemapId(value: string) {
  const match = /^videos-(\d+)\.xml$/i.exec(value);
  if (!match) return null;
  const index = Number(match[1]);
  if (!Number.isSafeInteger(index) || index < 0) return null;
  return { id: `videos-${index}`, offset: index * VIDEO_SITEMAP_CHUNK_SIZE };
}

export function escapeXml(value: string) {
  const xmlSafe = Array.from(value, (character) => {
    const code = character.codePointAt(0) ?? 0;
    const invalidControl = code <= 8 || code === 11 || code === 12 || (code >= 14 && code <= 31);
    return invalidControl || code === 0xfffe || code === 0xffff ? "" : character;
  }).join("");
  return xmlSafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
