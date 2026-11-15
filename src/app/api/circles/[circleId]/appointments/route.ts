import { NextResponse } from "next/server";
import { createAppointment, getAppointments } from "@/lib/appointment-service";
import { AuthorizationError } from "@/lib/permissions";
import { getApiSession } from "@/lib/session";

interface RouteProps {
  params: Promise<{ circleId: string }>;
}

export async function GET(request: Request, { params }: RouteProps) {
  const session = await getApiSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { circleId } = await params;
  try {
    const url = new URL(request.url);
    const upcomingOnly = url.searchParams.get("upcomingOnly") === "true";
    const appointments = await getAppointments({
      userId: session.user.id,
      circleId,
      upcomingOnly,
    });
    return NextResponse.json({ appointments });
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const errMsg =
      err instanceof Error ? err.message : "Failed to load appointments";
    return NextResponse.json({ error: errMsg }, { status: 400 });
  }
}

export async function POST(request: Request, { params }: RouteProps) {
  const session = await getApiSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { circleId } = await params;
  try {
    const body = await request.json();
    const appointment = await createAppointment({
      userId: session.user.id,
      circleId,
      input: body,
    });
    return NextResponse.json({ appointment }, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const errMsg =
      err instanceof Error ? err.message : "Failed to create appointment";
    return NextResponse.json({ error: errMsg }, { status: 400 });
  }
}
