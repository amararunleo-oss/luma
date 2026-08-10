export const SITE = {
  name: "Luma",
  displayName: "LUMA",
  title: "Luma | Celebrity Nude Scenes from Movies & TV",
  description: "Discover celebrity nude scenes and intimate moments from movies and television, organized by actress, film, TV show, year and tag.",
  shortDescription: "Celebrity scenes from movies and television for adults 18 and older.",
  keywords: [
    "celebrity nude scenes",
    "actress nude scenes",
    "movie nude scenes",
    "TV nude scenes",
    "celebrity sex scenes",
    "nude scenes by actress",
    "movie sex scenes",
    "television nude scenes",
    "celebrity scene videos",
    "popular actress scenes",
  ],
} as const;

export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
