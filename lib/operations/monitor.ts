import { env } from "cloudflare:workers";
import { AppError } from "@/lib/http/errors";
import { operationsDatabase } from "@/lib/operations/database";

type Candidate = { id: number; embedId: number; thumbnailKey: string };
type EmbedStatus = "ok" | "broken" | "blocked" | "timeout";
type ThumbnailStatus = "ok" | "missing" | "error" | "unknown";
type Bucket = { head(key: string): Promise<unknown | null> };

async function checkEmbed(embedId: number): Promise<{ status: EmbedStatus; time: number; error: string }> {
  const started = Date.now();
  try {
    const response = await fetch(`https://videocelebs.net/embed/${embedId}`, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(8_000),
      headers: { accept: "text/html,application/xhtml+xml", "user-agent": "Luma catalog health monitor/1.0" },
    });
    await response.body?.cancel();
    if (response.ok) return { status: "ok", time: Date.now() - started, error: "" };
    if ([401, 403, 429].includes(response.status)) return { status: "blocked", time: Date.now() - started, error: `Provider returned ${response.status}` };
    return { status: "broken", time: Date.now() - started, error: `Provider returned ${response.status}` };
  } catch (error) {
    const timeout = error instanceof DOMException && error.name === "TimeoutError";
    return { status: timeout ? "timeout" : "broken", time: Date.now() - started, error: timeout ? "Provider request timed out" : "Provider request failed" };
  }
}

async function checkThumbnail(key: string): Promise<ThumbnailStatus> {
  if (!key || !key.trim()) return "missing";
  if (key.startsWith("/")) return "unknown";
  try {
    const bucket = (env as unknown as { THUMBNAILS?: Bucket }).THUMBNAILS;
    if (!bucket) return "unknown";
    return await bucket.head(key.replace(/^media\//, "")) ? "ok" : "missing";
  } catch {
    return "error";
  }
}

export async function runCatalogMonitor(requestedLimit = 20) {
  const limit = Math.max(1, Math.min(50, Math.floor(requestedLimit)));
  const db = await operationsDatabase();
  const run = await db.prepare("INSERT INTO monitor_runs (status) VALUES ('running') RETURNING id").first<{ id: number }>();
  if (!run) throw new AppError(500, "MONITOR_NOT_STARTED", "The health check could not be started.");

  try {
    const candidates = await db.prepare(`SELECT v.id, v.embed_id AS embedId, v.thumbnail_key AS thumbnailKey
      FROM videos v LEFT JOIN video_health_checks h ON h.video_id = v.id
      WHERE v.is_active = 1 AND (h.next_check_at IS NULL OR h.next_check_at <= CURRENT_TIMESTAMP)
      ORDER BY CASE WHEN h.last_checked_at IS NULL THEN 0 ELSE 1 END, h.next_check_at, v.id DESC LIMIT ?`).bind(limit).all<Candidate>();
    const items = candidates.results ?? [];
    let brokenCount = 0;

    for (let offset = 0; offset < items.length; offset += 4) {
      const batch = items.slice(offset, offset + 4);
      const results = await Promise.all(batch.map(async (candidate) => ({ candidate, embed: await checkEmbed(candidate.embedId), thumbnail: await checkThumbnail(candidate.thumbnailKey) })));
      for (const result of results) {
        const failed = result.embed.status !== "ok" || ["missing", "error"].includes(result.thumbnail);
        if (failed) brokenCount += 1;
        const interval = result.embed.status === "ok" ? "+7 days" : result.embed.status === "blocked" || result.embed.status === "timeout" ? "+1 day" : "+6 hours";
        await db.prepare(`INSERT INTO video_health_checks (video_id, embed_status, thumbnail_status, response_time_ms, failure_count, last_error, last_checked_at, next_check_at)
          VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, datetime('now', ?))
          ON CONFLICT(video_id) DO UPDATE SET
            embed_status=excluded.embed_status, thumbnail_status=excluded.thumbnail_status, response_time_ms=excluded.response_time_ms,
            failure_count=CASE WHEN excluded.embed_status='ok' AND excluded.thumbnail_status NOT IN ('missing','error') THEN 0 ELSE video_health_checks.failure_count + 1 END,
            last_error=excluded.last_error, last_checked_at=CURRENT_TIMESTAMP, next_check_at=excluded.next_check_at, updated_at=CURRENT_TIMESTAMP`).bind(
          result.candidate.id, result.embed.status, result.thumbnail, result.embed.time, failed ? 1 : 0, result.embed.error, interval,
        ).run();
      }
    }

    await db.prepare("UPDATE monitor_runs SET status='completed', checked_count=?, broken_count=?, completed_at=CURRENT_TIMESTAMP WHERE id=?").bind(items.length, brokenCount, run.id).run();
    return { checked: items.length, broken: brokenCount };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Unknown monitor failure";
    await db.prepare("UPDATE monitor_runs SET status='failed', error=?, completed_at=CURRENT_TIMESTAMP WHERE id=?").bind(message, run.id).run();
    throw error;
  }
}
