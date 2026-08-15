import { CatalogPage } from "@/components/catalog";
import { SearchDiscovery } from "@/components/search/search-discovery";
import { SearchScopeTabs } from "@/components/search/search-scope-tabs";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { listVideos, searchCatalog } from "@/lib/catalog/repository";
import { catalogFilterPath, filterQueryOptions, parseCatalogFilters, type CatalogFilterParams } from "@/lib/catalog/filters";
import { parseSearchScope, searchScope } from "@/lib/search-scope";
import { pageNumber } from "@/lib/videos";
import { SITE } from "@/lib/site";

type SearchParams = CatalogFilterParams & { q?: string; scope?: string };

export const metadata = { title: `Advanced Search | ${SITE.name}`, alternates: { canonical: "/search" }, robots: { index: false, follow: true } };

function scopePath(term: string, scope: string) {
  const params = new URLSearchParams();
  if (term) params.set("q", term);
  if (scope !== "all") params.set("scope", scope);
  return params.size ? `/search?${params.toString()}` : "/search";
}

export default async function Search({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const query = await searchParams;
  const term = (query.q ?? "").trim();
  const scope = parseSearchScope(query.scope);
  const definition = searchScope(scope);
  const filters = parseCatalogFilters(query);
  const page = pageNumber(query.page);

  // Scope decides the catalog and content type, the filter bar refines within it.
  const [result, discovery] = term
    ? await Promise.all([
      listVideos({ search: term, ...definition.query, ...filterQueryOptions(filters), page, pageSize: 25 }),
      searchCatalog(term, 8, scope),
    ])
    : [{ items: [], total: 0, page: 1, pageSize: 25 }, await searchCatalog("", 8, scope)];

  const basePath = catalogFilterPath(scopePath(term, scope), filters);
  const resultLabel = term
    ? `${result.total.toLocaleString("en-US")} ${result.total === 1 ? "result" : "results"} for “${term}”`
    : "Search";

  return (
    <>
      <SiteHeader />
      <CatalogPage
        eyebrow="Advanced search"
        title={term ? `Results for “${term}”` : "Advanced search"}
        description={term
          ? `${resultLabel} in ${definition.label.toLowerCase()}. Narrow further with the filters below.`
          : "Search across celebrity videos, movies, TV shows and adult categories, then narrow by type, year, length, rating and order."}
        items={result.items}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        prePaginated
        basePath={basePath}
        beforeHeading={<SearchScopeTabs term={term} scope={scope} />}
        filters={{
          basePath: scopePath(term, scope),
          values: filters,
          // Scope already pins the type and hides adult years, so those controls would
          // only contradict it.
          hideType: Boolean(definition.query.type),
          hideYear: definition.query.catalog === "porn",
        }}
        beforeGrid={<SearchDiscovery results={discovery} />}
      />
      <SiteFooter />
    </>
  );
}
