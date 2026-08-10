import type { CatalogOrder, DurationFilter, QueryOptions } from "@/lib/catalog/repository";
import type { VideoType } from "@/lib/videos";

export type CatalogFilterParams = {
  page?: string;
  type?: string;
  year?: string;
  duration?: string;
  rating?: string;
  order?: string;
};

export type CatalogFilterValues = {
  type?: VideoType;
  year?: number;
  duration?: DurationFilter;
  minRating?: number;
  order?: CatalogOrder;
};

export function parseCatalogFilters(params: CatalogFilterParams): CatalogFilterValues {
  const type = params.type === "movie" ? "Movie" : params.type === "tv-show" ? "TV Show" : undefined;
  const yearValue = Number(params.year);
  const year = Number.isInteger(yearValue) && yearValue >= 1900 && yearValue <= new Date().getFullYear() + 2 ? yearValue : undefined;
  const duration = (["short", "medium", "long"] as const).find((value) => value === params.duration);
  const ratingValue = Number(params.rating);
  const minRating = [50, 60, 70, 80, 90].includes(ratingValue) ? ratingValue : undefined;
  const order = (["latest", "popular", "rating", "oldest"] as const).find((value) => value === params.order);
  return { type, year, duration, minRating, order };
}

export function filterQueryOptions(values: CatalogFilterValues): Partial<QueryOptions> {
  return values;
}

export function hasCatalogFilters(values: CatalogFilterValues) {
  return Boolean(values.type || values.year || values.duration || values.minRating || values.order);
}

export function catalogFilterPath(basePath: string, values: CatalogFilterValues) {
  const params = new URLSearchParams();
  if (values.type) params.set("type", values.type === "Movie" ? "movie" : "tv-show");
  if (values.year) params.set("year", String(values.year));
  if (values.duration) params.set("duration", values.duration);
  if (values.minRating) params.set("rating", String(values.minRating));
  if (values.order) params.set("order", values.order);
  return params.size ? `${basePath}?${params.toString()}` : basePath;
}
