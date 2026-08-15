import type { MetadataRoute } from "next";
import { configuredSiteOrigin } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  const origin = configuredSiteOrigin();
  return {
    rules: [
      // /search is crawlable on purpose. It sends noindex, follow, and blocking it
      // here instead would stop that header ever being read while the footer and 404
      // links still point at it, which is what surfaces "Blocked by robots.txt".
      { userAgent: ["Googlebot", "Bingbot"], allow: "/", disallow: ["/api/", "/admin/"] },
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
      { userAgent: "*", allow: "/", disallow: ["/api/", "/admin/"] },
    ],
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
