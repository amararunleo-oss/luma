"use client";

import { Maximize2, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type FullscreenElement = HTMLDivElement & { webkitRequestFullscreen?: () => Promise<void> | void };

// The embed is cross-origin, so there is no reliable way to observe whether it is
// actually playing. onLoad is the only signal and it is not dependable: extensions
// and the provider's own page can delay or swallow it. Remounting on a timer
// therefore risks destroying a video the visitor is already watching, so nothing is
// remounted automatically. The timeout only reveals a manual reload control.
const LOAD_TIMEOUT_MS = 8_000;
// Some providers serve an interstitial document that runs a script and then
// navigates the same iframe again (a bot check that reloads once solved, for
// example). Each navigation fires its own onLoad, so the first onLoad is not
// necessarily the real content. The overlay is only cleared once this long has
// passed since the *last* onLoad without another one following it.
const SETTLE_MS = 1_500;
// The bot-challenge page sets a cookie then reloads. If the first load gets a TCP
// reset (the challenge couldn't even reach), a single automatic retry after a short
// pause usually succeeds because the browser retains the connection. Only one retry
// is attempted to avoid infinite loops on genuinely blocked embeds.
const AUTO_RETRY_DELAY_MS = 2_500;

export function PlayerGate({ embedUrl, title, sourceUrl }: { embedUrl: string; title: string; aspectRatio?: number; sourceUrl?: string }) {
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
  }, [attempt, embedUrl]);

  // Offers the reload control if load never fired. It never remounts on its own.
  useEffect(() => {
    if (!mounted) return;
    // One automatic retry after a short delay — the bot-challenge cookie needs one
    // round trip to land, so a second attempt usually succeeds without user action.
    const autoRetry = window.setTimeout(() => {
      if (!loaded.current && !hasRetried.current) {
        hasRetried.current = true;
        setAttempt((value) => value + 1);
      }
    }, AUTO_RETRY_DELAY_MS);
    const watch = window.setTimeout(() => {
      if (!loaded.current) setStalled(true);
    }, LOAD_TIMEOUT_MS);
    return () => { window.clearTimeout(autoRetry); window.clearTimeout(watch); };
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
    setStalled(false);
    setLoading(true);
    setAttempt((value) => value + 1);
  };

  // loading starts true and stays true until the settle debounce fires. A manual
  // reload resets it through reloadPlayer, which is event-driven (not in an effect).
  // The effect only manages the cleanup.

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
          onLoad={handleLoad}
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
          <p>Video didn't load — try refreshing the page.</p>
          <div className="player-stalled-actions">
            <button type="button" onClick={reloadPlayer}><RotateCcw size={14} aria-hidden="true" />Retry</button>
            {sourceUrl && <a href={sourceUrl} target="_blank" rel="noopener noreferrer">Watch on source<Maximize2 size={12} aria-hidden="true" /></a>}
          </div>
        </div>
      )}
      <button className="player-fullscreen" type="button" aria-label="Open video in full screen" title="Full screen" onClick={enterFullscreen}>
        <Maximize2 size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
