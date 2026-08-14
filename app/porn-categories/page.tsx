import type { Metadata } from "next";
import { cache } from "react";
import { ArrowUpRight } from "lucide-react";
import Link from "@/components/navigation/revenue-link";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { ADULT_CATEGORIES } from "@/lib/adult-taxonomy";
import { getAdultCategoryCounts } from "@/lib/catalog/repository";
import { absoluteUrl, configuredSiteOrigin } from "@/lib/seo";
import { serializeJsonLd } from "@/lib/site";

export const revalidate = 21_600;

const title = "Porn Video Categories - Adult Videos A-Z";
const description = "Browse adult video categories including amateur, hentai, MILF, lesbian, Japanese, anal, doggy style, oral, romantic and roleplay videos.";

const activeCategories = cache(async function activeCategories() {
  const counts = await getAdultCategoryCounts();
  const results = ADULT_CATEGORIES.map((category) => ({ category, count: counts[category.slug] ?? 0 }));
  return results.filter((item) => item.count > 0);
});

export async function generateMetadata(): Promise<Metadata> {
  const active = await activeCategories();
  return {
    title,
    description,
    alternates: { canonical: "/porn-categories" },
    robots: active.length
      ? { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-video-preview": -1, "max-snippet": -1 } }
      : { index: false, follow: true },
  };
}

export default async function PornCategoriesPage() {
  const active = await activeCategories();
  const origin = configuredSiteOrigin();
  const schema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Porn Video Categories",
    description,
    url: absoluteUrl(origin, "/porn-categories"),
    isFamilyFriendly: false,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: active.length,
      itemListElement: active.map(({ category }, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: category.name,
        url: absoluteUrl(origin, `/porn-category/${category.slug}`),
      })),
    },
  };
  return (
    <>
      <SiteHeader />
      <main className="site-container adult-categories-page">
        <header className="page-heading">
          <p>Adult library</p>
          <h1>Porn video categories</h1>
          <div><span>Explore the complete adult video library by category, style and theme.</span></div>
        </header>
        {active.length ? (
          <div className="adult-category-grid">
            {active.map(({ category }) => (
              <Link href={`/porn-category/${category.slug}`} key={category.slug}>
                <span>{category.shortName}</span>
                <strong>{category.name}</strong>
                <p>{category.description}</p>
                <ArrowUpRight size={15} aria-hidden="true" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-state"><h2>Adult categories are being prepared</h2><Link href="/">Browse celebrity videos</Link></div>
        )}
      </main>
      <SiteFooter />
      {active.length > 0 && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }} />}
    </>
  );
}
