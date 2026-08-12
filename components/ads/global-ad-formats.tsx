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
  const isCatalog = pathname === "/" || catalogRoute.test(pathname);
  const monetizedRoute = isCatalog || isWatch;

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
      {device === "desktop" && <AdSlot active={monetizedRoute} placement="desktop-sticky" />}
      <AdSlot active={monetizedRoute} placement="catalog-instant" />
      {device === "desktop" && <AdSlot active={isWatch} placement="watch-slider" />}
      {device === "mobile" && <MobilePopunder />}
      {device === "desktop" && <DesktopPopunder />}
      <AdSlot active={monetizedRoute} placement="fullpage" />
    </>
  );
}
