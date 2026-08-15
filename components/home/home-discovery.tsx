import { Fragment } from "react";
import { ArrowUpRight } from "lucide-react";
import type { Video } from "@/lib/videos";
import type { PornhubHomePreview, PornhubPreviewItem } from "@/lib/pornhub-local-preview";
import { AdSlot } from "@/components/ads/ad-slot";
import { VideoCard } from "@/components/catalog";
import Link from "@/components/navigation/revenue-link";
import { HomeVideoRail, type HomeRailItem } from "./video-rail";

const ADULT_LIST_SIZE = 20;
const ADULT_LIST_HREF = "/porn-videos/latest";

function celebrityItem(video: Video): HomeRailItem {
  return {
    id: video.id,
    href: `/watch/${video.slug}`,
    title: video.sceneTitle,
    thumbnail: video.thumbnail,
    eyebrow: video.actresses.slice(0, 2).join(", "),
    duration: video.duration,
    year: video.year,
    rating: video.rating,
  };
}

// Preview items only carry what the card renders. The remaining Video fields keep
// the shared VideoCard shape satisfied and are never displayed. Keeping
// source: "pornhub" is what hides the year in the card meta row.
function adultVideo(item: PornhubPreviewItem, index: number): Video {
  return {
    // The preview id is an alphanumeric source viewkey, so it cannot be coerced to
    // a number. numericId carries the real numeric source id instead.
    id: item.numericId || index + 1,
    rank: index + 1,
    slug: item.slug,
    title: item.title,
    sceneTitle: item.title,
    workTitle: item.title,
    description: "",
    year: item.year,
    duration: item.duration,
    type: "Movie",
    rating: item.rating,
    actresses: [],
    tags: item.tags,
    embedUrl: "",
    thumbnail: item.thumbnail,
    publishedAt: item.publishedAt,
    source: "pornhub",
    collections: item.collections,
    views: item.views,
  };
}

export function HomeDiscovery({ latest, preview }: { latest: Video[]; preview: PornhubHomePreview }) {
  const latestYear = latest[0]?.year || new Date().getUTCFullYear();
  const adultVideos = preview.sections.best.slice(0, ADULT_LIST_SIZE).map(adultVideo);
  return (
    <div className="home-discovery">
      <HomeVideoRail
        eyebrow="Recently added"
        title={`Latest ${latestYear} celebrity scenes`}
        description="New movie and television scenes"
        href="/latest"
        items={latest.slice(0, 10).map(celebrityItem)}
        priority
      />
      <div className="home-discovery-ad"><AdSlot placement="catalog-top" /></div>
      <div className="home-library-divider"><span>Adult video library</span></div>
      {adultVideos.length > 0 && (
        <section className="home-video-rail home-video-list" aria-labelledby="home-best-from-pornhub">
          <header>
            <div>
              <span>Popular picks</span>
              <h2 id="home-best-from-pornhub">Best from Pornhub</h2>
              <p>The most viewed validated embeds, starting with the newest years.</p>
            </div>
            <Link href={ADULT_LIST_HREF}>View all<ArrowUpRight size={13} aria-hidden="true" /></Link>
          </header>
          <div className="video-grid">
            {adultVideos.map((video, index) => (
              <Fragment key={video.slug}>
                <VideoCard video={video} headingLevel={3} />
                {(index + 1) % 4 === 0 && index < adultVideos.length - 1 && <AdSlot placement="mobile-infeed" />}
              </Fragment>
            ))}
          </div>
          <div className="home-list-more">
            <Link className="home-list-more-button" href={ADULT_LIST_HREF}>View all porn videos<ArrowUpRight size={15} aria-hidden="true" /></Link>
          </div>
        </section>
      )}
      <div className="home-section-ad"><AdSlot placement="home-break" /></div>
    </div>
  );
}
