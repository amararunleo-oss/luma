import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

function sameValue(left: string, right: string) {
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

function basicCredentials(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Basic ")) return null;
  try {
    const decoded = atob(authorization.slice(6));
    const separator = decoded.indexOf(":");
    if (separator < 0) return null;
    return { username: decoded.slice(0, separator), password: decoded.slice(separator + 1) };
  } catch {
    return null;
  }
}

export function proxy(request: NextRequest) {
  const monitorSecret = process.env.MONITOR_SECRET?.trim();
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (request.nextUrl.pathname === "/api/admin/monitor" && monitorSecret && bearer && sameValue(bearer, monitorSecret)) {
    return NextResponse.next();
  }

  const expectedUsername = process.env.ADMIN_USERNAME?.trim();
  const expectedPassword = process.env.ADMIN_PASSWORD?.trim();
  if (!expectedUsername || !expectedPassword) return new NextResponse("Not found", { status: 404 });

  const supplied = basicCredentials(request);
  if (!supplied || !sameValue(supplied.username, expectedUsername) || !sameValue(supplied.password, expectedPassword)) {
    return new NextResponse("Authentication required", {
      status: 401,
      headers: { "www-authenticate": 'Basic realm="Actrexx operations", charset="UTF-8"', "cache-control": "no-store" },
    });
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-actrexx-admin-authorized", "1");
  requestHeaders.set("x-actrexx-admin-username", expectedUsername);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
