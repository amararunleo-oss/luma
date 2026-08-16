import { VideoCard } from "@/components/catalog";
import { AdSlot } from "@/components/ads/ad-slot";
import { Sidebar, SiteFooter, SiteHeader } from "@/components/site-chrome";
import { PlayerGate } from "@/components/player/player-gate";
import { getRelatedVideos, getVideoBySlug } from "@/lib/catalog/repository";
import { absoluteUrl, configuredSiteOrigin } from "@/lib/seo";
import { serializeJsonLd } from "@/lib/site";
import { slugify } from "@/lib/videos";
import type { Metadata } from "next";
import Link from "@/components/navigation/revenue-link";
import { notFound } from "next/navigation";
import { ReportIssue } from "@/components/reports/report-issue";
import { watchSeo } from "@/lib/seo-templates";
import { watchDescription } from "@/lib/entity-context";
import { videoUploadDate } from "@/lib/structured-data";
import { isPornhubTestVideo } from "@/lib/pornhub-test-video";
import { ADULT_CATEGORIES, adultCategoryMatchTerms } from "@/lib/adult-taxonomy";

export const revalidate = 86_400;
export const dynamicParams = true;

export function generateStaticParams() {
  return [];
}

function isoDuration(duration: string) {
  const [minutes = 0, seconds = 0] = duration.split(":").map(Number);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || minutes * 60 + seconds <= 0) return undefined;
  return `PT${minutes}M${seconds}S`;
}

function adultCategoryForVideo(video: Awaited<ReturnType<typeof getVideoBySlug>>) {
  if (!video) return undefined;
  const values = new Set([...(video.collections ?? []), ...(video.sourceCategories ?? []), ...video.tags].map(slugify));
  return ADULT_CATEGORIES.find((category) => adultCategoryMatchTerms(category).some((term) => values.has(slugify(term))));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const video = await getVideoBySlug(slug);
  if (!video) return {};

  const seo = watchSeo(video);
  const isEmbedTest = isPornhubTestVideo(slug);
  return {
    title: seo.title,
    description: seo.description,
    keywords: seo.keywords,
    alternates: { canonical: `/watch/${video.slug}` },
    robots: isEmbedTest
      ? { index: false, follow: false, googleBot: { index: false, follow: false, noimageindex: true } }
      : {
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

  const [related, origin] = await Promise.all([getRelatedVideos(video, 10), configuredSiteOrigin()]);
  const isPornhub = video.source === "pornhub";
  const adultCategory = adultCategoryForVideo(video);
  const typePath = isPornhub ? "/porn-videos" : video.type === "Movie" ? "/movie" : "/tv-show";
  const workPath = isPornhub ? (adultCategory ? `/porn-category/${adultCategory.slug}` : "/porn-categories") : `${typePath}/title/${slugify(video.workTitle)}`;
  const pageUrl = absoluteUrl(origin, `/watch/${video.slug}`);
  const enrichedDescription = watchDescription(video);
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        itemListElement: isPornhub ? [
          { "@type": "ListItem", position: 1, name: "Home", item: origin },
          { "@type": "ListItem", position: 2, name: "Porn videos", item: absoluteUrl(origin, "/porn-videos") },
          { "@type": "ListItem", position: 3, name: adultCategory?.name ?? "Porn categories", item: absoluteUrl(origin, workPath) },
          { "@type": "ListItem", position: 4, name: video.sceneTitle, item: pageUrl },
        ] : [
          { "@type": "ListItem", position: 1, name: "Home", item: origin },
          { "@type": "ListItem", position: 2, name: video.type, item: absoluteUrl(origin, typePath) },
          { "@type": "ListItem", position: 3, name: video.workTitle, item: absoluteUrl(origin, workPath) },
          { "@type": "ListItem", position: 4, name: video.sceneTitle, item: pageUrl },
        ],
      },
      {
        "@type": "VideoObject",
        "@id": `${pageUrl}#video`,
        url: pageUrl,
        name: video.sceneTitle,
        description: enrichedDescription,
        thumbnailUrl: [absoluteUrl(origin, video.thumbnail)],
        embedUrl: video.embedUrl,
        uploadDate: videoUploadDate(video),
        duration: isoDuration(video.duration),
        contentRating: "18+",
        isFamilyFriendly: false,
        actor: video.actresses.length ? video.actresses.map((name) => ({ "@type": "Person", name, ...(isPornhub ? {} : { url: absoluteUrl(origin, `/actress/${slugify(name)}`) }) })) : undefined,
        about: isPornhub
          ? (adultCategory ? [{ "@type": "DefinedTerm", name: adultCategory.name, url: absoluteUrl(origin, workPath) }] : [])
          : video.tags.map((name) => ({ "@type": "DefinedTerm", name, url: absoluteUrl(origin, `/tag/${slugify(name)}`) })),
        isPartOf: isPornhub
          ? { "@type": "CollectionPage", name: adultCategory?.name ?? "Adult videos", url: absoluteUrl(origin, workPath) }
          : { "@type": video.type === "Movie" ? "Movie" : "TVSeries", name: video.workTitle, url: absoluteUrl(origin, workPath) },
      },
    ],
  };

  return (
    <>
      <SiteHeader />
      <main className="site-container content-layout detail-layout">
        <article className="detail-content">
          <nav className="breadcrumbs" aria-label="Breadcrumb">
            <Link href="/">Home</Link><span>/</span><Link href={typePath}>{isPornhub ? "Porn videos" : video.type}</Link><span>/</span>{isPornhub && adultCategory && <><Link href={workPath}>{adultCategory.shortName}</Link><span>/</span></>}<b>{video.sceneTitle}</b>
          </nav>
          <header className="detail-heading">
            {video.actresses.length > 0 && <div className="performers detail-performers">
              {video.actresses.map((actress, index) => <span key={actress}>{index > 0 && ", "}{isPornhub ? actress : <Link href={`/actress/${slugify(actress)}`}>{actress}</Link>}</span>)}
            </div>}
            <h1>{video.sceneTitle}</h1>
            <p>{!isPornhub && <>{video.year >= 1900 ? video.year : "Year unavailable"} · </>}{video.duration === "00:00" ? "Duration unavailable" : video.duration} · {video.rating}% rating</p>
          </header>
          <div className="watch-stage">
            <div className="watch-media">
              <PlayerGate key={`${video.slug}:${video.embedUrl}`} embedUrl={video.embedUrl} title={video.sceneTitle} aspectRatio={video.playerAspectRatio} />
              <AdSlot keywords={video.tags} placement="below-player" />
              <section className="video-description" aria-labelledby="scene-description-title">
                <h2 id="scene-description-title">{isPornhub ? "About this video" : "About this scene"}</h2>
                <p>{enrichedDescription}</p>
              </section>
            </div>
          </div>
          <div className="detail-data" aria-label="Scene information">
            <dl>
              <div><dt>Title</dt><dd>{isPornhub ? video.sceneTitle : <Link href={workPath}>{video.workTitle}</Link>}</dd></div>
              {!isPornhub && <div><dt>Year</dt><dd>{video.year >= 1900 ? <Link href={`/year/${video.year}`}>{video.year}</Link> : "Unavailable"}</dd></div>}
              <div><dt>{isPornhub ? "Library" : "Type"}</dt><dd><Link href={typePath}>{isPornhub ? "Adult videos" : video.type}</Link></dd></div>
              <div><dt>Duration</dt><dd>{video.duration === "00:00" ? "Unavailable" : video.duration}</dd></div>
            </dl>
            <div className="detail-tags"><h2>{isPornhub ? "Categories" : "Tags"}</h2><ul>{isPornhub
              ? ADULT_CATEGORIES.filter((category) => adultCategoryMatchTerms(category).some((term) => [...(video.collections ?? []), ...(video.sourceCategories ?? []), ...video.tags].map(slugify).includes(slugify(term)))).slice(0, 12).map((category) => <li key={category.slug}><Link href={`/porn-category/${category.slug}`}>{category.shortName}</Link></li>)
              : video.tags.map((tag) => <li key={tag}><Link href={`/tag/${slugify(tag)}`}>{tag}</Link></li>)}</ul></div>
          </div>
          <ReportIssue videoSlug={video.slug} title={video.sceneTitle} />
          <div className="watch-outstream-break"><AdSlot keywords={video.tags} placement="watch-outstream" /></div>
          {related.length > 0 && (
            <section className="related">
              <div className="subheading"><h2>Related videos</h2></div>
              <div className="video-grid related-grid">{related.map((item) => <VideoCard video={item} key={item.id} />)}</div>
            </section>
          )}
          <div className="content-end-ad watch-end-ad"><AdSlot keywords={video.tags} placement="watch-footer" /></div>
        </article>
        <Sidebar />
      </main>
      <SiteFooter />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(schema) }} />
    </>
  );
}
