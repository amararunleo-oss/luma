import { searchCatalog } from "@/lib/catalog/repository";
import { parseSearchScope } from "@/lib/search-scope";
import { AppError, errorResponse } from "@/lib/http/errors";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = (url.searchParams.get("q") ?? "").trim();
    if (query.length > 80) throw new AppError(400, "SEARCH_TOO_LONG", "Search terms must be 80 characters or fewer.");
    const scope = parseSearchScope(url.searchParams.get("scope") ?? undefined);
    const results = await searchCatalog(query, 5, scope);
    return Response.json(results, { headers: { "Cache-Control": "public, max-age=30, s-maxage=300, stale-while-revalidate=3600", "CDN-Cache-Control": "public, max-age=300, stale-while-revalidate=3600", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    return errorResponse(error);
  }
}
