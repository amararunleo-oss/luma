import { CatalogPage } from "@/components/catalog";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { getWorkBySlug, listVideos } from "@/lib/catalog/repository";
import { pageNumber } from "@/lib/videos";
import { catalogMetadata, requestOrigin } from "@/lib/seo";
import { notFound } from "next/navigation";
import { catalogFilterPath, filterQueryOptions, hasCatalogFilters, parseCatalogFilters, type CatalogFilterParams } from "@/lib/catalog/filters";
import { workSeo } from "@/lib/seo-templates";
import { EntityContext } from "@/components/entity-context";
import { workContext } from "@/lib/entity-context";
import { serializeJsonLd } from "@/lib/site";
import { collectionSchema } from "@/lib/structured-data";

export async function generateMetadata({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<CatalogFilterParams> }) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const work = await getWorkBySlug("TV Show", slug);
  if (!work) return {};
  const filters = { ...parseCatalogFilters(query), type: undefined };
  return catalogMetadata({ ...workSeo("tv", work.name, work.count), path: `/tv-show/title/${slug}`, page: query.page, index: work.count >= 1 && !hasCatalogFilters(filters) });
}

export default async function TvTitlePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<CatalogFilterParams> }) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const filters = { ...parseCatalogFilters(query), type: undefined };
  const [work, result, origin] = await Promise.all([getWorkBySlug("TV Show", slug), listVideos({ ...filterQueryOptions(filters), type: "TV Show", workSlug: slug, page: pageNumber(query.page), pageSize: 24 }), requestOrigin()]);
  if (!work) notFound();
  const base = `/tv-show/title/${slug}`;
  const seo = workSeo("tv", work.name, work.count);
  const context = workContext("TV Show", work.name, result.items);
  const schema = collectionSchema({ origin, path: base, kind: "tv", name: work.name, description: seo.description, items: result.items, breadcrumbLabel: "TV Shows" });
  return <><SiteHeader /><CatalogPage eyebrow="TV Show" title={work.name} description={seo.description} items={result.items} total={result.total} page={result.page} pageSize={result.pageSize} prePaginated basePath={catalogFilterPath(base, filters)} filters={{ basePath: base, values: filters, hideType: true }} beforeGrid={<EntityContext value={context} />} /><SiteFooter /><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }} /></>;
}
