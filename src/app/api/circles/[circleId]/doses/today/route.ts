import { NextResponse } from "next/server";
import { getTodayDoses } from "@/lib/medication-service";
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
    const targetDate = url.searchParams.get("date") ?? undefined;
    const result = await getTodayDoses({
      userId: session.user.id,
      circleId,
      targetDate,
    });
    return NextResponse.json(result);
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const errMsg = err instanceof Error ? err.message : "Failed to load doses";
    return NextResponse.json({ error: errMsg }, { status: 400 });
  }
}
