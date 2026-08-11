import Link from "@/components/navigation/revenue-link";
import { Film, Tv, UserRound } from "lucide-react";
import type { SearchSuggestions } from "@/lib/catalog/repository";

export function SearchDiscovery({ results }: { results: SearchSuggestions }) {
  const groups = [
    { key: "actresses", label: "Actresses", icon: UserRound, items: results.actresses },
    { key: "movies", label: "Movies", icon: Film, items: results.movies },
    { key: "tvShows", label: "TV Shows", icon: Tv, items: results.tvShows },
  ].filter((group) => group.items.length > 0);
  if (groups.length === 0) return null;
  return (
    <section className="search-discovery" aria-labelledby="search-discovery-title">
      <h2 id="search-discovery-title">Explore matches</h2>
      <div className="search-discovery-grid">
        {groups.map((group) => {
          const Icon = group.icon;
          return (
            <section key={group.key}>
              <h3><Icon size={14} aria-hidden="true" />{group.label}</h3>
              <div>{group.items.map((item) => <Link href={item.href} key={item.id}><span>{item.label}</span></Link>)}</div>
            </section>
          );
        })}
      </div>
    </section>
  );
}
