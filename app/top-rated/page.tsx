import { CatalogPage } from "@/components/catalog";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { listVideos } from "@/lib/catalog/repository";
import { pageNumber } from "@/lib/videos";
import { catalogMetadata } from "@/lib/seo";
import { catalogFilterPath, filterQueryOptions, hasCatalogFilters, parseCatalogFilters, type CatalogFilterParams } from "@/lib/catalog/filters";

export async function generateMetadata({ searchParams }: { searchParams: Promise<CatalogFilterParams> }) {
  const query = await searchParams;
  const filters = parseCatalogFilters(query);
  return catalogMetadata({ title: "Top Rated Celebrity Nude Scenes | Luma", description: "Explore highly rated celebrity scenes from movies and television.", path: "/top-rated", page: query.page, index: !hasCatalogFilters(filters) });
}

export default async function TopRated({ searchParams }: { searchParams: Promise<CatalogFilterParams> }) {
  const query = await searchParams;
  const filters = parseCatalogFilters(query);
  const result = await listVideos({ sort: "top-rated", ...filterQueryOptions(filters), page: pageNumber(query.page), pageSize: 24 });
  return <><SiteHeader /><CatalogPage eyebrow="Top picks" title="Top Rated Videos" description="Highly rated movie and television scenes." items={result.items} total={result.total} page={result.page} pageSize={result.pageSize} prePaginated basePath={catalogFilterPath("/top-rated", filters)} filters={{ basePath: "/top-rated", values: filters }} /><SiteFooter /></>;
}
