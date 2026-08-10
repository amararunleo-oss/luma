import { EntityDirectory } from "@/components/directory/entity-directory";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { listDirectory } from "@/lib/catalog/repository";
import { pageNumber } from "@/lib/videos";
import { catalogMetadata } from "@/lib/seo";

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ letter?: string; q?: string; page?: string }> }) {
  const query = await searchParams;
  const letter = /^[A-Z]$/i.test(query.letter ?? "") ? query.letter?.toUpperCase() : undefined;
  return catalogMetadata({
    title: letter ? `TV shows beginning with ${letter} | Luma` : "TV Shows A-Z | Luma",
    description: letter ? `Explore TV shows beginning with ${letter}.` : "Explore TV shows from A to Z.",
    path: letter ? `/tv-show?letter=${letter}` : "/tv-show",
    page: query.page,
    index: !query.q?.trim(),
  });
}

export default async function TvShows({ searchParams }: { searchParams: Promise<{ letter?: string; q?: string; page?: string }> }) {
  const query = await searchParams;
  const letter = /^[A-Z]$/i.test(query.letter ?? "") ? query.letter?.toUpperCase() : undefined;
  const result = await listDirectory({ kind: "tv_show", letter, search: query.q, page: pageNumber(query.page), pageSize: 36 });
  return <><SiteHeader /><EntityDirectory title="TV Shows" description="Explore TV shows from A to Z." entries={result.items} total={result.total} page={result.page} pageSize={result.pageSize} basePath="/tv-show" activeLetter={letter} query={query.q} entryPath="/tv-show/title" searchLabel="TV shows" /><SiteFooter /></>;
}
