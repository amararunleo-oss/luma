"use client";

import { SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { SelectMenu, type SelectMenuOption } from "@/components/ui/select-menu";
import type { CatalogFilterValues } from "@/lib/catalog/filters";

const currentYear = new Date().getFullYear() + 1;
const years = Array.from({ length: currentYear - 1939 }, (_, index) => currentYear - index);
const typeOptions: SelectMenuOption[] = [{ value: "", label: "All types" }, { value: "movie", label: "Movies" }, { value: "tv-show", label: "TV shows" }];
const yearOptions: SelectMenuOption[] = [{ value: "", label: "Any year" }, ...years.map((year) => ({ value: String(year), label: String(year) }))];
const durationOptions: SelectMenuOption[] = [{ value: "", label: "Any length" }, { value: "short", label: "Under 5 min" }, { value: "medium", label: "5–15 min" }, { value: "long", label: "15+ min" }];
const ratingOptions: SelectMenuOption[] = [{ value: "", label: "Any rating" }, { value: "90", label: "90%+" }, { value: "80", label: "80%+" }, { value: "70", label: "70%+" }, { value: "60", label: "60%+" }, { value: "50", label: "50%+" }];
const orderOptions: SelectMenuOption[] = [{ value: "", label: "Page default" }, { value: "latest", label: "Newest" }, { value: "popular", label: "Popular" }, { value: "rating", label: "Top rating" }, { value: "oldest", label: "Oldest" }];

export function CatalogFilters({ basePath, values, hideType = false, hideYear = false }: { basePath: string; values: CatalogFilterValues; hideType?: boolean; hideYear?: boolean }) {
  const active = Boolean(values.type || values.year || values.duration || values.minRating || values.order);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);

  function applyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const query = new URLSearchParams();
    for (const name of ["type", "year", "duration", "rating", "order"]) {
      const value = String(form.get(name) ?? "").trim();
      if (value) query.set(name, value);
    }
    setOpen(false);
    const search = query.toString();
    startTransition(() => router.push(search ? `${basePath}?${search}` : basePath));
  }

  useEffect(() => {
    if (!open) return;
    const triggerElement = trigger.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", close);
      triggerElement?.focus({ preventScroll: true });
    };
  }, [open]);

  return (
    <div className={`filter-shell${open ? " open" : ""}`}>
      <button ref={trigger} className="mobile-filter-trigger" type="button" aria-expanded={open} aria-controls="catalog-filter-form" onClick={() => setOpen(true)}><SlidersHorizontal size={15} aria-hidden="true" />{values.year ? `${values.year} · Filters` : "Refine results"}</button>
      <button className="mobile-filter-backdrop" type="button" aria-label="Close filters" tabIndex={open ? 0 : -1} onClick={() => setOpen(false)} />
      <form id="catalog-filter-form" className="catalog-filters" action={basePath} method="get" aria-busy={pending} onSubmit={applyFilters}>
        <div className="filter-mobile-heading"><strong>Refine results</strong><button type="button" aria-label="Close filters" onClick={() => setOpen(false)}><X size={17} aria-hidden="true" /></button></div>
        <div className="filter-title"><SlidersHorizontal size={15} aria-hidden="true" /><span>Refine</span></div>
        {!hideType && <label htmlFor="filter-type"><span>Type</span><SelectMenu key={`type-${values.type ?? "all"}`} id="filter-type" name="type" ariaLabel="Filter by content type" defaultValue={values.type === "Movie" ? "movie" : values.type === "TV Show" ? "tv-show" : ""} options={typeOptions} /></label>}
        {!hideYear && <label htmlFor="filter-year"><span>Year</span><SelectMenu key={`year-${values.year ?? "all"}`} id="filter-year" name="year" ariaLabel="Filter by release year" defaultValue={values.year ? String(values.year) : ""} options={yearOptions} /></label>}
        <label htmlFor="filter-duration"><span>Duration</span><SelectMenu key={`duration-${values.duration ?? "all"}`} id="filter-duration" name="duration" ariaLabel="Filter by duration" defaultValue={values.duration ?? ""} options={durationOptions} /></label>
        <label htmlFor="filter-rating"><span>Rating</span><SelectMenu key={`rating-${values.minRating ?? "all"}`} id="filter-rating" name="rating" ariaLabel="Filter by minimum rating" defaultValue={values.minRating ? String(values.minRating) : ""} options={ratingOptions} /></label>
        <label htmlFor="filter-order"><span>Sort</span><SelectMenu key={`order-${values.order ?? "default"}`} id="filter-order" name="order" ariaLabel="Sort results" defaultValue={values.order ?? ""} options={orderOptions} /></label>
        <button type="submit" disabled={pending}>{pending ? "Applying…" : "Apply filters"}</button>
        {active && <Link className="filter-clear" href={basePath} aria-label="Clear filters"><X size={14} aria-hidden="true" />Clear</Link>}
      </form>
    </div>
  );
}
