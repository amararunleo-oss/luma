export type NavigationIcon = "celebrity" | "movie" | "tv" | "adult";

export type NavigationLink = { label: string; href: string };
export type NavigationGroup = {
  id: string;
  label: string;
  description: string;
  icon: NavigationIcon;
  links: readonly NavigationLink[];
};

export const NAVIGATION_GROUPS: readonly NavigationGroup[] = [
  {
    id: "celebrity",
    label: "Celebrity videos",
    description: "Actresses and entertainment scenes",
    icon: "celebrity",
    links: [
      { label: "Latest celebrity scenes", href: "/latest" },
      { label: "Popular celebrity scenes", href: "/most-popular" },
      { label: "Top-rated celebrity scenes", href: "/top-rated" },
      { label: "Celebrities A-Z", href: "/actress" },
      { label: "Swipe videos", href: "/swipe-videos" },
      { label: "Celebrity collections", href: "/collections" },
    ],
  },
  {
    id: "movies",
    label: "Movies",
    description: "Films and celebrity movie scenes",
    icon: "movie",
    links: [
      { label: "Movies A-Z", href: "/movie" },
      { label: "Latest movie scenes", href: "/collections/new-movie-scenes" },
      { label: "Popular movie scenes", href: "/collections/popular-movie-scenes" },
      { label: "Top-rated movie scenes", href: "/collections/top-rated-movie-scenes" },
    ],
  },
  {
    id: "tv",
    label: "TV shows",
    description: "Series, episodes and TV scenes",
    icon: "tv",
    links: [
      { label: "TV shows A-Z", href: "/tv-show" },
      { label: "Latest TV scenes", href: "/collections/new-tv-scenes" },
      { label: "Popular TV scenes", href: "/collections/popular-tv-scenes" },
      { label: "Top-rated TV scenes", href: "/collections/top-rated-tv-scenes" },
    ],
  },
  {
    id: "adult",
    label: "Porn videos",
    description: "Adult videos and categories",
    icon: "adult",
    links: [
      { label: "All porn videos", href: "/porn-videos" },
      { label: "Latest porn videos", href: "/porn-videos/latest" },
      { label: "Popular porn videos", href: "/porn-videos/popular" },
      { label: "Top-rated porn videos", href: "/porn-videos/top-rated" },
      { label: "Porn categories", href: "/porn-categories" },
      ...ADULT_CATEGORIES.map((category) => ({ label: category.name, href: `/porn-category/${category.slug}` })),
    ],
  },
] as const;
import { ADULT_CATEGORIES } from "@/lib/adult-taxonomy";
