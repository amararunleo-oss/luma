import { CatalogPage } from "@/components/catalog";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { ADULT_CATEGORY_MINIMUM_VIDEOS } from "@/lib/adult-taxonomy";
import { catalogFilterPath, filterQueryOptions, hasCatalogFilters, parseCatalogFilters, type CatalogFilterParams } from "@/lib/catalog/filters";
import { listVideos } from "@/lib/catalog/repository";
import { catalogMetadata } from "@/lib/seo";
import { pageNumber } from "@/lib/videos";
import { AdultCategoryStrip } from "@/components/adult-category-strip";
import { notFound } from "next/navigation";

const title = "Adult Porn Videos by Category";
const description = "Browse adult porn videos across popular categories, with clear titles, durations, related tags and professional pagination.";

export async function generateMetadata({ searchParams }: { searchParams: Promise<CatalogFilterParams> }) {
  const query = await searchParams;
  const filters = parseCatalogFilters(query);
  const result = await listVideos({ catalog: "porn", page: 1, pageSize: 1 });
  return catalogMetadata({
    title,
    description,
    path: "/porn-videos",
    page: query.page,
    index: result.total >= ADULT_CATEGORY_MINIMUM_VIDEOS && !hasCatalogFilters(filters),
    keywords: ["adult porn videos", "popular sex videos", "adult video categories"],
  });
}

export default async function PornVideosPage({ searchParams }: { searchParams: Promise<CatalogFilterParams> }) {
  const query = await searchParams;
  const filters = parseCatalogFilters(query);
  const page = pageNumber(query.page);
  const result = await listVideos({ catalog: "porn", ...filterQueryOptions(filters), order: filters.order ?? "latest", page, pageSize: 25 });
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));
  if (page > pages) notFound();
  return (
    <>
      <SiteHeader />
      <CatalogPage
        eyebrow="Porn videos"
        title={title}
        description={description}
        items={result.items}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        prePaginated
        basePath={catalogFilterPath("/porn-videos", filters)}
        filters={{ basePath: "/porn-videos", values: filters, hideType: true, hideYear: true }}
        beforeGrid={<AdultCategoryStrip />}
      />
      <SiteFooter />
    </>
  );
}
