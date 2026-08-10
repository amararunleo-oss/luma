import { absoluteUrl } from "@/lib/seo";
import type { Video } from "@/lib/videos";

type CollectionKind = "actress" | "movie" | "tv" | "tag" | "year";

function videoList(origin: string, items: Video[]) {
  return items.slice(0, 24).map((video, index) => ({
    "@type": "ListItem",
    position: index + 1,
    url: absoluteUrl(origin, `/watch/${video.slug}`),
    item: {
      "@type": "VideoObject",
      name: video.sceneTitle,
      thumbnailUrl: [absoluteUrl(origin, video.thumbnail)],
      contentRating: "18+",
      isFamilyFriendly: false,
    },
  }));
}

function entity(kind: CollectionKind, name: string, url: string, items: Video[]) {
  if (kind === "actress") return { "@type": "Person", "@id": `${url}#person`, name, url };
  if (kind === "movie" || kind === "tv") {
    const people = [...new Set(items.flatMap((video) => video.actresses))].slice(0, 20);
    return {
      "@type": kind === "movie" ? "Movie" : "TVSeries",
      "@id": `${url}#title`,
      name,
      url,
      actor: people.map((person) => ({ "@type": "Person", name: person })),
    };
  }
  return { "@type": kind === "tag" ? "DefinedTerm" : "Thing", "@id": `${url}#topic`, name, url };
}

export function collectionSchema({
  origin,
  path,
  kind,
  name,
  description,
  items,
  breadcrumbLabel,
}: {
  origin: string;
  path: string;
  kind: CollectionKind;
  name: string;
  description: string;
  items: Video[];
  breadcrumbLabel: string;
}) {
  const url = absoluteUrl(origin, path);
  const mainEntity = entity(kind, name, url, items);
  const sectionPath = kind === "actress" ? "/actress" : kind === "movie" ? "/movie" : kind === "tv" ? "/tv-show" : undefined;
  const breadcrumbs = sectionPath
    ? [
        { "@type": "ListItem", position: 1, name: "Home", item: origin },
        { "@type": "ListItem", position: 2, name: breadcrumbLabel, item: absoluteUrl(origin, sectionPath) },
        { "@type": "ListItem", position: 3, name, item: url },
      ]
    : [
        { "@type": "ListItem", position: 1, name: "Home", item: origin },
        { "@type": "ListItem", position: 2, name, item: url },
      ];
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${url}#page`,
        url,
        name,
        description,
        isFamilyFriendly: false,
        mainEntity: { "@id": mainEntity["@id"] },
      },
      mainEntity,
      {
        "@type": "ItemList",
        "@id": `${url}#videos`,
        numberOfItems: items.length,
        itemListElement: videoList(origin, items),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: breadcrumbs,
      },
    ],
  };
}
