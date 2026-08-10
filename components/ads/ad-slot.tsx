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

function serveAd() {
  window.AdProvider = window.AdProvider || [];
  window.AdProvider.push({ serve: {} });
}

function loadProvider(onReady: () => void) {
  const existing = document.querySelector<HTMLScriptElement>('script[data-luma-ad-provider="true"]');
  if (existing) {
    if (existing.dataset.ready === "true") onReady();
    else existing.addEventListener("load", onReady, { once: true });
    return;
  }

  const script = document.createElement("script");
  script.async = true;
  script.type = "application/javascript";
  script.src = "https://a.magsrv.com/ad-provider.js";
  script.dataset.lumaAdProvider = "true";
  script.addEventListener("load", () => {
    script.dataset.ready = "true";
    onReady();
  }, { once: true });
  document.head.appendChild(script);
}

export function AdSlot({ placement }: { placement: Placement }) {
  const config = placements[placement];
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

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
    if (!visible || !config.zoneId || !config.className) return;
    loadProvider(serveAd);
  }, [config.className, config.zoneId, visible]);

  if (!config.zoneId || !config.className) return null;

  return (
    <div className={`ad-slot ad-slot-${config.format}`} data-placement={placement} ref={containerRef}>
      <span>Advertisement</span>
      {visible && (
        <ins
          className={config.className}
          data-zoneid={config.zoneId}
          data-block-ad-types="101"
          data-ex_av="2"
        />
      )}
    </div>
  );
}
