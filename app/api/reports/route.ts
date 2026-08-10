import { createContentReport, reportCategories, type ReportCategory } from "@/lib/operations/repository";
import { AppError, errorResponse } from "@/lib/http/errors";

export const dynamic = "force-dynamic";

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

async function reporterHash(request: Request) {
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const agent = request.headers.get("user-agent") ?? "unknown";
  const salt = process.env.REPORT_RATE_SALT || "luma-report-rate-v1";
  const bytes = new TextEncoder().encode(`${salt}|${ip}|${agent}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, "0")).join("");
}

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > 16_384) throw new AppError(413, "REPORT_TOO_LARGE", "The report is too large.");
    if (!request.headers.get("content-type")?.includes("application/json")) throw new AppError(415, "INVALID_CONTENT_TYPE", "Send the report as JSON.");

    const body = await request.json() as Record<string, unknown>;
    if (body.website) return Response.json({ ok: true }, { status: 202 });
    const videoSlug = typeof body.videoSlug === "string" ? body.videoSlug.trim() : "";
    const category = typeof body.category === "string" ? body.category : "";
    const details = typeof body.details === "string" ? body.details.trim() : "";
    const contactEmail = typeof body.contactEmail === "string" ? body.contactEmail.trim() : "";

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(videoSlug) || videoSlug.length > 220) throw new AppError(400, "INVALID_VIDEO", "Select a valid catalog video.");
    if (!reportCategories.includes(category as ReportCategory)) throw new AppError(400, "INVALID_CATEGORY", "Select a valid issue type.");
    if (details.length > 1_000) throw new AppError(400, "DETAILS_TOO_LONG", "Details must be 1,000 characters or fewer.");
    if ((category === "metadata" || category === "legal" || category === "other") && details.length < 10) throw new AppError(400, "DETAILS_REQUIRED", "Add a short explanation so the issue can be reviewed.");
    if (contactEmail && !validEmail(contactEmail)) throw new AppError(400, "INVALID_EMAIL", "Enter a valid email address or leave it blank.");

    const created = await createContentReport({ videoSlug, category: category as ReportCategory, details, contactEmail: contactEmail || undefined, reporterHash: await reporterHash(request) });
    return Response.json({ ok: true, reportId: created.id, duplicate: created.duplicate }, { status: created.duplicate ? 200 : 201, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });
  } catch (error) {
    if (error instanceof SyntaxError) return errorResponse(new AppError(400, "INVALID_JSON", "The report could not be read."));
    return errorResponse(error);
  }
}
