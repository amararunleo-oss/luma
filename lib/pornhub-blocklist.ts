import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

type BlocklistEntry = { sourceId?: string; slug?: string; reason?: string; addedAt?: string; note?: string };
type BlocklistFile = { blocked?: BlocklistEntry[] };
export type PornhubBlocklist = { ids: ReadonlySet<string>; slugs: ReadonlySet<string>; size: number };

// Slugs always end with the source viewkey, so one id match covers every layer:
// the local JSONL, the Redis catalog chunks and the D1 rows, which only share the
// slug. Kept O(1) so it can sit on hot read paths.
export function isBlockedSlug(list: PornhubBlocklist, slug: string) {
  if (!list.size || !slug) return false;
  if (list.slugs.has(slug)) return true;
  return list.ids.has(slug.slice(slug.lastIndexOf("-") + 1));
}

export async function blockedPornhubSlug(slug: string) {
  return isBlockedSlug(await getPornhubBlocklist(), slug);
}

const empty: PornhubBlocklist = { ids: new Set<string>(), slugs: new Set<string>(), size: 0 };

function normalize(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

let blocklist: Promise<PornhubBlocklist> | undefined;

// Suppression list for videos that pass HTTP validation but cannot actually be
// played in an embed. Read once per process and applied before any listing,
// search or preview selection sees the record.
export function getPornhubBlocklist() {
  blocklist ??= readFile(path.join(process.cwd(), "data/catalog/pornhub-blocklist.json"), "utf8")
    .then((value) => {
      const parsed = JSON.parse(value) as BlocklistFile;
      const entries = Array.isArray(parsed.blocked) ? parsed.blocked : [];
      const ids = new Set(entries.map((entry) => normalize(entry.sourceId)).filter(Boolean));
      const slugs = new Set(entries.map((entry) => normalize(entry.slug)).filter(Boolean));
      return { ids, slugs, size: ids.size + slugs.size };
    })
    .catch(() => empty);
  return blocklist;
}
