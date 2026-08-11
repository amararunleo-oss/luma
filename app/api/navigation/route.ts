import { NextResponse } from "next/server";
import { getTaxonomy } from "@/lib/catalog/repository";

export const revalidate = 3600;

export async function GET() {
  const { actresses, tags } = await getTaxonomy();
  const response = NextResponse.json({
    actresses: actresses.slice(0, 10).map(({ name, slug }) => ({ name, slug })),
    tags: tags.slice(0, 18).map(({ name, slug }) => ({ name, slug })),
  });
  response.headers.set("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  return response;
}
