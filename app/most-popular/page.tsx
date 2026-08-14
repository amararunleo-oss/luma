import { CatalogPage } from "@/components/catalog";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { listVideos } from "@/lib/catalog/repository";
import { pageNumber } from "@/lib/videos";
import { catalogMetadata } from "@/lib/seo";
import { catalogFilterPath, filterQueryOptions, hasCatalogFilters, parseCatalogFilters, type CatalogFilterParams } from "@/lib/catalog/filters";
import { listingSeo } from "@/lib/seo-templates";

export async function generateMetadata({ searchParams }: { searchParams: Promise<CatalogFilterParams> }) {
  const query = await searchParams;
  const filters = parseCatalogFilters(query);
  return catalogMetadata({ ...listingSeo("popular"), path: "/most-popular", page: query.page, index: !hasCatalogFilters(filters) });
}

export default async function Popular({ searchParams }: { searchParams: Promise<CatalogFilterParams> }) {
  const query = await searchParams;
  const filters = parseCatalogFilters(query);
  const result = await listVideos({ catalog: "celebrity", sort: "popular", ...filterQueryOptions(filters), page: pageNumber(query.page), pageSize: 25 });
  return <><SiteHeader /><CatalogPage eyebrow="Trending" title="Popular Videos" description="The most watched movie and television scenes." items={result.items} total={result.total} page={result.page} pageSize={result.pageSize} prePaginated basePath={catalogFilterPath("/most-popular", filters)} filters={{ basePath: "/most-popular", values: filters }} /><SiteFooter /></>;
}
