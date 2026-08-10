import { EntityDirectory } from "@/components/directory/entity-directory";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { listDirectory } from "@/lib/catalog/repository";
import { pageNumber } from "@/lib/videos";
import { catalogMetadata } from "@/lib/seo";

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ letter?: string; q?: string; page?: string }> }) {
  const query = await searchParams;
  const letter = /^[A-Z]$/i.test(query.letter ?? "") ? query.letter?.toUpperCase() : undefined;
  return catalogMetadata({
    title: letter ? `Actresses beginning with ${letter} | Luma` : "Actresses A-Z | Luma",
    description: letter ? `Explore actresses beginning with ${letter}.` : "Explore actresses from A to Z.",
    path: letter ? `/actress?letter=${letter}` : "/actress",
    page: query.page,
    index: !query.q?.trim(),
  });
}

export default async function ActressDirectory({ searchParams }: { searchParams: Promise<{ letter?: string; q?: string; page?: string }> }) {
  const query = await searchParams;
  const letter = /^[A-Z]$/i.test(query.letter ?? "") ? query.letter?.toUpperCase() : undefined;
  const result = await listDirectory({ kind: "actress", letter, search: query.q, page: pageNumber(query.page), pageSize: 36 });
  return <><SiteHeader /><EntityDirectory title="Actresses" description="Explore actresses from A to Z." entries={result.items} total={result.total} page={result.page} pageSize={result.pageSize} basePath="/actress" activeLetter={letter} query={query.q} entryPath="/actress" searchLabel="actresses" /><SiteFooter /></>;
}
