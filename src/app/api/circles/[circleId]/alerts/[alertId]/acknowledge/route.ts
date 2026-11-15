import { NextResponse } from "next/server";
import { acknowledgeAlert } from "@/lib/alert-service";
import { AuthorizationError } from "@/lib/permissions";
import { getApiSession } from "@/lib/session";

interface RouteProps {
  params: Promise<{ circleId: string; alertId: string }>;
}

export async function POST(request: Request, { params }: RouteProps) {
  const session = await getApiSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { circleId, alertId } = await params;
  try {
    const updated = await acknowledgeAlert({
      userId: session.user.id,
      userName: session.user.name,
      circleId,
      alertId,
    });
    return NextResponse.json({ alert: updated });
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const errMsg =
      err instanceof Error ? err.message : "Failed to acknowledge alert";
    return NextResponse.json({ error: errMsg }, { status: 400 });
  }
}
