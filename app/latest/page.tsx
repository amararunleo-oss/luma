import { CatalogPage } from "@/components/catalog";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { listVideos } from "@/lib/catalog/repository";
import { catalogFilterPath, filterQueryOptions, hasCatalogFilters, parseCatalogFilters, type CatalogFilterParams } from "@/lib/catalog/filters";
import { catalogMetadata } from "@/lib/seo";
import { pageNumber } from "@/lib/videos";

export async function generateMetadata({ searchParams }: { searchParams: Promise<CatalogFilterParams> }) {
  const query = await searchParams;
  const filters = parseCatalogFilters(query);
  return catalogMetadata({
    title: "Latest Celebrity Nude & Sex Scenes",
    description: "Browse the latest celebrity nude, sex and intimate scenes from recent movies and television shows.",
    keywords: ["latest celebrity nude scenes", "new actress sex scenes", "recent movie nude scenes", "latest TV sex scenes"],
    path: "/latest",
    page: query.page,
    index: !hasCatalogFilters(filters),
  });
}

export default async function Latest({ searchParams }: { searchParams: Promise<CatalogFilterParams> }) {
  const query = await searchParams;
  const filters = parseCatalogFilters(query);
  const page = pageNumber(query.page);
  const result = await listVideos({ catalog: "celebrity", sort: "latest", ...filterQueryOptions(filters), page, pageSize: 25 });
  return (
    <>
      <SiteHeader />
      <CatalogPage
        eyebrow="Recently added"
        title="Latest celebrity scenes"
        description="New movie and television scenes, ordered from the latest releases."
        items={result.items}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        prePaginated
        basePath={catalogFilterPath("/latest", filters)}
        filters={{ basePath: "/latest", values: filters }}
      />
      <SiteFooter />
    </>
  );
}
