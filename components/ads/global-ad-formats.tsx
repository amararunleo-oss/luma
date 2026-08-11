"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AdSlot } from "./ad-slot";

type Device = "mobile" | "desktop";

const catalogRoute = /^\/(?:latest|most-popular|top-rated|actress|movie|tv-show|tag|year)(?:\/|$)/;
const directoryRoutes = new Set(["/actress", "/movie", "/tv-show"]);

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

  if (!device || !monetizedRoute) return null;

  return (
    <>
      {device === "desktop" && directoryRoutes.has(pathname) && <AdSlot placement="desktop-sticky" />}
      {device === "desktop" && isCatalog && <AdSlot placement="catalog-instant" />}
      {isWatch && <AdSlot placement="watch-slider" />}
      <AdSlot placement="fullpage" />
    </>
  );
}
