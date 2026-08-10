import { CatalogPage } from "@/components/catalog";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { getWorkBySlug, listVideos } from "@/lib/catalog/repository";
import { pageNumber } from "@/lib/videos";
import { catalogMetadata } from "@/lib/seo";
import { notFound } from "next/navigation";
import { catalogFilterPath, filterQueryOptions, hasCatalogFilters, parseCatalogFilters, type CatalogFilterParams } from "@/lib/catalog/filters";

export async function generateMetadata({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<CatalogFilterParams> }) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const work = await getWorkBySlug("Movie", slug);
  if (!work) return {};
  const filters = { ...parseCatalogFilters(query), type: undefined };
  return catalogMetadata({ title: `${work.name} Nude Scenes & Celebrity Clips | Luma`, description: `Celebrity scenes from ${work.name}.`, path: `/movie/title/${slug}`, page: query.page, index: work.count >= 2 && !hasCatalogFilters(filters) });
}

export default async function MovieTitlePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<CatalogFilterParams> }) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const filters = { ...parseCatalogFilters(query), type: undefined };
  const [work, result] = await Promise.all([getWorkBySlug("Movie", slug), listVideos({ ...filterQueryOptions(filters), type: "Movie", workSlug: slug, page: pageNumber(query.page), pageSize: 24 })]);
  if (!work) notFound();
  const base = `/movie/title/${slug}`;
  return <><SiteHeader /><CatalogPage eyebrow="Movie" title={work.name} description={`Celebrity scenes from ${work.name}.`} items={result.items} total={result.total} page={result.page} pageSize={result.pageSize} prePaginated basePath={catalogFilterPath(base, filters)} filters={{ basePath: base, values: filters, hideType: true }} /><SiteFooter /></>;
}
