import { EntityDirectory } from "@/components/directory/entity-directory";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { listDirectory } from "@/lib/catalog/repository";
import { pageNumber } from "@/lib/videos";
import { catalogMetadata } from "@/lib/seo";

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ letter?: string; q?: string; page?: string }> }) {
  const query = await searchParams;
  const letter = /^[A-Z]$/i.test(query.letter ?? "") ? query.letter?.toUpperCase() : undefined;
  return catalogMetadata({
    title: letter ? `Movies beginning with ${letter} | Luma` : "Movies A-Z | Luma",
    description: letter ? `Explore movies beginning with ${letter}.` : "Explore movies from A to Z.",
    path: letter ? `/movie?letter=${letter}` : "/movie",
    page: query.page,
    index: !query.q?.trim(),
  });
}

export default async function Movies({ searchParams }: { searchParams: Promise<{ letter?: string; q?: string; page?: string }> }) {
  const query = await searchParams;
  const letter = /^[A-Z]$/i.test(query.letter ?? "") ? query.letter?.toUpperCase() : undefined;
  const result = await listDirectory({ kind: "movie", letter, search: query.q, page: pageNumber(query.page), pageSize: 36 });
  return <><SiteHeader /><EntityDirectory title="Movies" description="Explore movies from A to Z." entries={result.items} total={result.total} page={result.page} pageSize={result.pageSize} basePath="/movie" activeLetter={letter} query={query.q} entryPath="/movie/title" searchLabel="movies" /><SiteFooter /></>;
}
