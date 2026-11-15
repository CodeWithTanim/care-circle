import { NextResponse } from "next/server";
import { recordDose } from "@/lib/medication-service";
import { AuthorizationError } from "@/lib/permissions";
import { getApiSession } from "@/lib/session";

interface RouteProps {
  params: Promise<{ circleId: string; doseId: string }>;
}

export async function POST(request: Request, { params }: RouteProps) {
  const session = await getApiSession(request);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { circleId, doseId } = await params;
  try {
    const body = await request.json();
    const updated = await recordDose({
      userId: session.user.id,
      userName: session.user.name,
      circleId,
      occurrenceId: doseId,
      input: body,
    });
    return NextResponse.json({ dose: updated });
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const errMsg = err instanceof Error ? err.message : "Failed to record dose";
    return NextResponse.json({ error: errMsg }, { status: 400 });
  }
}
