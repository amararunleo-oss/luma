"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    ad_idzone?: number;
    ad_popup_fallback?: boolean;
    ad_popup_force?: boolean;
    ad_chrome_enabled?: boolean;
    ad_new_tab?: boolean;
    ad_frequency_period?: number;
    ad_frequency_count?: number;
    ad_trigger_method?: number;
    ad_trigger_class?: string;
    ad_trigger_delay?: number;
    ad_capping_enabled?: boolean;
    ad_tcf_enabled?: boolean;
    ad_agego_cross_site_enabled?: boolean;
  }
}

const adsEnabled = process.env.NEXT_PUBLIC_ADS_ENABLED === "true";
const zoneId = process.env.NEXT_PUBLIC_EXOCLICK_DESKTOP_POPUNDER_ZONE_ID?.trim();
const frequencyPeriod = Number(process.env.NEXT_PUBLIC_EXOCLICK_DESKTOP_POPUNDER_FREQUENCY_PERIOD || "10");
const frequencyCount = Number(process.env.NEXT_PUBLIC_EXOCLICK_DESKTOP_POPUNDER_FREQUENCY_COUNT || "3");

export function DesktopPopunder() {
  useEffect(() => {
    if (!adsEnabled || !zoneId || !/^\d+$/.test(zoneId)) return;
    const media = window.matchMedia("(min-width: 821px)");
    let alive = true;
    let attempts = 0;
    let retryTimer: number | undefined;

    const load = () => {
      if (!alive || !media.matches) return;
      const existing = document.getElementById("actrexx-desktop-popunder") as HTMLScriptElement | null;
      if (existing?.dataset.ready === "true" || (existing && !existing.dataset.failed)) return;
      existing?.remove();

      window.ad_idzone = Number(zoneId);
      window.ad_popup_fallback = false;
      window.ad_popup_force = false;
      window.ad_chrome_enabled = true;
      window.ad_new_tab = false;
      window.ad_frequency_period = Number.isFinite(frequencyPeriod) && frequencyPeriod > 0 ? frequencyPeriod : 10;
      window.ad_frequency_count = Number.isFinite(frequencyCount) && frequencyCount > 0 ? frequencyCount : 3;
      window.ad_trigger_method = 2;
      window.ad_trigger_class = "actrexx-desktop-pop";
      window.ad_trigger_delay = 0;
      window.ad_capping_enabled = true;
      window.ad_tcf_enabled = true;
      window.ad_agego_cross_site_enabled = true;

      const script = document.createElement("script");
      script.id = "actrexx-desktop-popunder";
      script.type = "application/javascript";
      script.async = true;
      script.src = "https://a.pemsrv.com/popunder1000.js";
      script.addEventListener("load", () => { script.dataset.ready = "true"; }, { once: true });
      script.addEventListener("error", () => {
        script.dataset.failed = "true";
        if (alive && attempts < 1) {
          attempts += 1;
          retryTimer = window.setTimeout(load, 1_500);
        }
      }, { once: true });
      document.body.appendChild(script);
    };

    load();
    media.addEventListener("change", load);
    return () => {
      alive = false;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      media.removeEventListener("change", load);
    };
  }, []);

  return null;
}
