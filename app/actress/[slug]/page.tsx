import { CatalogPage } from "@/components/catalog";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { getActressBySlug, listVideos } from "@/lib/catalog/repository";
import { actresses, pageNumber } from "@/lib/videos";
import { catalogMetadata, configuredSiteOrigin } from "@/lib/seo";
import { notFound } from "next/navigation";
import { catalogFilterPath, filterQueryOptions, hasCatalogFilters, parseCatalogFilters, type CatalogFilterParams } from "@/lib/catalog/filters";
import { actressSeo } from "@/lib/seo-templates";
import { EntityContext } from "@/components/entity-context";
import { actressContext } from "@/lib/entity-context";
import { serializeJsonLd } from "@/lib/site";
import { collectionSchema } from "@/lib/structured-data";

export function generateStaticParams() { return actresses.map((actress) => ({ slug: actress.slug })); }

export async function generateMetadata({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<CatalogFilterParams> }) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const actress = await getActressBySlug(slug);
  if (!actress) return {};
  const filters = parseCatalogFilters(query);
  return catalogMetadata({ ...actressSeo(actress.name, actress.count), path: `/actress/${slug}`, page: query.page, index: actress.count >= 1 && !hasCatalogFilters(filters) });
}

export default async function ActressPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<CatalogFilterParams> }) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const actress = await getActressBySlug(slug);
  if (!actress) notFound();
  const filters = parseCatalogFilters(query);
  const [result, origin] = await Promise.all([
    listVideos({ actressSlug: slug, ...filterQueryOptions(filters), page: pageNumber(query.page), pageSize: 24 }),
    configuredSiteOrigin(),
  ]);
  const base = `/actress/${slug}`;
  const seo = actressSeo(actress.name, actress.count);
  const context = actressContext(actress.name, result.items);
  const schema = collectionSchema({ origin, path: base, kind: "actress", name: actress.name, description: seo.description, items: result.items, breadcrumbLabel: "Actresses" });
  return <><SiteHeader /><CatalogPage eyebrow="Actress" title={actress.name} description={seo.description} items={result.items} total={result.total} page={result.page} pageSize={result.pageSize} prePaginated basePath={catalogFilterPath(base, filters)} filters={{ basePath: base, values: filters }} beforeGrid={<EntityContext value={context} />} /><SiteFooter /><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }} /></>;
}
