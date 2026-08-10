import { VideoCard } from "@/components/catalog";
import { AdSlot } from "@/components/ads/ad-slot";
import { Sidebar, SiteFooter, SiteHeader } from "@/components/site-chrome";
import { PlayerGate } from "@/components/player/player-gate";
import { getRelatedVideos, getVideoBySlug } from "@/lib/catalog/repository";
import { absoluteUrl, requestOrigin } from "@/lib/seo";
import { serializeJsonLd } from "@/lib/site";
import { slugify, videos } from "@/lib/videos";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReportIssue } from "@/components/reports/report-issue";
import { watchSeo } from "@/lib/seo-templates";
import { watchDescription } from "@/lib/entity-context";

export function generateStaticParams() {
  return videos.map((video) => ({ slug: video.slug }));
}

function isoDuration(duration: string) {
  const [minutes = 0, seconds = 0] = duration.split(":").map(Number);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || minutes * 60 + seconds <= 0) return undefined;
  return `PT${minutes}M${seconds}S`;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const video = await getVideoBySlug(slug);
  if (!video) return {};

  const seo = watchSeo(video);
  return {
    title: seo.title,
    description: seo.description,
    keywords: seo.keywords,
    alternates: { canonical: `/watch/${video.slug}` },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-image-preview": "large", "max-video-preview": -1, "max-snippet": -1 },
    },
    openGraph: {
      title: seo.title,
      description: seo.description,
      type: "video.other",
      url: `/watch/${video.slug}`,
      images: [{ url: video.thumbnail, width: 640, height: 360, alt: video.sceneTitle }],
    },
    twitter: { card: "summary_large_image", title: seo.title, description: seo.description, images: [video.thumbnail] },
  };
}

export default async function WatchPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const video = await getVideoBySlug(slug);
  if (!video) notFound();

  const [related, origin] = await Promise.all([getRelatedVideos(video, 8), requestOrigin()]);
  const typePath = video.type === "Movie" ? "/movie" : "/tv-show";
  const workPath = `${typePath}/title/${slugify(video.workTitle)}`;
  const pageUrl = absoluteUrl(origin, `/watch/${video.slug}`);
  const enrichedDescription = watchDescription(video);
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: origin },
          { "@type": "ListItem", position: 2, name: video.type, item: absoluteUrl(origin, typePath) },
          { "@type": "ListItem", position: 3, name: video.workTitle, item: absoluteUrl(origin, workPath) },
          { "@type": "ListItem", position: 4, name: video.sceneTitle, item: pageUrl },
        ],
      },
      {
        "@type": "VideoObject",
        "@id": `${pageUrl}#video`,
        name: video.sceneTitle,
        description: enrichedDescription,
        thumbnailUrl: [absoluteUrl(origin, video.thumbnail)],
        embedUrl: video.embedUrl,
        duration: isoDuration(video.duration),
        contentRating: "18+",
        isFamilyFriendly: false,
        actor: video.actresses.map((name) => ({ "@type": "Person", name, url: absoluteUrl(origin, `/actress/${slugify(name)}`) })),
        about: video.tags.map((name) => ({ "@type": "DefinedTerm", name, url: absoluteUrl(origin, `/tag/${slugify(name)}`) })),
        isPartOf: { "@type": video.type === "Movie" ? "Movie" : "TVSeries", name: video.workTitle, url: absoluteUrl(origin, workPath) },
        ...(video.publishedAt ? { uploadDate: video.publishedAt } : {}),
      },
    ],
  };

  return (
    <>
      <SiteHeader />
      <main className="site-container content-layout detail-layout">
        <article className="detail-content">
          <nav className="breadcrumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link><span>/</span><Link href={typePath}>{video.type}</Link><span>/</span><b>{video.sceneTitle}</b>
          </nav>
          <header className="detail-heading">
            <div className="performers detail-performers">
              {video.actresses.map((actress, index) => <span key={actress}>{index > 0 && ", "}<Link href={`/actress/${slugify(actress)}`}>{actress}</Link></span>)}
            </div>
            <h1>{video.sceneTitle}</h1>
            <p>{video.year >= 1900 ? video.year : "Year unavailable"} · {video.duration === "00:00" ? "Duration unavailable" : video.duration} · {video.rating}% rating</p>
          </header>
          <div className="watch-stage">
            <div className="watch-media">
              <PlayerGate embedUrl={video.embedUrl} title={video.sceneTitle} aspectRatio={video.playerAspectRatio} />
              <section className="video-description" aria-labelledby="scene-description-title">
                <h2 id="scene-description-title">About this scene</h2>
                <p>{enrichedDescription}</p>
              </section>
              <AdSlot placement="below-player" />
            </div>
          </div>
          <div className="detail-data" aria-label="Scene information">
            <dl>
              <div><dt>Title</dt><dd><Link href={workPath}>{video.workTitle}</Link></dd></div>
              <div><dt>Year</dt><dd>{video.year >= 1900 ? <Link href={`/year/${video.year}`}>{video.year}</Link> : "Unavailable"}</dd></div>
              <div><dt>Type</dt><dd><Link href={typePath}>{video.type}</Link></dd></div>
              <div><dt>Duration</dt><dd>{video.duration === "00:00" ? "Unavailable" : video.duration}</dd></div>
            </dl>
            <div className="detail-tags"><h2>Tags</h2><ul>{video.tags.map((tag) => <li key={tag}><Link href={`/tag/${slugify(tag)}`}>{tag}</Link></li>)}</ul></div>
          </div>
          <ReportIssue videoSlug={video.slug} title={video.sceneTitle} />
          {related.length > 0 && (
            <section className="related">
              <div className="subheading"><h2>Related videos</h2></div>
              <div className="video-grid related-grid">{related.map((item) => <VideoCard video={item} key={item.id} />)}</div>
            </section>
          )}
        </article>
        <Sidebar />
      </main>
      <SiteFooter />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }} />
    </>
  );
}
