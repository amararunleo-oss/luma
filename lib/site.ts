export const SITE = {
  name: "Actrexx",
  displayName: "ACTREXX",
  title: "Actrexx | Celebrity Nude & Sex Scenes from Movies and TV",
  description: "Watch celebrity nude scenes, sex scenes and intimate moments from movies and television, organized by actress, title, year and tag.",
  shortDescription: "Celebrity nude and sex scenes from movies and television for adults 18 and older.",
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
    "celebrity adult videos",
    "actress sex videos",
    "hot celebrity scenes",
  ],
} as const;

export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
