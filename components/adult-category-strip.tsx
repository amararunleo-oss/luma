import { ArrowUpRight } from "lucide-react";
import Link from "@/components/navigation/revenue-link";
import { ADULT_CATEGORIES } from "@/lib/adult-taxonomy";

export function AdultCategoryStrip({ activeSlug }: { activeSlug?: string }) {
  return (
    <nav className="adult-category-strip" aria-label="Adult video categories">
      <div className="adult-category-strip-heading">
        <strong>Explore categories</strong>
        <Link href="/porn-categories">All categories<ArrowUpRight size={12} aria-hidden="true" /></Link>
      </div>
      <div>
        {ADULT_CATEGORIES.map((category) => (
          <Link className={category.slug === activeSlug ? "active" : ""} aria-current={category.slug === activeSlug ? "page" : undefined} href={`/porn-category/${category.slug}`} key={category.slug}>{category.shortName}</Link>
        ))}
      </div>
    </nav>
  );
}
