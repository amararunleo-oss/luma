import { CatalogPage } from "@/components/catalog";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { listVideos } from "@/lib/catalog/repository";
import { pageNumber, years } from "@/lib/videos";
import { catalogMetadata } from "@/lib/seo";
import { notFound } from "next/navigation";
import { catalogFilterPath, filterQueryOptions, hasCatalogFilters, parseCatalogFilters, type CatalogFilterParams } from "@/lib/catalog/filters";

export function generateStaticParams() { return years.map((year) => ({ year: String(year) })); }

export async function generateMetadata({ params, searchParams }: { params: Promise<{ year: string }>; searchParams: Promise<CatalogFilterParams> }) {
  const [{ year }, query] = await Promise.all([params, searchParams]);
  const filters = { ...parseCatalogFilters(query), year: undefined };
  return catalogMetadata({ title: `${year} Movie & TV Scenes | Luma`, description: `Browse movie and television scenes released in ${year}.`, path: `/year/${year}`, page: query.page, index: !hasCatalogFilters(filters) });
}

export default async function YearPage({ params, searchParams }: { params: Promise<{ year: string }>; searchParams: Promise<CatalogFilterParams> }) {
  const [{ year }, query] = await Promise.all([params, searchParams]);
  const parsed = Number(year);
  if (!Number.isInteger(parsed) || parsed < 1900 || parsed > new Date().getFullYear() + 2) notFound();
  const filters = { ...parseCatalogFilters(query), year: undefined };
  const result = await listVideos({ ...filterQueryOptions(filters), year: parsed, page: pageNumber(query.page), pageSize: 24 });
  if (result.total === 0 && !hasCatalogFilters(filters)) notFound();
  const base = `/year/${year}`;
  return <><SiteHeader /><CatalogPage eyebrow="Year" title={year} description={`Movie and television scenes released in ${year}.`} items={result.items} total={result.total} page={result.page} pageSize={result.pageSize} prePaginated basePath={catalogFilterPath(base, filters)} filters={{ basePath: base, values: filters, hideYear: true }} /><SiteFooter /></>;
}
