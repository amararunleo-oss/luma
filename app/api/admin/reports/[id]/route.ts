import { getAdminAccess } from "@/lib/admin/auth";
import { updateReport, type ReportStatus } from "@/lib/operations/repository";
import { AppError, errorResponse } from "@/lib/http/errors";

export const dynamic = "force-dynamic";
const statuses: ReportStatus[] = ["open", "reviewing", "resolved", "dismissed"];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await getAdminAccess("/admin");
    if (access.status !== "allowed") throw new AppError(access.status === "anonymous" ? 401 : 403, "ADMIN_REQUIRED", "Administrator access is required.");
    const id = Number((await params).id);
    if (!Number.isInteger(id) || id <= 0) throw new AppError(400, "INVALID_REPORT", "Select a valid report.");
    const body = await request.json() as { status?: unknown; note?: unknown };
    if (typeof body.status !== "string" || !statuses.includes(body.status as ReportStatus)) throw new AppError(400, "INVALID_STATUS", "Select a valid report status.");
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 1_000) : "";
    await updateReport(id, body.status as ReportStatus, note);
    return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
