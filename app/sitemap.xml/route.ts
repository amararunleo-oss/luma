import { configuredSiteOrigin } from "@/lib/seo";
import { escapeXml, getSitemapDescriptors } from "@/lib/sitemaps";

export const revalidate = 21_600;

export async function GET() {
  const origin = configuredSiteOrigin();
  const descriptors = await getSitemapDescriptors();
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...descriptors.map((item) => `<sitemap><loc>${escapeXml(`${origin}/sitemaps/${item.id}.xml`)}</loc></sitemap>`),
    "</sitemapindex>",
  ].join("");
  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
