import type { Video } from "@/lib/videos";
import type { PornhubHomePreview, PornhubPreviewItem } from "@/lib/pornhub-local-preview";
import { AdSlot } from "@/components/ads/ad-slot";
import { HomeVideoRail, type HomeRailItem } from "./video-rail";

function celebrityItem(video: Video): HomeRailItem {
  return {
    id: video.id,
    href: `/watch/${video.slug}`,
    title: video.sceneTitle,
    thumbnail: video.thumbnail,
    eyebrow: video.actresses.slice(0, 2).join(", "),
    duration: video.duration,
    rating: video.rating,
  };
}

function adultItem(video: PornhubPreviewItem, eyebrow: string): HomeRailItem {
  return {
    id: video.id,
    href: `/watch/${video.slug}`,
    title: video.title,
    thumbnail: video.thumbnail,
    eyebrow,
    duration: video.duration,
    year: video.year,
    rating: video.rating,
  };
}

export function HomeDiscovery({ latest, preview }: { latest: Video[]; preview: PornhubHomePreview }) {
  const latestYear = latest[0]?.year || new Date().getUTCFullYear();
  return (
    <div className="home-discovery">
      <HomeVideoRail
        eyebrow="Recently added"
        title={`Latest ${latestYear} celebrity scenes`}
        description={`New movie and television scenes from ${latestYear}, ordered by their latest publication date.`}
        href={`/latest?year=${latestYear}`}
        items={latest.slice(0, 10).map(celebrityItem)}
        priority
      />
      <div className="home-discovery-ad"><AdSlot placement="catalog-top" /></div>
      <div className="home-library-divider"><span>Adult video library</span></div>
      <HomeVideoRail
        eyebrow="Popular picks"
        title="Best from Pornhub"
        description="Recent, highly viewed videos selected from validated embeds."
        href="/porn-videos/latest"
        items={preview.sections.best.map((video) => adultItem(video, "Popular video"))}
      />
      <HomeVideoRail
        eyebrow="Mood"
        title="Romantic videos"
        description="Popular romantic and sensual adult videos."
        href="/porn-category/romantic?order=latest"
        items={preview.sections.romantic.map((video) => adultItem(video, "Romantic"))}
      />
      <div className="home-section-ad"><AdSlot placement="home-break" /></div>
      <HomeVideoRail
        eyebrow="Featured"
        title="Babe videos"
        description="Popular performer-focused videos with strong ratings."
        href="/porn-category/babe?order=latest"
        items={preview.sections.babe.map((video) => adultItem(video, "Babe"))}
      />
      <HomeVideoRail
        eyebrow="Animation"
        title="Hentai & animated videos"
        description="Popular adult animation and fantasy videos."
        href="/porn-category/hentai?order=latest"
        items={preview.sections.anime.map((video) => adultItem(video, "Animated"))}
      />
      <div className="home-section-ad"><AdSlot placement="home-break" /></div>
      <HomeVideoRail
        eyebrow="Popular position"
        title="Doggy style videos"
        description="Highly viewed doggy style videos from the curated selection."
        href="/porn-category/doggy-style?order=latest"
        items={preview.sections.doggy.map((video) => adultItem(video, "Doggy style"))}
      />
      <HomeVideoRail
        eyebrow="Oral picks"
        title="Pussy licking videos"
        description="Popular cunnilingus and pussy licking videos selected from validated embeds."
        href="/porn-category/pussy-licking?order=latest"
        items={preview.sections.pussyLicking.map((video) => adultItem(video, "Pussy licking"))}
      />
      <div className="home-section-ad"><AdSlot placement="home-break" /></div>
      <HomeVideoRail
        eyebrow="Fantasy roleplay"
        title="Step fantasy videos"
        description="Clearly adult step-family fantasy roleplay videos with validated embeds."
        href="/porn-category/step-family-roleplay?order=latest"
        items={preview.sections.stepFantasy.map((video) => adultItem(video, "Step fantasy"))}
      />
      <HomeVideoRail
        eyebrow="Oral videos"
        title="Blowjob videos"
        description="Popular blowjob and deep-throat videos from the curated adult selection."
        href="/porn-category/blowjob?order=latest"
        items={preview.sections.blowjob.map((video) => adultItem(video, "Blowjob"))}
      />
      <div className="home-section-ad"><AdSlot placement="home-break" /></div>
    </div>
  );
}
