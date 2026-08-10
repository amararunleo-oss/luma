import { headers } from "next/headers";

export type AdminIdentity = { userId: string; displayName: string; email: string; fullName: string | null; local: boolean };
export type AdminAccess = { status: "allowed"; user: AdminIdentity } | { status: "anonymous"; signInPath: string } | { status: "denied"; email: string };

export async function getAdminAccess(returnTo = "/admin"): Promise<AdminAccess> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "";
  if (process.env.NODE_ENV !== "production" && /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host)) {
    return { status: "allowed", user: { userId: "local-admin", email: "local@localhost", displayName: "Local administrator", fullName: "Local administrator", local: true } };
  }

  if (requestHeaders.get("x-luma-admin-authorized") !== "1") return { status: "anonymous", signInPath: returnTo };
  const username = requestHeaders.get("x-luma-admin-username") ?? "admin";
  return { status: "allowed", user: { userId: username, email: username, displayName: username, fullName: null, local: false } };
}
