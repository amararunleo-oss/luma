"use client";

import { ChevronDown, Menu, PlaySquare, Tags, UserRound, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Link from "@/components/navigation/revenue-link";
import { AdSlot } from "@/components/ads/ad-slot";
import { CatalogNavigation } from "@/components/navigation/catalog-navigation";
import { SITE } from "@/lib/site";

type DrawerEntry = { name: string; slug: string };
type DrawerTaxonomy = { actresses: DrawerEntry[]; tags: DrawerEntry[] };

export function BrowseDrawer() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [taxonomy, setTaxonomy] = useState<DrawerTaxonomy | null>(null);
  const [taxonomyLoading, setTaxonomyLoading] = useState(false);
  const [taxonomyFailed, setTaxonomyFailed] = useState(false);
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const trigger = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  const toggleDrawer = () => {
    const nextOpen = !open;
    if (nextOpen && !taxonomy) {
      setTaxonomyLoading(true);
      setTaxonomyFailed(false);
    }
    setOpen(nextOpen);
  };

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setOpen(false));
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const triggerElement = trigger.current;
    const previousOverflow = document.body.style.overflow;
    const previousRootOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    closeButton.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const drawer = document.getElementById("browse-drawer");
      const focusable = [...(drawer?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? [])];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.documentElement.style.overflow = previousRootOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      triggerElement?.focus({ preventScroll: true });
    };
  }, [open]);

  useEffect(() => {
    if (!open || taxonomy) return;
    const controller = new AbortController();
    fetch("/api/navigation", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Navigation data unavailable");
        return response.json() as Promise<DrawerTaxonomy>;
      })
      .then((data) => setTaxonomy(data))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setTaxonomyFailed(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setTaxonomyLoading(false);
      });
    return () => controller.abort();
  }, [open, taxonomy]);

  const drawer = (
    <div className={`drawer-layer${open ? " open" : ""}`} aria-hidden={!open}>
      <button className="drawer-backdrop" type="button" aria-label="Close browse menu" tabIndex={open ? 0 : -1} onClick={() => setOpen(false)} />
      <aside id="browse-drawer" className="browse-drawer" role="dialog" aria-modal="true" aria-label={`Browse ${SITE.name}`}>
        <header><div><PlaySquare size={18} aria-hidden="true" /><span>Explore {SITE.name}</span></div><button ref={closeButton} type="button" aria-label="Close browse menu" onClick={() => setOpen(false)}><X size={18} aria-hidden="true" /></button></header>
        <nav aria-label="Browse sections">
          <CatalogNavigation variant="drawer" onNavigate={() => setOpen(false)} />
          <div className="drawer-taxonomy">
            <details>
              <summary><span><UserRound size={15} aria-hidden="true" />Popular celebrities</span><ChevronDown size={15} aria-hidden="true" /></summary>
              <div className="drawer-taxonomy-links">
                {taxonomyLoading && <p className="drawer-taxonomy-status">Loading celebrities…</p>}
                {taxonomy?.actresses.map((item) => <Link href={`/actress/${item.slug}`} key={item.slug} onClick={() => setOpen(false)}>{item.name}</Link>)}
                {taxonomyFailed && <p className="drawer-taxonomy-status">Celebrities are temporarily unavailable.</p>}
                <Link className="drawer-view-all" href="/actress" onClick={() => setOpen(false)}>View all celebrities</Link>
              </div>
            </details>
            <details>
              <summary><span><Tags size={15} aria-hidden="true" />Popular tags</span><ChevronDown size={15} aria-hidden="true" /></summary>
              <div className="drawer-tag-links">
                {taxonomyLoading && <p className="drawer-taxonomy-status">Loading tags…</p>}
                {taxonomy?.tags.map((item) => <Link href={`/tag/${item.slug}`} key={item.slug} onClick={() => setOpen(false)}>#{item.name}</Link>)}
                {taxonomyFailed && <p className="drawer-taxonomy-status">Tags are temporarily unavailable.</p>}
              </div>
            </details>
          </div>
        </nav>
        <div className="drawer-ad"><AdSlot active={open} placement="drawer-compact" /></div>
        <footer><Tags size={15} aria-hidden="true" /><p>Celebrity entertainment and adult videos are organized as separate libraries.</p></footer>
      </aside>
    </div>
  );

  return (
    <>
      <button ref={trigger} className="browse-trigger" type="button" aria-label="Open browse menu" aria-expanded={open} aria-controls="browse-drawer" onClick={toggleDrawer}>
        <Menu size={19} aria-hidden="true" /><span>Browse</span>
      </button>
      {mounted && createPortal(drawer, document.body)}
    </>
  );
}
