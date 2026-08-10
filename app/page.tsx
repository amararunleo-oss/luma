import { CatalogPage } from "@/components/catalog";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { listVideos } from "@/lib/catalog/repository";
import { pageNumber } from "@/lib/videos";
import { catalogMetadata } from "@/lib/seo";
import { catalogFilterPath, filterQueryOptions, hasCatalogFilters, parseCatalogFilters, type CatalogFilterParams } from "@/lib/catalog/filters";

export async function generateMetadata({ searchParams }: { searchParams: Promise<CatalogFilterParams> }) {
  const query = await searchParams;
  const filters = parseCatalogFilters(query);
  return catalogMetadata({
    title: "Celebrity Nude Scenes from Movies & TV | Luma",
    description: "Watch newly added celebrity nude scenes, intimate movie moments and television clips organized by actress, film and series.",
    path: "/",
    page: query.page,
    index: !hasCatalogFilters(filters),
  });
}

export default async function Home({ searchParams }: { searchParams: Promise<CatalogFilterParams> }) {
  const query = await searchParams;
  const filters = parseCatalogFilters(query);
  const result = await listVideos({ sort: "latest", ...filterQueryOptions(filters), page: pageNumber(query.page), pageSize: 24 });
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
      />
      <SiteFooter />
    </>
  );
}
