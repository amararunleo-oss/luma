import type { Video } from "@/lib/videos";

// Isolated noindex test record selected from Pornhub's official embed dump.
// It is intentionally excluded from D1, catalog listings and sitemaps.
export const PORNHUB_TEST_VIDEO: Video = {
  id: 4_952_836_373_348_550,
  rank: 999_999,
  slug: "pornhub-embed-test-6a6808483719d",
  title: "Japanese Cheating Wife with Tight Pussy Stretched By a BULL (BIG CUMSHOT)",
  sceneTitle: "Pornhub Official Embed Test",
  workTitle: "Pornhub Embed Test",
  description: "Isolated test of an official Pornhub embed selected from the publisher-provided CSV dump.",
  year: 2026,
  duration: "35:53",
  type: "Movie",
  rating: 88,
  actresses: [],
  tags: ["amateur", "Japanese", "MILF", "oral", "rough", "cumshot"],
  embedUrl: "https://www.pornhub.com/embed/6a6808483719d",
  thumbnail: "https://ei.phncdn.com/videos/202607/28/56970565/thumbs_15/(m=eaAaGwObaaamqv)(mh=mB8-4ZJlbKkfTnfw)4.jpg",
  publishedAt: "2026-07-28T00:00:00.000Z",
  playerAspectRatio: 608 / 481,
};

export function isPornhubTestVideo(slug: string) {
  return slug === PORNHUB_TEST_VIDEO.slug;
}
