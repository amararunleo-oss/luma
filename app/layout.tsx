import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Suspense } from "react";
import { NavigationProgress } from "@/components/navigation-progress";
import { GlobalAdFormats } from "@/components/ads/global-ad-formats";
import { absoluteUrl, requestOrigin } from "@/lib/seo";
import { serializeJsonLd, SITE } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light",
  themeColor: "#fbfaf8",
};

export async function generateMetadata(): Promise<Metadata> {
  const origin = await requestOrigin();
  const base = new URL(origin);
  const googleVerification = process.env.GOOGLE_SITE_VERIFICATION?.trim();
  const bingVerification = process.env.BING_SITE_VERIFICATION?.trim();
  const yandexVerification = process.env.YANDEX_SITE_VERIFICATION?.trim();
  return {
    metadataBase: base,
    applicationName: SITE.name,
    authors: [{ name: SITE.name, url: origin }],
    creator: SITE.name,
    publisher: SITE.name,
    title: SITE.title,
    description: SITE.description,
    keywords: [...SITE.keywords],
    category: "entertainment",
    referrer: "strict-origin-when-cross-origin",
    formatDetection: { email: false, address: false, telephone: false },
    manifest: "/manifest.webmanifest",
    verification: {
      ...(googleVerification ? { google: googleVerification } : {}),
      ...(yandexVerification ? { yandex: yandexVerification } : {}),
      ...(bingVerification ? { other: { "msvalidate.01": bingVerification } } : {}),
    },
    icons: {
      icon: [{ url: "/favicon.ico", sizes: "any" }, { url: "/favicon.svg", type: "image/svg+xml" }],
      shortcut: "/favicon.ico",
      apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    },
    appleWebApp: { capable: true, title: SITE.name, statusBarStyle: "default" },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-image-preview": "large", "max-video-preview": -1, "max-snippet": -1 },
    },
    openGraph: {
      title: SITE.title,
      description: SITE.description,
      type: "website",
      siteName: SITE.name,
      url: origin,
      images: [{ url: absoluteUrl(origin, "/og.png"), width: 1200, height: 630, alt: `${SITE.name} celebrity movie and television scenes` }],
    },
    twitter: { card: "summary_large_image", title: SITE.title, description: SITE.description, images: [absoluteUrl(origin, "/og.png")] },
    other: {
      rating: "adult",
      "6a97888e-site-verification": "2918b7b8c44da80738c0bfea7193b520",
    },
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const origin = await requestOrigin();
  const websiteSchema = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "Organization", "@id": `${origin}/#organization`, name: SITE.name, url: origin, logo: absoluteUrl(origin, "/favicon.svg") },
      {
        "@type": "WebSite",
        "@id": `${origin}/#website`,
        url: origin,
        name: SITE.name,
        description: SITE.description,
        publisher: { "@id": `${origin}/#organization` },
        potentialAction: { "@type": "SearchAction", target: `${origin}/search?q={search_term_string}`, "query-input": "required name=search_term_string" },
      },
    ],
  };
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <Suspense fallback={null}><NavigationProgress /></Suspense>
        <Suspense fallback={null}><GlobalAdFormats /></Suspense>
        {children}
        <Analytics />
        <SpeedInsights />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(websiteSchema) }} />
      </body>
    </html>
  );
}
