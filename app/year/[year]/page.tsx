import { CatalogPage } from "@/components/catalog";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { listVideos } from "@/lib/catalog/repository";
import { pageNumber, years } from "@/lib/videos";
import { catalogMetadata, configuredSiteOrigin } from "@/lib/seo";
import { notFound } from "next/navigation";
import { catalogFilterPath, filterQueryOptions, hasCatalogFilters, parseCatalogFilters, type CatalogFilterParams } from "@/lib/catalog/filters";
import { yearSeo } from "@/lib/seo-templates";
import { EntityContext } from "@/components/entity-context";
import { yearContext } from "@/lib/entity-context";
import { serializeJsonLd } from "@/lib/site";
import { collectionSchema } from "@/lib/structured-data";

export function generateStaticParams() { return years.map((year) => ({ year: String(year) })); }

export async function generateMetadata({ params, searchParams }: { params: Promise<{ year: string }>; searchParams: Promise<CatalogFilterParams> }) {
  const [{ year }, query] = await Promise.all([params, searchParams]);
  const filters = { ...parseCatalogFilters(query), year: undefined };
  return catalogMetadata({ ...yearSeo(year), path: `/year/${year}`, page: query.page, index: !hasCatalogFilters(filters) });
}

export default async function YearPage({ params, searchParams }: { params: Promise<{ year: string }>; searchParams: Promise<CatalogFilterParams> }) {
  const [{ year }, query] = await Promise.all([params, searchParams]);
  const parsed = Number(year);
  if (!Number.isInteger(parsed) || parsed < 1900 || parsed > new Date().getFullYear() + 2) notFound();
  const filters = { ...parseCatalogFilters(query), year: undefined };
  const [result, origin] = await Promise.all([
    listVideos({ catalog: "celebrity", ...filterQueryOptions(filters), year: parsed, page: pageNumber(query.page), pageSize: 25 }),
    configuredSiteOrigin(),
  ]);
  if (result.total === 0 && !hasCatalogFilters(filters)) notFound();
  const base = `/year/${year}`;
  const seo = yearSeo(year);
  const context = yearContext(year, result.items);
  const schema = collectionSchema({ origin, path: base, kind: "year", name: `${year} celebrity scenes`, description: seo.description, items: result.items, breadcrumbLabel: "Years" });
  return <><SiteHeader /><CatalogPage eyebrow="Year" title={year} description={seo.description} items={result.items} total={result.total} page={result.page} pageSize={result.pageSize} prePaginated basePath={catalogFilterPath(base, filters)} filters={{ basePath: base, values: filters, hideYear: true }} beforeGrid={<EntityContext value={context} />} /><SiteFooter /><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }} /></>;
}
