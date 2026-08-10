"use client";

import { Clapperboard, Film, Flame, Menu, Sparkles, Star, Tags, Tv, UserRound, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

const sections = [
  { label: "Latest", description: "New movie and TV scenes", href: "/", icon: Sparkles },
  { label: "Popular", description: "Most watched videos", href: "/most-popular", icon: Flame },
  { label: "Top rated", description: "Highest-rated scenes", href: "/top-rated", icon: Star },
  { label: "Actresses", description: "Browse performers A–Z", href: "/actress", icon: UserRound },
  { label: "Movies", description: "Explore films A–Z", href: "/movie", icon: Film },
  { label: "TV shows", description: "Explore series A–Z", href: "/tv-show", icon: Tv },
] as const;

export function BrowseDrawer() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const trigger = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

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

  const drawer = (
    <div className={`drawer-layer${open ? " open" : ""}`} aria-hidden={!open}>
      <button className="drawer-backdrop" type="button" aria-label="Close browse menu" tabIndex={open ? 0 : -1} onClick={() => setOpen(false)} />
      <aside id="browse-drawer" className="browse-drawer" role="dialog" aria-modal="true" aria-label="Browse Luma">
        <header><div><Clapperboard size={18} aria-hidden="true" /><span>Explore Luma</span></div><button ref={closeButton} type="button" aria-label="Close browse menu" onClick={() => setOpen(false)}><X size={18} aria-hidden="true" /></button></header>
        <nav aria-label="Browse sections">
          {sections.map((item) => {
            const Icon = item.icon;
            return <Link className={pathname === item.href ? "active" : ""} href={item.href} key={item.href} onClick={() => setOpen(false)}><span><Icon size={18} aria-hidden="true" /></span><div><strong>{item.label}</strong><small>{item.description}</small></div></Link>;
          })}
        </nav>
        <footer><Tags size={15} aria-hidden="true" /><p>Search by actress, movie, TV show or scene.</p></footer>
      </aside>
    </div>
  );

  return (
    <>
      <button ref={trigger} className="browse-trigger" type="button" aria-label="Open browse menu" aria-expanded={open} aria-controls="browse-drawer" onClick={() => setOpen((current) => !current)}>
        <Menu size={19} aria-hidden="true" /><span>Browse</span>
      </button>
      {mounted && createPortal(drawer, document.body)}
    </>
  );
}
