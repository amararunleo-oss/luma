"use client";

import { Maximize2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type FullscreenElement = HTMLDivElement & { webkitRequestFullscreen?: () => Promise<void> | void };

export function PlayerGate({ embedUrl, title }: { embedUrl: string; title: string; aspectRatio?: number }) {
  const frame = useRef<FullscreenElement>(null);
  const [mounted, setMounted] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const loaded = useRef(false);

  useEffect(() => {
    const mount = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(mount);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const retry = window.setTimeout(() => {
      if (!loaded.current) setAttempt((value) => value + 1);
    }, 6_000);
    return () => window.clearTimeout(retry);
  }, [mounted, embedUrl]);

  const enterFullscreen = async () => {
    const element = frame.current;
    if (!element) return;
    if (element.requestFullscreen) await element.requestFullscreen().catch(() => undefined);
    else await element.webkitRequestFullscreen?.();
  };

  return (
    <div className="player-frame" ref={frame}>
      <div className="player-embed-crop">
        {mounted && <iframe
          key={`${embedUrl}:${attempt}`}
          src={embedUrl}
          title={title}
          loading="eager"
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
          allowFullScreen
          scrolling="no"
          referrerPolicy="origin-when-cross-origin"
          onLoad={() => { loaded.current = true; }}
        />}
      </div>
      <button className="player-fullscreen" type="button" aria-label="Open video in full screen" title="Full screen" onClick={enterFullscreen}>
        <Maximize2 size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
