import type { Metadata } from "next";
import { ReelsFeed, type ReelVideo } from "@/components/reels/reels-feed";
import { getPopularVideos } from "@/lib/catalog/repository";

export const revalidate = 21_600;

export const metadata: Metadata = {
  title: "Popular Celebrity Scene Reels",
  description: "Swipe through 200 popular celebrity scenes from movies and television.",
  alternates: { canonical: "/reels" },
  openGraph: {
    title: "Popular Celebrity Scene Reels",
    description: "Swipe through popular movie and television scenes.",
    type: "website",
    url: "/reels",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-video-preview": -1, "max-snippet": -1 },
  },
};

export default async function ReelsPage() {
  const videos = await getPopularVideos(200);
  const reels: ReelVideo[] = videos.map((video) => ({
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
  const vastTag = configuredTag && /^https:\/\//i.test(configuredTag) ? configuredTag : undefined;

  return (
    <main className="reels-page">
      <div className="reels-layout">
        <ReelsFeed videos={reels} vastTag={vastTag} />
      </div>
    </main>
  );
}
