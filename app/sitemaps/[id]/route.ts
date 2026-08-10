import { configuredSiteOrigin } from "@/lib/seo";
import { escapeXml, getSitemapEntries, parseSitemapId } from "@/lib/sitemaps";

export const revalidate = 86_400;

function lastModified(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : `<lastmod>${date.toISOString()}</lastmod>`;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!id.toLowerCase().endsWith(".xml")) return new Response("Not found", { status: 404 });
  const descriptor = parseSitemapId(id);
  if (!descriptor) return new Response("Not found", { status: 404 });
  const origin = configuredSiteOrigin();
  const entries = await getSitemapEntries(descriptor);
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map((item) => `<url><loc>${escapeXml(new URL(item.path, origin).toString())}</loc>${lastModified(item.updatedAt)}</url>`),
    "</urlset>",
  ].join("");
  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
