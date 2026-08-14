import { SITE } from "@/lib/site";
import type { Video } from "@/lib/videos";
import { adultCategoryBySlugOrName } from "@/lib/adult-taxonomy";

export type SeoTemplate = {
  title: string;
  description: string;
  keywords: string[];
};

function performers(names: string[], limit = 2) {
  const selected = names.slice(0, limit).join(" & ");
  return names.length > limit ? `${selected} and others` : selected || "Celebrity actresses";
}

function sceneIntent(tags: string[]) {
  const normalized = new Set(tags.map((tag) => tag.toLowerCase()));
  if (normalized.has("sex") || normalized.has("explicit")) return "Sex Scene";
  if (["nude", "full frontal", "topless", "nude debut"].some((tag) => normalized.has(tag))) return "Nude Scene";
  return "Intimate Scene";
}

function compactTitle(value: string, limit = 64) {
  if (value.length <= limit) return value;
  const suffix = ` | ${SITE.name}`;
  const body = value.endsWith(suffix) ? value.slice(0, -suffix.length) : value;
  return `${body.slice(0, Math.max(20, limit - suffix.length - 1)).trimEnd()}…${suffix}`;
}

export function homeSeo(): SeoTemplate {
  return {
    title: `Celebrity Scenes & Popular Adult Videos | ${SITE.name}`,
    description: "Explore popular celebrity movie and TV scenes alongside curated adult video categories, recent releases and highly rated videos.",
    keywords: ["celebrity nude scenes", "actress sex scenes", "popular adult videos", "movie sex scenes", "romantic adult videos"],
  };
}

export function listingSeo(kind: "popular" | "top-rated"): SeoTemplate {
  const popular = kind === "popular";
  return {
    title: `${popular ? "Most Popular" : "Top Rated"} Celebrity Nude & Sex Scenes | ${SITE.name}`,
    description: `${popular ? "Watch trending" : "Explore highly rated"} celebrity nude scenes and sex scenes from movies and television.`,
    keywords: [popular ? "popular celebrity nude scenes" : "best celebrity sex scenes", "actress nude videos", "movie nude scenes", "TV sex scenes"],
  };
}

export function directorySeo(kind: "actress" | "movie" | "tv", letter?: string): SeoTemplate {
  const label = kind === "actress" ? "Actresses" : kind === "movie" ? "Movies" : "TV Shows";
  const suffix = letter ? ` Beginning with ${letter}` : " A-Z";
  const intent = kind === "actress" ? "celebrity nude and sex scenes by actress" : kind === "movie" ? "celebrity nude and sex scenes by movie" : "celebrity nude and sex scenes by TV show";
  return {
    title: `${label}${suffix} - Nude & Sex Scene Index | ${SITE.name}`,
    description: `Browse ${intent}${letter ? ` beginning with ${letter}` : " from A to Z"}.`,
    keywords: [intent, `${label.toLowerCase()} nude scenes`, `${label.toLowerCase()} sex scenes`],
  };
}

export function actressSeo(name: string, count: number): SeoTemplate {
  return {
    title: `${name} Nude & Sex Scenes - Videos | ${SITE.name}`,
    description: `Watch ${count.toLocaleString("en-US")} ${name} nude, sex and intimate scenes from movies and television, with titles, years, tags and related videos.`,
    keywords: [`${name} nude`, `${name} nude scenes`, `${name} sex scene`, `${name} sex videos`, `${name} movies`],
  };
}

export function workSeo(type: "movie" | "tv", name: string, count: number): SeoTemplate {
  const label = type === "movie" ? "Movie" : "TV Show";
  return {
    title: `${name} Nude & Sex Scenes - ${label} Videos | ${SITE.name}`,
    description: `Watch ${count.toLocaleString("en-US")} celebrity nude, sex and intimate scenes from ${name}, organized with actresses, years, tags and related videos.`,
    keywords: [`${name} nude scenes`, `${name} sex scenes`, `${name} actresses`, `${name} adult scenes`],
  };
}

export function tagSeo(name: string, count: number): SeoTemplate {
  const adultCategory = adultCategoryBySlugOrName(name);
  if (adultCategory) {
    return {
      title: `${adultCategory.name} - Popular Adult Videos | ${SITE.name}`,
      description: `${adultCategory.description} Explore ${count.toLocaleString("en-US")} matching adult videos with clear titles, durations and related categories.`,
      keywords: [adultCategory.name.toLowerCase(), ...adultCategory.aliases.slice(0, 4).map((alias) => `${alias} videos`)],
    };
  }
  return {
    title: `Celebrity ${name} Scenes & Videos | ${SITE.name}`,
    description: `Browse ${count.toLocaleString("en-US")} celebrity ${name.toLowerCase()} scenes from movies and television, organized by actress, title and year.`,
    keywords: [`celebrity ${name} scenes`, `${name} movie scenes`, `${name} actress videos`, `${name} TV scenes`],
  };
}

export function yearSeo(year: string): SeoTemplate {
  return {
    title: `${year} Celebrity Nude & Sex Scenes from Movies and TV | ${SITE.name}`,
    description: `Browse celebrity nude scenes, sex scenes and intimate movie and television moments released in ${year}.`,
    keywords: [`${year} nude scenes`, `${year} movie sex scenes`, `${year} TV nude scenes`, `${year} celebrity scenes`],
  };
}

export function watchSeo(video: Video): SeoTemplate {
  if (video.source === "pornhub") {
    const year = video.year >= 1900 ? ` (${video.year})` : "";
    const categories = [...(video.collections ?? []), ...video.tags].slice(0, 5);
    return {
      title: compactTitle(`${video.sceneTitle}${year} - Adult Video | ${SITE.name}`),
      description: `${video.description} Watch the embedded adult video and explore related ${categories.slice(0, 3).join(", ")} categories.`,
      keywords: [video.sceneTitle, ...categories.map((tag) => `${tag} videos`)].slice(0, 10),
    };
  }
  const names = performers(video.actresses);
  const intent = sceneIntent(video.tags);
  const work = video.workTitle || video.sceneTitle;
  const year = video.year >= 1900 ? ` (${video.year})` : "";
  const tagText = video.tags.slice(0, 4).join(", ");
  return {
    title: compactTitle(`${names} ${intent} in ${work}${year} | ${SITE.name}`),
    description: `Watch ${names} in ${work}${year}, a ${video.type.toLowerCase()} ${intent.toLowerCase()}${tagText ? ` tagged ${tagText}` : ""}. View scene details and related videos.`,
    keywords: [
      ...video.actresses.slice(0, 2).flatMap((name) => [`${name} nude scene`, `${name} sex scene`, `${name} ${work}`]),
      `${work} nude scene`,
      `${work} sex scene`,
      ...video.tags.slice(0, 4).map((tag) => `celebrity ${tag} scene`),
    ],
  };
}
