import { slugify, type Video, type VideoType } from "@/lib/videos";

export type ContextLink = { label: string; href: string };
export type ContextGroup = { label: string; links: ContextLink[] };
export type EntityContext = { heading: string; paragraphs: string[]; groups: ContextGroup[] };

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function ranked(values: string[], limit: number) {
  const counts = new Map<string, number>();
  values.filter(Boolean).forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([value]) => value);
}

function readable(values: string[], fallback: string) {
  if (!values.length) return fallback;
  if (values.length === 1) return values[0];
  return `${values.slice(0, -1).join(", ")} and ${values.at(-1)}`;
}

function workLinks(items: Video[], limit = 6) {
  const selected = ranked(items.map((video) => `${video.type}|${video.workTitle}`), limit);
  return selected.map((value) => {
    const [type, ...titleParts] = value.split("|");
    const title = titleParts.join("|");
    const section = type === "TV Show" ? "tv-show" : "movie";
    return { label: title, href: `/${section}/title/${slugify(title)}` };
  });
}

function actressLinks(items: Video[], limit = 8) {
  return ranked(items.flatMap((video) => video.actresses), limit)
    .map((name) => ({ label: name, href: `/actress/${slugify(name)}` }));
}

function tagLinks(items: Video[], limit = 8) {
  return ranked(items.flatMap((video) => video.tags), limit)
    .map((name) => ({ label: name, href: `/tag/${slugify(name)}` }));
}

function yearLinks(items: Video[], limit = 8) {
  return unique(items.map((video) => video.year).filter(Boolean).sort((a, b) => b - a).map(String))
    .slice(0, limit)
    .map((year) => ({ label: year, href: `/year/${year}` }));
}

function sceneMix(items: Video[]) {
  const types = unique(items.map((video) => video.type.toLowerCase()));
  return readable(types, "movie and television");
}

export function actressContext(name: string, items: Video[]): EntityContext {
  const works = workLinks(items);
  const tags = tagLinks(items);
  const years = yearLinks(items);
  return {
    heading: `About ${name}'s scenes`,
    paragraphs: [
      `Explore ${name}'s ${sceneMix(items)} appearances with scene details, release years and related performers.`,
      works.length
        ? `Featured titles include ${readable(works.slice(0, 4).map((item) => item.label), "movies and television shows")}.`
        : `Use the filters to browse ${name}'s available scenes by year, duration and rating.`,
    ],
    groups: [
      { label: "Featured titles", links: works },
      { label: "Scene tags", links: tags },
      { label: "Years", links: years },
    ].filter((group) => group.links.length > 0),
  };
}

export function workContext(type: VideoType, name: string, items: Video[]): EntityContext {
  const performers = actressLinks(items);
  const tags = tagLinks(items);
  const years = yearLinks(items);
  return {
    heading: `Scenes from ${name}`,
    paragraphs: [
      `Browse adult celebrity scenes available from the ${type.toLowerCase()} ${name}, with performer, duration, rating and release details.`,
      performers.length
        ? `Featured performers include ${readable(performers.slice(0, 5).map((item) => item.label), "the credited cast")}.`
        : `Use the scene list below to explore the available videos from this title.`,
    ],
    groups: [
      { label: "Performers", links: performers },
      { label: "Scene tags", links: tags },
      { label: "Years", links: years },
    ].filter((group) => group.links.length > 0),
  };
}

export function tagContext(name: string, items: Video[]): EntityContext {
  const performers = actressLinks(items);
  const works = workLinks(items);
  const years = yearLinks(items);
  return {
    heading: `${name} scenes`,
    paragraphs: [
      `Explore movie and television scenes categorized as ${name.toLowerCase()}, organized by performer, screen title and release year.`,
      performers.length
        ? `This selection features ${readable(performers.slice(0, 5).map((item) => item.label), "multiple performers")}.`
        : `Use the filters to narrow these scenes by type, year, duration or rating.`,
    ],
    groups: [
      { label: "Performers", links: performers },
      { label: "Featured titles", links: works },
      { label: "Years", links: years },
    ].filter((group) => group.links.length > 0),
  };
}

export function yearContext(year: string, items: Video[]): EntityContext {
  const performers = actressLinks(items);
  const works = workLinks(items);
  const tags = tagLinks(items);
  return {
    heading: `Celebrity scenes released in ${year}`,
    paragraphs: [
      `Browse adult celebrity scenes from movies and television released in ${year}, with performer, title and scene-category details.`,
      works.length
        ? `Featured releases include ${readable(works.slice(0, 4).map((item) => item.label), "movies and television shows")}.`
        : `Use the filters to explore the available releases from this year.`,
    ],
    groups: [
      { label: "Performers", links: performers },
      { label: "Titles", links: works },
      { label: "Scene tags", links: tags },
    ].filter((group) => group.links.length > 0),
  };
}

export function watchDescription(video: Video) {
  if (video.source === "pornhub") {
    const categories = (video.collections?.length ? video.collections : video.tags).slice(0, 5).map((value) => value.replace(/[-_]+/g, " "));
    const classification = categories.length ? ` It is organized under ${readable(categories, "adult video")} categories.` : "";
    const published = video.year >= 1900 ? ` Published in ${video.year}.` : "";
    return `${video.description}${published}${classification} The video is embedded from the original publisher.`;
  }
  const names = readable(video.actresses, "the credited performers");
  const tags = video.tags.slice(0, 5);
  const year = video.year >= 1900 ? ` (${video.year})` : "";
  const classification = tags.length ? ` The scene is categorized as ${readable(tags, "adult")}.` : "";
  const runtime = video.duration === "00:00" ? "scene" : `${video.duration} scene`;
  return `This ${runtime} from ${video.workTitle}${year} features ${names}.${classification} Explore performer pages, title details and related scenes below.`;
}
