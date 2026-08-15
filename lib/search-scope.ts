// Search scopes are shared by the header suggestion dropdown and the search page,
// so both narrow results the same way. Kept free of repository imports to avoid a
// cycle: the repository imports SearchScope from here.

export type SearchSuggestionKind = "movie" | "tv_show" | "adult";

export type SearchScopeDefinition = {
  value: string;
  label: string;
  /** Catalog and type narrowing applied to the results grid. */
  query: { catalog?: "celebrity" | "porn"; type?: "Movie" | "TV Show" };
  /** Suggestion kinds this scope keeps. Empty means every kind. */
  kinds: readonly SearchSuggestionKind[];
  /** Suggestion groups this scope keeps. */
  groups: readonly ("videos" | "actresses" | "movies" | "tvShows" | "categories")[];
};

export const SEARCH_SCOPES = [
  {
    value: "all",
    label: "All",
    query: {},
    kinds: [],
    groups: ["videos", "actresses", "movies", "tvShows", "categories"],
  },
  {
    value: "celebrity",
    label: "Celebrity videos",
    query: { catalog: "celebrity" },
    kinds: ["movie", "tv_show"],
    groups: ["videos", "actresses", "movies", "tvShows"],
  },
  {
    value: "movies",
    label: "Movies",
    query: { catalog: "celebrity", type: "Movie" },
    kinds: ["movie"],
    groups: ["videos", "movies", "actresses"],
  },
  {
    value: "tv-shows",
    label: "TV shows",
    query: { catalog: "celebrity", type: "TV Show" },
    kinds: ["tv_show"],
    groups: ["videos", "tvShows", "actresses"],
  },
  {
    value: "porn",
    label: "Porn videos",
    query: { catalog: "porn" },
    kinds: ["adult"],
    groups: ["videos", "categories"],
  },
] as const satisfies readonly SearchScopeDefinition[];

export type SearchScope = typeof SEARCH_SCOPES[number]["value"];

export const DEFAULT_SEARCH_SCOPE: SearchScope = "all";

export function parseSearchScope(value: string | string[] | undefined): SearchScope {
  const raw = (Array.isArray(value) ? value[0] : value)?.trim().toLowerCase();
  return SEARCH_SCOPES.find((scope) => scope.value === raw)?.value ?? DEFAULT_SEARCH_SCOPE;
}

// Returns the widened definition. Without the annotation the `as const` literals
// narrow `kinds`, `groups` and `query` to single-member tuples, which callers cannot
// use for membership checks.
export function searchScope(value: string | string[] | undefined): SearchScopeDefinition {
  const parsed = parseSearchScope(value);
  return SEARCH_SCOPES.find((scope) => scope.value === parsed) ?? SEARCH_SCOPES[0];
}

export function searchScopeOptions() {
  return SEARCH_SCOPES.map((scope) => ({ value: scope.value, label: scope.label }));
}
