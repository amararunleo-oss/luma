import type { MetadataRoute } from "next";
import { configuredSiteOrigin } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  const origin = configuredSiteOrigin();
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/admin/", "/search"] },
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
