import { NextResponse } from "next/server";
import { getAdherenceHistory } from "@/lib/medication-service";
import { AuthorizationError } from "@/lib/permissions";
import { getApiSession } from "@/lib/session";
import { getTodayLocalDate } from "@/lib/timezone";

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
    const today = getTodayLocalDate("UTC");
    const startDate = url.searchParams.get("startDate") ?? "2026-01-01";
    const endDate = url.searchParams.get("endDate") ?? today;

    const result = await getAdherenceHistory({
      userId: session.user.id,
      circleId,
      startDate,
      endDate,
    });
    return NextResponse.json(result);
  } catch (err: unknown) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const errMsg =
      err instanceof Error ? err.message : "Failed to load adherence history";
    return NextResponse.json({ error: errMsg }, { status: 400 });
  }
}
