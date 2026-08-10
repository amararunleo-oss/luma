import { AppError, errorResponse } from "@/lib/http/errors";
import { getR2Object, hasR2Configuration, headR2Object } from "@/lib/cloudflare/r2-s3";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function serve(request: Request, { params }: { params: Promise<{ key: string[] }> }, head = false) {
  try {
    const { key: parts } = await params;
    const key = parts.map((part) => decodeURIComponent(part)).join("/");
    if (!/^previews\/v1\/\d{3}\/\d+\/poster$/.test(key)) throw new AppError(404, "MEDIA_NOT_FOUND", "Media not found.");
    if (!hasR2Configuration()) throw new AppError(503, "MEDIA_UNAVAILABLE", "Media storage is temporarily unavailable.");
    let body: ReadableStream | null = null;
    const object = head ? await headR2Object(key) : await getR2Object(key).then((result) => {
      body = result?.body ?? null;
      return result;
    });
    if (!object) throw new AppError(404, "MEDIA_NOT_FOUND", "Media not found.");
    const etag = object.etag.startsWith('"') ? object.etag : `"${object.etag}"`;
    const headers: Record<string, string> = {
      "content-type": object.contentType,
      "cache-control": "public, max-age=31536000, immutable",
      "cdn-cache-control": "public, max-age=31536000, immutable",
      "cross-origin-resource-policy": "same-origin",
      etag,
      "x-content-type-options": "nosniff",
    };
    if (object.contentLength !== undefined) headers["content-length"] = String(object.contentLength);
    if (object.lastModified) headers["last-modified"] = object.lastModified.toUTCString();
    if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
    return new Response(body, { headers });
  } catch (error) {
    return errorResponse(error);
  }
}

export function GET(request: Request, context: { params: Promise<{ key: string[] }> }) {
  return serve(request, context);
}

export function HEAD(request: Request, context: { params: Promise<{ key: string[] }> }) {
  return serve(request, context, true);
}
