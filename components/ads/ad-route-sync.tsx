"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export const AD_ROUTE_CHANGE_EVENT = "actrexx:ad-route-change";

export function currentAdRoute() {
  return `${window.location.pathname}${window.location.search}`;
}

export function AdRouteSync() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;

  useEffect(() => {
    window.dispatchEvent(new CustomEvent(AD_ROUTE_CHANGE_EVENT, { detail: routeKey }));
  }, [routeKey]);

  return null;
}
