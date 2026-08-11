"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

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
const SERVE_COOLDOWN_MS = 1_000;
const RETRY_AFTER_MS = 8_000;

function validZone(config: { zoneId?: string; className?: string }) {
  return Boolean(config.zoneId && /^\d+$/.test(config.zoneId) && config.className && /^[a-z][a-z0-9_-]+$/i.test(config.className));
}

function serveAd() {
  window.AdProvider = window.AdProvider || [];
  window.AdProvider.push({ serve: {} });
}

let scheduledServe: number | null = null;
let lastServeAt = 0;

function scheduleServe() {
  if (scheduledServe !== null) return;
  const wait = Math.max(0, SERVE_COOLDOWN_MS - (Date.now() - lastServeAt));
  scheduledServe = window.setTimeout(() => {
    window.requestAnimationFrame(() => {
      scheduledServe = null;
      if (!document.querySelector('ins[data-zoneid]:not([data-processed="true"])')) return;
      lastServeAt = Date.now();
      serveAd();
    });
  }, wait);
}

function loadProvider(provider: string, onReady: () => void, onError: () => void) {
  const existing = [...document.querySelectorAll<HTMLScriptElement>("script[data-actrexx-ad-provider]")]
    .find((script) => script.src === provider);
  if (existing) {
    if (existing.dataset.ready === "true") onReady();
    else if (existing.dataset.failed === "true") existing.remove();
    else {
      existing.addEventListener("load", onReady, { once: true });
      existing.addEventListener("error", onError, { once: true });
      return;
    }
    if (existing.dataset.ready === "true") return;
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

function createZone(className: string, zoneId: string) {
  const zone = document.createElement("ins");
  zone.className = className;
  zone.dataset.zoneid = zoneId;
  if (blockedAdTypes) zone.dataset.blockAdTypes = blockedAdTypes;
  return zone;
}

function providerProcessed(host: HTMLElement, zone: HTMLElement) {
  return zone.dataset.processed === "true" || !zone.isConnected || zone.childNodes.length > 0 || host.childNodes.length > 1;
}

export function AdSlot({ placement, active = true }: { placement: Placement; active?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const zoneHostRef = useRef<HTMLDivElement>(null);
  const servedOverlayZoneRef = useRef<string | null>(null);
  const [device, setDevice] = useState<Device | null>(null);
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "loaded" | "empty">("idle");
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;
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
    const element = containerRef.current;
    if (!active || format === "overlay") return;
    if (!element || visible) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setVisible(true);
      observer.disconnect();
    }, { rootMargin: "320px 0px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [active, format, visible]);

  useEffect(() => {
    const host = zoneHostRef.current;
    if (!host || !active || !device || !readyToServe || !adsEnabled || !validZone({ zoneId, className })) return;
    if (format === "overlay" && servedOverlayZoneRef.current === zoneId) return;
    let alive = true;
    let retryTimer: number | undefined;
    let emptyTimer: number | undefined;
    let observer: MutationObserver | undefined;

    setFailed(false);
    setStatus("loading");

    const mountZone = (retry = false) => {
      if (!alive || !className || !zoneId) return;
      observer?.disconnect();
      const zone = createZone(className, zoneId);
      host.replaceChildren(zone);
      if (format === "overlay") servedOverlayZoneRef.current = zoneId;
      observer = new MutationObserver(() => {
        if (alive && providerProcessed(host, zone)) setStatus("loaded");
      });
      observer.observe(host, { childList: true, subtree: true });
      loadProvider(
        provider,
        () => { if (alive && zone.isConnected) scheduleServe(); },
        () => {
          if (!alive) return;
          if (format === "overlay") servedOverlayZoneRef.current = null;
          setFailed(true);
        },
      );

      if (!retry) {
        retryTimer = window.setTimeout(() => {
          if (alive && !providerProcessed(host, zone)) mountZone(true);
        }, RETRY_AFTER_MS);
      } else {
        emptyTimer = window.setTimeout(() => {
          if (alive && !providerProcessed(host, zone)) setStatus("empty");
        }, RETRY_AFTER_MS);
      }
    };

    // Let the route commit finish before handing this DOM subtree to ExoClick.
    const mountTimer = window.setTimeout(() => mountZone(), 0);
    return () => {
      alive = false;
      window.clearTimeout(mountTimer);
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      if (emptyTimer !== undefined) window.clearTimeout(emptyTimer);
      observer?.disconnect();
    };
  }, [active, className, device, format, provider, readyToServe, routeKey, zoneId]);

  if (!adsEnabled || (device && !validZone({ zoneId, className }))) return null;

  return (
    <div className={`ad-slot ad-slot-${format}`} data-active={active} data-device={device || "pending"} data-placement={placement} data-state={failed ? "failed" : status} ref={containerRef}>
      {format !== "overlay" && <span>Advertisement</span>}
      <div className="ad-zone-host" ref={zoneHostRef} />
    </div>
  );
}
