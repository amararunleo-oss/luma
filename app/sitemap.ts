import { getCatalogSitemap } from "@/lib/catalog/repository";
import type { MetadataRoute } from "next";
import { requestOrigin } from "@/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [origin, catalog] = await Promise.all([requestOrigin(), getCatalogSitemap()]);
  const staticPages = ["", "/actress", "/movie", "/tv-show", "/most-popular", "/top-rated", "/dmca", "/2257"];
  return [
    ...staticPages.map((path) => ({ url: `${origin}${path}`, changeFrequency: "daily" as const, priority: path === "" ? 1 : 0.8 })),
    ...catalog.videos.map((item) => ({ url: `${origin}/watch/${item.slug}`, lastModified: new Date(item.updatedAt), changeFrequency: "weekly" as const, priority: 0.7 })),
    ...catalog.actresses.map((item) => ({ url: `${origin}/actress/${item.slug}`, lastModified: new Date(item.updatedAt), changeFrequency: "weekly" as const, priority: 0.6 })),
    ...catalog.works.map((item) => ({ url: `${origin}/${item.type === "movie" ? "movie" : "tv-show"}/title/${item.slug}`, lastModified: new Date(item.updatedAt), changeFrequency: "weekly" as const, priority: 0.6 })),
    ...catalog.tags.map((item) => ({ url: `${origin}/tag/${item.slug}`, changeFrequency: "weekly" as const, priority: 0.5 })),
    ...catalog.years.map((year) => ({ url: `${origin}/year/${year}`, changeFrequency: "monthly" as const, priority: 0.4 })),
  ];
}
