import { env } from "cloudflare:workers";
import { AppError, errorResponse } from "@/lib/http/errors";

type R2ObjectBody = {
  body: ReadableStream;
  etag: string;
  httpMetadata?: { contentType?: string };
};

type Bucket = { get(key: string): Promise<R2ObjectBody | null> };

async function serve(request: Request, { params }: { params: Promise<{ key: string[] }> }, head = false) {
  try {
    const { key: parts } = await params;
    const key = parts.map((part) => decodeURIComponent(part)).join("/");
    if (!/^previews\/v1\/\d{3}\/\d+\/poster$/.test(key)) throw new AppError(404, "MEDIA_NOT_FOUND", "Media not found.");
    const bucket = (env as unknown as { THUMBNAILS?: Bucket }).THUMBNAILS;
    if (!bucket) throw new AppError(503, "MEDIA_UNAVAILABLE", "Media storage is temporarily unavailable.");
    const object = await bucket.get(key);
    if (!object) throw new AppError(404, "MEDIA_NOT_FOUND", "Media not found.");
    const etag = object.etag.startsWith('"') ? object.etag : `"${object.etag}"`;
    const headers = {
      "content-type": object.httpMetadata?.contentType ?? "image/webp",
      "cache-control": "public, max-age=31536000, immutable",
      "cdn-cache-control": "public, max-age=31536000, immutable",
      "cross-origin-resource-policy": "same-origin",
      etag,
      "x-content-type-options": "nosniff",
    };
    if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
    return new Response(head ? null : object.body, { headers });
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
