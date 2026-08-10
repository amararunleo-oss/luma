"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AlertCircle, Film, LoaderCircle, Play, Search, Tv, UserRound, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { SearchSuggestion, SearchSuggestions } from "@/lib/catalog/repository";

const groupDetails = {
  videos: { label: "Videos", icon: Play },
  actresses: { label: "Actresses", icon: UserRound },
  movies: { label: "Movies", icon: Film },
  tvShows: { label: "TV Shows", icon: Tv },
} as const;

export function LiveSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const mobileTrigger = useRef<HTMLButtonElement>(null);
  const abortRequest = useRef<AbortController | null>(null);
  const requestSequence = useRef(0);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchSuggestions | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [requestError, setRequestError] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const groups = useMemo(() => results ? (["videos", "actresses", "movies", "tvShows"] as const)
    .map((key) => ({ key, items: results[key] }))
    .filter((group) => group.items.length > 0) : [], [results]);
  const flatResults = useMemo(() => groups.flatMap((group) => group.items), [groups]);
  const hasResults = flatResults.length > 0;

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if ((event.key === "/" && !isTyping) || ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k")) {
        event.preventDefault();
        input.current?.focus();
      }
    };
    document.addEventListener("keydown", focusSearch);
    return () => document.removeEventListener("keydown", focusSearch);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) return;
    const timer = window.setTimeout(async () => {
      abortRequest.current?.abort();
      const controller = new AbortController();
      const sequence = ++requestSequence.current;
      abortRequest.current = controller;
      setLoading(true);
      setRequestError(false);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Search request failed");
        const payload = await response.json() as SearchSuggestions;
        if (sequence !== requestSequence.current) return;
        setResults(payload);
        setOpen(true);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) { setResults(null); setRequestError(true); }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 280);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) {
        setOpen(false);
        setMobileSearchOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setOpen(false);
      setMobileSearchOpen(false);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  function clear() {
    abortRequest.current?.abort();
    requestSequence.current += 1;
    setQuery("");
    setResults(null);
    setOpen(false);
    setLoading(false);
    setActiveIndex(-1);
    setRequestError(false);
    input.current?.focus();
  }

  function onChange(value: string) {
    setQuery(value);
    setActiveIndex(-1);
    setRequestError(false);
    if (value.trim().length < 2) {
      abortRequest.current?.abort();
      requestSequence.current += 1;
      setResults(null);
      setLoading(false);
      setOpen(false);
    } else {
      setOpen(true);
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      setMobileSearchOpen(false);
      setActiveIndex(-1);
      mobileTrigger.current?.focus({ preventScroll: true });
      return;
    }
    if (!open || flatResults.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % flatResults.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => current <= 0 ? flatResults.length - 1 : current - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(flatResults.length - 1);
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      setOpen(false);
      router.push(flatResults[activeIndex].href);
    }
  }

  let resultIndex = -1;
  return (
    <div className={`live-search${mobileSearchOpen ? " mobile-open" : ""}`} ref={root}>
      <button
        ref={mobileTrigger}
        className="mobile-search-trigger"
        type="button"
        aria-label={mobileSearchOpen ? "Close search" : "Open search"}
        aria-expanded={mobileSearchOpen}
        aria-controls="header-search-form"
        onClick={() => {
          setMobileSearchOpen((current) => !current);
          if (!mobileSearchOpen) window.requestAnimationFrame(() => input.current?.focus());
        }}
      ><Search size={18} aria-hidden="true" /></button>
      <form id="header-search-form" className="header-search" action="/search" role="search">
        <label className="sr-only" htmlFor="site-search">Search videos, actresses, movies and TV shows</label>
        <Search size={16} aria-hidden="true" />
        <input
          ref={input}
          id="site-search"
          name="q"
          type="search"
          value={query}
          placeholder="Search scenes, actresses, movies"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="search"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls="live-search-results"
          aria-busy={loading}
          aria-activedescendant={activeIndex >= 0 ? flatResults[activeIndex]?.id : undefined}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => query.trim().length >= 2 && setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {loading && <LoaderCircle className="search-spinner" size={15} aria-label="Searching" />}
        {!loading && query && <button type="button" aria-label="Clear search" onClick={clear}><X size={15} aria-hidden="true" /></button>}
      </form>
      {open && query.trim().length >= 2 && (
        <div className="search-popover" id="live-search-results" role="listbox" aria-label="Search suggestions">
          {groups.map((group) => {
            const details = groupDetails[group.key];
            const Icon = details.icon;
            return (
              <section className="search-group" key={group.key} aria-labelledby={`search-group-${group.key}`}>
                <h2 id={`search-group-${group.key}`}><Icon size={13} aria-hidden="true" />{details.label}</h2>
                {group.items.map((item) => {
                  resultIndex += 1;
                  const index = resultIndex;
                  return <SearchResult item={item} active={index === activeIndex} close={() => setOpen(false)} key={item.id} />;
                })}
              </section>
            );
          })}
          {!loading && requestError && <div className="search-empty search-failed"><AlertCircle size={18} aria-hidden="true" /><strong>Search is temporarily unavailable</strong><span>Wait a moment and try again.</span></div>}
          {!loading && !requestError && !hasResults && <div className="search-empty"><strong>No matches found</strong><span>Try a different actress, movie or TV show.</span></div>}
          <Link className="search-view-all" href={`/search?q=${encodeURIComponent(query.trim())}`} onClick={() => setOpen(false)}>View all results</Link>
        </div>
      )}
    </div>
  );
}

function SearchResult({ item, active, close }: { item: SearchSuggestion; active: boolean; close: () => void }) {
  return (
    <Link id={item.id} className={`search-result${active ? " active" : ""}`} role="option" aria-selected={active} href={item.href} onClick={close}>
      {item.image
        ? <Image src={item.image} alt="" width={76} height={43} sizes="76px" unoptimized />
        : <span className="search-result-icon" aria-hidden="true">{item.label.slice(0, 1).toUpperCase()}</span>}
      <span><strong>{item.label}</strong><small>{item.meta}</small></span>
    </Link>
  );
}
