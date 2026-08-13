import { CatalogPage } from "@/components/catalog";
import { PopularNow } from "@/components/home/popular-now";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { getPopularVideos, listVideos } from "@/lib/catalog/repository";
import { pageNumber } from "@/lib/videos";
import { catalogMetadata } from "@/lib/seo";
import { catalogFilterPath, filterQueryOptions, hasCatalogFilters, parseCatalogFilters, type CatalogFilterParams } from "@/lib/catalog/filters";
import { homeSeo } from "@/lib/seo-templates";

export async function generateMetadata({ searchParams }: { searchParams: Promise<CatalogFilterParams> }) {
  const query = await searchParams;
  const filters = parseCatalogFilters(query);
  const seo = homeSeo();
  return catalogMetadata({
    ...seo,
    path: "/",
    page: query.page,
    index: !hasCatalogFilters(filters),
  });
}

export default async function Home({ searchParams }: { searchParams: Promise<CatalogFilterParams> }) {
  const query = await searchParams;
  const filters = parseCatalogFilters(query);
  const page = pageNumber(query.page);
  const showPopularNow = page === 1 && !hasCatalogFilters(filters);
  const [result, popular] = await Promise.all([
    listVideos({ sort: "latest", ...filterQueryOptions(filters), page, pageSize: 24 }),
    showPopularNow ? getPopularVideos(5) : Promise.resolve([]),
  ]);
  return (
    <>
      <SiteHeader />
      <CatalogPage
        eyebrow="New"
        title="Latest celebrity scenes"
        description="Discover new scenes from movies and television."
        items={result.items}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        prePaginated
        basePath={catalogFilterPath("/", filters)}
        filters={{ basePath: "/", values: filters }}
        beforeHeading={<PopularNow videos={popular} />}
      />
      <SiteFooter />
    </>
  );
}
