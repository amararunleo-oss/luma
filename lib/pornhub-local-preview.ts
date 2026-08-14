import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

export type PornhubPreviewItem = {
  id: string;
  slug: string;
  title: string;
  thumbnail: string;
  thumbnailFallback: string;
  duration: string;
  year: number;
  rating: number;
  views: number;
  tags: string[];
  collections: string[];
  publishedAt: string;
};

export type PornhubHomePreview = {
  generatedAt: string;
  sourceRecords: number;
  sections: {
    best: PornhubPreviewItem[];
    romantic: PornhubPreviewItem[];
    babe: PornhubPreviewItem[];
    anime: PornhubPreviewItem[];
    doggy: PornhubPreviewItem[];
    pussyLicking: PornhubPreviewItem[];
    stepFantasy: PornhubPreviewItem[];
    blowjob: PornhubPreviewItem[];
  };
};

const empty: PornhubHomePreview = {
  generatedAt: "",
  sourceRecords: 0,
  sections: { best: [], romantic: [], babe: [], anime: [], doggy: [], pussyLicking: [], stepFantasy: [], blowjob: [] },
};

let localPreview: Promise<PornhubHomePreview> | undefined;

export function getLocalPornhubHomePreview() {
  localPreview ??= readFile(path.join(process.cwd(), "data/catalog/pornhub-home-preview.json"), "utf8")
    .catch(() => readFile(path.join(process.cwd(), "data/staging/pornhub/home-preview.json"), "utf8"))
    .then((value) => {
      const parsed = JSON.parse(value) as PornhubHomePreview;
      return { ...empty, ...parsed, sections: { ...empty.sections, ...parsed.sections } };
    })
    .catch(() => empty);
  return localPreview;
}
