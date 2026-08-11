"use client";

import { useEffect, useRef, useState } from "react";
import { AD_ROUTE_CHANGE_EVENT, currentAdRoute } from "./ad-route-sync";

export type Placement = "catalog-top" | "sidebar" | "below-player" | "watch-outstream" | "desktop-sticky" | "catalog-instant" | "watch-slider" | "fullpage";
type ZoneConfig = { zoneId?: string; className?: string; format: string; provider?: string };
type Device = "mobile" | "desktop";

declare global {
  interface Window {
    AdProvider?: Array<{ serve: Record<string, never> }>;
  }
}

const desktopPlacements: Record<Placement, ZoneConfig> = {
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
  "watch-outstream": {
    zoneId: process.env.NEXT_PUBLIC_EXOCLICK_OUTSTREAM_ZONE_ID,
    className: process.env.NEXT_PUBLIC_EXOCLICK_OUTSTREAM_CLASS,
    format: "outstream",
  },
  "desktop-sticky": {
    zoneId: process.env.NEXT_PUBLIC_EXOCLICK_STICKY_ZONE_ID,
    className: process.env.NEXT_PUBLIC_EXOCLICK_STICKY_CLASS,
    format: "overlay",
  },
  "catalog-instant": {
    zoneId: process.env.NEXT_PUBLIC_EXOCLICK_INSTANT_ZONE_ID,
    className: process.env.NEXT_PUBLIC_EXOCLICK_INSTANT_CLASS,
    format: "overlay",
  },
  "watch-slider": {
    zoneId: process.env.NEXT_PUBLIC_EXOCLICK_VIDEO_SLIDER_ZONE_ID,
    className: process.env.NEXT_PUBLIC_EXOCLICK_VIDEO_SLIDER_CLASS,
    format: "overlay",
  },
  fullpage: {
    zoneId: process.env.NEXT_PUBLIC_EXOCLICK_DESKTOP_FPI_ZONE_ID,
    className: process.env.NEXT_PUBLIC_EXOCLICK_DESKTOP_FPI_CLASS,
    format: "overlay",
    provider: "https://a.pemsrv.com/ad-provider.js",
  },
};

const mobilePlacements: Partial<Record<Placement, ZoneConfig>> = {
  "catalog-top": {
    zoneId: process.env.NEXT_PUBLIC_EXOCLICK_CATALOG_MOBILE_ZONE_ID,
    className: process.env.NEXT_PUBLIC_EXOCLICK_CATALOG_MOBILE_CLASS,
    format: "leaderboard",
  },
  "below-player": {
    zoneId: process.env.NEXT_PUBLIC_EXOCLICK_PLAYER_MOBILE_ZONE_ID,
    className: process.env.NEXT_PUBLIC_EXOCLICK_PLAYER_MOBILE_CLASS,
    format: "leaderboard",
  },
  "catalog-instant": {
    zoneId: process.env.NEXT_PUBLIC_EXOCLICK_MOBILE_INSTANT_ZONE_ID,
    className: process.env.NEXT_PUBLIC_EXOCLICK_MOBILE_INSTANT_CLASS,
    format: "overlay",
  },
  fullpage: {
    zoneId: process.env.NEXT_PUBLIC_EXOCLICK_MOBILE_FPI_ZONE_ID,
    className: process.env.NEXT_PUBLIC_EXOCLICK_MOBILE_FPI_CLASS,
    format: "overlay",
    provider: "https://a.pemsrv.com/ad-provider.js",
  },
};

const adsEnabled = process.env.NEXT_PUBLIC_ADS_ENABLED === "true";
const blockedAdTypes = process.env.NEXT_PUBLIC_EXOCLICK_BLOCK_AD_TYPES?.trim();

function validZone(config: { zoneId?: string; className?: string }) {
  return Boolean(config.zoneId && /^\d+$/.test(config.zoneId) && config.className && /^[a-z][a-z0-9_-]+$/i.test(config.className));
}

function serveAd() {
  window.AdProvider = window.AdProvider || [];
  window.AdProvider.push({ serve: {} });
}

const scheduledProviders = new Map<string, number>();

function scheduleServe(provider: string) {
  if (scheduledProviders.has(provider)) return;
  const frame = window.requestAnimationFrame(() => {
    scheduledProviders.delete(provider);
    serveAd();
  });
  scheduledProviders.set(provider, frame);
}

function loadProvider(provider: string, onReady: () => void, onError: () => void) {
  const existing = [...document.querySelectorAll<HTMLScriptElement>("script[data-actrexx-ad-provider]")]
    .find((script) => script.src === provider);
  if (existing) {
    if (existing.dataset.ready === "true") onReady();
    else if (existing.dataset.failed === "true") onError();
    else {
      existing.addEventListener("load", onReady, { once: true });
      existing.addEventListener("error", onError, { once: true });
    }
    return;
  }

  const script = document.createElement("script");
  script.async = true;
  script.type = "application/javascript";
  script.src = provider;
  script.dataset.actrexxAdProvider = provider.includes("pemsrv") ? "pemsrv" : "magsrv";
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [device, setDevice] = useState<Device | null>(null);
  const [routeKey, setRouteKey] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState(false);
  const isMobile = device === "mobile";
  const config = device ? ((isMobile && mobilePlacements[placement]) || desktopPlacements[placement]) : null;
  const zoneId = config?.zoneId;
  const className = config?.className;
  const format = config?.format || desktopPlacements[placement].format;
  const provider = config?.provider || "https://a.magsrv.com/ad-provider.js";
  const readyToServe = format === "overlay" || visible;

  useEffect(() => {
    const media = window.matchMedia("(max-width: 820px)");
    const updateDevice = () => setDevice(media.matches ? "mobile" : "desktop");
    updateDevice();
    media.addEventListener("change", updateDevice);
    return () => media.removeEventListener("change", updateDevice);
  }, []);

  useEffect(() => {
    const syncRoute = () => setRouteKey(currentAdRoute());
    syncRoute();
    window.addEventListener(AD_ROUTE_CHANGE_EVENT, syncRoute);
    return () => window.removeEventListener(AD_ROUTE_CHANGE_EVENT, syncRoute);
  }, []);

  useEffect(() => {
    const element = containerRef.current;
    if (format === "overlay") return;
    if (!element || visible) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setVisible(true);
      observer.disconnect();
    }, { rootMargin: "320px 0px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [format, visible]);

  useEffect(() => {
    if (!device || !routeKey || !readyToServe || !adsEnabled || !validZone({ zoneId, className })) return;
    let active = true;
    loadProvider(
      provider,
      () => { if (active) scheduleServe(provider); },
      () => { if (active) setFailed(true); },
    );
    return () => { active = false; };
  }, [className, device, provider, readyToServe, routeKey, zoneId]);

  if (!adsEnabled || (device && !validZone({ zoneId, className })) || failed) return null;

  return (
    <div className={`ad-slot ad-slot-${format}`} data-device={device || "pending"} data-placement={placement} ref={containerRef}>
      {format !== "overlay" && <span>Advertisement</span>}
      {device && routeKey && readyToServe && validZone({ zoneId, className }) && (
        <ins
          key={`${zoneId}:${routeKey}`}
          className={className}
          data-zoneid={zoneId}
          data-block-ad-types={blockedAdTypes || undefined}
        />
      )}
    </div>
  );
}
