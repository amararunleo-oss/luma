"use client";

import Image from "next/image";
import { Clapperboard, ExternalLink } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Video, VideoType } from "@/lib/videos";
import Link from "@/components/navigation/revenue-link";
import { AdSlot } from "@/components/ads/ad-slot";
import { VerticalVastSlide } from "./vertical-vast-slide";

export type ReelVideo = Pick<Video, "id" | "slug" | "sceneTitle" | "workTitle" | "year" | "duration" | "type" | "actresses" | "embedUrl" | "thumbnail" | "playerAspectRatio">;

type FeedVideo = { kind: "video"; video: ReelVideo; position: number };
type FeedAd = { kind: "ad"; checkpoint: number };
type FeedItem = FeedVideo | FeedAd;

const AD_INTERVAL = 5;

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
  const [activeIndex, setActiveIndex] = useState(0);
  const [skippedAds, setSkippedAds] = useState<Set<number>>(() => new Set());
  const items = useMemo(() => buildFeed(videos, Boolean(vastTag)), [vastTag, videos]);

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
    slidesRef.current.get(index)?.scrollIntoView({ behavior: "smooth", block: "start" });
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
      if (Number.isInteger(index)) setActiveIndex(index);
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
      setActiveIndex(targetIndex);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [items]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']")) return;
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
  }, [activeIndex, scrollToIndex]);

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
      <div className="reels-feed" ref={feedRef} role="region" aria-label="Popular video reels">
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
      <div className="reels-swipe-guide" aria-hidden="true"><span>Swipe to explore</span><i /></div>
      {activeIndex > 0 && items[activeIndex]?.kind === "video" && <AdSlot active key={`reels-instant-${activeIndex}`} placement="catalog-instant" />}
    </div>
  );
}
