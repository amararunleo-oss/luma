import type { Metadata } from "next";
import { headers } from "next/headers";
import { pageNumber } from "@/lib/videos";
import { SITE } from "@/lib/site";

export function configuredSiteOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured && configured !== "https://example.com") return new URL(configured).origin;
  return process.env.NODE_ENV === "production" ? "https://example.com" : "http://localhost:3000";
}

export async function requestOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured && configured !== "https://example.com") return new URL(configured).origin;

  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${protocol}://${host}`;
}

export function absoluteUrl(origin: string, path: string) {
  return new URL(path, origin).toString();
}

export function catalogMetadata({
  title,
  description,
  path,
  page,
  index = true,
  keywords = [],
}: {
  title: string;
  description: string;
  path: string;
  page?: string;
  index?: boolean;
  keywords?: readonly string[];
}): Metadata {
  const currentPage = pageNumber(page);
  const canonical = currentPage > 1 ? `${path}${path.includes("?") ? "&" : "?"}page=${currentPage}` : path;
  const pageTitle = currentPage > 1 ? `${title} - Page ${currentPage}` : title;
  return {
    title: pageTitle,
    description,
    keywords: [...new Set([...keywords, ...SITE.keywords.slice(0, 4)])],
    alternates: { canonical },
    openGraph: { title: pageTitle, description, type: "website", url: canonical, siteName: SITE.name },
    twitter: { card: "summary_large_image", title: pageTitle, description },
    robots: index
      ? { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-video-preview": -1, "max-snippet": -1 } }
      : { index: false, follow: true },
  };
}
