import { permanentRedirect } from "next/navigation";
import { pageNumber } from "@/lib/videos";

export default async function LatestRedirect({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const query = await searchParams;
  const page = pageNumber(query.page);
  permanentRedirect(page > 1 ? `/?page=${page}` : "/");
}
