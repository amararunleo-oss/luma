"use client";

import { useEffect, useRef, useState } from "react";

type Placement = "catalog-top" | "sidebar" | "below-player";

declare global {
  interface Window {
    AdProvider?: Array<{ serve: Record<string, never> }>;
  }
}

const placements: Record<Placement, { zoneId?: string; className?: string; format: string }> = {
  "catalog-top": {
    zoneId: process.env.NEXT_PUBLIC_EXOCLICK_CATALOG_ZONE_ID,
    className: process.env.NEXT_PUBLIC_EXOCLICK_CATALOG_CLASS,
    format: "leaderboard",
  },
  sidebar: {
    zoneId: process.env.NEXT_PUBLIC_EXOCLICK_SIDEBAR_ZONE_ID,
    className: process.env.NEXT_PUBLIC_EXOCLICK_SIDEBAR_CLASS,
    format: "rectangle",
  },
  "below-player": {
    zoneId: process.env.NEXT_PUBLIC_EXOCLICK_PLAYER_ZONE_ID,
    className: process.env.NEXT_PUBLIC_EXOCLICK_PLAYER_CLASS,
    format: "leaderboard",
  },
};

const adsEnabled = process.env.NEXT_PUBLIC_ADS_ENABLED === "true";
const blockedAdTypes = process.env.NEXT_PUBLIC_EXOCLICK_BLOCK_AD_TYPES?.trim() || "101";

function validZone(config: { zoneId?: string; className?: string }) {
  return Boolean(config.zoneId && /^\d+$/.test(config.zoneId) && config.className && /^[a-z][a-z0-9_-]+$/i.test(config.className));
}

function serveAd() {
  window.AdProvider = window.AdProvider || [];
  window.AdProvider.push({ serve: {} });
}

function loadProvider(onReady: () => void, onError: () => void) {
  const existing = document.querySelector<HTMLScriptElement>('script[data-actrexx-ad-provider="true"]');
  if (existing) {
    if (existing.dataset.ready === "true") onReady();
    else if (existing.dataset.failed === "true") onError();
    else existing.addEventListener("load", onReady, { once: true });
    return;
  }

  const script = document.createElement("script");
  script.async = true;
  script.type = "application/javascript";
  script.src = "https://a.magsrv.com/ad-provider.js";
  script.dataset.actrexxAdProvider = "true";
  script.addEventListener("load", () => {
    script.dataset.ready = "true";
    onReady();
  }, { once: true });
  script.addEventListener("error", () => {
    script.dataset.failed = "true";
    onError();
  }, { once: true });
  document.head.appendChild(script);
}

export function AdSlot({ placement }: { placement: Placement }) {
  const { zoneId, className, format } = placements[placement];
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || visible) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setVisible(true);
      observer.disconnect();
    }, { rootMargin: "320px 0px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible || !adsEnabled || !validZone({ zoneId, className })) return;
    loadProvider(serveAd, () => setFailed(true));
  }, [className, visible, zoneId]);

  if (!adsEnabled || !validZone({ zoneId, className }) || failed) return null;

  return (
    <div className={`ad-slot ad-slot-${format}`} data-placement={placement} ref={containerRef}>
      <span>Advertisement</span>
      {visible && (
        <ins
          className={className}
          data-zoneid={zoneId}
          data-block-ad-types={blockedAdTypes || undefined}
        />
      )}
    </div>
  );
}
