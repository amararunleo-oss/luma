import type { Video } from "@/lib/videos";
import { Sidebar } from "./site-chrome";
import { Thumbnail } from "./media/thumbnail";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import Link from "@/components/navigation/revenue-link";
import { AdSlot } from "./ads/ad-slot";
import { CatalogFilters } from "./catalog-filters";
import type { CatalogFilterValues } from "@/lib/catalog/filters";
import { Fragment } from "react";
import { ADULT_CATEGORIES, adultCategoryMatchTerms } from "@/lib/adult-taxonomy";

export const PAGE_SIZE = 25;

export function VideoCard({ video, priority = false, headingLevel = 2 }: { video: Video; priority?: boolean; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 3 ? "h3" : "h2";
  const adultCategory = video.source === "pornhub" ? ADULT_CATEGORIES.find((category) => {
    const values = new Set([...(video.collections ?? []), ...(video.sourceCategories ?? []), ...video.tags].map(slug));
    return adultCategoryMatchTerms(category).some((term) => values.has(slug(term)));
  }) : undefined;
  return (
    <article className="video-card">
      <Link adTrigger className="video-thumb" href={`/watch/${video.slug}`} aria-label={`Watch ${video.title}`}>
        <Thumbnail src={video.thumbnail} alt={video.title} priority={priority} />
        <span className="play-button" aria-hidden="true"><Play size={18} fill="currentColor" strokeWidth={1.8} /></span>
        <span className="duration">{video.duration}</span>
      </Link>
      {adultCategory ? (
        <div className="performers"><Link href={`/porn-category/${adultCategory.slug}`}>{adultCategory.shortName}</Link></div>
      ) : video.actresses.length > 0 && (
        <div className="performers" title={video.actresses.join(", ")}>
          {video.actresses.map((actress, index) => (
            <span key={actress}>{index > 0 && ", "}<Link href={`/actress/${slug(actress)}`}>{actress}</Link></span>
          ))}
        </div>
      )}
      <Heading><Link adTrigger href={`/watch/${video.slug}`} title={video.sceneTitle}>{video.sceneTitle}</Link></Heading>
      <div className="video-meta">{video.source !== "pornhub" && <><span>{video.year}</span><i /></>}<span>{video.rating}% rating</span></div>
    </article>
  );
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function Pagination({ page, total, basePath, pageSize = PAGE_SIZE }: { page: number; total: number; basePath: string; pageSize?: number }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages === 1) return null;
  const href = (target: number) => target === 1 ? basePath : `${basePath}${basePath.includes("?") ? "&" : "?"}page=${target}`;
  const visiblePages = paginationItems(page, pages);
  const mobilePages = mobilePaginationItems(page, pages);
  return (
    <nav className="pagination" aria-label="Pagination">
      {page > 1
        ? <Link aria-label="Previous page" className="page-arrow page-arrow-previous" href={href(page - 1)} rel="prev"><ChevronLeft size={15} aria-hidden="true" /><span className="page-arrow-label">Previous</span></Link>
        : <span className="page-arrow page-arrow-previous disabled" aria-hidden="true"><ChevronLeft size={15} /><span className="page-arrow-label">Previous</span></span>}
      <div className="pagination-pages">
        {visiblePages.map((item) => typeof item === "number" ? (
          <Link className={item === page ? "active" : ""} aria-current={item === page ? "page" : undefined} href={href(item)} key={item}>{item}</Link>
        ) : <span className="pagination-gap" aria-hidden="true" key={item}>...</span>)}
      </div>
      <div className="pagination-mobile-pages">
        {mobilePages.map((item) => (
          <Link className={item === page ? "active" : ""} aria-current={item === page ? "page" : undefined} aria-label={`Page ${item}`} href={href(item)} key={item}>{item}</Link>
        ))}
      </div>
      {page < pages
        ? <Link aria-label="Next page" className="page-arrow page-arrow-next" href={href(page + 1)} rel="next"><span className="page-arrow-label">Next</span><ChevronRight size={15} aria-hidden="true" /></Link>
        : <span className="page-arrow page-arrow-next disabled" aria-hidden="true"><span className="page-arrow-label">Next</span><ChevronRight size={15} /></span>}
      <span className="pagination-status">Page {page} of {pages}</span>
    </nav>
  );
}

function paginationItems(current: number, total: number): Array<number | string> {
  if (total <= 9) return Array.from({ length: total }, (_, index) => index + 1);
  const numbers = new Set([1, total, current - 2, current - 1, current, current + 1, current + 2]);
  if (current <= 5) [2, 3, 4, 5, 6, 7].forEach((number) => numbers.add(number));
  if (current >= total - 4) [total - 6, total - 5, total - 4, total - 3, total - 2, total - 1].forEach((number) => numbers.add(number));
  const sorted = [...numbers].filter((number) => number >= 1 && number <= total).sort((a, b) => a - b);
  const items: Array<number | string> = [];
  sorted.forEach((number, index) => {
    if (index > 0 && number - sorted[index - 1] > 1) items.push(`gap-${number}`);
    items.push(number);
  });
  return items;
}

function mobilePaginationItems(current: number, total: number) {
  const length = Math.min(4, total);
  const preferredStart = current <= 2 ? 1 : current >= total - 1 ? total - length + 1 : current - 1;
  const start = Math.max(1, Math.min(preferredStart, total - length + 1));
  return Array.from({ length }, (_, index) => start + index);
}

export function CatalogPage({
  title,
  description,
  items,
  page,
  basePath,
  eyebrow,
  total,
  pageSize = PAGE_SIZE,
  prePaginated = false,
  showPagination = true,
  beforeGrid,
  beforeHeading,
  filters,
}: {
  title: string;
  description: string;
  items: Video[];
  page: number;
  basePath: string;
  eyebrow?: string;
  total?: number;
  pageSize?: number;
  prePaginated?: boolean;
  showPagination?: boolean;
  beforeGrid?: React.ReactNode;
  beforeHeading?: React.ReactNode;
  filters?: { basePath: string; values: CatalogFilterValues; hideType?: boolean; hideYear?: boolean; hideOrder?: boolean };
}) {
  const totalItems = total ?? items.length;
  const pages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, pages);
  const visible = prePaginated ? items : items.slice((safePage - 1) * pageSize, safePage * pageSize);
  return (
    <main className="site-container content-layout">
      <section className="catalog-content">
        {beforeHeading}
        {beforeHeading && <AdSlot placement="catalog-top" />}
        <header className="page-heading">
          {eyebrow && <p>{eyebrow}</p>}
          <h1>{title}</h1>
          <div><span>{description}</span></div>
        </header>
        {filters && <CatalogFilters basePath={filters.basePath} values={filters.values} hideType={filters.hideType} hideYear={filters.hideYear} hideOrder={filters.hideOrder} />}
        {!beforeHeading && <AdSlot placement="catalog-top" />}
        {beforeGrid}
        {visible.length > 0 ? (
          <div className="video-grid">
            {visible.map((video, index) => (
              <Fragment key={video.id}>
                <VideoCard video={video} priority={safePage === 1 && index < 4} />
                {(index + 1) % 4 === 0 && index < visible.length - 1 && <AdSlot placement="mobile-infeed" />}
              </Fragment>
            ))}
          </div>
        ) : (
          <div className="empty-state"><h2>No matching scenes</h2><Link href="/">Return home</Link></div>
        )}
        {showPagination && <Pagination page={safePage} total={totalItems} basePath={basePath} pageSize={pageSize} />}
        <div className="content-end-ad"><AdSlot placement="catalog-footer" /></div>
      </section>
      <Sidebar />
    </main>
  );
}
