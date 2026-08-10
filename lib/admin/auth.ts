import { headers } from "next/headers";
import { getChatGPTUser, chatGPTSignInPath, type ChatGPTUser } from "@/app/chatgpt-auth";

export type AdminIdentity = ChatGPTUser & { local: boolean };
export type AdminAccess = { status: "allowed"; user: AdminIdentity } | { status: "anonymous"; signInPath: string } | { status: "denied"; email: string };

export async function getAdminAccess(returnTo = "/admin"): Promise<AdminAccess> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "";
  if (process.env.NODE_ENV !== "production" && /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host)) {
    return { status: "allowed", user: { userId: "local-admin", email: "local@localhost", displayName: "Local administrator", fullName: "Local administrator", local: true } };
  }

  const user = await getChatGPTUser();
  if (!user) return { status: "anonymous", signInPath: chatGPTSignInPath(returnTo) };
  const allowed = (process.env.ADMIN_EMAILS ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean);
  if (!allowed.includes(user.email.toLowerCase())) return { status: "denied", email: user.email };
  return { status: "allowed", user: { ...user, local: false } };
}
