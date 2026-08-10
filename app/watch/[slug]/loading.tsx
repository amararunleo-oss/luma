import { SiteFooter, SiteHeader } from "@/components/site-chrome";

function SkeletonLine({ className = "" }: { className?: string }) {
  return <span className={`watch-skeleton-block ${className}`} aria-hidden="true" />;
}

export default function WatchLoading() {
  return (
    <>
      <SiteHeader />
      <main className="site-container content-layout detail-layout watch-loading" aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading video details</span>
        <article className="detail-content">
          <div className="watch-skeleton-main">
            <div className="watch-skeleton-breadcrumbs" aria-hidden="true">
              <SkeletonLine /><SkeletonLine /><SkeletonLine />
            </div>
            <header className="watch-skeleton-heading">
              <SkeletonLine className="watch-skeleton-performers" />
              <SkeletonLine className="watch-skeleton-title" />
              <SkeletonLine className="watch-skeleton-meta" />
            </header>
            <SkeletonLine className="watch-skeleton-player" />
            <section className="watch-skeleton-description" aria-hidden="true">
              <SkeletonLine className="watch-skeleton-label" />
              <SkeletonLine className="watch-skeleton-copy" />
              <SkeletonLine className="watch-skeleton-copy watch-skeleton-copy-short" />
            </section>
            <section className="watch-skeleton-data" aria-hidden="true">
              <div className="watch-skeleton-table">
                {Array.from({ length: 4 }, (_, index) => (
                  <div key={index}><SkeletonLine /><SkeletonLine /></div>
                ))}
              </div>
              <div className="watch-skeleton-tags">
                <SkeletonLine className="watch-skeleton-label" />
                {Array.from({ length: 4 }, (_, index) => <SkeletonLine key={index} />)}
              </div>
            </section>
          </div>
          <section className="watch-skeleton-related" aria-hidden="true">
            <SkeletonLine className="watch-skeleton-related-title" />
            <div>
              {Array.from({ length: 4 }, (_, index) => (
                <article key={index}>
                  <SkeletonLine className="watch-skeleton-card-image" />
                  <SkeletonLine className="watch-skeleton-card-name" />
                  <SkeletonLine className="watch-skeleton-card-title" />
                  <SkeletonLine className="watch-skeleton-card-meta" />
                </article>
              ))}
            </div>
          </section>
        </article>
        <aside className="sidebar watch-skeleton-sidebar" aria-hidden="true">
          {Array.from({ length: 3 }, (_, section) => (
            <section key={section}>
              <SkeletonLine className="watch-skeleton-sidebar-heading" />
              {Array.from({ length: section === 0 ? 6 : 5 }, (_, row) => <SkeletonLine key={row} />)}
            </section>
          ))}
        </aside>
      </main>
      <SiteFooter />
    </>
  );
}
