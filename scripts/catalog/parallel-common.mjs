import { createReadStream } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";

export const projectRoot = process.cwd();
export const stagingRoot = path.resolve("data/staging/videocelebs");
export const parallelRoot = path.join(stagingRoot, "parallel");
export const activeRunPath = path.join(parallelRoot, "active.json");

export function parseOptions(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith("--")) throw new Error(`Unexpected argument: ${key}`);
    if (["--confirm-stopped", "--force-unlock"].includes(key)) result[key.slice(2)] = true;
    else result[key.slice(2)] = argv[++index];
  }
  return result;
}

export function positiveInteger(value, fallback, label) {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${label} must be a positive integer.`);
  return parsed;
}

export function projectPath(relative) {
  const resolved = path.resolve(relative);
  const prefix = `${projectRoot}${path.sep}`;
  if (resolved !== projectRoot && !resolved.startsWith(prefix)) throw new Error(`Path escaped the project: ${relative}`);
  return resolved;
}

export async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

export async function writeJsonAtomic(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, file);
}

export async function activeManifest() {
  const active = await readJson(activeRunPath).catch((error) => {
    if (error.code === "ENOENT") throw new Error("No prepared parallel run. Run catalog:parallel:prepare after stopping the current importer.");
    throw error;
  });
  const manifestPath = projectPath(active.manifest);
  return { manifestPath, manifest: await readJson(manifestPath) };
}

export async function scanJsonl(file, onRecord) {
  let lines = 0;
  let invalid = 0;
  const stream = createReadStream(file, { encoding: "utf8" });
  const reader = readline.createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of reader) {
    if (!line.trim()) continue;
    lines += 1;
    try {
      const record = JSON.parse(line);
      if (!Number.isInteger(Number(record.id))) throw new Error("Missing numeric source ID");
      await onRecord(record, lines);
    } catch (error) {
      invalid += 1;
      throw new Error(`${path.relative(projectRoot, file)} line ${lines}: ${error.message}`);
    }
  }
  return { lines, invalid };
}

export function mergeRecord(previous, incoming) {
  if (!previous) return incoming;
  const previousTime = Date.parse(previous.importedAt ?? previous.updatedAt ?? 0) || 0;
  const incomingTime = Date.parse(incoming.importedAt ?? incoming.updatedAt ?? 0) || 0;
  const newer = incomingTime >= previousTime ? incoming : previous;
  const older = newer === incoming ? previous : incoming;
  const merged = { ...older, ...newer, listings: mergeListings(older.listings, newer.listings) };

  if (newer.detailStatus !== "ok" && older.detailStatus === "ok") {
    for (const key of ["description", "durationSeconds", "publishedAt", "actresses", "tags", "previewUrl", "previewVariant", "playerAspectRatio", "workTitle", "type", "taxonomyStatus"]) {
      if (older[key] !== undefined) merged[key] = older[key];
    }
    merged.detailStatus = "ok";
    merged.detailError = null;
  }
  const goodThumbnail = (record) => ["downloaded", "existing"].includes(record.thumbnailStatus);
  if (!goodThumbnail(newer) && goodThumbnail(older)) {
    for (const key of ["thumbnailStatus", "thumbnailError", "thumbnailWidth", "thumbnailHeight", "thumbnailBytes", "thumbnailContentType", "thumbnailSha256", "thumbnailKey"]) {
      if (older[key] !== undefined) merged[key] = older[key];
    }
  }
  return merged;
}

function mergeListings(first = {}, second = {}) {
  const merged = { ...first };
  for (const [name, value] of Object.entries(second)) {
    const current = merged[name];
    if (!current) { merged[name] = value; continue; }
    const currentPosition = Number(current.position ?? Number.POSITIVE_INFINITY);
    const nextPosition = Number(value.position ?? Number.POSITIVE_INFINITY);
    merged[name] = nextPosition < currentPosition ? value : current;
  }
  return merged;
}

export function relative(file) {
  return path.relative(projectRoot, file).replaceAll(path.sep, "/");
}
