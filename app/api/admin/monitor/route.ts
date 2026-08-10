import { getAdminAccess } from "@/lib/admin/auth";
import { runCatalogMonitor } from "@/lib/operations/monitor";
import { AppError, errorResponse } from "@/lib/http/errors";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const access = await getAdminAccess("/admin");
    const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const secretAllowed = Boolean(process.env.MONITOR_SECRET && bearer && bearer === process.env.MONITOR_SECRET);
    if (access.status !== "allowed" && !secretAllowed) throw new AppError(access.status === "anonymous" ? 401 : 403, "ADMIN_REQUIRED", "Administrator access is required.");
    const body = await request.json().catch(() => ({})) as { limit?: unknown };
    const limit = typeof body.limit === "number" ? body.limit : 20;
    return Response.json({ ok: true, ...(await runCatalogMonitor(limit)) }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return errorResponse(error);
  }
}
