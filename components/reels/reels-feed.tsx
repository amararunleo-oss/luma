"use client";

import Image from "next/image";
import { Check, ExternalLink, Share2 } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Video } from "@/lib/videos";
import Link from "@/components/navigation/revenue-link";
import { AdSlot } from "@/components/ads/ad-slot";
import { VerticalVastSlide } from "./vertical-vast-slide";

export type ReelVideo = Pick<Video, "id" | "slug" | "sceneTitle" | "workTitle" | "year" | "duration" | "type" | "actresses" | "embedUrl" | "thumbnail" | "playerAspectRatio">;

type FeedVideo = { kind: "video"; video: ReelVideo; position: number };
type FeedAd = { kind: "ad"; checkpoint: number };
type FeedItem = FeedVideo | FeedAd;

// Reels ad in every third slide plus an interstitial on every swipe was well past
// what the format tolerates. The forced video ad now sits at the low end of the
// normal 5-8 range, and the interstitial is both spaced out and capped.
const AD_INTERVAL = 3;
const INSTANT_AD_EVERY = 3;
const INSTANT_AD_CAP = 8;

function buildFeed(videos: ReelVideo[], includeAds: boolean): FeedItem[] {
  const items: FeedItem[] = [];
  videos.forEach((video, index) => {
    items.push({ kind: "video", video, position: index + 1 });
    if (includeAds && (index + 1) % AD_INTERVAL === 0 && index < videos.length - 1) {
      items.push({ kind: "ad", checkpoint: items.length });
    }
  });
  return items;
}

function ReelScene({ active, video }: { active: boolean; video: ReelVideo }) {
  const ratio = Number(video.playerAspectRatio);
  const safeRatio = Number.isFinite(ratio) && ratio >= 1 && ratio <= 3 ? ratio : 16 / 9;
  const [shared, setShared] = useState(false);

  async function shareScene() {
    const url = `${window.location.origin}/watch/${video.slug}`;
    try {
      if (navigator.share) await navigator.share({ title: video.sceneTitle, text: `${video.sceneTitle} on Actrexx`, url });
      else await navigator.clipboard.writeText(url);
      setShared(true);
      window.setTimeout(() => setShared(false), 1_800);
    } catch (error) {
      if ((error as DOMException)?.name !== "AbortError") {
        try {
          await navigator.clipboard.writeText(url);
          setShared(true);
          window.setTimeout(() => setShared(false), 1_800);
        } catch { /* clipboard permissions can be unavailable */ }
      }
    }
  }

  return (
    <div className={`reel-scene${active ? " active" : ""}`}>
      <Image className="reel-scene-backdrop" src={video.thumbnail} alt="" fill sizes="430px" aria-hidden="true" />
      <div className="reel-scene-shade" />
      <div className="reel-scene-player" style={{ aspectRatio: safeRatio }}>
        {active ? (
          <iframe
            src={video.embedUrl}
            title={video.sceneTitle}
            loading="eager"
            allow="autoplay; fullscreen; picture-in-picture"
            referrerPolicy="origin-when-cross-origin"
          />
        ) : <Image src={video.thumbnail} alt={video.sceneTitle} fill sizes="430px" />}
      </div>
      <button className="reel-share" type="button" onClick={shareScene} aria-label={`Share ${video.sceneTitle}`}>
        {shared ? <Check size={16} aria-hidden="true" /> : <Share2 size={16} aria-hidden="true" />}
      </button>
      <div className="reel-scene-copy">
        {video.actresses.length > 0 && <p>{video.actresses.slice(0, 3).join(", ")}</p>}
        <h2>{video.sceneTitle}</h2>
        <span>{video.workTitle}<i aria-hidden="true" />{video.year}<i aria-hidden="true" />{video.duration}</span>
        <Link href={`/watch/${video.slug}`}>View details<ExternalLink size={13} aria-hidden="true" /></Link>
      </div>
    </div>
  );
}

export function ReelsFeed({ videos, vastTag }: { videos: ReelVideo[]; vastTag?: string }) {
  const feedRef = useRef<HTMLDivElement>(null);
  const slidesRef = useRef(new Map<number, HTMLElement>());
  const activeIndexRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [skippedAds, setSkippedAds] = useState<Set<number>>(() => new Set());
  const items = useMemo(() => buildFeed(videos, Boolean(vastTag)), [vastTag, videos]);
  const adActive = items[activeIndex]?.kind === "ad" && !skippedAds.has(activeIndex);

  const registerSlide = useCallback((index: number, element: HTMLElement | null) => {
    if (element) slidesRef.current.set(index, element);
    else slidesRef.current.delete(index);
  }, []);

  const availableIndex = useCallback((start: number, direction: 1 | -1) => {
    let index = Math.max(0, Math.min(items.length - 1, start));
    while (skippedAds.has(index) && index >= 0 && index < items.length) index += direction;
    return Math.max(0, Math.min(items.length - 1, index));
  }, [items.length, skippedAds]);

  const scrollToIndex = useCallback((target: number, direction: 1 | -1 = 1) => {
    const index = availableIndex(target, direction);
    const root = feedRef.current;
    const slide = slidesRef.current.get(index);
    if (!root || !slide) return;
    root.scrollTo({ top: slide.offsetTop, behavior: "smooth" });
  }, [availableIndex]);

  // Assign scrollTop directly instead of scrollTo({ behavior: "auto" }). "auto"
  // resolves to the container's computed scroll-behavior, which is smooth here,
  // so it would animate across every slide in between and leave the feed parked
  // between two snap points.
  const pinToIndex = useCallback((index: number) => {
    const root = feedRef.current;
    const slide = slidesRef.current.get(index);
    if (!root || !slide) return false;
    root.scrollTop = slide.offsetTop;
    return true;
  }, []);

  const skipAd = useCallback((checkpoint: number) => {
    setSkippedAds((current) => {
      if (current.has(checkpoint)) return current;
      const next = new Set(current);
      next.add(checkpoint);
      return next;
    });
    // Hiding the ad slide collapses its height, so wait for layout to settle and
    // then pin the next reel rather than animating into a shifted offset.
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      const next = Math.min(items.length - 1, checkpoint + 1);
      activeIndexRef.current = next;
      setActiveIndex(next);
      pinToIndex(next);
    }));
  }, [items.length, pinToIndex]);

  useEffect(() => {
    const root = feedRef.current;
    if (!root) return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible || visible.intersectionRatio < 0.55) return;
      const index = Number((visible.target as HTMLElement).dataset.reelIndex);
      if (!Number.isInteger(index)) return;

      // A fast momentum swipe can visually cross multiple snap points. Always
      // stop at the first unserved ad checkpoint between the old and new reel.
      const current = activeIndexRef.current;
      if (index > current) {
        const pendingAd = items.findIndex((item, itemIndex) => itemIndex > current && itemIndex <= index && item.kind === "ad" && !skippedAds.has(itemIndex));
        if (pendingAd >= 0) {
          activeIndexRef.current = pendingAd;
          setActiveIndex(pendingAd);
          pinToIndex(pendingAd);
          return;
        }
      }
      activeIndexRef.current = index;
      setActiveIndex(index);
    }, { root, threshold: [0.55, 0.72, 0.9] });
    slidesRef.current.forEach((element, index) => {
      if (!skippedAds.has(index)) observer.observe(element);
    });
    return () => observer.disconnect();
  }, [items, pinToIndex, skippedAds]);

  // Mobile browsers resize the viewport when the URL bar shows or hides, which
  // changes every slide height and leaves the feed halfway between two reels.
  // visualViewport is watched too because iOS Safari does not always fire a window
  // resize for that.
  useEffect(() => {
    let frame = 0;
    const repin = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => pinToIndex(activeIndexRef.current));
    };
    const viewport = window.visualViewport;
    window.addEventListener("resize", repin);
    window.addEventListener("orientationchange", repin);
    viewport?.addEventListener("resize", repin);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", repin);
      window.removeEventListener("orientationchange", repin);
      viewport?.removeEventListener("resize", repin);
    };
  }, [pinToIndex]);

  useEffect(() => {
    const rawHash = window.location.hash.slice(1);
    if (!rawHash) return;
    let slug = rawHash;
    try { slug = decodeURIComponent(rawHash); } catch { /* use the raw hash */ }
    const targetIndex = items.findIndex((item) => item.kind === "video" && item.video.slug === slug);
    if (targetIndex < 0) return;
    const frame = window.requestAnimationFrame(() => {
      activeIndexRef.current = targetIndex;
      setActiveIndex(targetIndex);
      pinToIndex(targetIndex);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [items, pinToIndex]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']")) return;
      if (adActive && ["ArrowDown", "PageDown", "ArrowUp", "PageUp", " "].includes(event.key)) {
        event.preventDefault();
        return;
      }
      if (["ArrowDown", "PageDown"].includes(event.key)) {
        event.preventDefault();
        scrollToIndex(activeIndex + 1, 1);
      }
      if (["ArrowUp", "PageUp"].includes(event.key)) {
        event.preventDefault();
        scrollToIndex(activeIndex - 1, -1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex, adActive, scrollToIndex]);

  // Runs before paint, so the locked ad slide is never shown halfway scrolled.
  useLayoutEffect(() => {
    if (!adActive) return;
    pinToIndex(activeIndex);
  }, [activeIndex, adActive, pinToIndex]);

  // A single pin is not enough. The swipe or wheel gesture that reached the ad is
  // still coasting when overflow is hidden, and its in-flight animation overrides
  // scrollTop, so the slide ends up parked between two reels. Mobile viewport
  // resizing while an ad plays does the same thing. Keep re-asserting the position
  // for as long as the ad is on screen.
  useEffect(() => {
    if (!adActive) return;
    const root = feedRef.current;
    if (!root) return;
    let frames = 0;
    let frame = 0;
    const enforce = () => {
      const top = slidesRef.current.get(activeIndexRef.current)?.offsetTop;
      if (top === undefined) return;
      if (Math.abs(root.scrollTop - top) > 1) root.scrollTop = top;
    };
    const settle = () => {
      enforce();
      frames += 1;
      if (frames < 40) frame = window.requestAnimationFrame(settle);
    };
    frame = window.requestAnimationFrame(settle);
    root.addEventListener("scroll", enforce, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      root.removeEventListener("scroll", enforce);
    };
  }, [activeIndex, adActive]);

  const currentVideoPosition = (() => {
    const current = items[activeIndex];
    if (current?.kind === "video") return current.position;
    for (let index = activeIndex - 1; index >= 0; index -= 1) {
      if (items[index]?.kind === "video") return (items[index] as FeedVideo).position;
    }
    return 1;
  })();
  const progress = `${Math.max(1, currentVideoPosition / videos.length * 100)}%`;

  // The AdSlot key drives the zone request, so it must only change when a new
  // interstitial is actually wanted. Keying it on activeIndex remounted the slot on
  // every single swipe, which requested a fresh overlay each time.
  const instantAdSlot = (() => {
    const current = items[activeIndex];
    if (current?.kind !== "video" || current.position <= 1) return null;
    if (current.position % INSTANT_AD_EVERY !== 0) return null;
    const slot = current.position / INSTANT_AD_EVERY;
    return slot <= INSTANT_AD_CAP ? slot : null;
  })();

  if (!videos.length) {
    return <div className="reels-empty"><h1>Swipe videos are temporarily unavailable</h1><Link href="/most-popular">Browse popular scenes</Link><Link href="/">Back to home</Link></div>;
  }

  return (
    <div className="reels-stage">
      <div className="reels-progress" aria-hidden="true" style={{ "--reels-progress": progress } as React.CSSProperties}><span /></div>
      <Link className="reels-brand" href="/" aria-label="Back to home">
        <span className="brand-dot" aria-hidden="true" />
      </Link>
      <div className={`reels-feed${adActive ? " reels-feed-locked" : ""}`} ref={feedRef} role="region" aria-label="Popular swipe videos">
        {items.map((item, index) => {
          const skipped = skippedAds.has(index);
          return (
            <section
              className={`reel-slide reel-slide-${item.kind}`}
              data-reel-index={index}
              hidden={skipped}
              ref={(element) => registerSlide(index, element)}
              key={item.kind === "video" ? `video-${item.video.id}` : `ad-${item.checkpoint}`}
              aria-label={item.kind === "video" ? `${item.position} of ${videos.length}: ${item.video.sceneTitle}` : "Advertisement"}
            >
              {item.kind === "video"
                ? Math.abs(index - activeIndex) <= 2 && <ReelScene active={index === activeIndex} video={item.video} />
                : index === activeIndex && <VerticalVastSlide checkpoint={index} vastTag={vastTag} onUnavailable={skipAd} />}
            </section>
          );
        })}
      </div>
      {instantAdSlot !== null && <AdSlot active key={`reels-instant-${instantAdSlot}`} placement="catalog-instant" />}
    </div>
  );
}
