"use client";

import { Maximize2, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type FullscreenElement = HTMLDivElement & { webkitRequestFullscreen?: () => Promise<void> | void };

const LOAD_TIMEOUT_MS = 8_000;
const SETTLE_MS = 1_500;
const AUTO_RETRY_DELAY_MS = 2_500;

export function PlayerGate({ embedUrl, title }: { embedUrl: string; title: string; aspectRatio?: number }) {
  const frame = useRef<FullscreenElement>(null);
  const [mounted, setMounted] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [stalled, setStalled] = useState(false);
  const [loading, setLoading] = useState(true);
  const loaded = useRef(false);
  const settleTimer = useRef<number | undefined>(undefined);
  const hasRetried = useRef(false);

  useEffect(() => {
    const mount = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(mount);
  }, []);

  useEffect(() => {
    loaded.current = false;
    hasRetried.current = false;
    return () => window.clearTimeout(settleTimer.current);
  }, [embedUrl]);

  useEffect(() => {
    if (!mounted) return;
    const autoRetry = !hasRetried.current ? window.setTimeout(() => {
      if (!loaded.current) {
        hasRetried.current = true;
        setAttempt((value) => value + 1);
      }
    }, AUTO_RETRY_DELAY_MS) : undefined;
    const watch = window.setTimeout(() => {
      if (!loaded.current) {
        setStalled(true);
        setLoading(false);
      }
    }, LOAD_TIMEOUT_MS);
    return () => { if (autoRetry) window.clearTimeout(autoRetry); window.clearTimeout(watch); };
  }, [attempt, embedUrl, mounted]);

  const handleLoad = () => {
    loaded.current = true;
    setStalled(false);
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => setLoading(false), SETTLE_MS);
  };

  const reloadPlayer = () => {
    window.clearTimeout(settleTimer.current);
    loaded.current = false;
    hasRetried.current = false;
    setStalled(false);
    setLoading(true);
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
          referrerPolicy="origin-when-cross-origin"
          onLoad={handleLoad}
          onError={() => setStalled(true)}
        />}
      </div>
      {loading && !stalled && (
        <div className="player-loading" role="status">
          <span />
          <p>Loading player…</p>
        </div>
      )}
      {stalled && (
        <div className="player-stalled" role="status">
          <p>Video didn&apos;t load</p>
          <button type="button" onClick={reloadPlayer}><RotateCcw size={14} aria-hidden="true" />Refresh</button>
        </div>
      )}
      <button className="player-fullscreen" type="button" aria-label="Open video in full screen" title="Full screen" onClick={enterFullscreen}>
        <Maximize2 size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
