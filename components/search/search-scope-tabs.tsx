import Link from "@/components/navigation/revenue-link";
import { SEARCH_SCOPES, type SearchScope } from "@/lib/search-scope";

function scopeHref(term: string, scope: string) {
  const params = new URLSearchParams();
  if (term) params.set("q", term);
  if (scope !== "all") params.set("scope", scope);
  return params.size ? `/search?${params.toString()}` : "/search";
}

// Server rendered links rather than a client dropdown, so every scope is a real
// crawlable URL and the current scope survives a reload.
export function SearchScopeTabs({ term, scope }: { term: string; scope: SearchScope }) {
  return (
    <nav className="search-scope-tabs" aria-label="Search within">
      <span>Search in</span>
      <div>
        {SEARCH_SCOPES.map((item) => (
          <Link
            className={item.value === scope ? "active" : ""}
            aria-current={item.value === scope ? "page" : undefined}
            href={scopeHref(term, item.value)}
            key={item.value}
            // The results page is noindex, so scope permutations are for people, not
            // for crawl budget.
            rel="nofollow"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
