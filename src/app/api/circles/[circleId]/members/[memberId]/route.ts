import { NextResponse } from "next/server";
import {
  removeMember,
  transferOwnership,
  updateMemberRole,
} from "@/lib/circle-service";
import { AuthorizationError } from "@/lib/permissions";
import { getApiSession } from "@/lib/session";

interface RouteProps {
  params: Promise<{ circleId: string; memberId: string }>;
}

export async function PATCH(request: Request, { params }: RouteProps) {
  const session = await getApiSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { circleId, memberId } = await params;
  try {
    const body = await request.json();

    if (body.action === "transferOwnership") {
      await transferOwnership({
        userId: session.user.id,
        circleId,
        input: { newOwnerUserId: memberId },
      });
      return NextResponse.json({ success: true, action: "transferOwnership" });
    }

    if (body.action === "updateRole") {
      await updateMemberRole({
        userId: session.user.id,
        circleId,
        targetUserId: memberId,
        newRole: body.role,
      });
      return NextResponse.json({ success: true, action: "updateRole" });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const errMsg =
      err instanceof Error ? err.message : "Failed to update member";
    return NextResponse.json({ error: errMsg }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: RouteProps) {
  const session = await getApiSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { circleId, memberId } = await params;
  try {
    await removeMember({
      userId: session.user.id,
      circleId,
      targetUserId: memberId,
    });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const errMsg =
      err instanceof Error ? err.message : "Failed to remove member";
    return NextResponse.json({ error: errMsg }, { status: 400 });
  }
}
