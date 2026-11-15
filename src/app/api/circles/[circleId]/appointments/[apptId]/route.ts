import { NextResponse } from "next/server";
import {
  cancelAppointment,
  updateAppointment,
} from "@/lib/appointment-service";
import { AuthorizationError } from "@/lib/permissions";
import { getApiSession } from "@/lib/session";

interface RouteProps {
  params: Promise<{ circleId: string; apptId: string }>;
}

export async function PATCH(request: Request, { params }: RouteProps) {
  const session = await getApiSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { circleId, apptId } = await params;
  try {
    const body = await request.json();
    const updated = await updateAppointment({
      userId: session.user.id,
      circleId,
      appointmentId: apptId,
      input: body,
    });
    return NextResponse.json({ appointment: updated });
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const errMsg =
      err instanceof Error ? err.message : "Failed to update appointment";
    return NextResponse.json({ error: errMsg }, { status: 400 });
  }
}

export async function DELETE(request: Request, { params }: RouteProps) {
  const session = await getApiSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { circleId, apptId } = await params;
  try {
    const cancelled = await cancelAppointment({
      userId: session.user.id,
      circleId,
      appointmentId: apptId,
    });
    return NextResponse.json({ appointment: cancelled });
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const errMsg =
      err instanceof Error ? err.message : "Failed to cancel appointment";
    return NextResponse.json({ error: errMsg }, { status: 400 });
  }
}
