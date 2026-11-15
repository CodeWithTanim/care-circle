import { NextResponse } from "next/server";
import { archiveMedication, updateMedication } from "@/lib/medication-service";
import { AuthorizationError } from "@/lib/permissions";
import { getApiSession } from "@/lib/session";

interface RouteProps {
  params: Promise<{ circleId: string; medId: string }>;
}

export async function PATCH(request: Request, { params }: RouteProps) {
  const session = await getApiSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { circleId, medId } = await params;
  try {
    const body = await request.json();
    const updated = await updateMedication({
      userId: session.user.id,
      circleId,
      medicationId: medId,
      input: body,
    });
    return NextResponse.json({ medication: updated });
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const errMsg =
      err instanceof Error ? err.message : "Failed to update medication";
    return NextResponse.json({ error: errMsg }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: RouteProps) {
  const session = await getApiSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { circleId, medId } = await params;
  try {
    await archiveMedication({
      userId: session.user.id,
      circleId,
      medicationId: medId,
    });
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const errMsg =
      err instanceof Error ? err.message : "Failed to archive medication";
    return NextResponse.json({ error: errMsg }, { status: 400 });
  }
}
