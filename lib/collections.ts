import type { QueryOptions } from "@/lib/catalog/repository";

export type CollectionDefinition = {
  slug: string;
  title: string;
  shortTitle: string;
  eyebrow: string;
  description: string;
  keywords: string[];
  query: QueryOptions;
};

export const COLLECTION_MINIMUM_VIDEOS = 8;

export const COLLECTIONS: readonly CollectionDefinition[] = [
  {
    slug: "popular-movie-scenes",
    title: "Popular Celebrity Movie Scenes",
    shortTitle: "Popular movies",
    eyebrow: "Movie collection",
    description: "Explore popular celebrity scenes from feature films, ranked for quick discovery with actresses, years and related titles.",
    keywords: ["popular celebrity movie scenes", "actress movie scenes"],
    query: { type: "Movie", sort: "popular", order: "popular" },
  },
  {
    slug: "popular-tv-scenes",
    title: "Popular Celebrity TV Scenes",
    shortTitle: "Popular TV",
    eyebrow: "Television collection",
    description: "Browse popular celebrity scenes from television series, organized with performers, episodes, years and related videos.",
    keywords: ["popular celebrity TV scenes", "actress television scenes"],
    query: { type: "TV Show", sort: "popular", order: "popular" },
  },
  {
    slug: "top-rated-movie-scenes",
    title: "Top-Rated Celebrity Movie Scenes",
    shortTitle: "Top-rated movies",
    eyebrow: "Highly rated",
    description: "Discover highly rated celebrity scenes from movies with performers, release years and closely related selections.",
    keywords: ["top rated movie scenes", "best celebrity movie scenes"],
    query: { type: "Movie", order: "rating", minRating: 80 },
  },
  {
    slug: "top-rated-tv-scenes",
    title: "Top-Rated Celebrity TV Scenes",
    shortTitle: "Top-rated TV",
    eyebrow: "Highly rated",
    description: "Explore highly rated celebrity television scenes and continue through performers, series and related episodes.",
    keywords: ["top rated TV scenes", "best celebrity television scenes"],
    query: { type: "TV Show", order: "rating", minRating: 80 },
  },
  {
    slug: "new-movie-scenes",
    title: "New Celebrity Movie Scenes",
    shortTitle: "New movies",
    eyebrow: "Recently added",
    description: "See recently added celebrity scenes from movies, with current titles, performers, years and descriptive tags.",
    keywords: ["new celebrity movie scenes", "latest actress movie scenes"],
    query: { type: "Movie", sort: "latest", order: "latest" },
  },
  {
    slug: "new-tv-scenes",
    title: "New Celebrity TV Scenes",
    shortTitle: "New TV",
    eyebrow: "Recently added",
    description: "See recently added television scenes with actresses, series names, episode information and related videos.",
    keywords: ["new celebrity TV scenes", "latest actress television scenes"],
    query: { type: "TV Show", sort: "latest", order: "latest" },
  },
  {
    slug: "short-celebrity-scenes",
    title: "Short Celebrity Scenes",
    shortTitle: "Short scenes",
    eyebrow: "Under five minutes",
    description: "Browse concise celebrity movie and television scenes under five minutes for fast, focused viewing.",
    keywords: ["short celebrity scenes", "short actress videos"],
    query: { duration: "short", order: "popular" },
  },
  {
    slug: "classic-movie-scenes",
    title: "Classic Celebrity Movie Scenes",
    shortTitle: "Classic movies",
    eyebrow: "From the archive",
    description: "Explore classic celebrity movie scenes from earlier releases, organized with performers, years and related films.",
    keywords: ["classic celebrity movie scenes", "vintage actress scenes"],
    query: { type: "Movie", order: "oldest" },
  },
  {
    slug: "sydney-sweeney-scenes",
    title: "Popular Sydney Sweeney Scenes",
    shortTitle: "Sydney Sweeney",
    eyebrow: "Performer collection",
    description: "Explore popular Sydney Sweeney movie and television scenes with titles, years, tags and related videos.",
    keywords: ["Sydney Sweeney scenes", "Sydney Sweeney movie scenes"],
    query: { actressSlug: "sydney-sweeney", order: "popular" },
  },
  {
    slug: "ana-de-armas-scenes",
    title: "Popular Ana de Armas Scenes",
    shortTitle: "Ana de Armas",
    eyebrow: "Performer collection",
    description: "Explore popular Ana de Armas movie and television scenes with titles, years, tags and related videos.",
    keywords: ["Ana de Armas scenes", "Ana de Armas movie scenes"],
    query: { actressSlug: "ana-de-armas", order: "popular" },
  },
  {
    slug: "alexandra-daddario-scenes",
    title: "Popular Alexandra Daddario Scenes",
    shortTitle: "Alexandra Daddario",
    eyebrow: "Performer collection",
    description: "Explore popular Alexandra Daddario movie and television scenes with titles, years and related videos.",
    keywords: ["Alexandra Daddario scenes", "Alexandra Daddario movie scenes"],
    query: { actressSlug: "alexandra-daddario", order: "popular" },
  },
  {
    slug: "margot-robbie-scenes",
    title: "Popular Margot Robbie Scenes",
    shortTitle: "Margot Robbie",
    eyebrow: "Performer collection",
    description: "Explore popular Margot Robbie movie and television scenes with titles, years, tags and related videos.",
    keywords: ["Margot Robbie scenes", "Margot Robbie movie scenes"],
    query: { actressSlug: "margot-robbie", order: "popular" },
  },
] as const;

export function collectionBySlug(slug: string) {
  return COLLECTIONS.find((collection) => collection.slug === slug);
}
