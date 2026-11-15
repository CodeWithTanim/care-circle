import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionCookie } from "better-auth/cookies";
import { getAuth } from "@/lib/auth";

export async function requireSession() {
  const requestHeaders = await headers();
  if (!getSessionCookie(requestHeaders)) redirect("/sign-in");
  // A cookie alone is never authorization: validate it with Better Auth.
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  if (!session) redirect("/sign-in");
  return session;
}

export async function getApiSession(request?: Request) {
  const requestHeaders = request ? request.headers : await headers();
  if (!getSessionCookie(requestHeaders)) return null;
  const session = await getAuth().api.getSession({ headers: requestHeaders });
  return session;
}
