import { ArrowUpRight, Play } from "lucide-react";
import type { Video } from "@/lib/videos";
import Link from "@/components/navigation/revenue-link";
import { Thumbnail } from "@/components/media/thumbnail";

export function PopularNow({ videos }: { videos: Video[] }) {
  const visible = videos.slice(0, 5);
  if (!visible.length) return null;
  const [lead, ...supporting] = visible;

  return (
    <section className="popular-now" aria-labelledby="popular-now-title">
      <header className="popular-now-heading">
        <div>
          <span>Popular now</span>
          <h2 id="popular-now-title">Scenes people are watching</h2>
        </div>
        <nav aria-label="Popular video links">
          <Link href="/reels">View all<ArrowUpRight size={14} aria-hidden="true" /></Link>
          <Link href="/most-popular">Popular page<ArrowUpRight size={14} aria-hidden="true" /></Link>
        </nav>
      </header>
      <div className="popular-now-grid">
        <article className="popular-now-lead">
          <Link className="popular-now-media" href={`/reels#${lead.slug}`} aria-label={`Open ${lead.sceneTitle} in reels`}>
            <Thumbnail src={lead.thumbnail} alt={lead.sceneTitle} />
            <span className="popular-now-play" aria-hidden="true"><Play size={18} fill="currentColor" /></span>
            <span className="popular-now-duration">{lead.duration}</span>
          </Link>
          <div className="popular-now-copy">
            <p>{lead.actresses.slice(0, 3).join(", ")}</p>
            <h3><Link href={`/reels#${lead.slug}`}>{lead.sceneTitle}</Link></h3>
            <span>{lead.type}<i aria-hidden="true" />{lead.year}</span>
          </div>
        </article>
        <div className="popular-now-supporting">
          {supporting.map((video) => (
            <article key={video.id}>
              <Link className="popular-now-media" href={`/reels#${video.slug}`} aria-label={`Open ${video.sceneTitle} in reels`}>
                <Thumbnail src={video.thumbnail} alt={video.sceneTitle} />
                <span className="popular-now-play" aria-hidden="true"><Play size={14} fill="currentColor" /></span>
                <span className="popular-now-duration">{video.duration}</span>
              </Link>
              <div className="popular-now-copy">
                <p>{video.actresses.slice(0, 2).join(", ")}</p>
                <h3><Link href={`/reels#${video.slug}`}>{video.sceneTitle}</Link></h3>
                <span>{video.year}</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
