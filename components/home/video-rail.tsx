import { ArrowUpRight, Play } from "lucide-react";
import Link from "@/components/navigation/revenue-link";
import { Thumbnail } from "@/components/media/thumbnail";

export type HomeRailItem = {
  id: string | number;
  href: string;
  title: string;
  thumbnail: string;
  eyebrow?: string;
  duration: string;
  year?: number;
  rating: number;
};

export function HomeVideoRail({
  eyebrow,
  title,
  description,
  href,
  items,
  priority = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  items: HomeRailItem[];
  priority?: boolean;
}) {
  if (!items.length) return null;
  const headingId = `home-rail-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <section className="home-video-rail" aria-labelledby={headingId}>
      <header>
        <div>
          <span>{eyebrow}</span>
          <h2 id={headingId}>{title}</h2>
          <p>{description}</p>
        </div>
        <Link href={href}>View all<ArrowUpRight size={13} aria-hidden="true" /></Link>
      </header>
      <div className="home-video-track">
        {items.slice(0, 10).map((item, index) => (
          <article className="home-rail-card" key={item.id}>
            <Link adTrigger className="home-rail-media" href={item.href} aria-label={`Watch ${item.title}`}>
              <Thumbnail src={item.thumbnail} alt={item.title} priority={priority && index < 2} />
              <span className="home-rail-play" aria-hidden="true"><Play size={14} fill="currentColor" /></span>
              <span className="home-rail-duration">{item.duration}</span>
            </Link>
            {item.eyebrow && <p title={item.eyebrow}>{item.eyebrow}</p>}
            <h3><Link adTrigger href={item.href} title={item.title}>{item.title}</Link></h3>
            <div>{item.year !== undefined && <><span>{item.year}</span><i aria-hidden="true" /></>}<span>{item.rating}%</span></div>
          </article>
        ))}
        <aside className="home-rail-end-card" aria-label={`More ${title}`}>
          <span>More videos</span>
          <strong>Explore the full collection</strong>
          <Link href={href}>View all<ArrowUpRight size={13} aria-hidden="true" /></Link>
        </aside>
      </div>
    </section>
  );
}
