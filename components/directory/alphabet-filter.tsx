import Link from "next/link";

const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function filterHref(basePath: string, letter?: string, query?: string) {
  const params = new URLSearchParams();
  if (letter) params.set("letter", letter);
  if (query?.trim()) params.set("q", query.trim());
  return params.size > 0 ? `${basePath}?${params.toString()}` : basePath;
}

export function AlphabetFilter({ basePath, active, query }: { basePath: string; active?: string; query?: string }) {
  return (
    <nav className="alphabet-filter" aria-label="Filter by first letter">
      <Link className={!active ? "active" : ""} href={filterHref(basePath, undefined, query)}>All</Link>
      {letters.map((letter) => (
        <Link className={active === letter ? "active" : ""} href={filterHref(basePath, letter, query)} key={letter}>{letter}</Link>
      ))}
    </nav>
  );
}
