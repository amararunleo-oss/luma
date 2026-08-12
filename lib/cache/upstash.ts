import { createHash } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { Redis } from "@upstash/redis";

type CacheEnvelope<T> = {
  version: 1;
  value: T;
};

type CacheEntry = {
  expiresAt: number;
  value: unknown;
};

type CacheOptions<T> = {
  shouldCache?: (value: T) => boolean;
};

const MAX_L1_ENTRIES = 500;
const MAX_REMOTE_VALUE_BYTES = 256 * 1024;
const COMPRESSION_THRESHOLD_BYTES = 2 * 1024;
const L1_TTL_SECONDS = 60;
const CACHE_SCHEMA_VERSION = "v2";
const l1 = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<unknown>>();

let redis: Redis | null | undefined;
let lastWarningAt = 0;

function warnOnce(error: unknown) {
  const now = Date.now();
  if (now - lastWarningAt < 60_000) return;
  lastWarningAt = now;
  console.warn("Upstash cache unavailable; continuing without remote cache.", error instanceof Error ? error.message : error);
}

function client() {
  if (redis !== undefined) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  redis = url && token ? new Redis({ url, token, cache: "default" }) : null;
  return redis;
}

function namespace() {
  const release = process.env.CATALOG_CACHE_VERSION?.trim() || "v1";
  return `actrexx:catalog:${CACHE_SCHEMA_VERSION}:${release}`;
}

function namespaced(key: string) {
  return `${namespace()}:${key}`;
}

function pruneL1() {
  const now = Date.now();
  for (const [key, entry] of l1) {
    if (entry.expiresAt <= now) l1.delete(key);
  }
  while (l1.size >= MAX_L1_ENTRIES) {
    const oldest = l1.keys().next().value as string | undefined;
    if (!oldest) break;
    l1.delete(oldest);
  }
}

function remember<T>(key: string, value: T, ttlSeconds: number) {
  pruneL1();
  l1.set(key, {
    expiresAt: Date.now() + Math.min(ttlSeconds, L1_TTL_SECONDS) * 1_000,
    value,
  });
}

async function read<T>(key: string, ttlSeconds: number): Promise<{ hit: boolean; value?: T }> {
  const fullKey = namespaced(key);
  const local = l1.get(fullKey);
  if (local && local.expiresAt > Date.now()) return { hit: true, value: local.value as T };
  if (local) l1.delete(fullKey);

  const connection = client();
  if (!connection) return { hit: false };
  try {
    const payload = await connection.get<string>(fullKey);
    if (!payload || typeof payload !== "string") return { hit: false };
    const serialized = payload.startsWith("gz:")
      ? gunzipSync(Buffer.from(payload.slice(3), "base64")).toString("utf8")
      : payload.startsWith("json:")
        ? payload.slice(5)
        : payload;
    const envelope = JSON.parse(serialized) as CacheEnvelope<T>;
    if (envelope.version !== 1) return { hit: false };
    remember(fullKey, envelope.value, ttlSeconds);
    return { hit: true, value: envelope.value };
  } catch (error) {
    warnOnce(error);
    return { hit: false };
  }
}

async function write<T>(key: string, value: T, ttlSeconds: number) {
  const fullKey = namespaced(key);
  remember(fullKey, value, ttlSeconds);
  const connection = client();
  if (!connection) return;

  const envelope: CacheEnvelope<T> = { version: 1, value };
  const serialized = JSON.stringify(envelope);
  const rawBytes = Buffer.byteLength(serialized, "utf8");
  const payload = rawBytes >= COMPRESSION_THRESHOLD_BYTES
    ? `gz:${gzipSync(serialized).toString("base64")}`
    : `json:${serialized}`;
  if (Buffer.byteLength(payload, "utf8") > MAX_REMOTE_VALUE_BYTES) return;

  try {
    await connection.set(fullKey, payload, { ex: ttlSeconds });
  } catch (error) {
    warnOnce(error);
  }
}

export function catalogCacheKey(scope: string, input: unknown) {
  const digest = createHash("sha256").update(JSON.stringify(input)).digest("hex").slice(0, 32);
  return `${scope}:${digest}`;
}

export async function withCatalogCache<T>(key: string, ttlSeconds: number, loader: () => Promise<T>, options: CacheOptions<T> = {}): Promise<T> {
  if (!client()) return loader();
  const fullKey = namespaced(key);
  const pending = inFlight.get(fullKey) as Promise<T> | undefined;
  if (pending) return pending;

  const task = (async () => {
    const cached = await read<T>(key, ttlSeconds);
    if (cached.hit) return cached.value as T;

    const value = await loader();
    if (!options.shouldCache || options.shouldCache(value)) await write(key, value, ttlSeconds);
    return value;
  })();

  inFlight.set(fullKey, task);
  try {
    return await task;
  } finally {
    inFlight.delete(fullKey);
  }
}
