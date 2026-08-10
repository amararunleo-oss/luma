import type { MetadataRoute } from "next";
import { requestOrigin } from "@/lib/seo";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const origin = await requestOrigin();
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/search"] },
    sitemap: `${origin}/sitemap.xml`,
  };
}
