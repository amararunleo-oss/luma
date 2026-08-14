import { notFound } from "next/navigation";
import { CatalogPage } from "@/components/catalog";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { ADULT_CATEGORY_MINIMUM_VIDEOS } from "@/lib/adult-taxonomy";
import { catalogFilterPath, filterQueryOptions, hasCatalogFilters, parseCatalogFilters, type CatalogFilterParams } from "@/lib/catalog/filters";
import { listVideos, type QueryOptions } from "@/lib/catalog/repository";
import { catalogMetadata } from "@/lib/seo";
import { pageNumber } from "@/lib/videos";
import { AdultCategoryStrip } from "@/components/adult-category-strip";

const listings = {
  latest: {
    eyebrow: "Recently added",
    title: "Latest Porn Videos",
    description: "Discover recently added adult porn videos across popular categories with clear titles, durations and related tags.",
    query: { order: "latest" },
  },
  popular: {
    eyebrow: "Popular now",
    title: "Popular Porn Videos",
    description: "Browse popular adult porn videos across amateur, romantic, anal, oral, roleplay and other established categories.",
    query: { order: "popular" },
  },
  "top-rated": {
    eyebrow: "Highly rated",
    title: "Top-Rated Porn Videos",
    description: "Explore highly rated adult porn videos with enough rating signals to support useful category discovery.",
    query: { order: "rating", minRating: 70 },
  },
} as const satisfies Record<string, { eyebrow: string; title: string; description: string; query: QueryOptions }>;

type Props = { params: Promise<{ listing: string }>; searchParams: Promise<CatalogFilterParams> };

export function generateStaticParams() {
  return Object.keys(listings).map((listing) => ({ listing }));
}

export async function generateMetadata({ params, searchParams }: Props) {
  const [{ listing }, query] = await Promise.all([params, searchParams]);
  const definition = listings[listing as keyof typeof listings];
  if (!definition) return {};
  const filters = parseCatalogFilters(query);
  const result = await listVideos({ catalog: "porn", minYear: 2024, ...definition.query, page: 1, pageSize: 1 });
  return catalogMetadata({
    title: definition.title,
    description: definition.description,
    path: `/porn-videos/${listing}`,
    page: query.page,
    index: result.total >= ADULT_CATEGORY_MINIMUM_VIDEOS && !hasCatalogFilters(filters),
    keywords: [definition.title.toLowerCase(), "adult video categories", "porn videos"],
  });
}

export default async function PornVideoListingPage({ params, searchParams }: Props) {
  const [{ listing }, query] = await Promise.all([params, searchParams]);
  const definition = listings[listing as keyof typeof listings];
  if (!definition) notFound();
  const filters = parseCatalogFilters(query);
  const page = pageNumber(query.page);
  const result = await listVideos({ catalog: "porn", minYear: 2024, ...definition.query, ...filterQueryOptions(filters), page, pageSize: 25 });
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));
  if (page > pages) notFound();
  return (
    <>
      <SiteHeader />
      <CatalogPage
        eyebrow={definition.eyebrow}
        title={definition.title}
        description={definition.description}
        items={result.items}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        prePaginated
        basePath={catalogFilterPath(`/porn-videos/${listing}`, filters)}
        filters={{ basePath: `/porn-videos/${listing}`, values: filters, hideType: true }}
        beforeGrid={<AdultCategoryStrip />}
      />
      <SiteFooter />
    </>
  );
}
