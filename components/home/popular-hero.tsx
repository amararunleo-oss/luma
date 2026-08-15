"use client";

import Image from "next/image";
import { ArrowUpRight, Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Video } from "@/lib/videos";
import Link from "@/components/navigation/revenue-link";

const SLIDE_COUNT = 6;
const AUTO_ADVANCE_MS = 5_500;

function reducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function PopularHero({ videos }: { videos: Video[] }) {
  const slides = videos.slice(0, SLIDE_COUNT);
  const viewportRef = useRef<HTMLDivElement>(null);
  const slidesRef = useRef(new Map<number, HTMLElement>());
  const [active, setActive] = useState(0);
  const [interacting, setInteracting] = useState(false);

  const registerSlide = useCallback((index: number, element: HTMLElement | null) => {
    if (element) slidesRef.current.set(index, element);
    else slidesRef.current.delete(index);
  }, []);

  const goTo = useCallback((index: number, instant = false) => {
    const viewport = viewportRef.current;
    const slide = slidesRef.current.get(index);
    if (!viewport || !slide) return;
    viewport.scrollTo({ left: slide.offsetLeft, behavior: instant || reducedMotion() ? "instant" : "smooth" });
  }, []);

  // The viewport is a native scroll-snap track, so swiping and momentum come from
  // the browser. Reading the active slide back from intersection keeps the dots
  // correct whether the change came from a swipe or from auto-advance.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible || visible.intersectionRatio < 0.6) return;
      const index = Number((visible.target as HTMLElement).dataset.slideIndex);
      if (Number.isInteger(index)) setActive(index);
    }, { root: viewport, threshold: [0.6, 0.9] });
    slidesRef.current.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [slides.length]);

  // Restarting on every active change gives each slide a full dwell time, including
  // after a manual jump. Auto-advance stops for reduced-motion, while the pointer or
  // keyboard focus is inside the carousel, and while the tab is in the background.
  useEffect(() => {
    if (slides.length < 2 || interacting || reducedMotion()) return;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      const next = (active + 1) % slides.length;
      // Wrapping back to the first slide jumps instead of sweeping back across the
      // whole track.
      goTo(next, next === 0);
    }, AUTO_ADVANCE_MS);
    return () => window.clearInterval(timer);
  }, [active, goTo, interacting, slides.length]);

  // Re-align after a viewport resize, otherwise the track can sit between slides.
  useEffect(() => {
    let frame = 0;
    const realign = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const viewport = viewportRef.current;
        const slide = slidesRef.current.get(active);
        if (viewport && slide) viewport.scrollLeft = slide.offsetLeft;
      });
    };
    window.addEventListener("resize", realign);
    window.addEventListener("orientationchange", realign);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", realign);
      window.removeEventListener("orientationchange", realign);
    };
  }, [active]);

  if (!slides.length) return null;

  return (
    <section className="popular-hero" aria-labelledby="popular-hero-title" aria-roledescription="carousel">
      <header className="popular-hero-heading">
        <span>Celebrity videos</span>
        <h2 id="popular-hero-title">Popular celebrity scenes</h2>
      </header>

      <div
        className="popular-hero-viewport"
        ref={viewportRef}
        // Hover only pauses for a real mouse. On touch, pointerenter fires on tap
        // but pointerleave often never does, which would stop autoplay for good.
        onPointerEnter={(event) => { if (event.pointerType === "mouse") setInteracting(true); }}
        onPointerLeave={() => setInteracting(false)}
        onPointerDown={() => setInteracting(true)}
        onPointerUp={() => setInteracting(false)}
        onPointerCancel={() => setInteracting(false)}
        onFocusCapture={() => setInteracting(true)}
        onBlurCapture={() => setInteracting(false)}
      >
        {slides.map((video, index) => (
          <article
            className="popular-hero-slide"
            data-slide-index={index}
            ref={(element) => registerSlide(index, element)}
            key={video.slug}
            aria-roledescription="slide"
            aria-label={`${index + 1} of ${slides.length}: ${video.sceneTitle}`}
          >
            <Image
              className="popular-hero-media"
              src={video.thumbnail}
              alt={video.sceneTitle}
              fill
              sizes="(max-width: 820px) 100vw, 70vw"
              priority={index === 0}
              unoptimized
            />
            <div className="popular-hero-shade" />
            <div className="popular-hero-copy">
              {video.actresses.length > 0 && <p>{video.actresses.slice(0, 3).join(", ")}</p>}
              <h3>{video.sceneTitle}</h3>
              <span>{video.type}<i aria-hidden="true" />{video.year}<i aria-hidden="true" />{video.duration}<i aria-hidden="true" />{video.rating}%</span>
              <div className="popular-hero-actions">
                <Link adTrigger className="popular-hero-play" href={`/swipe-videos#${video.slug}`}><Play size={14} fill="currentColor" aria-hidden="true" />Swipe videos</Link>
                <Link className="popular-hero-secondary" href="/most-popular">Open in popular page<ArrowUpRight size={13} aria-hidden="true" /></Link>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="popular-hero-dots">
        {slides.map((video, index) => (
          <button
            className={`popular-hero-dot${index === active ? " active" : ""}`}
            type="button"
            key={video.slug}
            aria-label={`Show slide ${index + 1}: ${video.sceneTitle}`}
            aria-current={index === active ? "true" : undefined}
            onClick={() => goTo(index)}
          />
        ))}
      </div>
    </section>
  );
}
