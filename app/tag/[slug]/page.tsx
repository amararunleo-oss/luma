import { CatalogPage } from "@/components/catalog";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { getTaxonomy, listVideos } from "@/lib/catalog/repository";
import { pageNumber, tags } from "@/lib/videos";
import { catalogMetadata } from "@/lib/seo";
import { notFound } from "next/navigation";
import { catalogFilterPath, filterQueryOptions, hasCatalogFilters, parseCatalogFilters, type CatalogFilterParams } from "@/lib/catalog/filters";

export function generateStaticParams() { return tags.map((tag) => ({ slug: tag.slug })); }

export async function generateMetadata({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<CatalogFilterParams> }) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const tag = (await getTaxonomy()).tags.find((item) => item.slug === slug);
  if (!tag) return {};
  const filters = parseCatalogFilters(query);
  return catalogMetadata({ title: `${tag.name} Videos | Luma`, description: `Browse scenes tagged ${tag.name}.`, path: `/tag/${slug}`, page: query.page, index: tag.count >= 3 && !hasCatalogFilters(filters) });
}

export default async function TagPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<CatalogFilterParams> }) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const tag = (await getTaxonomy()).tags.find((item) => item.slug === slug);
  if (!tag) notFound();
  const filters = parseCatalogFilters(query);
  const result = await listVideos({ tagSlug: slug, ...filterQueryOptions(filters), page: pageNumber(query.page), pageSize: 24 });
  const base = `/tag/${slug}`;
  return <><SiteHeader /><CatalogPage eyebrow="Tag" title={tag.name} description={`Videos tagged ${tag.name}.`} items={result.items} total={result.total} page={result.page} pageSize={result.pageSize} prePaginated basePath={catalogFilterPath(base, filters)} filters={{ basePath: base, values: filters }} /><SiteFooter /></>;
}
