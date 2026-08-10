import { getCatalogSitemapChunk, getCatalogSitemapCounts, type CatalogSitemapEntry, type CatalogSitemapSection } from "@/lib/catalog/repository";

export const SITEMAP_CHUNK_SIZE = 10_000;
export const STATIC_SITEMAP_PATHS = [
  "",
  "/actress",
  "/movie",
  "/tv-show",
  "/most-popular",
  "/top-rated",
  "/about",
  "/privacy",
  "/terms",
  "/contact",
  "/dmca",
  "/2257",
] as const;

export type SitemapDescriptor = { id: string; section: "static" | CatalogSitemapSection; offset: number };

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
  ];
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
  if (descriptor.section === "static") return STATIC_SITEMAP_PATHS.map((path) => ({ path }));
  return getCatalogSitemapChunk(descriptor.section, descriptor.offset, SITEMAP_CHUNK_SIZE);
}

export function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
