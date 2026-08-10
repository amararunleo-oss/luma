/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  THUMBNAILS: R2Bucket;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" || request.method === "HEAD") {
      const isApplicationRoute = !url.pathname.startsWith("/_") && !url.pathname.startsWith("/media/") && !url.pathname.includes(".");
      if (isApplicationRoute) {
        let redirect = false;
        if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
          url.pathname = url.pathname.replace(/\/+$/, "");
          redirect = true;
        }
        const lowercasePath = url.pathname.toLowerCase();
        if (lowercasePath !== url.pathname) {
          url.pathname = lowercasePath;
          redirect = true;
        }
        if (url.searchParams.get("page") === "1") {
          url.searchParams.delete("page");
          redirect = true;
        }
        if (redirect) return Response.redirect(url.toString(), 308);
      }
    }

    if (url.pathname.startsWith("/media/thumbs/") || url.pathname.startsWith("/media/previews/")) {
      const key = url.pathname.slice("/media/".length);
      if (key.includes("..") || key.includes("\\")) return new Response("Invalid media key", { status: 400 });
      const object = await env.THUMBNAILS.get(key);
      if (!object) return new Response("Not found", { status: 404 });
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set("etag", object.httpEtag);
      headers.set("cache-control", "public, max-age=31536000, immutable");
      headers.set("cdn-cache-control", "public, max-age=31536000, immutable");
      headers.set("cross-origin-resource-policy", "same-origin");
      headers.set("x-content-type-options", "nosniff");
      if (request.headers.get("if-none-match") === object.httpEtag) return new Response(null, { status: 304, headers });
      return new Response(request.method === "HEAD" ? null : object.body, { headers });
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    const response = await handler.fetch(request, env, ctx);
    const headers = new Headers(response.headers);
    headers.set("x-content-type-options", "nosniff");
    headers.set("referrer-policy", "strict-origin-when-cross-origin");
    headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
    if (request.method === "GET" && headers.get("content-type")?.includes("text/html")) {
      headers.set("cache-control", "public, max-age=0, s-maxage=300, stale-while-revalidate=86400");
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};

export default worker;
