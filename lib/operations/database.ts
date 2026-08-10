import { AppError } from "@/lib/http/errors";
import { getD1Database, type D1DatabaseLike, type D1Result, type D1Statement } from "@/lib/cloudflare/d1-http";

export type OperationsDatabase = D1DatabaseLike;
export type { D1Result, D1Statement };

let schemaReady: Promise<void> | null = null;

function binding() {
  return getD1Database();
}

async function initialize(db: OperationsDatabase) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS content_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      video_id INTEGER REFERENCES videos(id) ON DELETE SET NULL,
      video_slug TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('unavailable','thumbnail','metadata','duplicate','legal','other')),
      details TEXT NOT NULL DEFAULT '',
      contact_email TEXT,
      reporter_hash TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','reviewing','resolved','dismissed')),
      admin_note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_content_reports_status_created ON content_reports(status, created_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_content_reports_reporter_created ON content_reports(reporter_hash, created_at)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_content_reports_video ON content_reports(video_id, created_at)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS video_health_checks (
      video_id INTEGER PRIMARY KEY REFERENCES videos(id) ON DELETE CASCADE,
      embed_status TEXT NOT NULL DEFAULT 'unknown' CHECK(embed_status IN ('unknown','ok','broken','blocked','timeout')),
      thumbnail_status TEXT NOT NULL DEFAULT 'unknown' CHECK(thumbnail_status IN ('unknown','ok','missing','error')),
      response_time_ms INTEGER,
      failure_count INTEGER NOT NULL DEFAULT 0,
      last_error TEXT NOT NULL DEFAULT '',
      last_checked_at TEXT,
      next_check_at TEXT,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_video_health_next_check ON video_health_checks(next_check_at, embed_status)"),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_video_health_embed_status ON video_health_checks(embed_status, failure_count)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS monitor_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      status TEXT NOT NULL DEFAULT 'running' CHECK(status IN ('running','completed','failed')),
      checked_count INTEGER NOT NULL DEFAULT 0,
      broken_count INTEGER NOT NULL DEFAULT 0,
      error TEXT NOT NULL DEFAULT '',
      started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT
    )`),
    db.prepare("CREATE INDEX IF NOT EXISTS idx_monitor_runs_started ON monitor_runs(started_at)"),
  ]);
}

export async function operationsDatabase() {
  const db = binding();
  if (!db) throw new AppError(503, "DATABASE_UNAVAILABLE", "The reporting service is temporarily unavailable.");
  schemaReady ??= initialize(db).catch((error) => {
    schemaReady = null;
    throw error;
  });
  await schemaReady;
  return db;
}
