"use client";

import { Maximize2, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type FullscreenElement = HTMLDivElement & { webkitRequestFullscreen?: () => Promise<void> | void };

// The embed is cross-origin, so there is no reliable way to observe whether it is
// actually playing. onLoad is the only signal and it is not dependable: extensions
// and the provider's own page can delay or swallow it. Remounting on a timer
// therefore risks destroying a video the visitor is already watching, so nothing is
// remounted automatically. The timeout only reveals a manual reload control.
const LOAD_TIMEOUT_MS = 9_000;

export function PlayerGate({ embedUrl, title }: { embedUrl: string; title: string; aspectRatio?: number }) {
  const frame = useRef<FullscreenElement>(null);
  const [mounted, setMounted] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [stalled, setStalled] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    const mount = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(mount);
  }, []);

  // Offers the reload control if load never fired. It never remounts on its own.
  useEffect(() => {
    if (!mounted) return;
    const watch = window.setTimeout(() => {
      if (!loaded.current) setStalled(true);
    }, LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(watch);
  }, [attempt, embedUrl, mounted]);

  const reloadPlayer = () => {
    loaded.current = false;
    setStalled(false);
    setAttempt((value) => value + 1);
  };

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
          onLoad={() => { loaded.current = true; setStalled(false); }}
        />}
      </div>
      {stalled && (
        <div className="player-stalled" role="status">
          <p>The player did not finish loading.</p>
          <button type="button" onClick={reloadPlayer}><RotateCcw size={14} aria-hidden="true" />Reload player</button>
        </div>
      )}
      <button className="player-fullscreen" type="button" aria-label="Open video in full screen" title="Full screen" onClick={enterFullscreen}>
        <Maximize2 size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
