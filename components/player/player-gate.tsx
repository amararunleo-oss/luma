"use client";

import { Maximize2, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type FullscreenElement = HTMLDivElement & { webkitRequestFullscreen?: () => Promise<void> | void };

// A third-party embed on a slow connection can take longer than this to fire load.
// Remounting too early throws away a load that was about to finish, so the window is
// generous and the number of automatic attempts is capped.
const LOAD_TIMEOUT_MS = 9_000;
const MAX_AUTO_RETRIES = 2;

export function PlayerGate({ embedUrl, title }: { embedUrl: string; title: string; aspectRatio?: number }) {
  const frame = useRef<FullscreenElement>(null);
  const [mounted, setMounted] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [stalled, setStalled] = useState(false);
  const loaded = useRef(false);
  const autoRetries = useRef(0);

  useEffect(() => {
    const mount = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(mount);
  }, []);

  // attempt is a dependency so every remount gets its own timer. Without it only the
  // first attempt was ever watched: if that retry also stalled, nothing rescheduled
  // and the player stayed dead until the page was reloaded by hand.
  useEffect(() => {
    if (!mounted) return;
    loaded.current = false;
    const retry = window.setTimeout(() => {
      if (loaded.current) return;
      if (autoRetries.current < MAX_AUTO_RETRIES) {
        autoRetries.current += 1;
        setAttempt((value) => value + 1);
      } else {
        setStalled(true);
      }
    }, LOAD_TIMEOUT_MS);
    return () => window.clearTimeout(retry);
  }, [attempt, embedUrl, mounted]);

  const reloadPlayer = () => {
    autoRetries.current = 0;
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
