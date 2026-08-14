"use client";

import { ChevronDown, Film, PlaySquare, Tv, UserRound } from "lucide-react";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import Link from "@/components/navigation/revenue-link";
import { NAVIGATION_GROUPS, type NavigationIcon } from "@/lib/navigation";

const icons = {
  celebrity: UserRound,
  movie: Film,
  tv: Tv,
  adult: PlaySquare,
} satisfies Record<NavigationIcon, typeof UserRound>;

function groupForPath(pathname: string) {
  if (pathname.startsWith("/porn-")) return "adult";
  if (pathname.startsWith("/movie")) return "movies";
  if (pathname.startsWith("/tv-show")) return "tv";
  if (pathname.startsWith("/actress") || pathname.startsWith("/latest") || pathname.startsWith("/most-popular") || pathname.startsWith("/top-rated")) return "celebrity";
  return NAVIGATION_GROUPS.find((group) => group.links.some((link) => link.href.split("?")[0] === pathname))?.id ?? "celebrity";
}

export function CatalogNavigation({ variant = "sidebar", onNavigate }: { variant?: "sidebar" | "drawer"; onNavigate?: () => void }) {
  const pathname = usePathname();
  const selectedGroup = useMemo(() => groupForPath(pathname), [pathname]);
  const [openGroup, setOpenGroup] = useState(selectedGroup);

  return (
    <nav className={`catalog-navigation catalog-navigation-${variant}`} aria-label="Video libraries">
      {NAVIGATION_GROUPS.map((group) => {
        const Icon = icons[group.icon];
        const expanded = openGroup === group.id;
        const active = group.id === selectedGroup;
        return (
          <section className={`${expanded ? "open" : ""}${active ? " active" : ""}`} key={group.id}>
            <button type="button" aria-expanded={expanded} aria-controls={`navigation-${variant}-${group.id}`} onClick={() => setOpenGroup(expanded ? "" : group.id)}>
              <span className="catalog-navigation-icon"><Icon size={variant === "drawer" ? 17 : 15} aria-hidden="true" /></span>
              <span className="catalog-navigation-copy"><strong>{group.label}</strong><small>{group.description}</small></span>
              <ChevronDown className="catalog-navigation-chevron" size={15} aria-hidden="true" />
            </button>
            <div id={`navigation-${variant}-${group.id}`} className="catalog-navigation-links" hidden={!expanded}>
              {group.links.map((link) => {
                const linkPath = link.href.split("?")[0];
                const linkActive = pathname === linkPath;
                return <Link className={linkActive ? "active" : ""} aria-current={linkActive ? "page" : undefined} href={link.href} key={`${group.id}-${link.href}`} onClick={onNavigate}>{link.label}</Link>;
              })}
            </div>
          </section>
        );
      })}
    </nav>
  );
}
