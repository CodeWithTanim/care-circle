import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/lib/auth";

export const runtime = "nodejs";

async function handle(request: Request) {
  const handlers = toNextJsHandler(getAuth());
  return request.method === "GET"
    ? handlers.GET(request)
    : handlers.POST(request);
}

export { handle as GET, handle as POST };
