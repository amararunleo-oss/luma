import { CatalogPage } from "@/components/catalog";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { getWorkBySlug, listVideos } from "@/lib/catalog/repository";
import { pageNumber } from "@/lib/videos";
import { catalogMetadata, configuredSiteOrigin } from "@/lib/seo";
import { notFound } from "next/navigation";
import { catalogFilterPath, filterQueryOptions, hasCatalogFilters, parseCatalogFilters, type CatalogFilterParams } from "@/lib/catalog/filters";
import { workSeo } from "@/lib/seo-templates";
import { EntityContext } from "@/components/entity-context";
import { workContext } from "@/lib/entity-context";
import { serializeJsonLd } from "@/lib/site";
import { collectionSchema } from "@/lib/structured-data";

export async function generateMetadata({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<CatalogFilterParams> }) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const work = await getWorkBySlug("Movie", slug);
  if (!work) return {};
  const filters = { ...parseCatalogFilters(query), type: undefined };
  return catalogMetadata({ ...workSeo("movie", work.name, work.count), path: `/movie/title/${slug}`, page: query.page, index: work.count >= 1 && !hasCatalogFilters(filters) });
}

export default async function MovieTitlePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<CatalogFilterParams> }) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const filters = { ...parseCatalogFilters(query), type: undefined };
  const [work, result, origin] = await Promise.all([getWorkBySlug("Movie", slug), listVideos({ ...filterQueryOptions(filters), type: "Movie", workSlug: slug, page: pageNumber(query.page), pageSize: 24 }), configuredSiteOrigin()]);
  if (!work) notFound();
  const base = `/movie/title/${slug}`;
  const seo = workSeo("movie", work.name, work.count);
  const context = workContext("Movie", work.name, result.items);
  const schema = collectionSchema({ origin, path: base, kind: "movie", name: work.name, description: seo.description, items: result.items, breadcrumbLabel: "Movies" });
  return <><SiteHeader /><CatalogPage eyebrow="Movie" title={work.name} description={seo.description} items={result.items} total={result.total} page={result.page} pageSize={result.pageSize} prePaginated basePath={catalogFilterPath(base, filters)} filters={{ basePath: base, values: filters, hideType: true }} beforeGrid={<EntityContext value={context} />} /><SiteFooter /><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }} /></>;
}
