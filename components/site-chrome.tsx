import { Film, Flame, Sparkles, Star, Tv, UserRound } from "lucide-react";
import { getTaxonomy } from "@/lib/catalog/repository";
import Link from "next/link";
import { LiveSearch } from "@/components/search/live-search";
import { AdSlot } from "@/components/ads/ad-slot";
import { SITE } from "@/lib/site";
import { BrowseDrawer } from "@/components/navigation/browse-drawer";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-container header-inner">
        <Link className="brand" href="/" aria-label={`${SITE.name} home`}>
          <span className="brand-dot" />
          <span>{SITE.displayName}</span>
          <small>18+</small>
        </Link>
        <BrowseDrawer />
        <LiveSearch />
      </div>
    </header>
  );
}

export async function Sidebar() {
  const { actresses, tags, years } = await getTaxonomy();
  return (
    <aside className="sidebar" aria-label="Explore">
      <section>
        <h2>Browse</h2>
        <ul className="browse-list">
          <li><Link href="/"><Sparkles size={15} aria-hidden="true" /><span>Latest</span></Link></li>
          <li><Link href="/actress"><UserRound size={15} aria-hidden="true" /><span>Actresses</span></Link></li>
          <li><Link href="/movie"><Film size={15} aria-hidden="true" /><span>Movies</span></Link></li>
          <li><Link href="/tv-show"><Tv size={15} aria-hidden="true" /><span>TV Shows</span></Link></li>
          <li><Link href="/most-popular"><Flame size={15} aria-hidden="true" /><span>Popular</span></Link></li>
          <li><Link href="/top-rated"><Star size={15} aria-hidden="true" /><span>Top Rated</span></Link></li>
        </ul>
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
          {tags.map((tag) => <Link href={`/tag/${tag.slug}`} key={tag.slug}>{tag.name}</Link>)}
        </div>
      </section>
      <section>
        <h2>Years</h2>
        <div className="year-list">
          {years.map((item) => <Link href={`/year/${item.year}`} key={item.year}>{item.year}</Link>)}
        </div>
      </section>
    </aside>
  );
}

export function SiteFooter() {
  return (
    <footer>
      <div className="site-container footer-inner">
        <Link className="brand footer-brand" href="/"><span className="brand-dot" /><span>{SITE.displayName}</span></Link>
        <p>Movie and television scenes for adults 18 and older.</p>
        <div><Link href="/dmca">DMCA</Link><Link href="/2257">2257</Link></div>
      </div>
    </footer>
  );
}
