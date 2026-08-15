import { notFound } from "next/navigation";
import { CatalogPage } from "@/components/catalog";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { ADULT_CATEGORY_MINIMUM_VIDEOS, adultCategoryBySlugOrName, adultCategoryMatchTerms } from "@/lib/adult-taxonomy";
import { catalogFilterPath, filterQueryOptions, hasCatalogFilters, parseCatalogFilters, type CatalogFilterParams } from "@/lib/catalog/filters";
import { listVideos } from "@/lib/catalog/repository";
import { catalogMetadata, configuredSiteOrigin } from "@/lib/seo";
import { serializeJsonLd } from "@/lib/site";
import { collectionSchema } from "@/lib/structured-data";
import { pageNumber } from "@/lib/videos";
import { AdultCategoryStrip } from "@/components/adult-category-strip";

export const revalidate = 21_600;

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<CatalogFilterParams> };

export async function generateMetadata({ params, searchParams }: Props) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const category = adultCategoryBySlugOrName(slug);
  if (!category) return {};
  const filters = parseCatalogFilters(query);
  const result = await listVideos({ catalog: "porn", tagSlugs: adultCategoryMatchTerms(category), page: 1, pageSize: 1 });
  return catalogMetadata({
    title: `${category.name} - Popular Adult Videos`,
    description: category.description,
    path: `/porn-category/${category.slug}`,
    page: query.page,
    // Only the first page of a category is worth indexing; the rest stay crawl-only.
    index: pageNumber(query.page) === 1 && result.total >= ADULT_CATEGORY_MINIMUM_VIDEOS && !hasCatalogFilters(filters),
    keywords: [category.name.toLowerCase(), ...category.aliases.slice(0, 5).map((alias) => `${alias} videos`)],
  });
}

export default async function PornCategoryPage({ params, searchParams }: Props) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const category = adultCategoryBySlugOrName(slug);
  if (!category) notFound();
  const filters = parseCatalogFilters(query);
  const page = pageNumber(query.page);
  const base = `/porn-category/${category.slug}`;
  const result = await listVideos({ catalog: "porn", tagSlugs: adultCategoryMatchTerms(category), ...filterQueryOptions(filters), order: filters.order ?? "latest", page, pageSize: 25 });
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));
  if (page > pages) notFound();
  const origin = configuredSiteOrigin();
  const schema = collectionSchema({ origin, path: base, kind: "tag", name: category.name, description: category.description, items: result.items, breadcrumbLabel: "Porn categories" });
  return (
    <>
      <SiteHeader />
      <CatalogPage
        eyebrow="Porn category"
        title={category.name}
        description={category.description}
        items={result.items}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        prePaginated
        basePath={catalogFilterPath(base, filters)}
        filters={{ basePath: base, values: filters, hideType: true, hideYear: true }}
        beforeGrid={<AdultCategoryStrip activeSlug={category.slug} />}
      />
      <SiteFooter />
      {result.total >= ADULT_CATEGORY_MINIMUM_VIDEOS && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }} />}
    </>
  );
}
