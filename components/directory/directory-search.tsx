"use client";

import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

function directoryUrl(basePath: string, letter?: string, query?: string) {
  const params = new URLSearchParams();
  if (letter) params.set("letter", letter);
  if (query?.trim()) params.set("q", query.trim());
  const suffix = params.toString();
  return suffix ? `${basePath}?${suffix}` : basePath;
}

export function DirectorySearch({ basePath, activeLetter, initialQuery = "", label }: {
  basePath: string;
  activeLetter?: string;
  initialQuery?: string;
  label: string;
}) {
  const router = useRouter();
  const initialRender = useRef(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastNavigation = useRef(initialQuery.trim());
  const [query, setQuery] = useState(initialQuery);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }
    if (query.trim().length === 1 || query.trim() === lastNavigation.current) return;
    const timer = window.setTimeout(() => {
      lastNavigation.current = query.trim();
      startTransition(() => router.replace(directoryUrl(basePath, activeLetter, query), { scroll: false }));
    }, 450);
    return () => window.clearTimeout(timer);
  }, [activeLetter, basePath, query, router]);

  useEffect(() => {
    const incoming = initialQuery.trim();
    lastNavigation.current = incoming;
    if (document.activeElement !== inputRef.current) setQuery(incoming);
  }, [initialQuery]);

  function clear() {
    lastNavigation.current = "";
    setQuery("");
    startTransition(() => router.replace(directoryUrl(basePath, activeLetter), { scroll: false }));
  }

  return (
    <form className={`directory-search${pending ? " pending" : ""}`} action={basePath} role="search" onSubmit={(event) => {
      event.preventDefault();
      startTransition(() => router.replace(directoryUrl(basePath, activeLetter, query), { scroll: false }));
    }}>
      {activeLetter && <input type="hidden" name="letter" value={activeLetter} />}
      <Search size={16} aria-hidden="true" />
      <label className="sr-only" htmlFor={`${label}-directory-search`}>Search {label}</label>
      <input ref={inputRef} id={`${label}-directory-search`} name="q" type="search" value={query} placeholder={`Search ${label}`} autoComplete="off" onChange={(event) => setQuery(event.target.value)} />
      {query && <button type="button" aria-label={`Clear ${label} search`} onClick={clear}><X size={15} aria-hidden="true" /></button>}
      <span className="directory-search-progress" aria-hidden="true" />
    </form>
  );
}
