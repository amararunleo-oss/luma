import type { MetadataRoute } from "next";
import { configuredSiteOrigin } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  const origin = configuredSiteOrigin();
  return {
    rules: [
      { userAgent: ["Googlebot", "Bingbot"], allow: "/", disallow: ["/api/", "/admin/", "/search"] },
      {
        userAgent: [
          "GPTBot",
          "CCBot",
          "ClaudeBot",
          "anthropic-ai",
          "Bytespider",
          "Amazonbot",
          "Applebot-Extended",
          "Google-Extended",
          "meta-externalagent",
          "PetalBot",
          "AhrefsBot",
          "SemrushBot",
          "MJ12bot",
          "DotBot",
        ],
        disallow: "/",
      },
      { userAgent: "*", allow: "/", disallow: ["/api/", "/admin/", "/search"] },
    ],
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
