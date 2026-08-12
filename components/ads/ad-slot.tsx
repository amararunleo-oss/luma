"use client";

import { useEffect, useRef, useState } from "react";

export type Placement = "catalog-top" | "catalog-footer" | "watch-footer" | "sidebar" | "below-player" | "watch-outstream" | "drawer-compact" | "search-compact" | "desktop-sticky" | "catalog-instant" | "watch-slider" | "fullpage";
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
  "catalog-footer": {
    zoneId: process.env.NEXT_PUBLIC_EXOCLICK_PLAYER_ZONE_ID,
    className: process.env.NEXT_PUBLIC_EXOCLICK_PLAYER_CLASS,
    format: "leaderboard",
  },
  "watch-footer": {
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
  "drawer-compact": {
    format: "compact",
  },
  "search-compact": {
    zoneId: process.env.NEXT_PUBLIC_EXOCLICK_SEARCH_ZONE_ID,
    className: process.env.NEXT_PUBLIC_EXOCLICK_SEARCH_CLASS,
    format: "compact",
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
  "catalog-footer": {
    zoneId: process.env.NEXT_PUBLIC_EXOCLICK_PLAYER_MOBILE_ZONE_ID,
    className: process.env.NEXT_PUBLIC_EXOCLICK_PLAYER_MOBILE_CLASS,
    format: "leaderboard",
  },
  "watch-footer": {
    zoneId: process.env.NEXT_PUBLIC_EXOCLICK_CATALOG_MOBILE_ZONE_ID,
    className: process.env.NEXT_PUBLIC_EXOCLICK_CATALOG_MOBILE_CLASS,
    format: "leaderboard",
  },
  "below-player": {
    zoneId: process.env.NEXT_PUBLIC_EXOCLICK_PLAYER_MOBILE_ZONE_ID,
    className: process.env.NEXT_PUBLIC_EXOCLICK_PLAYER_MOBILE_CLASS,
    format: "leaderboard",
  },
  "drawer-compact": {
    zoneId: process.env.NEXT_PUBLIC_EXOCLICK_DRAWER_MOBILE_ZONE_ID,
    className: process.env.NEXT_PUBLIC_EXOCLICK_DRAWER_MOBILE_CLASS,
    format: "compact",
  },
  "search-compact": {
    zoneId: process.env.NEXT_PUBLIC_EXOCLICK_SEARCH_MOBILE_ZONE_ID,
    className: process.env.NEXT_PUBLIC_EXOCLICK_SEARCH_MOBILE_CLASS,
    format: "compact",
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
const EMPTY_AFTER_MS = 15_000;
const EMPTY_RETRY_DELAY_MS = 15_000;
const PROVIDER_RETRY_MS = 1_500;
const LAZY_ROOT_MARGIN_PX = 320;

function validZone(config: { zoneId?: string; className?: string }) {
  return Boolean(config.zoneId && /^\d+$/.test(config.zoneId) && config.className && /^[a-z][a-z0-9_-]+$/i.test(config.className));
}

function serveAd() {
  window.AdProvider = window.AdProvider || [];
  window.AdProvider.push({ serve: {} });
}

let scheduledServe: number | null = null;

function scheduleServe() {
  if (scheduledServe !== null) return;
  scheduledServe = window.setTimeout(() => {
    window.requestAnimationFrame(() => {
      scheduledServe = null;
      serveAd();
    });
  }, 0);
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

function isNearViewport(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  return rect.top <= window.innerHeight + LAZY_ROOT_MARGIN_PX && rect.bottom >= -LAZY_ROOT_MARGIN_PX;
}

function hasRenderedCreative(host: HTMLElement, zone: HTMLElement, format: string) {
  if (format === "overlay") {
    return zone.dataset.processed === "true" || host.children.length > 1;
  }
  return [...host.querySelectorAll<HTMLElement>("iframe, video")].some((element) => {
    const rect = element.getBoundingClientRect();
    return rect.width > 1 && rect.height > 1;
  }) || [...host.children].some((element) => {
    if (element === zone) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 1 && rect.height > 1;
  });
}

export function AdSlot({ placement, active = true }: { placement: Placement; active?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const zoneHostRef = useRef<HTMLDivElement>(null);
  const [device, setDevice] = useState<Device | null>(null);
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "loaded" | "empty">("idle");
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
    if (isNearViewport(element)) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      setVisible(true);
      observer.disconnect();
    }, { rootMargin: `${LAZY_ROOT_MARGIN_PX}px 0px` });
    observer.observe(element);
    const activateIfNear = () => {
      if (!isNearViewport(element)) return;
      setVisible(true);
      observer.disconnect();
    };
    window.addEventListener("scroll", activateIfNear, { passive: true });
    window.addEventListener("resize", activateIfNear, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", activateIfNear);
      window.removeEventListener("resize", activateIfNear);
    };
  }, [active, device, format, visible]);

  useEffect(() => {
    const host = zoneHostRef.current;
    if (!host || !active || !device || !readyToServe || !adsEnabled || !validZone({ zoneId, className })) return;
    let alive = true;
    let providerRetryTimer: number | undefined;
    let emptyRetryTimer: number | undefined;
    let retryEmptyTimer: number | undefined;
    let providerAttempts = 0;

    setFailed(false);
    setStatus("loading");

    let zone = host.querySelector<HTMLElement>(`ins[data-zoneid="${zoneId}"]`);
    if (!zone) {
      zone = createZone(className!, zoneId!);
      host.replaceChildren(zone);
    }

    const updateStatus = () => {
      if (alive && zone && hasRenderedCreative(host, zone, format)) setStatus("loaded");
    };
    const observer = new MutationObserver(updateStatus);
    observer.observe(host, { attributes: true, childList: true, subtree: true });
    const creativeEvent = `creativeDisplayed-${zoneId}`;
    const creativeDisplayed = () => { if (alive) setStatus("loaded"); };
    if (format === "overlay") document.addEventListener(creativeEvent, creativeDisplayed);

    const connectProvider = () => {
      if (!alive || !zone?.isConnected) return;
      loadProvider(
        provider,
        () => { if (alive && zone?.isConnected) scheduleServe(); },
        () => {
          if (!alive) return;
          if (providerAttempts < 1) {
            providerAttempts += 1;
            providerRetryTimer = window.setTimeout(connectProvider, PROVIDER_RETRY_MS);
          } else {
            setFailed(true);
          }
        },
      );
    };

    connectProvider();
    updateStatus();
    const emptyTimer = format === "overlay" ? undefined : window.setTimeout(() => {
      if (!alive || !zone) return;
      if (hasRenderedCreative(host, zone, format)) {
        setStatus("loaded");
        return;
      }
      setStatus("empty");
      emptyRetryTimer = window.setTimeout(() => {
        const container = containerRef.current;
        if (!alive || !zone || !container || document.visibilityState !== "visible" || !isNearViewport(container)) return;
        if (hasRenderedCreative(host, zone, format)) {
          setStatus("loaded");
          return;
        }
        zone = createZone(className!, zoneId!);
        host.replaceChildren(zone);
        setStatus("loading");
        scheduleServe();
        retryEmptyTimer = window.setTimeout(() => {
          if (alive && zone) setStatus(hasRenderedCreative(host, zone, format) ? "loaded" : "empty");
        }, EMPTY_AFTER_MS);
      }, EMPTY_RETRY_DELAY_MS);
    }, EMPTY_AFTER_MS);

    return () => {
      alive = false;
      if (emptyTimer !== undefined) window.clearTimeout(emptyTimer);
      if (emptyRetryTimer !== undefined) window.clearTimeout(emptyRetryTimer);
      if (retryEmptyTimer !== undefined) window.clearTimeout(retryEmptyTimer);
      if (providerRetryTimer !== undefined) window.clearTimeout(providerRetryTimer);
      if (format === "overlay") document.removeEventListener(creativeEvent, creativeDisplayed);
      observer.disconnect();
    };
  }, [active, className, device, format, provider, readyToServe, zoneId]);

  if (!adsEnabled || !device || failed || !validZone({ zoneId, className })) return null;

  return (
    <div className={`ad-slot ad-slot-${format}`} data-active={active} data-device={device} data-placement={placement} data-state={failed ? "failed" : status} ref={containerRef}>
      {format !== "overlay" && <span>Advertisement</span>}
      <div className="ad-zone-host" ref={zoneHostRef} />
    </div>
  );
}
