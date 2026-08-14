import { CatalogPage } from "@/components/catalog";
import { PopularNow } from "@/components/home/popular-now";
import { HomeDiscovery } from "@/components/home/home-discovery";
import { Sidebar, SiteFooter, SiteHeader } from "@/components/site-chrome";
import { AdSlot } from "@/components/ads/ad-slot";
import { getPopularVideos, listVideos } from "@/lib/catalog/repository";
import { pageNumber } from "@/lib/videos";
import { catalogMetadata } from "@/lib/seo";
import { catalogFilterPath, filterQueryOptions, hasCatalogFilters, parseCatalogFilters, type CatalogFilterParams } from "@/lib/catalog/filters";
import { homeSeo } from "@/lib/seo-templates";
import { getLocalPornhubHomePreview } from "@/lib/pornhub-local-preview";

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
  const latestYear = new Date().getUTCFullYear();
  const [result, popular, preview] = await Promise.all([
    showPopularNow
      ? listVideos({ catalog: "celebrity", sort: "latest", order: "latest", year: latestYear, page: 1, pageSize: 25 })
      : listVideos({ catalog: "celebrity", sort: "latest", ...filterQueryOptions(filters), page, pageSize: 25 }),
    showPopularNow ? getPopularVideos(10) : Promise.resolve([]),
    showPopularNow ? getLocalPornhubHomePreview() : Promise.resolve(null),
  ]);
  if (showPopularNow) {
    return (
      <>
        <SiteHeader />
        <main className="site-container content-layout home-content-layout">
          <section className="catalog-content">
            <h1 className="sr-only">Celebrity scenes and popular adult videos</h1>
            <PopularNow videos={popular} />
            <HomeDiscovery latest={result.items} preview={preview!} />
            <div className="content-end-ad home-content-end-ad"><AdSlot placement="catalog-footer" /></div>
          </section>
          <Sidebar />
        </main>
        <SiteFooter />
      </>
    );
  }
  return (
    <>
      <SiteHeader />
      <CatalogPage
        eyebrow="Celebrity videos"
        title="Latest celebrity scenes"
        description="Discover new scenes from movies and television."
        items={result.items}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        prePaginated
        basePath={catalogFilterPath("/", filters)}
        filters={{ basePath: "/", values: filters }}
      />
      <SiteFooter />
    </>
  );
}
