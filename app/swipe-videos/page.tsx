import type { Metadata } from "next";
import { ReelsFeed, type ReelVideo } from "@/components/reels/reels-feed";
import { getPopularVideos } from "@/lib/catalog/repository";

export const revalidate = 21_600;

export const metadata: Metadata = {
  title: "Popular Celebrity Swipe Videos",
  description: "Swipe through 200 popular adult celebrity scenes from movies and television.",
  alternates: { canonical: "/swipe-videos" },
  openGraph: {
    title: "Popular Celebrity Swipe Videos",
    description: "Swipe through popular movie and television scenes.",
    type: "website",
    url: "/swipe-videos",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-video-preview": -1, "max-snippet": -1 },
  },
};

export default async function SwipeVideosPage() {
  const videos = await getPopularVideos(200);
  const feed: ReelVideo[] = videos.map((video) => ({
    id: video.id,
    slug: video.slug,
    sceneTitle: video.sceneTitle,
    workTitle: video.workTitle,
    year: video.year,
    duration: video.duration,
    type: video.type,
    actresses: video.actresses,
    embedUrl: video.embedUrl,
    thumbnail: video.thumbnail,
    playerAspectRatio: video.playerAspectRatio,
  }));
  const configuredTag = process.env.NEXT_PUBLIC_EXOCLICK_VERTICAL_VAST_TAG_URL?.trim();
  let vastTag: string | undefined;
  if (configuredTag && /^https:\/\//i.test(configuredTag)) {
    const tag = new URL(configuredTag);
    if (!tag.searchParams.has("sub")) tag.searchParams.set("sub", "1100114");
    if (!tag.searchParams.has("tags")) tag.searchParams.set("tags", "popular celebrity video,movie scene,television scene");
    vastTag = tag.toString();
  }

  return (
    <main className="reels-page">
      <div className="reels-layout">
        <ReelsFeed videos={feed} vastTag={vastTag} />
      </div>
    </main>
  );
}
