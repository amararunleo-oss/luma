import type { Video } from "@/lib/videos";
import { Sidebar } from "./site-chrome";
import { Thumbnail } from "./media/thumbnail";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import Link from "next/link";
import { AdSlot } from "./ads/ad-slot";
import { CatalogFilters } from "./catalog-filters";
import type { CatalogFilterValues } from "@/lib/catalog/filters";

export const PAGE_SIZE = 24;

export function VideoCard({ video, priority = false }: { video: Video; priority?: boolean }) {
  return (
    <article className="video-card">
      <Link className="video-thumb actrexx-mobile-pop" href={`/watch/${video.slug}`} aria-label={`Watch ${video.title}`}>
        <Thumbnail src={video.thumbnail} alt={video.title} priority={priority} />
        <span className="play-button" aria-hidden="true"><Play size={18} fill="currentColor" strokeWidth={1.8} /></span>
        <span className="duration">{video.duration}</span>
      </Link>
      {video.actresses.length > 0 && (
        <div className="performers" title={video.actresses.join(", ")}>
          {video.actresses.map((actress, index) => (
            <span key={actress}>{index > 0 && ", "}<Link href={`/actress/${slug(actress)}`}>{actress}</Link></span>
          ))}
        </div>
      )}
      <h2><Link href={`/watch/${video.slug}`} title={video.sceneTitle}>{video.sceneTitle}</Link></h2>
      <div className="video-meta"><span>{video.year}</span><i /> <span>{video.rating}% rating</span></div>
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
  return (
    <nav className="pagination" aria-label="Pagination">
      {page > 1
        ? <Link className="page-arrow" href={href(page - 1)} rel="prev"><ChevronLeft size={15} aria-hidden="true" />Previous</Link>
        : <span className="page-arrow disabled" aria-hidden="true"><ChevronLeft size={15} />Previous</span>}
      <div className="pagination-pages">
        {visiblePages.map((item) => typeof item === "number" ? (
          <Link className={item === page ? "active" : ""} aria-current={item === page ? "page" : undefined} href={href(item)} key={item}>{item}</Link>
        ) : <span className="pagination-gap" aria-hidden="true" key={item}>…</span>)}
      </div>
      <span className="pagination-status">Page {page}</span>
      {page < pages
        ? <Link className="page-arrow" href={href(page + 1)} rel="next">Next<ChevronRight size={15} aria-hidden="true" /></Link>
        : <span className="page-arrow disabled" aria-hidden="true">Next<ChevronRight size={15} /></span>}
    </nav>
  );
}

function paginationItems(current: number, total: number): Array<number | string> {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  const numbers = new Set([1, total, current - 1, current, current + 1]);
  if (current <= 4) [2, 3, 4, 5].forEach((number) => numbers.add(number));
  if (current >= total - 3) [total - 4, total - 3, total - 2, total - 1].forEach((number) => numbers.add(number));
  const sorted = [...numbers].filter((number) => number >= 1 && number <= total).sort((a, b) => a - b);
  const items: Array<number | string> = [];
  sorted.forEach((number, index) => {
    if (index > 0 && number - sorted[index - 1] > 1) items.push(`gap-${number}`);
    items.push(number);
  });
  return items;
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
  filters?: { basePath: string; values: CatalogFilterValues; hideType?: boolean; hideYear?: boolean };
}) {
  const totalItems = total ?? items.length;
  const pages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(page, pages);
  const visible = prePaginated ? items : items.slice((safePage - 1) * pageSize, safePage * pageSize);
  return (
    <main className="site-container content-layout">
      <section className="catalog-content">
        <header className="page-heading">
          {eyebrow && <p>{eyebrow}</p>}
          <h1>{title}</h1>
          <div><span>{description}</span></div>
        </header>
        {filters && <CatalogFilters basePath={filters.basePath} values={filters.values} hideType={filters.hideType} hideYear={filters.hideYear} />}
        <AdSlot placement="catalog-top" />
        {beforeGrid}
        {visible.length > 0 ? (
          <div className="video-grid">{visible.map((video, index) => <VideoCard video={video} priority={safePage === 1 && index < 4} key={video.id} />)}</div>
        ) : (
          <div className="empty-state"><h2>No matching scenes</h2><Link href="/">Return home</Link></div>
        )}
        {showPagination && <Pagination page={safePage} total={totalItems} basePath={basePath} pageSize={pageSize} />}
      </section>
      <Sidebar />
    </main>
  );
}
