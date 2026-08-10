import { CatalogPage } from "@/components/catalog";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { getActressBySlug, listVideos } from "@/lib/catalog/repository";
import { actresses, pageNumber } from "@/lib/videos";
import { catalogMetadata } from "@/lib/seo";
import { notFound } from "next/navigation";
import { catalogFilterPath, filterQueryOptions, hasCatalogFilters, parseCatalogFilters, type CatalogFilterParams } from "@/lib/catalog/filters";

export function generateStaticParams() { return actresses.map((actress) => ({ slug: actress.slug })); }

export async function generateMetadata({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<CatalogFilterParams> }) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const actress = await getActressBySlug(slug);
  if (!actress) return {};
  const description = `Movie and television scenes featuring ${actress.name}.`;
  const filters = parseCatalogFilters(query);
  return catalogMetadata({ title: `${actress.name} Nude Scenes & Videos | Luma`, description, path: `/actress/${slug}`, page: query.page, index: actress.count >= 2 && !hasCatalogFilters(filters) });
}

export default async function ActressPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<CatalogFilterParams> }) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const actress = await getActressBySlug(slug);
  if (!actress) notFound();
  const filters = parseCatalogFilters(query);
  const result = await listVideos({ actressSlug: slug, ...filterQueryOptions(filters), page: pageNumber(query.page), pageSize: 24 });
  const base = `/actress/${slug}`;
  return <><SiteHeader /><CatalogPage eyebrow="Actress" title={actress.name} description={`Movie and television scenes featuring ${actress.name}.`} items={result.items} total={result.total} page={result.page} pageSize={result.pageSize} prePaginated basePath={catalogFilterPath(base, filters)} filters={{ basePath: base, values: filters }} /><SiteFooter /></>;
}
