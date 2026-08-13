"use client";

import Image from "next/image";
import { Check, Clapperboard, ExternalLink, Share2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Video, VideoType } from "@/lib/videos";
import Link from "@/components/navigation/revenue-link";
import { AdSlot } from "@/components/ads/ad-slot";
import { VerticalVastSlide } from "./vertical-vast-slide";

export type ReelVideo = Pick<Video, "id" | "slug" | "sceneTitle" | "workTitle" | "year" | "duration" | "type" | "actresses" | "embedUrl" | "thumbnail" | "playerAspectRatio">;

type FeedVideo = { kind: "video"; video: ReelVideo; position: number };
type FeedAd = { kind: "ad"; checkpoint: number };
type FeedItem = FeedVideo | FeedAd;

const AD_INTERVAL = 3;

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

function typeLabel(type: VideoType) {
  return type === "TV Show" ? "TV scene" : "Movie scene";
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
      <Image className="reel-scene-backdrop" src={video.thumbnail} alt="" fill sizes="430px" unoptimized aria-hidden="true" />
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
        ) : <Image src={video.thumbnail} alt={video.sceneTitle} fill sizes="430px" unoptimized />}
      </div>
      <div className="reel-scene-topline"><Clapperboard size={14} aria-hidden="true" /><span>Popular scene</span><i /> <span>{typeLabel(video.type)}</span></div>
      <button className="reel-share" type="button" onClick={shareScene} aria-label={`Share ${video.sceneTitle}`}>
        {shared ? <Check size={16} aria-hidden="true" /> : <Share2 size={16} aria-hidden="true" />}
        <span>{shared ? "Copied" : "Share"}</span>
      </button>
      <div className="reel-scene-copy">
        {video.actresses.length > 0 && <p>{video.actresses.slice(0, 3).join(", ")}</p>}
        <h2>{video.sceneTitle}</h2>
        <span>{video.workTitle}<i aria-hidden="true" />{video.year}<i aria-hidden="true" />{video.duration}</span>
        <Link href={`/watch/${video.slug}`}>View scene details<ExternalLink size={14} aria-hidden="true" /></Link>
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

  const skipAd = useCallback((checkpoint: number) => {
    setSkippedAds((current) => {
      if (current.has(checkpoint)) return current;
      const next = new Set(current);
      next.add(checkpoint);
      return next;
    });
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => scrollToIndex(checkpoint + 1, 1)));
  }, [scrollToIndex]);

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
          const adSlide = slidesRef.current.get(pendingAd);
          if (adSlide) root.scrollTo({ top: adSlide.offsetTop, behavior: "auto" });
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
  }, [items, skippedAds]);

  useEffect(() => {
    const rawHash = window.location.hash.slice(1);
    if (!rawHash) return;
    let slug = rawHash;
    try { slug = decodeURIComponent(rawHash); } catch { /* use the raw hash */ }
    const targetIndex = items.findIndex((item) => item.kind === "video" && item.video.slug === slug);
    const root = feedRef.current;
    if (targetIndex < 0 || !root) return;
    const frame = window.requestAnimationFrame(() => {
      root.scrollTo({ top: targetIndex * root.clientHeight, behavior: "auto" });
      activeIndexRef.current = targetIndex;
      setActiveIndex(targetIndex);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [items]);

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

  useEffect(() => {
    if (!adActive) return;
    const root = feedRef.current;
    const slide = slidesRef.current.get(activeIndex);
    if (!root || !slide) return;
    root.scrollTo({ top: slide.offsetTop, behavior: "auto" });
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

  if (!videos.length) {
    return <div className="reels-empty"><Clapperboard size={24} /><h1>Reels are temporarily unavailable</h1><Link href="/most-popular">Browse popular scenes</Link></div>;
  }

  return (
    <div className="reels-stage">
      <div className="reels-progress" aria-hidden="true" style={{ "--reels-progress": progress } as React.CSSProperties}><span /></div>
      <Link className="reels-popular-link" href="/most-popular"><Clapperboard size={13} aria-hidden="true" />Popular videos</Link>
      <div className={`reels-feed${adActive ? " reels-feed-locked" : ""}`} ref={feedRef} role="region" aria-label="Popular video reels">
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
                ? Math.abs(index - activeIndex) <= 1 && <ReelScene active={index === activeIndex} video={item.video} />
                : index === activeIndex && <VerticalVastSlide checkpoint={index} vastTag={vastTag} onUnavailable={skipAd} />}
            </section>
          );
        })}
      </div>
      <div className="reels-swipe-guide" aria-hidden="true"><i /><span>Swipe up to explore</span></div>
      {activeIndex > 0 && items[activeIndex]?.kind === "video" && <AdSlot active key={`reels-instant-${activeIndex}`} placement="catalog-instant" />}
    </div>
  );
}
