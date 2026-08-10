import { AppError } from "@/lib/http/errors";
import { operationsDatabase } from "@/lib/operations/database";

export const reportCategories = ["unavailable", "thumbnail", "metadata", "duplicate", "legal", "other"] as const;
export type ReportCategory = typeof reportCategories[number];
export type ReportStatus = "open" | "reviewing" | "resolved" | "dismissed";

export async function createContentReport(input: { videoSlug: string; category: ReportCategory; details: string; contactEmail?: string; reporterHash: string }) {
  const db = await operationsDatabase();
  const video = await db.prepare("SELECT id FROM videos WHERE slug = ? AND is_active = 1 LIMIT 1").bind(input.videoSlug).first<{ id: number }>();
  if (!video) throw new AppError(404, "VIDEO_NOT_FOUND", "This video is no longer available in the catalog.");

  const rate = await db.prepare("SELECT COUNT(*) AS total FROM content_reports WHERE reporter_hash = ? AND created_at >= datetime('now', '-1 hour')").bind(input.reporterHash).first<{ total: number }>();
  if (Number(rate?.total ?? 0) >= 5) throw new AppError(429, "REPORT_RATE_LIMIT", "Too many reports were submitted. Please try again later.");

  const duplicate = await db.prepare("SELECT id FROM content_reports WHERE reporter_hash = ? AND video_id = ? AND category = ? AND status IN ('open','reviewing') AND created_at >= datetime('now', '-1 day') LIMIT 1").bind(input.reporterHash, video.id, input.category).first<{ id: number }>();
  if (duplicate) return { id: duplicate.id, duplicate: true };

  const created = await db.prepare(`INSERT INTO content_reports (video_id, video_slug, category, details, contact_email, reporter_hash)
    VALUES (?, ?, ?, ?, ?, ?) RETURNING id`).bind(video.id, input.videoSlug, input.category, input.details, input.contactEmail ?? null, input.reporterHash).first<{ id: number }>();
  if (!created) throw new AppError(500, "REPORT_NOT_SAVED", "The report could not be saved. Please try again.");
  return { id: created.id, duplicate: false };
}

export type AdminReport = { id: number; videoSlug: string; videoTitle: string; category: ReportCategory; details: string; contactEmail: string | null; status: ReportStatus; adminNote: string; createdAt: string };
export type HealthIssue = { slug: string; title: string; issue: string };

export async function getAdminDashboard() {
  const db = await operationsDatabase();
  const [stats, reports, issues, health, lastRun] = await Promise.all([
    db.prepare(`SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active,
      SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) AS inactive,
      SUM(CASE WHEN trim(description) = '' THEN 1 ELSE 0 END) AS missingDescription,
      SUM(CASE WHEN duration_seconds <= 0 THEN 1 ELSE 0 END) AS missingDuration,
      SUM(CASE WHEN trim(thumbnail_key) = '' THEN 1 ELSE 0 END) AS missingThumbnail,
      SUM(CASE WHEN embed_id <= 0 THEN 1 ELSE 0 END) AS missingEmbed,
      SUM(CASE WHEN NOT EXISTS (SELECT 1 FROM video_actresses va WHERE va.video_id = videos.id) THEN 1 ELSE 0 END) AS missingActress
      FROM videos`).first<Record<string, number>>(),
    db.prepare(`SELECT r.id, r.video_slug AS videoSlug, COALESCE(v.display_title, r.video_slug) AS videoTitle, r.category, r.details,
      r.contact_email AS contactEmail, r.status, r.admin_note AS adminNote, r.created_at AS createdAt
      FROM content_reports r LEFT JOIN videos v ON v.id = r.video_id
      ORDER BY CASE r.status WHEN 'open' THEN 0 WHEN 'reviewing' THEN 1 ELSE 2 END, r.created_at DESC LIMIT 50`).all<AdminReport>(),
    db.prepare(`SELECT slug, display_title AS title,
      CASE WHEN trim(thumbnail_key) = '' THEN 'Missing thumbnail' WHEN embed_id <= 0 THEN 'Invalid embed' WHEN duration_seconds <= 0 THEN 'Missing duration' WHEN trim(description) = '' THEN 'Missing description' ELSE 'Missing actress' END AS issue
      FROM videos v WHERE is_active = 1 AND (trim(thumbnail_key) = '' OR embed_id <= 0 OR duration_seconds <= 0 OR trim(description) = '' OR NOT EXISTS (SELECT 1 FROM video_actresses va WHERE va.video_id = v.id))
      ORDER BY id DESC LIMIT 30`).all<HealthIssue>(),
    db.prepare(`SELECT
      SUM(CASE WHEN embed_status = 'ok' AND thumbnail_status = 'ok' THEN 1 ELSE 0 END) AS healthy,
      SUM(CASE WHEN embed_status IN ('broken','blocked','timeout') OR thumbnail_status IN ('missing','error') THEN 1 ELSE 0 END) AS unhealthy,
      SUM(CASE WHEN embed_status = 'unknown' THEN 1 ELSE 0 END) AS unchecked
      FROM video_health_checks`).first<Record<string, number>>(),
    db.prepare("SELECT status, checked_count AS checkedCount, broken_count AS brokenCount, error, started_at AS startedAt, completed_at AS completedAt FROM monitor_runs ORDER BY id DESC LIMIT 1").first<{ status: string; checkedCount: number; brokenCount: number; error: string; startedAt: string; completedAt: string | null }>(),
  ]);
  const openReports = (reports.results ?? []).filter((report) => report.status === "open" || report.status === "reviewing").length;
  return { stats: stats ?? {}, reports: reports.results ?? [], issues: issues.results ?? [], health: health ?? {}, lastRun, openReports };
}

export async function updateReport(id: number, status: ReportStatus, note: string) {
  const db = await operationsDatabase();
  const report = await db.prepare("SELECT id FROM content_reports WHERE id = ?").bind(id).first<{ id: number }>();
  if (!report) throw new AppError(404, "REPORT_NOT_FOUND", "The report no longer exists.");
  await db.prepare("UPDATE content_reports SET status = ?, admin_note = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(status, note, id).run();
}
