import { CatalogPage } from "@/components/catalog";
import { SearchDiscovery } from "@/components/search/search-discovery";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { listVideos, searchCatalog } from "@/lib/catalog/repository";
import { pageNumber } from "@/lib/videos";
import { SITE } from "@/lib/site";

export const metadata = { title: `Search Celebrity Scenes | ${SITE.name}`, alternates: { canonical: "/search" }, robots: { index: false, follow: true } };

export default async function Search({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const query = await searchParams;
  const term = (query.q ?? "").trim().toLowerCase();
  const [result, discovery] = term
    ? await Promise.all([listVideos({ search: term, page: pageNumber(query.page), pageSize: 25 }), searchCatalog(term, 8)])
    : [{ items: [], total: 0, page: 1, pageSize: 25 }, await searchCatalog("")];
  const basePath = term ? `/search?q=${encodeURIComponent(query.q ?? "")}` : "/search";
  return (
    <>
      <SiteHeader />
      <CatalogPage
        eyebrow="Search"
        title={term ? `Results for “${query.q}”` : "Search"}
        description={term ? "Matches across videos, celebrities, movies, TV shows and categories." : "Search by video, celebrity, title or adult category."}
        items={result.items}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        prePaginated
        basePath={basePath}
        beforeGrid={<SearchDiscovery results={discovery} />}
      />
      <SiteFooter />
    </>
  );
}
