import { NextResponse } from "next/server";
import { updateNotificationPreferences } from "@/lib/circle-service";
import { AuthorizationError } from "@/lib/permissions";
import { getApiSession } from "@/lib/session";

interface RouteProps {
  params: Promise<{ circleId: string }>;
}

export async function PATCH(request: Request, { params }: RouteProps) {
  const session = await getApiSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { circleId } = await params;
  try {
    const body = await request.json();
    const updated = await updateNotificationPreferences({
      userId: session.user.id,
      circleId,
      input: body,
    });
    return NextResponse.json({ notifications: updated });
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const errMsg =
      err instanceof Error ? err.message : "Failed to update preferences";
    return NextResponse.json({ error: errMsg }, { status: 400 });
  }
}
