import { AppError, errorResponse } from "@/lib/http/errors";
import { hasR2Configuration, headR2Object, signedR2ObjectUrl } from "@/lib/cloudflare/r2-s3";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const browserCache = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=432000";

async function mediaKey({ params }: { params: Promise<{ key: string[] }> }) {
  const { key: parts } = await params;
  const key = parts.map((part) => decodeURIComponent(part)).join("/");
  if (!/^previews\/v1\/\d{3}\/\d+\/poster$/.test(key)) throw new AppError(404, "MEDIA_NOT_FOUND", "Media not found.");
  if (!hasR2Configuration()) throw new AppError(503, "MEDIA_UNAVAILABLE", "Media storage is temporarily unavailable.");
  return key;
}

export async function GET(_request: Request, context: { params: Promise<{ key: string[] }> }) {
  try {
    const key = await mediaKey(context);
    const location = await signedR2ObjectUrl(key);
    if (!location) throw new AppError(503, "MEDIA_UNAVAILABLE", "Media storage is temporarily unavailable.");
    return new Response(null, {
      status: 307,
      headers: {
        location,
        "cache-control": browserCache,
        "cdn-cache-control": "public, max-age=86400, stale-while-revalidate=432000",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function HEAD(_request: Request, context: { params: Promise<{ key: string[] }> }) {
  try {
    const key = await mediaKey(context);
    const object = await headR2Object(key);
    if (!object) throw new AppError(404, "MEDIA_NOT_FOUND", "Media not found.");
    const etag = object.etag.startsWith('"') ? object.etag : `"${object.etag}"`;
    const headers: Record<string, string> = {
      "content-type": object.contentType,
      "cache-control": browserCache,
      "cdn-cache-control": "public, max-age=86400, stale-while-revalidate=432000",
      etag,
      "x-content-type-options": "nosniff",
    };
    if (object.contentLength !== undefined) headers["content-length"] = String(object.contentLength);
    if (object.lastModified) headers["last-modified"] = object.lastModified.toUTCString();
    return new Response(null, { headers });
  } catch (error) {
    return errorResponse(error);
  }
}
