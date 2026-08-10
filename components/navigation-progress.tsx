"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type ProgressPhase = "idle" | "loading" | "complete";

export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;
  const previousRoute = useRef(routeKey);
  const navigationPending = useRef(false);
  const hideTimer = useRef<number | null>(null);
  const safetyTimer = useRef<number | null>(null);
  const [phase, setPhase] = useState<ProgressPhase>("idle");

  const clearTimers = useCallback(() => {
    if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    if (safetyTimer.current !== null) window.clearTimeout(safetyTimer.current);
    hideTimer.current = null;
    safetyTimer.current = null;
  }, []);

  const finish = useCallback(() => {
    clearTimers();
    navigationPending.current = false;
    setPhase("complete");
    hideTimer.current = window.setTimeout(() => setPhase("idle"), 240);
  }, [clearTimers]);

  const start = useCallback(() => {
    clearTimers();
    navigationPending.current = true;
    setPhase("loading");
    safetyTimer.current = window.setTimeout(finish, 10_000);
  }, [clearTimers, finish]);

  useEffect(() => {
    if (previousRoute.current === routeKey) return;
    previousRoute.current = routeKey;
    if (navigationPending.current) finish();
  }, [finish, routeKey]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!target || target.target === "_blank" || target.hasAttribute("download") || target.dataset.noProgress !== undefined) return;
      const destination = new URL(target.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      const current = window.location;
      if (destination.pathname === current.pathname && destination.search === current.search) return;
      start();
    };

    const onSubmit = (event: SubmitEvent) => {
      if (event.defaultPrevented || !(event.target instanceof HTMLFormElement) || event.target.target === "_blank") return;
      const destination = new URL(event.target.action || window.location.href, window.location.href);
      if (destination.origin === window.location.origin) start();
    };

    const onPopState = () => start();
    const onPageShow = (event: PageTransitionEvent) => { if (event.persisted) finish(); };

    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    window.addEventListener("popstate", onPopState);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("pageshow", onPageShow);
      clearTimers();
    };
  }, [clearTimers, finish, start]);

  return <div className={`navigation-progress ${phase}`} aria-hidden="true"><span /></div>;
}
