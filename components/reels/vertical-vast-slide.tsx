"use client";

import { ExternalLink, Play, SkipForward, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { VASTTracker } from "@dailymotion/vast-client";

type VastMedia = {
  fileURL?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  bitrate?: number;
};

type VastCreative = {
  type?: string;
  duration?: number;
  mediaFiles?: VastMedia[];
};

type VastAd = {
  title?: string;
  adTitle?: string;
  description?: string;
  creatives?: VastCreative[];
};

function selectMedia(creative: VastCreative) {
  return [...(creative.mediaFiles ?? [])]
    .filter((media) => media.fileURL && (!media.mimeType || media.mimeType.startsWith("video/")))
    .sort((a, b) => {
      const aRatio = a.width && a.height ? a.width / a.height : 0;
      const bRatio = b.width && b.height ? b.width / b.height : 0;
      const aVertical = aRatio > 0 && Math.abs(aRatio - 9 / 16) < 0.14 ? 1 : 0;
      const bVertical = bRatio > 0 && Math.abs(bRatio - 9 / 16) < 0.14 ? 1 : 0;
      const aMp4 = a.mimeType === "video/mp4" ? 1 : 0;
      const bMp4 = b.mimeType === "video/mp4" ? 1 : 0;
      return bVertical - aVertical || bMp4 - aMp4 || (b.bitrate ?? 0) - (a.bitrate ?? 0);
    })[0];
}

export function VerticalVastSlide({ checkpoint, vastTag, onUnavailable }: { checkpoint: number; vastTag?: string; onUnavailable: (checkpoint: number) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackerRef = useRef<VASTTracker | null>(null);
  const impressedRef = useRef(false);
  const completedRef = useRef(false);
  const [mediaUrl, setMediaUrl] = useState<string>();
  const [adTitle, setAdTitle] = useState("Sponsored video");
  const [adDescription, setAdDescription] = useState("Swipe to continue");
  const [muted, setMuted] = useState(true);
  const [needsPlay, setNeedsPlay] = useState(false);
  const [skipSeconds, setSkipSeconds] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    let tracker: VASTTracker | null = null;
    const unavailable = window.setTimeout(() => {
      if (!vastTag) onUnavailable(checkpoint);
    }, 80);

    if (vastTag) {
      window.clearTimeout(unavailable);
      const loadAd = async () => {
        try {
          const { VASTClient, VASTTracker: Tracker } = await import("@dailymotion/vast-client");
          const client = new VASTClient();
          const response = await client.get(vastTag, { timeout: 7_000, wrapperLimit: 7 });
          const ad = response?.ads?.[0] as VastAd | undefined;
          const creative = ad?.creatives?.find((item) => item.type === "linear" && item.mediaFiles?.length);
          const media = creative ? selectMedia(creative) : undefined;
          if (!alive || !ad || !creative || !media?.fileURL) {
            if (alive) onUnavailable(checkpoint);
            return;
          }

          tracker = new Tracker(client, ad, creative, null, true);
          tracker.on("clickthrough", (url: string) => {
            if (/^https?:\/\//i.test(url)) window.open(url, "_blank", "noopener,noreferrer");
          });
          trackerRef.current = tracker;
          const vastSkipDelay = Number(tracker.skipDelay);
          // ExoClick's VAST skipDelay is authoritative. Configure this zone to
          // 10 seconds in the publisher dashboard; use 10 only as a safe fallback.
          setSkipSeconds(Number.isFinite(vastSkipDelay) && vastSkipDelay >= 0 ? Math.ceil(vastSkipDelay) : 10);
          setAdTitle(String(ad.adTitle || ad.title || "Sponsored video"));
          setAdDescription(String(ad.description || "Swipe to continue"));
          setMediaUrl(media.fileURL);
        } catch {
          if (alive) onUnavailable(checkpoint);
        }
      };
      void loadAd();
    }

    return () => {
      alive = false;
      window.clearTimeout(unavailable);
      if (tracker && impressedRef.current && !completedRef.current) tracker.close();
      trackerRef.current = null;
    };
  }, [checkpoint, onUnavailable, vastTag]);

  useEffect(() => {
    if (skipSeconds === null || skipSeconds <= 0 || !mediaUrl) return;
    const timer = window.setInterval(() => setSkipSeconds((current) => current === null ? null : Math.max(0, current - 1)), 1_000);
    return () => window.clearInterval(timer);
  }, [mediaUrl, skipSeconds]);

  const startPlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    void video.play().then(() => setNeedsPlay(false)).catch(() => setNeedsPlay(true));
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    const tracker = trackerRef.current;
    if (!video || !tracker) return;
    tracker.setDuration(Number.isFinite(video.duration) ? video.duration : 0);
    tracker.load();
    startPlayback();
  };

  const handlePlaying = () => {
    const tracker = trackerRef.current;
    if (!tracker || impressedRef.current) return;
    impressedRef.current = true;
    tracker.trackImpression();
    tracker.trackViewableImpression({}, true);
  };

  const handleEnded = () => {
    const video = videoRef.current;
    const tracker = trackerRef.current;
    if (!video || !tracker) return;
    if (!completedRef.current) {
      completedRef.current = true;
      tracker.complete();
    }
    onUnavailable(checkpoint);
  };

  const toggleMuted = () => {
    const next = !muted;
    setMuted(next);
    if (videoRef.current) videoRef.current.muted = next;
    trackerRef.current?.setMuted(next);
  };

  const openAdvertiser = () => trackerRef.current?.click();
  const skipAdvert = () => {
    trackerRef.current?.skip();
    completedRef.current = true;
    onUnavailable(checkpoint);
  };

  return (
    <div className="vertical-vast-slide">
      {mediaUrl ? (
        // VAST media responses do not expose a WebVTT caption asset for this sponsored creative.
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video
          ref={videoRef}
          src={mediaUrl}
          autoPlay
          muted={muted}
          playsInline
          preload="auto"
          onLoadedMetadata={handleLoadedMetadata}
          onPlaying={handlePlaying}
          onTimeUpdate={(event) => trackerRef.current?.setProgress(event.currentTarget.currentTime)}
          onPause={() => trackerRef.current?.setPaused(true)}
          onPlay={() => trackerRef.current?.setPaused(false)}
          onEnded={handleEnded}
          onError={() => {
            trackerRef.current?.error({ ERRORCODE: 405 });
            onUnavailable(checkpoint);
          }}
        />
      ) : <div className="vertical-vast-loading"><span /><p>Finding a video for you</p></div>}
      <div className="vertical-vast-shade" />
      <div className="vertical-vast-badge">Advertisement</div>
      {needsPlay && <button className="vertical-vast-play" type="button" onClick={startPlayback} aria-label="Play advertisement"><Play size={22} fill="currentColor" /></button>}
      <button className="vertical-vast-mute" type="button" onClick={toggleMuted} aria-label={muted ? "Unmute advertisement" : "Mute advertisement"}>
        {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
      </button>
      <button className="vertical-vast-skip" type="button" disabled={skipSeconds === null || skipSeconds > 0} onClick={skipAdvert}>
        {skipSeconds === null || skipSeconds > 0 ? `Skip in ${skipSeconds ?? 10}` : <>Skip ad<SkipForward size={14} aria-hidden="true" /></>}
      </button>
      <div className="vertical-vast-copy">
        <span>Sponsored</span>
        <h2>{adTitle}</h2>
        <p>{adDescription}</p>
        <button type="button" onClick={openAdvertiser}>Learn more<ExternalLink size={14} aria-hidden="true" /></button>
      </div>
    </div>
  );
}
