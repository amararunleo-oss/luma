import { CatalogPage } from "@/components/catalog";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { getTaxonomy, listVideos } from "@/lib/catalog/repository";
import { pageNumber, tags } from "@/lib/videos";
import { catalogMetadata, requestOrigin } from "@/lib/seo";
import { notFound } from "next/navigation";
import { catalogFilterPath, filterQueryOptions, hasCatalogFilters, parseCatalogFilters, type CatalogFilterParams } from "@/lib/catalog/filters";
import { tagSeo } from "@/lib/seo-templates";
import { EntityContext } from "@/components/entity-context";
import { tagContext } from "@/lib/entity-context";
import { serializeJsonLd } from "@/lib/site";
import { collectionSchema } from "@/lib/structured-data";

export function generateStaticParams() { return tags.map((tag) => ({ slug: tag.slug })); }

export async function generateMetadata({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<CatalogFilterParams> }) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const tag = (await getTaxonomy()).tags.find((item) => item.slug === slug);
  if (!tag) return {};
  const filters = parseCatalogFilters(query);
  return catalogMetadata({ ...tagSeo(tag.name, tag.count), path: `/tag/${slug}`, page: query.page, index: tag.count >= 1 && !hasCatalogFilters(filters) });
}

export default async function TagPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<CatalogFilterParams> }) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const tag = (await getTaxonomy()).tags.find((item) => item.slug === slug);
  if (!tag) notFound();
  const filters = parseCatalogFilters(query);
  const [result, origin] = await Promise.all([
    listVideos({ tagSlug: slug, ...filterQueryOptions(filters), page: pageNumber(query.page), pageSize: 24 }),
    requestOrigin(),
  ]);
  const base = `/tag/${slug}`;
  const seo = tagSeo(tag.name, tag.count);
  const context = tagContext(tag.name, result.items);
  const schema = collectionSchema({ origin, path: base, kind: "tag", name: `${tag.name} scenes`, description: seo.description, items: result.items, breadcrumbLabel: "Tags" });
  return <><SiteHeader /><CatalogPage eyebrow="Tag" title={tag.name} description={seo.description} items={result.items} total={result.total} page={result.page} pageSize={result.pageSize} prePaginated basePath={catalogFilterPath(base, filters)} filters={{ basePath: base, values: filters }} beforeGrid={<EntityContext value={context} />} /><SiteFooter /><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }} /></>;
}
