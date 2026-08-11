import type { DirectoryEntry } from "@/lib/catalog/repository";
import { Sidebar } from "@/components/site-chrome";
import { AlphabetFilter } from "./alphabet-filter";
import { DirectorySearch } from "./directory-search";
import { Pagination } from "@/components/catalog";
import Link from "@/components/navigation/revenue-link";
import { AdSlot } from "@/components/ads/ad-slot";

export function EntityDirectory({ title, description, entries, total, page, pageSize, basePath, activeLetter, query, entryPath, searchLabel }: {
  title: string;
  description: string;
  entries: DirectoryEntry[];
  total: number;
  page: number;
  pageSize: number;
  basePath: string;
  activeLetter?: string;
  query?: string;
  entryPath: string;
  searchLabel: string;
}) {
  const filters = new URLSearchParams();
  if (activeLetter) filters.set("letter", activeLetter);
  if (query?.trim()) filters.set("q", query.trim());
  const paginationPath = filters.size > 0 ? `${basePath}?${filters.toString()}` : basePath;
  return (
    <main className="site-container content-layout">
      <section className="catalog-content">
        <header className="page-heading"><p>Explore</p><h1>{title}</h1><div><span>{description}</span></div></header>
        <div className="directory-tools">
          <DirectorySearch key={`${basePath}:${activeLetter ?? "all"}`} basePath={basePath} activeLetter={activeLetter} initialQuery={query} label={searchLabel} />
          <AlphabetFilter basePath={basePath} active={activeLetter} query={query} />
        </div>
        <div className="directory-ad"><AdSlot placement="catalog-top" /></div>
        {entries.length > 0 ? (
          <div className="name-directory entity-directory">
            {entries.map((entry) => <Link href={`${entryPath}/${entry.slug}`} key={entry.slug}><span><strong>{entry.name}</strong></span></Link>)}
          </div>
        ) : <div className="empty-state"><h2>No matching entries</h2><Link href={basePath}>Clear filters</Link></div>}
        <Pagination page={page} total={total} basePath={paginationPath} pageSize={pageSize} />
      </section>
      <Sidebar />
    </main>
  );
}
