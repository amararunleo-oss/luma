import { getVideoSitemapChunk } from "@/lib/catalog/repository";
import { configuredSiteOrigin } from "@/lib/seo";
import { escapeXml, parseVideoSitemapId, VIDEO_SITEMAP_CHUNK_SIZE } from "@/lib/sitemaps";

export const revalidate = 43_200;

function cleanText(value: string, limit: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, limit);
}

function lastModified(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : `<lastmod>${date.toISOString()}</lastmod>`;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const descriptor = parseVideoSitemapId(id);
  if (!descriptor) return new Response("Not found", { status: 404 });
  const origin = configuredSiteOrigin();
  const entries = await getVideoSitemapChunk(descriptor.offset, VIDEO_SITEMAP_CHUNK_SIZE);
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">',
    ...entries.map((item) => [
      "<url>",
      `<loc>${escapeXml(new URL(item.path, origin).toString())}</loc>`,
      lastModified(item.updatedAt),
      "<video:video>",
      `<video:thumbnail_loc>${escapeXml(new URL(item.thumbnail, origin).toString())}</video:thumbnail_loc>`,
      `<video:title>${escapeXml(cleanText(item.title, 100))}</video:title>`,
      `<video:description>${escapeXml(cleanText(item.description || item.title, 2_048))}</video:description>`,
      `<video:player_loc allow_embed="yes">${escapeXml(item.playerUrl)}</video:player_loc>`,
      `<video:duration>${item.durationSeconds}</video:duration>`,
      `<video:publication_date>${escapeXml(item.publicationDate)}</video:publication_date>`,
      "<video:family_friendly>no</video:family_friendly>",
      "</video:video>",
      "</url>",
    ].join("")),
    "</urlset>",
  ].join("");
  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=43200, stale-while-revalidate=604800",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
