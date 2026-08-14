import { notFound } from "next/navigation";
import { CatalogPage } from "@/components/catalog";
import { CollectionLinks } from "@/components/collections/collection-links";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { collectionBySlug, COLLECTION_MINIMUM_VIDEOS, COLLECTIONS } from "@/lib/collections";
import { listVideos } from "@/lib/catalog/repository";
import { absoluteUrl, catalogMetadata, configuredSiteOrigin } from "@/lib/seo";
import { serializeJsonLd } from "@/lib/site";
import { pageNumber } from "@/lib/videos";

export const revalidate = 21_600;

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ page?: string }> };

export function generateStaticParams() {
  return COLLECTIONS.map((collection) => ({ slug: collection.slug }));
}

export async function generateMetadata({ params, searchParams }: Props) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const collection = collectionBySlug(slug);
  if (!collection) return {};
  const page = pageNumber(query.page);
  const result = await listVideos({ ...collection.query, page, pageSize: 25 });
  const validPage = page <= Math.max(1, Math.ceil(result.total / result.pageSize));
  return catalogMetadata({
    title: collection.title,
    description: collection.description,
    path: `/collections/${collection.slug}`,
    page: query.page,
    index: result.total >= COLLECTION_MINIMUM_VIDEOS && validPage,
    keywords: collection.keywords,
  });
}

export default async function CollectionPage({ params, searchParams }: Props) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const collection = collectionBySlug(slug);
  if (!collection) notFound();
  const page = pageNumber(query.page);
  const result = await listVideos({ ...collection.query, page, pageSize: 25 });
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));
  if (page > pages) notFound();
  const origin = configuredSiteOrigin();
  const schema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: collection.title,
    description: collection.description,
    url: absoluteUrl(origin, `/collections/${collection.slug}${page > 1 ? `?page=${page}` : ""}`),
    isPartOf: { "@id": `${origin}/#website` },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: result.total,
      itemListElement: result.items.map((video, index) => ({
        "@type": "ListItem",
        position: (page - 1) * result.pageSize + index + 1,
        name: video.sceneTitle,
        url: absoluteUrl(origin, `/watch/${video.slug}`),
      })),
    },
  };
  return (
    <>
      <SiteHeader />
      <CatalogPage
        eyebrow={collection.eyebrow}
        title={collection.title}
        description={collection.description}
        items={result.items}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        prePaginated
        basePath={`/collections/${collection.slug}`}
        beforeGrid={page === 1 ? <CollectionLinks compact /> : undefined}
      />
      <SiteFooter />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }} />
    </>
  );
}
