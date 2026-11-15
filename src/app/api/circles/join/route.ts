import { NextResponse } from "next/server";
import { joinCircleWithPasscode } from "@/lib/circle-service";
import { AuthorizationError } from "@/lib/permissions";
import { getApiSession } from "@/lib/session";

export async function POST(request: Request) {
  const session = await getApiSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const result = await joinCircleWithPasscode({
      userId: session.user.id,
      userEmail: session.user.email,
      userName: session.user.name,
      passcode: body.passcode ?? "",
    });
    return NextResponse.json(result);
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const errMsg = err instanceof Error ? err.message : "Failed to join circle";
    return NextResponse.json({ error: errMsg }, { status: 400 });
  }
}
