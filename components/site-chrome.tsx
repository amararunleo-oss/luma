import { getTaxonomy } from "@/lib/catalog/repository";
import Link from "@/components/navigation/revenue-link";
import { LiveSearch } from "@/components/search/live-search";
import { AdSlot } from "@/components/ads/ad-slot";
import { SITE } from "@/lib/site";
import { BrowseDrawer } from "@/components/navigation/browse-drawer";
import { CatalogNavigation } from "@/components/navigation/catalog-navigation";
import { ADULT_CATEGORIES } from "@/lib/adult-taxonomy";
import { Film, FolderOpen, Home, Info, ShieldCheck } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-container header-inner">
        <Link className="brand" href="/" aria-label={`${SITE.name} home`}>
          <span className="brand-dot" />
          <span>{SITE.displayName}</span>
          <small>18+</small>
        </Link>
        <LiveSearch />
        <BrowseDrawer />
      </div>
    </header>
  );
}

export async function Sidebar() {
  const { actresses, tags, years } = await getTaxonomy();
  return (
    <aside className="sidebar" aria-label="Explore">
      <div className="sidebar-scroll">
        <section className="sidebar-navigation-section">
          <h2>Browse</h2>
          <Link className="sidebar-home-link" href="/">
            <span className="sidebar-home-icon"><Home size={15} aria-hidden="true" /></span>
            <span className="sidebar-home-copy"><strong>Home</strong><small>Popular and latest scenes</small></span>
          </Link>
          <CatalogNavigation />
        </section>
        <section className="sidebar-adult-section">
          <div className="sidebar-heading"><h2>Adult categories</h2><Link href="/porn-categories">View all</Link></div>
          <div className="sidebar-category-links">
            {ADULT_CATEGORIES.map((category) => <Link href={`/porn-category/${category.slug}`} key={category.slug}>{category.shortName}</Link>)}
          </div>
        </section>
        <AdSlot placement="sidebar" />
        <section>
          <div className="sidebar-heading"><h2>Popular actresses</h2><Link href="/actress">View all</Link></div>
          <ul className="text-list">
            {actresses.slice(0, 10).map((actress) => (
              <li key={actress.slug}><Link href={`/actress/${actress.slug}`}>{actress.name}</Link></li>
            ))}
          </ul>
        </section>
        <section>
          <h2>Tags</h2>
          <div className="tag-cloud">
            {tags.slice(0, 24).map((tag) => <Link href={`/tag/${tag.slug}`} key={tag.slug}>{tag.name}</Link>)}
          </div>
        </section>
        <section>
          <h2>Years</h2>
          {/* Every year the catalog actually has, newest first. A hardcoded
              slice(0, 18) previously cut the list off at 2009. */}
          <div className="year-list">
            {years.map((item) => <Link href={`/year/${item.year}`} key={item.year}>{item.year}</Link>)}
          </div>
        </section>
      </div>
    </aside>
  );
}

export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="site-container footer-inner">
        <section className="footer-about">
          <Link className="brand footer-brand" href="/"><span className="brand-dot" /><span>{SITE.displayName}</span><small>18+</small></Link>
          <p>An adults-only discovery service for celebrity entertainment and licensed third-party video embeds. External media remains under its respective publisher&apos;s control.</p>
        </section>
        <nav className="footer-links" aria-label="Footer navigation">
          <section><h2><Film size={14} aria-hidden="true" />Browse</h2><Link href="/latest">Latest videos</Link><Link href="/most-popular">Popular videos</Link><Link href="/porn-categories">Adult categories</Link><Link href="/collections">Collections</Link></section>
          <section><h2><FolderOpen size={14} aria-hidden="true" />Libraries</h2><Link href="/actress">Celebrities</Link><Link href="/movie">Movies</Link><Link href="/tv-show">TV shows</Link><Link href="/porn-videos">Porn videos</Link></section>
          <section><h2><ShieldCheck size={14} aria-hidden="true" />Legal</h2><Link href="/dmca">DMCA</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/rights">Rights</Link><Link href="/2257">2257 notice</Link></section>
          <section><h2><Info size={14} aria-hidden="true" />Support</h2><Link href="/about">About</Link><Link href="/contact">Contact</Link><Link href="/search">Search</Link></section>
        </nav>
        <div className="footer-bottom"><p>© {year} {SITE.displayName}. Site design, original copy and catalog organization reserved.</p><p>Adults 18+ only. Availability and terms of external players may change.</p></div>
      </div>
    </footer>
  );
}
