import { ArrowUpRight, Play } from "lucide-react";
import type { Video } from "@/lib/videos";
import Link from "@/components/navigation/revenue-link";
import { Thumbnail } from "@/components/media/thumbnail";

export function PopularNow({ videos }: { videos: Video[] }) {
  const visible = videos.slice(0, 10);
  if (!visible.length) return null;
  const [lead, ...supporting] = visible;

  return (
    <section className="popular-now" aria-labelledby="popular-now-title">
      <header className="popular-now-heading">
        <div>
          <span>Celebrity videos</span>
          <h2 id="popular-now-title">Popular celebrity scenes</h2>
        </div>
        <nav aria-label="Popular video links">
          <Link href="/swipe-videos">Swipe videos<ArrowUpRight size={14} aria-hidden="true" /></Link>
          <Link href="/most-popular">View popular scenes<ArrowUpRight size={14} aria-hidden="true" /></Link>
        </nav>
      </header>
      <div className="popular-now-grid">
        <article className="popular-now-lead">
          <Link className="popular-now-media" href={`/swipe-videos#${lead.slug}`} aria-label={`Open ${lead.sceneTitle} in swipe videos`}>
            <Thumbnail src={lead.thumbnail} alt={lead.sceneTitle} />
            <span className="popular-now-play" aria-hidden="true"><Play size={18} fill="currentColor" /></span>
            <span className="popular-now-duration">{lead.duration}</span>
            <div className="popular-now-overlay">
              <p>{lead.actresses.slice(0, 3).join(", ")}</p>
              <h3>{lead.sceneTitle}</h3>
              <span>{lead.type}<i aria-hidden="true" />{lead.year}</span>
            </div>
          </Link>
        </article>
        <div className="popular-now-supporting">
          {supporting.map((video) => (
            <article key={video.id}>
              <Link className="popular-now-media" href={`/swipe-videos#${video.slug}`} aria-label={`Open ${video.sceneTitle} in swipe videos`}>
                <Thumbnail src={video.thumbnail} alt={video.sceneTitle} />
                <span className="popular-now-play" aria-hidden="true"><Play size={14} fill="currentColor" /></span>
                <span className="popular-now-duration">{video.duration}</span>
              </Link>
              <div className="popular-now-copy">
                <p>{video.actresses.slice(0, 2).join(", ")}</p>
                <h3><Link href={`/swipe-videos#${video.slug}`}>{video.sceneTitle}</Link></h3>
                <span>{video.year}</span>
              </div>
            </article>
          ))}
          <aside className="popular-now-end-card" aria-label="More popular videos">
            <span>10 popular scenes</span>
            <strong>Keep exploring</strong>
            <Link href="/swipe-videos">View more<ArrowUpRight size={13} aria-hidden="true" /></Link>
            <Link href="/most-popular">View popular page<ArrowUpRight size={13} aria-hidden="true" /></Link>
          </aside>
        </div>
      </div>
    </section>
  );
}
