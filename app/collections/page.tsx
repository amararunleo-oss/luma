import type { Metadata } from "next";
import { CollectionLinks } from "@/components/collections/collection-links";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { absoluteUrl, configuredSiteOrigin } from "@/lib/seo";
import { COLLECTIONS } from "@/lib/collections";
import { serializeJsonLd, SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "Celebrity Video Collections",
  description: "Explore curated celebrity movie and television scene collections by popularity, rating, format and performer.",
  alternates: { canonical: "/collections" },
  robots: { index: true, follow: true },
};

export default function CollectionsPage() {
  const origin = configuredSiteOrigin();
  const schema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Celebrity Video Collections",
    description: metadata.description,
    url: absoluteUrl(origin, "/collections"),
    isPartOf: { "@id": `${origin}/#website` },
    mainEntity: {
      "@type": "ItemList",
      itemListElement: COLLECTIONS.map((collection, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: collection.title,
        url: absoluteUrl(origin, `/collections/${collection.slug}`),
      })),
    },
  };
  return (
    <>
      <SiteHeader />
      <main className="site-container collections-page">
        <header className="page-heading">
          <p>Explore {SITE.name}</p>
          <h1 id="collections-title">Celebrity video collections</h1>
          <div><span>Curated paths through popular, highly rated, new and performer-focused scenes.</span></div>
        </header>
        <CollectionLinks />
      </main>
      <SiteFooter />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }} />
    </>
  );
}
