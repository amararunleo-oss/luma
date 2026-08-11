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
const zoneId = process.env.NEXT_PUBLIC_EXOCLICK_MOBILE_POPUNDER_ZONE_ID?.trim();
const frequencyPeriod = Number(process.env.NEXT_PUBLIC_EXOCLICK_MOBILE_POPUNDER_FREQUENCY_PERIOD || "30");
const frequencyCount = Number(process.env.NEXT_PUBLIC_EXOCLICK_MOBILE_POPUNDER_FREQUENCY_COUNT || "3");

export function MobilePopunder() {
  useEffect(() => {
    if (!adsEnabled || !zoneId || !/^\d+$/.test(zoneId) || !window.matchMedia("(max-width: 820px)").matches) return;
    if (document.getElementById("actrexx-mobile-popunder")) return;

    window.ad_idzone = Number(zoneId);
    window.ad_popup_fallback = false;
    window.ad_popup_force = false;
    window.ad_chrome_enabled = true;
    window.ad_new_tab = false;
    window.ad_frequency_period = Number.isFinite(frequencyPeriod) && frequencyPeriod > 0 ? frequencyPeriod : 30;
    window.ad_frequency_count = Number.isFinite(frequencyCount) && frequencyCount > 0 ? frequencyCount : 3;
    window.ad_trigger_method = 2;
    window.ad_trigger_class = "actrexx-mobile-pop";
    window.ad_trigger_delay = 0;
    window.ad_capping_enabled = true;
    window.ad_tcf_enabled = true;
    window.ad_agego_cross_site_enabled = true;

    const script = document.createElement("script");
    script.id = "actrexx-mobile-popunder";
    script.type = "application/javascript";
    script.async = true;
    script.src = "https://a.pemsrv.com/popunder1000.js";
    document.body.appendChild(script);
  }, []);

  return null;
}
