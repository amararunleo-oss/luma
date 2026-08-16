// Custom next/image loader.
//
// Thumbnail bytes live in R2 and /media/[...key] 307-redirects to a signed R2 URL,
// so routing them through Vercel's optimizer would add a paid transformation and a
// proxy hop. A custom loader keeps that out of Vercel while still letting next/image
// emit a real srcset, so phones stop downloading desktop-sized images.
//
// Set NEXT_PUBLIC_MEDIA_RESIZE_BASE to a Cloudflare image-resizing endpoint, for
// example https://cdn.example.com/cdn-cgi/image. Until it is set this is a
// passthrough and behaves exactly like the previous unoptimized configuration.

const resizeBase = process.env.NEXT_PUBLIC_MEDIA_RESIZE_BASE?.trim().replace(/\/$/, "");

export default function mediaLoader({ src, width, quality }: { src: string; width: number; quality?: number }) {
  if (!resizeBase) {
    // Without a resize endpoint this is a passthrough. Appending a width hint as a
    // fragment satisfies Next.js's "loader must implement width" check without
    // actually changing the request (fragments are not sent to the server).
    return `${src}#w=${width}`;
  }
  const target = /^https?:\/\//i.test(src) ? src : src.startsWith("/") ? src : `/${src}`;
  const options = [`width=${Math.round(width)}`, "format=auto", `quality=${quality ?? 78}`, "fit=cover"].join(",");
  return `${resizeBase}/${options}${target.startsWith("/") ? target : `/${target}`}`;
}
