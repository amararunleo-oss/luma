"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AdSlot } from "./ad-slot";
import { MobilePopunder } from "./mobile-popunder";
import { DesktopPopunder } from "./desktop-popunder";

type Device = "mobile" | "desktop";

const catalogRoute = /^\/(?:latest|most-popular|top-rated|actress|movie|tv-show|tag|year)(?:\/|$)/;

export function GlobalAdFormats() {
  const pathname = usePathname();
  const [device, setDevice] = useState<Device | null>(null);
  const isWatch = pathname.startsWith("/watch/");
  const isReels = pathname === "/reels";
  const isCatalog = pathname === "/" || catalogRoute.test(pathname);
  const monetizedRoute = isCatalog || isWatch;
  const publicPage = !pathname.startsWith("/admin");
  const instantActive = publicPage && !isReels;
  const fullpageActive = device === "mobile" ? isWatch : monetizedRoute;

  useEffect(() => {
    const media = window.matchMedia("(max-width: 820px)");
    const update = () => setDevice(media.matches ? "mobile" : "desktop");
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const refreshRestoredAds = (event: PageTransitionEvent) => {
      if (event.persisted) window.location.reload();
    };
    window.addEventListener("pageshow", refreshRestoredAds);
    return () => window.removeEventListener("pageshow", refreshRestoredAds);
  }, []);

  if (!device) return null;

  return (
    <>
      {device === "desktop" && <AdSlot active={monetizedRoute} key={`sticky-${pathname}`} placement="desktop-sticky" />}
      {!isReels && <AdSlot active={instantActive} key={`instant-${pathname}`} placement="catalog-instant" />}
      {device === "desktop" && <AdSlot active={isWatch} key={`slider-${pathname}`} placement="watch-slider" />}
      {device === "mobile" && isCatalog && <MobilePopunder />}
      {device === "desktop" && !isReels && <DesktopPopunder />}
      <AdSlot active={fullpageActive} key={`fullpage-${pathname}`} placement="fullpage" />
    </>
  );
}
