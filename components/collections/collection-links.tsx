import { ArrowUpRight, Layers3 } from "lucide-react";
import Link from "@/components/navigation/revenue-link";
import { COLLECTIONS } from "@/lib/collections";

export function CollectionLinks({ compact = false }: { compact?: boolean }) {
  const collections = compact ? COLLECTIONS.slice(0, 6) : COLLECTIONS;
  return (
    <section className={`collection-links${compact ? " compact" : ""}`} aria-labelledby={compact ? "featured-collections-title" : "collections-title"}>
      {compact && (
        <header>
          <div><Layers3 size={15} aria-hidden="true" /><h2 id="featured-collections-title">Featured collections</h2></div>
          <Link href="/collections">View all<ArrowUpRight size={13} aria-hidden="true" /></Link>
        </header>
      )}
      <div className="collection-link-grid">
        {collections.map((collection) => (
          <Link href={`/collections/${collection.slug}`} key={collection.slug}>
            <span>{collection.eyebrow}</span>
            <strong>{collection.shortTitle}</strong>
            <small>{collection.description}</small>
            <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
        ))}
      </div>
    </section>
  );
}
