import { NextResponse } from "next/server";
import { revokeInvite } from "@/lib/circle-service";
import { AuthorizationError } from "@/lib/permissions";
import { getApiSession } from "@/lib/session";

interface RouteProps {
  params: Promise<{ circleId: string; inviteId: string }>;
}

export async function DELETE(request: Request, { params }: RouteProps) {
  const session = await getApiSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { circleId, inviteId } = await params;
  try {
    await revokeInvite({
      userId: session.user.id,
      circleId,
      inviteId,
    });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const errMsg =
      err instanceof Error ? err.message : "Failed to revoke invite";
    return NextResponse.json({ error: errMsg }, { status: 400 });
  }
}
